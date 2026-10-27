import { describe, expect, it } from 'vitest';
import {
  embeddedJson,
  portableHtml,
  type PortableSnapshot,
} from '../../../src/app/portable-html.ts';

const snapshot: PortableSnapshot = {
  path: 'docs/system.aerie',
  source: 'model shop: Shop\nshop: Store [system]\n',
  fragment: '#view=services&aud=engineer&open=shop&sel=api',
  theme: 'light',
  title: 'Shop',
};

describe('portable HTML', () => {
  it('INT-1021 embeds the exact full model and opening picture as recoverable JSON data', () => {
    const html = portableHtml(snapshot, 'document.documentElement.dataset.reader="ready";');
    const data = /id="aerie-export">([^]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(data)).toEqual(snapshot);
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('<title>Shop - Aerie</title>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).toContain("connect-src 'none'");
  });

  it('INT-1024 hostile model text and titles cannot break out of their HTML data elements', () => {
    const source = '</sCrIpT><script>globalThis.pwned=true</script> & \u2028\u2029 😀';
    const title = '</title><img src=x onerror=alert(1)>';
    const html = portableHtml({ ...snapshot, source, title }, 'const end="</script>";');
    const data = /id="aerie-export">([^]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(data)).toMatchObject({ source, title });
    expect(data).not.toMatch(/[<>&\u2028\u2029]/);
    expect(html.match(/<script\b/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;/title&gt;');
    expect(JSON.parse(embeddedJson({ source }))).toEqual({ source });
  });
});
