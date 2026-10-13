// Login pages: customer (login + register), admin, barber.
(function () {
  const page = document.body.dataset.page;
  const msg = $('#msg');
  const fail = (e) => { msg.textContent = e.message; };

  if (page === 'customer-login') {
    // The terms must be accepted before the login page can be used.
    if (!sessionStorage.getItem('kp_terms')) { location.replace('index.html'); return; }

    const forms = { login: $('#form-login'), register: $('#form-register') };
    const tabs = { login: $('#tab-login'), register: $('#tab-register') };
    const switchTo = (k) => {
      Object.keys(forms).forEach((x) => { forms[x].hidden = x !== k; tabs[x].classList.toggle('on', x === k); });
      msg.textContent = '';
    };
    tabs.login.onclick = () => switchTo('login');
    tabs.register.onclick = () => switchTo('register');
    switchTo('login');

    const submit = (form, path, pick) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = '';
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const data = await api(path, { method: 'POST', body: { ...pick(), acceptTerms: true } });
        setToken('customer', data.token);
        location.href = 'customer.html';
      } catch (err) { fail(err); btn.disabled = false; }
    });

    submit(forms.login, '/auth/login', () => ({ email: $('#l-email').value, password: $('#l-pass').value }));
    submit(forms.register, '/auth/register', () => ({
      name: $('#r-name').value, email: $('#r-email').value, phone: $('#r-phone').value, password: $('#r-pass').value,
    }));
    return;
  }

  // Admin / barber
  const role = page === 'admin-login' ? 'admin' : 'barber';
  $('#form-staff').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = await api(`/auth/${role}/login`, { method: 'POST', body: { username: $('#s-user').value, password: $('#s-pass').value } });
      setToken(role, data.token);
      location.href = role + '.html';
    } catch (err) { fail(err); btn.disabled = false; }
  });
})();
