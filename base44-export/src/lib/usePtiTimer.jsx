import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_INTERVAL_MIN = 15;

function storageKey(serviceId) {
  return `pti_last_ok_${serviceId || 'default'}`;
}

export function usePtiTimer({
  active,
  serviceId,
  intervalMinutes = DEFAULT_INTERVAL_MIN,
  onMissedDeadline,
  onWarning,
}) {
  const [secondsLeft, setSecondsLeft] = useState(intervalMinutes * 60);
  const [overdue, setOverdue] = useState(false);
  const warnedRef = useRef(false);
  const missedRef = useRef(false);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (serviceId) localStorage.setItem(storageKey(serviceId), String(now));
    setSecondsLeft(intervalMinutes * 60);
    setOverdue(false);
    warnedRef.current = false;
    missedRef.current = false;
  }, [serviceId, intervalMinutes]);

  useEffect(() => {
    if (!active || !serviceId) {
      setSecondsLeft(intervalMinutes * 60);
      setOverdue(false);
      return undefined;
    }

    const tick = () => {
      const raw = localStorage.getItem(storageKey(serviceId));
      const lastOk = raw ? Number(raw) : Date.now();
      const elapsed = Math.floor((Date.now() - lastOk) / 1000);
      const total = intervalMinutes * 60;
      const left = Math.max(0, total - elapsed);
      setSecondsLeft(left);
      setOverdue(left === 0);

      if (left > 0 && left <= 60 && !warnedRef.current) {
        warnedRef.current = true;
        onWarning?.();
      }
      if (left === 0 && !missedRef.current) {
        missedRef.current = true;
        onMissedDeadline?.();
      }
    };

    if (!localStorage.getItem(storageKey(serviceId))) {
      localStorage.setItem(storageKey(serviceId), String(Date.now()));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, serviceId, intervalMinutes, onMissedDeadline, onWarning]);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return {
    secondsLeft,
    timeLabel: fmt(secondsLeft),
    overdue,
    resetTimer,
    intervalMinutes,
  };
}
