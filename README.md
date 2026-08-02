# Floor Plan Editor

Light SaaS-style floor plan canvas built with **TypeScript**, **Alpine.js**, and **interact.js**. Projects are stored in **Postgres** via a small local API (Docker Compose).

## Run (local)

```bash
npm install
npm run db:up          # Postgres on :5432
npm run db:migrate     # Apply Prisma migrations
npm run server         # API on :3001 (separate terminal)
npm run dev            # Vite on :8765 (proxies /api → API)
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

You should land on the **Projects** list. Create a project, edit the plan (auto-saves), then return to the list to open, duplicate, export, or delete projects.

Each project has a stable UUID. Opening one updates the URL to:

```
http://127.0.0.1:8765/projects/<uuid>
```

Copy that URL to reopen the same project later. The list lives at `/`.

Production build:

```bash
npm run build
npm run preview
```

(Preview still needs `npm run server` + `npm run db:up` for project APIs.)

## Stack

| Library / service | Role |
| ----------------- | ---- |
| TypeScript | Domain types, pure libraries, app surface |
| Alpine.js | UI state, panels, reactive object list |
| interact.js | Resize handles on canvas objects |
| Vite | Dev server + production bundle |
| Vitest | Unit tests for pure libraries |
| Hono + Prisma | Local projects API (`server/`) |
| Prisma Migrate | Versioned SQL migrations (`prisma/`) |
| Postgres 16 | Project storage (Docker Compose) |

## Layout

```
src/
  types/       Central domain types (@fp/types)
  units/       Scale + formatting (1 px = 1 cm)
  geometry/    Rotation, AABB, opacity
  catalog/     Component catalog + createObject
  doors/       Door geometry + SVG paths
  demo/        Multifamily demo seed (tests / future templates)
  projects/    Projects API client + document helpers
  snap/        Edge / grid snap
  interact/    interact.js resize wiring
  app/         Alpine floorPlanApp factory
  main.ts      Bootstrap (no domain globals)
  styles/      CSS
server/        Local REST API (projects CRUD via Prisma)
prisma/        Schema + migrations
docker-compose.yml
tests/
  unit/        Vitest pure-library tests
  e2e/         Playwright smoke
AGENTS.md      Strict TypeScript + package rules
```

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run db:up` | Start Postgres (`docker compose up -d`) |
| `npm run db:down` | Stop Postgres |
| `npm run db:migrate` | Apply Prisma migrations (`migrate deploy`) |
| `npm run db:migrate:dev` | Create/apply migrations in development |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:studio` | Browse data in Prisma Studio |
| `npm run db:status` | Migration status |
| `npm run server` | Projects API on :3001 |
| `npm run dev` | Vite dev server :8765 |
| `npm run build` | Typecheck + bundle |
| `npm run preview` | Serve `dist` :8765 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests |
| `npm run test:e2e` | Playwright smoke |

## Features

- **Projects browser** on first open: create, open, duplicate, export JSON, delete
- Debounced **auto-save** to Postgres while editing (status chip in the header)
- Light product UI with white panels, dotted canvas, floating zoom and bottom toolbar
- Components (left): drag Floor / Wall / Window / Door onto the canvas
- Tools (bottom): Select, place types, Delete
- Move / resize every object; partner-edge snap with green guides
- Size labels (global **Sizes** toggle + per-object checkbox)
- Properties (right): identity, dimensions, configuration, notes
- Export plan as JSON (editor header or project list)
- Zoom (scroll or floating controls), pan (Space + drag or middle mouse)
- Visualize: Three.js walkthrough

## Controls

| Action | How |
| ------ | --- |
| Projects | Header **Projects** (from editor) |
| Place | Drag from left, or pick tool + click canvas |
| Move | Drag object (Select tool) |
| Resize | Drag handles when selected |
| Size labels | Header **Sizes**, or per-object toggle |
| Zoom | Scroll or floating `+` / `−` |
| Pan | Space + drag, or middle mouse |
| Delete | `Del` / `Backspace` or Delete button |
| Export | Header **Export** or list **Export** |

## API (local)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/health` | API + DB ping |
| GET | `/api/projects` | List summaries |
| GET | `/api/projects/:id` | Full project + document |
| POST | `/api/projects` | Create empty project |
| PUT | `/api/projects/:id` | Update name / document |
| POST | `/api/projects/:id/duplicate` | Clone |
| DELETE | `/api/projects/:id` | Delete |

No authentication (local experiment only). Defaults match `.env.example` and `docker-compose.yml`.

### Database migrations (Prisma)

Schema lives in `prisma/schema.prisma`. Versioned SQL migrations live in `prisma/migrations/`.

```bash
# After pulling new code
npm run db:migrate

# When changing the schema locally
# 1. Edit prisma/schema.prisma
# 2. Create + apply a migration
npm run db:migrate:dev -- --name describe_your_change
```

The API does **not** auto-migrate on boot; run `db:migrate` (or `db:migrate:dev`) explicitly.

See [AGENTS.md](./AGENTS.md) for TypeScript and package boundary rules.
