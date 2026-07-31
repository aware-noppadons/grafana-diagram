# `.dev/` — repro harness and working notes (vendored)

Development-only material, kept in the repo so the notes and the evidence behind each fix travel
with the code. **Nothing here ships**: the plugin build's copy step is scoped to `src/`, so this
folder is not bundled into `dist/` (verified — no `.dev` asset reaches `dist`).

## What's here

| Path | What it is |
| --- | --- |
| `RESUME-mermaid11.md` | Current state of both lines (mermaid 10 on `master`, mermaid 11 on `wip/mermaid11-rework`), branch layout, the fork-first policy, open decisions, and the deliberate non-fix for Grafana "Actions" |
| `REPRO.md` | How the original sequence-diagram binding bug was reproduced |
| `docker-compose.yml`, `grafana/` | Two Grafana instances (12.3.1 on `:3000` via compose; 13.1.0 on `:3001` is created ad hoc, **not** in compose) plus provisioned datasource and repro dashboard |
| `scripts/*.mjs` | Playwright probes used for live verification — edge/label colour, legend, sequence and flowchart binding, screenshots. All honour `GRAFANA_URL` |
| `proof/` | Screenshots backing each fix, across both Grafana versions and both mermaid versions |
| `docs/` | Design spec for the sequence data-binding work |

## Note on where these actually run

The live working copies sit in the **parent workspace directory** (one level above this repo), which
is where `docker-compose` mounts `./grafana-diagram/dist` and where `node_modules` (Playwright) is
installed. The copies here are the versioned reference; if you change one, copy it across.

Verification chain used before claiming anything works:

```
yarn typecheck && yarn lint && yarn test:ci && yarn build
docker restart grafana-diagram-repro grafana-diagram-repro-13
GRAFANA_URL=http://localhost:3001 node scripts/<probe>.mjs   # run from the parent workspace dir
```
