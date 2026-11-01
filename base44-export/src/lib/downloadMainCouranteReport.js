const TOKEN_KEY = 'phoenix_access_token';

export async function downloadMainCouranteReport({ start, end, siteId, siteIds, filename } = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('base44_access_token');
  const res = await fetch('/api/reports/main-courante.pdf', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      start: start || undefined,
      end: end || undefined,
      site_id: siteId || undefined,
      site_ids: siteIds || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Génération du rapport impossible');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'rapport-main-courante.pdf';
  link.click();
  URL.revokeObjectURL(url);
}
