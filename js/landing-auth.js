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
      .maybeSingle();

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

    // Redirigir los botones de "Pedir Ahora" al panel del usuario
    const ctaButtons = document.querySelectorAll('#ctaMenuLogin, #ctaBannerLogin, a[href="#menu"].btn--primary');
    ctaButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = panelUrl;
      });
    });

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

    // Redirigir los botones de "Pedir Ahora" al login
    const ctaButtons = document.querySelectorAll('#ctaMenuLogin, #ctaBannerLogin, a[href="#menu"].btn--primary');
    ctaButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/login.html';
      });
    });
  }
});