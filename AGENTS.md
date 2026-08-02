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
| `@fp/demo` | `src/demo/` | Demo seed layout (tests / optional templates) |
| `@fp/projects` | `src/projects/` | Projects API client + plan document helpers |
| `@fp/snap` | `src/snap/` | Edge/grid snap (pure) |
| `@fp/interact` | `src/interact/` | interact.js resize wiring |
| `@fp/visualizer` | `src/visualizer/` | Three.js 3D walkthrough (Visualize mode) |
| `@fp/app` | `src/app/` | Alpine factory + app surface types |
| (no alias) | `server/` | Local Node API (Hono + Prisma → Postgres) |
| (no alias) | `prisma/` | Prisma schema + versioned SQL migrations |

### Dependency direction (must not reverse)

```
types ← units ← geometry ← catalog ← doors
                              ↑
                            demo
types ← projects
types ← geometry ← snap
app → catalog | snap | doors | demo | geometry | units | interact | visualizer | projects
interact → snap | catalog | geometry | types
visualizer → types | units | geometry | three
main → app
server/  (standalone Node process; does not import @fp/*)
```

- Pure libraries (`units`, `geometry`, `catalog`, `doors`, `demo`, `snap`, `projects`) **must not** import DOM/`window`/`document`.
- Only `app`, `interact`, `visualizer`, and `main` may touch the DOM.
- Projects persist via `server/` + Postgres (`docker compose`). Schema is owned by **Prisma Migrate** (`prisma/schema.prisma`, `prisma/migrations/`). No auth for this local experiment.

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
npm run db:up          # Postgres via Docker Compose :5432
npm run db:migrate     # Apply Prisma migrations (deploy)
npm run db:migrate:dev # Create/apply migrations in development
npm run db:generate    # Generate Prisma Client
npm run db:studio      # Prisma Studio UI
npm run server         # Projects API :3001
npm run dev            # Vite dev server :8765 (proxies /api → :3001)
npm run build          # typecheck + production build
npm run preview        # serve dist :8765
npm run typecheck      # tsc --noEmit
npm run test           # vitest unit
npm run test:e2e       # Playwright smoke (Vite must be up)
```

## What not to do

- Do not reintroduce IIFE scripts under `js/`.
- Do not add a multi-package monorepo without an explicit product need.
- Do not rewrite Alpine → React/Vue as a drive-by.
- Do not expand scope beyond the asked change (scope discipline).
