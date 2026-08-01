# Floor Plan Editor

Light SaaS-style floor plan canvas built with **Alpine.js**, **interact.js**, and vanilla JS.

## Run

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

## Stack

| Library     | Role                                   |
| ----------- | -------------------------------------- |
| Alpine.js   | UI state, panels, reactive object list |
| interact.js | Drag + resize on canvas objects        |
| Vanilla JS  | Snap engine, component catalog, export |

No build step. CDNs for Alpine and interact.

## Layout

```
index.html           Shell: header, library, canvas, properties
css/styles.css       Light SaaS chrome + line-plan objects
js/components.js     Floor / Wall / Window / Door catalog
js/snap.js           Edge / grid snap (world coordinates)
js/interact-setup.js interact.js drag & resize
js/app.js            Alpine app: tools, zoom, pan, export
```

## Features

- **Light product UI** with white panels, dotted canvas, floating zoom and bottom toolbar
- **Components** (left): drag Floor / Wall / Window / Door onto the canvas
- **Tools** (bottom): Select, place types, Delete
- **Move / resize** every object; partner-edge snap with green guides
- **Size labels** on the sides (global **Sizes** toggle + per-object checkbox)
- **Properties** (right): identity, dimensions, configuration, notes
- **Export** plan as JSON
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
