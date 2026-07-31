import { LinkModel } from '@grafana/data';
import { openLinkModel } from './diagramLinks';

const link = (overrides: Partial<LinkModel> = {}): LinkModel =>
  ({ title: 'Runbook', href: 'https://example.com/runbook', target: '_self', origin: {} as any, ...overrides } as LinkModel);

describe('openLinkModel', () => {
  let clicked: HTMLAnchorElement[];
  let click: jest.SpyInstance;

  beforeEach(() => {
    clicked = [];
    click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    click.mockRestore();
  });

  it('follows the link in the same tab by default', () => {
    openLinkModel(link());
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('href')).toBe('https://example.com/runbook');
    expect(clicked[0].getAttribute('target')).toBeNull();
  });

  it('opens a new tab with noopener when the link asks for it', () => {
    openLinkModel(link({ target: '_blank' }));
    expect(clicked[0].getAttribute('target')).toBe('_blank');
    expect(clicked[0].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never navigates to an unsafe url', () => {
    openLinkModel(link({ href: 'javascript:alert(1)' }));
    expect(clicked).toHaveLength(0);
  });

  it('leaves nothing behind in the document', () => {
    openLinkModel(link());
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
