(function (global) {
  const APP_URL = (global.PHOENIX_CONFIG?.appUrl || 'https://app.phoenixsekur.com').replace(/\/$/, '');

  async function apiFetch(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Erreur');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function checkSession() {
    try {
      return await apiFetch('/auth/session');
    } catch {
      return { authenticated: false };
    }
  }

  async function login({ email, password, portal }) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, portal }),
    });
  }

  async function forgotPassword(email) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async function resetPassword(token, password) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async function validateResetToken(token) {
    return apiFetch(`/auth/reset-password/${token}`);
  }

  function redirectToApp(url) {
    global.location.href = url || APP_URL;
  }

  global.PhoenixAuth = {
    APP_URL,
    apiFetch,
    checkSession,
    login,
    forgotPassword,
    resetPassword,
    validateResetToken,
    redirectToApp,
  };
})(window);
