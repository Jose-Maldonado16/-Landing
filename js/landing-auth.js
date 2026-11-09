/* ============================================
   LANDING-AUTH.JS — Lógica de sesión en la landing
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  
  const navActions = document.getElementById('navActions');
  const mobileCtaGroup = document.getElementById('mobileCtaGroup');

  if (session) {
    // Usuario autenticado
    const { data: profile } = await window.supabase
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

    // Función logout
    const handleLogout = async () => {
      await window.supabase.auth.signOut();
      window.location.reload();
    };

    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
    document.getElementById('btnLogoutMobile')?.addEventListener('click', handleLogout);

  } else {
    // Usuario NO autenticado
    if (navActions) {
      navActions.innerHTML = `
        <a href="/login.html" class="btn btn--outline btn--sm">Iniciar Sesión</a>
        <a href="/login.html?tab=register" class="btn btn--primary btn--sm">Registrarse</a>
      `;
    }
    if (mobileCtaGroup) {
      mobileCtaGroup.innerHTML = `
        <a href="/login.html" class="btn btn--outline btn--block">Iniciar Sesión</a>
        <a href="/login.html?tab=register" class="btn btn--primary btn--block">Registrarse</a>
      `;
    }
  }

  // Redirigir los botones de "Pedir Ahora"
  const ctaButtons = document.querySelectorAll('#ctaMenuLogin, #ctaBannerLogin, a[href="#menu"].btn--primary');
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!session) {
        window.location.href = '/login.html';
      } else {
        // Si ya está logueado, lo mandamos a su panel
        const { data: { user } } = await window.supabase.auth.getUser(); // fallback
        window.location.href = '/client/dashboard.html'; 
      }
    });
  });
});