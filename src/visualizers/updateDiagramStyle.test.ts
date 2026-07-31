import { LinkModel } from '@grafana/data';
import { updateDiagramStyle } from './updateDiagramStyle';
import { DiagramOptions, DiagramSeriesModel } from '../config/types';

const makeModel = (label: string, value: number, color?: string): DiagramSeriesModel =>
  ({
    label,
    data: [[0, value]],
    isVisible: true,
    seriesIndex: 0,
    timeStep: 1,
    timeField: {} as any,
    valueField: { config: { custom: { valueName: 'last' } } } as any,
    info: [{ title: 'last', numeric: value, text: String(value), color } as any],
  } as DiagramSeriesModel);

// A series whose field carries Grafana data links (what `Overrides -> Data links` produces).
const makeLinkedModel = (
  label: string,
  value: number,
  links: Array<Partial<LinkModel>>
): DiagramSeriesModel => {
  const model = makeModel(label, value);
  (model.valueField as any).getLinks = () =>
    links.map((l) => ({ title: 'link', href: '', target: '_self', origin: {}, ...l }));
  return model;
};

const baseOptions = (overrides: Partial<DiagramOptions> = {}): DiagramOptions =>
  ({
    useBackground: false,
    nodeSize: { minWidth: 30, minHeight: 30 },
    composites: [],
    style: '',
    maxWidth: true,
    ...overrides,
  } as unknown as DiagramOptions);

const container = (svgInner: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`;
  return el;
};

describe('updateDiagramStyle', () => {
  describe('flowchart binding (regression guard)', () => {
    it('injects a .diagram-value onto a node matched by data-id', () => {
      const el = container('<g data-id="Orders"><foreignObject><div>Orders</div></foreignObject></g>');
      updateDiagramStyle(el, [makeModel('Orders', 120)], baseOptions(), 'd1');
      expect(el.querySelector('.diagram-value')).not.toBeNull();
      expect(el.innerHTML).toContain('120');
    });

    it('colors the whole flowchart edge label (label + value), not just the value', () => {
      const el = container(
        '<g class="edgeLabels"><g class="edgeLabel"><foreignObject><div class="labelBkg"><span class="edgeLabel">charge</span></div></foreignObject></g></g>'
      );
      updateDiagramStyle(el, [makeModel('charge', 42, 'rgb(1, 2, 3)')], baseOptions(), 'dA');
      const label = el.querySelector('span.edgeLabel');
      const value = el.querySelector('.diagram-value');
      expect(value?.getAttribute('style') || '').toContain('color: rgb(1, 2, 3)');
      expect(label?.getAttribute('style') || '').toContain('color: rgb(1, 2, 3)');
    });

    it('colors the edge label background too in background mode', () => {
      const el = container(
        '<g class="edgeLabels"><g class="edgeLabel"><foreignObject><div class="labelBkg"><span class="edgeLabel">charge</span></div></foreignObject></g></g>'
      );
      updateDiagramStyle(el, [makeModel('charge', 42, 'rgb(9, 8, 7)')], baseOptions({ useBackground: true }), 'dB');
      const label = el.querySelector('span.edgeLabel');
      const value = el.querySelector('.diagram-value');
      expect(value?.getAttribute('style') || '').toContain('background-color: rgb(9, 8, 7)');
      expect(label?.getAttribute('style') || '').toContain('background-color: rgb(9, 8, 7)');
    });
  });

  describe('sequence binding (exact match)', () => {
    it('binds the value onto an actor on its own line, without throwing', () => {
      const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
      expect(() => updateDiagramStyle(el, [makeModel('Orders', 120)], baseOptions(), 'd2')).not.toThrow();
      const value = el.querySelector('tspan.diagram-value');
      expect(value?.textContent).toBe('120');
      expect(value?.getAttribute('dy')).toBe('1.2em');
    });

    it('colors the whole actor label (name + value) like a graph node', () => {
      const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
      updateDiagramStyle(el, [makeModel('Orders', 120, 'rgb(255, 0, 0)')], baseOptions(), 'd3');
      expect(el.querySelector('text.actor')?.getAttribute('style')).toContain('rgb(255, 0, 0)');
    });

    it('colors the whole message label (name + value) like a graph node', () => {
      const el = container('<text class="messageText">charge</text>');
      updateDiagramStyle(el, [makeModel('charge', 42, 'rgb(0, 0, 255)')], baseOptions(), 'd4');
      const value = el.querySelector('tspan.diagram-value');
      expect(value?.textContent).toBe('42');
      expect(value?.getAttribute('style')).toContain('rgb(0, 0, 255)');
      expect(el.querySelector('text.messageText')?.getAttribute('style') || '').toContain('rgb(0, 0, 255)');
    });

    it('does not bind when the name matches no element', () => {
      const el = container('<text>Other</text>');
      updateDiagramStyle(el, [makeModel('Orders', 120)], baseOptions(), 'd5');
      expect(el.querySelector('.diagram-value')).toBeNull();
    });

    it('does NOT bind on a partial/substring match (exact only)', () => {
      const el = container('<text>Orders total</text>');
      updateDiagramStyle(el, [makeModel('Orders', 120)], baseOptions(), 'd6');
      expect(el.querySelector('.diagram-value')).toBeNull();
    });
  });

  describe('node label injection', () => {
    it('keeps a markup-looking value literal instead of parsing it as html', () => {
      const el = container('<g class="node" data-id="Orders"><foreignObject><div>Orders</div></foreignObject></g>');
      const model = makeModel('Orders', 120);
      model.info = [{ title: 'last', numeric: 120, text: '<img src=x onerror="alert(1)">' } as any];
      updateDiagramStyle(el, [model], baseOptions(), 'X1');
      expect(el.querySelector('img')).toBeNull();
      expect(el.textContent).toContain('<img src=x');
    });
  });

  describe('data link hyperlinks', () => {
    it('wraps a sequence actor in an anchor when its series has a data link', () => {
      const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
      updateDiagramStyle(
        el,
        [makeLinkedModel('Orders', 120, [{ href: 'https://example.com/runbook' }])],
        baseOptions(),
        'L1'
      );
      const anchor = el.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe('https://example.com/runbook');
      expect(anchor?.querySelector('text.actor')).not.toBeNull();
      // the value binding still happens, inside the anchor
      expect(el.querySelector('tspan.diagram-value')?.textContent).toBe('120');
    });

    it('wraps a flowchart node shape in an anchor, so the whole box is clickable', () => {
      const el = container('<g class="node" data-id="Orders"><foreignObject><div>Orders</div></foreignObject></g>');
      updateDiagramStyle(el, [makeLinkedModel('Orders', 120, [{ href: '/d/abc/my-dash' }])], baseOptions(), 'L2');
      const anchor = el.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe('/d/abc/my-dash');
      expect(anchor?.querySelector('g.node')).not.toBeNull();
      expect(el.querySelector('.diagram-value')).not.toBeNull();
    });

    it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox'])(
      'refuses to linkify an unsafe url (%s), but still binds the value',
      (href) => {
        const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
        updateDiagramStyle(el, [makeLinkedModel('Orders', 120, [{ href }])], baseOptions(), 'L3');
        expect(el.querySelector('a')).toBeNull();
        expect(el.querySelector('tspan.diagram-value')?.textContent).toBe('120');
      }
    );

    it('opens in a new tab when the data link says so, without leaking the referrer', () => {
      const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
      updateDiagramStyle(
        el,
        [makeLinkedModel('Orders', 120, [{ href: 'https://example.com', target: '_blank' }])],
        baseOptions(),
        'L4'
      );
      const anchor = el.querySelector('a');
      expect(anchor?.getAttribute('target')).toBe('_blank');
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('wraps a flowchart connection label in an html anchor', () => {
      const el = container(
        '<g class="edgeLabels"><g class="edgeLabel"><foreignObject><div class="labelBkg"><span class="edgeLabel">charge</span></div></foreignObject></g></g>'
      );
      updateDiagramStyle(
        el,
        [makeLinkedModel('charge', 42, [{ href: 'https://example.com/charge' }])],
        baseOptions(),
        'L6'
      );
      const anchor = el.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe('https://example.com/charge');
      expect(anchor?.querySelector('span.edgeLabel')).not.toBeNull();
      expect(el.querySelector('.diagram-value')?.textContent).toBe('42');
    });

    it('wraps a node matched by its label text in an anchor', () => {
      const el = container(
        '<g class="node"><g class="label"><foreignObject><div>Orders</div></foreignObject></g></g>'
      );
      updateDiagramStyle(el, [makeLinkedModel('Orders', 120, [{ href: '/d/abc' }])], baseOptions(), 'L7');
      const anchor = el.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe('/d/abc');
      expect(anchor?.querySelector('g.node')).not.toBeNull();
    });

    it('links a composite node to the link of the member that won', () => {
      const el = container('<g class="node" data-id="Cluster"><foreignObject><div>Cluster</div></foreignObject></g>');
      const models = [
        makeLinkedModel('Orders', 120, [{ href: 'https://example.com/orders' }]),
        makeLinkedModel('Payments', 95, [{ href: 'https://example.com/payments' }]),
      ];
      const options = baseOptions({
        composites: [{ name: 'Cluster', members: ['Orders', 'Payments'], valueName: 'last', showLowestValue: true }],
      });
      updateDiagramStyle(el, models, options, 'L8');
      const anchor = el.querySelector('a');
      // showLowestValue -> Payments (95) wins, so the composite carries its link
      expect(anchor?.getAttribute('href')).toBe('https://example.com/payments');
    });

    it('leaves the diagram untouched when the series has no data links', () => {
      const el = container('<text class="actor"><tspan x="10">Orders</tspan></text>');
      updateDiagramStyle(el, [makeLinkedModel('Orders', 120, [])], baseOptions(), 'L5');
      expect(el.querySelector('a')).toBeNull();
    });
  });
});
