import { useCallback, useEffect, useRef, useState } from 'react';

export function useTorch() {
  const streamRef = useRef(null);
  const [on, setOn] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }, []);

  const toggle = useCallback(async () => {
    if (on) {
      stop();
      return { ok: true, on: false };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (!caps.torch) {
        stream.getTracks().forEach((t) => t.stop());
        return { ok: false, reason: 'Flash non disponible sur cet appareil.' };
      }
      await track.applyConstraints({ advanced: [{ torch: true }] });
      streamRef.current = stream;
      setOn(true);
      return { ok: true, on: true };
    } catch {
      return { ok: false, reason: 'Impossible d’allumer le flash. Autorisez la caméra.' };
    }
  }, [on, stop]);

  useEffect(() => () => stop(), [stop]);
  return { on, toggle };
}
