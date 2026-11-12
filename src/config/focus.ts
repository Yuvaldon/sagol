// Focus mode's key (D-301): with modifiers, so typing never triggers it (WCAG 2.1.4). `code` names the physical
// key, so the Hebrew layout presses the same one.

export const FOCUS_MODE = {
  /** `KeyboardEvent.code` of the key. */
  code: 'KeyF',
  altKey: true,
  shiftKey: true,
  /** The key as `aria-keyshortcuts` and the tooltip spell it. */
  shortcut: 'Alt+Shift+F',
  /** What an Escape belongs to before focus mode: an open dialog, menu or popover closes first. */
  overlay: '[role=dialog], [role=alertdialog], [role=menu], [role=listbox]',
} as const
