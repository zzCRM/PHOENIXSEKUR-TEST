(function () {
  const APP_URL = (window.PHOENIX_CONFIG?.appUrl || 'https://app.phoenixsekur.com').replace(/\/$/, '');

  function appLink(path) {
    return APP_URL + (path || '');
  }

  // Liens vers l'application
  document.getElementById('btn-login').href = appLink('/login');
  document.getElementById('btn-app').href = appLink('/');
  document.getElementById('hero-app-link').href = appLink('/login');
  document.getElementById('cta-app-link').href = appLink('/login');
  document.getElementById('footer-app-link').href = APP_URL;
  document.getElementById('footer-app-link').textContent = APP_URL.replace('https://', '');

  // Si déjà connecté sur app → basculer automatiquement vers l'app
  async function checkSessionAndRedirect() {
    try {
      const res = await fetch(appLink('/api/auth/session'), {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = data.redirect || appLink('/');
      }
    } catch {
      // Vitrine reste affichée
    }
  }

  checkSessionAndRedirect();

  // Formulaire d'inscription essai
  const form = document.getElementById('signup-form');
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
      const res = await fetch(appLink('/api/public/signup-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

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
