import { FieldConfigProperty } from '@grafana/data';

// The plugin module pulls in @grafana/ui and mermaid, neither of which loads cleanly under
// Jest (@grafana/ui's CJS build exports no runtime enums; mermaid ships ESM only). Stub just
// enough of both to import the module.
jest.mock('@grafana/ui', () => ({
  LegendDisplayMode: { Hidden: 'hidden', List: 'list', Table: 'table' },
  stylesFactory: (fn: any) => fn,
  CustomScrollbar: 'div',
  VizLegend: 'div',
  useTheme2: () => ({}),
}));
jest.mock('mermaid', () => ({ initialize: jest.fn(), render: jest.fn() }));

import { disabledStandardFieldOptions } from './module';

describe('diagram panel field config', () => {
  // Data links used to be disabled here, so Grafana stripped them from the field config before
  // the panel ever saw them: `Overrides -> Data links` silently did nothing.
  it('keeps the standard Data links option enabled', () => {
    expect(disabledStandardFieldOptions).not.toContain(FieldConfigProperty.Links);
  });
});
