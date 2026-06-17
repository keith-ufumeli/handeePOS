/**
 * generate-oct-keys.ts — P8-02: ECDSA keypair generator for OCT signing
 *
 * Generates a P-256 (ES256) keypair for signing Offline Capability Tokens.
 *
 * Usage:
 *   npx ts-node scripts/generate-oct-keys.ts
 *
 * Output:
 *   1. OCT_EC_PRIVATE_KEY_PEM  — add to backend .env (keep secret)
 *   2. OCT_EC_PUBLIC_KEY_PEM   — add to backend .env (used by verifyOfflineCapabilityToken)
 *   3. OCT_PUBLIC_KEY_JWK      — embed in mobile app (cryptoService.ts → OCT_SIGNING_PUBLIC_KEY_JWK)
 *
 * Security notes:
 *   - The private key MUST stay on the server. Never commit it or ship it in the app.
 *   - Rotate keys by generating a new pair; old offline sessions will require re-auth.
 *   - Use separate keypairs for each environment (dev / staging / production).
 */

import { generateKeyPairSync } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
const publicKeyJwk = publicKey.export({ format: 'jwk' });

console.log('# ─────────────────────────────────────────────────────────────────');
console.log('# OCT Signing Keys — generated', new Date().toISOString());
console.log('# Add these to your .env file (backend).');
console.log('# The JWK block is embedded in the mobile app (cryptoService.ts).');
console.log('# ─────────────────────────────────────────────────────────────────\n');

console.log('# 1. BACKEND .env — Private key (server only, keep secret):');
console.log(`OCT_EC_PRIVATE_KEY_PEM="${privateKeyPem.replace(/\n/g, '\\n')}"`);
console.log('');
console.log('# 2. BACKEND .env — Public key (used by verifyOfflineCapabilityToken):');
console.log(`OCT_EC_PUBLIC_KEY_PEM="${publicKeyPem.replace(/\n/g, '\\n')}"`);
console.log('');
console.log('# 3. MOBILE — Embed as OCT_SIGNING_PUBLIC_KEY_JWK in cryptoService.ts:');
console.log(JSON.stringify(publicKeyJwk, null, 2));
