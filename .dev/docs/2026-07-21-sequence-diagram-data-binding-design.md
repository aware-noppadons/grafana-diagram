# Design: Fix sequence-diagram data binding in jdbranham-diagram-panel

- **Date:** 2026-07-21
- **Status:** Approved (pending spec review)
- **Target repo:** https://github.com/jdbranham/grafana-diagram (panel plugin `jdbranham-diagram-panel`)
- **Base version:** v1.10.4 (`master`), mermaid 10.8.0
- **Deliverable:** one focused PR to upstream, prepared locally and paused for user sign-off before push.

## 1. Problem

Grafana data binds correctly onto **flowchart/graph** diagrams (a node shows its metric value + threshold color) but **not** onto **sequence** diagrams. Verified live in Grafana 12.3.1 with the unmodified v1.10.4 plugin (see `proof/`):

- Flowchart panel: 3 series (`Orders=120`, `Payments=95`, `Shipping=78`) render on the nodes with threshold color. DOM: 3 `.diagram-value` elements injected.
- Sequence panel: the **same** series/names produce **`Error rendering diagram. Check the diagram definition — TypeError: Cannot read properties of undefined (reading 'getBBox')`**. DOM: 0 `.diagram-value`; the diagram is replaced by the error text.
- Both legends list `120/95/78`, proving the same data reached both panels — only the flowchart binds it.

Evidence: `proof/01-graph-works.png`, `proof/02-sequence-broken.png`, `proof/03-side-by-side.png`, `proof/DOM-evidence.md`. Reproduction: `REPRO.md` (`docker compose up -d` → http://localhost:3000/d/diagram-repro).

## 2. Root cause (`src/visualizers/updateDiagramStyle.ts`)

`processDiagramSeriesModel` (`:206`) matches each series to a diagram element by trying selectors in priority order. Mermaid sequence diagrams render actors/messages as bare `<text>`/`<tspan>` with **no `data-id`, no `<span>`, no `<div>`**, so the three flowchart matchers (`:210`,`:216`,`:222`) can never match them. That leaves two `<text>` paths:

1. `selectTextElementByAlias` — **exact** text match (`:42`) → `styleTextEdgeLabel` (`:144`). Tried first.
2. `selectTextElementContainingAlias` — **substring** match (`:50`) → `styleSequenceDiagramEdgeLabel` (`:182`).

Three defects, in order of severity:

- **A. Crash (primary).** `styleTextEdgeLabel` iterates with `targetElement.each((el) => el.getBBox())` (`:149-151`). In d3, an arrow callback's first arg is the **datum**, not the DOM node (`this` is the node). Mermaid's text nodes have no bound datum, so `el` is `undefined` → `el.getBBox()` throws → caught by `initializeMermaid`'s try/catch (`DiagramController.tsx:166`) → the whole diagram is replaced by the error. Any exact series↔actor/message match crashes the panel.
- **B. Value gated on color (secondary).** Even with A fixed, the value insertion is wrapped in `if (indicator.color)` (`:156`), so a field with no resolved threshold color inserts nothing. The flowchart stylers (`styleD3Shapes:104`, `styleFlowChartEdgeLabel:131`) always insert the value and gate only the color.
- **C. Inconsistent styling.** `styleTextEdgeLabel` injects a class-less bare `<rect>`+`<text>`. The flowchart path tags values with the `diagram-value` class (targetable by custom CSS). The substring styler `styleSequenceDiagramEdgeLabel` (`:188`) already does the right thing — appends a `diagram-value`-classed `<tspan>` and always inserts the value — but it is bound to the over-matching substring selector.

## 3. Decisions (locked with user)

| Topic | Decision | Rationale |
|---|---|---|
| Matching (idea #2) | **Exact match only.** Remove the substring matcher + `styleSequenceDiagramEdgeLabel`. | User confirmed after seeing the repro. Substring over-matches ("Orders" hits "Orders total"). |
| Renderer (idea #4) | **Keep mermaid 10.8.0.** Propose 10→11.16 as a separate follow-up PR. | Smallest, most-mergeable PR; matches what users run today. |
| PR | Prepare fork/branch/commits/body locally, **pause for user sign-off** before any push. | Outward-facing action. |
| Version bump | Do **not** bump `package.json`/`plugin.json` version in the PR. | Maintainer bumps at release; release CI hard-checks tag==version. |

## 4. Goals / Non-goals

**Goals:** (1) sequence diagrams bind data via exact name match, styled like the graph diagram (`diagram-value`, value always shown, color/useBackground consistent); (2) no crash; (3) legend placement selectable Bottom/Right in the panel editor, with the existing sortable table header preserved; (4) first real unit tests for the binding logic; (5) before/after screenshot proof.

**Non-goals:** mermaid upgrade (separate PR); series-toggle-from-legend (`isVisible` is dead today — out of scope); templating/variables (#28); ELK thread-safety (#261); redesigning the matching engine.

## 5. Detailed design

### 5.1 `src/visualizers/updateDiagramStyle.ts` — binding fix (defects A/B/C, idea #1/#2)

Replace `styleTextEdgeLabel` and `styleSequenceDiagramEdgeLabel` with a single corrected styler, and remove the substring selector.

```ts
// Sole styler for <text>-matched (sequence) elements. Always inserts the value,
// tagged .diagram-value; color is conditional. Iterates DOM nodes (fixes getBBox crash).
const styleSequenceText = (
  targetElement: Selection<any, any, any, any>,
  indicator: MetricIndicator,
  useBackground: boolean
) => {
  targetElement.each(function () {
    const textNode = this as SVGTextElement;              // 'this' is the node (was: datum → crash)
    const tspan = select(textNode)
      .append('tspan')
      .classed('diagram-value', true)                    // style parity with flowchart (defect C)
      .attr('x', textNode.getAttribute('x'))
      .attr('dy', '1.2em')                               // new line below actor/message text
      .text(formattedValueToString(indicator));          // always inserted (defect B)
    if (indicator.color) {
      if (useBackground) {
        const bbox = textNode.getBBox();                 // safe now: real DOM node
        select(textNode.parentNode as any)
          .insert('rect', () => textNode)                // behind the text
          .attr('x', bbox.x).attr('y', bbox.y)
          .attr('width', bbox.width).attr('height', bbox.height)
          .style('fill', indicator.color);
      } else {
        tspan.style('fill', indicator.color);            // SVG text color == fill, not `color`
      }
    }
  });
};
```

Dispatcher (`processDiagramSeriesModel`): keep the three flowchart branches and the exact text branch; **delete** the substring branch (`:234-238`):

```ts
targetElement = selectTextElementByAlias(container, key);   // exact only
if (!targetElement.empty()) { styleSequenceText(targetElement, indicator, options.useBackground); return; }
// (removed) selectTextElementContainingAlias / styleSequenceDiagramEdgeLabel
```

Also delete the now-unused `selectTextElementContainingAlias` (`:50-56`). Restore the diagnostic (`:240`) as a guarded `console.debug` so failed matches are observable (currently there is zero feedback on a miss).

**Mirrored actors:** `selectTextElementByAlias` returns both the top and bottom copies of an actor (mermaid `mirrorActors: true`, `diagramDefaults.ts:31`). `.each` applies the value to both — consistent and visible regardless of scroll. Accepted behavior; documented.

### 5.2 `src/module.ts` + `src/config/types.ts` — legend controls (idea #3)

Under the existing `Legend` category (after `legend.show`, `:213-219`), add editor controls (all `showIf: (o) => o.legend.show`). Import `LegendDisplayMode` from `@grafana/ui`; reuse `statSelectOptions` (`:55`).

- **Placement** — `addRadio({ path: 'legend.placement', options: [Bottom, Right] })` — the core ask.
- **Display mode** — `addRadio({ path: 'legend.displayMode', options: [Table, List] })` — Table keeps the header row.
- **Values** (secondary) — `addMultiSelect({ path: 'legend.stats', options: statSelectOptions })`, `showIf` also `displayMode === Table`. Requires wiring (see 5.3) since `legend.stats` is dead today.

No type changes needed — `LegendOptions` (`types.ts:27`) already carries all fields; only the editor UI is missing.

### 5.3 `src/DiagramController.tsx` — live placement + stats wiring

- **Live placement (bug fix, required for 5.2).** `getDerivedStateFromProps` (`:61`) computes the wrapper/placement styles only on first mount (`if (!state)`), so changing placement wouldn't re-lay-out until remount. Fix by computing the flex styles from `this.props` at **render time** (drop the mount-only state cache), so Bottom↔Right applies live. `getDiagramWithLegendStyles` already switches `flex-direction` on `legend.placement` (`:37`).
- **Stats wiring (for 5.2 Values).** In `getLegendItems` (`:204`), filter displayed stats by config:
  `getDisplayValues: () => (s.info || []).filter((dv) => this.props.options.legend.stats.includes(dv.title))`.
- **Optional polish (low risk, include if clean):** fix the `className={`…` && this.state.x}` expressions (`:224`,`:227`) that silently drop the semantic `.diagram-container`/`.diagram` classes (the `&&` returns only the right operand). Restore both class names via `cx()`.

### 5.4 Tests (TDD) — `src/visualizers/updateDiagramStyle.test.ts` (new)

The repo has **no** real tests (`module.test.ts` is a placeholder). Add the first, written test-first:

- jsdom setup: stub `SVGElement.prototype.getBBox = () => ({ x:0, y:0, width:0, height:0 })` (jsdom has no layout). This stub itself would have surfaced defect A.
- Build minimal SVG fixtures mirroring mermaid output: a flowchart node (`<g data-id="Orders"><div>Orders</div></g>`) and a sequence actor (`<text class="actor">Orders</text>`).
- Assertions:
  1. Flowchart exact match → a `.diagram-value` with the formatted value (guards existing behavior).
  2. Sequence exact match → a `.diagram-value` `<tspan>` with the value, **no throw** (regression test for defects A+B).
  3. Sequence with color → tspan `fill` set; with `useBackground` → a `rect` inserted.
  4. Non-matching name → no `.diagram-value`, no throw.
  5. Substring-but-not-exact name → **no** binding (proves exact-only; guards against substring regression).

### 5.5 CHANGELOG

Add an entry summarizing: fixed sequence-diagram data binding (crash + no-value), exact matching (substring removed), legend placement/mode/values editor controls, first unit tests.

## 6. Verification

- `yarn typecheck && yarn lint && yarn test:ci && yarn build` all green (upstream CI parity, `.github/workflows/ci.yml`).
- Rebuild `dist/`, reload the running Grafana, re-run `scripts/screenshot.mjs`:
  - `proof/after-01-sequence-fixed.png` — sequence binds `120/95/78`, styled like the graph.
  - `proof/after-02-legend-right.png` / `after-03-legend-bottom.png` — placement selector both ways.
  - Confirm flowchart still binds (no regression) and no console/render errors.

## 7. Contribution plan

1. Feature branch off `master` in the existing full clone (`grafana-diagram/`), e.g. `fix/sequence-diagram-data-binding`.
2. Commits, logically separated: (a) binding fix + tests, (b) legend controls, (c) CHANGELOG.
3. Draft PR title + body with before/after screenshots and an explicit **behavior-change note** (substring matching removed in favor of exact).
4. Ensure `gh` is authed to the user's account; create the fork.
5. **Pause. Show the user the full diff + PR body. Do not push or open the PR until approved.**

## 8. Risks & mitigations

- **Removing substring matching is a behavior change.** → Called out prominently in the PR body; exact match is what most users expect and the substring path was itself a workaround for the broken exact path.
- **tspan positioning across actor vs message text may need tuning** (actor `<text>` has a child tspan; messageText holds direct text). → Verify visually against the live repro; adjust `dy`/`x` empirically before finalizing.
- **jsdom lacks `getBBox`.** → Explicit stub; documents the DOM contract.
- **Maintainer inactivity** (sole maintainer, no CONTRIBUTING). → Deliver a clean, CI-green, tested, well-described PR to maximize merge odds; keep the follow-up mermaid upgrade separate.

## 9. Follow-ups (not in this PR)

- Mermaid 10.8.0 → 11.16.0 (rename `mermaid.mermaidAPI.render` → `mermaid.render`; re-verify sequence DOM under v11 with Playwright).
- Legend series toggle (make `isVisible`/`onLabelClick` functional).
