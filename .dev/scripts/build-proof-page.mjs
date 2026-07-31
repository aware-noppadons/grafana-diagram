// Generates a self-contained before/after proof page (screenshots embedded as
// data URIs) for the jdbranham-diagram-panel sequence-diagram fix.
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROOF = resolve(ROOT, 'proof');
const OUT = process.env.OUT || resolve(PROOF, 'proof-page.html');

const dataUri = (file) =>
  'data:image/png;base64,' + readFileSync(resolve(PROOF, file)).toString('base64');

const img03 = dataUri('03-side-by-side.png');
const img01 = dataUri('after-01-sequence-fixed.png');
const img02 = dataUri('after-02-legend-right.png');

const html = `<title>Sequence diagrams now bind data — jdbranham-diagram-panel</title>
<style>
  *{box-sizing:border-box}
  :root{
    --bg:#f6f7f9;--surface:#ffffff;--surface-2:#eef1f6;--ink:#14161c;--muted:#5b6274;
    --border:#e4e7ee;--accent:#4d68ff;--danger:#cf3b47;--success:#1c9c62;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --maxw:980px;
  }
  @media (prefers-color-scheme:dark){
    :root{--bg:#0b0d12;--surface:#14171e;--surface-2:#1a1e27;--ink:#e7eaf1;--muted:#98a0b2;
      --border:#262b37;--accent:#8098ff;--danger:#ff6b73;--success:#44c78a;}
  }
  :root[data-theme="dark"]{--bg:#0b0d12;--surface:#14171e;--surface-2:#1a1e27;--ink:#e7eaf1;
    --muted:#98a0b2;--border:#262b37;--accent:#8098ff;--danger:#ff6b73;--success:#44c78a;}
  :root[data-theme="light"]{--bg:#f6f7f9;--surface:#ffffff;--surface-2:#eef1f6;--ink:#14161c;
    --muted:#5b6274;--border:#e4e7ee;--accent:#4d68ff;--danger:#cf3b47;--success:#1c9c62;}

  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.62;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:clamp(1.6rem,5vw,4rem) clamp(1.1rem,4vw,2rem);}
  .eyebrow{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
    color:var(--accent);margin:0 0 .55rem;}
  h1{font-size:clamp(1.95rem,4.6vw,2.75rem);line-height:1.07;letter-spacing:-.02em;font-weight:750;
    text-wrap:balance;margin:0 0 .7rem;}
  .lede{font-size:1.06rem;color:var(--muted);max-width:60ch;margin:0 0 1.6rem;}
  .chips{display:flex;flex-wrap:wrap;gap:.5rem;}
  .chip{display:inline-flex;align-items:center;gap:.45rem;font-family:var(--mono);font-size:.75rem;
    background:var(--surface-2);border:1px solid var(--border);border-radius:999px;
    padding:.32rem .72rem .32rem .6rem;color:var(--ink);}
  .dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--success);flex:0 0 auto;}
  .dot.bad{background:var(--danger);}
  section{margin-top:clamp(2.3rem,6vw,3.5rem);}
  h2{font-size:1.42rem;letter-spacing:-.01em;font-weight:700;margin:.1rem 0 .5rem;text-wrap:balance;}
  p{margin:0 0 1rem;max-width:64ch;}
  figure{margin:1.15rem 0 0;}
  .shot{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface-2);
    box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 34px rgba(0,0,0,.07);}
  .shot img{display:block;width:100%;height:auto;}
  figcaption{font-family:var(--mono);font-size:.76rem;color:var(--muted);margin-top:.6rem;}
  .callout{display:flex;flex-direction:column;gap:.5rem;border:1px solid var(--border);
    border-left:3px solid var(--danger);background:var(--surface-2);border-radius:10px;
    padding:1rem 1.1rem;margin:1.15rem 0 0;}
  .callout>code{font-family:var(--mono);font-size:.82rem;color:var(--danger);word-break:break-word;}
  .callout p{margin:0;color:var(--ink);font-size:.95rem;max-width:none;}
  .callout p code{font-family:var(--mono);font-size:.86em;background:var(--bg);border:1px solid var(--border);
    border-radius:4px;padding:.05em .3em;}
  .changes{list-style:none;padding:0;margin:1rem 0 0;display:flex;flex-direction:column;gap:.7rem;}
  .changes li{display:flex;gap:.6rem;align-items:baseline;max-width:64ch;}
  .changes li::before{content:"\\2713";color:var(--success);font-weight:800;flex:0 0 auto;}
  .changes code{font-family:var(--mono);font-size:.86em;background:var(--surface-2);
    border:1px solid var(--border);border-radius:4px;padding:.05em .3em;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-top:1rem;}
  .tile{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;}
  .tile .k{font-family:var(--mono);font-size:.72rem;color:var(--muted);text-transform:uppercase;
    letter-spacing:.09em;}
  .tile .v{display:flex;align-items:center;gap:.45rem;font-weight:650;margin-top:.3rem;}
  .check{color:var(--success);font-weight:800;}
  .diffstat{font-family:var(--mono);font-size:.82rem;color:var(--muted);margin-top:1rem;}
  footer{margin-top:clamp(2.4rem,6vw,3.6rem);padding-top:1.3rem;border-top:1px solid var(--border);
    color:var(--muted);font-size:.9rem;line-height:1.7;}
  footer .branch{font-family:var(--mono);color:var(--ink);}
</style>
<main class="wrap">
  <p class="eyebrow">jdbranham-diagram-panel · fix proof</p>
  <h1>Sequence diagrams now bind data</h1>
  <p class="lede">The same Grafana series that render on a flowchart used to crash a sequence diagram. Here is the bug, the one-line root cause, and the fix — verified live in Grafana 12.3.1.</p>
  <div class="chips">
    <span class="chip"><span class="dot bad"></span>Bug reproduced</span>
    <span class="chip"><span class="dot"></span>Crash fixed</span>
    <span class="chip"><span class="dot"></span>Exact-match binding</span>
    <span class="chip"><span class="dot"></span>7 tests pass</span>
    <span class="chip"><span class="dot"></span>Build green</span>
  </div>

  <section>
    <p class="eyebrow">The bug</p>
    <h2>Same data, opposite outcomes</h2>
    <p>Three TestData series — Orders 120, Payments 95, Shipping 78 — drive both panels. The flowchart binds them onto its nodes with threshold colors. The sequence panel, given identical data and identical names, is replaced by an error.</p>
    <figure>
      <div class="shot"><img alt="Before: flowchart binds values on its nodes; the sequence diagram shows a render error" src="${img03}"></div>
      <figcaption>Before — flowchart binds; the sequence panel throws on render.</figcaption>
    </figure>
    <div class="callout">
      <code>TypeError: Cannot read properties of undefined (reading 'getBBox')</code>
      <p>The styler iterated matched <code>&lt;text&gt;</code> nodes with <code>.each((el) =&gt; el.getBBox())</code>. In d3 that argument is the <em>datum</em> — undefined for mermaid's text nodes — not the DOM node, so <code>getBBox()</code> threw and the catch replaced the whole diagram.</p>
    </div>
  </section>

  <section>
    <p class="eyebrow">The fix</p>
    <h2>Bind onto the actor, style like the graph</h2>
    <figure>
      <div class="shot"><img alt="After: the sequence actors carry the same threshold-colored values with no error" src="${img01}"></div>
      <figcaption>After — actors and messages carry the same values, styled like the graph, no error.</figcaption>
    </figure>
    <ul class="changes">
      <li>Iterate DOM nodes correctly (the crash is gone) and always insert the value — it used to require a threshold color.</li>
      <li>Style values like the graph: an actor's whole label is threshold-colored with the value centered below the name; a connection keeps its label above the line with the value below it.</li>
      <li>Actors <em>and</em> messages/edges bind data — <code>charge 42</code>, <code>fulfil 17</code>.</li>
      <li>Exact matching only — the substring matcher is removed, so “Orders” no longer binds “Orders total”.</li>
      <li>Concurrent renders are made safe (unique id + last-render-wins) so a value can't attach to the wrong element.</li>
    </ul>
  </section>

  <section>
    <p class="eyebrow">Legend</p>
    <h2>Placement, back in the editor</h2>
    <p>Placement, display mode and value columns were editable only via raw dashboard JSON. They are panel-editor controls again — and placement re-lays-out live.</p>
    <figure>
      <div class="shot"><img alt="Flowchart legend positioned on the right, sequence legend on the bottom, in the same dashboard" src="${img02}"></div>
      <figcaption>Flowchart legend on the right, sequence on the bottom — same dashboard, sortable table header intact.</figcaption>
    </figure>
  </section>

  <section>
    <p class="eyebrow">Verification</p>
    <h2>Green across the board</h2>
    <div class="grid">
      <div class="tile"><div class="k">typecheck</div><div class="v"><span class="check">&#10003;</span> tsc clean</div></div>
      <div class="tile"><div class="k">lint</div><div class="v"><span class="check">&#10003;</span> 0 errors</div></div>
      <div class="tile"><div class="k">tests</div><div class="v"><span class="check">&#10003;</span> 7 pass · 6 new</div></div>
      <div class="tile"><div class="k">build</div><div class="v"><span class="check">&#10003;</span> webpack ok</div></div>
    </div>
    <p class="diffstat">6 files · +172 / −80 — net simpler: two broken stylers collapsed into one.</p>
  </section>

  <footer>
    Scoped to the pinned mermaid 10.8.0; a v11 upgrade can follow separately. Removing substring matching is a behavior change — dashboards must use exact series names.<br>
    Branch <span class="branch">fix/sequence-diagram-data-binding</span> · verified in Grafana 12.3.1.
  </footer>
</main>`;

writeFileSync(OUT, html);
console.log('wrote', OUT, '(' + Math.round(html.length / 1024) + ' KiB)');
