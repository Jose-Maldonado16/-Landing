/* ============================================
   MENU.JS — Catálogo, filtros y tabs
   ============================================ */

const PRODUCTS = [
  {
    id: 1,
    name: 'Helado Artesanal de Fresa',
    desc: 'Cremoso helado con fresas naturales de valles bolivianos.',
    price: 25,
    category: 'helados',
    tag: 'Más pedido',
    img: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 2,
    name: 'Helado de Chocolate Belga',
    desc: 'Intenso chocolate con trozos de cacao al 70%.',
    price: 28,
    category: 'helados',
    tag: 'Premium',
    img: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 3,
    name: 'Cheesecake de Maracuyá',
    desc: 'Base crocante de galleta, crema suave y maracuyá fresco.',
    price: 30,
    category: 'pasteles',
    tag: 'Nuevo',
    img: 'https://images.unsplash.com/photo-1533134242453-ee6e9d8b5dcb?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 4,
    name: 'Torta de Chocolate',
    desc: 'Bizcocho húmedo con ganache de chocolate semiamargo.',
    price: 35,
    category: 'pasteles',
    tag: 'Favorito',
    img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 5,
    name: 'Croissant de Mantequilla',
    desc: 'Hojaldre dorado recién horneado, crujiente por fuera.',
    price: 12,
    category: 'panes',
    tag: 'Recién horneado',
    img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 6,
    name: 'Pan de Chocolate',
    desc: 'Suave pan dulce relleno de crema de chocolate.',
    price: 10,
    category: 'panes',
    tag: '',
    img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    available: false,
  },
  {
    id: 7,
    name: 'Café Latte',
    desc: 'Espresso doble con leche vaporizada y arte latte.',
    price: 18,
    category: 'bebidas',
    tag: 'Barista',
    img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 8,
    name: 'Frappé de Caramelo',
    desc: 'Bebida helada con caramelo, café y crema batida.',
    price: 22,
    category: 'bebidas',
    tag: 'Refrescante',
    img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
  {
    id: 9,
    name: 'Malteada de Vainilla',
    desc: 'Clásica malteada con helado artesanal de vainilla.',
    price: 25,
    category: 'bebidas',
    tag: 'Popular',
    img: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
    available: true,
  },
];

const STEPS = {
  client: [
    { n: '1', title: 'Explora el menú', text: 'Filtra por categorías, revisa precios y disponibilidad en tiempo real.' },
    { n: '2', title: 'Personaliza y paga', text: 'Elige ingredientes, tipo de entrega (recojo o domicilio) y método de pago (QR, tarjeta o efectivo).' },
    { n: '3', title: 'Sigue tu pedido', text: 'Consulta el estado (confirmado, en preparación, listo, entregado) y recibe notificación cuando esté listo.' },
  ],
  staff: [
    { n: '1', title: 'Admin: gestiona el catálogo', text: 'Registra, modifica y elimina productos; visualiza clientes, pedidos y reportes de ventas.' },
    { n: '2', title: 'Cocina: prepara órdenes', text: 'Visualiza las órdenes pendientes, prioriza y marca los pedidos como completados.' },
    { n: '3', title: 'Caja: registra pagos', text: 'Registra pagos en efectivo y emite comprobantes digitales al cliente.' },
  ],
};

document.addEventListener('DOMContentLoaded', () => {
  initMenuFilters();
  initStepsTabs();
});

/* Filtros del menú */
function initMenuFilters() {
  const grid = document.getElementById('menuGrid');
  const filters = document.getElementById('menuFilters');
  if (!grid || !filters) return;

  const render = (items) => {
    if (!items.length) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--slate-500)">No hay productos en esta categoría.</p>`;
      return;
    }
    grid.innerHTML = items
      .map(
        (p) => `
        <article class="product-card">
          <div class="product-card__media">
            <img src="${p.img}" alt="${p.name}" loading="lazy" />
            ${p.tag ? `<span class="product-card__badge">${p.tag}</span>` : ''}
            ${!p.available ? `<span class="product-card__badge product-card__badge--sold">Agotado</span>` : ''}
          </div>
          <div class="product-card__body">
            <h3 class="product-card__title">${p.name}</h3>
            <p class="product-card__desc">${p.desc}</p>
            <div class="product-card__footer">
              <span class="product-card__price">Bs. ${p.price}</span>
              <button class="product-card__btn" ${p.available ? '' : 'disabled'}>
                ${p.available ? '+ Agregar' : 'No disponible'}
              </button>
            </div>
          </div>
        </article>
      `
      )
      .join('');
  };

  filters.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.querySelectorAll('.filter-btn').forEach((b) =>
        b.classList.remove('filter-btn--active')
      );
      btn.classList.add('filter-btn--active');
      const f = btn.dataset.filter;
      const items = f === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === f);
      render(items);
    });
  });

  render(PRODUCTS);
}

/* Tabs de "Cómo Pedir" */
function initStepsTabs() {
  const container = document.getElementById('stepsContainer');
  const tabClient = document.getElementById('tabClient');
  const tabStaff = document.getElementById('tabStaff');
  if (!container || !tabClient || !tabStaff) return;

  const renderSteps = (role) => {
    const steps = STEPS[role];
    const accent = role === 'staff' ? 'step-card--accent' : '';
    container.innerHTML = steps
      .map(
        (s, i) => `
        <article class="step-card ${accent}">
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
    const isClient = role === 'client';
    tabClient.classList.toggle('tabs__btn--active', isClient);
    tabStaff.classList.toggle('tabs__btn--active', !isClient);
    tabStaff.classList.toggle('tabs__btn--accent', !isClient);
  };

  tabClient.addEventListener('click', () => { setActive('client'); renderSteps('client'); });
  tabStaff.addEventListener('click', () => { setActive('staff'); renderSteps('staff'); });

  renderSteps('client');
}