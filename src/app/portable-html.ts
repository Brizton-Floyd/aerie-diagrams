/** INT-1021: the complete model and the picture a portable reader opens with. */
export interface PortableSnapshot {
  path: string;
  source: string;
  fragment: string;
  theme: 'dark' | 'light';
  title: string;
}

/** JSON data safe inside an HTML script element, including literal script end tags. */
export function embeddedJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function htmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** INT-1024: one standalone document; source is data, never executable markup. */
export function portableHtml(snapshot: PortableSnapshot, runtime: string): string {
  const script = runtime.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en" data-theme="${snapshot.theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>${htmlText(snapshot.title)} - Aerie</title>
</head>
<body>
<div id="app" class="page"></div>
<script type="application/json" id="aerie-export">${embeddedJson(snapshot)}</script>
<script>${script}</script>
</body>
</html>
`;
}
