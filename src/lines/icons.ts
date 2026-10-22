// The v1 icon set by name, in the order of LOOK-402 (docs/spec/look.md). An `icon` line must name
// one of these (E201). The drawings themselves belong to the renderer.
export const ICON_NAMES = [
  'person',
  'stack',
  'web',
  'api',
  'gear',
  'module',
  'route',
  'dice',
  'search',
  'books',
  'grid',
  'monitor',
  'cylinder',
  'history',
  'refresh',
  'document',
  'archive',
  'building',
  'box',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
