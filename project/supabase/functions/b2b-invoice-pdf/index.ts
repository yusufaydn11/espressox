import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("id");

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoice id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice with order and items
    const [invRes, orderItemsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/b2b_invoices?id=eq.${invoiceId}&select=*,b2b_orders(*)`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      }),
      fetch(
        `${supabaseUrl}/rest/v1/b2b_order_items?order_id=in.(select order_id from b2b_invoices where id=eq.${invoiceId})&select=*`,
        {
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        },
      ),
    ]);

    const invoices = await invRes.json();
    const items = await orderItemsRes.json();

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ error: "invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inv = invoices[0];
    const order = inv.b2b_orders;

    // Generate a printable HTML invoice (can be saved as PDF by browser)
    const html = generateInvoiceHTML(inv, order, items);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${inv.invoice_number}.html"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function generateInvoiceHTML(inv: any, order: any, items: any[]): string {
  const itemsHTML = items
    .map(
      (item: any) => `
    <tr>
      <td>${item.sku}</td>
      <td>${item.name}</td>
      <td style="text-align:center">${item.quantity} ${item.unit}</td>
      <td style="text-align:right">${formatTRY(Number(item.unit_price))}</td>
      <td style="text-align:right">%${item.vat_rate}</td>
      <td style="text-align:right">${formatTRY(Number(item.line_total))}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fatura ${inv.invoice_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #f5f5f5; padding: 20px; }
  .invoice { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
  .header { background: #1a1a2e; color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 28px; font-weight: 700; }
  .header .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header .logo span { color: #C8102E; }
  .invoice-meta { padding: 24px 40px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
  .invoice-meta .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-meta .value { font-size: 16px; font-weight: 600; margin-top: 4px; }
  .parties { padding: 24px 40px; border-bottom: 1px solid #eee; display: flex; gap: 40px; }
  .parties .party { flex: 1; }
  .parties h3 { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .parties .name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .parties .detail { font-size: 13px; color: #666; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8f8f8; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; text-align: left; }
  td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .totals { padding: 24px 40px; border-bottom: 1px solid #eee; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
  .totals .row.grand { border-top: 2px solid #1a1a2e; margin-top: 8px; padding-top: 16px; font-size: 18px; font-weight: 700; }
  .totals .grand .amount { color: #C8102E; }
  .footer { padding: 24px 40px; font-size: 12px; color: #999; text-align: center; line-height: 1.8; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-paid { background: #d4edda; color: #155724; }
  .status-issued { background: #fff3cd; color: #856404; }
  .actions { padding: 20px 40px; text-align: right; }
  .btn { display: inline-block; padding: 10px 24px; background: #C8102E; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  @media print { body { background: #fff; padding: 0; } .invoice { box-shadow: none; } .actions { display: none; } }
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="logo">ESPRESSO<span>X</span></div>
    <h1>FATURA</h1>
  </div>

  <div class="invoice-meta">
    <div>
      <div class="label">Fatura No</div>
      <div class="value">${inv.invoice_number}</div>
    </div>
    <div>
      <div class="label">Tarih</div>
      <div class="value">${formatDate(inv.issued_at)}</div>
    </div>
    <div>
      <div class="label">Durum</div>
      <div class="value"><span class="status-badge status-${inv.status === "paid" ? "paid" : "issued"}">${inv.status === "paid" ? "Ödendi" : "Açık"}</span></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>SATICI</h3>
      <div class="name">Espresso X Merkez</div>
      <div class="detail">B2B Tedarik Sistemi<br>Merkez Depo<br>İstanbul, Türkiye</div>
    </div>
    <div class="party">
      <h3>ALICI</h3>
      <div class="name">Franchise Magaza</div>
      <div class="detail">Siparis: ${order?.order_number ?? ""}<br>Vade: 30 gun<br>e-Fatura: Hazirlik asamasinda</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Stok Kodu</th>
        <th>Urun Adi</th>
        <th style="text-align:center">Miktar</th>
        <th style="text-align:right">Birim Fiyat</th>
        <th style="text-align:right">KDV</th>
        <th style="text-align:right">Tutar</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Ara Toplam</span><span>${formatTRY(Number(inv.subtotal))}</span></div>
    <div class="row"><span>KDV</span><span>${formatTRY(Number(inv.vat_total))}</span></div>
    <div class="row grand"><span>Genel Toplam</span><span class="amount">${formatTRY(Number(inv.total))}</span></div>
  </div>

  <div class="actions">
    <a href="javascript:window.print()" class="btn">PDF olarak kaydet / Yazdir</a>
  </div>

  <div class="footer">
    Bu fatura Elektronik olarak uretilmistir.<br>
    Espresso X B2B Tedarik Sistemi &copy; ${new Date().getFullYear()}<br>
    e-Fatura entegrasyonu hazirlanmaktadir.
  </div>
</div>
</body>
</html>`;
}
