/** Saves model text as a .aerie file, using the source's basename (INT-508, INT-808). */
export function downloadModel(path: string, source: string): void {
  const name = path.split('/').pop() ?? '';
  const base = name.replace(/\.aerie$/, '');
  downloadBlob(`${base === '' ? 'model' : base}.aerie`, new Blob([source], { type: 'text/plain' }));
}

/** Downloads a complete file and releases its temporary URL after navigation starts. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
