import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const HQ_ROLES = new Set(["super_admin", "admin"]);
const STORE_ROLES = new Set(["franchise", "store_manager", "staff"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveAuthHeader(req: Request, url: URL): string | null {
  const header = req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) return header;
  const accessToken = url.searchParams.get("access_token");
  if (accessToken) return `Bearer ${accessToken}`;
  return null;
}

async function assertAuthorized(req: Request, invoiceOrOrder: { store_id?: string; franchise_id?: string } | null, authHeader: string | null): Promise<Response | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: roles } = await admin.from("user_roles").select("role, store_id, franchise_id").eq("user_id", user.id);
  if (!roles?.length) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (roles.some((r: { role: string }) => HQ_ROLES.has(r.role))) return null;

  const storeId = invoiceOrOrder?.store_id;
  const franchiseId = invoiceOrOrder?.franchise_id;
  const allowed = roles.some((r: { role: string; store_id?: string; franchise_id?: string }) => {
    if (!STORE_ROLES.has(r.role)) return false;
    if (storeId && r.store_id === storeId) return true;
    if (franchiseId && r.franchise_id === franchiseId) return true;
    return false;
  });

  if (!allowed) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

async function dbFetch(path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const docType = url.searchParams.get("type") ?? "invoice";
    const authHeader = resolveAuthHeader(req, url);

    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!UUID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "invalid_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (docType === "order") {
      const orders = await dbFetch(
        `b2b_orders?id=eq.${id}&select=id,store_id,franchise_id`,
      );
      const authErr = await assertAuthorized(req, orders?.[0] ?? null, authHeader);
      if (authErr) return authErr;

      const html = await buildOrderPdf(id);
      if (!html) {
        return new Response(JSON.stringify({ error: "order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="siparis-${id}.html"`,
        },
      });
    }

    // Default: invoice PDF
    const [invoices, items] = await Promise.all([
      dbFetch(`b2b_invoices?id=eq.${id}&select=*,b2b_orders(store_id,franchise_id)`),
      dbFetch(`b2b_order_items?order_id=in.(select order_id from b2b_invoices where id=eq.${id})&select=*`),
    ]);

    if (!invoices?.length) {
      return new Response(JSON.stringify({ error: "invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authErr = await assertAuthorized(req, {
      store_id: invoices[0].b2b_orders?.store_id,
      franchise_id: invoices[0].b2b_orders?.franchise_id,
    }, authHeader);
    if (authErr) return authErr;

    const fullInvoices = await dbFetch(`b2b_invoices?id=eq.${id}&select=*,b2b_orders(*)`);
    const invoice = fullInvoices?.[0] ?? invoices[0];
    const html = generateInvoiceHTML(invoice, invoice.b2b_orders, items ?? []);
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${invoice.invoice_number}.html"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function buildOrderPdf(orderId: string): Promise<string | null> {
  const orders = await dbFetch(
    `b2b_orders?id=eq.${orderId}&select=*,b2b_order_items(*),stores(name,address,phone),franchises(company_name,authorized_person,tax_id)`,
  );
  if (!orders?.length) return null;

  const order = orders[0];
  const items: Record<string, unknown>[] = order.b2b_order_items ?? [];

  const productIds = items.map((i) => i.product_id).filter(Boolean);
  let productImages: Record<string, string> = {};
  if (productIds.length) {
    const ids = productIds.join(",");
    const products = await dbFetch(`b2b_products?id=in.(${ids})&select=id,image_url`);
    if (Array.isArray(products)) {
      productImages = Object.fromEntries(
        products.map((p: { id: string; image_url: string }) => [p.id, p.image_url ?? ""]),
      );
    }
  }

  let creatorName = "—";
  if (order.created_by) {
    const profiles = await dbFetch(`profiles?user_id=eq.${order.created_by}&select=full_name`);
    if (profiles?.[0]?.full_name) creatorName = profiles[0].full_name;
  }

  return generateOrderHTML(order, items, productImages, creatorName);
}

function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(n);
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak", awaiting_payment: "Ödeme Bekleniyor", paid: "Bekliyor",
  confirmed: "Onaylandı", preparing: "Hazırlanıyor", shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi", cancelled: "İptal Edildi",
};

function generateOrderHTML(
  order: Record<string, unknown>,
  items: Record<string, unknown>[],
  productImages: Record<string, string>,
  creatorName: string,
): string {
  const store = order.stores as { name: string; address: string; phone: string } | null;
  const franchise = order.franchises as { company_name: string; authorized_person: string; tax_id: string } | null;
  const status = STATUS_LABELS[String(order.status)] ?? String(order.status);

  const itemsHTML = items.map((item) => {
    const pid = String(item.product_id ?? "");
    const img = productImages[pid] ?? "";
    const imgCell = img
      ? `<img src="${img}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;" />`
      : `<div style="width:40px;height:40px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">—</div>`;

    return `<tr>
      <td style="width:48px">${imgCell}</td>
      <td><strong>${item.name}</strong><br><span style="color:#888;font-size:11px">${item.sku}</span></td>
      <td style="text-align:center">${item.quantity} ${item.unit}</td>
      <td style="text-align:right">${formatTRY(Number(item.unit_price))}</td>
      <td style="text-align:right">%${item.vat_rate}</td>
      <td style="text-align:right;font-weight:600">${formatTRY(Number(item.line_total))}</td>
    </tr>`;
  }).join("");

  const adminNotes = String(order.admin_notes ?? "").trim();
  const orderNotes = String(order.notes ?? "").trim();

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sipariş ${order.order_number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a2e; background:#f5f5f5; padding:20px; }
  .doc { max-width:860px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#1a1a2e 0%,#2d2d44 100%); color:#fff; padding:32px 40px; display:flex; justify-content:space-between; align-items:flex-start; }
  .logo { font-size:22px; font-weight:800; letter-spacing:-.5px; }
  .logo span { color:#C8102E; }
  .header h1 { font-size:24px; font-weight:700; text-align:right; }
  .header .sub { font-size:12px; opacity:.7; margin-top:4px; text-align:right; }
  .meta { padding:24px 40px; border-bottom:1px solid #eee; display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  .meta .label { font-size:10px; color:#999; text-transform:uppercase; letter-spacing:1px; }
  .meta .value { font-size:15px; font-weight:600; margin-top:4px; }
  .parties { padding:24px 40px; border-bottom:1px solid #eee; display:grid; grid-template-columns:1fr 1fr; gap:32px; }
  .parties h3 { font-size:10px; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; }
  .parties .name { font-size:15px; font-weight:600; margin-bottom:6px; }
  .parties .detail { font-size:13px; color:#666; line-height:1.7; }
  table { width:100%; border-collapse:collapse; }
  th { background:#f8f8f8; padding:12px 16px; font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#666; font-weight:600; text-align:left; }
  td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
  .totals { padding:24px 40px; border-bottom:1px solid #eee; }
  .totals .row { display:flex; justify-content:space-between; padding:8px 0; font-size:14px; }
  .totals .row.grand { border-top:2px solid #1a1a2e; margin-top:8px; padding-top:16px; font-size:18px; font-weight:700; }
  .totals .grand .amount { color:#C8102E; }
  .notes { padding:20px 40px; border-bottom:1px solid #eee; background:#fafafa; }
  .notes h4 { font-size:11px; color:#999; text-transform:uppercase; margin-bottom:8px; }
  .notes p { font-size:13px; color:#444; line-height:1.6; white-space:pre-wrap; }
  .shipping { padding:20px 40px; border-bottom:1px solid #eee; }
  .shipping h4 { font-size:11px; color:#999; text-transform:uppercase; margin-bottom:10px; }
  .shipping-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; font-size:13px; }
  .footer { padding:24px 40px; font-size:12px; color:#999; text-align:center; line-height:1.8; }
  .status { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; background:#e8f4fd; color:#1565c0; }
  .actions { padding:20px 40px; text-align:right; }
  .btn { display:inline-block; padding:10px 24px; background:#C8102E; color:#fff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; border:none; cursor:pointer; }
  @media print { body{background:#fff;padding:0} .doc{box-shadow:none} .actions{display:none} }
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div class="logo">ESPRESSO<span>X</span></div>
    <div>
      <h1>B2B SİPARİŞ</h1>
      <div class="sub">${order.order_number}</div>
    </div>
  </div>

  <div class="meta">
    <div><div class="label">Sipariş No</div><div class="value">${order.order_number}</div></div>
    <div><div class="label">Sipariş Tarihi</div><div class="value">${formatDateTime(String(order.created_at))}</div></div>
    <div><div class="label">Durum</div><div class="value"><span class="status">${status}</span></div></div>
  </div>

  <div class="parties">
    <div>
      <h3>SATICI</h3>
      <div class="name">Espresso X Merkez</div>
      <div class="detail">B2B Tedarik Sistemi<br>Merkez Depo<br>İstanbul, Türkiye</div>
    </div>
    <div>
      <h3>ALICI (FRANCHISE)</h3>
      <div class="name">${franchise?.company_name ?? store?.name ?? "—"}</div>
      <div class="detail">
        ${franchise?.authorized_person ? `Yetkili: ${franchise.authorized_person}<br>` : ""}
        ${franchise?.tax_id ? `Vergi No: ${franchise.tax_id}<br>` : ""}
        Şube: ${store?.name ?? "—"}<br>
        ${store?.address ?? ""}<br>
        Siparişi Veren: ${creatorName}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>Ürün</th>
        <th style="text-align:center">Miktar</th>
        <th style="text-align:right">Birim Fiyat</th>
        <th style="text-align:right">KDV</th>
        <th style="text-align:right">Satır Toplamı</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Ara Toplam</span><span>${formatTRY(Number(order.subtotal))}</span></div>
    <div class="row"><span>KDV</span><span>${formatTRY(Number(order.vat_total))}</span></div>
    <div class="row grand"><span>Genel Toplam</span><span class="amount">${formatTRY(Number(order.total))}</span></div>
  </div>

  ${orderNotes ? `<div class="notes"><h4>Sipariş Notu</h4><p>${orderNotes}</p></div>` : ""}
  ${adminNotes ? `<div class="notes"><h4>Merkez Notları</h4><p>${adminNotes}</p></div>` : ""}

  ${order.carrier_company || order.tracking_number ? `
  <div class="shipping">
    <h4>Kargo Bilgileri</h4>
    <div class="shipping-grid">
      <div><strong>Kargo Firması</strong><br>${order.carrier_company || "—"}</div>
      <div><strong>Takip No</strong><br>${order.tracking_number || "—"}</div>
      <div><strong>Tahmini Teslim</strong><br>${order.estimated_delivery ? formatDate(String(order.estimated_delivery)) : "—"}</div>
    </div>
  </div>` : ""}

  <div class="actions">
    <button class="btn" onclick="window.print()">PDF olarak kaydet / Yazdır</button>
  </div>

  <div class="footer">
    Bu belge elektronik ortamda üretilmiştir.<br>
    Espresso X B2B Tedarik Sistemi © ${new Date().getFullYear()}
  </div>
</div>
</body>
</html>`;
}

function generateInvoiceHTML(inv: Record<string, unknown>, order: Record<string, unknown> | null, items: Record<string, unknown>[]): string {
  const itemsHTML = items.map((item) => `
    <tr>
      <td>${item.sku}</td>
      <td>${item.name}</td>
      <td style="text-align:center">${item.quantity} ${item.unit}</td>
      <td style="text-align:right">${formatTRY(Number(item.unit_price))}</td>
      <td style="text-align:right">%${item.vat_rate}</td>
      <td style="text-align:right">${formatTRY(Number(item.line_total))}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Fatura ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#f5f5f5;padding:20px}
  .invoice{max-width:800px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  .header{background:#1a1a2e;color:#fff;padding:32px 40px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:22px;font-weight:800}.logo span{color:#C8102E}
  table{width:100%;border-collapse:collapse}
  th{background:#f8f8f8;padding:12px 16px;font-size:11px;text-transform:uppercase;color:#666;text-align:left}
  td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0f0f0}
  .totals{padding:24px 40px}.totals .row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}
  .totals .row.grand{border-top:2px solid #1a1a2e;margin-top:8px;padding-top:16px;font-size:18px;font-weight:700}
  .totals .grand .amount{color:#C8102E}
  .actions{padding:20px 40px;text-align:right}
  .btn{display:inline-block;padding:10px 24px;background:#C8102E;color:#fff;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer}
  @media print{body{background:#fff;padding:0}.invoice{box-shadow:none}.actions{display:none}}
</style>
</head>
<body>
<div class="invoice">
  <div class="header"><div class="logo">ESPRESSO<span>X</span></div><h1>FATURA</h1></div>
  <div style="padding:24px 40px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
    <div><div style="font-size:11px;color:#999">Fatura No</div><div style="font-size:16px;font-weight:600">${inv.invoice_number}</div></div>
    <div><div style="font-size:11px;color:#999">Tarih</div><div style="font-size:16px;font-weight:600">${formatDate(String(inv.issued_at))}</div></div>
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Ürün</th><th style="text-align:center">Miktar</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">KDV</th><th style="text-align:right">Tutar</th></tr></thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Ara Toplam</span><span>${formatTRY(Number(inv.subtotal))}</span></div>
    <div class="row"><span>KDV</span><span>${formatTRY(Number(inv.vat_total))}</span></div>
    <div class="row grand"><span>Genel Toplam</span><span class="amount">${formatTRY(Number(inv.total))}</span></div>
  </div>
  <div class="actions"><button class="btn" onclick="window.print()">PDF olarak kaydet / Yazdır</button></div>
</div>
</body>
</html>`;
}
