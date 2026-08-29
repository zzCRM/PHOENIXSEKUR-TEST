import { useState } from 'react';
import { Building2, HardHat, Landmark, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getHomePathForUser } from '@/lib/roleRoutes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const PORTALS = [
  {
    id: 'entreprise',
    label: 'Société de sécurité',
    desc: 'Espace entreprise',
    icon: Building2,
  },
  {
    id: 'collaborateur',
    label: 'Salarié',
    desc: 'Espace collaborateur',
    icon: HardHat,
  },
  {
    id: 'client',
    label: 'Client',
    desc: 'Espace client',
    icon: Landmark,
  },
];

export default function Login() {
  const [portal, setPortal] = useState('entreprise');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password, portal);
      const path = getHomePathForUser(result.user) || '/';
      // Recharge pour initialiser AuthContext avec le token
      window.location.replace(path);
    } catch (err) {
      setError(err.message || 'Identifiants incorrects');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom relative overflow-hidden bg-[#0c0c0e] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(192,57,43,.4), transparent), radial-gradient(ellipse 40% 30% at 100% 80%, rgba(192,57,43,.12), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img
            src="/phoenix-sekur-logo.png"
            alt=""
            className="w-10 h-10 rounded-lg object-contain bg-black"
          />
          <span className="text-xl font-semibold tracking-tight">
            Phoenix <span className="font-extrabold">Sekur</span>
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 sm:p-7 shadow-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight">Connexion</h1>
          <p className="text-sm text-white/60 mt-1 mb-5">
            Choisissez votre type de compte, puis connectez-vous
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5" role="tablist" aria-label="Type de compte">
            {PORTALS.map((p) => {
              const Icon = p.icon;
              const active = portal === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPortal(p.id)}
                  className={cn(
                    'flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-1.5 rounded-xl border-2 px-3 py-3 text-left sm:text-center transition-colors',
                    active
                      ? 'border-[#c0392b] bg-[#c0392b]/15 text-white'
                      : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white/80',
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-wide leading-tight">
                      {p.label}
                    </span>
                    <span className="block text-[11px] opacity-70 mt-0.5 sm:mt-0">{p.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-white/70">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@societe.fr"
                className="h-11 bg-black/40 border-white/15 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-white/70">Mot de passe</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 bg-black/40 border-white/15 text-white placeholder:text-white/30"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/15 text-red-300 text-sm px-3 py-2.5">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#c0392b] hover:bg-[#a93226] text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
