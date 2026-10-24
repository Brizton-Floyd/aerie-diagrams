/** Saves model text as a .aerie file, using the source's basename (INT-508, INT-808). */
export function downloadModel(path: string, source: string): void {
  const name = path.split('/').pop() ?? '';
  const base = name.replace(/\.aerie$/, '');
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${base === '' ? 'model' : base}.aerie`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
