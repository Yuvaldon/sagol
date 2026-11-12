// Focus mode's key (D-301): with modifiers, so typing never triggers it (WCAG 2.1.4). `code` names the physical
// key, so the Hebrew layout presses the same one.

export const FOCUS_MODE = {
  /** `KeyboardEvent.code` of the key. */
  code: 'KeyF',
  altKey: true,
  shiftKey: true,
  /** The key as `aria-keyshortcuts` and the tooltip spell it. */
  shortcut: 'Alt+Shift+F',
  /** The view menu item's key. */
  menuItem: 'focus-mode',
  /** What an Escape belongs to before focus mode: an open dialog, menu or popover closes first; the key stays its own there. */
  overlay: '[role=dialog], [role=alertdialog], [role=menu], [role=listbox]',
  /** Where the key types a letter instead: a text field keeps it. */
  editable: 'input, textarea, select, [contenteditable]:not([contenteditable=false])',
} as const
