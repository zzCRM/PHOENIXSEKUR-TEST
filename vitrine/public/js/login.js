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

  // Pas de connexion auto : l'utilisateur choisit toujours Société / Salarié / Client

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
      PhoenixAuth.redirectToApp(result.redirect);
    } catch (err) {
      errEl.textContent = err.message || 'Identifiants incorrects';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
})();
