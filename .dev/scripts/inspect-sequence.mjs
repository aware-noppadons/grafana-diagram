// Diagnostic: dump the sequence panel's injected values + actor/message texts
// with their geometry, to understand mis-positioning.
import { chromium } from 'playwright';

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: Number(process.env.W) || 1600, height: 900 } });
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length >= 2,
    { timeout: 45000 }
  );
  for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => {
      const w = Array.from(document.querySelectorAll('[data-viz-panel-key]')).find((p) => {
        const h = p.querySelector('[data-testid^="data-testid Panel header"]');
        return /sequence|bug/i.test(h?.getAttribute('data-testid') || '');
      });
      const c = w?.querySelector('[data-testid="data-testid panel content"]') || w;
      return !!c?.querySelector('svg text.actor');
    });
    if (ready) break;
    await sleep(500);
  }
  await sleep(500);

  const dump = await page.evaluate(() => {
    const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
    const seq = wraps.find((w) => {
      const h = w.querySelector('[data-testid^="data-testid Panel header"]');
      return /sequence|bug/i.test(h?.getAttribute('data-testid') || '');
    });
    if (!seq) return { error: 'no sequence panel' };
    const content = seq.querySelector('[data-testid="data-testid panel content"]') || seq;
    const svg = Array.from(content.querySelectorAll('svg')).find((s) => s.querySelector('text.actor')) || content.querySelector('svg');
    if (!svg) return { error: 'no svg', contentText: (content.textContent || '').slice(0, 120) };

    const g = (el) => {
      try {
        const b = el.getBBox();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      } catch { return null; }
    };
    const describe = (el) => ({
      tag: el.tagName,
      cls: el.getAttribute('class'),
      x: el.getAttribute('x'),
      y: el.getAttribute('y'),
      dy: el.getAttribute('dy'),
      text: (el.textContent || '').trim().slice(0, 20),
      parentTag: el.parentNode?.tagName,
      parentCls: el.parentNode?.getAttribute?.('class'),
      bbox: g(el),
    });

    return {
      viewport: window.innerWidth,
      allTexts: Array.from(svg.querySelectorAll('text')).map((el) => ({
        cls: el.getAttribute('class'),
        text: (el.textContent || '').trim().slice(0, 24),
        bbox: g(el),
      })),
      diagramValues: Array.from(svg.querySelectorAll('.diagram-value')).map(describe),
      actors: Array.from(svg.querySelectorAll('text.actor')).map(describe),
      messages: Array.from(svg.querySelectorAll('text.messageText')).map((el) => ({
        text: (el.textContent || '').trim().slice(0, 16),
        y: el.getAttribute('y'),
        dy: el.getAttribute('dy'),
        bbox: g(el),
      })),
      hLines: Array.from(svg.querySelectorAll('line'))
        .filter((l) => l.getAttribute('y1') === l.getAttribute('y2'))
        .map((l) => ({ cls: l.getAttribute('class'), y: l.getAttribute('y1'), x1: l.getAttribute('x1'), x2: l.getAttribute('x2') })),
    };
  });

  console.log(JSON.stringify(dump, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
