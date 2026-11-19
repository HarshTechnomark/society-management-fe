/**
 * Client-side second line of defence for notice bodies. The server already sanitises (BR-16-2); this keeps only
 * a short allow-list of tags and attributes before the HTML reaches the page.
 */
const TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
  'H4',
  'BLOCKQUOTE',
  'SPAN',
  'A',
  'HR',
]);
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

function clean(node: Node, out: Document): Node {
  const frag = out.createDocumentFragment();
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      frag.appendChild(out.createTextNode(child.textContent ?? ''));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(el.tagName)) return;
      const inner = clean(el, out);
      if (!TAGS.has(el.tagName)) {
        frag.appendChild(inner);
        return;
      }
      const copy = out.createElement(el.tagName.toLowerCase());
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') ?? '';
        if (SAFE_HREF.test(href)) {
          copy.setAttribute('href', href);
          copy.setAttribute('rel', 'noopener noreferrer');
          copy.setAttribute('target', '_blank');
        }
      }
      copy.appendChild(inner);
      frag.appendChild(copy);
    }
  });
  return frag;
}

export function safeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const holder = document.implementation.createHTMLDocument('');
  const box = holder.createElement('div');
  box.appendChild(clean(doc.body, holder));
  return box.innerHTML;
}

/** Plain text of a body, for "Listen". */
export function plainText(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
}
