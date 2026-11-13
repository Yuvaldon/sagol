// Prints a fresh VAPID key pair for push (D-352). Nothing is written to disk: the private key goes to the function
// secret PUSH_VAPID_PRIVATE_KEY, the public key to the app variable VITE_PUSH_PUBLIC_KEY. Never commit either line.
//
//   node scripts/generate-vapid-keys.ts
const { subtle } = globalThis.crypto
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const { kty, crv, x, y, d } = await subtle.exportKey('jwk', pair.privateKey)
const raw = Buffer.from(await subtle.exportKey('raw', pair.publicKey)).toString('base64url')

console.log(`PUSH_VAPID_PRIVATE_KEY=${JSON.stringify({ kty, crv, x, y, d })}`)
console.log(`VITE_PUSH_PUBLIC_KEY=${raw}`)
