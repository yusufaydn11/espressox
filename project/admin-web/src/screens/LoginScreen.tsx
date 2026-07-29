import { useState } from 'react';
import { Coffee, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button } from '../lib/ui';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error === 'Invalid login credentials' ? 'E-posta veya şifre hatalı' : error);
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

        <form onSubmit={submit} className="bg-white dark:bg-ink-900 rounded-2xl shadow-premium p-6 space-y-4 animate-fade-up">
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
          {error && (
            <div className="rounded-xl bg-ex-100 dark:bg-red-950 px-4 py-3 text-sm text-ex-red dark:text-red-400 font-medium">{error}</div>
          )}
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? 'Giriş yapılıyor…' : 'Panele Giriş'}
          </Button>
        </form>

        <p className="text-center text-ink-500 text-xs mt-6">
          Bu panel yetkili yöneticiler içindir. Erişim için merkez yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
