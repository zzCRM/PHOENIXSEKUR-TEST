const COOKIE_NAME = 'phoenix_access_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 jours

export function getTokenFromRequest(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);

  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function setAuthCookie(res, token) {
  const domain = process.env.COOKIE_DOMAIN;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE}`,
    'SameSite=Lax',
    'Secure',
    'HttpOnly',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(res) {
  const domain = process.env.COOKIE_DOMAIN;
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'Secure',
    'HttpOnly',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function getAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.DOMAIN) return `https://${process.env.DOMAIN}`;
  return 'http://localhost:5173';
}
