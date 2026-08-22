(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const form = document.getElementById('reset-form');
  const invalid = document.getElementById('invalid-token');

  if (!token) {
    invalid.classList.remove('hidden');
    return;
  }

  PhoenixAuth.validateResetToken(token)
    .then((data) => {
      document.getElementById('email-display').value = data.email;
      form.classList.remove('hidden');
    })
    .catch(() => invalid.classList.remove('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const errEl = document.getElementById('msg-error');
    const okEl = document.getElementById('msg-success');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (pwd.length < 8) {
      errEl.textContent = '8 caractères minimum';
      errEl.classList.remove('hidden');
      return;
    }
    if (pwd !== confirm) {
      errEl.textContent = 'Les mots de passe ne correspondent pas';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await PhoenixAuth.resetPassword(token, pwd);
      okEl.textContent = 'Mot de passe enregistré ! Redirection…';
      okEl.classList.remove('hidden');
      form.classList.add('hidden');
      setTimeout(() => { window.location.href = '/login.html'; }, 2000);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
})();
