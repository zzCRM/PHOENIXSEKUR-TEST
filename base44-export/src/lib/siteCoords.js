export function siteLatLng(site) {
  if (!site) return null;
  const lat = Number(site.latitude ?? site.lat);
  const lng = Number(site.longitude ?? site.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) + Math.abs(lng) < 0.01) return null;
  return { lat, lng };
}

export function siteAddress(site) {
  if (!site) return '';
  return [site.address, site.postal_code, site.city].filter(Boolean).join(', ') || site.name || '';
}

const geoCache = new Map();

export async function geocodeAddress(address) {
  const q = String(address || '').trim();
  if (q.length < 4) return null;
  if (geoCache.has(q)) return geoCache.get(q);
  try {
    const cached = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`geo:${q}`) : null;
    if (cached) {
      const pos = JSON.parse(cached);
      geoCache.set(q, pos);
      return pos;
    }
  } catch {
    /* ignore */
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'fr' } });
    const data = await res.json();
    if (!data?.[0]?.lat) {
      geoCache.set(q, null);
      return null;
    }
    const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geoCache.set(q, pos);
    try { sessionStorage.setItem(`geo:${q}`, JSON.stringify(pos)); } catch { /* ignore */ }
    return pos;
  } catch {
    return null;
  }
}
