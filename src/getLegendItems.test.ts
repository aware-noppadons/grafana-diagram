import { getLegendItems } from './getLegendItems';
import { DiagramSeriesModel, LegendOptions } from './config/types';

const makeModel = (
  label: string,
  values: number[],
  links: Array<{ href: string; target?: string }> = []
): DiagramSeriesModel =>
  ({
    label,
    data: values.map((v, i) => [i, v]),
    isVisible: true,
    seriesIndex: 0,
    timeStep: 1,
    timeField: {} as any,
    valueField: {
      config: { custom: { valueName: 'last' } },
      getLinks: () => links.map((l) => ({ title: 'Runbook', target: '_self', origin: {}, ...l })),
    } as any,
    info: [
      { title: 'last', numeric: values[values.length - 1], text: String(values[values.length - 1]) } as any,
      { title: 'mean', numeric: 1, text: '1' } as any,
    ],
  } as DiagramSeriesModel);

const legend = (overrides: Partial<LegendOptions> = {}): LegendOptions =>
  ({ show: true, stats: ['last'], hideEmpty: false, hideZero: false, ...overrides } as LegendOptions);

describe('getLegendItems', () => {
  it('carries the series data links on the legend item', () => {
    const items = getLegendItems([makeModel('Orders', [120], [{ href: 'https://example.com/orders' }])], legend());
    expect(items[0].label).toBe('Orders');
    expect(items[0].data?.[0].href).toBe('https://example.com/orders');
  });

  it('drops unsafe links so a legend click can never run a script url', () => {
    const items = getLegendItems([makeModel('Orders', [120], [{ href: 'javascript:alert(1)' }])], legend());
    expect(items[0].data).toEqual([]);
  });

  it('has no links when the series has none', () => {
    const items = getLegendItems([makeModel('Orders', [120])], legend());
    expect(items[0].data).toEqual([]);
  });

  it('still honours hideZero / hideEmpty', () => {
    expect(getLegendItems([makeModel('Zeros', [0, 0])], legend({ hideZero: true }))).toHaveLength(0);
    expect(getLegendItems([makeModel('Zeros', [0, 0])], legend())).toHaveLength(1);
  });

  it('shows only the legend values selected in options', () => {
    const items = getLegendItems([makeModel('Orders', [120])], legend({ stats: ['mean'] }));
    expect(items[0].getDisplayValues?.().map((dv) => dv.title)).toEqual(['mean']);
  });
});
