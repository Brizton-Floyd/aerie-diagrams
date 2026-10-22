// Box anatomy (docs/spec/look.md, LOOK-201): the metrics the layout sizes boxes and labels with.

export const BOX = {
  /** Inner padding of a box. */
  pad: 12,
  /** Icon size; the icon's top left is at (pad, pad). */
  icon: 22,
  /** Space between the icon and the text. */
  iconGap: 10,
  /** The name's line. */
  nameLine: 18,
  /** Each tagline line. */
  textLine: 17,
  /** The chip line at the bottom of a closed container. */
  chipLine: 20,
  /** The open and close control, a circle at the top right, `pad` from the edges. */
  toggle: 18,
  /** Space kept between text and the control. */
  toggleGap: 10,
  /** Space between an open container's header text and its children. */
  headGap: 6,
  /** The narrowest a leaf or closed box may be. */
  minWidth: 150,
  /** Padding between an open container's edge and its children. */
  containerPad: 18,
  /** How far inside the outline the inner contour line runs. */
  inset: 5,
  /** Label padding, left and right. */
  labelPadX: 5,
  /** Label padding, top and bottom. */
  labelPadY: 2,
  /** Each label line. */
  labelLine: 17,
} as const;

/** LAYOUT-204: where box text starts, from the left of the box. */
export const TEXT_LEFT = BOX.pad + BOX.icon + BOX.iconGap;

/** LAYOUT-202: the width the open and close control takes from a container's text. */
export function control(container: boolean): number {
  return container ? BOX.toggle + BOX.toggleGap : 0;
}
