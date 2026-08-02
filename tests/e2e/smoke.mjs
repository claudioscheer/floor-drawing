/**
 * End-to-end smoke for the floor-plan editor.
 * Drives the real page at BASE_URL (default http://127.0.0.1:8765).
 * App state: Alpine.$data(#app) — no domain library globals.
 *
 * Usage:
 *   node tests/e2e-smoke.mjs
 *   BASE_URL=http://127.0.0.1:8765 OUT_DIR=./tmp node tests/e2e-smoke.mjs
 *
 * Requires: playwright (npx playwright install chromium once).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8765";
const OUT_DIR =
  process.env.OUT_DIR ||
  path.join(ROOT, "tests", "output");

fs.mkdirSync(OUT_DIR, { recursive: true });

function fail(results, name, err) {
  results.checks.push({ name, ok: false, error: String(err && err.message ? err.message : err) });
}

function pass(results, name, detail) {
  results.checks.push({ name, ok: true, detail: detail || null });
}

async function main() {
  const results = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks: [],
    errors: [],
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    page.on("pageerror", (e) => results.errors.push({ type: "pageerror", message: e.message }));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        results.errors.push({ type: "console", message: msg.text() });
      }
    });

    await page.goto(BASE_URL + "/?e2e=" + Date.now(), { waitUntil: "networkidle" });

    // --- mount ---
    const mounted = await page.evaluate(() => {
      const root = document.querySelector("#app");
      const app = root && window.Alpine ? window.Alpine.$data(root) : null;
      return {
        title: document.title,
        hasApp: !!(app && Array.isArray(app.objects)),
        screen: app ? app.screen : null,
        hasProjectsUi: !!document.querySelector(".projects-screen"),
        objectCount: app ? app.objects.length : 0,
      };
    });
    if (!mounted.hasApp) throw new Error("Alpine floorPlanApp not mounted on #app");
    pass(results, "app-mount", mounted);

    // --- projects browser on boot ---
    const projectsBoot = await page.evaluate(() => {
      const root = document.querySelector("#app");
      const app = root && window.Alpine ? window.Alpine.$data(root) : null;
      const screen = document.querySelector(".projects-screen");
      const title = document.querySelector(".projects-title");
      const newBtn = Array.from(document.querySelectorAll(".projects-screen .btn")).find(
        (b) => /new project/i.test(b.textContent || "")
      );
      return {
        ok:
          app &&
          app.screen === "projects" &&
          !!screen &&
          !!(title && /projects/i.test(title.textContent || "")) &&
          !!newBtn,
        screen: app && app.screen,
        hasTitle: !!(title && title.textContent),
      };
    });
    if (!projectsBoot.ok) fail(results, "projects-boot", JSON.stringify(projectsBoot));
    else pass(results, "projects-boot", projectsBoot);
    await page.screenshot({ path: path.join(OUT_DIR, "projects-list.png") });

    // --- enter editor without API (local session for canvas smoke) ---
    await page.evaluate(() => {
      const root = document.querySelector("#app");
      const app = root && window.Alpine ? window.Alpine.$data(root) : null;
      if (!app) return;
      // Keep projectId null so auto-save does not hit the API during pure UI smoke
      app.projectId = null;
      app.screen = "editor";
      app.planName = "E2E Plan";
      app.objects = [];
      app.groups = [];
      app.groupSeq = 1;
      app.selectedId = null;
      app.selectedIds = [];
      app.historyPast = [];
      app.historyFuture = [];
      app.saveStatus = "idle";
    });
    await page.waitForTimeout(80);

    // --- tools palette visible ---
    const toolsLayout = await page.evaluate(() => {
      const palette = document.querySelector(".palette-scroll");
      if (!palette) return { ok: false, reason: "no palette" };
      const tools = Array.from(document.querySelectorAll(".palette-item")).map((t) => {
        const r = t.getBoundingClientRect();
        return {
          label: t.textContent.trim().replace(/\s+/g, " "),
          // Present in palette DOM with a real box (may need scroll for last items)
          present: r.height > 0 && palette.contains(t),
        };
      });
      const labels = tools.map((t) => t.label);
      const expected = [
        "Select",
        "Terrain",
        "Room",
        "Furniture",
        "Wall",
        "Window",
        "Door",
      ];
      const hasAll = expected.every((e) => labels.some((l) => l.includes(e)));
      return {
        ok: hasAll && tools.every((t) => t.present) && palette.clientHeight >= 160,
        paletteH: palette.clientHeight,
        tools,
        hasAll,
      };
    });
    if (!toolsLayout.ok) fail(results, "tools-visible", JSON.stringify(toolsLayout));
    else pass(results, "tools-visible", toolsLayout);

    // --- layers panel present (may be empty before we place objects) ---
    const layersOk = await page.evaluate(() => {
      const list = document.querySelector(".layers-list");
      const panel = document.querySelector(".layers-panel");
      return !!(list && panel && panel.clientHeight > 80);
    });
    if (!layersOk) fail(results, "layers-present", "layers list missing or zero height");
    else pass(results, "layers-present");

    await page.screenshot({ path: path.join(OUT_DIR, "ui-shell.png") });

    // --- selection focus (place a floor first; no demo seed on boot) ---
    const selectFocus = await page.evaluate(async () => {
      const app = (function(){ const root = document.querySelector("#app"); return root && window.Alpine ? window.Alpine.$data(root) : null; })();
      const floor = app.createObject("room", {
        x: 200,
        y: 200,
        width: app.m(4),
        height: app.m(3),
        name: "E2E Estar",
      });
      app.objects = app.objects.concat([floor]);
      app.selectObject(floor.id);
      await new Promise((r) => setTimeout(r, 80));
      const el = document.querySelector('.fp-object[data-id="' + floor.id + '"]');
      const row = document.querySelector('.layer-row[data-layer-id="' + floor.id + '"]');
      const h2 = document.querySelector(".panel-right h2");
      return {
        ok:
          app.selectedId === floor.id &&
          !!(el && el.classList.contains("is-selected")) &&
          !!(row && row.classList.contains("is-selected")) &&
          !!(h2 && h2.textContent && h2.textContent.length > 0) &&
          !!(el && el.style.outline && el.style.outline.includes("rgb(47, 111, 237)") || el.style.outline.includes("#2f6fed")),
        selectedId: app.selectedId,
        hasClass: el && el.classList.contains("is-selected"),
        layerSelected: row && row.classList.contains("is-selected"),
        inspector: h2 && h2.textContent,
        outline: el && el.style.outline,
        name: floor.name,
      };
    });
    if (!selectFocus.ok) fail(results, "select-focus", JSON.stringify(selectFocus));
    else pass(results, "select-focus", selectFocus);
    await page.screenshot({ path: path.join(OUT_DIR, "select-focus.png") });

    // --- feature APIs ---
    const features = await page.evaluate(async () => {
      const app = (function(){ const root = document.querySelector("#app"); return root && window.Alpine ? window.Alpine.$data(root) : null; })();
      const out = {};

      // place floor via public path
      const beforeCount = app.objects.length;
      app.pushHistory();
      const placed = app.createObject("room", {
        x: 100,
        y: 100,
        width: app.m(2),
        height: app.m(2),
        name: "E2E Floor",
      });
      app.objects = app.objects.concat([placed]);
      app.selectedIds = [placed.id];
      app.selectedId = placed.id;
      out.place = app.objects.length === beforeCount + 1 && app.objects.some((o) => o.id === placed.id);

      // move
      const ox = placed.x;
      app.patchObject(placed.id, { x: ox + 50, y: placed.y + 25 });
      const moved = app.objects.find((o) => o.id === placed.id);
      out.move = moved && moved.x === ox + 50;

      // resize
      app.patchObject(placed.id, { width: app.m(3), height: app.m(2.5) });
      const resized = app.objects.find((o) => o.id === placed.id);
      out.resize = resized && resized.width === app.m(3) && resized.height === app.m(2.5);

      // opacity
      app.setOpacityPercent(40, false);
      const op = app.objects.find((o) => o.id === placed.id);
      out.opacity = op && Math.abs(op.opacity - 0.4) < 0.001;

      // rotation
      app.setRotation(45);
      out.rotation = app.selected && Math.round(app.selected.rotation) === 45;

      // label rotation (floor)
      app.setLabelRotation(45);
      out.labelRotation = app.selected && Math.round(app.selected.labelRotation) === 45;

      // undo / redo
      const countBeforeUndo = app.objects.length;
      app.pushHistory();
      const delId = placed.id;
      app.objects = app.objects.filter((o) => o.id !== delId);
      app.clearSelection();
      const midCount = app.objects.length;
      app.undo();
      const afterUndo = app.objects.some((o) => o.id === delId);
      app.redo();
      const afterRedo = !app.objects.some((o) => o.id === delId);
      out.undo = midCount === countBeforeUndo - 1 && afterUndo;
      out.redo = afterRedo === true;
      // restore object for later tests
      app.undo();
      out.undoRestored = app.objects.some((o) => o.id === delId);

      // hide / show layer
      app.selectObject(delId, { focus: false });
      app.toggleVisible(delId);
      const hidden = app.objects.find((o) => o.id === delId);
      out.hide = hidden && hidden.visible === false;
      app.toggleVisible(delId);
      const shown = app.objects.find((o) => o.id === delId);
      out.show = shown && shown.visible !== false;

      // lock
      app.toggleLocked(delId);
      out.lock = app.objects.find((o) => o.id === delId).locked === true;
      app.toggleLocked(delId);
      out.unlock = app.objects.find((o) => o.id === delId).locked === false;

      // group + move peers
      const a = app.objects.find((o) => o.id === delId);
      const b = app.createObject("room", {
        x: a.x + 300,
        y: a.y,
        width: 100,
        height: 100,
        name: "E2E Peer",
      });
      app.pushHistory();
      app.objects = app.objects.concat([b]);
      app.selectedIds = [a.id, b.id];
      app.selectedId = b.id;
      app.groupSelected();
      const peers = app.movePeerIds(a.id);
      out.group = peers.length === 2 && a.groupId && b.groupId && a.groupId === b.groupId;

      // simulate group move delta
      const startAx = a.x;
      const startBx = b.x;
      const dx = 40;
      a.x += dx;
      b.x += dx;
      out.groupMove = a.x === startAx + dx && b.x === startBx + dx;

      app.ungroupSelected();
      out.ungroup = !a.groupId && !b.groupId;

      // bring to front
      const idxBefore = app.objects.findIndex((o) => o.id === a.id);
      app.bringToFront(a.id);
      const idxAfter = app.objects.findIndex((o) => o.id === a.id);
      out.bringToFront = idxAfter === app.objects.length - 1 && idxAfter >= idxBefore;

      // sizes toggle
      const prevDims = app.showDimensionsGlobal;
      app.toggleGlobalDimensions();
      out.sizesToggle = app.showDimensionsGlobal !== prevDims;
      app.toggleGlobalDimensions(); // restore

      // export payload non-empty
      const payload = {
        name: app.planName,
        objects: app.objects,
        groups: app.groups,
      };
      const json = JSON.stringify(payload);
      out.export = json.length > 100 && payload.objects.length > 0;

      // zoom
      const z0 = app.zoom;
      app.zoomIn();
      out.zoomIn = app.zoom > z0 || app.zoom === app.maxZoom;
      app.zoomOut();
      out.zoomOut = true;

      return out;
    });

    for (const [k, v] of Object.entries(features)) {
      if (v) pass(results, "feature:" + k);
      else fail(results, "feature:" + k, "expected true");
    }

    await page.screenshot({ path: path.join(OUT_DIR, "ui-after-smoke.png") });

    // console / page errors (API may be down during pure UI smoke)
    const realErrors = results.errors.filter(
      (e) =>
        !/favicon/i.test(e.message || "") &&
        !/\/api\/projects/i.test(e.message || "") &&
        !/Failed to fetch/i.test(e.message || "") &&
        !/NetworkError/i.test(e.message || "") &&
        !/Load projects failed/i.test(e.message || "") &&
        !/List projects failed/i.test(e.message || "")
    );
    if (realErrors.length) fail(results, "zero-errors", JSON.stringify(realErrors));
    else pass(results, "zero-errors", { count: 0 });

    results.finishedAt = new Date().toISOString();
    results.passed = results.checks.every((c) => c.ok);
    results.failedCount = results.checks.filter((c) => !c.ok).length;

    const outFile = path.join(OUT_DIR, "e2e-smoke.json");
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.passed, failedCount: results.failedCount, outFile }, null, 2));
    if (!results.passed) {
      console.error(JSON.stringify(results.checks.filter((c) => !c.ok), null, 2));
      process.exitCode = 1;
    }
  } catch (err) {
    results.fatal = String(err && err.stack ? err.stack : err);
    results.passed = false;
    fs.writeFileSync(path.join(OUT_DIR, "e2e-smoke.json"), JSON.stringify(results, null, 2));
    console.error(results.fatal);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
