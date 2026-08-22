import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook de scan NFC robuste — gère le cycle de vie complet de NDEFReader :
 *  - démarrage via user gesture (requis par l'API)
 *  - timeout configurable (abort automatique)
 *  - annulation propre via AbortController
 *  - gestion fine des erreurs (permission, non supporté, lecture échouée)
 *  - cleanup des listeners au démontage
 *
 * Retourne : { status, tagId, error, supported, scan, stop, reset, setManual }
 * status : 'idle' | 'scanning' | 'success' | 'error' | 'unavailable' | 'permission_denied'
 */
export function useNfcScan() {
  const [status, setStatus] = useState('idle');
  const [tagId, setTagId] = useState('');
  const [error, setError] = useState('');

  const ndefRef = useRef(null);
  const abortRef = useRef(null);
  const timeoutRef = useRef(null);

  const supported = typeof window !== 'undefined' && 'NDEFReader' in window;

  const cleanup = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (abortRef.current) { try { abortRef.current.abort(); } catch { /* noop */ } abortRef.current = null; }
    if (ndefRef.current) {
      try { ndefRef.current.onreading = null; ndefRef.current.onreadingerror = null; } catch { /* noop */ }
      ndefRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setError('');
    setTagId('');
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  const scan = useCallback((timeoutMs = 30000) => {
    return new Promise((resolve, reject) => {
      if (!supported) {
        setStatus('unavailable');
        setError("L'API Web NFC n'est pas supportée ici. Sur iPhone, le NFC depuis un navigateur est impossible (Apple le bloque). Sur Android, ouvrez l'app dans Chrome avec le NFC activé.");
        reject(new Error('unsupported'));
        return;
      }

      cleanup();
      setStatus('scanning');
      setError('');

      const controller = new AbortController();
      abortRef.current = controller;

      timeoutRef.current = setTimeout(() => {
        cleanup();
        setStatus('error');
        setError('Aucun badge détecté dans le délai. Rapprochez le tag NFC du dos du téléphone et réessayez.');
        reject(new Error('timeout'));
      }, timeoutMs);

      (async () => {
        try {
          const ndef = new window.NDEFReader();
          ndefRef.current = ndef;
          await ndef.scan({ signal: controller.signal });

          ndef.addEventListener('reading', (event) => {
            const id = event.serialNumber || `NFC-${Date.now()}`;
            cleanup();
            setTagId(id);
            setStatus('success');
            resolve(id);
          });

          ndef.addEventListener('readingerror', () => {
            // Tag détecté mais illisible : on reste en scan, juste un message transient
            setError('Lecture du badge impossible. Retirez-le puis réapprochez-le du téléphone.');
          });
        } catch (err) {
          if (err.name === 'AbortError') return; // annulation volontaire
          cleanup();
          if (err.name === 'NotAllowedError') {
            setStatus('permission_denied');
            setError('Permission NFC refusée. Autorisez le NFC dans les réglages Android, puis rechargez la page.');
          } else if (err.name === 'NotSupportedError') {
            setStatus('unavailable');
            setError('NFC non supporté ou désactivé. Activez le NFC dans les paramètres du téléphone.');
          } else if (err.name === 'NotReadableError') {
            setStatus('error');
            setError('NFC non accessible. Fermez les autres apps utilisant le NFC et réessayez.');
          } else {
            setStatus('error');
            setError(err.message || 'Erreur lors du scan NFC.');
          }
          reject(err);
        }
      })();
    });
  }, [supported, cleanup]);

  const setManual = useCallback((id) => {
    cleanup();
    setTagId(id);
    setStatus('success');
    setError('');
  }, [cleanup]);

  return { status, tagId, error, supported, scan, stop, reset, setManual };
}