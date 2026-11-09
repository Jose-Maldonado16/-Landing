/* ============================================
   CONEXIÓN A SUPABASE (V2 - Anti-bucle)
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
 * Obtiene el perfil del usuario con reintentos.
 */
export async function getCurrentProfile() {
  // 1. Obtener sesión
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return null;
  }

  // 2. Obtener perfil de la tabla 'profiles'
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error obteniendo perfil:', error.message);
    // Si el error es que no hay fila (PGRST116), el trigger falló al crear el usuario
    if (error.code === 'PGRST116') {
      console.warn('Perfil no encontrado. Creando perfil de emergencia...');
      // Intentar crear el perfil si no existe
      const { data: newProfile } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, full_name: session.user.email, role: 'client' })
        .select()
        .single();
      return newProfile;
    }
    return null;
  }

  return data;
}

/**
 * Protege una página: valida sesión y rol.
 */
export async function guardPage(allowedRoles = ['client', 'admin', 'staff']) {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      console.log('No hay perfil, redirigiendo a login...');
      window.location.replace('/login.html'); // Usamos replace para no llenar el historial
      return null;
    }

    if (!allowedRoles.includes(profile.role)) {
      console.log(`Rol ${profile.role} no permitido. Redirigiendo...`);
      const routes = {
        client: '/client/dashboard.html',
        admin: '/admin/dashboard.html',
        staff: '/staff/dashboard.html',
      };
      window.location.replace(routes[profile.role] || '/login.html');
      return null;
    }

    return profile;
  } catch (err) {
    console.error('Error crítico en guardPage:', err);
    window.location.replace('/login.html');
    return null;
  }
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.replace('/login.html');
}