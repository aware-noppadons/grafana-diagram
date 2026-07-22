# Change Log

All notable changes to this project will be documented in this file.

## Unreleased

### Fixed
- Data now binds onto **sequence diagrams**. Matching a series to an actor or message no longer crashes the panel (`TypeError: ... reading 'getBBox'`) and no longer requires a threshold color to display the value.
- Concurrent mermaid renders (on mount and on data refresh) could corrupt the diagram and attach a value to the wrong element. Each render now uses a unique id and only the most recent render is applied.
- The **table legend header row** (column names) is no longer hidden on newer Grafana (verified on 13.1.0). Grafana's `VizLegend` only renders the header when the legend is sortable, so the legend now sets `isSortable`; the `Name`/stat column headers show again (they already did on 12.3.1).

### Changed
- Sequence values are styled to match flowchart values: an actor's whole label is threshold-colored with the value centered beneath the name, while a message keeps its label above the arrow and places the value below it.
- Diagram element matching for text-based diagrams (e.g. sequence) is now **exact only**; the previous substring/partial matching was removed so values no longer bind to unintended elements.
- Upgraded **mermaid 10.8.0 → 11.16.0** (`mermaidAPI.render` → `mermaid.render`). Binding was adapted to v11's restructured DOM: node matching is restricted to `.node` (v11 gives sequence lifelines a `data-id` that had hijacked actor binding) and the edge-label matcher to `.edgeLabel` (v11 dropped node `data-id` and renders node labels as `<span class="nodeLabel">`, which were being styled as edges).

### Added
- Legend panel options: **Placement** (Bottom/Right), **Mode** (Table/List) and **Values** (which stats to show as columns). Placement now updates live without a panel reload.
- First unit tests for the data-binding/styling logic (`updateDiagramStyle`).

## v1.0.0

Initial Release
