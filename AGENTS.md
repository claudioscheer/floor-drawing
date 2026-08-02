# AGENTS.md — Floor Plan Editor

Rules for any agent or human working in this repository. Follow them strictly.

## Stack

- **TypeScript** (strict) + **Vite** + **Vitest**
- **Alpine.js** for UI state / template bindings
- **interact.js** for resize handles only (drag is owned by the app)
- Scale: **1 world px = 1 cm**, **100 px = 1 m**

## Package layout (libraries by scope)

| Alias | Path | Responsibility |
|-------|------|----------------|
| `@fp/types` | `src/types/` | **Only** place for domain types |
| `@fp/units` | `src/units/` | Scale, formatLength/Area, grid, clamp |
| `@fp/geometry` | `src/geometry/` | Rotation, opacity, AABB |
| `@fp/catalog` | `src/catalog/` | CATALOG, createObject, ids, SNAP_PARTNERS |
| `@fp/doors` | `src/doors/` | Door geometry + SVG paths |
| `@fp/demo` | `src/demo/` | Demo seed layout |
| `@fp/snap` | `src/snap/` | Edge/grid snap (pure) |
| `@fp/interact` | `src/interact/` | interact.js resize wiring |
| `@fp/app` | `src/app/` | Alpine factory + app surface types |

### Dependency direction (must not reverse)

```
types ← units ← geometry ← catalog ← doors
                              ↑
                            demo
types ← geometry ← snap
app → catalog | snap | doors | demo | geometry | units | interact
interact → snap | catalog | geometry | types
main → app
```

- Pure libraries (`units`, `geometry`, `catalog`, `doors`, `demo`, `snap`) **must not** import DOM/`window`/`document`.
- Only `app`, `interact`, and `main` may touch the DOM.

## TypeScript rules (strict)

1. **`strict: true` is non-negotiable.** Do not weaken `tsconfig` to silence errors.
2. **No `any`.** Use `unknown` at boundaries and narrow. Prefer domain types from `@fp/types`.
3. **Centralized types only.** If a shape is shared or domain-level, define it in `src/types/`. Do not re-declare the same object shape in feature modules.
4. **No app library globals.** Forbidden:
   - `window.FPComponents`, `window.FPSnap`, `window.FPInteract`
   - `window.__fpApp`
   - Attaching domain APIs to `window` “for convenience”
   - Allowed: `window.Alpine` (framework bootstrap only)
5. **ESM imports only.** Cross-library use is `import { x } from "@fp/…"`.
6. **Public exports need TSDoc** (`@param`, `@returns`, units when relevant: world px vs meters).
7. **Prefer pure functions** for logic that does not need Alpine `this`. Unit-test those.
8. **No unused exports** introduced “just in case.” Keep barrels (`index.ts`) intentional.
9. **Do not use `// @ts-ignore` / `@ts-nocheck`** without a one-line justification and a follow-up issue. Prefer fixing the type.
10. **Exact optional / null handling:** treat `null` and `undefined` deliberately; do not coerce away errors with `!` unless the invariant is documented.

## Behavior parity

- Do not change product behavior (demo geometry, shortcuts, snap rules, visual design) unless the task explicitly asks for it.
- Drag stays Alpine-owned; interact.js stays resize-only.
- History, selection, layers semantics stay as implemented.

## Testing

- **Unit tests** (`tests/unit/`) cover pure libraries: units, geometry, catalog, snap, doors.
- **E2e** (`tests/e2e/`) drives the real page via Playwright. Access app state through **Alpine component data on `#app`**, not domain globals.
- Run before claiming done:
  - `npm run typecheck`
  - `npm run test` (unit)
  - `npm run build`
  - e2e against `npm run preview` when UI/behavior touched

## Formatting

- Delegate formatting to project tools; do not hand-fight style.
- No AI attribution in commits, comments, or docs.

## Commands

```bash
npm run dev          # Vite dev server :8765
npm run build        # typecheck + production build
npm run preview      # serve dist :8765
npm run typecheck    # tsc --noEmit
npm run test         # vitest unit
npm run test:e2e     # Playwright smoke (server must be up)
```

## What not to do

- Do not reintroduce IIFE scripts under `js/`.
- Do not add a multi-package monorepo without an explicit product need.
- Do not rewrite Alpine → React/Vue as a drive-by.
- Do not expand scope beyond the asked change (scope discipline).
