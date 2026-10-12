/* ============================================
   MAIN.JS - Interacciones globales
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
  initMobileMenu();
  initYear();
  initSmoothScroll();
});

/* Navbar cambia al hacer scroll */
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* Menú hamburguesa móvil */
function initMobileMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  const iconOpen = document.getElementById('iconOpen');
  const iconClose = document.getElementById('iconClose');
  if (!btn || !menu) return;

  const toggle = (open) => {
    const isOpen = open ?? menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isOpen);
    iconOpen.classList.toggle('hidden', isOpen);
    iconClose.classList.toggle('hidden', !isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  };

  btn.addEventListener('click', () => toggle());

  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => toggle(false));
  });

  // Cerrar al hacer resize a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) toggle(false);
  });
}

/* Año dinámico en footer */
function initYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* Smooth scroll con offset para navbar fija */
function initSmoothScroll() {
  const navHeight = 72;
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}