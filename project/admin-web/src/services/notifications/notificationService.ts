import { supabase } from '../../lib/supabase';
import type { NotificationRow, PushJob } from '../../lib/supabase';

export async function fetchPushJobs(): Promise<PushJob[]> {
  const { data, error } = await supabase
    .from('admin_push_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as PushJob[];
}

export async function createPushJob(p: Partial<PushJob>): Promise<PushJob> {
  const { data, error } = await supabase
    .from('admin_push_queue')
    .insert(p)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PushJob;
}

export async function fetchNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as NotificationRow[];
}
