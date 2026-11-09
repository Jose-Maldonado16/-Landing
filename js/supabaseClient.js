/* ============================================
   SUPABASE CLIENT (Global V3 - Anti-bucle)
   ============================================ */
const SUPABASE_URL = 'https://anbgtfhewdzqikkashpv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zB8Vj1t6WWAd6G68k5-Bbw_Z0HvjD5h';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

window.getCurrentProfile = async function() {
  try {
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError || !session) return null;

    const { data, error } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.warn('Error leyendo perfil:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error crítico obteniendo perfil:', err);
    return null;
  }
};

window.guardPage = async function(allowedRoles = ['client', 'admin', 'staff']) {
  const profile = await window.getCurrentProfile();
  
  if (!profile) {
    console.log('No hay perfil válido, redirigiendo a login...');
    window.location.replace('/login.html');
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    console.log('Rol no permitido:', profile.role);
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

window.logoutUser = async function() {
  await window.supabase.auth.signOut();
  window.location.replace('/login.html');
};