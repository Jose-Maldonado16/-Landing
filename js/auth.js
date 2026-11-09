/* ============================================
   AUTH.JS — Login / Registro / Redirección por rol
   ============================================ */
import { supabase } from './supabaseClient.js';

/* ---------- Redirección según rol ---------- */
const ROLE_ROUTES = {
  client: '/client/dashboard.html',
  admin: '/admin/dashboard.html',
  staff: '/staff/dashboard.html',
};

/* ---------- Elementos del DOM ---------- */
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

/* ---------- Alternar tabs ---------- */
function showTab(tab) {
  const isLogin = tab === 'login';
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);
  tabLogin.classList.toggle('auth-tab--active', isLogin);
  tabRegister.classList.toggle('auth-tab--active', !isLogin);
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));

/* ---------- Mostrar/ocultar contraseña ---------- */
document.querySelectorAll('.auth-toggle-pass').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🙈';
  });
});

/* ---------- Helpers ---------- */
function setError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}
function clearError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}
function setLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  const txt = btn.querySelector('.auth-btn-text');
  btn.disabled = loading;
  btn.classList.toggle('auth-btn--loading', loading);
  if (!btn.dataset.originalText) btn.dataset.originalText = txt.textContent;
  txt.textContent = loading ? 'Procesando...' : btn.dataset.originalText;
}

/* ---------- Obtener rol desde profiles ---------- */
async function fetchRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('No se pudo leer rol, usando client por defecto:', error.message);
    return 'client';
  }
  return data?.role || 'client';
}

/* ---------- Redirigir por rol ---------- */
function redirectByRole(role) {
  window.location.href = ROLE_ROUTES[role] || '/index.html';
}

/* ---------- LOGIN ---------- */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginError);

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    setError(loginError, 'Ingresa correo y contraseña.');
    return;
  }

  setLoading(loginForm, true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setLoading(loginForm, false);
    const msg = error.message.includes('Invalid login credentials')
      ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
      : error.message;
    setError(loginError, msg);
    return;
  }

  const role = await fetchRole(data.user.id);
  redirectByRole(role);
});

/* ---------- REGISTRO ---------- */
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(registerError);
  registerSuccess.classList.add('hidden');

  const fullName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;

  if (fullName.length < 3) {
    setError(registerError, 'El nombre debe tener al menos 3 caracteres.');
    return;
  }
  if (password.length < 6) {
    setError(registerError, 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  setLoading(registerForm, true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone || null,
        role: 'client',
      },
    },
  });

  if (error) {
    setLoading(registerForm, false);
    const msg = error.message.includes('already registered')
      ? 'Este correo ya está registrado. Intenta iniciar sesión.'
      : error.message;
    setError(registerError, msg);
    return;
  }

  // Si Supabase requiere confirmación de email, la sesión viene null
  if (!data.session) {
    setLoading(registerForm, false);
    registerSuccess.textContent =
      '✅ Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.';
    registerSuccess.classList.remove('hidden');
    registerForm.reset();
    return;
  }

  // Si no requiere confirmación, auto-login y redirección
  const role = await fetchRole(data.user.id);
  redirectByRole(role);
});

/* ---------- Si ya está autenticado al entrar a login.html ---------- */
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Si ya hay sesión, obtenemos el rol y redirigimos inmediatamente
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
      
    const role = profile?.role || 'client';
    window.location.replace(ROLE_ROUTES[role] || '/index.html');
  }
})();

/* ---------- Detectar si viene con ?tab=register desde la landing ---------- */
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tab') === 'register') {
  showTab('register');
}