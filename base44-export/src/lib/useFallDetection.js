import { useCallback, useEffect, useRef, useState } from 'react';
import { isFlatFromBeta, isLossOfVerticality, tiltFromVertical } from '@/lib/fallDetect';
import { unlockPtiAudio } from '@/lib/ptiAlarm';

const CANCEL_SEC = 20;
const HOLD_MS = 5000;

export async function primePtiOnUserGesture() {
  await requestMotionPermission();
  await unlockPtiAudio();
}

async function requestMotionPermission() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') return false;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch { /* optionnel */ }
    }
    return true;
  } catch {
    return false;
  }
}

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

  const triggerPreAlarm = useCallback(() => {
    pendingRef.current = true;
    setPending(true);
    setCancelLeft(CANCEL_SEC);
  }, []);

  const requestArm = useCallback(async () => {
    await requestMotionPermission();
    await unlockPtiAudio();
    setArmNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!active) {
      setArmed(false);
      cancelFall();
      return undefined;
    }

    let cancelled = false;
    const noteLoss = (lost) => {
      if (pendingRef.current) return;
      if (lost) {
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

    const motionLost = { current: false };
    const orientLost = { current: false };
    const noteCombined = () => noteLoss(motionLost.current || orientLost.current);

    const motionHandler = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      motionLost.current = isLossOfVerticality(tiltFromVertical(a.x, a.y, a.z));
      noteCombined();
    };
    const orientHandler = (e) => {
      orientLost.current = isFlatFromBeta(e.beta);
      noteCombined();
    };

    const start = async () => {
      const ok = await requestMotionPermission();
      if (cancelled) return;
      if (ok === false) {
        setArmed(false);
        return;
      }
      window.addEventListener('devicemotion', motionHandler, { passive: true });
      window.addEventListener('deviceorientation', orientHandler, { passive: true });
      setArmed(true);
    };
    start();

    return () => {
      cancelled = true;
      window.removeEventListener('devicemotion', motionHandler);
      window.removeEventListener('deviceorientation', orientHandler);
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

  return { armed, pending, cancelLeft, cancelFall, requestArm, triggerPreAlarm };
}
