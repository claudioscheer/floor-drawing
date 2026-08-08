/**
 * First-person Three.js walkthrough mounted in a DOM container.
 */

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import type { PlanObject } from "@fp/types";
import { buildSceneFromPlan } from "./build-scene";
import {
  EYE_HEIGHT_M,
  FLY_SPEED_M_S,
  LAYER_TOP_M,
  SPRINT_SPEED_M_S,
  WALK_SPEED_M_S,
} from "./constants";

/** Public handle for the Visualize mode renderer. */
export interface VisualizerHandle {
  /** Rebuild meshes from the current plan and reset spawn. */
  rebuild(objects: readonly PlanObject[]): void;
  /** Start render loop and input (call when mode becomes visualize). */
  start(): void;
  /** Stop render loop and release pointer lock. */
  stop(): void;
  /** Tear down WebGL resources. */
  dispose(): void;
  /** Whether the render loop is active. */
  isRunning(): boolean;
  /** Whether pointer lock is held (walking). */
  isLocked(): boolean;
}

export interface CreateVisualizerOptions {
  /** Called when pointer lock is acquired or released. */
  onLockChange?: (locked: boolean) => void;
}

/**
 * Create a visualizer bound to a mount element (fills the element).
 * @param container - DOM node that receives the canvas
 * @param options - Optional callbacks
 */
export function createVisualizer(
  container: HTMLElement,
  options: CreateVisualizerOptions = {}
): VisualizerHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c8d8);
  scene.fog = new THREE.Fog(0xb8c8d8, 40, 90);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 200);
  camera.position.set(0, EYE_HEIGHT_M, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "viz-canvas";
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);

  // Lights
  const hemi = new THREE.HemisphereLight(0xddeeff, 0x667744, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
  sun.position.set(20, 35, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  // Reduce shadow acne on walls / furniture (floors no longer receive shadows)
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  const controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.object);

  let planRoot: THREE.Group | null = null;
  let running = false;
  let raf = 0;
  let lastT = 0;

  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
  };

  const onLock = () => options.onLockChange?.(true);
  const onUnlock = () => options.onLockChange?.(false);
  controls.addEventListener("lock", onLock);
  controls.addEventListener("unlock", onUnlock);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!running) return;
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.back = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = true;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = true;
        break;
      case "Space":
        keys.up = true;
        e.preventDefault();
        break;
      case "KeyC":
        keys.down = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = true;
        break;
      default:
        break;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.back = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = false;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = false;
        break;
      case "Space":
        keys.up = false;
        break;
      case "KeyC":
        keys.down = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = false;
        break;
      default:
        break;
    }
  };

  const onClick = () => {
    if (!running) return;
    if (!controls.isLocked) {
      controls.lock();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  renderer.domElement.addEventListener("click", onClick);

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  function resize(): void {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function clearPlan(): void {
    if (planRoot) {
      scene.remove(planRoot);
      planRoot.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose();
        }
      });
      planRoot = null;
    }
  }

  function rebuild(objects: readonly PlanObject[]): void {
    clearPlan();
    const built = buildSceneFromPlan(objects);
    planRoot = built.root;
    scene.add(planRoot);

    // Horizon grass well below terrain so it never z-fights lot slabs
    const groundSize = Math.max(
      40,
      (built.bounds.maxX - built.bounds.minX) * 2,
      (built.bounds.maxZ - built.bounds.minZ) * 2
    );
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ color: 0x8faf6a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = LAYER_TOP_M.worldGround;
    ground.receiveShadow = false;
    ground.castShadow = false;
    ground.name = "world-ground";
    planRoot.add(ground);

    // Position player
    controls.object.position.set(built.spawn.x, EYE_HEIGHT_M, built.spawn.z);
    // Yaw: PointerLockControls uses Euler on the camera object
    controls.object.rotation.order = "YXZ";
    controls.object.rotation.y = built.spawn.yaw;
    controls.object.rotation.x = 0;

    // Aim sun at lot center
    const midX = (built.bounds.minX + built.bounds.maxX) / 2;
    const midZ = (built.bounds.minZ + built.bounds.maxZ) / 2;
    sun.target.position.set(midX, 0, midZ);
    scene.add(sun.target);

    resize();
  }

  function tick(t: number): void {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const now = t * 0.001;
    const dt = Math.min(0.05, lastT ? now - lastT : 0.016);
    lastT = now;

    if (controls.isLocked) {
      const speed = (keys.sprint ? SPRINT_SPEED_M_S : WALK_SPEED_M_S) * dt;
      if (keys.forward) {
        controls.moveForward(speed);
      }
      if (keys.back) {
        controls.moveForward(-speed);
      }
      if (keys.right) {
        controls.moveRight(speed);
      }
      if (keys.left) {
        controls.moveRight(-speed);
      }

      if (keys.up || keys.down) {
        const verticalSpeed = (keys.sprint ? SPRINT_SPEED_M_S : FLY_SPEED_M_S) * dt;
        const pos = controls.object.position;
        pos.y += (keys.up ? verticalSpeed : 0) - (keys.down ? verticalSpeed : 0);
      }
    }

    renderer.render(scene, camera);
  }

  function start(): void {
    if (running) return;
    running = true;
    lastT = 0;
    resize();
    raf = requestAnimationFrame(tick);
  }

  function stop(): void {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (controls.isLocked) controls.unlock();
    keys.forward = keys.back = keys.left = keys.right = keys.up = keys.down = keys.sprint = false;
  }

  function dispose(): void {
    stop();
    clearPlan();
    resizeObserver.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer.domElement.removeEventListener("click", onClick);
    controls.removeEventListener("lock", onLock);
    controls.removeEventListener("unlock", onUnlock);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  }

  resize();

  return {
    rebuild,
    start,
    stop,
    dispose,
    isRunning: () => running,
    isLocked: () => controls.isLocked,
  };
}
