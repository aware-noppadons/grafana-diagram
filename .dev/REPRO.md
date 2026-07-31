# Reproduction: `jdbranham-diagram-panel` binds data to flowcharts but not sequence diagrams

This repo is a **working, running** Grafana reproduction proving that the
[grafana-diagram](https://github.com/jdbranham/grafana-diagram) panel plugin
(**v1.10.4**, unmodified) binds Grafana series values onto a **flowchart**
diagram (control — works) but does **not** bind the **same data** onto a
**sequence** diagram (the bug).

## What it proves

Two `jdbranham-diagram-panel` panels sit side by side, fed the **identical**
three TestData series — `Orders=120`, `Payments=95`, `Shipping=78` (reduced with
`last`). The only difference between the panels is the Mermaid diagram type.

| Panel | Diagram | Result |
| --- | --- | --- |
| **Flowchart (CONTROL)** | `graph LR` | Each node shows its bound value: **Orders 120**, **Payments 95**, **Shipping 78**. Data binding works. |
| **Sequence (BUG)** | `sequenceDiagram` | The panel fails: **`Error rendering diagram ... TypeError: Cannot read properties of undefined (reading 'getBBox')`**. No value binds. |

Both panels' legend tables show the same numbers, proving they receive identical
data — only the diagram fails to bind it.

See `proof/01-graph-works.png`, `proof/02-sequence-broken.png`,
`proof/03-side-by-side.png`, and `proof/DOM-evidence.md`.

## Run it

Prerequisites: Docker + Docker Compose. The plugin build (`grafana-diagram/dist`)
is already present; rebuild instructions are below if needed.

```bash
docker compose up -d
# wait for health, then open:
```

- URL: <http://localhost:3000/d/diagram-repro/diagram-panel-graph-vs-sequence>
- Anonymous access is enabled as **Admin** (no login required).
- Admin credentials if you want to log in: `admin` / `admin`.

What to look for:

- **Left panel (flowchart / control):** the three boxes read `Orders 120`,
  `Payments 95`, `Shipping 78` — the Grafana values are bound onto the nodes.
- **Right panel (sequence / bug):** an error message
  `TypeError: Cannot read properties of undefined (reading 'getBBox')` — the same
  data does not bind; the diagram does not render.

Stop it with `docker compose down` (add `-v` to also wipe Grafana's DB volume;
this compose file uses no named volume, so state lives only in the container).

## Regenerate the proof screenshots

```bash
npm install            # installs playwright
npx playwright install chromium
node scripts/screenshot.mjs
```

The script navigates to the dashboard, waits for both panels to settle, writes
the three PNGs and `proof/DOM-evidence.md`, prints a PASS/FAIL summary, and exits
non-zero if the reproduction is not valid (control must show values AND sequence
must bind nothing).

## Root cause (for the upstream fix / PR)

All value binding happens in
[`src/visualizers/updateDiagramStyle.ts`](grafana-diagram/src/visualizers/updateDiagramStyle.ts).
For each series, `processDiagramSeriesModel()` tries to match a diagram element in
order:

1. `selectElementById` → `container.querySelector('[data-id="<series>"]')` — **flowchart nodes carry `data-id`, so this hits** and `.diagram-value` is injected. This is why the control works.
2. `selectElementByEdgeLabel` (a `<span>` whose text equals the series name)
3. `selectDivElementByAlias` (a `<div>` whose text equals the series name)
4. `selectTextElementByAlias` (a `<text>` whose text equals the series name)
5. `selectTextElementContainingAlias` (a `<text>` containing the series name)

A Mermaid **sequence** diagram renders its actors as bare `<text>` elements with
**no `data-id`**, so strategy 1 misses. The series name (e.g. `Orders`) instead
matches an actor `<text>` at **strategy 4**, which calls `styleTextEdgeLabel()`:

```ts
const styleTextEdgeLabel = (targetElement, indicator, useBackground) => {
  targetElement.each((el) => {
    let markerBox = {
      x: el.getBBox().x,   // <-- el is the d3 DATUM (undefined), not the DOM node
      ...
```

`targetElement` comes from `selectAll('text').filter(...)`, which performs **no
data join**, so each element's datum is `undefined`. The arrow callback
`(el) => ...` receives that `undefined` datum as `el`, and `el.getBBox()` throws
`TypeError: Cannot read properties of undefined (reading 'getBBox')`.

The flow, in `src/DiagramController.tsx`:

- Line 152 `mermaidAPI.render(...)` renders the sequence SVG **successfully**.
- Line 165 `updateDiagramStyle(...)` throws (the `getBBox` error above).
- Line 167 `catch` replaces the rendered SVG with the error message.

So the diagram definition is valid — the failure is purely in the value-binding
step. Likely fix directions for the PR: iterate DOM nodes with
`.each(function () { const el = this; ... })` (or `.nodes()`), and add a working
sequence-actor binding path (sequence actors have no `data-id`, so a dedicated
matcher is needed to attach values to them).

## Files

- `docker-compose.yml` — Grafana `latest` with the unsigned plugin allow-listed.
- `grafana/provisioning/datasources/testdata.yaml` — TestData datasource (`uid: testdata`).
- `grafana/provisioning/dashboards/provider.yaml` — file provider.
- `grafana/provisioning/dashboards/graph-vs-sequence.json` — the two-panel dashboard.
- `grafana-diagram/` — full clone of the plugin at tag **v1.10.4** (built into `dist/`).
- `scripts/screenshot.mjs` — Playwright proof capture.
- `proof/` — screenshots + DOM evidence.

## Rebuild the plugin (if `grafana-diagram/dist` is missing)

```bash
cd grafana-diagram
npm install -g yarn@1.22.22   # Homebrew Node ships without corepack
yarn install
yarn build                    # produces dist/module.js + dist/plugin.json
```

Built and verified with Node v25.9.0 / yarn 1.22.22 (no source changes required).
