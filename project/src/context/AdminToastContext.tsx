import {
  createContext, useContext, useState, useCallback, type ReactNode,
} from 'react';

type AdminToastState = {
  toast: string | null;
  showToast: (msg: string) => void;
};

const Ctx = createContext<AdminToastState | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ toast, showToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdminToast must be used within AdminToastProvider');
  return c;
}
