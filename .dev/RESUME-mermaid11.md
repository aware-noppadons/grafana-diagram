# Resume: mermaid 11 line (`wip/mermaid11-rework`) — fork-first

## Status: COMPLETE + PUSHED (data-link hyperlinks merged in 2026-07-31)

Fork-first policy (2026-07-31): the fork `aware-noppadons` is the source of truth. Divergence from
jdbranham's `master` is **not** a concern and must not gate our branches. Upstream is dormant
(`origin/master` = `9f14362`, last pushed 2024-04-19; PR #264 OPEN, 0 reviews/0 comments,
MERGEABLE but BLOCKED on REVIEW_REQUIRED, no CI configured).

## Branches on the fork (after cleanup)

- `master` @ `b5cbeae` — **mermaid 10 line**: PR #264's 6 commits + the 4 data-link-hyperlink
  commits. Fast-forwarded from `9f14362`. Local `master` tracks `fork/master` (retargeted from
  `origin/master` so a bare push cannot reach upstream).
- `wip/mermaid11-rework` @ `29e5676` — **mermaid 11 line**: same content plus
  `e605e1a` (mermaid 10.8.0 → 11.16.0 compatibility) and the v11 test guards. This is the
  forward-looking branch.
- `fix/sequence-diagram-data-binding` @ `e724f81` — PR #264's head. Keep as long as the PR is
  open; deleting it closes the PR.
- Deleted 2026-07-31: `feat/data-link-hyperlinks` (merged into wip), `feat/data-link-hyperlinks-mermaid10`
  (merged into master). Earlier: `fix/sequence-and-legend`, `fix/legend-table-header`.

## What the two lines contain

Sequence data-binding fix (getBBox crash, exact matching) · legend placement/mode/value options ·
concurrent-render guard · Grafana-13 legend-header fix (`isSortable`) · connection-label color fix
(whole label, both text and background modes) · **data-link hyperlinks** · **XSS fix** (node labels
built as text nodes instead of `innerHTML`). The mermaid 11 line adds `mermaid.render`,
`selectElementById` → `.node`, `selectElementByEdgeLabel` → `span.edgeLabel`.

Data-link hyperlinks: a series' Grafana data link makes its diagram elements clickable (flowchart
nodes + edge labels, sequence actors + message labels) and its legend row follow the same link.
`FieldConfigProperty.Links` had to be removed from `disableStandardOptions` (Grafana was stripping
`links` before the panel saw them). mermaid stays at `securityLevel: 'strict'` — the panel emits its
own sanitized anchors (http/https/mailto/relative only). Url interpolations are documented in the
README (`${__field.name}` = series name is the useful one; `${__value.time}` is empty by design).

## Verified 2026-07-31 (wip @ 29e5676, mermaid 11.16.0)

typecheck clean · lint 0 errors (2 pre-existing `stylesFactory` deprecation warnings) · 34 tests ·
build ok. Live on Grafana 12.3.1 (:3000) and 13.1.0 (:3001): 13 anchors per dashboard; all five
clickable surfaces (actor, message label, node, edge label, legend row) honor *Open in new tab*, and
a link with the box off opens in the same tab. Proof: `proof/after11-datalinks-300{0,1}.png`
(mermaid 10 equivalents: `proof/after-datalinks-300{0,1}.png`).

## Deliberate non-fix: Actions

Grafana's `actions` field-config property appears in this panel's `Data links and actions` editor
section but the panel ignores it (verified: an action override renders no button and does nothing;
the series' data link still works). **Decision 2026-07-31: leave it visible as a reminder** — do NOT
add `actions` to `disableStandardOptions`. If implemented later: feature-detect the host's
`getActions`/`ActionButton` (Grafana >= 11.3 only; pinned `@grafana/data` 9.0.9 has no Actions
member) so the host's confirmation and POST-url allowlist still apply — never a hand-rolled fetch —
and trigger from a small separate badge, never the shape itself. The `/d/link-newtab` dashboard on
:3001 carries a live example: a `Shipping` action override that does nothing.

## TODO / next steps

1. **Version/release** — see below. User's call; explicitly deferred 2026-07-31 ("leave the VERSION
   untouched for now").
2. **Keep `.dev/` in sync.** These notes, `scripts/`, `grafana/` and `proof/` exist twice: the live
   copies at the workspace root (what Docker mounts and Playwright runs) and the vendored snapshot in
   the plugin repo under `.dev/`. Editing a live copy leaves `.dev/` stale — copy across and commit.
   The workspace root is deliberately **not** a git repo (a throwaway one was created and removed on
   2026-07-31 once the vendoring decision was made), so the plugin repo is the only history.
3. **Optional, deliberately not done:** hide the dead `actions` field option (see below), port the
   hyperlinks to `fix/sequence-diagram-data-binding` / PR #264, or open the standalone mermaid-11
   upstream PR. All three need sign-off; none is blocking.

## Open decision: release/versioning

`package.json` + `VERSION` are still `1.10.4` and the CHANGELOG's entries all sit under
`## Unreleased`; `plugin.json` uses the `%VERSION%` placeholder filled at build time. Under
fork-first, deciding a version (e.g. 1.11.0 for the feature) and cutting a release/tag is a
judgement call awaiting sign-off. Nothing else is outstanding.

## Env / how to verify

- Restart: `docker restart grafana-diagram-repro grafana-diagram-repro-13` (:3000 = 12.3.1 compose;
  :3001 = 13.1.0, ad hoc, NOT in compose).
- Test dashboards: `/d/link-newtab` (clean, mixed new-tab/same-tab links — use this one) and
  `/d/link-probe` (hand-edited on :3001, sequence link has the box OFF — do not judge new-tab
  behavior from it).
- Scripts at workspace root honor `GRAFANA_URL`: `inspect-edge-color.mjs`, `screenshot-after.mjs`,
  `inspect-legend.mjs`, `inspect-flowchart.mjs`, `inspect-sequence.mjs`. NOTE: running these leaves
  bash cwd at the workspace root — use `git -C grafana-diagram ...` afterwards.
- CI: `yarn --cwd grafana-diagram typecheck && lint && test:ci && build`.
- Switch line: `git checkout <branch> && yarn --cwd grafana-diagram install && yarn --cwd
  grafana-diagram build`, then restart containers (install pins mermaid 10.8.0 on `master`, 11.16.0
  on `wip/mermaid11-rework`). Currently on `wip`, node_modules = mermaid 11.16.0.
