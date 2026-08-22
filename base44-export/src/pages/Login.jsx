import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const VITRINE_URL = (import.meta.env.VITE_VITRINE_URL || 'https://www.phoenixsekur.com').replace(/\/$/, '');

export default function Login() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ret = searchParams.get('return') || window.location.href;
    window.location.replace(`${VITRINE_URL}/login.html?return=${encodeURIComponent(ret)}`);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </div>
    </div>
  );
}
