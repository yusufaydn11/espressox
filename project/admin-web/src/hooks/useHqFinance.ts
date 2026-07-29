import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchB2BOrders,
  enrichB2BOrdersWithMeta,
  fetchFranchises,
  fetchDashboardKpis,
  fetchB2BInvoicesForOrder,
  fetchB2BPaymentsForOrder,
  type B2BOrderWithMeta,
  type DashboardKpis,
} from '../lib/api';
import type { B2BInvoice, B2BPayment, Franchise } from '../lib/supabase';

const FINANCE_ORDER_SAMPLE = 25;

export type InvoiceWithMeta = B2BInvoice & {
  franchise_name?: string;
  order_number?: string;
};

export type PaymentWithMeta = B2BPayment & {
  franchise_name?: string;
  order_number?: string;
};

export type FranchiseFinanceRow = {
  franchise: Franchise;
  orderCount: number;
  totalVolume: number;
  openOrders: number;
  openAmount: number;
  deliveredVolume: number;
  pendingPayments: number;
};

export type HqFinanceSummary = {
  totalB2BVolume: number;
  openInvoiceCount: number;
  openInvoiceAmount: number;
  pendingPaymentCount: number;
  pendingPaymentAmount: number;
  franchiseCount: number;
  retailMonthRevenue: number;
  todaySales: number;
};

export type HqFinanceData = {
  orders: B2BOrderWithMeta[];
  franchises: Franchise[];
  kpis: DashboardKpis;
  invoices: InvoiceWithMeta[];
  payments: PaymentWithMeta[];
  franchiseRows: FranchiseFinanceRow[];
  summary: HqFinanceSummary;
};

function buildSummary(
  orders: B2BOrderWithMeta[],
  invoices: InvoiceWithMeta[],
  payments: PaymentWithMeta[],
  franchises: Franchise[],
  kpis: DashboardKpis,
): HqFinanceSummary {
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const openInvoices = invoices.filter(i => i.status === 'issued' || i.status === 'partial');
  const pendingPayments = payments.filter(p => p.status === 'pending');

  return {
    totalB2BVolume: activeOrders.reduce((s, o) => s + Number(o.total), 0),
    openInvoiceCount: openInvoices.length,
    openInvoiceAmount: openInvoices.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount)), 0),
    pendingPaymentCount: pendingPayments.length,
    pendingPaymentAmount: pendingPayments.reduce((s, p) => s + Number(p.amount), 0),
    franchiseCount: franchises.length,
    retailMonthRevenue: kpis.monthRevenue,
    todaySales: kpis.todaySales,
  };
}

function buildFranchiseRows(
  franchises: Franchise[],
  orders: B2BOrderWithMeta[],
  payments: PaymentWithMeta[],
): FranchiseFinanceRow[] {
  return franchises.map(franchise => {
    const fOrders = orders.filter(o => o.franchise_id === franchise.id);
    const openOrders = fOrders.filter(o => o.status === 'awaiting_payment');
    const orderIds = new Set(fOrders.map(o => o.id));
    const pendingPayments = payments.filter(p => orderIds.has(p.order_id) && p.status === 'pending').length;

    return {
      franchise,
      orderCount: fOrders.length,
      totalVolume: fOrders.reduce((s, o) => s + Number(o.total), 0),
      openOrders: openOrders.length,
      openAmount: openOrders.reduce((s, o) => s + Number(o.total), 0),
      deliveredVolume: fOrders
        .filter(o => o.status === 'delivered')
        .reduce((s, o) => s + Number(o.total), 0),
      pendingPayments,
    };
  }).sort((a, b) => b.totalVolume - a.totalVolume);
}

export function useHqFinance() {
  const [data, setData] = useState<HqFinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawOrders, franchises, kpis] = await Promise.all([
        fetchB2BOrders(),
        fetchFranchises(),
        fetchDashboardKpis(),
      ]);
      const orders = await enrichB2BOrdersWithMeta(rawOrders);
      const orderMap = new Map(orders.map(o => [o.id, o]));
      const sampleIds = orders.slice(0, FINANCE_ORDER_SAMPLE).map(o => o.id);

      const [invoiceGroups, paymentGroups] = await Promise.all([
        Promise.all(sampleIds.map(id => fetchB2BInvoicesForOrder(id))),
        Promise.all(sampleIds.map(id => fetchB2BPaymentsForOrder(id))),
      ]);

      const invoices: InvoiceWithMeta[] = invoiceGroups.flat().map(inv => {
        const order = orderMap.get(inv.order_id);
        return {
          ...inv,
          franchise_name: order?.franchise_name,
          order_number: order?.order_number,
        };
      });

      const payments: PaymentWithMeta[] = paymentGroups.flat().map(pay => {
        const order = orderMap.get(pay.order_id);
        return {
          ...pay,
          franchise_name: order?.franchise_name,
          order_number: order?.order_number,
        };
      });

      const franchiseRows = buildFranchiseRows(franchises, orders, payments);
      const summary = buildSummary(orders, invoices, payments, franchises, kpis);

      setData({ orders, franchises, kpis, invoices, payments, franchiseRows, summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Finans verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openInvoices = useMemo(
    () => (data?.invoices ?? []).filter(i => i.status === 'issued' || i.status === 'partial'),
    [data],
  );

  const recentPayments = useMemo(
    () => [...(data?.payments ?? [])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    [data],
  );

  return { data, openInvoices, recentPayments, loading, error, reload: load };
}

export function useFranchiseFinance(franchiseId: string | undefined, data: HqFinanceData | null) {
  return useMemo(() => {
    if (!data || !franchiseId) return null;
    const franchise = data.franchises.find(f => f.id === franchiseId);
    if (!franchise) return null;

    const orders = data.orders.filter(o => o.franchise_id === franchiseId);
    const orderIds = new Set(orders.map(o => o.id));
    const invoices = data.invoices.filter(i => orderIds.has(i.order_id));
    const payments = data.payments.filter(p => orderIds.has(p.order_id));
    const row = data.franchiseRows.find(r => r.franchise.id === franchiseId);

    return { franchise, orders, invoices, payments, row };
  }, [data, franchiseId]);
}
