import { useEffect, useState } from 'react';

function parseStart(service) {
  if (!service) return null;
  const dateKey = (service.date || '').split('T')[0];
  const time = service.actual_start || service.start_time;
  if (dateKey && time) {
    const iso = `${dateKey}T${time.length === 5 ? `${time}:00` : time}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (service.started_at) {
    const d = new Date(service.started_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ServiceChrono({ service, className = '' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = parseStart(service);
  if (!start) return null;

  return (
    <div className={`inline-flex items-center gap-2 font-mono text-2xl font-bold tabular-nums ${className}`}>
      {formatElapsed(now - start.getTime())}
      <span className="text-xs font-sans font-medium text-muted-foreground">écoulées</span>
    </div>
  );
}
