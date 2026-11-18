/* ============================================
   CATALOG.JS — Catálogo con extras (complementos)
   CORREGIDO: carga complementos antes de productos
   ============================================ */
(function() {
  let allProducts = [];
  let allComplementos = [];
  let currentProductForExtra = null;
  let currentCartItemId = null;

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

    // ⚠️ ORDEN CORREGIDO: primero complementos, luego productos
    await loadComplementos();
    await loadProducts();

    initFilters();
    initExtrasModal();
    initRealtime();
  });

  async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
      const { data, error } = await window.supabase
        .from('products')
        .select('*')
        .neq('category', 'complementos')
        .order('id');
      
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

  async function loadComplementos() {
    const { data, error } = await window.supabase
      .from('products')
      .select('*')
      .eq('category', 'complementos')
      .order('id');
    
    if (!error) {
      allComplementos = data || [];
      console.log('Complementos cargados:', allComplementos.length);
    }
  }

  function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    
    grid.innerHTML = products.map(p => {
      const isOutOfStock = !p.is_available || p.stock <= 0;
      const hasExtras = allComplementos.length > 0;
      
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
              <div style="display:flex; gap:0.35rem;">
                <button class="dash-product-btn btn-add-cart" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''} style="padding:0.5rem 0.75rem;">
                  ${isOutOfStock ? 'Agotado' : '+ Agregar'}
                </button>
                ${hasExtras && !isOutOfStock ? `
                  <button class="btn-extras" data-id="${p.id}" title="Agregar con complementos" style="background: rgba(245,158,11,0.2); color: #fcd34d; border: none; border-radius: 99px; padding: 0.5rem 0.75rem; cursor: pointer; font-weight: 700; font-size: 0.8rem;">➕ Extras</button>
                ` : ''}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Event listeners
    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const product = allProducts.find(p => p.id === id);
        if (product) {
          window.dispatchEvent(new CustomEvent('add-to-cart', { detail: product }));
        }
      });
    });

    document.querySelectorAll('.btn-extras').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const product = allProducts.find(p => p.id === id);
        if (product) openExtrasModal(product);
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

  function initExtrasModal() {
    const modal = document.getElementById('extrasModal');
    if (!modal) return;

    const closeBtn = document.getElementById('btnCloseExtras');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    const form = document.getElementById('extrasForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentCartItemId) {
          alert('Error: no se encontró el producto en el carrito.');
          return;
        }

        const checkboxes = form.querySelectorAll('input[name="extras"]:checked');
        const selectedExtras = Array.from(checkboxes).map(cb => {
          return allComplementos.find(c => c.id === parseInt(cb.value));
        }).filter(Boolean);

        if (selectedExtras.length === 0) {
          alert('Selecciona al menos un complemento.');
          return;
        }

        selectedExtras.forEach(extra => {
          window.dispatchEvent(new CustomEvent('add-to-cart', { 
            detail: { 
              ...extra, 
              is_extra: true, 
              parent_cart_item_id: currentCartItemId
            }
          }));
        });

        modal.classList.remove('active');
        currentCartItemId = null;
        currentProductForExtra = null;
      });
    }
  }

  function openExtrasModal(product) {
    currentProductForExtra = product;
    const modal = document.getElementById('extrasModal');
    const title = document.getElementById('extrasTitle');
    const form = document.getElementById('extrasForm');
    if (!modal || !title || !form) return;

    // 1. Agregar el producto principal al carrito
    window.dispatchEvent(new CustomEvent('add-to-cart', { detail: product }));

    // 2. Obtener el cart_item_id del último producto agregado
    const currentCart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];
    const lastItem = currentCart[currentCart.length - 1];
    if (!lastItem) {
      alert('Error al agregar el producto al carrito.');
      return;
    }
    currentCartItemId = lastItem.cart_item_id;

    title.textContent = `Complementos para: ${product.name}`;

    const disponibles = allComplementos.filter(c => c.is_available && c.stock > 0);
    if (disponibles.length === 0) {
      form.innerHTML = `<p style="text-align:center;color:var(--text-muted);">No hay complementos disponibles.</p>`;
      modal.classList.add('active');
      return;
    }

    form.innerHTML = disponibles.map(c => `
      <label style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; background:#0b1120; border-radius:0.5rem; margin-bottom:0.5rem; cursor:pointer; border:1px solid var(--border-dark);">
        <input type="checkbox" name="extras" value="${c.id}" style="width:20px; height:20px; cursor:pointer;">
        <div style="flex:1;">
          <div style="font-weight:700; color:var(--text-main);">${c.name}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${c.description || ''}</div>
        </div>
        <div style="font-weight:800; color:var(--brand-500);">+ Bs. ${c.price}</div>
      </label>
    `).join('') + `
      <button type="submit" class="btn btn--primary" style="width:100%; margin-top:1rem;">Agregar Seleccionados</button>
    `;

    modal.classList.add('active');
  }

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
        const idxC = allComplementos.findIndex(c => c.id === payload.new.id);
        if (idxC !== -1) allComplementos[idxC] = payload.new;
      })
      .subscribe();
  }
})();