import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  decodeThreeDSHtmlContent,
  formatIyzicoPrice,
  iyzicoRequest,
  resolveCallbackUrl,
  resolveIyzicoEnv,
} from "../_shared/iyzico.ts";
import {
  adminClient,
  authenticateUser,
  corsHeaders,
  html,
  json,
  randomToken,
} from "../_shared/retail-payment.ts";

type PaymentCardInput = {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
};

type IyzicoInitResponse = {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  paymentId?: string;
  threeDSHtmlContent?: string;
  conversationId?: string;
};

function sanitizeCardNumber(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0], surname: "." };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

async function serveThreeDSPage(sessionToken: string): Promise<Response> {
  const admin = adminClient();
  const { data: intent } = await admin
    .from("payment_intents")
    .select("threeds_html, session_expires_at, status")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (!intent?.threeds_html) {
    return html("<html><body><p>3DS oturumu bulunamadı veya süresi doldu.</p></body></html>", 404);
  }
  if (intent.session_expires_at && new Date(intent.session_expires_at) < new Date()) {
    return html("<html><body><p>3DS oturumu süresi doldu.</p></body></html>", 410);
  }
  if (intent.status === "paid" || intent.status === "failed") {
    return html("<html><body><p>Ödeme oturumu tamamlandı.</p></body></html>", 410);
  }

  return html(intent.threeds_html);
}

async function handleInitiate(req: Request): Promise<Response> {
  const user = await authenticateUser(req);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const iyzico = resolveIyzicoEnv();
  if (!iyzico) return json({ error: "payment_provider_not_configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const orderNumber = String(body.order_number ?? "").trim();
  const card = body.payment_card as PaymentCardInput | undefined;

  if (!orderNumber) return json({ error: "order_number_required" }, 400);
  if (!card?.cardHolderName || !card?.cardNumber || !card?.expireMonth || !card?.expireYear || !card?.cvc) {
    return json({ error: "payment_card_required" }, 400);
  }

  const admin = adminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, user_id, status, payment_status, total, store_name, payment_method")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) return json({ error: "order_not_found" }, 404);
  if (order.user_id !== user.id) return json({ error: "unauthorized" }, 403);
  if (order.payment_status === "paid") return json({ error: "already_paid" }, 409);
  if (order.status === "cancelled") return json({ error: "order_cancelled" }, 409);
  if (order.status !== "payment_pending" && order.payment_status !== "pending") {
    return json({ error: "order_not_payable" }, 409);
  }
  if (Number(order.total) <= 0) return json({ error: "zero_total_order" }, 400);

  const { data: orderPayment } = await admin
    .from("order_payments")
    .select("id, amount, payment_status")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!orderPayment) return json({ error: "payment_not_found" }, 404);
  if (orderPayment.payment_status === "paid") return json({ error: "already_paid" }, 409);

  const amount = Number(order.total);
  if (Number(orderPayment.amount) !== amount) {
    return json({ error: "payment_amount_mismatch" }, 409);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: orderItems } = await admin
    .from("order_items")
    .select("product_id, name, quantity, unit_price")
    .eq("order_id", order.id);

  const conversationId = crypto.randomUUID();
  const sessionToken = randomToken();
  const sessionExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { data: intent, error: intentErr } = await admin
    .from("payment_intents")
    .insert({
      order_id: order.id,
      order_number: order.order_number,
      user_id: user.id,
      order_payment_id: orderPayment.id,
      provider: "iyzico",
      amount,
      currency: "TRY",
      status: "pending",
      conversation_id: conversationId,
      session_token: sessionToken,
      session_expires_at: sessionExpires,
      metadata: { payment_method: order.payment_method ?? "card" },
    })
    .select("id")
    .single();

  if (intentErr || !intent) {
    return json({ error: intentErr?.message ?? "intent_create_failed" }, 500);
  }

  const { name, surname } = splitName(profile?.full_name ?? "Espresso X");
  const buyerEmail = user.email ?? "customer@espressox.app";
  const buyerId = user.id.replace(/-/g, "").slice(0, 20);
  const priceStr = formatIyzicoPrice(amount);
  const callbackUrl = resolveCallbackUrl(Deno.env.get("SUPABASE_URL") ?? "");

  const basketItems = (orderItems ?? []).length > 0
    ? (orderItems ?? []).map((item, idx) => ({
      id: String(item.product_id ?? `item-${idx + 1}`),
      name: String(item.name ?? "Urun").slice(0, 100),
      category1: "Food",
      category2: "Beverage",
      itemType: "VIRTUAL",
      price: formatIyzicoPrice(Number(item.unit_price) * Number(item.quantity)),
    }))
    : [{
      id: order.order_number,
      name: "Espresso X Siparis",
      category1: "Food",
      category2: "Beverage",
      itemType: "VIRTUAL",
      price: priceStr,
    }];

  const initBody = {
    locale: "tr",
    conversationId,
    price: priceStr,
    paidPrice: priceStr,
    currency: "TRY",
    installment: 1,
    paymentChannel: "MOBILE",
    basketId: order.order_number,
    paymentGroup: "PRODUCT",
    callbackUrl,
    paymentCard: {
      cardHolderName: card.cardHolderName.trim(),
      cardNumber: sanitizeCardNumber(card.cardNumber),
      expireMonth: card.expireMonth.padStart(2, "0"),
      expireYear: card.expireYear.length === 2 ? card.expireYear : card.expireYear.slice(-2),
      cvc: card.cvc,
    },
    buyer: {
      id: buyerId,
      name,
      surname,
      identityNumber: "11111111111",
      email: buyerEmail,
      gsmNumber: profile?.phone ? `+90${profile.phone.replace(/\D/g, "").slice(-10)}` : "+905555555555",
      registrationAddress: order.store_name ?? "Turkiye",
      city: "Istanbul",
      country: "Turkey",
      ip: "85.34.78.112",
    },
    billingAddress: {
      contactName: profile?.full_name ?? "Espresso X",
      city: "Istanbul",
      country: "Turkey",
      address: order.store_name ?? "Turkiye",
    },
    basketItems,
  };

  let iyzicoRes: IyzicoInitResponse;
  try {
    iyzicoRes = await iyzicoRequest<IyzicoInitResponse>(
      iyzico,
      "/payment/3dsecure/initialize",
      initBody,
    );
  } catch (err) {
    await admin.from("payment_intents").update({
      status: "failed",
      failure_reason: (err as Error).message,
    }).eq("id", intent.id);
    return json({ error: "iyzico_request_failed" }, 502);
  }

  if (iyzicoRes.status !== "success" || !iyzicoRes.threeDSHtmlContent) {
    await admin.from("payment_intents").update({
      status: "failed",
      failure_reason: iyzicoRes.errorMessage ?? iyzicoRes.errorCode ?? "init_failed",
      provider_payment_id: iyzicoRes.paymentId ?? null,
    }).eq("id", intent.id);
    return json({
      error: "iyzico_init_failed",
      detail: iyzicoRes.errorMessage ?? iyzicoRes.errorCode ?? "unknown",
    }, 400);
  }

  const threedsHtml = decodeThreeDSHtmlContent(iyzicoRes.threeDSHtmlContent);

  await admin.from("payment_intents").update({
    status: "threeds",
    provider_payment_id: iyzicoRes.paymentId ?? null,
    threeds_html: threedsHtml,
    metadata: {
      payment_method: order.payment_method ?? "card",
      iyzico_payment_id: iyzicoRes.paymentId,
    },
  }).eq("id", intent.id);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const threeDSPageUrl = `${supabaseUrl}/functions/v1/retail-payment-initiate?session=${sessionToken}`;

  return json({
    success: true,
    payment_intent_id: intent.id,
    session_token: sessionToken,
    three_ds_page_url: threeDSPageUrl,
    provider: "iyzico",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("session")) {
      return await serveThreeDSPage(url.searchParams.get("session")!);
    }

    if (req.method === "POST") {
      return await handleInitiate(req);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
