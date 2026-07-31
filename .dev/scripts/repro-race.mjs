// Repro: force rapid re-renders (concurrent initializeMermaid) and check whether
// the sequence values misbind / duplicate — testing the same-id render race.
import { chromium } from 'playwright';

const BASE = process.env.GRAFANA_URL || 'http://localhost:3000';
const DASH = `${BASE}/d/diagram-repro/diagram-panel-graph-vs-sequence?kiosk`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const collect = () => {
  const wraps = Array.from(document.querySelectorAll('[data-viz-panel-key]'));
  const seq = wraps.find((w) => {
    const h = w.querySelector('[data-testid^="data-testid Panel header"]');
    return /sequence|bug/i.test(h?.getAttribute('data-testid') || '');
  });
  const c = seq?.querySelector('[data-testid="data-testid panel content"]') || seq;
  const svg = Array.from(c?.querySelectorAll('svg') || []).find((s) => s.querySelector('text.actor')) || c?.querySelector('svg');
  if (!svg) return { error: 'no diagram svg', text: (c?.textContent || '').slice(0, 80) };
  const vals = Array.from(svg.querySelectorAll('.diagram-value')).map((v) => ({
    text: v.textContent.trim(),
    parent: v.parentNode?.getAttribute?.('class'),
    parentText: (v.parentNode?.textContent || '').trim().slice(0, 20),
  }));
  return {
    valueCount: vals.length,
    onNonActor: vals.filter((v) => v.parent !== 'actor'),
    values: vals,
    renderError: /Error rendering diagram/i.test(svg.textContent || (c.textContent || '')),
  };
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: Number(process.env.W) || 1000, height: 800 } });
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length >= 2,
    { timeout: 45000 }
  );
  await sleep(3000);
  console.log('baseline:', JSON.stringify(await page.evaluate(collect)));

  // Spam refresh to trigger rapid data updates -> concurrent initializeMermaid.
  const clickRefresh = async () => {
    for (const sel of [
      '[data-testid="data-testid RefreshPicker run button"]',
      'button[aria-label="Refresh dashboard"]',
    ]) {
      const el = await page.$(sel);
      if (el) { await el.click({ timeout: 1000 }).catch(() => {}); return true; }
    }
    return false;
  };

  let worstOnNonActor = 0, maxCount = 0, sawError = false;
  for (let round = 0; round < 12; round++) {
    for (let i = 0; i < 4; i++) { await clickRefresh(); await sleep(40); }
    await sleep(250);
    const s = await page.evaluate(collect);
    if (s.error) { console.log(`round ${round}: ${s.error}`); continue; }
    worstOnNonActor = Math.max(worstOnNonActor, s.onNonActor.length);
    maxCount = Math.max(maxCount, s.valueCount);
    if (s.renderError) sawError = true;
    if (s.onNonActor.length || s.valueCount !== 6 || s.renderError) {
      console.log(`round ${round}: count=${s.valueCount} onNonActor=${JSON.stringify(s.onNonActor)} error=${s.renderError}`);
    }
  }
  console.log('\nSUMMARY: maxValueCount=%d (expected 6), worstOnNonActor=%d, sawRenderError=%s',
    maxCount, worstOnNonActor, sawError);
  console.log('RACE REPRODUCED:', maxCount !== 6 || worstOnNonActor > 0 || sawError ? 'YES' : 'no');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
