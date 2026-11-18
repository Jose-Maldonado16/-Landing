/* ============================================
   STAFF.JS — Gestión de pedidos con roles
   (Cocina / Cajero) y flujo completo
   ============================================ */
(function() {
  let allOrders = [];
  let staffRole = 'kitchen'; // 'kitchen' o 'cashier'
  let staffProfile = null;

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard (staff o admin)
    const profile = await window.guardPage(['staff', 'admin']);
    if (!profile) return;
    staffProfile = profile;

    // 2. Determinar rol del staff
    // Si es admin, por defecto se le asigna 'cashier' para ver todo el flujo
    // Si es staff, usamos su staff_role o 'kitchen' por defecto
    if (profile.role === 'admin') {
      staffRole = 'admin'; // El admin ve todo
    } else {
      staffRole = profile.staff_role || 'kitchen';
    }

    // 3. Mostrar UI
    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Staff';

    // 4. Ajustar título y badge según el rol
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

    // 5. Aplicar visibilidad de columnas
    applyRoleVisibility();

    // 6. Logout
    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    // 7. Modal
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      document.getElementById('orderDetailModal').classList.remove('active');
    });

    // 8. Cargar pedidos
    await loadOrders();

    // 9. Realtime
    window.supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType !== 'UPDATE' || payload.new.status !== payload.old.status) {
          loadOrders();
        }
      })
      .subscribe();
  });

  // --- VISIBILIDAD DE COLUMNAS POR ROL ---
  function applyRoleVisibility() {
    const columns = {
      pendientePago: document.getElementById('colPendientePago'),
      confirmado: document.getElementById('colConfirmado'),
      preparacion: document.getElementById('colPreparacion'),
      listo: document.getElementById('colListo')
    };

    // Admin ve todo
    if (staffRole === 'admin') {
      Object.values(columns).forEach(c => { if (c) c.style.display = 'block'; });
      return;
    }

    // Cajero: ve pagos pendientes, confirmados (para confirmar pago) y listos (para entregar)
    if (staffRole === 'cashier') {
      if (columns.pendientePago) columns.pendientePago.style.display = 'block';
      if (columns.confirmado) columns.confirmado.style.display = 'block';
      if (columns.listo) columns.listo.style.display = 'block';
    }

    // Cocina: ve confirmados (para empezar a preparar), en preparación y listos
    if (staffRole === 'kitchen') {
      if (columns.confirmado) columns.confirmado.style.display = 'block';
      if (columns.preparacion) columns.preparacion.style.display = 'block';
      if (columns.listo) columns.listo.style.display = 'block';
    }
  }

  // --- CARGAR PEDIDOS SEGÚN EL ROL ---
  async function loadOrders() {
    let statusFilter;
    
    if (staffRole === 'admin') {
      statusFilter = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo'];
    } else if (staffRole === 'cashier') {
      statusFilter = ['pendiente_pago', 'confirmado', 'listo'];
    } else {
      // kitchen
      statusFilter = ['confirmado', 'en_preparacion', 'listo'];
    }

    const { data, error } = await window.supabase
      .from('orders')
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .in('status', statusFilter)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error cargando pedidos:', error);
      return;
    }

    allOrders = data || [];
    renderKanban();
  }

  // --- RENDERIZAR KANBAN ---
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

    // Contadores
    const c1 = document.getElementById('countPendientePago');
    const c2 = document.getElementById('countConfirmados');
    const c3 = document.getElementById('countPreparacion');
    const c4 = document.getElementById('countListo');
    if (c1) c1.textContent = groups.pendiente_pago.length;
    if (c2) c2.textContent = groups.confirmado.length;
    if (c3) c3.textContent = groups.en_preparacion.length;
    if (c4) c4.textContent = groups.listo.length;

    // Renderizar cada grupo
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

  // --- TARJETA DE PEDIDO ---
  function renderOrderCard(o) {
    const clientName = o.profiles?.full_name || 'Cliente';
    const time = new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const deliveryText = o.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';
    
    let actionBtn = '';
    
    // Lógica de botones según el estado y el rol
    if (o.status === 'pendiente_pago') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💰 Confirmar Pago</button>`;
      } else {
        actionBtn = `<span style="font-size:0.75rem;color:#93c5fd;">Esperando pago...</span>`;
      }
    } else if (o.status === 'confirmado') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
      } else if (staffRole === 'cashier' && o.payment_method === 'efectivo') {
        actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💵 Cobrar</button>`;
      } else {
        actionBtn = `<span style="font-size:0.75rem;color:#93c5fd;">Esperando cocina...</span>`;
      }
    } else if (o.status === 'en_preparacion') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-ready" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
      } else {
        actionBtn = `<span style="font-size:0.75rem;color:#fcd34d;">En cocina...</span>`;
      }
    } else if (o.status === 'listo') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'entregado')">📦 Entregar</button>`;
      } else {
        actionBtn = `<span style="font-size:0.75rem;color:#6ee7b7;">Listo para entregar</span>`;
      }
    }

    return `
      <div class="order-card" onclick="window.__viewOrderDetail(${o.id})">
        <div class="order-card-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-client">${clientName}</div>
        <div class="order-details">
          ${deliveryText} · ${o.payment_method.toUpperCase()}
        </div>
        <div class="order-total">Bs. ${o.total}</div>
        <div class="order-hint">👁️ Clic para ver detalle</div>
        <div class="order-actions">
          ${actionBtn}
        </div>
      </div>
    `;
  }

  // --- CAMBIAR ESTADO DEL PEDIDO ---
  window.__changeStatus = async (orderId, newStatus) => {
    const orderIndex = allOrders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      allOrders[orderIndex].status = newStatus;
      if (newStatus === 'entregado') allOrders.splice(orderIndex, 1);
      renderKanban();
    }

    const updateData = { status: newStatus };
    if (newStatus === 'entregado') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await window.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      alert('Error al actualizar: ' + error.message);
      await loadOrders();
    }
  };

  // --- CONFIRMAR PAGO (para cajero) ---
  window.__confirmPayment = async (orderId) => {
    const { error } = await window.supabase
      .from('orders')
      .update({ status: 'confirmado' })
      .eq('id', orderId);

    if (error) {
      alert('Error al confirmar pago: ' + error.message);
    } else {
      alert('✅ Pago confirmado. El pedido pasará a cocina.');
      await loadOrders();
    }
  };

  // --- VER DETALLE DEL PEDIDO ---
  window.__viewOrderDetail = async (orderId) => {
    const modal = document.getElementById('orderDetailModal');
    if (!modal) return;

    document.getElementById('detailOrderTitle').textContent = `Pedido #${orderId}`;
    document.getElementById('detailOrderInfo').innerHTML = '<p>Cargando...</p>';
    document.getElementById('detailOrderItems').innerHTML = '';
    modal.classList.add('active');

    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.profiles?.full_name || 'Cliente';
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
      .select(`
        *,
        products:product_id (name)
      `)
      .eq('order_id', orderId);

    if (error) {
      document.getElementById('detailOrderItems').innerHTML = `<p style="color:red;">Error al cargar items.</p>`;
      return;
    }

    if (!items || items.length === 0) {
      document.getElementById('detailOrderItems').innerHTML = `<p>No hay items registrados.</p>`;
      return;
    }

    let totalCalculado = 0;
    document.getElementById('detailOrderItems').innerHTML = items.map(i => {
      totalCalculado += Number(i.subtotal);
      const productName = i.products?.name || 'Producto';
      return `
        <div style="padding:0.5rem 0; border-bottom:1px solid var(--border-dark);">
          <div style="display:flex; justify-content:space-between;">
            <div><strong>${i.quantity} x ${productName}</strong></div>
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