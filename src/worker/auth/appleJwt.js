const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/

export const APPLE_ISSUER = 'https://appleid.apple.com'

function base64UrlDecode(value) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function decodeJwtPart(part) {
  if (!part || !BASE64URL_REGEX.test(part)) {
    throw new Error('Invalid JWT segment.')
  }

  const json = new TextDecoder().decode(base64UrlDecode(part))
  return JSON.parse(json)
}

function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function normalizeApplePrivateKey(privateKey) {
  if (!privateKey) {
    return ''
  }

  return privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey
}

export async function importApplePrivateKey(privateKeyPem) {
  const pem = normalizeApplePrivateKey(privateKeyPem)
  const contents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binary = atob(contents)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

export async function createAppleClientSecret({
  teamId,
  clientId,
  keyId,
  privateKeyPem,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const header = {
    alg: 'ES256',
    kid: keyId,
  }
  const payload = {
    iss: teamId,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60 * 24 * 150,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const key = await importApplePrivateKey(privateKeyPem)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )

  const derSignature = new Uint8Array(signature)
  const rawSignature = derEcSignatureToJose(derSignature)
  return `${signingInput}.${base64UrlEncode(rawSignature)}`
}

function derEcSignatureToJose(derSignature) {
  let offset = 0

  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid ECDSA signature.')
  }

  const sequenceLength = derSignature[offset++]
  if (sequenceLength + 2 !== derSignature.length) {
    offset += 1
  }

  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid ECDSA signature.')
  }

  let rLength = derSignature[offset++]
  let r = derSignature.slice(offset, offset + rLength)
  offset += rLength

  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid ECDSA signature.')
  }

  let sLength = derSignature[offset++]
  let s = derSignature.slice(offset, offset + sLength)

  if (r[0] === 0x00) {
    r = r.slice(1)
  }
  if (s[0] === 0x00) {
    s = s.slice(1)
  }

  const raw = new Uint8Array(64)
  raw.set(r, 32 - r.length)
  raw.set(s, 64 - s.length)
  return raw
}

export async function importAppleJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    {
      ...jwk,
      alg: 'ES256',
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}

export async function verifyJwtSignature({ signingInput, signaturePart, publicKey }) {
  const signature = base64UrlDecode(signaturePart)
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signature,
    new TextEncoder().encode(signingInput),
  )
}
