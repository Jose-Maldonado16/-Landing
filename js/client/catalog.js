/* ============================================
   CATALOG.JS — Carga productos y maneja la UI
   ============================================ */
(function() {
  let allProducts = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard
    const profile = await window.guardPage(['client', 'admin', 'staff']);
    
    // Si guardPage redirigió, detenemos la ejecución.
    if (!profile) return; 

    // 2. ¡Éxito! Ocultar loader y mostrar app
    const loader = document.getElementById('appLoader');
    const wrapper = document.getElementById('appWrapper');
    if (loader) loader.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';

    // 3. Datos usuario
    const userNameEl = document.getElementById('userName');
    const greetingNameEl = document.getElementById('greetingName');
    if (userNameEl) userNameEl.textContent = profile.full_name || 'Cliente';
    if (greetingNameEl) greetingNameEl.textContent = (profile.full_name || 'Cliente').split(' ')[0];

    // 4. Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => window.logoutUser());

    // 5. Cargar productos
    await loadProducts();
    initFilters();
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
    grid.innerHTML = products.map(p => `
      <article class="dash-product-card">
        <img src="${p.image_url || 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80'}" class="dash-product-img" loading="lazy" alt="${p.name}" />
        <div class="dash-product-body">
          <h3 class="dash-product-title">${p.name}</h3>
          <p class="dash-product-desc">${p.description || 'Delicioso producto artesanal.'}</p>
          <div class="dash-product-footer">
            <span class="dash-product-price">Bs. ${p.price}</span>
            <button class="dash-product-btn btn-add-cart" data-id="${p.id}" ${!p.is_available || p.stock <= 0 ? 'disabled' : ''}>
              ${!p.is_available || p.stock <= 0 ? 'Agotado' : '+ Agregar'}
            </button>
          </div>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const product = allProducts.find(p => p.id === id);
        if (product) window.dispatchEvent(new CustomEvent('add-to-cart', { detail: product }));
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
})();