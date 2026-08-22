(function () {
  const APP_URL = (window.PHOENIX_CONFIG?.appUrl || 'https://app.phoenixsekur.com').replace(/\/$/, '');
  const LOGIN_URL = '/login.html';

  const loginLinks = [
    'btn-login', 'hero-login-link', 'cta-login-link', 'footer-login-link',
  ];

  loginLinks.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = LOGIN_URL;
  });

  const footerLabel = document.getElementById('footer-app-label');
  if (footerLabel) {
    try {
      footerLabel.textContent = new URL(APP_URL).host;
    } catch {
      footerLabel.textContent = 'app.phoenixsekur.com';
    }
  }

  async function initNav() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('logged_out')) {
      history.replaceState(null, '', window.location.pathname);
      return;
    }
    const btnApp = document.getElementById('btn-app');
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = data.redirect || APP_URL;
        return;
      }
      if (btnApp) btnApp.href = LOGIN_URL;
    } catch {
      if (btnApp) btnApp.href = LOGIN_URL;
    }
  }

  initNav();

  const form = document.getElementById('signup-form');
  if (!form) return;

  const successEl = document.getElementById('form-success');
  const errorEl = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    successEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());

    try {
      const res = await fetch('/api/public/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'envoi');
      successEl.textContent = data.message || 'Demande envoyée ! Nous vous contactons sous 24–48 h.';
      successEl.classList.remove('hidden');
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer ma demande';
    }
  });
})();
