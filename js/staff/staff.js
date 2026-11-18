/* ============================================
   STAFF.JS — Separación de roles + cancelación
   de pedidos pendientes con devolución de stock
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

    // Mostrar UI
    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Staff';

    // Configurar UI según rol
    configureRoleUI();
    applyRoleVisibility();

    // Eventos
    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      document.getElementById('orderDetailModal').classList.remove('active');
    });

    // Cargar datos
    await loadOrders();

    // Realtime
    window.supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType !== 'UPDATE' || payload.new.status !== payload.old.status) {
          loadOrders();
        }
      })
      .subscribe();
  });

  // --- CONFIGURAR TÍTULOS, BADGE Y KPIs SEGÚN ROL ---
  function configureRoleUI() {
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const roleBadge = document.getElementById('roleBadge');
    const kpiGrid = document.getElementById('kpiGrid');

    if (staffRole === 'admin') {
      pageTitle.textContent = 'Panel de Administración';
      pageSubtitle.textContent = 'Vista completa de todos los pedidos.';
      roleBadge.textContent = 'ADMIN';
      roleBadge.style.background = 'var(--brand-500)';
      roleBadge.style.color = '#fff';
      kpiGrid.innerHTML = `
        <div class="kpi-card kpi-card--blue"><div class="kpi-label">Por Cobrar</div><div class="kpi-value" id="kpiPendientes">0</div></div>
        <div class="kpi-card kpi-card--yellow"><div class="kpi-label">En Cocina</div><div class="kpi-value" id="kpiPreparacion">0</div></div>
        <div class="kpi-card kpi-card--green"><div class="kpi-label">Listos</div><div class="kpi-value" id="kpiListos">0</div></div>
      `;
    } else if (staffRole === 'cashier') {
      pageTitle.textContent = 'Panel de Caja y Despacho';
      pageSubtitle.textContent = 'Confirma pagos y entrega los pedidos listos.';
      roleBadge.textContent = 'CAJERO';
      roleBadge.style.background = '#3b82f6';
      roleBadge.style.color = '#fff';
      kpiGrid.innerHTML = `
        <div class="kpi-card kpi-card--blue"><div class="kpi-label">Por Cobrar</div><div class="kpi-value" id="kpiPendientes">0</div></div>
        <div class="kpi-card kpi-card--green"><div class="kpi-label">Listos para Entregar</div><div class="kpi-value" id="kpiListos">0</div></div>
      `;
    } else {
      pageTitle.textContent = 'Panel de Cocina';
      pageSubtitle.textContent = 'Prepara los pedidos confirmados.';
      roleBadge.textContent = 'COCINA';
      roleBadge.style.background = 'var(--accent-500)';
      roleBadge.style.color = '#000';
      kpiGrid.innerHTML = `
        <div class="kpi-card kpi-card--yellow"><div class="kpi-label">Por Preparar</div><div class="kpi-value" id="kpiPreparacion">0</div></div>
        <div class="kpi-card kpi-card--green"><div class="kpi-label">Listos (en cocina)</div><div class="kpi-value" id="kpiListos">0</div></div>
      `;
    }
  }

  // --- VISIBILIDAD DE COLUMNAS SEGÚN ROL ---
  function applyRoleVisibility() {
    const cols = {
      pendientePago: document.getElementById('colPendientePago'),
      confirmado: document.getElementById('colConfirmado'),
      preparacion: document.getElementById('colPreparacion'),
      listo: document.getElementById('colListo')
    };

    if (staffRole === 'admin') {
      Object.values(cols).forEach(c => { if (c) c.style.display = 'block'; });
      return;
    }
    if (staffRole === 'cashier') {
      if (cols.pendientePago) cols.pendientePago.style.display = 'block';
      if (cols.confirmado) cols.confirmado.style.display = 'block';
      if (cols.listo) cols.listo.style.display = 'block';
      const title = document.getElementById('titleConfirmado');
      if (title) title.textContent = '💵 Cobrar en Efectivo';
    }
    if (staffRole === 'kitchen') {
      if (cols.confirmado) cols.confirmado.style.display = 'block';
      if (cols.preparacion) cols.preparacion.style.display = 'block';
      const title = document.getElementById('titleConfirmado');
      if (title) title.textContent = '🔵 Nuevos Pedidos';
    }
  }

  // --- CARGAR PEDIDOS CON NOMBRE DEL CLIENTE (RPC) ---
  async function loadOrders() {
    let statusFilter;
    if (staffRole === 'admin') statusFilter = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo'];
    else if (staffRole === 'cashier') statusFilter = ['pendiente_pago', 'confirmado', 'listo'];
    else statusFilter = ['confirmado', 'en_preparacion'];

    const { data, error } = await window.supabase
      .rpc('get_orders_with_client_name', { p_statuses: statusFilter });

    if (error) {
      console.error('Error:', error);
      // Fallback sin nombre
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

  // --- ACTUALIZAR KPIs ---
  function updateKPIs() {
    const kpiPend = document.getElementById('kpiPendientes');
    const kpiPrep = document.getElementById('kpiPreparacion');
    const kpiList = document.getElementById('kpiListos');
    if (kpiPend) kpiPend.textContent = allOrders.filter(o => o.status === 'pendiente_pago').length;
    if (kpiPrep) kpiPrep.textContent = allOrders.filter(o => o.status === 'en_preparacion').length;
    if (kpiList) kpiList.textContent = allOrders.filter(o => o.status === 'listo').length;
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

    // Actualizar contadores
    const countP = document.getElementById('countPendientePago');
    const countC = document.getElementById('countConfirmados');
    const countPrep = document.getElementById('countPreparacion');
    const countL = document.getElementById('countListo');
    if (countP) countP.textContent = groups.pendiente_pago.length;
    if (countC) countC.textContent = groups.confirmado.length;
    if (countPrep) countPrep.textContent = groups.en_preparacion.length;
    if (countL) countL.textContent = groups.listo.length;

    // Renderizar tarjetas
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

  // --- RENDERIZAR TARJETA DE PEDIDO ---
  function renderOrderCard(o) {
    const clientName = o.client_name || 'Cliente';
    const time = new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const deliveryText = o.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';
    
    let actionBtn = '';
    
    if (o.status === 'pendiente_pago') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        // Botones de Confirmar + Cancelar
        actionBtn = `
          <div style="display:flex; gap:0.5rem; width:100%;">
            <button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})" style="flex:2;">💰 Confirmar</button>
            <button class="btn-sm-action" onclick="event.stopPropagation(); window.__cancelPendingOrder(${o.id})" style="flex:1; background: rgba(239, 68, 68, 0.2); color: #fca5a5;">✕</button>
          </div>
        `;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#93c5fd;">⏳ Esperando cobro...</span>`;
      }
    } else if (o.status === 'confirmado') {
      if (staffRole === 'kitchen') {
        actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
      } else if (staffRole === 'cashier') {
        if (o.payment_method === 'efectivo') {
          actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💵 Cobrar</button>`;
        } else {
          actionBtn = `<span style="font-size:0.8rem;color:#93c5fd;">⏳ Esperando cocina...</span>`;
        }
      } else {
        actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
      }
    } else if (o.status === 'en_preparacion') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-ready" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#fcd34d;">⏳ En cocina...</span>`;
      }
    } else if (o.status === 'listo') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'entregado')">📦 Marcar Entregado</button>`;
      } else {
        actionBtn = `<span style="font-size:0.8rem;color:#6ee7b7;">✅ Listo (esperando caja)</span>`;
      }
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

  // --- CAMBIAR ESTADO (Preparar / Listo / Entregado) ---
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

  // --- CONFIRMAR PAGO (descuenta stock vía RPC) ---
  window.__confirmPayment = async (orderId) => {
    try {
      const { error } = await window.supabase
        .rpc('confirm_order_payment', { p_order_id: orderId });

      if (error) {
        if (error.message.includes('SOLD_OUT')) {
          alert('❌ No se puede confirmar: uno de los productos se agotó mientras el cliente esperaba.');
          await window.supabase.rpc('cancel_order_and_restore_stock', { p_order_id: orderId });
        } else {
          throw error;
        }
      } else {
        alert('✅ Pago confirmado y stock descontado. El pedido pasa a cocina.');
        await loadOrders();
      }
    } catch (err) {
      alert('Error al confirmar pago: ' + err.message);
    }
  };

  // --- CANCELAR PEDIDO PENDIENTE DE PAGO ---
  window.__cancelPendingOrder = async (orderId) => {
    if (!confirm(`¿Cancelar el pedido #${orderId}? El cliente deberá hacer uno nuevo.`)) return;
    
    try {
      const { error } = await window.supabase
        .rpc('cancel_order_and_restore_stock', { p_order_id: orderId });

      if (error) {
        alert('Error al cancelar: ' + error.message);
      } else {
        alert(`✅ Pedido #${orderId} cancelado.`);
        await loadOrders();
      }
    } catch (err) {
      alert('Error: ' + err.message);
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
  const isComplemento = i.custom_notes?.startsWith('Complemento para');
  
  return `
    <div style="padding:0.5rem 0; border-bottom:1px solid var(--border-dark); ${isComplemento ? 'margin-left:1.5rem; border-left:2px solid var(--accent-500); padding-left:0.75rem;' : ''}">
      <div style="display:flex; justify-content:space-between;">
        <strong>${isComplemento ? '➕ ' : ''}${i.quantity} x ${name}</strong>
        <span>Bs. ${i.subtotal}</span>
      </div>
      ${i.custom_notes && !isComplemento ? `<div style="font-size:0.8rem; color:var(--accent-500); margin-top:0.25rem;">📝 ${i.custom_notes}</div>` : ''}
    </div>
  `;

    }).join('') + `
      <div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:0.5rem; border-top:2px solid var(--border-dark); font-weight:800;">
        <span>Total</span>
        <span style="color:var(--brand-500);">Bs. ${totalCalculado.toFixed(2)}</span>
      </div>
    `;
  };
})();