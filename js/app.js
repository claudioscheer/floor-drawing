/**
 * Alpine.js root application for the floor plan editor.
 */
function floorPlanApp() {
  return {
    objects: [],
    /** Primary selection (inspector). Multi-select lives in selectedIds. */
    selectedId: null,
    selectedIds: [],
    /** Named groups: { id, name, collapsed } */
    groups: [],
    groupSeq: 1,

    zoom: 0.22,
    panX: 48,
    panY: 16,
    minZoom: 0.15,
    maxZoom: 3,

    planName: "Multifamily 4 units + parking",
    /** select | pan | terrain | floor | wall | window | door */
    activeTool: "select",

    /** Master switch: when false, hide all size labels regardless of per-object setting */
    showDimensionsGlobal: false,

    /**
     * Label offsets keyed by object id — kept off the object record so drag
     * updates are not clobbered by Alpine re-renders of the objects array.
     * Shape: { [id]: { w: {x,y}, h: {x,y} } }
     */
    labelOffsets: {},

    /** Undo / redo stacks of JSON snapshots */
    historyPast: [],
    historyFuture: [],
    historyLimit: 60,
    _historyPaused: false,

    /** Layers panel drag-reorder state */
    layerDrag: {
      active: false,
      id: null,
      kind: null, // 'object' | 'group'
    },

    palette: FPComponents.getCatalogList(),

    snapGuides: { v: null, h: null, active: false },

    // Viewport pan (space + drag or middle mouse)
    panState: {
      active: false,
      spaceDown: false,
      startX: 0,
      startY: 0,
      originPanX: 0,
      originPanY: 0,
    },

    // Drag from palette
    paletteDrag: {
      active: false,
      type: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      pointerId: null,
    },

    /**
     * Native canvas object drag (not interact.js).
     * Interact starts on the topmost hit target (often a wall pad) and cancels
     * when the pointer leaves it — furniture never moves. We own drag here.
     */
    objectDrag: {
      active: false,
      id: null,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      peers: [],
    },

    get selected() {
      if (!this.selectedId) return null;
      return this.objects.find((o) => o.id === this.selectedId) || null;
    },

    init() {
      // Seed demo layout once (bump key when real-world scale / demo changes)
      if (!window.__fpBooted_v39) {
        window.__fpBooted_v39 = true;
        // Front: ped portal left of building; one car portão on aisle
        const demo = FPComponents.createDemoLayout();
        this.objects = demo.objects || demo;
        this.groups = demo.groups || [];
        this.groupSeq = demo.groupSeq || this.groups.length + 1;
        FPComponents.seedIdCounter(this.objects);
        this.selectedIds = [];
      }

      // Stable handle for interact.js (and tests)
      window.__fpApp = this;

      // Wire interact.js once Alpine + DOM are ready
      this.$nextTick(() => {
        FPInteract.setup(() => window.__fpApp);
      });

      // Space for pan mode
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && !this.isTypingTarget(e.target)) {
          this.panState.spaceDown = true;
          this.$refs.viewport?.classList.add("is-panning");
          e.preventDefault();
        }
      });
      window.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
          this.panState.spaceDown = false;
          if (!this.panState.active) {
            this.$refs.viewport?.classList.remove("is-panning");
          }
        }
      });
    },

    isTypingTarget(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    },

    worldStyle() {
      return {
        transform: `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`,
      };
    },

    /** Soft dot grid locked to world axes (Maket-style). */
    viewportGridStyle() {
      const z = this.zoom || 1;
      // ~10 cm dots at scale; keep readable when zoomed out
      const step = Math.max(8, 10 * z);
      return {
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${this.panX}px ${this.panY}px`,
      };
    },

    objectStyle(obj) {
      const rot = FPComponents.normalizeRotation(obj.rotation);
      const idx = this.objects.findIndex((o) => o.id === obj.id);
      // Paint order: later array index = higher z (reorderable in Layers)
      const zBase = FPComponents.CATALOG[obj.type]?.z ?? 1;
      const opacity = FPComponents.clampOpacity(
        obj.opacity === undefined ? 1 : obj.opacity
      );
      const selected = this.isSelected(obj.id);
      // Selected objects float above siblings so outline is never buried
      const z = selected
        ? 500000 + Math.max(0, idx)
        : zBase * 1000 + Math.max(0, idx);
      // Canvas world is CSS-scaled by zoom — thicken chrome so it stays readable
      const invZ = 1 / Math.max(0.15, this.zoom || 1);
      // Screen-space hit padding for thin walls/windows/doors (~14px on screen)
      const hitPad =
        obj.type === "window" || obj.type === "door" || obj.type === "wall"
          ? Math.max(10, Math.round(14 * invZ))
          : 0;
      const style = {
        left: obj.x + "px",
        top: obj.y + "px",
        width: obj.width + "px",
        height: obj.height + "px",
        transformOrigin: "center center",
        // CSS var so inner labels can counter-rotate and stay upright
        "--obj-rot": rot + "deg",
        "--hit-pad": hitPad ? hitPad + "px" : "0px",
        zIndex: String(z),
        display: obj.visible === false ? "none" : null,
        opacity: String(opacity),
      };
      if (rot) {
        style.transform = "rotate(" + rot + "deg)";
      } else {
        style.transform = "none";
      }
      if (selected) {
        // Maket-style: solid blue outline (zoom-compensated)
        const o = Math.max(2, Math.round(2.25 * invZ));
        style.outline = o + "px solid #2f6fed";
        style.outlineOffset = "0px";
        // Light blue selection fill for floors / terrain / large areas
        if (obj.type === "floor" || obj.type === "terrain") {
          style.backgroundColor = "rgba(59, 130, 246, 0.18)";
        } else if (obj.type === "window" || obj.type === "door") {
          style.backgroundColor = "rgba(147, 197, 253, 0.55)";
        }
      }
      return style;
    },

    /** Opacity as 0–100 for the inspector. */
    opacityPercent(obj) {
      if (!obj) return 100;
      return Math.round(FPComponents.clampOpacity(obj.opacity === undefined ? 1 : obj.opacity) * 100);
    },

    /**
     * Set opacity from 0–100%. Pass withHistory=false while dragging the slider
     * (call pushHistory once on pointerdown instead).
     */
    setOpacityPercent(value, withHistory) {
      const ids =
        this.selectedIds && this.selectedIds.length
          ? this.selectedIds.slice()
          : this.selectedId
            ? [this.selectedId]
            : [];
      if (!ids.length) return;
      const n = Number(value);
      const pct = Number.isFinite(n) ? n : 100;
      const opacity = FPComponents.clampOpacity(pct / 100);
      if (withHistory !== false) this.pushHistory();
      for (const id of ids) {
        this.patchObject(id, { opacity });
      }
    },

    objectClass(obj) {
      const classes = ["fp-object--" + obj.type];
      if (this.isSelected(obj.id)) classes.push("is-selected");
      if (this.snapGuides.active && this.selectedId === obj.id) classes.push("is-snapping");
      if (this.dimsVisible(obj)) classes.push("has-dims");
      if (obj.locked) classes.push("is-locked");
      if (obj.visible === false) classes.push("is-hidden");
      // Orientation: glass banding (window) + hit-pad axis (window/door/wall)
      if (obj.type === "window" || obj.type === "door" || obj.type === "wall") {
        classes.push(obj.width >= obj.height ? "is-horizontal" : "is-vertical");
      }
      return classes.join(" ");
    },

    /** Degrees 0–359 for the selected object. */
    normalizeRotation(value) {
      return FPComponents.normalizeRotation(value);
    },

    /** Nudge selected rotation (degrees). One history step per call. */
    nudgeRotation(delta) {
      if (!this.selected) return;
      const cur = FPComponents.normalizeRotation(this.selected.rotation);
      const d = Number(delta);
      this.updateSelected({
        rotation: FPComponents.normalizeRotation(cur + (Number.isFinite(d) ? d : 0)),
      });
    },

    setRotation(value) {
      if (!this.selected) return;
      this.updateSelected({ rotation: FPComponents.normalizeRotation(value) });
    },

    setLabelRotation(value) {
      if (!this.selected) return;
      this.updateSelected({
        labelRotation: FPComponents.normalizeRotation(value),
      });
    },

    nudgeLabelRotation(delta) {
      if (!this.selected) return;
      const cur = FPComponents.normalizeRotation(this.selected.labelRotation);
      const d = Number(delta);
      this.updateSelected({
        labelRotation: FPComponents.normalizeRotation(
          cur + (Number.isFinite(d) ? d : 0)
        ),
      });
    },

    /** Align center label with the floor's own rotation (e.g. 45° parking text). */
    matchLabelToObject() {
      if (!this.selected) return;
      this.setLabelRotation(this.selected.rotation || 0);
    },

    /**
     * Floor/terrain center label. labelRotation is world degrees (0 = upright);
     * converted to local space inside the CSS-rotated object.
     */
    labelStyle(obj) {
      const objRot = FPComponents.normalizeRotation(obj.rotation);
      const labelRot = FPComponents.normalizeRotation(obj.labelRotation);
      const local = FPComponents.normalizeRotation(labelRot - objRot);
      return {
        transform: "translate(-50%, -50%) rotate(" + local + "deg)",
      };
    },

    dimsGroupClass(obj) {
      const parts = [];
      if (this.dimsVisible(obj)) parts.push("is-on");
      else parts.push("is-off");
      if (this.isSelected(obj.id)) parts.push("is-selected-dims");
      return parts.join(" ");
    },

    /**
     * Size labels: always on for the selected object (Maket-style);
     * otherwise require global toggle + per-object flag.
     */
    dimsVisible(obj) {
      if (!obj) return false;
      if (obj.visible === false) return false;
      if (this.isSelected(obj.id)) return true;
      if (!this.showDimensionsGlobal) return false;
      return obj.showDimensions !== false;
    },

    /** UI title for an object; walls are never named in the UI. */
    objectDisplayName(obj) {
      if (!obj) return "";
      if (obj.type === "wall") return "Wall";
      return (obj.name && String(obj.name).trim()) || obj.type;
    },

    doorObjects() {
      return this.objects.filter((o) => o.type === "door" && o.visible !== false);
    },

    doorIsHorizontal(obj) {
      return obj && obj.width >= obj.height;
    },

    doorHingeStartLabel(obj) {
      return this.doorIsHorizontal(obj) ? "Left" : "Top";
    },

    doorHingeEndLabel(obj) {
      return this.doorIsHorizontal(obj) ? "Right" : "Bottom";
    },

    doorOpensNegLabel(obj) {
      return this.doorIsHorizontal(obj) ? "Up" : "Left";
    },

    doorOpensPosLabel(obj) {
      return this.doorIsHorizontal(obj) ? "Down" : "Right";
    },

    /** World-positioned SVG; paths are local 0..box inside it. */
    doorSwingStyle(obj) {
      const g = FPComponents.doorGeometry(obj);
      const opacity = FPComponents.clampOpacity(
        obj.opacity === undefined ? 1 : obj.opacity
      );
      return {
        left: g.minX + "px",
        top: g.minY + "px",
        width: g.boxW + "px",
        height: g.boxH + "px",
        opacity: String(opacity),
      };
    },

    doorSwingViewBox(obj) {
      const g = FPComponents.doorGeometry(obj);
      return "0 0 " + g.boxW + " " + g.boxH;
    },

    doorSymbolPath(obj) {
      return FPComponents.doorSymbolPath(obj);
    },

    doorSectorPath(obj) {
      return FPComponents.doorSectorPath(obj);
    },

    doorArcPath(obj) {
      return FPComponents.doorArcPath(obj);
    },

    doorLeafPath(obj) {
      return FPComponents.doorLeafPath(obj);
    },

    doorClosedLeafPath(obj) {
      return FPComponents.doorClosedLeafPath(obj);
    },

    doorHingeRect(obj) {
      return FPComponents.doorHingeRect(obj);
    },

    /** Size label text (meters, two decimals, e.g. "3.60 m"). */
    formatSize(n) {
      return FPComponents.formatLength(n, "m");
    },

    /** Floor area in m² from width × height (world px). */
    formatObjectArea(obj) {
      if (!obj) return "";
      const w = Number(obj.width) || 0;
      const h = Number(obj.height) || 0;
      return FPComponents.formatArea(w * h);
    },

    /** Numeric meters for property fields (two decimals). */
    formatMeters(n) {
      return FPComponents.pxToUnit(n, "m").toFixed(2);
    },

    /** Parse meters input → world pixels. */
    metersToPx(value) {
      return FPComponents.unitToPx(Number(value) || 0, "m");
    },

    ensureLabelOffset(id) {
      if (!this.labelOffsets[id]) {
        this.labelOffsets[id] = {
          w: { x: 0, y: 0 },
          h: { x: 0, y: 0 },
          n: { x: 0, y: 0 },
        };
      } else if (!this.labelOffsets[id].n) {
        this.labelOffsets[id] = {
          ...this.labelOffsets[id],
          n: { x: 0, y: 0 },
        };
      }
      return this.labelOffsets[id];
    },

    getLabelOffset(id, axis) {
      const entry = this.ensureLabelOffset(id);
      if (axis === "w") return entry.w;
      if (axis === "h") return entry.h;
      return entry.n;
    },

    setLabelOffset(id, axis, x, y) {
      const entry = this.ensureLabelOffset(id);
      // Replace whole entry so Alpine always sees a change
      this.labelOffsets[id] = {
        w: axis === "w" ? { x: x, y: y } : { x: entry.w.x, y: entry.w.y },
        h: axis === "h" ? { x: x, y: y } : { x: entry.h.x, y: entry.h.y },
        n: axis === "n" ? { x: x, y: y } : { x: entry.n.x, y: entry.n.y },
      };
    },

    /** Door / window name as a canvas badge (same style family as sizes). */
    showsNameBadge(obj) {
      return obj && (obj.type === "door" || obj.type === "window");
    },

    nameBadgeText(obj) {
      if (!obj) return "";
      const name = obj.name && String(obj.name).trim();
      if (name) return name;
      return obj.type === "door" ? "Door" : "Window";
    },

    /** Default anchor on the object edge (world AABB; rotation-aware). */
    dimAnchor(obj, axis) {
      const box = FPComponents.worldAABB(obj);
      if (axis === "n") {
        return { x: box.x + box.width / 2, y: box.y };
      }
      if (axis === "w") {
        return { x: box.x + box.width / 2, y: box.y + box.height };
      }
      return { x: box.x + box.width, y: box.y + box.height / 2 };
    },

    /** Default resting point for the badge (outside edges — Maket-style). */
    dimDefaultPos(obj, axis) {
      const box = FPComponents.worldAABB(obj);
      const invZ = 1 / Math.max(0.2, this.zoom || 1);
      const gap = Math.max(14, Math.round(16 * invZ * 0.35));
      if (axis === "n") {
        return { x: box.x + box.width / 2, y: box.y - gap };
      }
      if (axis === "w") {
        return { x: box.x + box.width / 2, y: box.y + box.height + gap };
      }
      return { x: box.x + box.width + gap, y: box.y + box.height / 2 };
    },

    /** Badge center in world coordinates. */
    dimBadgePos(obj, axis) {
      const base = this.dimDefaultPos(obj, axis);
      const off = this.getLabelOffset(obj.id, axis);
      return { x: base.x + (off.x || 0), y: base.y + (off.y || 0) };
    },

    dimBadgeStyle(obj, axis) {
      const p = this.dimBadgePos(obj, axis);
      return {
        left: p.x + "px",
        top: p.y + "px",
      };
    },

    dimAnchorStyle(obj, axis) {
      const a = this.dimAnchor(obj, axis);
      return {
        left: a.x + "px",
        top: a.y + "px",
      };
    },

    /**
     * Dimension bar + ticks (Maket-style): full edge length outside the object,
     * with short extension ticks at both ends.
     */
    dimBarStyle(obj, axis) {
      const box = FPComponents.worldAABB(obj);
      const invZ = 1 / Math.max(0.2, this.zoom || 1);
      const gap = Math.max(14, Math.round(16 * invZ * 0.35));
      const stroke = Math.max(1.25, 1.5 * invZ * 0.45);
      if (axis === "w") {
        return {
          left: box.x + "px",
          top: box.y + box.height + gap + "px",
          width: box.width + "px",
          height: stroke + "px",
        };
      }
      if (axis === "h") {
        return {
          left: box.x + box.width + gap + "px",
          top: box.y + "px",
          width: stroke + "px",
          height: box.height + "px",
        };
      }
      return { display: "none" };
    },

    dimTickStyle(obj, axis, which) {
      const box = FPComponents.worldAABB(obj);
      const invZ = 1 / Math.max(0.2, this.zoom || 1);
      const gap = Math.max(14, Math.round(16 * invZ * 0.35));
      const tick = Math.max(6, Math.round(8 * invZ * 0.4));
      const stroke = Math.max(1.25, 1.5 * invZ * 0.45);
      if (axis === "w") {
        const x = which === "start" ? box.x : box.x + box.width;
        return {
          left: x - stroke / 2 + "px",
          top: box.y + box.height + gap - tick / 2 + "px",
          width: stroke + "px",
          height: tick + "px",
        };
      }
      if (axis === "h") {
        const y = which === "start" ? box.y : box.y + box.height;
        return {
          left: box.x + box.width + gap - tick / 2 + "px",
          top: y - stroke / 2 + "px",
          width: tick + "px",
          height: stroke + "px",
        };
      }
      return { display: "none" };
    },

    /** Thin line from object edge anchor to badge (legacy link for name badges). */
    dimLeaderStyle(obj, axis) {
      const a = this.dimAnchor(obj, axis);
      const b = this.dimBadgePos(obj, axis);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      return {
        left: a.x + "px",
        top: a.y + "px",
        width: len + "px",
        transform: "rotate(" + angle + "deg)",
      };
    },

    resetDimOffsets(id) {
      if (!id) return;
      this.pushHistory();
      this.labelOffsets[id] = {
        w: { x: 0, y: 0 },
        h: { x: 0, y: 0 },
        n: { x: 0, y: 0 },
      };
    },

    setAllDimensions(on) {
      this.pushHistory();
      this.showDimensionsGlobal = true;
      for (const o of this.objects) {
        o.showDimensions = !!on;
      }
    },

    toggleGlobalDimensions() {
      this.pushHistory();
      this.showDimensionsGlobal = !this.showDimensionsGlobal;
    },

    planMeta() {
      const floors = this.objects.filter((o) => o.type === "floor");
      if (!floors.length) {
        return this.objects.length + " objects · no floors yet";
      }
      const areaPx = floors.reduce((sum, f) => sum + f.width * f.height, 0);
      return this.objects.length + " objects · " + FPComponents.formatArea(areaPx);
    },

    floorAreaLabel() {
      const floors = this.objects.filter((o) => o.type === "floor");
      if (!floors.length) return "—";
      const areaPx = floors.reduce((sum, f) => sum + f.width * f.height, 0);
      return FPComponents.formatArea(areaPx);
    },

    setTool(tool) {
      this.activeTool = tool || "select";
      const vp = this.$refs.viewport;
      if (!vp) return;
      // Keep classList in sync even when Alpine has not flushed yet
      vp.classList.toggle("tool-pan", this.activeTool === "pan");
      vp.classList.toggle("tool-place", this.isPlaceTool);
      if (this.activeTool === "pan" || this.panState.spaceDown) {
        vp.classList.add("is-panning");
      } else if (!this.panState.active) {
        vp.classList.remove("is-panning", "is-dragging");
      }
    },

    get isPlaceTool() {
      const t = this.activeTool;
      return t && t !== "select" && t !== "pan";
    },

    get isPanTool() {
      return this.activeTool === "pan" || this.panState.spaceDown;
    },

    exportPlan() {
      const payload = {
        name: this.planName,
        exportedAt: new Date().toISOString(),
        groups: this.groups,
        objects: this.objects.map((o) => {
          const off = this.labelOffsets[o.id] || {
            w: { x: 0, y: 0 },
            h: { x: 0, y: 0 },
            n: { x: 0, y: 0 },
          };
          return {
            ...o,
            dimOffW: { ...off.w },
            dimOffH: { ...off.h },
            dimOffN: { ...(off.n || { x: 0, y: 0 }) },
          };
        }),
        labelOffsets: JSON.parse(JSON.stringify(this.labelOffsets)),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (this.planName || "floor-plan").replace(/\s+/g, "-").toLowerCase() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    paletteGhostStyle() {
      const def = FPComponents.CATALOG[this.paletteDrag.type];
      const w = def ? def.defaults.width : 80;
      const h = def ? def.defaults.height : 40;
      return {
        left: this.paletteDrag.x - w / 2 + "px",
        top: this.paletteDrag.y - h / 2 + "px",
        width: w + "px",
        height: h + "px",
      };
    },

    /**
     * Smallest object under the cursor. Walls sit above floors in z-order and
     * use expanded hit pads, so without this furniture (Armário, etc.) is unselectable.
     */
    pickObjectAtClient(clientX, clientY) {
      if (typeof document.elementsFromPoint !== "function") return null;
      const stack = document.elementsFromPoint(clientX, clientY);
      const seen = new Set();
      const candidates = [];
      for (let i = 0; i < stack.length; i++) {
        const node = stack[i];
        const el =
          node.classList && node.classList.contains("fp-object")
            ? node
            : node.closest
              ? node.closest(".fp-object")
              : null;
        if (!el) continue;
        const oid = el.getAttribute("data-id");
        if (!oid || seen.has(oid)) continue;
        seen.add(oid);
        const obj = this.objects.find((o) => o.id === oid);
        if (!obj || obj.visible === false) continue;
        const area = Math.max(1, Math.abs(Number(obj.width) * Number(obj.height)));
        const wallBias = obj.type === "wall" ? 1.25 : 1;
        candidates.push({ id: oid, score: area * wallBias });
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => a.score - b.score);
      return candidates[0].id;
    },

    onObjectPointerDown(event, id) {
      // Hand tool: ignore objects (pointer-events also none in CSS)
      if (this.activeTool === "pan" || this.panState.spaceDown) return;
      // Let resize handles / dim badges own their gestures
      if (event.target.closest && event.target.closest(".handle")) return;
      if (event.target.closest && event.target.closest(".dim-badge")) return;
      // Prefer furniture under walls / room slabs at this point
      const picked = this.pickObjectAtClient(event.clientX, event.clientY);
      if (picked) id = picked;

      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;

      if (event.stopPropagation) event.stopPropagation();
      this._suppressClearUntil = Date.now() + 450;

      // focus:false — don't pan mid-click
      this.selectObject(id, { event, focus: false });
      if (typeof this.$nextTick === "function") {
        this.$nextTick(() => this.scrollLayerIntoView(id));
      } else {
        this.scrollLayerIntoView(id);
      }

      // Locked objects select but do not move
      if (obj.locked) return;
      if (event.button != null && event.button !== 0) return;

      this.startObjectDrag(event, id);
    },

    startObjectDrag(event, id) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;

      if (this.objectDrag && this.objectDrag.active) this.endObjectDrag();

      this.pushHistory();

      const peerIds = this.movePeerIds(id);
      const peers = peerIds
        .map((pid) => {
          const o = this.objects.find((x) => x.id === pid);
          if (!o || o.locked) return null;
          return { id: pid, startX: o.x, startY: o.y };
        })
        .filter(Boolean);
      if (!peers.length) return;

      this.objectDrag = {
        active: true,
        id,
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        x: obj.x,
        y: obj.y,
        startX: obj.x,
        startY: obj.y,
        peers,
      };

      const el = document.querySelector('.fp-object[data-id="' + id + '"]');
      if (el) {
        el.classList.add("is-dragging");
        el.setAttribute("data-dragging", "1");
        try {
          if (event.pointerId != null && el.setPointerCapture) {
            el.setPointerCapture(event.pointerId);
          }
        } catch (_) {
          /* ignore */
        }
      }

      // Capture app via window so listeners stay valid across Alpine ticks
      const onMove = (ev) => {
        const app = window.__fpApp || this;
        if (app && typeof app.onObjectDragMove === "function") app.onObjectDragMove(ev);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        const app = window.__fpApp || this;
        if (app && typeof app.endObjectDrag === "function") app.endObjectDrag();
      };
      this._objectDragMove = onMove;
      this._objectDragUp = onUp;
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },

    onObjectDragMove(event) {
      const drag = this.objectDrag;
      if (!drag || !drag.active) return;
      // Don't hard-require matching pointerId — some browsers vary it mid-gesture

      const zoom = this.zoom || 1;
      const dxScreen = event.clientX - drag.lastX;
      const dyScreen = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;

      drag.x += dxScreen / zoom;
      drag.y += dyScreen / zoom;

      const primary = this.objects.find((o) => o.id === drag.id);
      if (!primary) return;

      const exclude = new Set(drag.peers.map((p) => p.id));
      const others = this.objects.filter((o) => !exclude.has(o.id));
      const snapped =
        typeof FPSnap !== "undefined" && FPSnap.snapPosition
          ? FPSnap.snapPosition(
              {
                x: drag.x,
                y: drag.y,
                width: primary.width,
                height: primary.height,
                rotation: primary.rotation || 0,
              },
              others,
              primary.type,
              { useGrid: true }
            )
          : { x: drag.x, y: drag.y, guides: { v: null, h: null }, active: false };

      const dx = snapped.x - drag.startX;
      const dy = snapped.y - drag.startY;

      for (const p of drag.peers) {
        const o = this.objects.find((x) => x.id === p.id);
        if (!o) continue;
        o.x = p.startX + dx;
        o.y = p.startY + dy;
        const pel = document.querySelector('.fp-object[data-id="' + p.id + '"]');
        if (pel) {
          pel.style.left = o.x + "px";
          pel.style.top = o.y + "px";
        }
      }

      this.snapGuides = {
        v: snapped.active ? snapped.guides.v : null,
        h: snapped.active ? snapped.guides.h : null,
        active: !!snapped.active,
      };
    },

    endObjectDrag() {
      const drag = this.objectDrag;
      if (!drag || !drag.active) {
        this.objectDrag = {
          active: false,
          id: null,
          pointerId: null,
          lastX: 0,
          lastY: 0,
          x: 0,
          y: 0,
          startX: 0,
          startY: 0,
          peers: [],
        };
        return;
      }

      for (const p of drag.peers) {
        const o = this.objects.find((x) => x.id === p.id);
        const pel = document.querySelector('.fp-object[data-id="' + p.id + '"]');
        if (pel) {
          pel.classList.remove("is-dragging");
          pel.removeAttribute("data-dragging");
          try {
            if (drag.pointerId != null && pel.releasePointerCapture) {
              pel.releasePointerCapture(drag.pointerId);
            }
          } catch (_) {
            /* ignore */
          }
        }
        if (o) {
          this.patchObject(o.id, { x: o.x, y: o.y });
        }
      }

      this.snapGuides = { v: null, h: null, active: false };
      this.objectDrag = {
        active: false,
        id: null,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        peers: [],
      };
      this._suppressClearUntil = Date.now() + 200;
    },

    /**
     * Nudge selection by world pixels (1 px = 1 cm). Arrow keys use this.
     * withHistory=false for key-repeat steps after the first press.
     */
    nudgeSelected(dx, dy, withHistory) {
      const ids =
        this.selectedIds && this.selectedIds.length
          ? this.selectedIds.slice()
          : this.selectedId
            ? [this.selectedId]
            : [];
      if (!ids.length) return;

      const movable = ids
        .map((id) => this.objects.find((o) => o.id === id))
        .filter((o) => o && !o.locked && o.visible !== false);
      if (!movable.length) return;

      if (withHistory !== false) this.pushHistory();

      for (const o of movable) {
        o.x = Number(o.x) + dx;
        o.y = Number(o.y) + dy;
        const el = document.querySelector('.fp-object[data-id="' + o.id + '"]');
        if (el) {
          el.style.left = o.x + "px";
          el.style.top = o.y + "px";
        }
      }
    },

    /**
     * Drag a size label. Labels sit in a separate world layer (not inside .fp-object)
     * so interact.js cannot capture the gesture. Offsets live in labelOffsets[id].
     */
    onDimPointerDown(event, objId, axis) {
      // One gesture only
      if (this._dimDrag && this._dimDrag.active) return;
      if (event.button != null && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const obj = this.objects.find((o) => o.id === objId);
      if (!obj) return;

      this.pushHistory();

      // Bring this object's labels to the top before dragging
      this.selectObject(obj.id);
      this.setTool("select");

      const off = this.getLabelOffset(objId, axis);
      const badge = event.currentTarget;
      if (badge && badge.classList) badge.classList.add("is-dragging-dim");

      // Capture pointer on the badge so moves keep flowing to us
      try {
        if (badge && event.pointerId != null && badge.setPointerCapture) {
          badge.setPointerCapture(event.pointerId);
        }
      } catch (_) {
        /* ignore */
      }

      const drag = {
        active: true,
        id: objId,
        axis: axis,
        x: Number(off.x) || 0,
        y: Number(off.y) || 0,
        lastX: event.clientX,
        lastY: event.clientY,
        badge: badge,
        pointerId: event.pointerId,
      };
      this._dimDrag = drag;

      const self = this;

      const onMove = (ev) => {
        if (!self._dimDrag || !self._dimDrag.active) return;
        if (drag.pointerId != null && ev.pointerId != null && ev.pointerId !== drag.pointerId) {
          return;
        }

        const zoom = self.zoom || 1;
        const dx = (ev.clientX - drag.lastX) / zoom;
        const dy = (ev.clientY - drag.lastY) / zoom;
        if (dx === 0 && dy === 0) return;

        drag.x += dx;
        drag.y += dy;
        drag.lastX = ev.clientX;
        drag.lastY = ev.clientY;

        self.setLabelOffset(drag.id, drag.axis, drag.x, drag.y);
      };

      const onUp = (ev) => {
        if (drag.pointerId != null && ev && ev.pointerId != null && ev.pointerId !== drag.pointerId) {
          return;
        }
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);

        try {
          if (drag.badge && drag.pointerId != null && drag.badge.releasePointerCapture) {
            drag.badge.releasePointerCapture(drag.pointerId);
          }
        } catch (_) {
          /* ignore */
        }

        if (drag.badge && drag.badge.classList) {
          drag.badge.classList.remove("is-dragging-dim");
        }
        drag.active = false;
        if (self._dimDrag === drag) self._dimDrag = null;
      };

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },

    isSelected(id) {
      return this.selectedIds.includes(id) || this.selectedId === id;
    },

    isGroupSelected(groupId) {
      if (!groupId) return false;
      const members = this.objects.filter((o) => o.groupId === groupId);
      if (!members.length) return false;
      return members.every((m) => this.selectedIds.includes(m.id));
    },

    /**
     * @param {string} id
     * @param {{ additive?: boolean, toggle?: boolean, event?: MouseEvent, focus?: boolean }} [opts]
     */
    selectObject(id, opts = {}) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;

      let additive = !!opts.additive;
      let toggle = !!opts.toggle;
      if (opts.event) {
        const e = opts.event;
        if (e.metaKey || e.ctrlKey) toggle = true;
        else if (e.shiftKey) additive = true;
      }

      if (toggle) {
        if (this.selectedIds.includes(id)) {
          this.selectedIds = this.selectedIds.filter((x) => x !== id);
          this.selectedId =
            this.selectedIds.length > 0
              ? this.selectedIds[this.selectedIds.length - 1]
              : null;
        } else {
          this.selectedIds = [...this.selectedIds, id];
          this.selectedId = id;
        }
      } else if (additive) {
        if (!this.selectedIds.includes(id)) {
          this.selectedIds = [...this.selectedIds, id];
        }
        this.selectedId = id;
      } else {
        this.selectedIds = [id];
        this.selectedId = id;
      }

      // Always refresh focus chrome after selection changes
      if (opts.focus !== false && this.selectedId) {
        this.focusSelection(this.selectedId);
      }
    },

    clearSelection() {
      this.selectedId = null;
      this.selectedIds = [];
    },

    /**
     * Scroll layers row into view and pan canvas so selection is visible.
     * Safe to call after DOM updates via $nextTick.
     */
    focusSelection(id) {
      const targetId = id || this.selectedId;
      if (!targetId) return;
      const run = () => {
        this.scrollLayerIntoView(targetId);
        this.ensureObjectInView(targetId);
      };
      if (typeof this.$nextTick === "function") {
        this.$nextTick(run);
      } else {
        run();
      }
    },

    scrollLayerIntoView(id) {
      try {
        const safe =
          typeof CSS !== "undefined" && CSS.escape
            ? CSS.escape(id)
            : String(id).replace(/"/g, '\\"');
        const row = document.querySelector(
          '.layer-row[data-layer-id="' + safe + '"]'
        );
        const list = document.querySelector(".layers-list");
        if (!row || !list) return;
        // Scroll only the layers list — never the window (that hid Tools)
        const rowTop = row.offsetTop;
        const rowBottom = rowTop + row.offsetHeight;
        const viewTop = list.scrollTop;
        const viewBottom = viewTop + list.clientHeight;
        if (rowTop < viewTop) {
          list.scrollTop = rowTop - 4;
        } else if (rowBottom > viewBottom) {
          list.scrollTop = rowBottom - list.clientHeight + 4;
        }
      } catch (_) {
        /* ignore */
      }
    },

    /** Pan the viewport so the object’s center is roughly on-screen. */
    ensureObjectInView(id) {
      const obj = this.objects.find((o) => o.id === id);
      const viewport = this.$refs && this.$refs.viewport;
      if (!obj || !viewport) return;

      const vr = viewport.getBoundingClientRect();
      const z = this.zoom || 1;
      // Object center in screen coords
      const cx = this.panX + (obj.x + obj.width / 2) * z;
      const cy = this.panY + (obj.y + obj.height / 2) * z;
      const pad = 48;
      let dx = 0;
      let dy = 0;
      if (cx < pad) dx = pad - cx;
      else if (cx > vr.width - pad) dx = vr.width - pad - cx;
      if (cy < pad) dy = pad - cy;
      else if (cy > vr.height - pad) dy = vr.height - pad - cy;
      if (dx !== 0 || dy !== 0) {
        this.panX += dx;
        this.panY += dy;
      }
    },

    selectGroup(groupId, opts = {}) {
      const members = this.objects.filter((o) => o.groupId === groupId);
      if (!members.length) return;
      if (opts.event && (opts.event.metaKey || opts.event.ctrlKey || opts.event.shiftKey)) {
        // Additive: add all members
        const ids = new Set(this.selectedIds);
        members.forEach((m) => ids.add(m.id));
        this.selectedIds = Array.from(ids);
        this.selectedId = members[members.length - 1].id;
      } else {
        this.selectedIds = members.map((m) => m.id);
        this.selectedId = members[members.length - 1].id;
      }
      if (this.selectedId) this.focusSelection(this.selectedId);
    },

    // --- Layers / groups ---

    layerDisplayName(obj) {
      if (!obj) return "";
      const name = obj.name && String(obj.name).trim();
      if (name) return name;
      if (obj.type === "wall") return "Wall";
      return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
    },

    getGroup(groupId) {
      return this.groups.find((g) => g.id === groupId) || null;
    },

    /**
     * Layers panel rows, top-of-stack first (reverse of paint order).
     * Groups appear once when first (topmost) member is hit.
     */
    layersView() {
      const ordered = this.objects.slice().reverse();
      const seenGroups = new Set();
      const rows = [];

      for (const obj of ordered) {
        const gid = obj.groupId;
        if (gid) {
          if (!seenGroups.has(gid)) {
            seenGroups.add(gid);
            const g = this.getGroup(gid) || {
              id: gid,
              name: "Group",
              collapsed: false,
            };
            const members = this.objects.filter((o) => o.groupId === gid);
            rows.push({
              kind: "group",
              id: gid,
              group: g,
              memberCount: members.length,
              allVisible: members.every((m) => m.visible !== false),
              allLocked: members.every((m) => !!m.locked),
            });
          }
          const g = this.getGroup(gid);
          if (g && g.collapsed) continue;
          rows.push({
            kind: "object",
            id: obj.id,
            obj,
            indented: true,
          });
        } else {
          rows.push({
            kind: "object",
            id: obj.id,
            obj,
            indented: false,
          });
        }
      }
      return rows;
    },

    toggleGroupCollapsed(groupId) {
      const g = this.getGroup(groupId);
      if (!g) return;
      g.collapsed = !g.collapsed;
    },

    toggleVisible(id) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;
      this.pushHistory();
      obj.visible = obj.visible === false;
    },

    toggleLocked(id) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;
      this.pushHistory();
      obj.locked = !obj.locked;
    },

    toggleGroupVisible(groupId) {
      const members = this.objects.filter((o) => o.groupId === groupId);
      if (!members.length) return;
      this.pushHistory();
      const show = !members.every((m) => m.visible !== false);
      members.forEach((m) => {
        m.visible = show;
      });
    },

    toggleGroupLocked(groupId) {
      const members = this.objects.filter((o) => o.groupId === groupId);
      if (!members.length) return;
      this.pushHistory();
      const lock = !members.every((m) => !!m.locked);
      members.forEach((m) => {
        m.locked = lock;
      });
    },

    /**
     * IDs that should move together when dragging `id`.
     * - Multi-selection containing it → move all selected
     * - Otherwise → only this object (groups are for Layers only, not forced co-drag)
     *   so every furniture piece (e.g. Armário lavanderia) can be moved alone.
     */
    movePeerIds(id) {
      if (this.selectedIds.length > 1 && this.selectedIds.includes(id)) {
        return this.selectedIds.slice();
      }
      return [id];
    },

    get canGroup() {
      return this.selectedIds.length >= 2;
    },

    get canUngroup() {
      return this.selectedIds.some((id) => {
        const o = this.objects.find((x) => x.id === id);
        return o && o.groupId;
      });
    },

    groupSelected() {
      if (!this.canGroup) return;
      this.pushHistory();
      const ids = this.selectedIds.slice();
      const gid = "group-" + this.groupSeq++;
      this.groups = [
        ...this.groups,
        {
          id: gid,
          name: "Group " + (this.groups.length + 1),
          collapsed: false,
        },
      ];

      const selected = [];
      const rest = [];
      for (const o of this.objects) {
        if (ids.includes(o.id)) {
          o.groupId = gid;
          selected.push(o);
        } else {
          rest.push(o);
        }
      }
      // Contiguous block at top of stack (end of array)
      this.objects = rest.concat(selected);
      this.selectedIds = ids;
      this.selectedId = ids[ids.length - 1];
    },

    ungroupSelected() {
      if (!this.canUngroup) return;
      this.pushHistory();
      const gids = new Set();
      for (const id of this.selectedIds) {
        const o = this.objects.find((x) => x.id === id);
        if (o && o.groupId) gids.add(o.groupId);
      }
      for (const o of this.objects) {
        if (o.groupId && gids.has(o.groupId)) o.groupId = null;
      }
      this.groups = this.groups.filter((g) => !gids.has(g.id));
    },

    renameGroup(groupId, name) {
      const g = this.getGroup(groupId);
      if (!g) return;
      this.pushHistory();
      g.name = String(name || "Group").trim() || "Group";
    },

    /** Move object (or whole group) in the stack. delta +1 = toward front. */
    nudgeLayer(id, delta) {
      const idx = this.objects.findIndex((o) => o.id === id);
      if (idx < 0) return;
      const obj = this.objects[idx];
      if (obj.groupId) {
        this.nudgeGroupLayer(obj.groupId, delta);
        return;
      }
      const next = idx + delta;
      if (next < 0 || next >= this.objects.length) return;
      this.pushHistory();
      const arr = this.objects.slice();
      const [item] = arr.splice(idx, 1);
      arr.splice(next, 0, item);
      this.objects = arr;
    },

    /** Move an entire group block by delta steps among non-members. */
    nudgeGroupLayer(groupId, delta) {
      const block = this.objects.filter((o) => o.groupId === groupId);
      if (!block.length) return;
      const indices = block.map((m) => this.objects.findIndex((o) => o.id === m.id));
      const minI = Math.min(...indices);
      const without = this.objects.filter((o) => o.groupId !== groupId);
      const packedMin = this.objects
        .slice(0, minI)
        .filter((o) => o.groupId !== groupId).length;
      let place = packedMin + delta;
      place = Math.max(0, Math.min(without.length, place));
      if (place === packedMin) return;
      this.pushHistory();
      const next = without.slice();
      next.splice(place, 0, ...block);
      this.objects = next;
    },

    bringToFront(id) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;
      this.pushHistory();
      if (obj.groupId) {
        const block = this.objects.filter((o) => o.groupId === obj.groupId);
        const rest = this.objects.filter((o) => o.groupId !== obj.groupId);
        this.objects = rest.concat(block);
        return;
      }
      this.objects = this.objects.filter((o) => o.id !== id).concat([obj]);
    },

    sendToBack(id) {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;
      this.pushHistory();
      if (obj.groupId) {
        const block = this.objects.filter((o) => o.groupId === obj.groupId);
        const rest = this.objects.filter((o) => o.groupId !== obj.groupId);
        this.objects = block.concat(rest);
        return;
      }
      this.objects = [obj].concat(this.objects.filter((o) => o.id !== id));
    },

    bringForward(id) {
      this.nudgeLayer(id, 1);
    },

    sendBackward(id) {
      this.nudgeLayer(id, -1);
    },

    /**
     * Reorder by dragging a layer row onto another.
     * targetId: object id or group id; place dragged item above target in stack
     * (visually above in list = higher z).
     */
    reorderLayerOnto(dragId, dragKind, targetId, targetKind) {
      if (!dragId || dragId === targetId) return;

      this.pushHistory();

      const takeIds = (kind, id) => {
        if (kind === "group") {
          return this.objects.filter((o) => o.groupId === id).map((o) => o.id);
        }
        return [id];
      };

      const movingIds = takeIds(dragKind, dragId);
      const movingSet = new Set(movingIds);
      const moving = this.objects.filter((o) => movingSet.has(o.id));
      const rest = this.objects.filter((o) => !movingSet.has(o.id));

      // Target insert position in `rest`: put moving just after the topmost target member
      let targetIds = takeIds(targetKind, targetId);
      // Find highest index among target ids in original, map to rest
      let insertAt = rest.length;
      if (targetKind === "group" || targetKind === "object") {
        // In layers list (top first), drop onto target means "place above target" = higher z
        // = later in array than target's top member
        const targetObjs = this.objects.filter((o) => targetIds.includes(o.id));
        if (targetObjs.length) {
          // After removing moving, find first rest item that was above (after) all targets
          // Place moving immediately after the highest remaining target
          const maxTargetIdxOrig = Math.max(
            ...targetIds.map((tid) => this.objects.findIndex((o) => o.id === tid))
          );
          // Count rest items with original index <= maxTargetIdxOrig
          let count = 0;
          for (let i = 0; i < this.objects.length; i++) {
            const o = this.objects[i];
            if (movingSet.has(o.id)) continue;
            if (i <= maxTargetIdxOrig) count++;
            else break;
          }
          insertAt = count;
        }
      }

      const next = rest.slice();
      next.splice(insertAt, 0, ...moving);
      this.objects = next;
      this.layerDrag = { active: false, id: null, kind: null };
    },

    onLayerDragStart(e, id, kind) {
      this.layerDrag = { active: true, id, kind };
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", kind + ":" + id);
      } catch (_) {
        /* ignore */
      }
    },

    onLayerDrop(e, targetId, targetKind) {
      e.preventDefault();
      if (!this.layerDrag.active) return;
      const { id, kind } = this.layerDrag;
      this.reorderLayerOnto(id, kind, targetId, targetKind);
    },

    onLayerDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },

    // --- History (undo / redo) ---

    captureSnapshot() {
      return JSON.stringify({
        objects: this.objects,
        groups: this.groups,
        groupSeq: this.groupSeq,
        labelOffsets: this.labelOffsets,
        selectedId: this.selectedId,
        selectedIds: this.selectedIds,
        showDimensionsGlobal: this.showDimensionsGlobal,
      });
    },

    /** Call before a user edit so undo can restore prior state. */
    pushHistory() {
      if (this._historyPaused) return;
      const snap = this.captureSnapshot();
      const last = this.historyPast[this.historyPast.length - 1];
      if (last === snap) return;
      this.historyPast.push(snap);
      if (this.historyPast.length > this.historyLimit) {
        this.historyPast.shift();
      }
      this.historyFuture = [];
    },

    restoreSnapshot(snap) {
      if (!snap) return;
      this._historyPaused = true;
      try {
        const data = JSON.parse(snap);
        this.objects = Array.isArray(data.objects) ? data.objects : [];
        this.groups = Array.isArray(data.groups) ? data.groups : [];
        this.groupSeq = Number(data.groupSeq) || 1;
        this.labelOffsets =
          data.labelOffsets && typeof data.labelOffsets === "object"
            ? data.labelOffsets
            : {};
        this.selectedId = data.selectedId || null;
        this.selectedIds = Array.isArray(data.selectedIds)
          ? data.selectedIds
          : this.selectedId
            ? [this.selectedId]
            : [];
        this.showDimensionsGlobal =
          data.showDimensionsGlobal === undefined
            ? true
            : !!data.showDimensionsGlobal;
        this.snapGuides = { v: null, h: null, active: false };
        FPComponents.seedIdCounter(this.objects);
      } finally {
        // Allow Alpine to flush before accepting new history entries
        this.$nextTick(() => {
          this._historyPaused = false;
        });
      }
    },

    get canUndo() {
      return this.historyPast.length > 0;
    },

    get canRedo() {
      return this.historyFuture.length > 0;
    },

    undo() {
      if (!this.canUndo) return;
      const current = this.captureSnapshot();
      const prev = this.historyPast.pop();
      this.historyFuture.push(current);
      this.restoreSnapshot(prev);
    },

    redo() {
      if (!this.canRedo) return;
      const current = this.captureSnapshot();
      const next = this.historyFuture.pop();
      this.historyPast.push(current);
      this.restoreSnapshot(next);
    },

    patchObject(id, patch) {
      const idx = this.objects.findIndex((o) => o.id === id);
      if (idx === -1) return;
      const current = this.objects[idx];

      // Allow ID rename with uniqueness check
      if (patch.id && patch.id !== id) {
        if (this.objects.some((o) => o.id === patch.id)) {
          return; // reject duplicate ids
        }
        Object.assign(current, patch);
        if (this.selectedId === id) this.selectedId = current.id;
        return;
      }

      // Mutate in place so Alpine keeps the same reactive object (smoother drag).
      Object.assign(current, patch);
    },

    updateSelected(patch) {
      if (!this.selectedId) return;
      this.pushHistory();
      this.patchObject(this.selectedId, patch);
    },

    deleteSelected() {
      const ids =
        this.selectedIds.length > 0
          ? this.selectedIds.slice()
          : this.selectedId
            ? [this.selectedId]
            : [];
      if (!ids.length) return;
      this.pushHistory();
      const idSet = new Set(ids);
      this.objects = this.objects.filter((o) => !idSet.has(o.id));
      // Drop empty groups
      const used = new Set(this.objects.map((o) => o.groupId).filter(Boolean));
      this.groups = this.groups.filter((g) => used.has(g.id));
      if (this.labelOffsets) {
        const next = { ...this.labelOffsets };
        ids.forEach((id) => {
          delete next[id];
        });
        this.labelOffsets = next;
      }
      this.clearSelection();
      this.snapGuides = { v: null, h: null, active: false };
    },

    /**
     * Clone selected object(s) with new ids, offset so the copy is visible.
     * Independent of groups. Selects the new clone(s).
     */
    duplicateSelected() {
      const ids =
        this.selectedIds.length > 0
          ? this.selectedIds.slice()
          : this.selectedId
            ? [this.selectedId]
            : [];
      if (!ids.length) return;

      const sources = ids
        .map((id) => this.objects.find((o) => o.id === id))
        .filter(Boolean);
      if (!sources.length) return;

      this.pushHistory();
      // 0.25 m southeast so the copy is not stacked on the original
      const offset = FPComponents.unitToPx(0.25, "m");
      const nextOffsets = { ...(this.labelOffsets || {}) };
      const clones = sources.map((src) => {
        const overrides = {
          name: src.name,
          notes: src.notes ?? "",
          x: Number(src.x) + offset,
          y: Number(src.y) + offset,
          width: src.width,
          height: src.height,
          rotation: src.rotation,
          labelRotation: src.labelRotation,
          visible: src.visible !== false,
          locked: !!src.locked,
          // Fresh copy is not in the source group
          groupId: null,
          opacity: src.opacity,
          showDimensions: src.showDimensions !== false,
        };
        if (src.type === "door") {
          overrides.hinge = src.hinge || "start";
          overrides.opens = src.opens || "neg";
        }
        const clone = FPComponents.createObject(src.type, overrides);
        const off = this.labelOffsets && this.labelOffsets[src.id];
        if (off) {
          nextOffsets[clone.id] = {
            w: { x: off.w?.x || 0, y: off.w?.y || 0 },
            h: { x: off.h?.x || 0, y: off.h?.y || 0 },
            n: { x: (off.n && off.n.x) || 0, y: (off.n && off.n.y) || 0 },
          };
        }
        return clone;
      });

      // Append so clones paint above the originals
      this.objects = this.objects.concat(clones);
      this.labelOffsets = nextOffsets;
      this.selectedIds = clones.map((c) => c.id);
      this.selectedId = clones[clones.length - 1].id;
      this.snapGuides = { v: null, h: null, active: false };
    },

    onKeydown(e) {
      const mod = e.metaKey || e.ctrlKey;
      // Let inputs keep native text undo while focused
      if (mod && !this.isTypingTarget(e.target)) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          this.redo();
          return;
        }
      }
      if (mod && (e.key === "d" || e.key === "D") && !this.isTypingTarget(e.target)) {
        e.preventDefault();
        this.duplicateSelected();
        return;
      }
      if (this.isTypingTarget(e.target)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.selectedId) {
          e.preventDefault();
          this.deleteSelected();
        }
      }
      if (e.key === "Escape") {
        this.clearSelection();
      }
      // Arrow keys: nudge selection 1 world px (1 cm). Hold key = browser key-repeat.
      if (
        !mod &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        if (this.selectedId || (this.selectedIds && this.selectedIds.length)) {
          e.preventDefault();
          const step = 1;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          if (e.key === "ArrowUp") dy = -step;
          if (e.key === "ArrowDown") dy = step;
          // One history entry per held-key gesture (first press only)
          this.nudgeSelected(dx, dy, !e.repeat);
        }
        return;
      }
      // R / Shift+R: rotate selected ±15° (no modifier keys)
      if ((e.key === "r" || e.key === "R") && !mod) {
        if (this.selectedId) {
          e.preventDefault();
          this.nudgeRotation(e.shiftKey ? -15 : 15);
        }
      }
      // ⌘/Ctrl+G group · ⌘/Ctrl+Shift+G ungroup
      if (mod && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (e.shiftKey) this.ungroupSelected();
        else this.groupSelected();
      }
      // ] / [ : bring forward / send backward
      if (!mod && e.key === "]" && this.selectedId) {
        e.preventDefault();
        this.bringForward(this.selectedId);
      }
      if (!mod && e.key === "[" && this.selectedId) {
        e.preventDefault();
        this.sendBackward(this.selectedId);
      }
      // V = Select, H = Hand (pan)
      if (!mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        this.setTool("select");
      }
      if (!mod && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        this.setTool("pan");
      }
    },

    // --- Zoom ---
    // Clean steps so the control doesn't land on awkward values like 126%
    zoomSteps: [0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3],

    zoomIn() {
      const steps = this.zoomSteps;
      const next = steps.find((z) => z > this.zoom + 0.001);
      this.setZoom(next != null ? next : this.maxZoom);
    },

    zoomOut() {
      const steps = this.zoomSteps;
      let prev = steps[0];
      for (const z of steps) {
        if (z < this.zoom - 0.001) prev = z;
      }
      this.setZoom(prev);
    },

    setZoom(next, centerClientX, centerClientY) {
      const viewport = this.$refs.viewport;
      if (!viewport) {
        this.zoom = clamp(next, this.minZoom, this.maxZoom);
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const cx = centerClientX ?? rect.left + rect.width / 2;
      const cy = centerClientY ?? rect.top + rect.height / 2;

      const prev = this.zoom;
      const z = clamp(next, this.minZoom, this.maxZoom);
      if (Math.abs(z - prev) < 0.0001) return;

      // Keep world point under cursor (or viewport center) stable
      const worldX = (cx - rect.left - this.panX) / prev;
      const worldY = (cy - rect.top - this.panY) / prev;

      this.zoom = z;
      this.panX = cx - rect.left - worldX * z;
      this.panY = cy - rect.top - worldY * z;
    },

    resetView() {
      this.zoom = 1;
      this.panX = 80;
      this.panY = 60;
    },

    /**
     * Wheel / trackpad:
     * - plain scroll → pan canvas (smooth, 1:1 with gesture)
     * - Ctrl/⌘ + scroll (or trackpad pinch) → zoom toward cursor
     */
    onWheel(e) {
      // Normalize line/page deltas to pixels
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (e.deltaMode === 2) {
        dx *= 400;
        dy *= 400;
      }

      const zoomGesture = e.ctrlKey || e.metaKey;
      if (zoomGesture) {
        // Continuous zoom (smooth). Pinch often arrives as ctrl+wheel.
        // Exponential scale so small trackpad steps feel even.
        const intensity = 0.0018;
        let factor = Math.exp(-dy * intensity);
        // Cap per-event change so a single mouse notch is not huge
        factor = clamp(factor, 0.88, 1.14);
        this.setZoom(this.zoom * factor, e.clientX, e.clientY);
        return;
      }

      // Pan canvas — natural scroll direction (content follows fingers)
      this.panX -= dx;
      this.panY -= dy;
    },

    // --- Pan ---

    onViewportPointerDown(e) {
      const isMiddle = e.button === 1;
      const isSpace = this.panState.spaceDown && e.button === 0;
      const isHand = this.activeTool === "pan" && e.button === 0;
      if (!isMiddle && !isSpace && !isHand) return;

      e.preventDefault();
      e.stopPropagation();
      this.panState.active = true;
      this.panState.startX = e.clientX;
      this.panState.startY = e.clientY;
      this.panState.originPanX = this.panX;
      this.panState.originPanY = this.panY;
      this.$refs.viewport.classList.add("is-panning", "is-dragging");
      this.$refs.viewport.setPointerCapture?.(e.pointerId);
    },

    onViewportPointerMove(e) {
      if (!this.panState.active) return;
      const dx = e.clientX - this.panState.startX;
      const dy = e.clientY - this.panState.startY;
      this.panX = this.panState.originPanX + dx;
      this.panY = this.panState.originPanY + dy;
    },

    onViewportPointerUp(e) {
      if (!this.panState.active) return;
      this.panState.active = false;
      this.$refs.viewport.classList.remove("is-dragging");
      // Keep grab cursor while Hand tool or Space is held
      if (!this.panState.spaceDown && this.activeTool !== "pan") {
        this.$refs.viewport.classList.remove("is-panning");
      }
      try {
        this.$refs.viewport.releasePointerCapture?.(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    },

    onViewportClick(e) {
      // Hand tool never places or clears selection on click
      if (this.activeTool === "pan") return;

      // Ignore residual click after selecting a thin object (window/door/wall):
      // mousedown hits the leaf, mouseup slips onto the paper → empty target.
      if (this._suppressClearUntil && Date.now() < this._suppressClearUntil) {
        return;
      }

      const empty =
        e.target === this.$refs.viewport ||
        e.target.classList.contains("canvas-world") ||
        e.target.classList.contains("grid-bg") ||
        e.target.classList.contains("scale-bar") ||
        e.target.classList.contains("scale-bar-line") ||
        e.target.classList.contains("scale-bar-label");

      if (!empty) return;

      // Place tool: click empty canvas to drop a component
      if (this.isPlaceTool) {
        this.placeFromPalette(e.clientX, e.clientY, this.activeTool);
        return;
      }

      this.clearSelection();
    },

    // --- Palette drag → place ---

    startPaletteDrag(e, type) {
      if (e.button !== 0) return;
      e.preventDefault();

      const def = FPComponents.CATALOG[type];
      this.paletteDrag = {
        active: true,
        type,
        x: e.clientX,
        y: e.clientY,
        width: def.defaults.width,
        height: def.defaults.height,
        pointerId: e.pointerId,
      };

      const onMove = (ev) => {
        if (!this.paletteDrag.active) return;
        this.paletteDrag.x = ev.clientX;
        this.paletteDrag.y = ev.clientY;
      };

      const onUp = (ev) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        if (!this.paletteDrag.active) return;
        this.placeFromPalette(ev.clientX, ev.clientY, type);
        this.paletteDrag.active = false;
        this.paletteDrag.type = null;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },

    placeFromPalette(clientX, clientY, type) {
      const viewport = this.$refs.viewport;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      // Only place if pointer is over the canvas
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return;
      }

      const def = FPComponents.CATALOG[type];
      const worldX = (clientX - rect.left - this.panX) / this.zoom - def.defaults.width / 2;
      const worldY = (clientY - rect.top - this.panY) / this.zoom - def.defaults.height / 2;

      let obj = FPComponents.createObject(type, {
        x: worldX,
        y: worldY,
      });

      // Snap to partners on drop
      const snapped = FPSnap.snapPosition(
        obj,
        this.objects,
        type,
        { range: 16 }
      );
      obj = { ...obj, x: snapped.x, y: snapped.y };

      this.pushHistory();
      this.objects.push(obj);
      this.selectedIds = [obj.id];
      this.selectedId = obj.id;

      // Brief snap guide feedback
      if (snapped.active) {
        this.snapGuides = { v: snapped.guides.v, h: snapped.guides.h, active: true };
        setTimeout(() => {
          this.snapGuides = { v: null, h: null, active: false };
        }, 250);
      }
    },
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
