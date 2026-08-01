/**
 * interact.js wiring for canvas objects (drag + resize).
 * Coordinates live in world space; zoom is applied by dividing deltas.
 */
(function (global) {
  "use strict";

  let bound = false;
  /** @type {() => object|null} */
  let getApp = () => null;

  /** Per-gesture unsnapped position so grid snap cannot eat small deltas. */
  const gesture = {
    id: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    mode: null, // 'drag' | 'resize' | 'dim'
    axis: null, // 'w' | 'h' when mode === 'dim'
    /** @type {{ id: string, startX: number, startY: number }[]} */
    peers: [],
    startX: 0,
    startY: 0,
  };

  function othersExcept(app, id) {
    return app.objects.filter((o) => o.id !== id);
  }

  function clearGuides(app) {
    if (!app) return;
    app.snapGuides = { v: null, h: null, active: false };
    paintGuides(null, null);
  }

  function setGuides(app, guides, active) {
    // Paint guides via DOM first (no Alpine re-render mid-drag)
    paintGuides(active ? guides.v : null, active ? guides.h : null);
    if (!app) return;
    app.snapGuides = {
      v: active ? guides.v : null,
      h: active ? guides.h : null,
      active: !!active,
    };
  }

  function paintGuides(v, h) {
    const world = document.querySelector(".canvas-world");
    if (!world) return;

    let gv = world.querySelector(".snap-guide-v.live");
    let gh = world.querySelector(".snap-guide-h.live");

    if (v == null) {
      if (gv) gv.remove();
    } else {
      if (!gv) {
        gv = document.createElement("div");
        gv.className = "snap-guide snap-guide-v live";
        world.appendChild(gv);
      }
      gv.style.left = v + "px";
    }

    if (h == null) {
      if (gh) gh.remove();
    } else {
      if (!gh) {
        gh = document.createElement("div");
        gh.className = "snap-guide snap-guide-h live";
        world.appendChild(gh);
      }
      gh.style.top = h + "px";
    }
  }

  function findObject(app, el) {
    const node = el.closest ? el.closest(".fp-object") : el;
    if (!node) return null;
    const id = node.getAttribute("data-id") || node.dataset.id;
    if (!id) return null;
    const obj = app.objects.find((o) => o.id === id) || null;
    return obj ? { obj, el: node } : null;
  }

  function writeStyle(el, x, y, width, height, rotation) {
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = width + "px";
    el.style.height = height + "px";
    const rot =
      global.FPComponents && typeof global.FPComponents.normalizeRotation === "function"
        ? global.FPComponents.normalizeRotation(rotation)
        : Number(rotation) || 0;
    el.style.transformOrigin = "center center";
    el.style.transform = rot ? "rotate(" + rot + "deg)" : "none";
    el.style.setProperty("--obj-rot", rot + "deg");
    // Keep data attrs as a fallback source of truth during the gesture
    el.dataset.x = String(x);
    el.dataset.y = String(y);
    el.dataset.w = String(width);
    el.dataset.h = String(height);
    el.dataset.rot = String(rot);
  }

  function commit(app, obj) {
    app.patchObject(obj.id, {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation: global.FPComponents
        ? global.FPComponents.normalizeRotation(obj.rotation)
        : obj.rotation || 0,
    });
  }

  function commitPeers(app) {
    if (!app || !gesture.peers.length) return;
    for (const p of gesture.peers) {
      const o = app.objects.find((x) => x.id === p.id);
      if (o) commit(app, o);
    }
  }

  function writePeerStyles(app) {
    if (!app) return;
    for (const p of gesture.peers) {
      const o = app.objects.find((x) => x.id === p.id);
      if (!o) continue;
      const el = document.querySelector('.fp-object[data-id="' + o.id + '"]');
      if (el) writeStyle(el, o.x, o.y, o.width, o.height, o.rotation);
    }
  }

  function resizeFromDelta(raw, deltaRect, edges, zoom, mins) {
    let x = raw.x;
    let y = raw.y;
    let width = raw.width;
    let height = raw.height;

    const dLeft = deltaRect.left / zoom;
    const dTop = deltaRect.top / zoom;
    const dWidth = deltaRect.width / zoom;
    const dHeight = deltaRect.height / zoom;

    if (edges.left) {
      const right = raw.x + raw.width;
      x = raw.x + dLeft;
      width = right - x;
      if (width < mins.minW) {
        width = mins.minW;
        x = right - mins.minW;
      }
    } else if (edges.right) {
      width = Math.max(mins.minW, raw.width + dWidth);
    }

    if (edges.top) {
      const bottom = raw.y + raw.height;
      y = raw.y + dTop;
      height = bottom - y;
      if (height < mins.minH) {
        height = mins.minH;
        y = bottom - mins.minH;
      }
    } else if (edges.bottom) {
      height = Math.max(mins.minH, raw.height + dHeight);
    }

    return { x, y, width, height };
  }

  function setup(appGetter) {
    getApp = appGetter;

    if (typeof interact === "undefined") {
      console.error("[floor-plan] interact.js is not loaded");
      return;
    }

    // Allow re-binding after full reloads of this module in dev
    if (bound) {
      // Refresh getter only
      return;
    }
    bound = true;

    interact(".fp-object")
      .styleCursor(true)
      .draggable({
        inertia: false,
        autoScroll: false,
        // Do not start object-drag from resize handles or size labels
        ignoreFrom: ".handle, .dim-badge, .dim-leader, .dims, .dim-anchor",
        listeners: {
          start(event) {
            const app = getApp();
            if (!app) return;
            // Hand / pan tool never moves objects
            if (app.activeTool === "pan" || (app.panState && app.panState.spaceDown)) {
              gesture.mode = null;
              gesture.id = null;
              return;
            }
            const found = findObject(app, event.target);
            if (!found) return;
            const { obj, el } = found;

            if (obj.locked) {
              gesture.mode = null;
              gesture.id = null;
              return;
            }

            if (typeof app.pushHistory === "function") app.pushHistory();
            // Keep multi-select if this object is already part of it.
            // focus:false — don't pan/scroll mid-drag gesture
            if (typeof app.selectObject === "function") {
              if (!(app.selectedIds && app.selectedIds.includes(obj.id) && app.selectedIds.length > 1)) {
                app.selectObject(obj.id, { focus: false });
              } else {
                app.selectedId = obj.id;
              }
            }

            const peerIds =
              typeof app.movePeerIds === "function"
                ? app.movePeerIds(obj.id)
                : [obj.id];
            // Skip locked peers (still move unlocked ones)
            gesture.peers = peerIds
              .map((pid) => {
                const o = app.objects.find((x) => x.id === pid);
                if (!o || o.locked) return null;
                return { id: pid, startX: o.x, startY: o.y };
              })
              .filter(Boolean);

            if (!gesture.peers.length) {
              gesture.mode = null;
              return;
            }

            gesture.id = obj.id;
            gesture.x = obj.x;
            gesture.y = obj.y;
            gesture.startX = obj.x;
            gesture.startY = obj.y;
            gesture.width = obj.width;
            gesture.height = obj.height;
            gesture.mode = "drag";

            el.classList.add("is-dragging");
            el.setAttribute("data-dragging", "1");
            // Prevent Alpine :style from fighting mid-drag
            el.setAttribute("data-lock-style", "1");
            for (const p of gesture.peers) {
              const pel = document.querySelector('.fp-object[data-id="' + p.id + '"]');
              if (pel) pel.setAttribute("data-lock-style", "1");
            }
          },
          move(event) {
            const app = getApp();
            if (!app || gesture.mode !== "drag") return;
            const found = findObject(app, event.target);
            if (!found || found.obj.id !== gesture.id) return;
            const { obj, el } = found;

            const zoom = app.zoom || 1;
            // Accumulate in unsnapped space so small pointer steps still travel
            gesture.x += event.dx / zoom;
            gesture.y += event.dy / zoom;

            // Snap primary; peers follow the same world delta from start
            const exclude = new Set(gesture.peers.map((p) => p.id));
            const others = app.objects.filter((o) => !exclude.has(o.id));
            const snapped = FPSnap.snapPosition(
              {
                x: gesture.x,
                y: gesture.y,
                width: obj.width,
                height: obj.height,
                rotation: obj.rotation || 0,
              },
              others,
              obj.type,
              { useGrid: true }
            );

            const dx = snapped.x - gesture.startX;
            const dy = snapped.y - gesture.startY;

            for (const p of gesture.peers) {
              const o = app.objects.find((x) => x.id === p.id);
              if (!o) continue;
              o.x = p.startX + dx;
              o.y = p.startY + dy;
            }

            writeStyle(el, obj.x, obj.y, obj.width, obj.height, obj.rotation);
            writePeerStyles(app);
            setGuides(app, snapped.guides, snapped.active);
          },
          end(event) {
            const app = getApp();
            const found = app ? findObject(app, event.target) : null;
            if (found) {
              found.el.classList.remove("is-dragging");
              found.el.removeAttribute("data-dragging");
              found.el.removeAttribute("data-lock-style");
            }
            if (app && gesture.peers) {
              for (const p of gesture.peers) {
                const pel = document.querySelector('.fp-object[data-id="' + p.id + '"]');
                if (pel) pel.removeAttribute("data-lock-style");
              }
              commitPeers(app);
            }
            gesture.id = null;
            gesture.mode = null;
            gesture.peers = [];
            clearGuides(app);
          },
        },
      })
      .resizable({
        edges: {
          top: ".handle-n, .handle-ne, .handle-nw",
          bottom: ".handle-s, .handle-se, .handle-sw",
          left: ".handle-w, .handle-nw, .handle-sw",
          right: ".handle-e, .handle-ne, .handle-se",
        },
        listeners: {
          start(event) {
            const app = getApp();
            if (!app) return;
            const found = findObject(app, event.target);
            if (!found) return;
            const { obj, el } = found;

            if (obj.locked) {
              gesture.mode = null;
              return;
            }

            if (typeof app.pushHistory === "function") app.pushHistory();
            app.selectObject(obj.id, { focus: false });
            gesture.id = obj.id;
            gesture.x = obj.x;
            gesture.y = obj.y;
            gesture.width = obj.width;
            gesture.height = obj.height;
            gesture.mode = "resize";
            gesture.peers = [];
            el.setAttribute("data-lock-style", "1");
          },
          move(event) {
            const app = getApp();
            if (!app || gesture.mode !== "resize") return;
            const found = findObject(app, event.target);
            if (!found || found.obj.id !== gesture.id) return;
            const { obj, el } = found;

            const zoom = app.zoom || 1;
            const mins = FPComponents.getMinSize(obj.type);

            const next = resizeFromDelta(gesture, event.deltaRect, event.edges, zoom, mins);
            gesture.x = next.x;
            gesture.y = next.y;
            gesture.width = next.width;
            gesture.height = next.height;

            const snapped = FPSnap.snapResize(
              next,
              event.edges,
              othersExcept(app, obj.id),
              obj.type,
              mins,
              { useGrid: true }
            );

            obj.x = snapped.x;
            obj.y = snapped.y;
            obj.width = snapped.width;
            obj.height = snapped.height;
            writeStyle(el, obj.x, obj.y, obj.width, obj.height, obj.rotation);
            setGuides(app, snapped.guides, snapped.active);
          },
          end(event) {
            const app = getApp();
            const found = app ? findObject(app, event.target) : null;
            if (found) {
              found.el.removeAttribute("data-lock-style");
              if (app) commit(app, found.obj);
            }
            gesture.id = null;
            gesture.mode = null;
            clearGuides(app);
          },
        },
      });
  }

  global.FPInteract = {
    setup,
  };
})(window);
