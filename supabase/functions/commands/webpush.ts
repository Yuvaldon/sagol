// The `PushSender` port over the Web Push protocol (D-354): VAPID-signed, payload encrypted for the install's keys.
// Only wiring: who gets what is decided in the data layer.
import type { PushDevice, PushSender } from '@data/server'
import { ApplicationServer, importVapidKeys, PushMessageError } from '@negrel/webpush'

/** Statuses by which a push service says the install no longer exists. */
const GONE = new Set([404, 410])

/**
 * `privateJwk` is the secret `PUSH_VAPID_PRIVATE_KEY`: the P-256 private key as a JSON Web Key. Its public half is the
 * same key without `d`; the app's `VITE_PUSH_PUBLIC_KEY` is that public key, raw and base64url. `subject` is
 * `PUSH_VAPID_SUBJECT`, an https URL the push services may reach the operator through.
 */
export async function createWebPushSender(privateJwk: string, subject: string): Promise<PushSender> {
  const key: JsonWebKey = JSON.parse(privateJwk)
  const { kty, crv, x, y, d } = key
  const vapidKeys = await importVapidKeys({ publicKey: { kty, crv, x, y }, privateKey: { kty, crv, x, y, d } })
  const server = await ApplicationServer.new({ contactInformation: subject, vapidKeys })
  return {
    async send(device: PushDevice, payload) {
      try {
        await server.subscribe({ endpoint: device.endpoint, keys: { auth: device.auth, p256dh: device.p256dh } }).pushTextMessage(JSON.stringify(payload), {})
        return 'sent'
      } catch (error) {
        if (error instanceof PushMessageError && GONE.has(error.response.status)) return 'gone'
        throw error
      }
    },
  }
}
