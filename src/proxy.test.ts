import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const at = (url: string) => proxy(new NextRequest(url, { headers: { host: new URL(url).host } }));

describe('proxy host routing', () => {
  it('serves the support hand-off page on the admin host without rewriting it (module 05 P-09)', () => {
    const res = at('https://admin.societyapp.in/support-handoff');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('serves the public status page on every host without rewriting it (module 07)', () => {
    for (const host of ['admin', 'platform', 'my', 'gate', 'work']) {
      const res = at(`https://${host}.societyapp.in/status`);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });

  it('serves the status host root as the status page', () => {
    const res = at('https://status.societyapp.in/');
    expect(res.headers.get('x-middleware-rewrite')).toContain('/status');
  });

  it('still rewrites admin screens into the admin group', () => {
    const res = at('https://admin.societyapp.in/settings/support-access');
    expect(res.headers.get('x-middleware-rewrite')).toContain('/admin/settings/support-access');
  });

  it('serves the files of public/ (import templates) on an audience host without rewriting them', () => {
    for (const path of [
      '/templates/opening-balances-template.csv',
      '/templates/units-template.csv',
      '/robots.txt',
    ]) {
      const res = at(`https://admin.societyapp.in${path}`);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.status).toBe(200);
    }
  });

  it('keeps static files out of the proxy matcher', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/templates/units-template.csv')).toBe(false);
    expect(re.test('/logo.png')).toBe(false);
    expect(re.test('/billing/runs')).toBe(true);
  });
});
