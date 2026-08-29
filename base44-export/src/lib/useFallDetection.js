import { useCallback, useEffect, useRef, useState } from 'react';
import { detectBrutalFall, isUprightTilt, magnitude, tiltFromVertical } from '@/lib/fallDetect';
import { unlockPtiAudio } from '@/lib/ptiAlarm';

const CANCEL_SEC = 20;
const CONFIRM_MS = 2500;

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
  const brutalAtRef = useRef(null);
  const onFallRef = useRef(onFallConfirmed);
  onFallRef.current = onFallConfirmed;

  const cancelFall = useCallback(() => {
    pendingRef.current = false;
    brutalAtRef.current = null;
    setPending(false);
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
    const samples = [];

    const motionHandler = (e) => {
      const g = e.accelerationIncludingGravity || e.acceleration;
      if (!g) return;
      const now = Date.now();
      const lin = e.acceleration ? magnitude(e.acceleration.x, e.acceleration.y, e.acceleration.z) : null;
      const sample = {
        t: now,
        mag: magnitude(g.x, g.y, g.z),
        linear: lin,
        tilt: tiltFromVertical(g.x, g.y, g.z),
      };
      samples.push(sample);
      while (samples.length && now - samples[0].t > 1200) samples.shift();
      if (samples.length > 48) samples.shift();
      if (pendingRef.current) return;

      if (detectBrutalFall(samples)) {
        if (!brutalAtRef.current) brutalAtRef.current = now;
      } else if (isUprightTilt(sample.tilt)) {
        brutalAtRef.current = null;
      }

      if (brutalAtRef.current && sample.tilt >= 58 && now - brutalAtRef.current >= CONFIRM_MS) {
        pendingRef.current = true;
        setPending(true);
        setCancelLeft(CANCEL_SEC);
      }
    };

    const start = async () => {
      const ok = await requestMotionPermission();
      if (cancelled) return;
      if (ok === false) {
        setArmed(false);
        return;
      }
      window.addEventListener('devicemotion', motionHandler, { passive: true });
      setArmed(true);
    };
    start();

    return () => {
      cancelled = true;
      window.removeEventListener('devicemotion', motionHandler);
      setArmed(false);
    };
  }, [active, armNonce, cancelFall]);

  useEffect(() => {
    if (!pending) return undefined;
    const id = setInterval(() => {
      setCancelLeft((s) => {
        if (s <= 1) {
          pendingRef.current = false;
          brutalAtRef.current = null;
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
