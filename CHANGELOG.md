# Change Log

All notable changes to this project will be documented in this file.

## Unreleased

### Fixed
- Data now binds onto **sequence diagrams**. Matching a series to an actor or message no longer crashes the panel (`TypeError: ... reading 'getBBox'`) and no longer requires a threshold color to display the value.
- Concurrent mermaid renders (on mount and on data refresh) could corrupt the diagram and attach a value to the wrong element. Each render now uses a unique id and only the most recent render is applied.
- The **table legend header row** (column names) is no longer hidden on newer Grafana (verified on 13.1.0). Grafana's `VizLegend` only renders the header when the legend is sortable, so the legend now sets `isSortable`; the `Name`/stat column headers show again (they already did on 12.3.1).
- **Connection labels** now take the threshold color across the whole label, not just the appended value: flowchart **edge** labels and sequence **message** labels are colored to match their value, like nodes and actors already do (both text-color and background modes).

### Changed
- Sequence values are styled to match flowchart values: the value is placed with the label — centered beneath an actor's name, and below a message's label above the arrow.
- Diagram element matching for text-based diagrams (e.g. sequence) is now **exact only**; the previous substring/partial matching was removed so values no longer bind to unintended elements.

### Added
- Legend panel options: **Placement** (Bottom/Right), **Mode** (Table/List) and **Values** (which stats to show as columns). Placement now updates live without a panel reload.
- First unit tests for the data-binding/styling logic (`updateDiagramStyle`).
- **Hyperlinks from Data links.** A series' Grafana data link (`Field` tab or a by-name `Override`) now makes every diagram element bound to that series clickable — flowchart nodes and edge labels, sequence actors and message labels — and follows the same link from the series' legend row. Url interpolation (variables, `${__value.numeric}`) and *Open in new tab* are honored; `target=_blank` links get `rel="noopener noreferrer"`. Only `http(s)`/`mailto`/relative urls are linkified.
  - The standard **Data links** field option was previously disabled by the panel, so Grafana stripped data links from the field config before the panel received them and `Overrides -> Data links` silently did nothing. It is enabled again.

### Security
- Node labels are no longer rebuilt through `innerHTML`. The label text (which can come from a remote diagram definition or a dashboard variable) and the formatted value (which comes from the datasource) were re-parsed as markup, so e.g. a value of `<img src=x onerror=...>` executed. Both are now written as text nodes.

## v1.0.0

Initial Release
