// Public entry point of the I18N layer.
// The single dictionary of all user-facing strings (Hebrew). No UI string is
// allowed anywhere else.
import { dictionary } from './he/dictionary'

export { dictionary }

type KeysOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : KeysOf<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** A dot path to a string of the dictionary. A key that does not exist is a compile error. */
export type I18nKey = KeysOf<typeof dictionary>

function flatten(node: object, prefix: string, into: Map<string, string>): Map<string, string> {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') into.set(`${prefix}${key}`, value)
    else flatten(value, `${prefix}${key}.`, into)
  }
  return into
}

const STRINGS = flatten(dictionary, '', new Map())

export function t(key: I18nKey): string {
  return STRINGS.get(key) ?? key
}
