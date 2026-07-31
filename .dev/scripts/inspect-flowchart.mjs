// Diagnostic: dump the FLOWCHART panel DOM so we can see how node labels vs edge
// labels are structured (classes, data-id, ancestry) — needed to route mermaid 11
// flowchart nodes correctly (v11 dropped node data-id and renders labels as <span>).
//
// Env: GRAFANA_URL (default http://localhost:3000).
// Run: GRAFANA_URL=http://localhost:3001 node scripts/inspect-flowchart.mjs

import { chromium } from 'playwright';

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const TARGETS = ['Orders', 'Payments', 'Shipping', 'charge', 'fulfil'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length >= 2,
    { timeout: 45000 }
  );
  // wait for a flowchart-looking svg (has .node or rect) to render
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate(() => {
      const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
      return wraps.some((w) => {
        const h = w.querySelector('[data-testid^="data-testid Panel header"]');
        const t = h?.getAttribute('data-testid') || '';
        if (!/flowchart|control|graph/i.test(t)) return false;
        const svg = w.querySelector('svg');
        return !!svg && svg.querySelectorAll('.node, rect').length > 0;
      });
    });
    if (ok) break;
    await sleep(500);
  }
  await sleep(1000);

  const dump = await page.evaluate((TARGETS) => {
    const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
    const wrap = wraps.find((w) => {
      const h = w.querySelector('[data-testid^="data-testid Panel header"]');
      return /flowchart|control|graph/i.test(h?.getAttribute('data-testid') || '');
    }) || wraps[0];
    const content = wrap.querySelector('[data-testid="data-testid panel content"]') || wrap;
    const svg = content.querySelector('svg');
    if (!svg) return { error: 'no flowchart svg' };

    const cls = (el) => (el.getAttribute && el.getAttribute('class')) || '';
    const chain = (el) => {
      const out = [];
      let cur = el;
      for (let i = 0; i < 6 && cur && cur !== svg.parentElement; i++) {
        out.push(cur.tagName.toLowerCase() + (cls(cur) ? '.' + cls(cur).trim().replace(/\s+/g, '.') : ''));
        cur = cur.parentElement;
      }
      return out.join(' < ');
    };

    // leaf-ish elements whose exact trimmed text === target
    const matchesFor = (target) => {
      const all = Array.from(svg.querySelectorAll('*'));
      return all
        .filter((el) => (el.textContent || '').trim() === target)
        .filter((el) => !Array.from(el.children).some((c) => (c.textContent || '').trim() === target))
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          class: cls(el),
          closestDataId: el.closest('[data-id]')?.getAttribute('data-id') ?? null,
          closestNode: el.closest('.node') ? cls(el.closest('.node')) : null,
          inEdgeLabel: !!el.closest('.edgeLabel'),
          inEdgeLabels: !!el.closest('.edgeLabels'),
          inNodeLabel: !!el.closest('.nodeLabel'),
          ancestry: chain(el),
        }));
    };

    return {
      counts: {
        dataIdEls: svg.querySelectorAll('[data-id]').length,
        nodeEls: svg.querySelectorAll('.node').length,
        nodeLabel: svg.querySelectorAll('.nodeLabel').length,
        edgeLabel: svg.querySelectorAll('.edgeLabel').length,
        edgeLabels: svg.querySelectorAll('.edgeLabels').length,
        spans: svg.querySelectorAll('span').length,
      },
      byTarget: Object.fromEntries(TARGETS.map((t) => [t, matchesFor(t)])),
      allSpans: Array.from(svg.querySelectorAll('span')).map((el) => ({
        class: cls(el),
        text: (el.textContent || '').trim().slice(0, 24),
        inNode: !!el.closest('.node'),
        inEdgeLabel: !!el.closest('.edgeLabel'),
        inEdgeLabels: !!el.closest('.edgeLabels'),
        dataId: el.closest('[data-id]')?.getAttribute('data-id') ?? null,
        ancestry: chain(el),
      })),
      sampleNodeHTML: (svg.querySelector('.node')?.outerHTML || '').slice(0, 500),
      sampleEdgeLabelHTML: (svg.querySelector('.edgeLabels')?.outerHTML || svg.querySelector('.edgeLabel')?.outerHTML || '').slice(0, 500),
    };
  }, TARGETS);

  console.log(JSON.stringify(dump, null, 2));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
