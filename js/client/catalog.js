/* ============================================
   CATALOG.JS — Carga productos de Supabase
   ============================================ */
import { guardPage, supabase } from '../supabaseClient.js';

let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Proteger la página (solo clientes)
  const profile = await guardPage(['client', 'admin', 'staff']);
  if (!profile) return; // Si guardPage redirige, detenemos la ejecución aquí.

  // 2. Mostrar nombre del usuario
  document.getElementById('userName').textContent = profile.full_name || 'Cliente';
  document.getElementById('greetingName').textContent = (profile.full_name || 'Cliente').split(' ')[0];

  // 3. Botón de cerrar sesión
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/login.html');
  });

  // 4. Cargar productos
  await loadProducts();

  // 5. Configurar filtros
  initFilters();
});

// ... (el resto de tu código de loadProducts y renderProducts se queda igual)

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error cargando productos:', error);
    grid.innerHTML = `<p class="loading-text" style="color: red;">Error al cargar el menú. Intenta recargar la página.</p>`;
    return;
  }

  allProducts = data || [];
  
  if (allProducts.length === 0) {
    grid.innerHTML = `<p class="loading-text">Aún no hay productos registrados.</p>`;
    return;
  }

  renderProducts(allProducts);
}

function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  
  grid.innerHTML = products.map(product => `
    <article class="dash-product-card">
      <img src="${product.image_url || 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80'}" 
           alt="${product.name}" 
           class="dash-product-img" 
           loading="lazy" />
      <div class="dash-product-body">
        <h3 class="dash-product-title">${product.name}</h3>
        <p class="dash-product-desc">${product.description || 'Delicioso producto artesanal.'}</p>
        <div class="dash-product-footer">
          <span class="dash-product-price">Bs. ${product.price}</span>
          <button class="dash-product-btn btn-add-cart" 
                  data-id="${product.id}"
                  ${!product.is_available || product.stock <= 0 ? 'disabled' : ''}>
            ${!product.is_available || product.stock <= 0 ? 'Agotado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </article>
  `).join('');

  // Conectar botones de agregar al carrito
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.id);
      const product = allProducts.find(p => p.id === productId);
      if (product) {
        // Emitir evento para que cart.js lo escuche
        window.dispatchEvent(new CustomEvent('add-to-cart', { detail: product }));
      }
    });
  });
}

function initFilters() {
  const filters = document.getElementById('categoryFilters');
  
  filters.addEventListener('click', (e) => {
    if (!e.target.matches('.filter-btn')) return;
    
    // Actualizar UI
    filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
    e.target.classList.add('filter-btn--active');
    
    // Filtrar
    const filter = e.target.dataset.filter;
    const filtered = filter === 'all' 
      ? allProducts 
      : allProducts.filter(p => p.category === filter);
      
    renderProducts(filtered);
  });
}