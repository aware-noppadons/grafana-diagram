import { LinkModel } from '@grafana/data';
import { DiagramSeriesModel } from '../config/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * Only http(s)/mailto and Grafana-relative urls may become a hyperlink. A data link url can
 * contain dashboard variables, so it is attacker-influenceable in a shared dashboard; anything
 * script-bearing (`javascript:`, `data:`, `vbscript:`) must never reach an href. Control
 * characters are stripped first because browsers ignore them when resolving a scheme
 * (`java\nscript:` navigates).
 */
export const isSafeLinkUrl = (url?: string): boolean => {
  if (!url) {
    return false;
  }
  /* eslint-disable-next-line no-control-regex */
  const cleaned = url.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  if (cleaned.length === 0) {
    return false;
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (!scheme) {
    // no scheme: a relative url, which stays on this Grafana origin
    return true;
  }
  return SAFE_SCHEMES.includes(`${scheme[1].toLowerCase()}:`);
};

/**
 * Resolve the Grafana data links configured on a series' field (Overrides -> Data links),
 * interpolated against the value shown in the diagram.
 */
export const getSeriesLinks = (model: DiagramSeriesModel, calculatedValue?: any): LinkModel[] => {
  const field: any = model.valueField;
  if (typeof field?.getLinks !== 'function') {
    return [];
  }
  return field.getLinks({ calculatedValue }).filter((link: LinkModel) => isSafeLinkUrl(link.href));
};

/**
 * Follow a data link, used where we cannot render a real anchor (the legend renders its
 * labels as buttons). Mirrors what clicking a linkified diagram shape does.
 */
export const openLinkModel = (link: LinkModel) => {
  if (!isSafeLinkUrl(link.href)) {
    return;
  }
  // Clicking a real anchor rather than calling window.open: a popup blocker can swallow
  // window.open('_blank'), which looks exactly like "Open in new tab was ignored".
  const anchor = document.createElement('a');
  anchor.href = link.href;
  if (link.target === '_blank') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

/**
 * Wrap `element` in an anchor pointing at `link`, in the element's own namespace so an
 * SVG shape gets an SVG <a> and an HTML label gets an HTML <a>.
 */
export const linkifyElement = (element: Element, link: LinkModel): Element | null => {
  const parent = element.parentNode;
  if (!parent || !isSafeLinkUrl(link.href)) {
    return null;
  }
  const isSvg = element.namespaceURI === SVG_NS;
  const anchor = isSvg
    ? (document.createElementNS(SVG_NS, 'a') as Element)
    : element.ownerDocument.createElement('a');

  anchor.setAttribute('href', link.href);
  if (isSvg) {
    // mermaid's own links use xlink:href; keep both for older renderers.
    anchor.setAttributeNS(XLINK_NS, 'xlink:href', link.href);
  }
  anchor.setAttribute('class', 'diagram-link');
  if (link.target === '_blank') {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
  if (link.title) {
    anchor.setAttribute('aria-label', link.title);
  }

  parent.insertBefore(anchor, element);
  anchor.appendChild(element);
  return anchor;
};
