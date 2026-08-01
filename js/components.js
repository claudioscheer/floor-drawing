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
  // Thin walls read cleaner in 2D plans (still ~10 cm, realistic for interior)
  const WALL_T = m(0.1);
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
      // Default horizontal wall: 2 m long × wall thickness
      defaults: { width: m(2), height: WALL_T, name: "" },
      minW: m(0.1),
      minH: m(0.08),
      z: 5,
    },
    window: {
      type: "window",
      label: "Window",
      description: "Snaps to walls",
      // 1.20 m wide opening, same depth as wall
      defaults: { width: WINDOW_W, height: WALL_T, name: "Window" },
      minW: m(0.4),
      minH: m(0.08),
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
      minH: m(0.08),
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
   * True quarter-circle polyline (no SVG arc sweep ambiguity).
   * hinge → closed radius → arc samples → open free end → hinge (open leaf).
   */
  function doorSymbolPath(obj) {
    const g = doorGeometry(obj);
    const h = toLocal(g, { x: g.hx, y: g.hy });
    const c = toLocal(g, g.closedEnd);
    const steps = 24;
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

  function doorArcPath(obj) {
    const g = doorGeometry(obj);
    const steps = 24;
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
   * Multifamily site from reference plan:
   * 16 m × 33 m lot, 4 stacked 1-bed units (Apto 2–5), side setback 1.50 m,
   * front free strip 3.00 m, drive + 8 car bays + moto parking 3.00 m deep.
   * Parking stalls axis-aligned (0°), side by side. 100 px = 1 m.
   */
  function createDemoLayout() {
    const t = WALL_T;
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

    // --- Lot frame (FRENTE = +Y, FUNDO = −Y / top) ---
    const OX = m(0.5);
    const OY = m(0.5);
    const LOT_W = m(16);
    const LOT_H = m(33);
    const SIDE = m(1.5);
    const FRONT = m(3);
    const MOTO_D = m(3);

    // Building on left after side setback; depth = lot − front strip
    const BLDG_W = m(7.2);
    const BLDG_H = LOT_H - FRONT; // 30 m
    const BX = OX + SIDE;
    const BY = OY;
    const APT_H = BLDG_H / 4; // 7.5 m each
    const LEFT_W = m(3.1); // banho + quarto column
    const RIGHT_W = BLDG_W - LEFT_W; // cozinha + estar
    const TOP_H = m(2.7); // banho / cozinha band
    const BOT_H = APT_H - TOP_H; // quarto / estar

    // Parking / drive occupies rest of lot width
    const PARK_X = BX + BLDG_W;
    const PARK_W = OX + LOT_W - PARK_X;

    // Terrain (overall dimensions labeled)
    add("terrain", {
      x: OX,
      y: OY,
      width: LOT_W,
      height: LOT_H,
      name: "Lot 16×33 m",
      showDimensions: true,
    });

    // Side setback strip (left garden)
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

    // Drive / vehicle circulation
    add("floor", {
      x: PARK_X,
      y: OY + MOTO_D,
      width: PARK_W,
      height: BLDG_H - MOTO_D,
      name: "Circulação de veículos",
    });

    // Motorcycle parking (3 m deep at fundo)
    add("floor", {
      x: PARK_X,
      y: OY,
      width: PARK_W,
      height: MOTO_D,
      name: "Motos 3,00 m",
      showDimensions: true,
    });

    // 8 car bays 2.80 × 5.00, axis-aligned, side by side along the drive
    const BAY_W = m(2.8); // stall width (along lot depth)
    const BAY_D = m(5); // stall depth (from east curb)
    const bayX = OX + LOT_W - BAY_D - m(0.15);
    const bayY0 = OY + MOTO_D;
    for (let i = 0; i < 8; i++) {
      add("floor", {
        x: bayX,
        y: bayY0 + i * BAY_W,
        width: BAY_D,
        height: BAY_W,
        rotation: 0,
        labelRotation: 0,
        name: "Vaga " + (i + 1) + " (2,80×5,00)",
        showDimensions: i === 0,
      });
    }

    // --- Four apartments: Apto 5 (fundo/top) → Apto 2 (frente/bottom) ---
    const aptNames = ["Apto 5", "Apto 4", "Apto 3", "Apto 2"];
    const roomDefs = [
      { key: "banho", name: "Banho", col: "L", row: "T" },
      { key: "quarto", name: "Quarto", col: "L", row: "B" },
      { key: "cozinha", name: "Cozinha", col: "R", row: "T" },
      { key: "estar", name: "Estar", col: "R", row: "B" },
    ];

    for (let a = 0; a < 4; a++) {
      const ay = BY + a * APT_H;
      const apt = aptNames[a];

      for (const rd of roomDefs) {
        const rx = rd.col === "L" ? BX : BX + LEFT_W;
        const ry = rd.row === "T" ? ay : ay + TOP_H;
        const rw = rd.col === "L" ? LEFT_W : RIGHT_W;
        const rh = rd.row === "T" ? TOP_H : BOT_H;
        add("floor", {
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          name: apt + " · " + rd.name,
        });
      }

      // Internal cross walls (shared edges)
      // Vertical split banho|cozinha / quarto|estar
      add("wall", {
        x: BX + LEFT_W - t / 2,
        y: ay,
        width: t,
        height: APT_H,
        name: "",
      });
      // Horizontal split top/bottom rooms
      add("wall", {
        x: BX,
        y: ay + TOP_H - t / 2,
        width: BLDG_W,
        height: t,
        name: "",
      });

      // Party wall under this apt (skip last — building south handles it)
      if (a < 3) {
        add("wall", {
          x: BX,
          y: ay + APT_H - t / 2,
          width: BLDG_W,
          height: t,
          name: "Party wall",
        });
      }

      // Doors: banho ← quarto, cozinha ← estar, entry from drive into estar
      // Bathroom door on horizontal wall (left half)
      add("door", {
        x: BX + m(1.0),
        y: ay + TOP_H - t / 2,
        width: m(0.7),
        height: t,
        name: apt + " banho",
        hinge: "start",
        opens: "pos",
      });
      // Kitchen opening on horizontal wall (right half)
      add("door", {
        x: BX + LEFT_W + m(1.2),
        y: ay + TOP_H - t / 2,
        width: m(0.8),
        height: t,
        name: apt + " cozinha",
        hinge: "end",
        opens: "pos",
      });
      // Entry on east wall into estar
      add("door", {
        x: BX + BLDG_W - t,
        y: ay + TOP_H + m(1.5),
        width: t,
        height: DOOR_W,
        name: apt + " entrada",
        hinge: "start",
        opens: "neg",
      });

      // Windows: west façade (setback) on quarto + banho; north/south as needed
      add("window", {
        x: BX,
        y: ay + TOP_H + m(1.2),
        width: t,
        height: m(1.2),
        name: apt + " quarto",
      });
      add("window", {
        x: BX,
        y: ay + m(0.7),
        width: t,
        height: m(0.9),
        name: apt + " banho",
      });
      // Living window toward drive (east) above entry
      add("window", {
        x: BX + BLDG_W - t,
        y: ay + TOP_H + m(3.2),
        width: t,
        height: m(1.2),
        name: apt + " estar",
      });
    }

    // --- Building envelope ---
    // North (fundo)
    add("wall", {
      x: BX,
      y: BY,
      width: BLDG_W,
      height: t,
      name: "North wall",
    });
    // South (toward frente)
    add("wall", {
      x: BX,
      y: BY + BLDG_H - t,
      width: BLDG_W,
      height: t,
      name: "South wall",
    });
    // West
    add("wall", {
      x: BX,
      y: BY,
      width: t,
      height: BLDG_H,
      name: "West wall",
    });
    // East (entries cut by doors above)
    add("wall", {
      x: BX + BLDG_W - t,
      y: BY,
      width: t,
      height: BLDG_H,
      name: "East wall",
    });

    // --- Property perimeter (masonry fence) ---
    // North fence
    add("wall", {
      x: OX,
      y: OY,
      width: LOT_W,
      height: t,
      name: "Muro fundo",
    });
    // West fence
    add("wall", {
      x: OX,
      y: OY,
      width: t,
      height: LOT_H,
      name: "Muro lateral",
    });
    // East fence
    add("wall", {
      x: OX + LOT_W - t,
      y: OY,
      width: t,
      height: LOT_H,
      name: "Muro lateral",
    });
    // South fence left of gate (under building side)
    const GATE_W = m(5.5);
    const GATE_X = PARK_X + m(0.4);
    add("wall", {
      x: OX,
      y: OY + LOT_H - t,
      width: GATE_X - OX,
      height: t,
      name: "Muro frente",
    });
    // South fence right of gate
    add("wall", {
      x: GATE_X + GATE_W,
      y: OY + LOT_H - t,
      width: OX + LOT_W - (GATE_X + GATE_W),
      height: t,
      name: "Muro frente",
    });
    // Gate leaves (as doors on the front line)
    add("door", {
      x: GATE_X,
      y: OY + LOT_H - t,
      width: m(2.5),
      height: t,
      name: "Portão pedestre",
      hinge: "start",
      opens: "neg",
    });
    add("door", {
      x: GATE_X + m(2.7),
      y: OY + LOT_H - t,
      width: m(2.8),
      height: t,
      name: "Portão veículos",
      hinge: "end",
      opens: "neg",
    });

    // Moto shelter edge
    add("wall", {
      x: PARK_X,
      y: OY + MOTO_D - t,
      width: PARK_W,
      height: t,
      name: "Cobertura motos",
    });

    return objs;
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
    doorArcPath,
    doorLeafPath,
    doorClosedLeafPath,
    doorJambPath,
    doorHingeRect,
    doorOpenLeafPath,
  };
})(window);
