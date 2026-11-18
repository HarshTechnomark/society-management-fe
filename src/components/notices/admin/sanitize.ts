/** Client-side twin of the server allow-list (BR-16-2). Defence in depth: the API already sanitises `body`. */
const ALLOWED = new Set([
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
  'H3',
  'H4',
  'BLOCKQUOTE',
  'A',
]);

export function sanitizeNoticeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const a of Array.from(child.attributes)) {
        if (!(child.tagName === 'A' && a.name === 'href')) child.removeAttribute(a.name);
      }
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') ?? '';
        if (/^https:\/\//i.test(href) || href.startsWith('/')) {
          child.setAttribute('rel', 'noopener noreferrer');
          child.setAttribute('target', '_blank');
        } else child.removeAttribute('href');
      }
    }
  };
  walk(doc.body);
  doc.body.querySelectorAll('script,style').forEach(n => n.remove());
  return doc.body.innerHTML;
}
