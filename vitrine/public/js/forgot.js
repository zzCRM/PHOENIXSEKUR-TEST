(function () {
  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const success = document.getElementById('msg-success');
    const error = document.getElementById('msg-error');
    const link = document.getElementById('msg-link');
    const btn = document.getElementById('submit-btn');
    [success, error, link].forEach((el) => el.classList.add('hidden'));
    btn.disabled = true;

    try {
      const email = document.getElementById('email').value;
      const result = await PhoenixAuth.forgotPassword(email);
      success.textContent = result.message;
      success.classList.remove('hidden');
      if (result.reset_url) {
        link.innerHTML = `SMTP non configuré — lien manuel : <a href="${result.reset_url}">${result.reset_url}</a>`;
        link.classList.remove('hidden');
      }
    } catch (err) {
      error.textContent = err.message;
      error.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
})();
