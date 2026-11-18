/* ============================================
   STAFF.JS — Panel mejorado con KPIs y flujo completo
   ============================================ */
(function() {
  let allOrders = [];
  let staffRole = 'kitchen';
  let staffProfile = null;

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['staff', 'admin']);
    if (!profile) return;
    staffProfile = profile;

    if (profile.role === 'admin') {
      staffRole = 'admin';
    } else {
      staffRole = profile.staff_role || 'kitchen';
    }

    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Staff';

    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const roleBadge = document.getElementById('roleBadge');

    if (staffRole === 'admin') {
      pageTitle.textContent = 'Panel Completo (Admin)';
      pageSubtitle.textContent = 'Vista completa de pedidos y preparación.';
      roleBadge.textContent = 'ADMIN';
      roleBadge.style.background = 'var(--brand-500)';
      roleBadge.style.color = '#fff';
    } else if (staffRole === 'cashier') {
      pageTitle.textContent = 'Panel de Caja y Despacho';
      pageSubtitle.textContent = 'Confirma pagos y entrega los pedidos listos.';
      roleBadge.textContent = 'CAJERO';
      roleBadge.style.background = '#3b82f6';
      roleBadge.style.color = '#fff';
    } else {
      pageTitle.textContent = 'Panel de Cocina';
      pageSubtitle.textContent = 'Prepara los pedidos confirmados.';
      roleBadge.textContent = 'COCINA';
      roleBadge.style.background = 'var(--accent-500)';
      roleBadge.style.color = '#000';
    }

    applyRoleVisibility();

    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      document.getElementById('orderDetailModal').classList.remove('active');
    });

    await loadOrders();

    window.supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType !== 'UPDATE' || payload.new.status !== payload.old.status) {
          loadOrders();
        }
      })
      .subscribe();
  });

  function applyRoleVisibility() {
    const cols = {
      pendientePago: document.getElementById('colPendientePago'),
      confirmado: document.getElementById('colConfirmado'),
      preparacion: document.getElementById('colPreparacion'),
      listo: document.getElementById('colListo')
    };

    // La columna de "Listos" SIEMPRE visible para todos los roles
    if (cols.listo) cols.listo.style.display = 'block';

    if (staffRole === 'admin') {
      Object.values(cols).forEach(c => { if (c) c.style.display = 'block'; });
      return;
    }
    if (staffRole === 'cashier') {
      if (cols.pendientePago) cols.pendientePago.style.display = 'block';
      if (cols.confirmado) cols.confirmado.style.display = 'block';
    }
    if (staffRole === 'kitchen') {
      if (cols.confirmado) cols.confirmado.style.display = 'block';
      if (cols.preparacion) cols.preparacion.style.display = 'block';
    }
  }

  async function loadOrders() {
    let statusFilter;
    if (staffRole === 'admin') statusFilter = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo'];
    else if (staffRole === 'cashier') statusFilter = ['pendiente_pago', 'confirmado', 'listo'];
    else statusFilter = ['confirmado', 'en_preparacion', 'listo'];

    const { data, error } = await window.supabase
      .rpc('get_orders_with_client_name', { p_statuses: statusFilter });

    if (error) {
      console.error('Error:', error);
      const { data: fallback } = await window.supabase
        .from('orders')
        .select('*')
        .in('status', statusFilter)
        .order('created_at', { ascending: true });
      allOrders = (fallback || []).map(o => ({ ...o, client_name: 'Cliente' }));
    } else {
      allOrders = data || [];
    }

    renderKanban();
    updateKPIs();
  }

  function updateKPIs() {
    const pendientes = allOrders.filter(o => o.status === 'pendiente_pago');
    const listos = allOrders.filter(o => o.status === 'listo');
    
    document.getElementById('kpiPendientes').textContent = pendientes.length;
    document.getElementById('kpiListos').textContent = listos.length;

    // Total del día (solo pedidos con estado != cancelado)
    const today = new Date().toISOString().split('T')[0];
    const ordersToday = allOrders.filter(o => o.created_at && o.created_at.startsWith(today));
    const totalDia = ordersToday.reduce((sum, o) => sum + Number(o.total), 0);
    document.getElementById('kpiTotalDia').textContent = `Bs. ${totalDia.toFixed(2)}`;
  }

  function renderKanban() {
    const containers = {
      pendiente_pago: document.getElementById('col-pendiente_pago'),
      confirmado: document.getElementById('col-confirmado'),
      en_preparacion: document.getElementById('col-en_preparacion'),
      listo: document.getElementById('col-listo')
    };
    Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

    const groups = {
      pendiente_pago: allOrders.filter(o => o.status === 'pendiente_pago'),
      confirmado: allOrders.filter(o => o.status === 'confirmado'),
      en_preparacion: allOrders.filter(o => o.status === 'en_preparacion'),
      listo: allOrders.filter(o => o.status === 'listo'),
    };

    document.getElementById('countPendientePago').textContent = groups.pendiente_pago.length;
    document.getElementById('countConfirmados').textContent = groups.confirmado.length;
    document.getElementById('countPreparacion').textContent = groups.en_preparacion.length;
    document.getElementById('countListo').textContent = groups.listo.length;

    Object.keys(groups).forEach(status => {
      const container = containers[status];
      if (!container) return;
      if (groups[status].length === 0) {
        container.innerHTML = `<p class="empty-col">No hay pedidos aquí.</p>`;
        return;
      }
      container.innerHTML = groups[status].map(o => renderOrderCard(o)).join('');
    });
  }

  function renderOrderCard(o) {
    const clientName = o.client_name || 'Cliente';
    const time = new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const deliveryText = o.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';
    
    let actionBtn = '';
    
    if (o.status === 'pendiente_pago') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💰 Confirmar Pago</button>`;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#93c5fd;">⏳ Esperando pago...</span>`;
      }
    } else if (o.status === 'confirmado') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
      } else if (staffRole === 'cashier' && o.payment_method === 'efectivo') {
        actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💵 Cobrar</button>`;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#93c5fd;">⏳ Esperando cocina...</span>`;
      }
    } else if (o.status === 'en_preparacion') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-ready" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#fcd34d;">⏳ En cocina...</span>`;
      }
    } else if (o.status === 'listo') {
      // Cualquier staff puede entregar
      actionBtn = `<button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'entregado')">📦 Marcar Entregado</button>`;
    }

    return `
      <div class="order-card order-card--${o.status}" onclick="window.__viewOrderDetail(${o.id})">
        <div class="order-card-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-client">${clientName}</div>
        <div class="order-details">${deliveryText} · ${o.payment_method.toUpperCase()}</div>
        <div class="order-total">Bs. ${o.total}</div>
        <div class="order-hint">👁️ Clic para ver detalle</div>
        <div class="order-actions">${actionBtn}</div>
      </div>
    `;
  }

  window.__changeStatus = async (orderId, newStatus) => {
    const idx = allOrders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      allOrders[idx].status = newStatus;
      if (newStatus === 'entregado') allOrders.splice(idx, 1);
      renderKanban();
      updateKPIs();
    }

    const updateData = { status: newStatus };
    if (newStatus === 'entregado') updateData.delivered_at = new Date().toISOString();

    const { error } = await window.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      alert('Error: ' + error.message);
      await loadOrders();
    } else if (newStatus === 'entregado') {
      alert(`✅ Pedido #${orderId} entregado correctamente.`);
    }
  };

  window.__confirmPayment = async (orderId) => {
    const { error } = await window.supabase
      .from('orders')
      .update({ status: 'confirmado' })
      .eq('id', orderId);
    if (error) alert('Error: ' + error.message);
    else { alert('✅ Pago confirmado. El pedido pasará a cocina.'); await loadOrders(); }
  };

  window.__viewOrderDetail = async (orderId) => {
    const modal = document.getElementById('orderDetailModal');
    if (!modal) return;

    document.getElementById('detailOrderTitle').textContent = `Pedido #${orderId}`;
    document.getElementById('detailOrderInfo').innerHTML = '<p>Cargando...</p>';
    document.getElementById('detailOrderItems').innerHTML = '';
    modal.classList.add('active');

    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.client_name || 'Cliente';
    const deliveryText = order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';

    document.getElementById('detailOrderInfo').innerHTML = `
      <p style="margin-bottom:0.25rem;"><strong>Cliente:</strong> ${clientName}</p>
      <p style="margin-bottom:0.25rem;"><strong>Entrega:</strong> ${deliveryText} ${order.delivery_address ? `- ${order.delivery_address}` : ''}</p>
      <p style="margin-bottom:0.25rem;"><strong>Pago:</strong> ${order.payment_method.toUpperCase()}</p>
      <p style="margin-bottom:0.25rem;"><strong>Hora programada:</strong> ${new Date(order.scheduled_time).toLocaleString()}</p>
      <p><strong>Estado:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
    `;

    const { data: items, error } = await window.supabase
      .from('order_items')
      .select(`*, products:product_id (name)`)
      .eq('order_id', orderId);

    if (error || !items || items.length === 0) {
      document.getElementById('detailOrderItems').innerHTML = `<p>No hay items registrados.</p>`;
      return;
    }

    let totalCalculado = 0;
    document.getElementById('detailOrderItems').innerHTML = items.map(i => {
      totalCalculado += Number(i.subtotal);
      const name = i.products?.name || 'Producto';
      return `
        <div style="padding:0.5rem 0; border-bottom:1px solid var(--border-dark);">
          <div style="display:flex; justify-content:space-between;">
            <strong>${i.quantity} x ${name}</strong>
            <span>Bs. ${i.subtotal}</span>
          </div>
          ${i.custom_notes ? `<div style="font-size:0.8rem; color:var(--accent-500); margin-top:0.25rem;">📝 ${i.custom_notes}</div>` : ''}
        </div>
      `;
    }).join('') + `
      <div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:0.5rem; border-top:2px solid var(--border-dark); font-weight:800; font-size:1.1rem;">
        <span>Total</span>
        <span style="color:var(--brand-500);">Bs. ${totalCalculado.toFixed(2)}</span>
      </div>
    `;
  };
})();