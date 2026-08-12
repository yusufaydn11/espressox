/** iyzico HMACSHA256 (IYZWSv2) auth + webhook signature verification. */

export type IyzicoEnv = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
};

export function resolveIyzicoEnv(): IyzicoEnv | null {
  const apiKey = Deno.env.get("IYZICO_API_KEY") ?? "";
  const secretKey = Deno.env.get("IYZICO_SECRET_KEY") ?? "";
  const paymentEnv = (Deno.env.get("PAYMENT_ENV") ?? "sandbox").toLowerCase();
  const baseUrl = (Deno.env.get("IYZICO_BASE_URL") ?? "").replace(/\/$/, "")
    || (paymentEnv === "production" ? "https://api.iyzipay.com" : "https://sandbox-api.iyzipay.com");

  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey, baseUrl };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildIyzicoAuthorizationAsync(
  apiKey: string,
  secretKey: string,
  uriPath: string,
  requestBody: string,
): Promise<{ authorization: string; randomKey: string }> {
  const randomKey = `${Date.now()}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const payload = requestBody ? `${randomKey}${uriPath}${requestBody}` : `${randomKey}${uriPath}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const encryptedData = toHex(digest);

  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${encryptedData}`;
  const base64EncodedAuthorization = btoa(authorizationString);

  return {
    authorization: `IYZWSv2 ${base64EncodedAuthorization}`,
    randomKey,
  };
}

export async function iyzicoRequest<T>(
  env: IyzicoEnv,
  uriPath: string,
  body: Record<string, unknown>,
): Promise<T> {
  const requestBody = JSON.stringify(body);
  const { authorization, randomKey } = await buildIyzicoAuthorizationAsync(
    env.apiKey,
    env.secretKey,
    uriPath,
    requestBody,
  );

  const res = await fetch(`${env.baseUrl}${uriPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authorization,
      "x-iyzi-rnd": randomKey,
    },
    body: requestBody,
  });

  const data = await res.json();
  return data as T;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Direct-format webhook: HMAC-SHA256(secretKey, secretKey+iyziEventType+paymentId+paymentConversationId+status) */
export async function verifyIyzicoWebhookV3(
  secretKey: string,
  payload: {
    iyziEventType?: string;
    paymentId?: string;
    paymentConversationId?: string;
    status?: string;
  },
  signatureHeader: string,
): Promise<boolean> {
  const iyziEventType = String(payload.iyziEventType ?? "");
  const paymentId = String(payload.paymentId ?? "");
  const paymentConversationId = String(payload.paymentConversationId ?? "");
  const status = String(payload.status ?? "");

  const message = `${secretKey}${iyziEventType}${paymentId}${paymentConversationId}${status}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const expected = toHex(digest);
  const normalized = signatureHeader.trim().toLowerCase();
  return timingSafeEqual(expected, normalized);
}

export function formatIyzicoPrice(amount: number): string {
  return amount.toFixed(2);
}

export function decodeThreeDSHtmlContent(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return encoded;
  }
}

export function resolveWebhookSecret(iyzicoSecretKey: string): string {
  return Deno.env.get("IYZICO_WEBHOOK_SECRET") ?? iyzicoSecretKey;
}

export function resolveCallbackUrl(supabaseUrl: string): string {
  const configured = Deno.env.get("IYZICO_CALLBACK_URL") ?? "";
  if (configured) return configured;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/retail-payment-webhook?action=callback`;
}

export function resolveDeepLinkBase(): string {
  return Deno.env.get("RETAIL_PAYMENT_DEEP_LINK") ?? "espressox://payment/result";
}
