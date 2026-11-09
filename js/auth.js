/* ============================================
   AUTH.JS
   ============================================ */
const ROLE_ROUTES = {
  client: '/client/dashboard.html',
  admin: '/admin/dashboard.html',
  staff: '/staff/dashboard.html',
};

document.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const registerSuccess = document.getElementById('registerSuccess');

  function showTab(tab) {
    const isLogin = tab === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    tabLogin.classList.toggle('auth-tab--active', isLogin);
    tabRegister.classList.toggle('auth-tab--active', !isLogin);
  }

  tabLogin?.addEventListener('click', () => showTab('login'));
  tabRegister?.addEventListener('click', () => showTab('register'));

  // Toggle password
  document.querySelectorAll('.auth-toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      loginError.textContent = 'Credenciales incorrectas.';
      loginError.classList.remove('hidden');
      return;
    }

    const { data: profile } = await window.supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role || 'client';
    window.location.replace(ROLE_ROUTES[role]);
  });

  // Registro
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.classList.add('hidden');
    registerSuccess.classList.add('hidden');
    
    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    const { data, error } = await window.supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'client' } },
    });

    if (error) {
      registerError.textContent = error.message;
      registerError.classList.remove('hidden');
      return;
    }

    if (!data.session) {
      registerSuccess.textContent = 'Revisa tu correo para confirmar.';
      registerSuccess.classList.remove('hidden');
      return;
    }

    window.location.replace('/client/dashboard.html');
  });

  // Detectar si ya hay sesión
  async function checkSession() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
      const { data: profile } = await window.supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      const role = profile?.role || 'client';
      window.location.replace(ROLE_ROUTES[role]);
    }
  }
  checkSession();

  // Si viene con ?tab=register
  if (new URLSearchParams(window.location.search).get('tab') === 'register') {
    showTab('register');
  }
});