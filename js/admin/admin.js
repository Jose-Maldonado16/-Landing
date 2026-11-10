/* ============================================
   ADMIN.JS — Lógica del Panel de Administración
   ============================================ */
(function() {
  let allProducts = [];
  let allOrders = [];

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

    // 6. Configurar modales
    initProductModal();
    initOrderDetailModal();
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
    const { data: orders } = await window.supabase.from('orders').select('total, created_at');
    if (orders) {
      const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
      document.getElementById('metricSales').textContent = `Bs. ${totalSales.toFixed(2)}`;
      const today = new Date().toISOString().split('T')[0];
      const ordersToday = orders.filter(o => o.created_at.startsWith(today)).length;
      document.getElementById('metricOrders').textContent = ordersToday;
    }

    const { data: products } = await window.supabase.from('products').select('id, is_available');
    if (products) {
      const active = products.filter(p => p.is_available).length;
      document.getElementById('metricProducts').textContent = active;
    }

    // Últimos 5 pedidos
    const { data: recent } = await window.supabase
      .from('orders')
      .select(`id, total, status, created_at, profiles:user_id (full_name)`)
      .order('created_at', { ascending: false })
      .limit(5);
      
    const tbody = document.getElementById('recentOrdersTable');
    if (recent && recent.length > 0) {
      tbody.innerHTML = recent.map(o => {
        const clientName = o.profiles?.full_name || 'Cliente';
        return `
          <tr>
            <td>#${o.id}</td>
            <td>${clientName}</td>
            <td>Bs. ${o.total}</td>
            <td><span class="status-badge status-${o.status}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay pedidos recientes.</td></tr>`;
    }
  }

  // --- PRODUCTOS ---
  async function loadProducts() {
    const { data, error } = await window.supabase.from('products').select('*').order('id');
    if (error) return;
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
      .select(`*, profiles:user_id (full_name)`)
      .order('created_at', { ascending: false });
      
    const tbody = document.getElementById('allOrdersTable');
    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No hay pedidos.</td></tr>`;
      return;
    }
    allOrders = data;

    tbody.innerHTML = data.map(o => {
      const clientName = o.profiles?.full_name || 'Cliente';
      return `
        <tr>
          <td>#${o.id}</td>
          <td>${clientName}</td>
          <td style="text-transform:capitalize;">${o.delivery_type}</td>
          <td style="text-transform:capitalize;">${o.payment_method}</td>
          <td>Bs. ${o.total}</td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td><button class="action-btn btn-edit" onclick="window.__viewOrderDetail(${o.id})">Ver</button></td>
        </tr>
      `;
    }).join('');
  }

  // --- MODAL DE PRODUCTOS ---
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
        const res = await window.supabase.from('products').update(productData).eq('id', id);
        error = res.error;
      } else {
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

  // --- MODAL DE DETALLES DEL PEDIDO ---
  function initOrderDetailModal() {
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      document.getElementById('orderDetailModal').classList.remove('active');
    });
  }

  window.__viewOrderDetail = async (orderId) => {
    const modal = document.getElementById('orderDetailModal');
    document.getElementById('detailOrderTitle').textContent = `Pedido #${orderId}`;
    document.getElementById('detailOrderInfo').innerHTML = '<p>Cargando...</p>';
    document.getElementById('detailOrderItems').innerHTML = '';
    document.getElementById('detailOrderNotes').innerHTML = '';
    modal.classList.add('active');

    // 1. Obtener cabecera del pedido
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.profiles?.full_name || 'Cliente';
    const deliveryText = order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';
    const paymentText = order.payment_method.toUpperCase();

    document.getElementById('detailOrderInfo').innerHTML = `
      <p style="margin-bottom:0.25rem;"><strong>Cliente:</strong> ${clientName}</p>
      <p style="margin-bottom:0.25rem;"><strong>Entrega:</strong> ${deliveryText} ${order.delivery_address ? `- ${order.delivery_address}` : ''}</p>
      <p style="margin-bottom:0.25rem;"><strong>Pago:</strong> ${paymentText}</p>
      <p style="margin-bottom:0.25rem;"><strong>Fecha programada:</strong> ${new Date(order.scheduled_time).toLocaleString()}</p>
      <p><strong>Estado:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
    `;

    // 2. Obtener los items del pedido
    const { data: items, error } = await window.supabase
      .from('order_items')
      .select(`*, products:product_id (name)`)
      .eq('order_id', orderId);

    if (error) {
      document.getElementById('detailOrderItems').innerHTML = `<p style="color:red;">Error al cargar items.</p>`;
      return;
    }

    if (!items || items.length === 0) {
      document.getElementById('detailOrderItems').innerHTML = `<p>No hay items registrados.</p>`;
    } else {
      let totalCalculado = 0;
      document.getElementById('detailOrderItems').innerHTML = items.map(i => {
        totalCalculado += Number(i.subtotal);
        const productName = i.products?.name || 'Producto';
        return `
          <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-dark);">
            <div>
              <strong>${productName}</strong>
              <div style="font-size:0.85rem; color:var(--text-muted);">${i.quantity} x Bs. ${i.unit_price}</div>
            </div>
            <div style="font-weight:700;">Bs. ${i.subtotal}</div>
          </div>
          ${i.custom_notes ? `<div style="font-size:0.8rem; color:var(--accent-500); margin-top:0.25rem;">📝 ${i.custom_notes}</div>` : ''}
        `;
      }).join('') + `
        <div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:0.5rem; border-top:2px solid var(--border-dark); font-weight:800; font-size:1.1rem;">
          <span>Total</span>
          <span style="color:var(--brand-500);">Bs. ${totalCalculado.toFixed(2)}</span>
        </div>
      `;
    }
  };

  // --- ACCIONES DE PRODUCTOS ---
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
    if (!confirm('¿Eliminar este producto?')) return;
    const { error } = await window.supabase.from('products').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else { await loadProducts(); await loadDashboardMetrics(); }
  };
})();