/**
 * Edge-aware snapping for floor-plan objects.
 * Works in world coordinates (independent of zoom/pan).
 */
(function (global) {
  "use strict";

  const DEFAULT_RANGE = 12;

  /**
   * Build edge lists for an object (rotated → world AABB).
   * @param {{ x: number, y: number, width: number, height: number, rotation?: number }} r
   */
  function edgesOf(r) {
    const box =
      global.FPComponents && typeof global.FPComponents.worldAABB === "function"
        ? global.FPComponents.worldAABB(r)
        : { x: r.x, y: r.y, width: r.width, height: r.height };
    return {
      left: box.x,
      right: box.x + box.width,
      top: box.y,
      bottom: box.y + box.height,
      cx: box.x + box.width / 2,
      cy: box.y + box.height / 2,
    };
  }

  /**
   * Collect snap candidates from partner objects based on type rules.
   * @param {object} moving - rect being moved/resized
   * @param {object[]} others
   * @param {string} movingType
   * @param {Record<string, string[]>} partnersMap
   */
  function collectEdges(others, movingType, partnersMap) {
    const allowed = new Set(partnersMap[movingType] || []);
    const xs = [];
    const ys = [];

    for (const o of others) {
      if (!allowed.has(o.type)) continue;
      const e = edgesOf(o);
      xs.push(e.left, e.right, e.cx);
      ys.push(e.top, e.bottom, e.cy);
    }

    return { xs, ys };
  }

  /**
   * Snap a single value to the nearest candidate within range.
   * @returns {{ value: number, guide: number|null, dist: number }}
   */
  function snapValue(value, candidates, range) {
    let best = null;
    let bestDist = range + 1;

    for (const c of candidates) {
      const d = Math.abs(value - c);
      if (d <= range && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }

    if (best === null) {
      return { value, guide: null, dist: Infinity };
    }
    return { value: best, guide: best, dist: bestDist };
  }

  /**
   * Extra snap targets: doors/windows center onto wall thickness.
   */
  function collectMountTargets(others, movingType) {
    const xs = [];
    const ys = [];
    if (movingType !== "door" && movingType !== "window") {
      return { xs, ys };
    }
    for (const o of others) {
      if (o.type !== "wall") continue;
      const e = edgesOf(o);
      // Prefer wall centerline so openings sit in the wall
      xs.push(e.cx - 0); // used with center alignment of moving object
      ys.push(e.cy);
      xs.push(e.left, e.right);
      ys.push(e.top, e.bottom);
    }
    return { xs, ys };
  }

  /**
   * Snap position (top-left of local box) so the visual AABB edges/center align.
   * Rotation is around the object center; x/y are the unrotated top-left.
   * @param {{ x: number, y: number, width: number, height: number, rotation?: number }} rect
   * @param {object[]} others
   * @param {string} type
   * @param {object} options
   */
  function snapPosition(rect, others, type, options = {}) {
    const range = options.range ?? DEFAULT_RANGE;
    const partnersMap = options.partnersMap || global.FPComponents.SNAP_PARTNERS;
    const grid = options.grid ?? global.FPComponents.GRID;
    const useGrid = options.useGrid !== false;

    const { xs, ys } = collectEdges(others, type, partnersMap);
    const mount = collectMountTargets(others, type);
    xs.push(...mount.xs);
    ys.push(...mount.ys);

    // Snap the world AABB (accounts for rotation), then map center back to local x/y.
    const box = edgesOf(rect);
    const boxW = box.right - box.left;
    const boxH = box.bottom - box.top;

    const xCandidates = [];
    for (const edge of xs) {
      xCandidates.push(edge); // left aligns
      xCandidates.push(edge - boxW); // right aligns
      xCandidates.push(edge - boxW / 2); // center aligns
    }

    const yCandidates = [];
    for (const edge of ys) {
      yCandidates.push(edge);
      yCandidates.push(edge - boxH);
      yCandidates.push(edge - boxH / 2);
    }

    let boxX = box.left;
    let boxY = box.top;
    let guideV = null;
    let guideH = null;

    const sx = snapValue(boxX, xCandidates, range);
    if (sx.guide !== null) {
      boxX = sx.value;
      guideV = closestEdge(boxX, boxX + boxW, boxX + boxW / 2, xs);
    } else if (useGrid) {
      boxX = global.FPComponents.snapToGrid(boxX, grid);
    }

    const sy = snapValue(boxY, yCandidates, range);
    if (sy.guide !== null) {
      boxY = sy.value;
      guideH = closestEdge(boxY, boxY + boxH, boxY + boxH / 2, ys);
    } else if (useGrid) {
      boxY = global.FPComponents.snapToGrid(boxY, grid);
    }

    // Preserve local size; shift so AABB center matches snapped AABB center.
    const scx = boxX + boxW / 2;
    const scy = boxY + boxH / 2;
    const x = scx - rect.width / 2;
    const y = scy - rect.height / 2;

    return {
      x,
      y,
      guides: { v: guideV, h: guideH },
      active: guideV !== null || guideH !== null,
    };
  }

  function closestEdge(a, b, c, candidates) {
    let best = a;
    let bestDist = Infinity;
    for (const val of [a, b, c]) {
      for (const cand of candidates) {
        const d = Math.abs(val - cand);
        if (d < bestDist) {
          bestDist = d;
          best = cand;
        }
      }
    }
    return bestDist <= DEFAULT_RANGE * 2 ? best : a;
  }

  /**
   * Snap resize: keep opposite edge fixed, snap the moving edges.
   * @param {{ x: number, y: number, width: number, height: number }} rect
   * @param {{ left?: boolean, right?: boolean, top?: boolean, bottom?: boolean }} edges
   * @param {object[]} others
   * @param {string} type
   * @param {{ minW: number, minH: number }} mins
   * @param {object} options
   */
  function snapResize(rect, edges, others, type, mins, options = {}) {
    const range = options.range ?? DEFAULT_RANGE;
    const partnersMap = options.partnersMap || global.FPComponents.SNAP_PARTNERS;
    const grid = options.grid ?? global.FPComponents.GRID;
    const useGrid = options.useGrid !== false;

    const { xs, ys } = collectEdges(others, type, partnersMap);

    let { x, y, width, height } = rect;
    let guideV = null;
    let guideH = null;

    if (edges.left) {
      const right = x + width;
      let left = x;
      const s = snapValue(left, xs, range);
      if (s.guide !== null) {
        left = s.value;
        guideV = s.guide;
      } else if (useGrid) {
        left = global.FPComponents.snapToGrid(left, grid);
      }
      const newW = right - left;
      if (newW >= mins.minW) {
        width = newW;
        x = left;
      }
    }

    if (edges.right) {
      let right = x + width;
      const s = snapValue(right, xs, range);
      if (s.guide !== null) {
        right = s.value;
        guideV = s.guide;
      } else if (useGrid) {
        right = global.FPComponents.snapToGrid(right, grid);
      }
      const newW = right - x;
      if (newW >= mins.minW) {
        width = newW;
      }
    }

    if (edges.top) {
      const bottom = y + height;
      let top = y;
      const s = snapValue(top, ys, range);
      if (s.guide !== null) {
        top = s.value;
        guideH = s.guide;
      } else if (useGrid) {
        top = global.FPComponents.snapToGrid(top, grid);
      }
      const newH = bottom - top;
      if (newH >= mins.minH) {
        height = newH;
        y = top;
      }
    }

    if (edges.bottom) {
      let bottom = y + height;
      const s = snapValue(bottom, ys, range);
      if (s.guide !== null) {
        bottom = s.value;
        guideH = s.guide;
      } else if (useGrid) {
        bottom = global.FPComponents.snapToGrid(bottom, grid);
      }
      const newH = bottom - y;
      if (newH >= mins.minH) {
        height = newH;
      }
    }

    return {
      x,
      y,
      width,
      height,
      guides: { v: guideV, h: guideH },
      active: guideV !== null || guideH !== null,
    };
  }

  global.FPSnap = {
    snapPosition,
    snapResize,
    edgesOf,
    DEFAULT_RANGE,
  };
})(window);
