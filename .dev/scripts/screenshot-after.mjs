// After-fix proof capture for jdbranham-diagram-panel.
// Verifies the SAME data (Orders=120, Payments=95, Shipping=78) now binds onto
// BOTH the flowchart AND the sequence diagram, with no render error.
//
// Produces (default): proof/after-01-sequence-fixed.png + proof/DOM-evidence-after.md
// Override output name with SHOT=<file.png>.
// Run: node scripts/screenshot-after.mjs   (Grafana must be up)

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF = resolve(__dirname, '..', 'proof');
mkdirSync(PROOF, { recursive: true });

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const INJECTED = ['120', '95', '78'];
const PANEL = '[data-viz-panel-key]';
const HEADER = '[data-testid^="data-testid Panel header"]';
const CONTENT = '[data-testid="data-testid panel content"]';
const OUT = process.env.SHOT || 'after-01-sequence-fixed.png';

function collectEvidenceInPage(injected) {
  const numbersIn = (txt) => injected.filter((n) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(txt || ''));
  const readTitle = (wrap) => {
    const headerEl = wrap.querySelector('[data-testid^="data-testid Panel header"]');
    const tid = headerEl?.getAttribute('data-testid') || '';
    return tid.replace(/^data-testid Panel header\s*/, '').trim() || (wrap.querySelector('h2')?.textContent || '').trim();
  };
  const panels = [];
  for (const wrap of Array.from(document.querySelectorAll('[data-viz-panel-key]'))) {
    const title = readTitle(wrap);
    const content = wrap.querySelector('[data-testid="data-testid panel content"]') || wrap;
    const svg = content.querySelector('svg');
    const diagramValues = svg ? Array.from(svg.querySelectorAll('.diagram-value')) : [];
    const contentText = (content.textContent || '').trim();
    const renderError = /Error rendering diagram/i.test(contentText);
    const kind = /sequence|bug/i.test(title) ? 'sequence'
      : /flowchart|control|graph/i.test(title) ? 'flowchart'
        : (svg && svg.querySelector('text.actor, .actor')) ? 'sequence' : 'flowchart';
    panels.push({
      title,
      kind,
      svgPresent: !!svg,
      renderError,
      diagramValueCount: diagramValues.length,
      diagramValueSamples: diagramValues.slice(0, 8).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      injectedNumbersInSvg: svg ? numbersIn(svg.textContent) : [],
    });
  }
  return panels;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('Navigating to', DASH);
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction((h) => document.querySelectorAll(h).length >= 2, HEADER, { timeout: 45000 });

  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate((sel) => {
      let panelsWithValues = 0, anyError = false;
      for (const w of Array.from(document.querySelectorAll(sel.PANEL))) {
        const c = w.querySelector(sel.CONTENT) || w;
        const svg = c.querySelector('svg');
        if (svg && svg.querySelectorAll('.diagram-value').length > 0) panelsWithValues++;
        if (/Error rendering diagram/i.test(c.textContent || '')) anyError = true;
      }
      return { panelsWithValues, anyError };
    }, { PANEL, CONTENT });
    if (s.panelsWithValues >= 2 && !s.anyError) break;
    await sleep(500);
  }
  await sleep(1500);

  const panels = await page.evaluate(collectEvidenceInPage, INJECTED);
  await page.screenshot({ path: resolve(PROOF, OUT), fullPage: false });

  const flowP = panels.find((p) => p.kind === 'flowchart');
  const seqP = panels.find((p) => p.kind === 'sequence');
  const flowOk = !!flowP && flowP.diagramValueCount > 0 && flowP.injectedNumbersInSvg.length === 3;
  const seqFixed = !!seqP && seqP.diagramValueCount > 0 && !seqP.renderError && seqP.injectedNumbersInSvg.length === 3;

  const md = [];
  md.push('# DOM Evidence (AFTER FIX) - jdbranham-diagram-panel');
  md.push('');
  md.push('Same three TestData series (`Orders=120`, `Payments=95`, `Shipping=78`) on both panels.');
  md.push('');
  md.push(`- CONTROL flowchart still binds values: **${flowOk ? 'YES' : 'NO'}**`);
  md.push(`- SEQUENCE now binds values (no render error): **${seqFixed ? 'YES - fixed' : 'NO'}**`);
  md.push('');
  for (const p of panels) {
    md.push(`## Panel: ${p.title || '(untitled)'}  [kind: ${p.kind}]`);
    md.push('');
    md.push('| metric | value |');
    md.push('| --- | --- |');
    md.push(`| diagram svg rendered | ${p.svgPresent} |`);
    md.push(`| render error shown | ${p.renderError} |`);
    md.push(`| \`.diagram-value\` count | **${p.diagramValueCount}** |`);
    md.push(`| \`.diagram-value\` samples | ${JSON.stringify(p.diagramValueSamples)} |`);
    md.push(`| injected numbers (120/95/78) in diagram svg | ${JSON.stringify(p.injectedNumbersInSvg)} |`);
    md.push('');
  }
  if (consoleErrors.length) {
    md.push('## Browser console errors'); md.push(''); md.push('```');
    consoleErrors.slice(0, 40).forEach((e) => md.push(e)); md.push('```');
  } else {
    md.push('_No browser console errors observed._');
  }
  md.push('');
  writeFileSync(resolve(PROOF, 'DOM-evidence-after.md'), md.join('\n'));

  console.log('\n================ AFTER-FIX SUMMARY ================');
  console.log('Flowchart: .diagram-value=', flowP?.diagramValueCount, 'numbers=', flowP?.injectedNumbersInSvg, 'error=', flowP?.renderError);
  console.log('Sequence : .diagram-value=', seqP?.diagramValueCount, 'numbers=', seqP?.injectedNumbersInSvg, 'error=', seqP?.renderError);
  console.log('CONTROL flowchart binds :', flowOk ? 'YES' : 'NO');
  console.log('SEQUENCE now binds      :', seqFixed ? 'YES' : 'NO');
  console.log('Console errors          :', consoleErrors.length);
  console.log('Screenshot              :', OUT);
  console.log('==================================================\n');

  await browser.close();
  process.exit(flowOk && seqFixed ? 0 : 2);
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
