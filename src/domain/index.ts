// Public entry point of the DOMAIN layer (D-007).
// Pure rules: permission policy, hierarchy, leave state machine, availability
// and rule evaluation, filter evaluation, property validation. No I/O, no React.
// Imports @contracts and @internationalized/date only (D-035). Never reads a clock:
// callers pass `today` and `now` (D-053).

export * from './time'
export * from './hierarchy'
export * from './policy'
