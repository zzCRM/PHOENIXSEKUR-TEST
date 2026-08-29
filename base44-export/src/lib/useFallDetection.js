import { useCallback, useEffect, useRef, useState } from 'react';
import { isLossOfVerticality, tiltFromVertical } from '@/lib/fallDetect';

const CANCEL_SEC = 20;
const HOLD_MS = 10000;

export function useFallDetection({ active, onFallConfirmed }) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelLeft, setCancelLeft] = useState(CANCEL_SEC);
  const [armNonce, setArmNonce] = useState(0);
  const pendingRef = useRef(false);
  const lossSinceRef = useRef(null);
  const onFallRef = useRef(onFallConfirmed);
  onFallRef.current = onFallConfirmed;

  const cancelFall = useCallback(() => {
    pendingRef.current = false;
    lossSinceRef.current = null;
    setPending(false);
    setCancelLeft(CANCEL_SEC);
  }, []);

  const requestArm = useCallback(() => setArmNonce((n) => n + 1), []);

  useEffect(() => {
    if (!active) {
      setArmed(false);
      cancelFall();
      return undefined;
    }

    let cancelled = false;
    const handler = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      const tilt = tiltFromVertical(a.x, a.y, a.z);
      if (pendingRef.current) return;
      if (isLossOfVerticality(tilt)) {
        if (!lossSinceRef.current) lossSinceRef.current = Date.now();
        if (Date.now() - lossSinceRef.current >= HOLD_MS) {
          pendingRef.current = true;
          setPending(true);
          setCancelLeft(CANCEL_SEC);
        }
      } else {
        lossSinceRef.current = null;
      }
    };

    const start = async () => {
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          const res = await DeviceMotionEvent.requestPermission();
          if (res !== 'granted' || cancelled) return;
        }
        if (cancelled) return;
        window.addEventListener('devicemotion', handler, { passive: true });
        setArmed(true);
      } catch {
        if (!cancelled) setArmed(false);
      }
    };
    start();

    return () => {
      cancelled = true;
      window.removeEventListener('devicemotion', handler);
      setArmed(false);
    };
  }, [active, armNonce, cancelFall]);

  useEffect(() => {
    if (!pending) return undefined;
    const id = setInterval(() => {
      setCancelLeft((s) => {
        if (s <= 1) {
          pendingRef.current = false;
          lossSinceRef.current = null;
          setPending(false);
          onFallRef.current?.();
          return CANCEL_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  return { armed, pending, cancelLeft, cancelFall, requestArm };
}
