import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  iyzicoRequest,
  resolveDeepLinkBase,
  resolveIyzicoEnv,
  resolveWebhookSecret,
  verifyIyzicoWebhookV3,
} from "../_shared/iyzico.ts";
import {
  adminClient,
  callServiceRpc,
  corsHeaders,
  html,
  json,
} from "../_shared/retail-payment.ts";

type IyzicoAuthResponse = {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  paymentId?: string;
  paidPrice?: number | string;
  price?: number | string;
  currency?: string;
};

type PaymentIntentRow = {
  id: string;
  order_number: string;
  amount: number;
  currency?: string;
  order_payment_id: string | null;
  status: string;
  conversation_id: string;
  provider_payment_id: string | null;
};

function parseMoney(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function amountsMatch(expected: number, actual: number): boolean {
  return Math.abs(Number(expected) - actual) < 0.005;
}

function validateAuthAmountAndCurrency(
  authRes: IyzicoAuthResponse,
  intent: Pick<PaymentIntentRow, "amount" | "currency">,
): { ok: true } | { ok: false; reason: string } {
  const paidPrice = parseMoney(authRes.paidPrice);
  if (paidPrice === null) {
    return { ok: false, reason: "missing_paid_price" };
  }
  if (!amountsMatch(Number(intent.amount), paidPrice)) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const authCurrency = (authRes.currency ?? "TRY").toUpperCase();
  if (authCurrency !== "TRY" && authCurrency !== "TL") {
    return { ok: false, reason: "unsupported_currency" };
  }

  const intentCurrency = (intent.currency ?? "TRY").toUpperCase();
  if (intentCurrency !== "TRY" && intentCurrency !== "TL") {
    return { ok: false, reason: "intent_currency_mismatch" };
  }

  return { ok: true };
}

type WebhookPayload = {
  paymentConversationId?: string;
  paymentId?: string;
  status?: string;
  iyziReferenceCode?: string;
  iyziEventType?: string;
  iyziEventTime?: number;
  merchantId?: string;
};

function redirectPage(orderNumber: string, status: "success" | "failure", message?: string): Response {
  const base = resolveDeepLinkBase();
  const params = new URLSearchParams({
    order: orderNumber,
    status,
  });
  if (message) params.set("message", message.slice(0, 120));
  const deepLink = `${base}?${params.toString()}`;
  return html(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Ödeme ${status === "success" ? "Başarılı" : "Başarısız"}</title>
  <script>
    window.location.replace(${JSON.stringify(deepLink)});
  </script>
</head>
<body>
  <p>Ödeme işlemi tamamlandı. Uygulamaya yönlendiriliyorsunuz…</p>
  <p><a href="${deepLink}">Devam et</a></p>
</body>
</html>`);
}

async function findIntentByConversation(conversationId: string) {
  const admin = adminClient();
  return admin
    .from("payment_intents")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();
}

async function findIntentByPaymentId(paymentId: string) {
  const admin = adminClient();
  return admin
    .from("payment_intents")
    .select("*")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();
}

async function confirmPaidOrder(
  intent: PaymentIntentRow,
  transactionId: string,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  if (intent.status === "paid") {
    return { ok: true, result: { idempotent: true } };
  }

  const result = await callServiceRpc("confirm_order_payment_webhook", {
    p_order_number: intent.order_number,
    p_amount: Number(intent.amount),
    p_transaction_id: transactionId,
    p_currency: "TRY",
    p_gateway: "iyzico",
    p_payment_id: intent.order_payment_id,
  });

  if (result.error) {
    return { ok: false, error: String(result.error) };
  }

  const admin = adminClient();
  await admin.from("payment_intents").update({
    status: "paid",
    provider_payment_id: transactionId,
    failure_reason: null,
  }).eq("id", intent.id);

  return { ok: true, result };
}

async function markIntentFailed(intentId: string, reason: string) {
  const admin = adminClient();
  await admin.from("payment_intents").update({
    status: "failed",
    failure_reason: reason.slice(0, 500),
  }).eq("id", intentId);
}

async function recordWebhookEvent(
  payload: WebhookPayload,
  signatureValid: boolean | null,
  processed: boolean,
  processResult: Record<string, unknown> | null,
  paymentIntentId?: string | null,
  orderNumber?: string | null,
) {
  const admin = adminClient();
  const providerEventId = String(payload.iyziReferenceCode ?? `${payload.paymentId}-${payload.status}-${payload.iyziEventType}`);

  const { error } = await admin.from("webhook_events").upsert({
    provider: "iyzico",
    event_type: payload.iyziEventType ?? null,
    provider_event_id: providerEventId,
    provider_payment_id: payload.paymentId ?? null,
    payment_intent_id: paymentIntentId ?? null,
    order_number: orderNumber ?? payload.paymentConversationId ?? null,
    payload,
    signature_valid: signatureValid,
    processed,
    process_result: processResult,
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: false });

  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("webhook_events")
      .select("processed, process_result")
      .eq("provider", "iyzico")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    return { duplicate: true, existing };
  }
  return { duplicate: false };
}

async function handleThreeDSCallback(req: Request): Promise<Response> {
  const iyzico = resolveIyzicoEnv();
  if (!iyzico) return html("<p>Payment provider not configured</p>", 503);

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const form: Record<string, string> = {};
  params.forEach((v, k) => { form[k] = v; });

  const paymentId = form.paymentId ?? form.payment_id ?? "";
  const conversationId = form.conversationId ?? form.conversation_id ?? "";
  const conversationData = form.conversationData ?? form.conversation_data ?? "";
  const mdStatus = form.mdStatus ?? form.mdstatus ?? "";

  if (!paymentId) {
    return html("<p>Missing paymentId</p>", 400);
  }

  const { data: intent } = conversationId
    ? await findIntentByConversation(conversationId)
    : await findIntentByPaymentId(paymentId);

  const orderNumber = intent?.order_number ?? conversationId;

  if (!intent) {
    return redirectPage(orderNumber, "failure", "Ödeme oturumu bulunamadı");
  }

  // Idempotent: already confirmed — skip iyzico auth call
  if (intent.status === "paid") {
    return redirectPage(intent.order_number, "success");
  }

  // Cross-check callback paymentId against stored provider reference
  if (intent.provider_payment_id && intent.provider_payment_id !== paymentId) {
    await markIntentFailed(intent.id, "payment_id_mismatch");
    return redirectPage(intent.order_number, "failure", "Ödeme kimliği uyuşmuyor");
  }

  if (mdStatus !== "1") {
    if (intent.id) await markIntentFailed(intent.id, `mdStatus_${mdStatus || "unknown"}`);
    return redirectPage(orderNumber, "failure", "3DS doğrulaması başarısız");
  }

  let authRes: IyzicoAuthResponse;
  try {
    authRes = await iyzicoRequest<IyzicoAuthResponse>(
      iyzico,
      "/payment/3dsecure/auth",
      {
        locale: "tr",
        paymentId,
        conversationId: conversationId || intent.conversation_id,
        conversationData: conversationData || undefined,
      },
    );
  } catch (err) {
    await markIntentFailed(intent.id, (err as Error).message);
    return redirectPage(orderNumber, "failure", "Ödeme doğrulaması başarısız");
  }

  if (authRes.status !== "success") {
    await markIntentFailed(intent.id, authRes.errorMessage ?? authRes.errorCode ?? "auth_failed");
    return redirectPage(orderNumber, "failure", authRes.errorMessage ?? "Ödeme reddedildi");
  }

  const amountCheck = validateAuthAmountAndCurrency(authRes, intent);
  if (!amountCheck.ok) {
    await markIntentFailed(intent.id, amountCheck.reason);
    return redirectPage(intent.order_number, "failure", "Ödeme tutarı doğrulanamadı");
  }

  const confirm = await confirmPaidOrder(intent, paymentId);
  if (!confirm.ok) {
    await markIntentFailed(intent.id, confirm.error ?? "confirm_failed");
    return redirectPage(intent.order_number, "failure", confirm.error ?? "Sipariş onayı başarısız");
  }

  await recordWebhookEvent(
    {
      paymentConversationId: intent.conversation_id,
      paymentId,
      status: "SUCCESS",
      iyziEventType: "THREE_DS_CALLBACK",
      iyziReferenceCode: `callback-${paymentId}-${Date.now()}`,
    },
    null,
    true,
    confirm.result ?? {},
    intent.id,
    intent.order_number,
  );

  return redirectPage(intent.order_number, "success");
}

async function handleIyzicoWebhook(req: Request, rawBody: string): Promise<Response> {
  const iyzico = resolveIyzicoEnv();
  if (!iyzico) return json({ error: "payment_provider_not_configured" }, 503);

  const webhookSecret = resolveWebhookSecret(iyzico.secretKey);
  const signature = req.headers.get("X-IYZ-SIGNATURE-V3") ?? req.headers.get("x-iyz-signature-v3");

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!signature) {
    return json({ error: "missing_signature" }, 401);
  }

  const signatureValid = await verifyIyzicoWebhookV3(webhookSecret, payload, signature);
  if (!signatureValid) {
    return json({ error: "invalid_signature" }, 401);
  }

  const providerEventId = String(payload.iyziReferenceCode ?? "");
  if (!providerEventId) {
    return json({ error: "missing_event_id" }, 400);
  }

  const admin = adminClient();
  const { data: existingEvent } = await admin
    .from("webhook_events")
    .select("id, processed")
    .eq("provider", "iyzico")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (existingEvent?.processed) {
    return json({ received: true, idempotent: true });
  }

  const conversationId = payload.paymentConversationId ?? "";
  const paymentId = payload.paymentId ?? "";

  const { data: intent } = conversationId
    ? await findIntentByConversation(conversationId)
    : paymentId
    ? await findIntentByPaymentId(paymentId)
    : { data: null };

  if (payload.status !== "SUCCESS") {
    if (intent?.id) await markIntentFailed(intent.id, `webhook_${payload.status ?? "failure"}`);
    await recordWebhookEvent(payload, true, true, { ignored: true, status: payload.status }, intent?.id, intent?.order_number);
    return json({ received: true, status: "ignored" });
  }

  if (!intent) {
    await recordWebhookEvent(payload, true, false, { error: "intent_not_found" });
    return json({ received: true, error: "intent_not_found" });
  }

  const confirm = await confirmPaidOrder(intent, paymentId || intent.provider_payment_id || "");
  await recordWebhookEvent(
    payload,
    true,
    confirm.ok,
    confirm.result ?? { error: confirm.error },
    intent.id,
    intent.order_number,
  );

  if (!confirm.ok) {
    return json({ received: true, error: confirm.error }, 422);
  }

  return json({ received: true, confirmed: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "webhook";
    const contentType = req.headers.get("Content-Type") ?? "";

    if (action === "callback" || contentType.includes("application/x-www-form-urlencoded")) {
      return await handleThreeDSCallback(req);
    }

    const rawBody = await req.text();
    return await handleIyzicoWebhook(req, rawBody);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
