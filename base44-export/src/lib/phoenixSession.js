/**
 * Reprend une session Phoenix.
 * Un jeton local invalide (ancien jeton Base44) ne doit pas empêcher
 * le cookie phoenix_access_token de restaurer la session.
 * Le cookie n'est pas effacé ici : seul le stockage local l'est.
 */
export async function establishPhoenixSession({
  getToken,
  setToken,
  clearLocalToken,
  me,
  fetchSession,
}) {
  const readCookieSession = async () => {
    const token = await fetchSession();
    if (token) setToken(token);
    return token || null;
  };

  let token = getToken();
  if (!token) token = await readCookieSession();

  let result = { ok: false, status: 401, user: null };
  if (token) result = await me();

  const rejected = !result.ok && (result.status === 401 || result.status === 403);
  if (rejected && getToken()) {
    clearLocalToken();
    const recovered = await readCookieSession();
    if (recovered) result = await me();
  }

  return result;
}
