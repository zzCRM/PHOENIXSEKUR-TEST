(function () {
  const params = new URLSearchParams(window.location.search);
  const defaultPortal = params.get('portal') || 'entreprise';

  document.querySelectorAll('.portal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.portal-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('portal').value = tab.dataset.portal;
    });
  });

  const activeTab = document.querySelector(`.portal-tab[data-portal="${defaultPortal}"]`);
  if (activeTab) activeTab.click();

  function resolveRedirect(result) {
    const returnUrl = params.get('return');
    if (returnUrl) {
      try {
        const u = new URL(returnUrl);
        const appHost = new URL(PhoenixAuth.APP_URL).host;
        if (u.host === appHost) return returnUrl;
      } catch { /* ignore invalid URL */ }
    }
    return result.redirect;
  }

  PhoenixAuth.checkSession().then((s) => {
    if (s.authenticated) PhoenixAuth.redirectToApp(resolveRedirect(s));
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Connexion…';

    try {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const portal = document.getElementById('portal').value;
      const result = await PhoenixAuth.login({ email, password, portal });
      PhoenixAuth.redirectToApp(resolveRedirect(result));
    } catch (err) {
      errEl.textContent = err.message || 'Identifiants incorrects';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
})();
