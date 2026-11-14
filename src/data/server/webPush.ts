import type { TimeSource } from '@contracts'
import { NOTIFICATIONS } from '@config'
import { instantAt, millisecondsUntil } from '@domain'
import type { PushDevice, PushSender } from './push'

// The `PushSender` port over the Web Push protocol (D-354, D-435), owned end to end: the payload is encrypted for the
// install's keys (RFC 8291 over RFC 8188 `aes128gcm`), the request carries a VAPID token (RFC 8292), and it is posted
// with `redirect: 'manual'`, so a push service that answers with a redirect is a failed delivery, never followed.
// Only standard Web Crypto, so the same code runs in the server function and in the unit tests.

/** RFC 8188 record size. A push payload is one record, far below it. */
const RECORD_SIZE = 4096
/** The delimiter that ends the last (here, the only) record (RFC 8188 §2). */
const LAST_RECORD = 0x02
/** Statuses by which a push service says the install no longer exists. */
const GONE = new Set([404, 410])

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const
const SIGNING = { name: 'ECDSA', namedCurve: 'P-256' } as const
const encoder = new TextEncoder()

/** A push the service did not accept. Carries the status only: never the endpoint, which names the install (D-335). */
export class PushDeliveryError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`push_rejected_${String(status)}`)
    this.status = status
  }
}

export interface WebPushDependencies {
  /** `PUSH_VAPID_PRIVATE_KEY`: the P-256 private key as a JSON Web Key, its public half is the same key without `d`. */
  readonly privateJwk: string
  /** `PUSH_VAPID_SUBJECT`: an https or mailto URL the push services may reach the operator through. */
  readonly subject: string
  readonly fetch: typeof fetch
  readonly time: TimeSource
}

function concat(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** HKDF-SHA-256 (RFC 5869), `bytes` long. */
async function hkdf(ikm: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

/** `label` as RFC 8188 and RFC 8291 spell an info string: ASCII, then a zero byte. */
const infoOf = (label: string) => concat(encoder.encode(label), new Uint8Array([0]))

/**
 * The `aes128gcm` body of one push for the install with public key `p256dh` and secret `auth` (RFC 8291 §3.4). A fresh
 * key pair and salt per push, as the RFC asks, so no two pushes share a content key.
 */
export async function encryptPush(device: Pick<PushDevice, 'p256dh' | 'auth'>, plaintext: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = decodeBase64Url(device.p256dh)
  const authSecret = decodeBase64Url(device.auth)
  const local = await crypto.subtle.generateKey(P256, false, ['deriveBits'])
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const remote = await crypto.subtle.importKey('raw', uaPublic, P256, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: remote }, local.privateKey, 256))

  const ikm = await hkdf(shared, authSecret, concat(infoOf('WebPush: info'), uaPublic, localPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const contentKey = await hkdf(ikm, salt, infoOf('Content-Encoding: aes128gcm'), 16)
  const nonce = await hkdf(ikm, salt, infoOf('Content-Encoding: nonce'), 12)

  const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([LAST_RECORD]))),
  )
  const header = new Uint8Array(21)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header.set(salt, 0)
  header[20] = localPublic.length
  return concat(header, localPublic, sealed)
}

/** A signed ES256 JWT for the push service at `audience` (RFC 8292 §2). */
async function vapidToken(key: CryptoKey, audience: string, subject: string, nowSeconds: number): Promise<string> {
  const part = (value: object) => encodeBase64Url(encoder.encode(JSON.stringify(value)))
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: audience, exp: nowSeconds + NOTIFICATIONS.pushVapidTokenSeconds, sub: subject })}`
  // Web Crypto signs ECDSA as r‖s, the form JWS asks for.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)))
  return `${unsigned}.${encodeBase64Url(signature)}`
}

export async function createWebPushSender(dependencies: WebPushDependencies): Promise<PushSender> {
  const jwk: JsonWebKey = JSON.parse(dependencies.privateJwk)
  const { kty, crv, x, y, d } = jwk
  if (kty !== 'EC' || crv !== 'P-256' || x === undefined || y === undefined || d === undefined) throw new Error('webpush: PUSH_VAPID_PRIVATE_KEY is not a P-256 private JWK')
  const privateKey: JsonWebKey = { kty, crv, x, y, d }
  const signingKey = await crypto.subtle.importKey('jwk', privateKey, SIGNING, false, ['sign'])
  // The application server key the browsers subscribed with: the uncompressed point 04‖x‖y.
  const publicKey = encodeBase64Url(concat(new Uint8Array([4]), decodeBase64Url(x), decodeBase64Url(y)))
  return {
    async send(device, payload) {
      const body = await encryptPush(device, encoder.encode(JSON.stringify(payload)))
      const nowSeconds = Math.floor(millisecondsUntil(instantAt(0), dependencies.time.now()) / 1000)
      const token = await vapidToken(signingKey, new URL(device.endpoint).origin, dependencies.subject, nowSeconds)
      const response = await dependencies.fetch(device.endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: String(NOTIFICATIONS.pushTtlSeconds),
          Urgency: NOTIFICATIONS.pushUrgency,
          Authorization: `vapid t=${token}, k=${publicKey}`,
        },
        body,
      })
      // The body is never read: release it.
      await response.body?.cancel()
      if (response.status >= 200 && response.status < 300) return 'sent'
      if (GONE.has(response.status)) return 'gone'
      // A redirect (3xx, or the opaque status 0 a browser gives one) is refused like any other answer.
      throw new PushDeliveryError(response.status)
    },
  }
}
