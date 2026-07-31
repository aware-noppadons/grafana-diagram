// Diagnostic: for each CONNECTION (flowchart edge + sequence message), report the
// computed color of its LABEL element vs its appended .diagram-value element.
// Demonstrates the bug: the threshold color lands on the value but NOT the label.
//
// Env: GRAFANA_URL (default http://localhost:3000). Screenshots -> proof/.
// Run: GRAFANA_URL=http://localhost:3001 node scripts/inspect-edge-color.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF = resolve(__dirname, '..', 'proof');
mkdirSync(PROOF, { recursive: true });

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const TAG = process.env.TAG || new URL(BASE).port || 'x';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const EDGES = ['charge', 'fulfil'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length >= 2,
    { timeout: 45000 }
  );
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('.diagram-value').length);
    if (n >= 4) break;
    await sleep(500);
  }
  await sleep(1200);

  const report = await page.evaluate((EDGES) => {
    const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
    const findPanel = (re) => wraps.find((w) => re.test(w.querySelector('[data-testid^="data-testid Panel header"]')?.getAttribute('data-testid') || ''));
    const cc = (el) => el ? getComputedStyle(el).color : null;

    // Flowchart: edge label is span.edgeLabel; value is the sibling .diagram-value appended to its parent.
    const flowWrap = findPanel(/flowchart|control|graph/i) || wraps[0];
    const flowSvg = (flowWrap.querySelector('[data-testid="data-testid panel content"]') || flowWrap).querySelector('svg');
    const flow = EDGES.map((t) => {
      const label = Array.from(flowSvg.querySelectorAll('span.edgeLabel')).find((s) => (s.textContent || '').trim() === t);
      const parent = label?.parentNode;
      const value = parent ? Array.from(parent.querySelectorAll('.diagram-value'))[0] : null;
      return { edge: t, labelText: label?.textContent?.trim(), labelColor: cc(label), valueText: value?.textContent?.trim(), valueColor: cc(value) };
    });

    // Sequence: message is text.messageText; value is the .diagram-value tspan appended to it.
    const seqWrap = findPanel(/sequence|bug/i);
    const seqSvg = (seqWrap.querySelector('[data-testid="data-testid panel content"]') || seqWrap).querySelector('svg');
    const seq = Array.from(seqSvg.querySelectorAll('text.messageText')).map((m) => {
      const value = m.querySelector('.diagram-value');
      const fill = (el) => el ? getComputedStyle(el).fill : null;
      return { messageText: (m.textContent || '').replace(/\s+/g, ' ').trim(), messageFill: fill(m), valueFill: fill(value) };
    });

    return { flow, seq };
  }, EDGES);

  console.log(`\n===== ${BASE} =====`);
  console.log(JSON.stringify(report, null, 2));

  const shot = async (re, name) => {
    const h = await page.evaluateHandle((reSrc) => {
      const re = new RegExp(reSrc, 'i');
      const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
      const w = wraps.find((x) => re.test(x.querySelector('[data-testid^="data-testid Panel header"]')?.getAttribute('data-testid') || '')) || wraps[0];
      return w.querySelector('[data-testid="data-testid panel content"]') || w;
    }, re);
    const el = h.asElement();
    if (el) await el.screenshot({ path: resolve(PROOF, name) });
  };
  const PREFIX = process.env.PREFIX || 'before-edgecolor';
  await shot('flowchart|control|graph', `${PREFIX}-flow-${TAG}.png`);
  await shot('sequence|bug', `${PREFIX}-seq-${TAG}.png`);
  console.log(`screenshots -> proof/${PREFIX}-flow-${TAG}.png, ${PREFIX}-seq-${TAG}.png`);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
