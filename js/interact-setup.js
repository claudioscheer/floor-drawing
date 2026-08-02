/**
 * interact.js wiring for canvas objects.
 * Drag is owned by Alpine (app.startObjectDrag) so furniture under wall
 * hit-pads can move. interact.js only handles resize handles.
 */
(function (global) {
  "use strict";

  let bound = false;
  /** @type {() => object|null} */
  let getApp = () => null;

  /** Per-gesture state for resize */
  const gesture = {
    id: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    mode: null, // 'resize'
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
    const node = el && el.closest ? el.closest(".fp-object") : el;
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

    // Rebind cleanly so older builds cannot leave drag disabled forever
    try {
      interact(".fp-object").unset();
    } catch (_) {
      /* ignore */
    }
    bound = true;

    // Drag is owned by Alpine (app.startObjectDrag).
    // interact.js only handles resize handles.
    interact(".fp-object")
      .styleCursor(false)
      .draggable(false)
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
            el.setAttribute("data-lock-style", "1");
          },
          move(event) {
            const app = getApp();
            if (!app || gesture.mode !== "resize" || !gesture.id) return;
            const obj = app.objects.find((o) => o.id === gesture.id);
            const el = document.querySelector(
              '.fp-object[data-id="' + gesture.id + '"]'
            );
            if (!obj || !el) return;

            const zoom = app.zoom || 1;
            const mins = FPComponents.getMinSize(obj.type);

            const next = resizeFromDelta(
              gesture,
              event.deltaRect,
              event.edges,
              zoom,
              mins
            );
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
          end() {
            const app = getApp();
            const id = gesture.id;
            if (id && app) {
              const obj = app.objects.find((o) => o.id === id);
              const el = document.querySelector('.fp-object[data-id="' + id + '"]');
              if (el) el.removeAttribute("data-lock-style");
              if (obj) commit(app, obj);
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
