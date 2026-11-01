export function createOutbox(storage, key = 'phoenix_pti_outbox_v1') {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function write(items) {
    storage.setItem(key, JSON.stringify(items));
  }
  return {
    list() {
      return read();
    },
    pending() {
      return read().filter((item) => item.transmission_status !== 'received');
    },
    enqueue(payload) {
      const clientEventId = String(payload?.client_event_id || '').trim();
      if (!clientEventId) throw new Error('client_event_id requis');
      const items = read();
      const existing = items.find((item) => item.client_event_id === clientEventId);
      if (existing) return existing;
      const body = { ...payload, client_event_id: clientEventId };
      delete body.transmission_status;
      delete body.received_at;
      delete body.id;
      const item = {
        client_event_id: clientEventId,
        payload: body,
        transmission_status: 'local_pending',
        server_id: null,
        received_at: null,
        queued_at: new Date().toISOString(),
        last_error: null,
      };
      items.push(item);
      write(items);
      return item;
    },
    async flush(send) {
      const next = [];
      for (const item of read()) {
        if (item.transmission_status === 'received' && item.server_id && item.received_at) {
          next.push(item);
          continue;
        }
        try {
          const response = await send(item.payload);
          if (response?.transmission_status === 'received' && response.id && response.received_at) {
            next.push({
              ...item,
              transmission_status: 'received',
              server_id: response.id,
              received_at: response.received_at,
              last_error: null,
            });
          } else {
            next.push({ ...item, transmission_status: 'local_pending', last_error: 'accusé de réception absent' });
          }
        } catch (err) {
          next.push({ ...item, transmission_status: 'local_pending', last_error: err?.message || 'réseau indisponible' });
        }
      }
      write(next);
      return next;
    },
  };
}

export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}
