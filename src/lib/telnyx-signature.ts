import { createPublicKey, verify as cryptoVerify } from "node:crypto";

// SPKI/DER prefix for a raw 32-byte Ed25519 public key.
// 302a300506032b6570032100 + <32 raw key bytes> = a valid SubjectPublicKeyInfo.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verifies a Telnyx webhook signature.
 *
 * Telnyx signs each webhook with Ed25519 over `${timestamp}|${rawBody}` and
 * sends the base64 signature in `telnyx-signature-ed25519` and the timestamp in
 * `telnyx-timestamp`. The verifying key is Telnyx's base64 Ed25519 public key,
 * provided via the TELNYX_PUBLIC_KEY env var.
 * https://developers.telnyx.com/docs/messaging/messages/signature-verification
 *
 * Degrades gracefully: if TELNYX_PUBLIC_KEY is unset we log and return true
 * (skip verification) so inbound webhooks don't hard-fail before the key is
 * configured — mirroring how the outbound path queues without credentials.
 */
export function verifyTelnyxSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKeyB64) {
    console.warn(
      "[sms-webhook] TELNYX_PUBLIC_KEY not set — skipping Telnyx signature verification"
    );
    return true;
  }

  if (!signature || !timestamp) return false;

  try {
    const rawKey = Buffer.from(publicKeyB64, "base64");
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
      format: "der",
      type: "spki",
    });

    const signedPayload = Buffer.from(`${timestamp}|${rawBody}`, "utf-8");
    const signatureBuffer = Buffer.from(signature, "base64");

    return cryptoVerify(null, signedPayload, publicKey, signatureBuffer);
  } catch (err) {
    console.error("[sms-webhook] Telnyx signature verification error:", err);
    return false;
  }
}
