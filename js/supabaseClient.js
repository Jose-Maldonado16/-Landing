/* ============================================
   SUPABASE CLIENT (Global)
   ============================================ */
const SUPABASE_URL = 'https://anbgtfhewdzqikkashpv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zB8Vj1t6WWAd6G68k5-Bbw_Z0HvjD5h';

// Creamos el cliente globalmente
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// Función global para obtener el perfil
window.getCurrentProfile = async function() {
  const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
  if (sessionError || !session) return null;

  const { data, error } = await window.supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error perfil:', error);
    return null;
  }
  return data;
};

// Función global para proteger rutas
window.guardPage = async function(allowedRoles = ['client', 'admin', 'staff']) {
  const profile = await window.getCurrentProfile();
  
  if (!profile) {
    console.log('No hay sesión, redirigiendo a login...');
    window.location.replace('/login.html');
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    console.log('Rol incorrecto:', profile.role);
    const routes = {
      client: '/client/dashboard.html',
      admin: '/admin/dashboard.html',
      staff: '/staff/dashboard.html',
    };
    window.location.replace(routes[profile.role] || '/login.html');
    return null;
  }
  return profile;
};

// Función global para cerrar sesión
window.logoutUser = async function() {
  await window.supabase.auth.signOut();
  window.location.replace('/login.html');
};