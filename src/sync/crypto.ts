/**
 * Cryptographie de la synchronisation.
 *
 * Une seule clé secrète — la « clé de synchronisation » — est générée sur le
 * premier appareil et recopiée sur les suivants. Elle ne quitte jamais le client.
 * Trois valeurs en sont dérivées, séparément et sans lien calculable entre elles :
 *
 *   accountId  = SHA-256(clé ‖ "id")   tronqué à 16 octets — identifiant public
 *   token      = SHA-256(clé ‖ "auth")                     — jeton d'authentification
 *   encKey     = SHA-256(clé ‖ "enc")                      — clé AES-256-GCM
 *
 * Le serveur ne connaît que `accountId` et le SHA-256 du jeton : il ne peut ni
 * déchiffrer le contenu, ni retrouver la clé.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Alphabet Crockford base32 : ni I, ni L, ni O, ni U — pas de confusion à la saisie. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(input: string): Uint8Array {
  // Tolérant à la saisie : casse libre, tirets et espaces ignorés,
  // confusions classiques corrigées (O→0, I/L→1).
  const clean = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Caractère invalide dans la clé : « ${char} »`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

const KEY_BYTES = 32;

/** Nouvelle clé de synchronisation, formatée en groupes de 5 pour la recopie. */
export function generateSyncKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  return formatSyncKey(toBase32(bytes));
}

export function formatSyncKey(key: string): string {
  const clean = key.toUpperCase().replace(/[\s-]/g, '');
  return (clean.match(/.{1,5}/g) ?? []).join('-');
}

export function isValidSyncKey(key: string): boolean {
  try {
    return fromBase32(key).length >= KEY_BYTES;
  } catch {
    return false;
  }
}

async function derive(key: string, purpose: string): Promise<Uint8Array> {
  const material = new Uint8Array([...fromBase32(key), ...encoder.encode(purpose)]);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return new Uint8Array(digest);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Identifiant public du compte : 32 caractères hexadécimaux. */
export async function deriveAccountId(key: string): Promise<string> {
  return toHex((await derive(key, 'id')).slice(0, 16));
}

/** Jeton d'authentification. Le serveur n'en stocke que le SHA-256. */
export async function deriveToken(key: string): Promise<string> {
  return toHex(await derive(key, 'auth'));
}

async function encryptionKey(key: string): Promise<CryptoKey> {
  const raw = await derive(key, 'enc');
  // `importKey` exige un BufferSource au sens strict : l'assertion est nécessaire ici,
  // contrairement aux appels `digest`/`encrypt` qui acceptent directement l'Uint8Array.
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Chiffre en AES-256-GCM. Le vecteur d'initialisation précède le texte chiffré. */
export async function encryptPayload(key: string, payload: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(key),
    encoder.encode(JSON.stringify(payload)),
  );
  return toBase64(new Uint8Array([...iv, ...new Uint8Array(cipher)]));
}

export async function decryptPayload<T>(key: string, blob: string): Promise<T> {
  const bytes = fromBase64(blob);
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(key),
    cipher,
  );
  return JSON.parse(decoder.decode(plain)) as T;
}
