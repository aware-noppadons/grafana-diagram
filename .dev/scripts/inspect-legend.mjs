// Diagnostic/assertion: does the table-legend HEADER ROW actually render (visibly)?
//
// Grafana 13's VizLegendTable puts `sr-only` on every header <th> when `isSortable`
// is falsy, so the header exists in the DOM but is visually hidden (~1px, clipped).
// This inspects each panel's legend <thead>, measures each <th>, and reports whether
// the header is visible. Exit 0 iff every table-legend has a visible header row.
//
// Env: GRAFANA_URL (default http://localhost:3000), SHOT (screenshot filename).
// Run: GRAFANA_URL=http://localhost:3001 SHOT=legend-v13-before.png node scripts/inspect-legend.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF = resolve(__dirname, '..', 'proof');
mkdirSync(PROOF, { recursive: true });

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const OUT = process.env.SHOT || 'legend-inspect.png';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('Navigating to', DASH);
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length >= 2,
    { timeout: 45000 }
  );
  // Wait until a legend table with a header row has rendered.
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('[data-viz-panel-key] table thead th').length);
    if (n > 0) break;
    await sleep(500);
  }
  await sleep(1500);

  const report = await page.evaluate(() => {
    const readTitle = (wrap) => {
      const h = wrap.querySelector('[data-testid^="data-testid Panel header"]');
      const tid = h?.getAttribute('data-testid') || '';
      return tid.replace(/^data-testid Panel header\s*/, '').trim() || (wrap.querySelector('h2')?.textContent || '').trim();
    };
    const panels = [];
    for (const wrap of Array.from(document.querySelectorAll('[data-viz-panel-key]'))) {
      const content = wrap.querySelector('[data-testid="data-testid panel content"]') || wrap;
      const table = content.querySelector('table');
      const ths = table ? Array.from(table.querySelectorAll('thead th')) : [];
      const headerCells = ths.map((th) => {
        const r = th.getBoundingClientRect();
        const cs = getComputedStyle(th);
        const visible = r.height > 4 && r.width > 4 && cs.visibility !== 'hidden' && cs.display !== 'none';
        return {
          text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
          cls: th.getAttribute('class') || '',
          srOnly: (th.getAttribute('class') || '').split(/\s+/).includes('sr-only'),
          h: Math.round(r.height),
          w: Math.round(r.width),
          position: cs.position,
          visible,
        };
      });
      const visibleWithText = headerCells.filter((c) => c.visible && c.text.length > 0);
      panels.push({
        title: readTitle(wrap),
        hasLegendTable: !!table,
        headerThCount: ths.length,
        headerCells,
        headerVisible: visibleWithText.length > 0,
        visibleHeaderTexts: visibleWithText.map((c) => c.text),
      });
    }
    return panels;
  });

  await page.screenshot({ path: resolve(PROOF, OUT), fullPage: true });

  const tableLegends = report.filter((p) => p.hasLegendTable);
  const allHeadersVisible = tableLegends.length > 0 && tableLegends.every((p) => p.headerVisible);

  console.log('\n================ LEGEND HEADER INSPECTION ================');
  console.log('Grafana URL :', BASE);
  for (const p of report) {
    console.log(`\nPanel: ${p.title || '(untitled)'}`);
    console.log(`  legend <table>: ${p.hasLegendTable}  |  <thead> th count: ${p.headerThCount}`);
    console.log(`  header visible : ${p.headerVisible}  columns: ${JSON.stringify(p.visibleHeaderTexts)}`);
    for (const c of p.headerCells) {
      console.log(`    th "${c.text}"  ${c.w}x${c.h}px  pos=${c.position}  sr-only=${c.srOnly}  visible=${c.visible}`);
    }
  }
  console.log('\nTable legends:', tableLegends.length, '| ALL headers visible:', allHeadersVisible);
  if (consoleErrors.length) console.log('Console errors:', consoleErrors.slice(0, 10));
  console.log('Screenshot:', OUT);
  console.log('=========================================================\n');

  await browser.close();
  process.exit(allHeadersVisible ? 0 : 2);
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
