/* ============================================
   TABS.JS - Sección "Cómo Funciona"
   ============================================ */

const STEPS = {
  owner: [
    { n: '1', title: 'Busca por ubicación', text: 'Filtra cuidadores por cercanía, disponibilidad y tipo de servicio.' },
    { n: '2', title: 'Reserva y paga seguro', text: 'Confirma la reserva con pago protegido desde la plataforma.' },
    { n: '3', title: 'Sigue y reseña', text: 'Monitorea el paseo en tiempo real vía GPS y deja tu reseña.' },
  ],
  sitter: [
    { n: '1', title: 'Registra tu perfil', text: 'Crea tu perfil con fotos, experiencia y servicios que ofreces.' },
    { n: '2', title: 'Verificación', text: 'Validamos tu identidad y antecedentes para dar confianza.' },
    { n: '3', title: 'Recibe reservas e ingresos', text: 'Acepta reservas, cuida mascotas y genera ingresos con flexibilidad.' },
  ],
};

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('stepsContainer');
  const tabOwner = document.getElementById('tabOwner');
  const tabSitter = document.getElementById('tabSitter');
  if (!container || !tabOwner || !tabSitter) return;

  const renderSteps = (role) => {
    const steps = STEPS[role];
    const accentClass = role === 'sitter' ? 'step-card--accent' : '';
    container.innerHTML = steps
      .map(
        (s, i) => `
        <article class="step-card ${accentClass}">
          <div class="step-card__number">${s.n}</div>
          <h3>${s.title}</h3>
          <p>${s.text}</p>
          ${i < steps.length - 1 ? '<span class="step-card__arrow">→</span>' : ''}
        </article>
      `
      )
      .join('');
  };

  const setActive = (role) => {
    const isOwner = role === 'owner';
    tabOwner.classList.toggle('tabs__btn--active', isOwner);
    tabSitter.classList.toggle('tabs__btn--active', !isOwner);
    tabSitter.classList.toggle('tabs__btn--accent', !isOwner);
  };

  const switchTab = (role) => {
    setActive(role);
    renderSteps(role);
  };

  tabOwner.addEventListener('click', () => switchTab('owner'));
  tabSitter.addEventListener('click', () => switchTab('sitter'));

  // Render inicial
  renderSteps('owner');
});