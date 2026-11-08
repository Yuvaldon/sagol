// Codes of failures that happen before the UI can show anything (OI-003).

export const STARTUP_ERROR_CODES = {
  /** `index.html` has no element with `DOM.rootElementId`. */
  rootElementMissing: 'startup/root_element_missing',
} as const
