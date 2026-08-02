# Floor Plan Editor

Light SaaS-style floor plan canvas built with **TypeScript**, **Alpine.js**, and **interact.js**.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

Production build:

```bash
npm run build
npm run preview
```

## Stack

| Library     | Role                                   |
| ----------- | -------------------------------------- |
| TypeScript  | Domain types, pure libraries, app surface |
| Alpine.js   | UI state, panels, reactive object list |
| interact.js | Resize handles on canvas objects       |
| Vite        | Dev server + production bundle         |
| Vitest      | Unit tests for pure libraries          |

## Layout

```
src/
  types/       Central domain types (@fp/types)
  units/       Scale + formatting (1 px = 1 cm)
  geometry/    Rotation, AABB, opacity
  catalog/     Component catalog + createObject
  doors/       Door geometry + SVG paths
  demo/        Multifamily demo seed
  snap/        Edge / grid snap
  interact/    interact.js resize wiring
  app/         Alpine floorPlanApp factory
  main.ts      Bootstrap (no domain globals)
  styles/      CSS
tests/
  unit/        Vitest pure-library tests
  e2e/         Playwright smoke
AGENTS.md      Strict TypeScript + package rules
```

## Scripts

| Command            | Purpose                |
| ------------------ | ---------------------- |
| `npm run dev`      | Vite dev server :8765  |
| `npm run build`    | Typecheck + bundle     |
| `npm run preview`  | Serve `dist` :8765     |
| `npm run typecheck`| `tsc --noEmit`         |
| `npm run test`     | Unit tests             |
| `npm run test:e2e` | Playwright smoke       |

## Features

- Light product UI with white panels, dotted canvas, floating zoom and bottom toolbar
- Components (left): drag Floor / Wall / Window / Door onto the canvas
- Tools (bottom): Select, place types, Delete
- Move / resize every object; partner-edge snap with green guides
- Size labels (global **Sizes** toggle + per-object checkbox)
- Properties (right): identity, dimensions, configuration, notes
- Export plan as JSON
- Zoom (scroll or floating controls), pan (Space + drag or middle mouse)

## Controls

| Action          | How                                      |
| --------------- | ---------------------------------------- |
| Place           | Drag from left, or pick tool + click canvas |
| Move            | Drag object (Select tool)                |
| Resize          | Drag handles when selected               |
| Size labels     | Header **Sizes**, or per-object toggle   |
| Zoom            | Scroll or floating `+` / `−`             |
| Pan             | Space + drag, or middle mouse            |
| Delete          | `Del` / `Backspace` or Delete button     |
| Export          | Header **Export**                        |

See [AGENTS.md](./AGENTS.md) for TypeScript and package boundary rules.
