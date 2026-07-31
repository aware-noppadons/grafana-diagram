# DOM Evidence - jdbranham-diagram-panel v1.10.4 data-binding bug

Captured by `scripts/screenshot.mjs` against the live Grafana instance.
Both panels receive the **identical** three TestData series:
`Orders=120`, `Payments=95`, `Shipping=78` (reducer `last`).
The only difference between the two panels is the Mermaid diagram type.

## How the plugin binds values (source)

`updateDiagramStyle()` (`src/visualizers/updateDiagramStyle.ts`) matches each series to a
diagram element by trying, in order: `[data-id="<series>"]` (flowchart nodes),
a `<span>` edge label, a `<div>` alias, then `<text>` alias matches. Flowchart nodes carry
a `data-id`, so the first strategy hits and a `.diagram-value` is injected into the node.

## Result summary

- CONTROL (flowchart) binds values (nodes show 120/95/78): **YES - works**
- BUG (sequence) binds NO values with the same data: **YES - bug reproduced**
- Reproduction valid: **YES**

## Panel: Flowchart (CONTROL) - SAME data binds onto nodes (120/95/78)  [kind: flowchart]

| metric | value |
| --- | --- |
| diagram svg rendered | true |
| render error shown | false |
| `.diagram-value` count (injected values in diagram) | **3** |
| `.diagram-value` samples | ["Orders 120","Payments 95","Shipping 78"] |
| elements with `[data-id]` in svg | 3 |
| `[data-id]` values | ["Orders","Payments","Shipping"] |
| `text.actor` count | 0 |
| actor samples | [] |
| `text.messageText` count | 0 |
| message samples | [] |
| injected numbers (120/95/78) present in diagram svg | ["120","95","78"] |

## Panel: Sequence (BUG) - SAME data does NOT bind (render error)  [kind: sequence]

| metric | value |
| --- | --- |
| diagram svg rendered | true |
| render error shown | true |
| error text | `Error rendering diagram. Check the diagram definition` |
| `.diagram-value` count (injected values in diagram) | **0** |
| `.diagram-value` samples | [] |
| elements with `[data-id]` in svg | 0 |
| `[data-id]` values | [] |
| `text.actor` count | 0 |
| actor samples | [] |
| `text.messageText` count | 0 |
| message samples | [] |
| injected numbers (120/95/78) present in diagram svg | [] |

## Interpretation

- **Flowchart (control):** injected **3** `.diagram-value` element(s); the diagram svg contains ["120","95","78"]. Grafana data binds onto flowchart nodes (matched via `[data-id]`). Control works.
- **Sequence (bug):** the same data injected **0** `.diagram-value` element(s) and the diagram svg contains [] of the values.
  Mermaid successfully renders the sequence diagram at `DiagramController.tsx:152`, but the subsequent binding call `updateDiagramStyle()` (line 165) throws:
  `Error rendering diagram. Check the diagram definition`
  The series name (e.g. "Orders") matches a sequence actor `<text>` via `selectTextElementByAlias`
  (strategy 4), which calls `styleTextEdgeLabel`. There, `targetElement.each((el) => el.getBBox())`
  reads `el` as the d3 **datum** (undefined for these mermaid nodes) instead of the DOM node,
  so `el.getBBox()` throws. The catch at `DiagramController.tsx:167` then replaces the rendered
  sequence diagram with the error text. Net effect: **the data never binds onto the sequence diagram.**

_No browser console errors were observed during capture (the plugin catches the binding error internally and renders it into the panel)._
