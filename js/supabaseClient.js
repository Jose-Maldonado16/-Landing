/* ============================================
   CONEXIÓN A SUPABASE
   ============================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://anbgtfhewdzqikkashpv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zB8Vj1t6WWAd6G68k5-Bbw_Z0HvjD5h';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

/**
 * Devuelve el perfil del usuario autenticado.
 * Si no hay sesión, retorna null.
 */
export async function getCurrentProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error obteniendo perfil:', error);
    return null;
  }
  return data;
}

/**
 * Cierra la sesión y redirige al login.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

/**
 * Protege una página: valida sesión y rol.
 * @param {string[]} allowedRoles - Roles permitidos, ej: ['admin']
 * @returns {Promise<object|null>} - Perfil del usuario o null si redirige.
 */
export async function guardPage(allowedRoles = ['client', 'admin', 'staff']) {
  const profile = await getCurrentProfile();

  if (!profile) {
    window.location.href = '/login.html';
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    // Redirige al panel que le corresponde
    const routes = {
      client: '/client/dashboard.html',
      admin: '/admin/dashboard.html',
      staff: '/staff/dashboard.html',
    };
    window.location.href = routes[profile.role] || '/login.html';
    return null;
  }

  return profile;
}