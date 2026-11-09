/* ============================================
   ADMIN.JS — Lógica del Panel de Administración
   ============================================ */
(function() {
  let allProducts = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard (solo admin)
    const profile = await window.guardPage(['admin']);
    if (!profile) return;

    // 2. Mostrar UI
    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Admin';

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    // 4. Configurar Tabs
    initTabs();

    // 5. Cargar datos
    await loadDashboardMetrics();
    await loadProducts();
    await loadOrders();

    // 6. Configurar modal de productos
    initProductModal();
  });

  // --- TABS ---
  function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  // --- DASHBOARD METRICS ---
  async function loadDashboardMetrics() {
    // Ventas totales
    const { data: orders } = await window.supabase.from('orders').select('total, created_at');
    if (orders) {
      const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
      document.getElementById('metricSales').textContent = `Bs. ${totalSales.toFixed(2)}`;
      
      const today = new Date().toISOString().split('T')[0];
      const ordersToday = orders.filter(o => o.created_at.startsWith(today)).length;
      document.getElementById('metricOrders').textContent = ordersToday;
    }

    // Productos activos
    const { data: products } = await window.supabase.from('products').select('id, is_available');
    if (products) {
      const active = products.filter(p => p.is_available).length;
      document.getElementById('metricProducts').textContent = active;
    }

    // Últimos 5 pedidos
    const { data: recent } = await window.supabase
      .from('orders')
      .select('id, total, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(5);
      
    const tbody = document.getElementById('recentOrdersTable');
    if (recent && recent.length > 0) {
      tbody.innerHTML = recent.map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${o.user_id.substring(0, 8)}...</td>
          <td>Bs. ${o.total}</td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay pedidos recientes.</td></tr>`;
    }
  }

  // --- PRODUCTOS ---
  async function loadProducts() {
    const { data, error } = await window.supabase.from('products').select('*').order('id');
    if (error) {
      console.error(error);
      return;
    }
    allProducts = data || [];
    
    const tbody = document.getElementById('productsTable');
    if (allProducts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay productos.</td></tr>`;
      return;
    }

    tbody.innerHTML = allProducts.map(p => `
      <tr>
        <td><img src="${p.image_url || 'https://via.placeholder.com/40'}" alt="${p.name}"></td>
        <td style="font-weight:600;">${p.name}</td>
        <td style="text-transform:capitalize;">${p.category}</td>
        <td>Bs. ${p.price}</td>
        <td>${p.stock}</td>
        <td>
          <button class="action-btn btn-edit" onclick="window.__editProduct(${p.id})">Editar</button>
          <button class="action-btn btn-delete" onclick="window.__deleteProduct(${p.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  // --- PEDIDOS ---
  async function loadOrders() {
    const { data, error } = await window.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
      
    const tbody = document.getElementById('allOrdersTable');
    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay pedidos.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.user_id.substring(0, 8)}...</td>
        <td style="text-transform:capitalize;">${o.delivery_type}</td>
        <td style="text-transform:capitalize;">${o.payment_method}</td>
        <td>Bs. ${o.total}</td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }

  // --- MODAL PRODUCTOS ---
  function initProductModal() {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    
    document.getElementById('btnAddProduct').addEventListener('click', () => {
      form.reset();
      document.getElementById('prodId').value = '';
      document.getElementById('modalTitle').textContent = 'Nuevo Producto';
      modal.classList.add('active');
    });

    document.getElementById('btnCancelProduct').addEventListener('click', () => {
      modal.classList.remove('active');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('prodId').value;
      
      const productData = {
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        category: document.getElementById('prodCategory').value,
        stock: parseInt(document.getElementById('prodStock').value),
        image_url: document.getElementById('prodImage').value || null,
        is_available: parseInt(document.getElementById('prodStock').value) > 0
      };

      let error;
      if (id) {
        // Actualizar
        const res = await window.supabase.from('products').update(productData).eq('id', id);
        error = res.error;
      } else {
        // Crear
        const res = await window.supabase.from('products').insert([productData]);
        error = res.error;
      }

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modal.classList.remove('active');
        await loadProducts();
        await loadDashboardMetrics();
      }
    });
  }

  // --- ACCIONES GLOBALES (para los onclick inline) ---
  window.__editProduct = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    if (!p) return;
    
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodDesc').value = p.description || '';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodImage').value = p.image_url || '';
    
    document.getElementById('modalTitle').textContent = 'Editar Producto';
    document.getElementById('productModal').classList.add('active');
  };

  window.__deleteProduct = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    const { error } = await window.supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      await loadProducts();
      await loadDashboardMetrics();
    }
  };
})();