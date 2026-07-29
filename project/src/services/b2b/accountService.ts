// ─── Account, Dashboard & Credit Services ──────────────────

import { supabase } from '@/lib/supabase';
import { B2BService } from './base';
import type { B2BAccountSummary, B2BDashboardData, B2BFranchiseCredit } from './types';

class DashboardService {
  async get(storeId: string): Promise<B2BDashboardData> {
    const { data, error } = await supabase.rpc('get_b2b_dashboard', { p_store_id: storeId });
    if (error) throw new Error(error.message);
    return data as B2BDashboardData;
  }
}

class AccountService {
  async getSummary(franchiseId: string): Promise<B2BAccountSummary> {
    const { data, error } = await supabase.rpc('get_b2b_account_summary', { p_franchise_id: franchiseId });
    if (error) throw new Error(error.message);
    return data as B2BAccountSummary;
  }
}

class CreditService extends B2BService<B2BFranchiseCredit> {
  constructor() {
    super('b2b_franchise_credit');
  }

  async getByFranchise(franchiseId: string): Promise<B2BFranchiseCredit | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('franchise_id', franchiseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as B2BFranchiseCredit | null;
  }
}

export const dashboardService = new DashboardService();
export const accountService = new AccountService();
export const creditService = new CreditService();
