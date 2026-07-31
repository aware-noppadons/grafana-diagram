import { LinkModel } from '@grafana/data';
import { openLinkModel } from './diagramLinks';

const link = (overrides: Partial<LinkModel> = {}): LinkModel =>
  ({ title: 'Runbook', href: 'https://example.com/runbook', target: '_self', origin: {} as any, ...overrides } as LinkModel);

describe('openLinkModel', () => {
  let open: jest.SpyInstance;

  beforeEach(() => {
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    open.mockRestore();
  });

  it('follows the link in the same tab by default', () => {
    openLinkModel(link());
    expect(open).toHaveBeenCalledWith('https://example.com/runbook', '_self', undefined);
  });

  it('opens a new tab with noopener when the link asks for it', () => {
    openLinkModel(link({ target: '_blank' }));
    expect(open).toHaveBeenCalledWith('https://example.com/runbook', '_blank', 'noopener,noreferrer');
  });

  it('never navigates to an unsafe url', () => {
    openLinkModel(link({ href: 'javascript:alert(1)' }));
    expect(open).not.toHaveBeenCalled();
  });
});
