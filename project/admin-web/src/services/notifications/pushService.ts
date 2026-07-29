import { supabase } from '../../lib/supabase';

export async function sendB2BPushNotify(
  orderId: string,
  title: string,
  body: string,
): Promise<void> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();
  try {
    await fetch(`${baseUrl}/functions/v1/b2b-push-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ order_id: orderId, title, body }),
    });
  } catch {
    /* push is best-effort */
  }
}
