import { supabase } from '@/lib/supabase';

export async function saveExpoPushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('user_id', userId);
}
