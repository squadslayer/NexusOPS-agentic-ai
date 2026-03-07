import * as crypto from 'crypto';

/**
 * Fernet-compatible decryption utility.
 * Fernet is basically AES-128-CBC with HMAC-SHA256.
 */
export function decryptToken(encryptedTokenB64: string, rawKey: string): string {
    // 1. Replicate Python's key derivation logic
    let keyStr: string;
    if (rawKey.length < 32) {
        keyStr = Buffer.from((rawKey.repeat(4)).substring(0, 32)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    } else {
        keyStr = Buffer.from(rawKey.substring(0, 32)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    }

    // Fernet keys must be 32 bytes after base64 decoding
    const key = Buffer.from(keyStr, 'base64');
    if (key.length !== 32) {
        throw new Error(`Invalid Fernet key length: ${key.length}. Expected 32 bytes.`);
    }

    const signingKey = key.slice(0, 16);
    const encryptionKey = key.slice(16);

    // 2. Decode the token from Base64
    // Note: BFF does base64.b64encode(fernet_output). If so, it's double-encoded or just encoded once.
    // Fernet itself outputs a URL-safe Base64 string.
    // Let's assume it's standard base64 from current BFF implementation.
    const token = Buffer.from(encryptedTokenB64, 'base64');

    // 3. Inspect Fernet Header
    const version = token[0];
    if (version !== 0x80) {
        throw new Error(`Unsupported Fernet version: 0x${version.toString(16)}`);
    }

    // Format: [0x80(1)][timestamp(8)][IV(16)][ciphertext(...)][HMAC(32)]
    const iv = token.slice(9, 25);
    const ciphertext = token.slice(25, token.length - 32);
    const hmac = token.slice(token.length - 32);

    // 4. Verify HMAC
    const hmacInput = token.slice(0, token.length - 32);
    const calculatedHmac = crypto.createHmac('sha256', signingKey).update(hmacInput).digest();

    if (!crypto.timingSafeEqual(hmac, calculatedHmac)) {
        throw new Error('Fernet token HMAC verification failed. Key mismatch or corrupted data.');
    }

    // 5. Decrypt AES-128-CBC
    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    let decrypted = decipher.update(ciphertext as any, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
