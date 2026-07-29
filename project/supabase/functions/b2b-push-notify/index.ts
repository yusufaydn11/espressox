import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) {
      return json({ error: "unauthenticated" }, 401);
    }

    const admin = createClient(url, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const allowedRoles = ["super_admin", "admin"];
    if (!roleRow || !allowedRoles.includes(roleRow.role)) {
      return json({ error: "unauthorized" }, 403);
    }

    const { order_id, title, body } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    const { data: order } = await admin.from("b2b_orders").select("store_id, order_number, status").eq("id", order_id).maybeSingle();
    if (!order) return json({ error: "order not found" }, 404);

    const pushTitle = title ?? `Sipariş ${order.order_number}`;
    const pushBody = body ?? "Sipariş durumunuz güncellendi";

    const { data: storeUsers } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("store_id", order.store_id)
      .in("role", ["franchise", "store_manager", "staff"]);

    if (!storeUsers?.length) return json({ sent: 0 });

    const userIds = storeUsers.map((u: { user_id: string }) => u.user_id);
    const { data: profiles } = await admin
      .from("profiles")
      .select("expo_push_token")
      .in("user_id", userIds)
      .not("expo_push_token", "is", null);

    const tokens = (profiles ?? [])
      .map((p: { expo_push_token: string | null }) => p.expo_push_token)
      .filter(Boolean) as string[];

    if (tokens.length === 0) return json({ sent: 0, reason: "no_tokens" });

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default" as const,
      title: pushTitle,
      body: pushBody,
      data: { order_id, source: "b2b" },
    }));

    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let sent = 0;
    for (const chunk of chunks) {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    }

    return json({ sent, tokens: tokens.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
