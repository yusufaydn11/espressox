import { useState } from 'react';
import { Coffee, Lock, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button } from '../lib/ui';

type Mode = 'login' | 'forgot' | 'sent';

export function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    if (mode === 'login') {
      const { error: err } = await signIn(email.trim(), password);
      setLoading(false);
      if (err) setError(err === 'Invalid login credentials' ? 'E-posta veya şifre hatalı' : err);
      return;
    }
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) setError(err);
    else setMode('sent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-espresso-gradient p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-ex-red items-center justify-center shadow-red mb-4">
            <Coffee size={30} color="#fff" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display tracking-tight">Espresso X</h1>
          <p className="text-ink-400 text-sm mt-1.5">Merkez Yönetim Paneli</p>
        </div>

        {mode === 'sent' ? (
          <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-premium p-6 text-center animate-fade-up">
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-100">E-postanı kontrol et</h2>
            <p className="text-sm text-ink-500 mt-2">Şifre sıfırlama bağlantısı gönderildi.</p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => setMode('login')}>Giriş ekranına dön</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white dark:bg-ink-900 rounded-2xl shadow-premium p-6 space-y-4 animate-fade-up">
            {mode === 'forgot' && (
              <button type="button" onClick={() => { setMode('login'); setError(null); }} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ex-red">
                <ArrowLeft size={14} /> Girişe dön
              </button>
            )}
            <div>
              <label className="admin-label">Yönetici E-postası</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  className="admin-input pl-10" placeholder="admin@espressox.com"
                />
              </div>
            </div>
            {mode === 'login' && (
              <div>
                <label className="admin-label">Şifre</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="admin-input pl-10" placeholder="••••••••"
                  />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-ex-100 dark:bg-red-950 px-4 py-3 text-sm text-ex-red dark:text-red-400 font-medium">{error}</div>
            )}
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Gönderiliyor…' : mode === 'login' ? 'Panele Giriş' : 'Sıfırlama linki gönder'}
            </Button>
            {mode === 'login' && (
              <button type="button" onClick={() => { setMode('forgot'); setError(null); }} className="w-full text-sm text-ex-red font-medium">
                Şifremi unuttum
              </button>
            )}
          </form>
        )}

        <p className="text-center text-ink-500 text-xs mt-6">
          Bu panel yetkili yöneticiler içindir. Erişim için merkez yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
