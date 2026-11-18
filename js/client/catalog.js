/* ============================================
   CATALOG.JS — Catálogo con stock visible en tiempo real
   ============================================ */
(function() {
  let allProducts = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['client', 'admin', 'staff']);
    if (!profile) return;

    const loader = document.getElementById('appLoader');
    const wrapper = document.getElementById('appWrapper');
    if (loader) loader.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';

    const userNameEl = document.getElementById('userName');
    const greetingNameEl = document.getElementById('greetingName');
    if (userNameEl) userNameEl.textContent = profile.full_name || 'Cliente';
    if (greetingNameEl) greetingNameEl.textContent = (profile.full_name || 'Cliente').split(' ')[0];

    document.getElementById('btnLogout')?.addEventListener('click', () => window.logoutUser());

    await loadProducts();
    initFilters();
    initRealtime();
  });

  async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
      const { data, error } = await window.supabase.from('products').select('*').order('id');
      if (error) throw error;
      
      allProducts = data || [];
      
      if (allProducts.length === 0) {
        grid.innerHTML = `<p style="text-align:center;grid-column:1/-1;padding:2rem;">No hay productos disponibles.</p>`;
        return;
      }
      renderProducts(allProducts);
    } catch (error) {
      console.error('Error cargando productos:', error);
      grid.innerHTML = `<p style="color:red;text-align:center;grid-column:1/-1;padding:2rem;">Error al cargar productos.</p>`;
    }
  }

  function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    
    grid.innerHTML = products.map(p => {
      const isOutOfStock = !p.is_available || p.stock <= 0;
      return `
        <article class="dash-product-card">
          <img src="${p.image_url || 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80'}" class="dash-product-img" loading="lazy" alt="${p.name}" />
          <div class="dash-product-body">
            <h3 class="dash-product-title">${p.name}</h3>
            <p class="dash-product-desc">${p.description || 'Delicioso producto artesanal.'}</p>
            <div style="font-size:0.8rem; color:${isOutOfStock ? '#ef4444' : '#10b981'}; margin-bottom:0.5rem; font-weight:600;">
              ${isOutOfStock ? '❌ Agotado' : `✅ ${p.stock} disponibles`}
            </div>
            <div class="dash-product-footer">
              <span class="dash-product-price">Bs. ${p.price}</span>
              <button class="dash-product-btn btn-add-cart" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>
                ${isOutOfStock ? 'Agotado' : '+ Agregar'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const product = allProducts.find(p => p.id === id);
        if (product) {
          window.dispatchEvent(new CustomEvent('add-to-cart', { detail: product }));
        }
      });
    });
  }

  function initFilters() {
    const filters = document.getElementById('categoryFilters');
    if (!filters) return;
    filters.addEventListener('click', (e) => {
      if (!e.target.matches('.filter-btn')) return;
      filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
      e.target.classList.add('filter-btn--active');
      const f = e.target.dataset.filter;
      const filtered = f === 'all' ? allProducts : allProducts.filter(p => p.category === f);
      renderProducts(filtered);
    });
  }

  // Realtime: actualizar stock si alguien más compra
  function initRealtime() {
    window.supabase
      .channel('products-stock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        const idx = allProducts.findIndex(p => p.id === payload.new.id);
        if (idx !== -1) {
          allProducts[idx] = payload.new;
          const activeFilter = document.querySelector('.filter-btn--active')?.dataset.filter || 'all';
          const filtered = activeFilter === 'all' ? allProducts : allProducts.filter(p => p.category === activeFilter);
          renderProducts(filtered);
        }
      })
      .subscribe();
  }
})();