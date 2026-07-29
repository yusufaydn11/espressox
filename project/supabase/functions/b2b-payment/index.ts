import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function callRpc(fn: string, params: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(params),
  });
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, order_id, provider, amount, payment_ref, method } = await req.json();

    if (action === "initiate") {
      // ── Initiate payment for a B2B order ──
      // Currently supports 'manual' (bank transfer) and 'iyzico' / 'odeal' (architecture-ready)
      // For manual/bank transfer: record payment immediately as success
      // For iyzico/Ödeal: would redirect to payment gateway (not yet implemented — returns pending)

      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prov = provider ?? "manual";
      const payMethod = method ?? "bank_transfer";

      if (prov === "manual" || prov === "bank_transfer") {
        // Manual payment: record immediately
        const result = await callRpc("record_b2b_payment", {
          p_order_id: order_id,
          p_provider: prov,
          p_amount: amount ?? 0,
          p_provider_ref: payment_ref ?? "",
          p_method: payMethod,
        });

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
        // ── Payment gateway integration point ──
        // When iyzico/Ödeal API keys are configured, this is where the
        // payment form / 3D secure redirect would be generated.
        // For now, create a pending payment and return a placeholder.
        //
        // Future implementation:
        //   1. Call iyzico/Ödeal API to create payment request
        //   2. Return payment_page_url or 3D secure HTML
        //   3. Webhook endpoint (separate edge function) confirms payment
        //
        // Create pending payment record
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
      // ── Webhook handler for payment gateway callbacks ──
      // When iyzico/Ödeal sends a payment confirmation webhook,
      // this verifies the payment and calls confirm_b2b_payment.
      //
      // Future implementation:
      //   1. Verify webhook signature
      //   2. Extract payment_id and status
      //   3. If successful, call confirm_b2b_payment

      const { payment_id, status } = await req.json();

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
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
