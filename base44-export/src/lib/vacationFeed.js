function parseHm(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function inTimeWindow(eventTime, start, end) {
  const e = parseHm(eventTime);
  const s = parseHm(start);
  if (e == null || s == null) return false;
  const f = parseHm(end);
  if (f == null) return e >= s;
  if (f > s) return e >= s && e <= f;
  return e >= s || e <= f;
}

function dateKey(v) {
  return String(v || '').split('T')[0];
}

function sameAgent(event, service) {
  const eventId = event.agent_id && String(event.agent_id);
  const serviceId = service.agent_id && String(service.agent_id);
  if (eventId && serviceId && eventId === serviceId) return true;
  const eventName = event.agent_name && String(event.agent_name).trim().toLowerCase();
  const serviceName = service.agent_name && String(service.agent_name).trim().toLowerCase();
  if (eventName && serviceName && eventName === serviceName) return true;
  if (!eventId && !eventName) return true;
  if (!serviceId && !serviceName) return true;
  if (eventId && serviceId && eventId !== serviceId && !eventName) return false;
  if (eventName && serviceName && eventName !== serviceName && !(eventId && serviceId && eventId === serviceId)) return false;
  if (eventId && serviceId && eventId !== serviceId && eventName && serviceName && eventName !== serviceName) return false;
  return true;
}

/** Un événement de main courante n’appartient qu’à une vacation (service / mission). */
export function isEventForVacation(event, service, nowTime) {
  if (!event || !service) return false;
  if (event.service_id && service.id) {
    return String(event.service_id) === String(service.id);
  }
  if (event.mission_id && service.mission_id) {
    return String(event.mission_id) === String(service.mission_id);
  }
  if (!sameAgent(event, service)) return false;
  if (service.site_id && event.site_id && String(event.site_id) !== String(service.site_id)) return false;

  const start = service.actual_start || service.planned_start;
  const end = service.actual_end || service.planned_end || nowTime;
  const dE = dateKey(event.date);
  const dS = dateKey(service.date);
  const s = parseHm(start);
  const f = parseHm(end);
  const overnight = s != null && f != null && f <= s;

  if (!overnight) {
    if (dE && dS && dE !== dS) return false;
    return inTimeWindow(event.time, start, end);
  }

  if (dE && dS) {
    if (dE === dS) return parseHm(event.time) != null && parseHm(event.time) >= s;
    const [y, mo, d] = dS.split('-').map(Number);
    const nextKey = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
    if (dE === nextKey) return parseHm(event.time) != null && parseHm(event.time) <= f;
    return false;
  }
  return inTimeWindow(event.time, start, end);
}
