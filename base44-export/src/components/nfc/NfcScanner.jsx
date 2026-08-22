import React, { useState } from 'react';
import { ScanLine, CheckCircle2, AlertCircle, Loader2, Wifi, X, Keyboard, Smartphone, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNfcScan } from '@/hooks/useNfcScan';

/**
 * Composant de scan NFC de qualité — animation, feedback clair, saisie manuelle de secours.
 * Props :
 *   value     : tag id courant (contrôlé)
 *   onChange  : (tagId) => void  — appelé quand un tag est lu ou saisi manuellement
 *   autoStart : bool — lance le scan automatiquement au montage (utile pour le flux ronde)
 *   compact   : bool — affichage réduit
 */
export default function NfcScanner({ value = '', onChange, autoStart = false, compact = false }) {
  const { status, tagId, error, supported, scan, stop, reset, setManual } = useNfcScan();
  const [showManual, setShowManual] = useState(false);
  const [manualVal, setManualVal] = useState('');

  React.useEffect(() => {
    if (autoStart && supported && status === 'idle') {
      scan().then((id) => onChange?.(id)).catch(() => {});
    }
    /* eslint-disable-next-line */
  }, [autoStart]);

  React.useEffect(() => {
    if (tagId) onChange?.(tagId);
    /* eslint-disable-next-line */
  }, [tagId]);

  const launchScan = () => {
    scan().then((id) => onChange?.(id)).catch(() => {});
  };

  const submitManual = () => {
    if (manualVal.trim()) { setManual(manualVal.trim()); onChange?.(manualVal.trim()); setManualVal(''); setShowManual(false); }
  };

  const currentTag = value || tagId;

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-2xl border-2 transition-colors flex flex-col items-center text-center ${
        status === 'success' ? 'border-emerald-400 bg-emerald-50' :
        status === 'scanning' ? 'border-primary/50 bg-primary/5' :
        status === 'error' ? 'border-red-300 bg-red-50' :
        status === 'permission_denied' ? 'border-red-300 bg-red-50' :
        status === 'unavailable' ? 'border-amber-300 bg-amber-50' :
        'border-slate-200 bg-slate-50/60'
      } ${compact ? 'p-4' : 'p-6'}`}>

        {/* Idle */}
        {status === 'idle' && (
          <>
            <div className="relative w-20 h-20 flex items-center justify-center mb-3">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
              <Wifi className="w-9 h-9 text-primary" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Prêt à scanner</p>
            <p className="text-xs text-muted-foreground mb-4">Approchez un badge NFC du dos du téléphone</p>
            <Button type="button" onClick={launchScan} className="gap-2">
              <ScanLine className="w-4 h-4" /> Scanner un badge NFC
            </Button>
          </>
        )}

        {/* Scanning */}
        {status === 'scanning' && (
          <>
            <div className="relative w-24 h-24 flex items-center justify-center mb-3">
              <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              <span className="absolute inset-2 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDelay: '0.3s' }} />
              <span className="absolute inset-4 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDelay: '0.6s' }} />
              <Loader2 className="w-8 h-8 text-primary animate-spin relative" />
            </div>
            <p className="text-sm font-semibold text-primary mb-1">Scan en cours…</p>
            <p className="text-xs text-muted-foreground mb-3">Maintenez le badge contre le dos du téléphone</p>
            {error && <p className="text-xs text-amber-600 mb-2">{error}</p>}
            <Button type="button" size="sm" variant="outline" onClick={stop} className="gap-1">
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700 mb-1">Badge détecté</p>
            <p className="text-xs font-mono bg-white border border-emerald-200 rounded-md px-2.5 py-1 mb-3 break-all max-w-full">{currentTag}</p>
            <Button type="button" size="sm" variant="outline" onClick={reset} className="gap-1">
              <ScanLine className="w-3.5 h-3.5" /> Changer de badge
            </Button>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-700 mb-1">Échec du scan</p>
            <p className="text-xs text-red-600 mb-3 max-w-xs">{error}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={launchScan} className="gap-1">
                <ScanLine className="w-3.5 h-3.5" /> Réessayer
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowManual(s => !s)} className="gap-1">
                <Keyboard className="w-3.5 h-3.5" /> Saisie manuelle
              </Button>
            </div>
          </>
        )}

        {/* Permission denied */}
        {status === 'permission_denied' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-700 mb-1">Permission refusée</p>
            <p className="text-xs text-red-600 mb-3 max-w-xs">{error}</p>
            <Button type="button" size="sm" onClick={launchScan} className="gap-1">
              <ScanLine className="w-3.5 h-3.5" /> Réessayer
            </Button>
          </>
        )}

        {/* Unavailable */}
        {status === 'unavailable' && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Smartphone className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-amber-700 mb-1">NFC indisponible</p>
            <p className="text-xs text-amber-600 mb-3 max-w-xs">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowManual(s => !s)} className="gap-1">
              <Keyboard className="w-3.5 h-3.5" /> Saisir l'ID manuellement
            </Button>
          </>
        )}
      </div>

      {/* Saisie manuelle */}
      {showManual && (
        <div className="flex gap-2">
          <Input
            value={manualVal}
            onChange={e => setManualVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder="ID du tag NFC (ex : 04:A2:1F…)"
            className="text-xs font-mono"
          />
          <Button type="button" size="sm" onClick={submitManual}>OK</Button>
        </div>
      )}

      {/* Info aider */}
      {!compact && status === 'idle' && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground px-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Nécessite Chrome sur Android avec NFC activé. <button type="button" className="text-primary underline" onClick={() => setShowManual(s => !s)}>Saisie manuelle</button> disponible en secours.</span>
        </div>
      )}
    </div>
  );
}