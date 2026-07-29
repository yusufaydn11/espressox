import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const webhookSecret = Deno.env.get("B2B_PAYMENT_WEBHOOK_SECRET") ?? "";

async function callRpc(
  fn: string,
  params: Record<string, unknown>,
  authHeader?: string | null,
) {
  const useUserAuth = Boolean(authHeader?.startsWith("Bearer "));
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": useUserAuth ? anonKey : serviceRoleKey,
      "Authorization": useUserAuth ? authHeader! : `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(params),
  });
  return await res.json();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const normalized = signature.replace(/^sha256=/i, "").toLowerCase();
  return timingSafeEqual(expected, normalized);
}

function requireAuthHeader(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = String(payload.action ?? "");

    if (action === "initiate") {
      const order_id = payload.order_id as string | undefined;
      const provider = (payload.provider as string | undefined) ?? "manual";
      const amount = payload.amount as number | undefined;
      const payment_ref = (payload.payment_ref as string | undefined) ?? "";
      const method = (payload.method as string | undefined) ?? "bank_transfer";

      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prov = provider;
      const payMethod = method;

      if (prov === "manual" || prov === "bank_transfer") {
        const authHeader = requireAuthHeader(req);
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "unauthenticated" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await callRpc("record_b2b_payment", {
          p_order_id: order_id,
          p_provider: prov,
          p_amount: amount ?? 0,
          p_provider_ref: payment_ref,
          p_method: payMethod,
        }, authHeader);

        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          payment_id: result.payment_id,
          invoice_id: result.invoice_id,
          provider: prov,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prov === "iyzico" || prov === "odeal") {
        const authHeader = requireAuthHeader(req);
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "unauthenticated" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payNo = "PAY-" + Date.now().toString().slice(-6);
        const res = await fetch(`${supabaseUrl}/rest/v1/b2b_payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            payment_number: payNo,
            order_id: order_id,
            amount: amount,
            status: "pending",
            provider: prov,
            payment_method: payMethod,
          }),
        });
        const payData = await res.json();

        return new Response(JSON.stringify({
          success: false,
          pending: true,
          message: `${prov} entegrasyonu yakinda aktif olacak. Su an manuel odeme kullaniniz.`,
          payment_id: payData?.[0]?.id,
          provider: prov,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "unsupported_provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "webhook") {
      if (!webhookSecret) {
        return new Response(JSON.stringify({ error: "webhook_not_configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const signature = req.headers.get("X-Webhook-Signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "missing_signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "invalid_signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payment_id = payload.payment_id as string | undefined;
      const status = payload.status as string | undefined;

      if (status === "success" && payment_id) {
        const result = await callRpc("confirm_b2b_payment", { p_payment_id: payment_id });
        return new Response(JSON.stringify({ received: true, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ received: true, status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
