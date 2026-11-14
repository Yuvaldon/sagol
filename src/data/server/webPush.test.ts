import { NOTIFICATIONS } from '@config'
import { PushPayload } from '@contracts'
import { instantAt, millisecondsUntil } from '@domain'
import { describe, expect, it } from 'vitest'
import { PushDeliveryError, createWebPushSender, decodeBase64Url, encodeBase64Url, encryptPush } from './webPush'

// The owned Web Push request (D-435): the test plays the browser, decrypting what the sender posts, and the push
// service, answering with each status. Test data only.

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const
const NOW = '2026-11-14T10:00:00.000Z'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/install-1'
const PAYLOAD = PushPayload.parse({
  kind: 'my_request',
  outcome: 'approved',
  leave_id: '00000000-0000-4000-8000-000000000001',
  count: 1,
  start_date: '2026-11-20',
  end_date: '2026-11-22',
})

async function hkdf(ikm: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, label: string, extra: Uint8Array, bytes: number) {
  const info = new Uint8Array([...new TextEncoder().encode(label), 0, ...extra])
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

/** A browser install: its key pair and auth secret, and how it reads a push (RFC 8291 §3.4, RFC 8188 §2). */
async function browser() {
  const keys = await crypto.subtle.generateKey(P256, true, ['deriveBits'])
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const device = { endpoint: ENDPOINT, p256dh: encodeBase64Url(publicRaw), auth: encodeBase64Url(auth) }
  async function read(body: Uint8Array<ArrayBuffer>): Promise<string> {
    const salt = body.slice(0, 16)
    const recordSize = new DataView(body.buffer).getUint32(16)
    const idLength = body[20] ?? 0
    const serverPublic = body.slice(21, 21 + idLength)
    expect(recordSize).toBe(4096)
    const server = await crypto.subtle.importKey('raw', serverPublic, P256, false, [])
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: server }, keys.privateKey, 256))
    const ikm = await hkdf(shared, auth, 'WebPush: info', new Uint8Array([...publicRaw, ...serverPublic]), 32)
    const contentKey = await hkdf(ikm, salt, 'Content-Encoding: aes128gcm', new Uint8Array(), 16)
    const nonce = await hkdf(ikm, salt, 'Content-Encoding: nonce', new Uint8Array(), 12)
    const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt'])
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idLength)))
    expect(plain.at(-1)).toBe(2)
    return new TextDecoder().decode(plain.slice(0, -1))
  }
  return { device, read }
}

interface Posted {
  readonly url: string
  readonly init: RequestInit
}

/** A push service that answers every post with `status`, and records what it got. */
function pushService(status: number) {
  const posted: Posted[] = []
  const fetch: typeof globalThis.fetch = (input, init = {}) => {
    posted.push({ url: String(input), init })
    const redirect = status >= 300 && status < 400
    return Promise.resolve(new Response(null, { status, headers: redirect ? { Location: 'https://elsewhere.example/' } : {} }))
  }
  return { posted, fetch }
}

async function vapidKeys() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return { privateJwk: JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey)), publicKey: keys.publicKey }
}

async function senderFor(status: number) {
  const service = pushService(status)
  const vapid = await vapidKeys()
  const sender = await createWebPushSender({
    privateJwk: vapid.privateJwk,
    subject: 'mailto:operator@example.org',
    fetch: service.fetch,
    time: { now: () => NOW },
  })
  return { sender, service, vapid }
}

const headersOf = (posted: Posted) => new Headers(posted.init.headers)

describe('the owned web push request (D-435)', () => {
  it('posts the payload encrypted for the install, which reads it back', async () => {
    const install = await browser()
    const { sender, service } = await senderFor(201)
    await expect(sender.send(install.device, PAYLOAD)).resolves.toBe('sent')
    const [post] = service.posted
    if (post === undefined) throw new Error('nothing posted')
    expect(post.url).toBe(ENDPOINT)
    expect(post.init.method).toBe('POST')
    expect(JSON.parse(await install.read(post.init.body as Uint8Array<ArrayBuffer>))).toEqual(PAYLOAD)
  })

  it('never follows a redirect: it asks for the redirect itself and refuses it', async () => {
    const install = await browser()
    const { sender, service } = await senderFor(307)
    await expect(sender.send(install.device, PAYLOAD)).rejects.toBeInstanceOf(PushDeliveryError)
    expect(service.posted).toHaveLength(1)
    expect(service.posted[0]?.init.redirect).toBe('manual')
  })

  it('refuses the opaque answer a browser gives a redirect', async () => {
    const install = await browser()
    const service = { posted: [] as Posted[] }
    const vapid = await vapidKeys()
    const opaque = Response.error()
    const sender = await createWebPushSender({
      privateJwk: vapid.privateJwk,
      subject: 'mailto:operator@example.org',
      fetch: (input, init = {}) => {
        service.posted.push({ url: String(input), init })
        return Promise.resolve(opaque)
      },
      time: { now: () => NOW },
    })
    await expect(sender.send(install.device, PAYLOAD)).rejects.toBeInstanceOf(PushDeliveryError)
  })

  it.each([404, 410])('answers gone when the service says the install is gone (%i)', async (status) => {
    const install = await browser()
    const { sender } = await senderFor(status)
    await expect(sender.send(install.device, PAYLOAD)).resolves.toBe('gone')
  })

  it('throws on any other failure, without naming the endpoint (D-335)', async () => {
    const install = await browser()
    const { sender } = await senderFor(500)
    const error: unknown = await sender.send(install.device, PAYLOAD).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PushDeliveryError)
    expect(String(error)).not.toContain('install-1')
  })

  it('carries the configured TTL and urgency, and a VAPID token for the service origin (RFC 8292)', async () => {
    const install = await browser()
    const { sender, service, vapid } = await senderFor(201)
    await sender.send(install.device, PAYLOAD)
    const [post] = service.posted
    if (post === undefined) throw new Error('nothing posted')
    const headers = headersOf(post)
    expect(headers.get('TTL')).toBe(String(NOTIFICATIONS.pushTtlSeconds))
    expect(headers.get('Urgency')).toBe(NOTIFICATIONS.pushUrgency)
    expect(headers.get('Content-Encoding')).toBe('aes128gcm')

    const match = /^vapid t=([^,]+), k=(.+)$/.exec(headers.get('Authorization') ?? '')
    if (match === null) throw new Error('no VAPID authorization')
    const [, token = '', key = ''] = match
    expect(key).toBe(encodeBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey))))
    const [header = '', claims = '', signature = ''] = token.split('.')
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapid.publicKey,
      decodeBase64Url(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    )
    expect(valid).toBe(true)
    expect(JSON.parse(new TextDecoder().decode(decodeBase64Url(claims)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: millisecondsUntil(instantAt(0), NOW) / 1000 + NOTIFICATIONS.pushVapidTokenSeconds,
      sub: 'mailto:operator@example.org',
    })
  })

  it('encrypts each push with its own key and salt', async () => {
    const install = await browser()
    const { sender, service } = await senderFor(201)
    await sender.send(install.device, PAYLOAD)
    await sender.send(install.device, PAYLOAD)
    const [first, second] = service.posted.map((post) => post.init.body as Uint8Array)
    expect(first?.slice(0, 86)).not.toEqual(second?.slice(0, 86))
  })
})

// RFC 8291 Appendix A: the RFC's own keys, salt and message, and the exact body it publishes (D-435).
const RFC8291 = {
  plaintext: 'When I grow up, I want to be a watermelon',
  serverPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  serverPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

describe('the encryption against RFC 8291 Appendix A', () => {
  it('produces the body the RFC publishes', async () => {
    const point = decodeBase64Url(RFC8291.serverPublic)
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: encodeBase64Url(point.slice(1, 33)),
      y: encodeBase64Url(point.slice(33, 65)),
      d: RFC8291.serverPrivate,
    }
    const privateKey = await crypto.subtle.importKey('jwk', jwk, P256, false, ['deriveBits'])
    const publicKey = await crypto.subtle.importKey('raw', point, P256, true, [])
    const body = await encryptPush(
      { p256dh: RFC8291.uaPublic, auth: RFC8291.auth },
      new TextEncoder().encode(RFC8291.plaintext),
      { keys: { privateKey, publicKey }, salt: decodeBase64Url(RFC8291.salt) },
    )
    expect(encodeBase64Url(body)).toBe(RFC8291.body)
  })
})
