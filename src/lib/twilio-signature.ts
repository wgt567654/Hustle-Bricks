import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates an X-Twilio-Signature header per Twilio's scheme:
 * take the full URL Twilio requested (including any query string), append
 * every POST parameter name + value sorted alphabetically by name, HMAC-SHA1
 * the result with the account's auth token, and base64-encode it.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature({
  authToken,
  signature,
  url,
  params,
}: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  if (!signature) return false;

  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }

  const expected = createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
