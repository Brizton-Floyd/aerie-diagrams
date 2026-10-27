import { DOMImplementation } from '@xmldom/xmldom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentation, inlineProse } from '../../../src/app/documentation.ts';
import { prose } from '../../../src/app/dom.ts';

beforeEach(() => {
  vi.stubGlobal('document', new DOMImplementation().createDocument(null, 'body', null));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(text: string | null): HTMLElement {
  const article = document.createElement('article');
  for (const block of documentation(text, 'about code')) article.appendChild(block);
  return article;
}

describe('reader documentation', () => {
  it('INT-1031 preserves existing paragraphs, bold, inline code and caller classes', () => {
    const article = render('Plain **important** wording.\n\nUse `screen-api` here.');
    const paragraphs = article.getElementsByTagName('p');
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]?.textContent).toBe('Plain important wording.');
    expect(paragraphs[0]?.getAttribute('class')).toBe('about code');
    expect(article.getElementsByTagName('strong')[0]?.textContent).toBe('important');
    expect(article.getElementsByTagName('code')[0]?.textContent).toBe('screen-api');
    expect(
      prose('Some **strong** and `code`.')
        .map((node) => node.textContent)
        .join(''),
    ).toBe('Some strong and code.');
  });

  it('INT-1031 renders ownership headings, emphasis and flat ordered and unordered lists', () => {
    const article = render(
      '# Ownership\nMaintained by *Platform*.\n## Runbooks\n- Diagnose failures\n\n- Recover service\n3. Check logs\n\n4. Restore traffic',
    );
    expect(article.getElementsByTagName('h2')[0]?.textContent).toBe('Ownership');
    expect(article.getElementsByTagName('h3')[0]?.textContent).toBe('Runbooks');
    expect(article.getElementsByTagName('em')[0]?.textContent).toBe('Platform');
    expect(article.getElementsByTagName('ul').length).toBe(1);
    expect(article.getElementsByTagName('ol')[0]?.getAttribute('start')).toBe('3');
    expect(Array.from(article.getElementsByTagName('li')).map((item) => item.textContent)).toEqual([
      'Diagnose failures',
      'Recover service',
      'Check logs',
      'Restore traffic',
    ]);
  });

  it('INT-1031 INT-1032 keeps fenced code literal, including an unfinished fence', () => {
    const article = render(
      '```html\n<script>window.run = true</script>\n**literal**\n```\n\n~~~sh\ncurl /health',
    );
    const code = article.getElementsByTagName('code');
    expect(article.getElementsByTagName('pre').length).toBe(2);
    expect(article.getElementsByTagName('pre')[0]?.getAttribute('tabindex')).toBe('0');
    expect(code[0]?.textContent).toBe('<script>window.run = true</script>\n**literal**');
    expect(code[0]?.getAttribute('data-language')).toBe('html');
    expect(code[1]?.textContent).toBe('curl /health');
    expect(article.getElementsByTagName('script').length).toBe(0);
    expect(article.getElementsByTagName('strong').length).toBe(0);
  });

  it('INT-1032 links to web pages, email, relative documents and fragments without sharing an opener', () => {
    const article = render(
      '[Runbook](https://example.com/runbook_(api)) [Owner](mailto:team@example.com) ' +
        '[Decision](../decisions/0001.md) [Picture](#view=services) [Local](/docs/runbook)',
    );
    const anchors = Array.from(article.getElementsByTagName('a'));
    expect(anchors.map((anchor) => anchor.getAttribute('href'))).toEqual([
      'https://example.com/runbook_(api)',
      'mailto:team@example.com',
      '../decisions/0001.md',
      '#view=services',
      '/docs/runbook',
    ]);
    for (const anchor of anchors.slice(0, 2)) {
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor.getAttribute('target')).toBe('_blank');
    }
    expect(anchors[2]?.getAttribute('target')).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:alert(1)',
    'file:///private/secrets',
    '//example.com/unexpected',
    '/\\example.com/unexpected',
    '%6Aavascript:alert(1)',
    '',
  ])('INT-1032 leaves an unsafe or ambiguous link as text: %s', (href) => {
    const source = `[Open](${href})`;
    const article = render(source);
    expect(article.getElementsByTagName('a').length).toBe(0);
    expect(article.textContent).toBe(source);
  });

  it('INT-1032 treats raw HTML, images and attribute-shaped text as content', () => {
    const source =
      '<img src=x onerror="alert(1)"> <script>alert(2)</script> ' +
      '![image](https://example.com/track.png) [Read](https://example.com/"onmouseover="alert(3))';
    const article = render(source);
    expect(article.getElementsByTagName('img').length).toBe(0);
    expect(article.getElementsByTagName('script').length).toBe(0);
    const anchors = article.getElementsByTagName('a');
    expect(anchors.length).toBe(1);
    expect(anchors[0]?.hasAttribute('onmouseover')).toBe(false);
    expect(article.textContent).toContain('<script>alert(2)</script>');
    expect(article.textContent).toContain('![image](https://example.com/track.png)');
  });

  it('INT-1031 INT-1032 supports escaped markup, nested inline code and literal unsupported syntax', () => {
    const host = document.createElement('p');
    for (const child of inlineProse('\\*literal\\* **keep `this`** [unfinished](url'))
      host.appendChild(child);
    expect(host.textContent).toBe('*literal* keep this [unfinished](url');
    expect(host.getElementsByTagName('em').length).toBe(0);
    expect(
      host.getElementsByTagName('strong')[0]?.getElementsByTagName('code')[0]?.textContent,
    ).toBe('this');
    expect(documentation(null)).toEqual([]);
    expect(documentation('  \n')).toEqual([]);
  });
});
