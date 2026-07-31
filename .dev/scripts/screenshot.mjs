// Reproduction proof capture for jdbranham-diagram-panel v1.10.4.
//
// Demonstrates: the SAME Grafana data (Orders=120, Payments=95, Shipping=78)
// binds onto a FLOWCHART diagram (values appear on nodes = control works)
// but does NOT bind onto a SEQUENCE diagram (bug).
//
// Produces:
//   proof/01-graph-works.png     - flowchart panel (values on nodes)
//   proof/02-sequence-broken.png - sequence panel (data fails to bind)
//   proof/03-side-by-side.png    - full dashboard
//   proof/DOM-evidence.md        - code-level corroboration
//
// Run: node scripts/screenshot.mjs   (Grafana must be up: docker compose up -d)

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROOF = resolve(ROOT, 'proof');
mkdirSync(PROOF, { recursive: true });

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const INJECTED = ['120', '95', '78'];

const PANEL = '[data-viz-panel-key]';
const HEADER = '[data-testid^="data-testid Panel header"]';
const CONTENT = '[data-testid="data-testid panel content"]';

// Browser-side helper: describe every diagram panel on the page.
function collectEvidenceInPage(injected) {
  const numbersIn = (txt) =>
    injected.filter((n) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(txt || ''));

  // Read the clean panel title from the header's data-testid attribute
  // ("data-testid Panel header <TITLE>") to avoid textContent picking up the
  // injected mermaid <style> block.
  const readTitle = (wrap) => {
    const headerEl = wrap.querySelector('[data-testid^="data-testid Panel header"]');
    const tid = headerEl?.getAttribute('data-testid') || '';
    const fromAttr = tid.replace(/^data-testid Panel header\s*/, '').trim();
    if (fromAttr) return fromAttr;
    return (wrap.querySelector('h2')?.textContent || '').trim();
  };

  const panels = [];
  const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
  for (const wrap of wraps) {
    const title = readTitle(wrap);
    const content = wrap.querySelector('[data-testid="data-testid panel content"]') || wrap;
    const svg = content.querySelector('svg');

    // The plugin's own legend is an HTML table rendered OUTSIDE the mermaid svg;
    // we deliberately scan only the svg (the diagram) for injected values so the
    // legend does not create false positives.
    const diagramValues = svg ? Array.from(svg.querySelectorAll('.diagram-value')) : [];
    const actorTexts = svg ? Array.from(svg.querySelectorAll('text.actor, .actor tspan')) : [];
    const messageTexts = svg ? Array.from(svg.querySelectorAll('text.messageText, .messageText')) : [];
    const dataIds = svg ? Array.from(svg.querySelectorAll('[data-id]')) : [];

    const contentText = (content.textContent || '').trim();
    const renderError = /Error rendering diagram/i.test(contentText);
    const errorSnippet = renderError
      ? contentText.replace(/\s+/g, ' ').match(/Error rendering diagram[^]*?(getBBox\)|definition|Error:[^]*?\))/i)?.[0]
        || contentText.replace(/\s+/g, ' ').slice(0, 200)
      : null;

    const kind = /sequence|bug/i.test(title) ? 'sequence'
      : /flowchart|control|graph/i.test(title) ? 'flowchart'
        : (svg && svg.querySelector('text.actor, .actor')) ? 'sequence' : 'flowchart';

    panels.push({
      title,
      kind,
      svgPresent: !!svg,
      renderError,
      errorSnippet,
      diagramValueCount: diagramValues.length,
      diagramValueSamples: diagramValues.slice(0, 8).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      actorTextCount: actorTexts.length,
      actorSamples: actorTexts.slice(0, 8).map((e) => e.textContent.trim()),
      messageTextCount: messageTexts.length,
      messageSamples: messageTexts.slice(0, 8).map((e) => e.textContent.trim()),
      nodeDataIdCount: dataIds.length,
      nodeDataIds: dataIds.slice(0, 10).map((e) => e.getAttribute('data-id')),
      injectedNumbersInSvg: svg ? numbersIn(svg.textContent) : [],
    });
  }
  return panels;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('Navigating to', DASH);
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Both panels present.
  await page.waitForFunction(
    (h) => document.querySelectorAll(h).length >= 2,
    HEADER,
    { timeout: 45000 }
  );

  // Wait (bounded) for the flowchart control to inject its values AND for the
  // sequence panel to settle (either an svg or its render error).
  for (let i = 0; i < 60; i++) {
    const state = await page.evaluate((sel) => {
      const wraps = Array.from(document.querySelectorAll(sel.PANEL));
      let boundValues = 0, sequenceSettled = false;
      for (const w of wraps) {
        const c = w.querySelector(sel.CONTENT) || w;
        const svg = c.querySelector('svg');
        if (svg) boundValues += svg.querySelectorAll('.diagram-value').length;
        if (/Error rendering diagram/i.test(c.textContent || '')) sequenceSettled = true;
        if (svg && svg.querySelector('text.actor, .actor')) sequenceSettled = true;
      }
      return { boundValues, sequenceSettled };
    }, { PANEL, CONTENT });
    if (state.boundValues > 0 && state.sequenceSettled) break;
    await sleep(500);
  }
  await sleep(1500); // settle layout/animation

  const panels = await page.evaluate(collectEvidenceInPage, INJECTED);

  // Screenshot each panel wrapper individually, matched by title.
  const wraps = await page.$$(PANEL);
  const tagged = [];
  for (const w of wraps) {
    const title = await w.evaluate((el, h) => {
      const headerEl = el.querySelector(h);
      const tid = headerEl?.getAttribute('data-testid') || '';
      const fromAttr = tid.replace(/^data-testid Panel header\s*/, '').trim();
      return fromAttr || (el.querySelector('h2')?.textContent || '').trim();
    }, HEADER);
    tagged.push({ w, title });
  }
  const flow = tagged.find((t) => /flowchart|control|graph/i.test(t.title));
  const seq = tagged.find((t) => /sequence|bug/i.test(t.title));

  if (flow) await flow.w.screenshot({ path: resolve(PROOF, '01-graph-works.png') });
  if (seq) await seq.w.screenshot({ path: resolve(PROOF, '02-sequence-broken.png') });
  await page.screenshot({ path: resolve(PROOF, '03-side-by-side.png'), fullPage: false });

  // Analyse.
  const flowP = panels.find((p) => p.kind === 'flowchart');
  const seqP = panels.find((p) => p.kind === 'sequence');
  const controlWorks = !!flowP && flowP.diagramValueCount > 0 && flowP.injectedNumbersInSvg.length === 3;
  const sequenceNoBinding = !!seqP && seqP.diagramValueCount === 0 && seqP.injectedNumbersInSvg.length === 0;

  // Build DOM evidence markdown.
  const md = [];
  md.push('# DOM Evidence - jdbranham-diagram-panel v1.10.4 data-binding bug');
  md.push('');
  md.push('Captured by `scripts/screenshot.mjs` against the live Grafana instance.');
  md.push('Both panels receive the **identical** three TestData series:');
  md.push('`Orders=120`, `Payments=95`, `Shipping=78` (reducer `last`).');
  md.push('The only difference between the two panels is the Mermaid diagram type.');
  md.push('');
  md.push('## How the plugin binds values (source)');
  md.push('');
  md.push('`updateDiagramStyle()` (`src/visualizers/updateDiagramStyle.ts`) matches each series to a');
  md.push('diagram element by trying, in order: `[data-id="<series>"]` (flowchart nodes),');
  md.push('a `<span>` edge label, a `<div>` alias, then `<text>` alias matches. Flowchart nodes carry');
  md.push('a `data-id`, so the first strategy hits and a `.diagram-value` is injected into the node.');
  md.push('');
  md.push('## Result summary');
  md.push('');
  md.push(`- CONTROL (flowchart) binds values (nodes show 120/95/78): **${controlWorks ? 'YES - works' : 'NO'}**`);
  md.push(`- BUG (sequence) binds NO values with the same data: **${sequenceNoBinding ? 'YES - bug reproduced' : 'NO'}**`);
  md.push(`- Reproduction valid: **${controlWorks && sequenceNoBinding ? 'YES' : 'NO'}**`);
  md.push('');
  for (const p of panels) {
    md.push(`## Panel: ${p.title || '(untitled)'}  [kind: ${p.kind}]`);
    md.push('');
    md.push('| metric | value |');
    md.push('| --- | --- |');
    md.push(`| diagram svg rendered | ${p.svgPresent} |`);
    md.push(`| render error shown | ${p.renderError} |`);
    if (p.errorSnippet) md.push(`| error text | \`${p.errorSnippet.replace(/\|/g, '\\|')}\` |`);
    md.push(`| \`.diagram-value\` count (injected values in diagram) | **${p.diagramValueCount}** |`);
    md.push(`| \`.diagram-value\` samples | ${JSON.stringify(p.diagramValueSamples)} |`);
    md.push(`| elements with \`[data-id]\` in svg | ${p.nodeDataIdCount} |`);
    md.push(`| \`[data-id]\` values | ${JSON.stringify(p.nodeDataIds)} |`);
    md.push(`| \`text.actor\` count | ${p.actorTextCount} |`);
    md.push(`| actor samples | ${JSON.stringify(p.actorSamples)} |`);
    md.push(`| \`text.messageText\` count | ${p.messageTextCount} |`);
    md.push(`| message samples | ${JSON.stringify(p.messageSamples)} |`);
    md.push(`| injected numbers (120/95/78) present in diagram svg | ${JSON.stringify(p.injectedNumbersInSvg)} |`);
    md.push('');
  }
  md.push('## Interpretation');
  md.push('');
  if (flowP) {
    md.push(`- **Flowchart (control):** injected **${flowP.diagramValueCount}** \`.diagram-value\`` +
      ` element(s); the diagram svg contains ${JSON.stringify(flowP.injectedNumbersInSvg)}.` +
      ' Grafana data binds onto flowchart nodes (matched via `[data-id]`). Control works.');
  }
  if (seqP) {
    if (seqP.renderError) {
      md.push(`- **Sequence (bug):** the same data injected **${seqP.diagramValueCount}** \`.diagram-value\`` +
        ` element(s) and the diagram svg contains ${JSON.stringify(seqP.injectedNumbersInSvg)} of the values.`);
      md.push(`  Mermaid successfully renders the sequence diagram at \`DiagramController.tsx:152\`, but the` +
        ' subsequent binding call `updateDiagramStyle()` (line 165) throws:');
      md.push(`  \`${(seqP.errorSnippet || '').replace(/\|/g, '\\|')}\``);
      md.push('  The series name (e.g. "Orders") matches a sequence actor `<text>` via `selectTextElementByAlias`');
      md.push('  (strategy 4), which calls `styleTextEdgeLabel`. There, `targetElement.each((el) => el.getBBox())`');
      md.push('  reads `el` as the d3 **datum** (undefined for these mermaid nodes) instead of the DOM node,');
      md.push('  so `el.getBBox()` throws. The catch at `DiagramController.tsx:167` then replaces the rendered');
      md.push('  sequence diagram with the error text. Net effect: **the data never binds onto the sequence diagram.**');
    } else {
      md.push(`- **Sequence (bug):** the same data injected **${seqP.diagramValueCount}** \`.diagram-value\`` +
        ` element(s); injected numbers found in the diagram svg: ${JSON.stringify(seqP.injectedNumbersInSvg)}.` +
        ' The actors render but the series values do not attach.');
    }
  }
  md.push('');
  if (consoleErrors.length) {
    md.push('## Browser console errors observed');
    md.push('');
    md.push('```');
    consoleErrors.slice(0, 40).forEach((e) => md.push(e));
    md.push('```');
  } else {
    md.push('_No browser console errors were observed during capture (the plugin catches the ' +
      'binding error internally and renders it into the panel)._');
  }
  md.push('');
  writeFileSync(resolve(PROOF, 'DOM-evidence.md'), md.join('\n'));

  // Console summary.
  console.log('\n================ REPRODUCTION SUMMARY ================');
  console.log('Grafana:', BASE);
  console.log('Panels detected:', panels.map((p) => `${p.title} [${p.kind}]`));
  console.log('Flowchart: .diagram-value=', flowP?.diagramValueCount, 'numbers in svg=', flowP?.injectedNumbersInSvg, 'error=', flowP?.renderError);
  console.log('Sequence : .diagram-value=', seqP?.diagramValueCount, 'numbers in svg=', seqP?.injectedNumbersInSvg, 'error=', seqP?.renderError);
  if (seqP?.errorSnippet) console.log('Sequence error:', seqP.errorSnippet);
  console.log('CONTROL flowchart shows values :', controlWorks ? 'YES' : 'NO');
  console.log('BUG     sequence binds nothing :', sequenceNoBinding ? 'YES' : 'NO');
  console.log('Console errors                :', consoleErrors.length);
  console.log('Overall reproduction valid    :', controlWorks && sequenceNoBinding ? 'YES' : 'NO');
  console.log('=====================================================\n');

  await browser.close();
  process.exit(controlWorks && sequenceNoBinding ? 0 : 2);
})().catch((e) => {
  console.error('SCRIPT ERROR:', e);
  process.exit(1);
});
