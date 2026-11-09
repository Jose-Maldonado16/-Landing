/* ============================================
   LANDING-AUTH.JS — Conecta la landing con Supabase
   ============================================ */
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const navActions = document.querySelector('.navbar__actions');
  const mobileCtaGroup = document.querySelector('.mobile-menu__cta-group');

  if (session) {
    // Usuario autenticado: Obtener su rol
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role || 'client';
    const roleRoutes = {
      client: '/client/dashboard.html',
      admin: '/admin/dashboard.html',
      staff: '/staff/dashboard.html',
    };
    const panelUrl = roleRoutes[role];

    // Actualizar Navbar Desktop
    if (navActions) {
      navActions.innerHTML = `
        <a href="${panelUrl}" class="btn btn--primary btn--sm">👤 Mi Panel</a>
        <button id="btnLogout" class="btn btn--outline btn--sm">Salir</button>
      `;
    }

    // Actualizar Menú Móvil
    if (mobileCtaGroup) {
      mobileCtaGroup.innerHTML = `
        <a href="${panelUrl}" class="btn btn--primary btn--block">👤 Mi Panel</a>
        <button id="btnLogoutMobile" class="btn btn--outline btn--block">Cerrar Sesión</button>
      `;
    }

    // Función para cerrar sesión
    const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.reload();
    };

    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
    document.getElementById('btnLogoutMobile')?.addEventListener('click', handleLogout);

  } else {
    // Usuario NO autenticado
    if (navActions) {
      navActions.innerHTML = `
        <a href="login.html" class="btn btn--outline btn--sm">Iniciar Sesión</a>
        <a href="login.html?tab=register" class="btn btn--primary btn--sm">Registrarse</a>
      `;
    }
    if (mobileCtaGroup) {
      mobileCtaGroup.innerHTML = `
        <a href="login.html" class="btn btn--outline btn--block">Iniciar Sesión</a>
        <a href="login.html?tab=register" class="btn btn--primary btn--block">Registrarse</a>
      `;
    }
  }

  // Redirigir los botones de "Pedir Ahora" de la landing al panel o login
  const ctaButtons = document.querySelectorAll('a[href="#pedir"], a[href="#menu"]');
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!session) {
        e.preventDefault();
        window.location.href = 'login.html';
      } else {
        e.preventDefault();
        // Asumiendo que el cliente va a su dashboard a pedir
        window.location.href = '/client/dashboard.html'; 
      }
    });
  });
});