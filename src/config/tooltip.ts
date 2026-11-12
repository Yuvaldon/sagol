// When an icon button shows its name as a tooltip (V20). The name is always its accessible name;
// the tooltip only makes it visible to a pointer or keyboard user.

export const TOOLTIP = {
  /** How long a pointer rests on a control before its tooltip appears. */
  delayMs: 500,
  /** How long the next control's tooltip waits once one has been shown. */
  closeDelayMs: 200,
  /** The gap between the control and its tooltip. */
  offsetPx: 6,
  /**
   * Where a tooltip renders: inside the landmark or dialog that holds its trigger, so axe finds it in a landmark and a
   * modal's hiding of the rest does not hide it.
   */
  containerSelector:
    'dialog, [role=dialog], nav, main, header, footer, aside, section[aria-label], [role=search], [role=region]',
} as const
