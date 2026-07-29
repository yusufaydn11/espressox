import { useEffect, useState, useCallback } from 'react';
import { Send, Bell, Users, Crown, Store, UserX, Check } from 'lucide-react';
import { fetchPushJobs, createPushJob, fetchNotifications } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader } from '../lib/ui';
import { useToast } from '../lib/toast';
import { timeAgo } from '../lib/utils';
import type { PushJob } from '../lib/supabase';

const TARGETS = [
  { id: 'all', label: 'Tüm Kullanıcılar', icon: Users },
  { id: 'store', label: 'Şube Müşterileri', icon: Store },
  { id: 'vip', label: 'VIP Müşteriler', icon: Crown },
  { id: 'inactive', label: 'Pasif Müşteriler', icon: UserX },
];

export function NotificationsScreen() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PushJob[] | null>(null);
  const [sent, setSent] = useState<Awaited<ReturnType<typeof fetchNotifications>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', target_segment: 'all', image_url: '' });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [j, n] = await Promise.all([fetchPushJobs(), fetchNotifications()]);
      setJobs(j); setSent(n);
    } catch (e) { setError(e instanceof Error ? e.message : 'Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!form.title || !form.body) { toastError('Başlık ve mesaj zorunlu'); return; }
    setSending(true);
    try {
      await createPushJob({ ...form, status: 'queued', sent_by: user?.id ?? null });
      setForm({ title: '', body: '', target_segment: 'all', image_url: '' });
      await load();
      success('Bildirim kuyruğa eklendi');
    } catch (e) { toastError(e instanceof Error ? e.message : 'Gönderilemedi'); }
    finally { setSending(false); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Bildirim Yönetimi" subtitle="Hedef kitleye push bildirimleri gönderin" />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Composer */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Send size={16} className="text-ex-red" /> Yeni Bildirim</h3>
          <div className="space-y-4">
            <div><label className="admin-label">Hedef Kitle</label>
              <div className="grid grid-cols-2 gap-2">
                {TARGETS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, target_segment: t.id }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${form.target_segment === t.id ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900' : 'bg-cream-50 text-ink-600 hover:bg-cream-100 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'}`}>
                      <Icon size={14} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><label className="admin-label">Başlık</label><input className="admin-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Örn: Mutlu Saat Başladı!" /></div>
            <div><label className="admin-label">Mesaj</label><textarea className="admin-input min-h-[90px]" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Bildirim metni…" /></div>
            <div><label className="admin-label">Görsel URL (opsiyonel)</label><input className="admin-input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
            <Button full disabled={sending} onClick={send}><Send size={16} /> {sending ? 'Gönderiliyor…' : 'Bildirim Gönder'}</Button>
          </div>
        </Card>

        {/* Job history */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Gönderim Geçmişi</h3>
          <div className="space-y-2">
            {!jobs || jobs.length === 0 ? <EmptyState title="Henüz bildirim yok" /> :
             jobs.map(j => (
              <div key={j.id} className="flex items-start gap-3 py-2.5 border-b border-ink-100 dark:border-ink-800 last:border-0">
                <div className="h-9 w-9 rounded-lg bg-cream-100 dark:bg-ink-800 flex items-center justify-center shrink-0"><Bell size={15} className="text-ink-600 dark:text-ink-300" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{j.title}</p>
                  <p className="text-xs text-ink-400 dark:text-ink-400 truncate">{j.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={j.status === 'sent' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>
                      {j.status === 'sent' ? <><Check size={10} /> Gönderildi</> : j.status === 'queued' ? 'Kuyrukta' : j.status}
                    </Badge>
                    <span className="text-[10px] text-ink-400">{timeAgo(j.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Sent notifications */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Müşteri Bildirimleri</h3>
        <div className="space-y-2">
          {!sent || sent.length === 0 ? <EmptyState title="Bildirim yok" /> :
           sent.slice(0, 15).map(n => (
            <div key={n.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 dark:border-ink-800 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{n.title}</p>
                <p className="text-xs text-ink-400 dark:text-ink-400 truncate">{n.body}</p>
              </div>
              <span className="text-[10px] text-ink-400 shrink-0">{timeAgo(n.created_at)}</span>
              <Badge tone={n.is_read ? 'green' : 'neutral'}>{n.is_read ? 'Okundu' : 'Okunmadı'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
