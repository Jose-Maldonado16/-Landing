/* ============================================
   ADMIN.JS — Dashboard, Productos, Pedidos, Usuarios
   + Visualización de evidencia de entrega
   ============================================ */
(function() {
  let allProducts = [];
  let allOrders = [];
  let allUsers = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['admin']);
    if (!profile) return;

    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Admin';

    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    initTabs();
    await loadDashboardMetrics();
    await loadProducts();
    await loadOrders();
    await loadUsers();
    initProductModal();
    initOrderDetailModal();
    initUserModal();
    initUserFilters();
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

  // ============================================
  // DASHBOARD METRICS
  // ============================================
  async function loadDashboardMetrics() {
    const { data: orders } = await window.supabase.from('orders').select('total, created_at, status');
    if (orders) {
      const validOrders = orders.filter(o => o.status !== 'cancelado');
      const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
      document.getElementById('metricSales').textContent = `Bs. ${totalSales.toFixed(2)}`;
      const today = new Date().toISOString().split('T')[0];
      const ordersToday = orders.filter(o => o.created_at.startsWith(today)).length;
      document.getElementById('metricOrders').textContent = ordersToday;
    }

    const { data: products } = await window.supabase.from('products').select('id, is_available');
    if (products) {
      document.getElementById('metricProducts').textContent = products.filter(p => p.is_available).length;
    }

    const { data: recent } = await window.supabase
      .from('orders')
      .select(`id, total, status, created_at, profiles:user_id (full_name)`)
      .order('created_at', { ascending: false })
      .limit(5);
      
    const tbody = document.getElementById('recentOrdersTable');
    if (recent && recent.length > 0) {
      tbody.innerHTML = recent.map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${o.profiles?.full_name || 'Cliente'}</td>
          <td>Bs. ${o.total}</td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay pedidos recientes.</td></tr>`;
    }
  }

  // ============================================
  // PRODUCTOS
  // ============================================
  async function loadProducts() {
    const { data } = await window.supabase.from('products').select('*').order('id');
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

  function initProductModal() {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    
    document.getElementById('btnAddProduct').addEventListener('click', () => {
      form.reset();
      document.getElementById('prodId').value = '';
      document.getElementById('modalTitle').textContent = 'Nuevo Producto';
      modal.classList.add('active');
    });

    document.getElementById('btnCancelProduct').addEventListener('click', () => modal.classList.remove('active'));

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

      if (error) alert('Error: ' + error.message);
      else {
        modal.classList.remove('active');
        await loadProducts();
        await loadDashboardMetrics();
      }
    });
  }

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

  // ============================================
  // PEDIDOS
  // ============================================
  async function loadOrders() {
    const { data } = await window.supabase
      .from('orders')
      .select(`*, profiles:user_id (full_name)`)
      .order('created_at', { ascending: false });
      
    const tbody = document.getElementById('allOrdersTable');
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No hay pedidos.</td></tr>`;
      return;
    }
    allOrders = data;

    tbody.innerHTML = data.map(o => {
      const canCancel = o.status !== 'entregado' && o.status !== 'cancelado';
      return `
        <tr>
          <td>#${o.id}</td>
          <td>${o.profiles?.full_name || 'Cliente'}</td>
          <td style="text-transform:capitalize;">${o.delivery_type}</td>
          <td style="text-transform:capitalize;">${o.payment_method}</td>
          <td>Bs. ${o.total}</td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td><button class="action-btn btn-view" onclick="window.__viewOrderDetail(${o.id})">Ver</button></td>
          <td>${canCancel ? `<button class="action-btn btn-delete" onclick="window.__cancelOrder(${o.id})">Cancelar</button>` : '—'}</td>
        </tr>
      `;
    }).join('');
  }

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
    modal.classList.add('active');

    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.profiles?.full_name || 'Cliente';
    const deliveryText = order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';

    // Comprobante
    let receiptHtml = '';
    if (order.receipt_url) {
      receiptHtml = `
        <div style="margin-top:1rem; padding:1rem; background:#0b1120; border-radius:0.5rem; border:1px solid var(--border-dark);">
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem; font-weight:700;">📎 Comprobante de pago:</p>
          <a href="${order.receipt_url}" target="_blank" style="display:block;">
            <img src="${order.receipt_url}" alt="Comprobante" style="max-width:100%; max-height:300px; border-radius:0.5rem; border:1px solid var(--border-dark); cursor:pointer;" />
          </a>
        </div>
      `;
    }

    // Evidencia de entrega
    let evidenceHtml = '';
    try {
      const { data: evidence } = await window.supabase
        .rpc('get_delivery_evidence', { p_order_id: orderId });

      if (evidence && evidence.length > 0) {
        const ev = evidence[0];
        evidenceHtml = `
          <div style="margin-top:1.5rem; padding:1rem; background:rgba(16,185,129,0.1); border-radius:0.5rem; border:1px solid rgba(16,185,129,0.3);">
            <p style="font-size:0.95rem; color:#6ee7b7; font-weight:700; margin-bottom:0.75rem;">✅ Evidencia de Entrega</p>
            <p style="margin-bottom:0.25rem; font-size:0.85rem;"><strong>Recibido por:</strong> ${ev.receiver_name}</p>
            ${ev.receiver_id_number ? `<p style="margin-bottom:0.25rem; font-size:0.85rem;"><strong>CI:</strong> ${ev.receiver_id_number}</p>` : ''}
            <p style="margin-bottom:0.25rem; font-size:0.85rem;"><strong>Entregado por:</strong> ${ev.delivered_by_name || 'Repartidor'}</p>
            <p style="margin-bottom:0.5rem; font-size:0.85rem;"><strong>Fecha:</strong> ${new Date(ev.delivered_at).toLocaleString()}</p>
            ${ev.notes ? `<p style="margin-bottom:0.5rem; font-size:0.85rem;"><strong>Notas:</strong> ${ev.notes}</p>` : ''}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.75rem;">
              <div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.25rem;">Firma:</p>
                <img src="${ev.signature_url}" alt="Firma" style="width:100%; background:#fff; border-radius:0.5rem; border:1px solid var(--border-dark); cursor:pointer;" onclick="window.open('${ev.signature_url}', '_blank')" />
              </div>
              ${ev.photo_url ? `
                <div>
                  <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.25rem;">Foto:</p>
                  <img src="${ev.photo_url}" alt="Foto" style="width:100%; border-radius:0.5rem; border:1px solid var(--border-dark); cursor:pointer;" onclick="window.open('${ev.photo_url}', '_blank')" />
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error cargando evidencia:', err);
    }

    document.getElementById('detailOrderInfo').innerHTML = `
      <p style="margin-bottom:0.25rem;"><strong>Cliente:</strong> ${clientName}</p>
      <p style="margin-bottom:0.25rem;"><strong>Entrega:</strong> ${deliveryText} ${order.delivery_address ? `- ${order.delivery_address}` : ''}</p>
      <p style="margin-bottom:0.25rem;"><strong>Pago:</strong> ${order.payment_method.toUpperCase()}</p>
      <p style="margin-bottom:0.25rem;"><strong>Hora programada:</strong> ${new Date(order.scheduled_time).toLocaleString()}</p>
      <p><strong>Estado:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
      ${receiptHtml}
      ${evidenceHtml}
    `;

    const { data: items } = await window.supabase
      .from('order_items')
      .select(`*, products:product_id (name)`)
      .eq('order_id', orderId);

    if (!items || items.length === 0) {
      document.getElementById('detailOrderItems').innerHTML = `<p>No hay items registrados.</p>`;
      return;
    }

    let totalCalculado = 0;
    document.getElementById('detailOrderItems').innerHTML = items.map(i => {
      totalCalculado += Number(i.subtotal);
      const name = i.products?.name || 'Producto';
      const isComplemento = i.custom_notes?.startsWith('Complemento para');
      return `
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-dark); ${isComplemento ? 'margin-left:1.5rem; border-left:2px solid var(--accent-500); padding-left:0.75rem;' : ''}">
          <div>
            <strong>${isComplemento ? '➕ ' : ''}${name}</strong>
            <div style="font-size:0.85rem; color:var(--text-muted);">${i.quantity} x Bs. ${i.unit_price}</div>
          </div>
          <div style="font-weight:700;">Bs. ${i.subtotal}</div>
        </div>
      `;
    }).join('') + `
      <div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:0.5rem; border-top:2px solid var(--border-dark); font-weight:800; font-size:1.1rem;">
        <span>Total</span>
        <span style="color:var(--brand-500);">Bs. ${totalCalculado.toFixed(2)}</span>
      </div>
    `;
  };

  window.__cancelOrder = async (orderId) => {
    if (!confirm(`¿Cancelar el pedido #${orderId}? Se devolverá el stock si ya estaba pagado.`)) return;
    
    const { error } = await window.supabase.rpc('cancel_order_and_restore_stock', { p_order_id: orderId });
    
    if (error) alert('Error: ' + error.message);
    else {
      alert('✅ Pedido cancelado y stock restaurado.');
      await loadOrders();
      await loadDashboardMetrics();
    }
  };

  // ============================================
  // USUARIOS
  // ============================================
  async function loadUsers() {
    const { data, error } = await window.supabase.rpc('get_all_users_with_email');
    
    if (error) {
      console.error('Error cargando usuarios:', error);
      document.getElementById('usersTable').innerHTML = `<tr><td colspan="7" style="text-align:center;color:red;">Error al cargar usuarios: ${error.message}</td></tr>`;
      return;
    }

    allUsers = data || [];
    renderUsers(allUsers);
  }

  function renderUsers(users) {
    const tbody = document.getElementById('usersTable');
    
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay usuarios.</td></tr>`;
      return;
    }

    const roleLabels = {
      admin: '👑 Admin',
      staff: '👨‍🍳 Staff',
      client: '🛍️ Cliente'
    };

    const staffRoleLabels = {
      kitchen: '🧑‍🍳 Cocina',
      cashier: '💰 Cajero',
      delivery: '🛵 Repartidor'
    };

    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="font-weight:600;">${u.full_name || '—'}</td>
        <td style="font-size:0.85rem;">${u.email || '—'}</td>
        <td><span class="status-badge status-${u.role}">${roleLabels[u.role] || u.role}</span></td>
        <td>${u.staff_role ? (staffRoleLabels[u.staff_role] || u.staff_role) : '—'}</td>
        <td>${u.phone || '—'}</td>
        <td style="font-size:0.85rem;">${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <button class="action-btn btn-edit" onclick="window.__editUser('${u.id}')">Editar</button>
        </td>
      </tr>
    `).join('');
  }

  function initUserModal() {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    
    document.getElementById('btnCancelUser').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('userRole').addEventListener('change', toggleStaffRoleGroup);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('userId').value;
      const role = document.getElementById('userRole').value;
      const staffRole = role === 'staff' ? document.getElementById('userStaffRole').value : null;

      const updateData = {
        full_name: document.getElementById('userFullName').value.trim(),
        phone: document.getElementById('userPhone').value.trim() || null,
        role: role,
        staff_role: staffRole || null
      };

      const { error } = await window.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) alert('Error al actualizar: ' + error.message);
      else {
        alert('✅ Usuario actualizado correctamente.');
        modal.classList.remove('active');
        await loadUsers();
      }
    });
  }

  function toggleStaffRoleGroup() {
    const role = document.getElementById('userRole').value;
    const group = document.getElementById('staffRoleGroup');
    if (role === 'staff') {
      group.style.display = 'block';
    } else {
      group.style.display = 'none';
      document.getElementById('userStaffRole').value = '';
    }
  }

  window.__editUser = (userId) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userModalTitle').textContent = `Editar: ${user.full_name || user.email}`;
    document.getElementById('userId').value = user.id;
    document.getElementById('userFullName').value = user.full_name || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userRole').value = user.role || 'client';
    document.getElementById('userStaffRole').value = user.staff_role || '';
    
    toggleStaffRoleGroup();
    document.getElementById('userModal').classList.add('active');
  };

  function initUserFilters() {
    const filters = document.querySelectorAll('[data-user-filter]');
    filters.forEach(btn => {
      btn.addEventListener('click', () => {
        filters.forEach(b => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        const f = btn.dataset.userFilter;
        const filtered = f === 'all' ? allUsers : allUsers.filter(u => u.role === f);
        renderUsers(filtered);
      });
    });
  }
})();