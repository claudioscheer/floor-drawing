/**
 * Component catalog and factory for floor-plan objects.
 * Pure data + helpers; no DOM dependencies.
 *
 * Real-world scale (linear, 1:1 with meters):
 *   1 world unit (px) = 1 centimeter
 *   100 world units  = 1 meter
 *
 * So a 0.50 m door is always half as long on screen as a 1.00 m segment.
 */
(function (global) {
  "use strict";

  /** 1 px = 1 cm → 100 px = 1 m */
  const PX_PER_METER = 100;
  const PX_PER_CM = 1;
  const DISPLAY_UNIT = "m"; // "m" | "cm"

  /** Snap grid: 5 cm */
  const GRID = 5;

  /** Convert meters → world px (canonical authoring unit). */
  function m(meters) {
    return Math.round(Number(meters) * PX_PER_METER);
  }

  /** Convert centimeters → world px. */
  function cm(centimeters) {
    return Math.round(Number(centimeters) * PX_PER_CM);
  }

  /**
   * @param {number} px
   * @param {"m"|"cm"} [unit]
   * @returns {number}
   */
  function pxToUnit(px, unit = DISPLAY_UNIT) {
    const n = Number(px) || 0;
    if (unit === "cm") return n / PX_PER_CM;
    return n / PX_PER_METER;
  }

  /**
   * @param {number} value
   * @param {"m"|"cm"} [unit]
   * @returns {number} world pixels
   */
  function unitToPx(value, unit = DISPLAY_UNIT) {
    const n = Number(value) || 0;
    if (unit === "cm") return n * PX_PER_CM;
    return n * PX_PER_METER;
  }

  /**
   * Label text for a length in world pixels.
   * Meters: two decimal places + " m". Centimeters: integer + " cm".
   * @param {number} px
   * @param {"m"|"cm"} [unit]
   */
  function formatLength(px, unit = DISPLAY_UNIT) {
    if (unit === "cm") {
      return Math.round(pxToUnit(px, "cm")) + " cm";
    }
    return pxToUnit(px, "m").toFixed(2) + " m";
  }

  /**
   * Area label from pixel² → m² (two decimals).
   * @param {number} px2
   */
  function formatArea(px2) {
    const m2 = (Number(px2) || 0) / (PX_PER_METER * PX_PER_METER);
    return m2.toFixed(2) + " m²";
  }

  // Typical real-world plan sizes (meters)
  // Exterior / party walls: 20 cm
  const WALL_T = m(0.2);
  const DOOR_W = m(0.9); // 90 cm single door
  const WINDOW_W = m(1.2); // 120 cm window
  const ROOM_W = m(4); // 4 m
  const ROOM_H = m(3); // 3 m

  const PLOT_W = m(8); // default terrain plot
  const PLOT_H = m(6);

  /** @type {Record<string, { type: string, label: string, description: string, defaults: object, minW: number, minH: number, z: number }>} */
  const CATALOG = {
    terrain: {
      type: "terrain",
      label: "Terrain",
      description: "Site / ground plot",
      defaults: { width: PLOT_W, height: PLOT_H, name: "Terrain" },
      minW: m(1),
      minH: m(1),
      z: 0,
    },
    floor: {
      type: "floor",
      label: "Floor",
      description: "Room slab / base area",
      defaults: { width: ROOM_W, height: ROOM_H, name: "Floor" },
      minW: m(0.5),
      minH: m(0.5),
      z: 1,
    },
    wall: {
      type: "wall",
      label: "Wall",
      description: "Structural wall segment",
      // Default horizontal wall: 2 m long × 20 cm thick
      defaults: { width: m(2), height: WALL_T, name: "" },
      minW: m(0.1),
      minH: m(0.1),
      z: 5,
    },
    window: {
      type: "window",
      label: "Window",
      description: "Snaps to walls",
      // 1.20 m wide opening, same depth as wall
      defaults: { width: WINDOW_W, height: WALL_T, name: "Window" },
      minW: m(0.4),
      minH: m(0.1),
      z: 8,
    },
    door: {
      type: "door",
      label: "Door",
      description: "Snaps to walls",
      // 0.90 m clear opening, same depth as wall
      // hinge: start|end along the leaf; opens: neg|pos perpendicular (swing side)
      defaults: {
        width: DOOR_W,
        height: WALL_T,
        name: "Door",
        hinge: "end",
        opens: "neg",
      },
      minW: m(0.5),
      minH: m(0.1),
      z: 8,
    },
  };

  /** Preferred snap partners for each type (order = priority). */
  const SNAP_PARTNERS = {
    terrain: ["terrain"],
    floor: ["floor", "terrain"],
    wall: ["floor", "wall", "terrain"],
    window: ["wall", "window"],
    door: ["wall", "door"],
  };

  let idCounter = 1;

  function nextId(type) {
    return `${type}-${idCounter++}`;
  }

  function seedIdCounter(objects) {
    let max = 0;
    for (const obj of objects) {
      const mMatch = String(obj.id).match(/-(\d+)$/);
      if (mMatch) max = Math.max(max, Number(mMatch[1]));
    }
    idCounter = max + 1;
  }

  /**
   * Normalize rotation to [0, 360).
   * @param {unknown} deg
   * @returns {number}
   */
  function normalizeRotation(deg) {
    let r = Number(deg);
    if (!Number.isFinite(r)) r = 0;
    r = ((r % 360) + 360) % 360;
    if (r > 359.999) r = 0;
    return r;
  }

  /**
   * Clamp opacity to [0, 1]. Values > 1 treated as percent (e.g. 50 → 0.5).
   * @param {unknown} value
   * @returns {number}
   */
  function clampOpacity(value) {
    let n = Number(value);
    if (!Number.isFinite(n)) return 1;
    if (n > 1) n = n / 100;
    if (n < 0) n = 0;
    if (n > 1) n = 1;
    return Math.round(n * 1000) / 1000;
  }

  /**
   * Rotate point (x,y) around (cx,cy) by degrees (screen y-down, clockwise positive
   * matches CSS rotate).
   */
  function rotatePoint(x, y, cx, cy, deg) {
    const r = (Number(deg) * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  }

  function objectCenter(obj) {
    return {
      x: (Number(obj.x) || 0) + (Number(obj.width) || 0) / 2,
      y: (Number(obj.y) || 0) + (Number(obj.height) || 0) / 2,
    };
  }

  /**
   * Axis-aligned bounding box of a (possibly rotated) object in world space.
   * Local x/y/width/height describe the unrotated box; rotation is around center.
   */
  function worldAABB(obj) {
    const x = Number(obj.x) || 0;
    const y = Number(obj.y) || 0;
    const w = Number(obj.width) || 0;
    const h = Number(obj.height) || 0;
    const rot = normalizeRotation(obj.rotation);
    if (!rot) {
      return { x, y, width: w, height: h };
    }
    const c = objectCenter(obj);
    const corners = [
      rotatePoint(x, y, c.x, c.y, rot),
      rotatePoint(x + w, y, c.x, c.y, rot),
      rotatePoint(x + w, y + h, c.x, c.y, rot),
      rotatePoint(x, y + h, c.x, c.y, rot),
    ];
    let minX = corners[0].x;
    let maxX = corners[0].x;
    let minY = corners[0].y;
    let maxY = corners[0].y;
    for (let i = 1; i < 4; i++) {
      minX = Math.min(minX, corners[i].x);
      maxX = Math.max(maxX, corners[i].x);
      minY = Math.min(minY, corners[i].y);
      maxY = Math.max(maxY, corners[i].y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * @param {string} type
   * @param {{ x?: number, y?: number, width?: number, height?: number, name?: string, id?: string, notes?: string, rotation?: number }} [overrides]
   */
  function createObject(type, overrides = {}) {
    const def = CATALOG[type];
    if (!def) throw new Error(`Unknown component type: ${type}`);

    const width = overrides.width ?? def.defaults.width;
    const height = overrides.height ?? def.defaults.height;

    const obj = {
      id: overrides.id || nextId(type),
      type,
      name: overrides.name !== undefined ? overrides.name : def.defaults.name,
      notes: overrides.notes ?? "",
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      width,
      height,
      /** Degrees, clockwise (CSS), pivot = object center. */
      rotation: normalizeRotation(
        overrides.rotation !== undefined ? overrides.rotation : def.defaults.rotation ?? 0
      ),
      /**
       * Center label angle in world space (0 = upright).
       * Local CSS = labelRotation − object.rotation so text can stay upright
       * or align with a rotated floor.
       */
      labelRotation: normalizeRotation(
        overrides.labelRotation !== undefined
          ? overrides.labelRotation
          : def.defaults.labelRotation ?? 0
      ),
      /** Layer stack: visibility / lock / optional group membership. */
      visible: overrides.visible !== undefined ? !!overrides.visible : true,
      locked: overrides.locked !== undefined ? !!overrides.locked : false,
      groupId: overrides.groupId != null && overrides.groupId !== "" ? String(overrides.groupId) : null,
      /** 0–1 CSS opacity (1 = solid). */
      opacity: clampOpacity(
        overrides.opacity !== undefined ? overrides.opacity : def.defaults.opacity ?? 1
      ),
      showDimensions: overrides.showDimensions !== undefined ? !!overrides.showDimensions : true,
      dimOffW: {
        x: overrides.dimOffW?.x ?? 0,
        y: overrides.dimOffW?.y ?? 0,
      },
      dimOffH: {
        x: overrides.dimOffH?.x ?? 0,
        y: overrides.dimOffH?.y ?? 0,
      },
    };

    if (type === "door") {
      obj.hinge = overrides.hinge ?? def.defaults.hinge ?? "start";
      obj.opens = overrides.opens ?? def.defaults.opens ?? "neg";
    }

    return obj;
  }

  /**
   * AutoCAD-style 2D door in WORLD coords.
   *
   * Hinge sits on the wall face toward the swing (not mid-thickness).
   * Leaf is drawn OPEN at 90°; arc is the quarter-circle from closed free
   * end (along the opening) to the open free end — same as plan CAD symbols.
   *
   * hinge: start|end along the opening
   * opens: neg|pos perpendicular (Up/Down for horizontal, Left/Right for vertical)
   */
  function doorGeometry(obj) {
    const w = obj.width;
    const h = obj.height;
    const horizontal = w >= h;
    const R = horizontal ? w : h;
    const hinge = obj.hinge === "end" ? "end" : "start";
    const opens = obj.opens === "pos" ? "pos" : "neg";
    const rot = normalizeRotation(obj.rotation);
    const rotRad = (rot * Math.PI) / 180;

    let lx;
    let ly;
    let aClosed; // angle of closed leaf (along the wall opening)
    let aOpen; // angle of open leaf (into swing side)

    if (horizontal) {
      // Leaf runs along X. Hinge on left (start) or right (end).
      lx = hinge === "start" ? 0 : w;
      // Hinge on the face toward the swing: neg = top (y=0), pos = bottom (y=h)
      ly = opens === "neg" ? 0 : h;
      // Closed: along the opening away from hinge
      aClosed = hinge === "start" ? 0 : Math.PI;
      // Open: perpendicular into the swing side
      // Screen y-down: -π/2 = up, +π/2 = down
      aOpen = opens === "neg" ? -Math.PI / 2 : Math.PI / 2;
    } else {
      // Leaf runs along Y. Hinge on top (start) or bottom (end).
      ly = hinge === "start" ? 0 : h;
      lx = opens === "neg" ? 0 : w;
      aClosed = hinge === "start" ? Math.PI / 2 : -Math.PI / 2;
      aOpen = opens === "neg" ? Math.PI : 0;
    }

    // Local (unrotated) hinge, then rotate whole door symbol around object center
    let hx = obj.x + lx;
    let hy = obj.y + ly;
    if (rot) {
      const c = objectCenter(obj);
      const hp = rotatePoint(hx, hy, c.x, c.y, rot);
      hx = hp.x;
      hy = hp.y;
      aClosed += rotRad;
      aOpen += rotRad;
    }

    const closedEnd = {
      x: hx + R * Math.cos(aClosed),
      y: hy + R * Math.sin(aClosed),
    };
    const openEnd = {
      x: hx + R * Math.cos(aOpen),
      y: hy + R * Math.sin(aOpen),
    };

    // Shortest signed delta from closed → open (should be ±π/2)
    let angleDelta = aOpen - aClosed;
    while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
    while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

    const pad = 3;
    const minX = Math.min(hx, closedEnd.x, openEnd.x) - pad;
    const minY = Math.min(hy, closedEnd.y, openEnd.y) - pad;
    const maxX = Math.max(hx, closedEnd.x, openEnd.x) + pad;
    const maxY = Math.max(hy, closedEnd.y, openEnd.y) + pad;

    return {
      horizontal,
      R,
      hx,
      hy,
      hinge,
      opens,
      rotation: rot,
      aClosed,
      aOpen,
      angleDelta,
      start: closedEnd,
      end: openEnd,
      closedEnd,
      openEnd,
      minX,
      minY,
      maxX,
      maxY,
      boxW: maxX - minX,
      boxH: maxY - minY,
    };
  }

  function toLocal(g, p) {
    return { x: p.x - g.minX, y: p.y - g.minY };
  }

  /**
   * Legacy combined path. Prefer doorArcPath + doorLeafPath + doorSectorPath.
   */
  function doorSymbolPath(obj) {
    return doorArcPath(obj);
  }

  /**
   * Light-filled swing sector (Maket-style): hinge → closed free end → arc → open free end → hinge.
   */
  function doorSectorPath(obj) {
    const g = doorGeometry(obj);
    const h = toLocal(g, { x: g.hx, y: g.hy });
    const c = toLocal(g, g.closedEnd);
    const steps = 32;
    let d = "M " + h.x + " " + h.y + " L " + c.x + " " + c.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = g.aClosed + g.angleDelta * t;
      const wx = g.hx + g.R * Math.cos(a);
      const wy = g.hy + g.R * Math.sin(a);
      d += " L " + (wx - g.minX) + " " + (wy - g.minY);
    }
    d += " Z";
    return d;
  }

  /**
   * Dashed quarter-circle swing: free end of closed leaf → free end of open leaf.
   */
  function doorArcPath(obj) {
    const g = doorGeometry(obj);
    const steps = 32;
    const c = toLocal(g, g.closedEnd);
    let d = "M " + c.x + " " + c.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = g.aClosed + g.angleDelta * t;
      const wx = g.hx + g.R * Math.cos(a);
      const wy = g.hy + g.R * Math.sin(a);
      d += " L " + (wx - g.minX) + " " + (wy - g.minY);
    }
    return d;
  }

  /**
   * Solid open leaf at 90°: hinge → open free end.
   */
  function doorLeafPath(obj) {
    const g = doorGeometry(obj);
    const h = toLocal(g, { x: g.hx, y: g.hy });
    const o = toLocal(g, g.openEnd);
    return "M " + h.x + " " + h.y + " L " + o.x + " " + o.y;
  }

  function doorClosedLeafPath(obj) {
    const g = doorGeometry(obj);
    const h = toLocal(g, { x: g.hx, y: g.hy });
    const c = toLocal(g, g.closedEnd);
    return "M " + h.x + " " + h.y + " L " + c.x + " " + c.y;
  }

  function doorHingeRect(obj) {
    const g = doorGeometry(obj);
    const h = toLocal(g, { x: g.hx, y: g.hy });
    const s = 3;
    return { x: h.x - s / 2, y: h.y - s / 2, s: s };
  }

  function doorJambPath() {
    return "";
  }
  function doorOpenLeafPath(obj) {
    return doorLeafPath(obj);
  }
  function doorSweepPath() {
    return "";
  }

  function getCatalogList() {
    return Object.values(CATALOG).map((c) => ({
      type: c.type,
      label: c.label,
      description: c.description,
    }));
  }

  function getMinSize(type) {
    const def = CATALOG[type];
    return def ? { minW: def.minW, minH: def.minH } : { minW: m(0.08), minH: m(0.08) };
  }

  function snapToGrid(value, grid = GRID) {
    return Math.round(value / grid) * grid;
  }

  /**
   * Multifamily demo:
   * - 4 apartments, each 6.00 × 6.00 m (36 m²) clear floor
   * - Recuo lateral 1.50 m
   * - Walls 0.20 m thick
   * - Envelope walls segmented per apt; only party walls are shared
   * 100 px = 1 m
   */
  function createDemoLayout() {
    const t = WALL_T; // 0.20 m
    const objs = [];
    let seq = 0;
    const add = (type, overrides) => {
      seq += 1;
      const o = createObject(type, {
        id: type + "-" + seq,
        showDimensions: false,
        ...overrides,
      });
      objs.push(o);
      return o;
    };

    // --- Lot ---
    const OX = m(0.5);
    const OY = m(0.5);
    const SIDE = m(1.5); // recuo lateral
    const FRONT = m(3.0);
    const MOTO_D = m(3.0);
    const APT = m(6.0); // each apartment 6 × 6 m

    const BX = OX + SIDE;
    const BY = OY;
    const BLDG_W = APT;
    const BLDG_H = APT * 4; // 4 stacked apts → 24 m
    const PARK_X = BX + BLDG_W;
    const LOT_W = m(16);
    const LOT_H = BLDG_H + FRONT;
    const PARK_W = OX + LOT_W - PARK_X;

    /*
     * Strict 6.00 × 6.00 m room grid (must sum exactly on both axes):
     *
     *   ┌─ 2.50 ─┬──── 3.50 ────┐
     *   │ Banho  │ Quarto       │  2.50
     *   ├────────┼──────────────┤
     *   │Cozinha │ Sala Estar   │  3.50
     *   └────────┴──────────────┘
     *     2.50        3.50
     *
     *   2.50+3.50 = 6.00  (width and height)
     *   Areas: 6.25 + 8.75 + 8.75 + 12.25 = 36.00 m²
     */
    const BANHO_W = m(2.5);
    const QUARTO_W = APT - BANHO_W; // 3.5
    const TOP_H = m(2.5); // banho + quarto
    const BOT_H = APT - TOP_H; // 3.5 cozinha + estar
    const COZ_W = m(2.5); // same column as banho

    // Terrain
    add("terrain", {
      x: OX,
      y: OY,
      width: LOT_W,
      height: LOT_H,
      name: "Lot 16×27 m",
      showDimensions: true,
    });

    // Recuo lateral 1.50 m
    add("floor", {
      x: OX,
      y: OY,
      width: SIDE,
      height: BLDG_H,
      name: "Recuo lateral 1,50 m",
    });

    // Front free strip
    add("floor", {
      x: OX,
      y: OY + BLDG_H,
      width: LOT_W,
      height: FRONT,
      name: "Faixa frontal 3,00 m",
      showDimensions: true,
    });

    // Drive
    add("floor", {
      x: PARK_X,
      y: OY + MOTO_D,
      width: PARK_W,
      height: BLDG_H - MOTO_D,
      name: "Circulação de veículos",
    });

    // Motos
    add("floor", {
      x: PARK_X,
      y: OY,
      width: PARK_W,
      height: MOTO_D,
      name: "Motos 3,00 m",
      showDimensions: true,
    });

    // Car bays 2.80 × 5.00
    const BAY_W = m(2.8);
    const BAY_D = m(5);
    const bayX = OX + LOT_W - BAY_D - m(0.15);
    const bayY0 = OY + MOTO_D;
    const bayCount = Math.min(8, Math.floor((BLDG_H - MOTO_D) / BAY_W));
    for (let i = 0; i < bayCount; i++) {
      add("floor", {
        x: bayX,
        y: bayY0 + i * BAY_W,
        width: BAY_D,
        height: BAY_W,
        name: "Vaga " + (i + 1) + " (2,80×5,00)",
        showDimensions: i === 0,
      });
    }

    // --- Four identical 6×6 apartments (Apto 4 fundo → Apto 1 frente) ---
    // One template: same rooms, fixtures, doors, windows, wall segments.
    const groups = [];

    /**
     * Build one apt at (ax, ay). Relative layout matches the approved plan:
     * Banho 2.5×2.5 · Quarto 3.5×2.5 · Cozinha 2.5×3.5 · Estar 3.5×3.5
     */
    function buildApartment(ax, ay, aptNum, isFundo, isFrente) {
      const groupId = "apt-" + aptNum;
      groups.push({ id: groupId, name: "Apto " + aptNum, collapsed: false });
      const g = { groupId };
      const openY = ay + TOP_H;

      // Rooms (exact 6×6 grid)
      add("floor", { x: ax, y: ay, width: BANHO_W, height: TOP_H, name: "Banho", ...g });
      add("floor", {
        x: ax + BANHO_W,
        y: ay,
        width: QUARTO_W,
        height: TOP_H,
        name: "Quarto",
        ...g,
      });
      add("floor", {
        x: ax,
        y: openY,
        width: COZ_W,
        height: BOT_H,
        name: "Cozinha",
        ...g,
      });
      add("floor", {
        x: ax + COZ_W,
        y: openY,
        width: APT - COZ_W,
        height: BOT_H,
        name: "Sala Estar",
        ...g,
      });

      // Envelope walls — one segment per apt (shared party wall separate)
      add("wall", {
        x: ax,
        y: ay,
        width: t,
        height: APT,
        name: "Parede oeste",
        ...g,
      });
      add("wall", {
        x: ax + APT - t,
        y: ay,
        width: t,
        height: APT,
        name: "Parede leste",
        ...g,
      });
      if (isFundo) {
        add("wall", {
          x: ax,
          y: ay,
          width: APT,
          height: t,
          name: "Parede norte",
          ...g,
        });
      }
      if (isFrente) {
        add("wall", {
          x: ax,
          y: ay + APT - t,
          width: APT,
          height: t,
          name: "Parede sul",
          ...g,
        });
      }

      // Internal walls
      add("wall", {
        x: ax + BANHO_W - t / 2,
        y: ay,
        width: t,
        height: TOP_H,
        name: "Parede banho/quarto",
        ...g,
      });
      add("wall", {
        x: ax,
        y: openY - t / 2,
        width: APT,
        height: t,
        name: "Parede interna",
        ...g,
      });

      /*
       * Fixture layout — exact organization from approved apartment plan.
       * Relative coords (m) from apt origin (ax, ay). Copied identically to every apt.
       *
       * Banho 2.5×2.5:
       *   Box NW · Máquina NE · Pia/Tanque SW · Vaso mid-S · door on south wall
       * Quarto 3.5×2.5:
       *   Cama west · Roupeiro NE · door on south wall
       * Cozinha 2.5×3.5:
       *   Pia W · Fogão W · Armário SW · Geladeira SE (beside armário)
       * Estar 3.5×3.5:
       *   Mesa center-west · Sofá south · entrada east
       */

      // --- Banho ---
      add("floor", {
        x: ax + m(0.35),
        y: ay + m(0.25),
        width: m(1.3),
        height: m(1.0),
        name: "Box chuveiro",
        ...g,
      }); // 1.30 m²
      add("floor", {
        x: ax + m(1.75),
        y: ay + m(0.25),
        width: m(0.6),
        height: m(0.6),
        name: "Máquina de lavar",
        ...g,
      }); // 0.36 m²
      add("floor", {
        x: ax + m(0.25),
        y: ay + m(1.35),
        width: m(0.55),
        height: m(1.0),
        labelRotation: 270,
        name: "Pia / Tanque",
        ...g,
      }); // 0.55 m²
      // Vaso — just right of porta banho hinge (outside swing), 0.40 × 0.80
      // Matches plan: door swing left into free floor; vaso on hinge side
      add("floor", {
        x: ax + m(1.9),
        y: ay + TOP_H - m(0.8) - m(0.15),
        width: m(0.4),
        height: m(0.8),
        name: "Vaso",
        ...g,
      }); // 0.32 m²

      // --- Quarto ---
      add("floor", {
        x: ax + m(2.7),
        y: ay + m(0.3),
        width: m(1.4),
        height: m(1.7),
        name: "Cama",
        ...g,
      }); // 2.38 m² — ends x = ax+4.1
      // Roupeiro 1.50 × 0.40 = 0.60 m² (top-right of quarto)
      add("floor", {
        x: ax + APT - m(1.5) - m(0.25),
        y: ay + m(0.25),
        width: m(1.5),
        height: m(0.4),
        name: "Roupeiro",
        ...g,
      });

      // --- Cozinha (north clear for porta banho landing) ---
      add("floor", {
        x: ax + m(0.25),
        y: openY + m(0.55),
        width: m(0.6),
        height: m(1.2),
        labelRotation: 270,
        name: "Pia",
        ...g,
      }); // 0.72 m²
      add("floor", {
        x: ax + m(0.25),
        y: openY + m(1.95),
        width: m(0.6),
        height: m(0.6),
        name: "Fogão",
        ...g,
      }); // 0.36 m²
      // Armário + geladeira on south wall of kitchen (side by side)
      add("floor", {
        x: ax + m(0.25),
        y: ay + APT - m(0.6) - m(0.25),
        width: m(1.3),
        height: m(0.6),
        name: "Armário",
        ...g,
      }); // 0.78 m²
      add("floor", {
        x: ax + m(1.65),
        y: ay + APT - m(0.7) - m(0.25),
        width: m(0.7),
        height: m(0.7),
        name: "Geladeira",
        ...g,
      }); // 0.49 m²

      // --- Sala Estar ---
      // Mesa centered on cozinha | estar boundary
      add("floor", {
        x: ax + COZ_W - m(0.4),
        y: openY + (BOT_H - m(1.2)) / 2,
        width: m(0.8),
        height: m(1.2),
        name: "Mesa",
        ...g,
      }); // 0.96 m²
      add("floor", {
        x: ax + m(3.15),
        y: ay + APT - m(0.9) - m(0.3),
        width: m(1.8),
        height: m(0.9),
        name: "Sofá",
        ...g,
      }); // 1.62 m²

      // --- Doors ---
      // Porta banho 0.70 × wall — hinge right; swing up into banho (left of hinge)
      add("door", {
        x: ax + m(1.15),
        y: openY - t / 2,
        width: m(0.7),
        height: t,
        name: "Porta banho",
        hinge: "end",
        opens: "neg",
        ...g,
      }); // door ends ax+1.85; vaso starts ax+1.90
      // Porta quarto — east of bed (bed ends ax+4.1)
      add("door", {
        x: ax + BANHO_W + m(2.15),
        y: openY - t / 2,
        width: m(0.8),
        height: t,
        name: "Porta quarto",
        hinge: "end",
        opens: "neg",
        ...g,
      });
      add("door", {
        x: ax + APT - t,
        y: openY + m(1.1),
        width: t,
        height: DOOR_W,
        name: "Entrada",
        hinge: "start",
        opens: "neg",
        ...g,
      });

      // --- Windows ---
      add("window", {
        x: ax,
        y: ay + m(0.6),
        width: t,
        height: m(0.8),
        name: "Janela banho",
        ...g,
      });
      add("window", {
        x: ax,
        y: openY + m(0.9),
        width: t,
        height: m(1.1),
        name: "Janela cozinha",
        ...g,
      });
      add("window", {
        x: ax + APT - t,
        y: openY + m(2.0),
        width: t,
        height: m(1.0),
        name: "Janela estar",
        ...g,
      });
      // Janela quarto — lower on east wall, clear of roupeiro (top)
      add("window", {
        x: ax + APT - t,
        y: ay + m(1.25),
        width: t,
        height: m(1.0),
        name: "Janela quarto",
        ...g,
      });
    }

    for (let a = 0; a < 4; a++) {
      const ay = BY + a * APT;
      const aptNum = 4 - a;
      buildApartment(BX, ay, aptNum, a === 0, a === 3);
      // Shared party wall between this apt and the one toward the front
      if (a < 3) {
        add("wall", {
          x: BX,
          y: ay + APT - t / 2,
          width: APT,
          height: t,
          name: "Parede meação",
        });
      }
    }

    // --- Property perimeter fence ---
    add("wall", {
      x: OX,
      y: OY,
      width: LOT_W,
      height: t,
      name: "Muro fundo",
    });
    add("wall", {
      x: OX,
      y: OY,
      width: t,
      height: LOT_H,
      name: "Muro lateral",
    });
    add("wall", {
      x: OX + LOT_W - t,
      y: OY,
      width: t,
      height: LOT_H,
      name: "Muro lateral",
    });
    /*
     * Front fence (south): one small person gate + one vehicle gate.
     * - Portão pedestre: narrow, on the left (home / building side)
     * - Portão veículos: single leaf centered on the vehicle corridor
     *   (aisle between building east face and parking bays)
     */
    const PED_W = m(0.9); // person gate ~90 cm
    const VEH_W = m(3.5); // single car portão
    // Vehicle corridor = strip between building east face and parking stalls
    const aisleLeft = PARK_X;
    const aisleRight = bayX;
    const aisleMid = (aisleLeft + aisleRight) / 2;
    // Small person portal on the left (home / building side of the front)
    const pedX = BX + m(0.4);
    // Vehicle portão centered on the drive aisle
    const vehX = aisleMid - VEH_W / 2;
    const frontY = OY + LOT_H - t;
    const lotRight = OX + LOT_W;

    // Muro left of ped gate (covers recuo + building front)
    add("wall", {
      x: OX,
      y: frontY,
      width: pedX - OX,
      height: t,
      name: "Muro frente",
    });
    // Small pedestrian portal (persons living on the lot)
    add("door", {
      x: pedX,
      y: frontY,
      width: PED_W,
      height: t,
      name: "Portão pedestre",
      hinge: "start",
      opens: "neg",
    });
    // Muro between ped and vehicle gates
    add("wall", {
      x: pedX + PED_W,
      y: frontY,
      width: vehX - (pedX + PED_W),
      height: t,
      name: "Muro frente",
    });
    // Single vehicle portão on the drive corridor
    add("door", {
      x: vehX,
      y: frontY,
      width: VEH_W,
      height: t,
      name: "Portão veículos",
      hinge: "end",
      opens: "neg",
    });
    // Muro right of vehicle gate to lot corner
    add("wall", {
      x: vehX + VEH_W,
      y: frontY,
      width: lotRight - (vehX + VEH_W),
      height: t,
      name: "Muro frente",
    });
    add("wall", {
      x: PARK_X,
      y: OY + MOTO_D - t,
      width: PARK_W,
      height: t,
      name: "Cobertura motos",
    });

    return {
      objects: objs,
      groups: groups,
      groupSeq: groups.length + 1,
    };
  }

  global.FPComponents = {
    CATALOG,
    SNAP_PARTNERS,
    GRID,
    PX_PER_METER,
    PX_PER_CM,
    DISPLAY_UNIT,
    m,
    cm,
    pxToUnit,
    unitToPx,
    formatLength,
    formatArea,
    createObject,
    createDemoLayout,
    getCatalogList,
    getMinSize,
    snapToGrid,
    seedIdCounter,
    normalizeRotation,
    clampOpacity,
    rotatePoint,
    objectCenter,
    worldAABB,
    doorGeometry,
    doorSweepPath,
    doorSymbolPath,
    doorSectorPath,
    doorArcPath,
    doorLeafPath,
    doorClosedLeafPath,
    doorJambPath,
    doorHingeRect,
    doorOpenLeafPath,
  };
})(window);
