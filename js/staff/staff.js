/* ============================================
   STAFF.JS — Roles + chat + comprobante
   + Evidencia de entrega con firma virtual
   ============================================ */
(function() {
  let allOrders = [];
  let staffRole = 'kitchen';
  let staffProfile = null;

  let currentChatOrderId = null;
  let chatSubscription = null;

  // Firma
  let signatureCanvas = null;
  let signatureCtx = null;
  let isDrawing = false;

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

    configureRoleUI();
    applyRoleVisibility();

    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      document.getElementById('orderDetailModal').classList.remove('active');
    });

    initChat();
    initEvidenceModal();

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

  // --- CONFIGURAR UI ---
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
      pageSubtitle.textContent = 'Confirma pagos y entrega los pedidos de recojo.';
      roleBadge.textContent = 'CAJERO';
      roleBadge.style.background = '#3b82f6';
      roleBadge.style.color = '#fff';
      kpiGrid.innerHTML = `
        <div class="kpi-card kpi-card--blue"><div class="kpi-label">Por Cobrar</div><div class="kpi-value" id="kpiPendientes">0</div></div>
        <div class="kpi-card kpi-card--green"><div class="kpi-label">Listos para Entregar</div><div class="kpi-value" id="kpiListos">0</div></div>
      `;
    } else if (staffRole === 'delivery') {
      pageTitle.textContent = 'Panel de Repartidor';
      pageSubtitle.textContent = 'Gestiona los pedidos para entrega a domicilio.';
      roleBadge.textContent = 'REPARTIDOR';
      roleBadge.style.background = '#10b981';
      roleBadge.style.color = '#fff';
      kpiGrid.innerHTML = `
        <div class="kpi-card kpi-card--yellow"><div class="kpi-label">Por Recoger</div><div class="kpi-value" id="kpiPreparacion">0</div></div>
        <div class="kpi-card kpi-card--blue"><div class="kpi-label">En Camino</div><div class="kpi-value" id="kpiPendientes">0</div></div>
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

  // --- VISIBILIDAD DE COLUMNAS ---
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
      if (cols.listo) {
        cols.listo.style.display = 'block';
        const title = cols.listo.querySelector('.kanban-title');
        if (title) title.textContent = '🟢 Listos (Recojo)';
      }
      const titleC = document.getElementById('titleConfirmado');
      if (titleC) titleC.textContent = '👨‍🍳 En Preparación';
    }

    if (staffRole === 'kitchen') {
      if (cols.confirmado) cols.confirmado.style.display = 'block';
      if (cols.preparacion) cols.preparacion.style.display = 'block';
      const titleC = document.getElementById('titleConfirmado');
      if (titleC) titleC.textContent = '🔵 Nuevos Pedidos';
    }

    if (staffRole === 'delivery') {
      if (cols.listo) {
        cols.listo.style.display = 'block';
        const title = cols.listo.querySelector('.kanban-title');
        if (title) title.textContent = '📦 Listos (Domicilio)';
      }
      if (cols.confirmado) {
        cols.confirmado.style.display = 'block';
        const titleC = document.getElementById('titleConfirmado');
        if (titleC) titleC.textContent = '🛵 En Camino';
      }
    }
  }

  // --- CARGAR PEDIDOS ---
  async function loadOrders() {
    let statusFilter;
    if (staffRole === 'admin') statusFilter = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo', 'en_camino'];
    else if (staffRole === 'cashier') statusFilter = ['pendiente_pago', 'confirmado', 'listo'];
    else if (staffRole === 'delivery') statusFilter = ['listo', 'en_camino'];
    else statusFilter = ['confirmado', 'en_preparacion'];

    const { data, error } = await window.supabase
      .rpc('get_orders_with_client_name', { p_statuses: statusFilter });

    if (error) {
      console.error('❌ Error RPC:', error);
      const { data: fallback } = await window.supabase
        .from('orders')
        .select('*')
        .in('status', statusFilter)
        .order('created_at', { ascending: true });
      allOrders = (fallback || []).map(o => ({ 
        ...o, client_name: 'Cliente', client_phone: null, delivery_person_name: null 
      }));
    } else {
      allOrders = data || [];
    }

    console.log('📋 Pedidos cargados:', allOrders.map(o => ({ 
      id: o.id, 
      status: o.status, 
      receipt_url: o.receipt_url 
    })));

    renderKanban();
    updateKPIs();
  }

  function updateKPIs() {
    const kpiPend = document.getElementById('kpiPendientes');
    const kpiPrep = document.getElementById('kpiPreparacion');
    const kpiList = document.getElementById('kpiListos');
    
    if (staffRole === 'delivery') {
      if (kpiPend) kpiPend.textContent = allOrders.filter(o => o.status === 'en_camino').length;
      if (kpiPrep) kpiPrep.textContent = allOrders.filter(o => o.status === 'listo').length;
    } else {
      if (kpiPend) kpiPend.textContent = allOrders.filter(o => o.status === 'pendiente_pago').length;
      if (kpiPrep) kpiPrep.textContent = allOrders.filter(o => o.status === 'en_preparacion').length;
      if (kpiList) kpiList.textContent = allOrders.filter(o => o.status === 'listo').length;
    }
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
      confirmado: allOrders.filter(o => 
        o.status === 'confirmado' || (staffRole === 'delivery' && o.status === 'en_camino')
      ),
      en_preparacion: allOrders.filter(o => o.status === 'en_preparacion'),
      listo: allOrders.filter(o => o.status === 'listo'),
    };

    const countP = document.getElementById('countPendientePago');
    const countC = document.getElementById('countConfirmados');
    const countPrep = document.getElementById('countPreparacion');
    const countL = document.getElementById('countListo');
    if (countP) countP.textContent = groups.pendiente_pago.length;
    if (countC) countC.textContent = groups.confirmado.length;
    if (countPrep) countPrep.textContent = groups.en_preparacion.length;
    if (countL) countL.textContent = groups.listo.length;

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
    
    let extraInfo = '';
    if (staffRole === 'delivery' && o.delivery_type === 'domicilio') {
      extraInfo = `
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">
          📍 ${o.delivery_address || 'Sin dirección'}<br>
          📞 ${o.client_phone || 'Sin teléfono'}
        </div>
      `;
    }

    // Indicador de comprobante
    let receiptBadge = '';
    if (o.receipt_url) {
      receiptBadge = `<div style="font-size:0.75rem; color:#6ee7b7; margin-bottom:0.5rem;">📎 Comprobante adjunto</div>`;
    }

    let actionBtn = '';
    
    if (o.status === 'pendiente_pago') {
      if (staffRole === 'cashier' || staffRole === 'admin') {
        actionBtn = `
          <div style="display:flex; gap:0.5rem; width:100%;">
            <button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})" style="flex:2;">💰 Confirmar</button>
            <button class="btn-sm-action" onclick="event.stopPropagation(); window.__cancelPendingOrder(${o.id})" style="flex:1; background: rgba(239, 68, 68, 0.2); color: #fca5a5;">✕</button>
          </div>
        `;
      }
    } 
    else if (o.status === 'confirmado') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
      } else if (staffRole === 'cashier' && o.payment_method === 'efectivo') {
        actionBtn = `<button class="btn-sm-action btn-pay" onclick="event.stopPropagation(); window.__confirmPayment(${o.id})">💵 Cobrar</button>`;
      }
    } 
    else if (o.status === 'en_preparacion') {
      if (staffRole === 'kitchen' || staffRole === 'admin') {
        actionBtn = `<button class="btn-sm-action btn-ready" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
      }
    } 
    else if (o.status === 'listo') {
      if (o.delivery_type === 'recojo') {
        if (staffRole === 'cashier' || staffRole === 'admin') {
          actionBtn = `<button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__openEvidence(${o.id})">📸 Entregar al Cliente</button>`;
        } else {
          actionBtn = `<span style="font-size:0.8rem;color:#6ee7b7;">✅ Listo (esperando caja)</span>`;
        }
      } else {
        if (staffRole === 'delivery' || staffRole === 'admin') {
          actionBtn = `
            <div style="display:flex; gap:0.5rem; width:100%;">
              <button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_camino')" style="flex:2;">🛵 Recoger e ir</button>
              <button class="btn-sm-action" onclick="event.stopPropagation(); window.__openChat(${o.id})" style="flex:1; background: rgba(59,130,246,0.2); color:#93c5fd;">💬</button>
            </div>
          `;
        } else {
          actionBtn = `<span style="font-size:0.8rem;color:#6ee7b7;">✅ Listo (esperando repartidor)</span>`;
        }
      }
    } 
    else if (o.status === 'en_camino') {
      if (staffRole === 'delivery' || staffRole === 'admin') {
        actionBtn = `
          <div style="display:flex; gap:0.5rem; width:100%;">
            <button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__openEvidence(${o.id})" style="flex:2;">📸 Confirmar Entrega</button>
            <button class="btn-sm-action" onclick="event.stopPropagation(); window.__openChat(${o.id})" style="flex:1; background: rgba(59,130,246,0.2); color:#93c5fd;">💬</button>
          </div>
        `;
      }
    }

    const borderClass = `order-card--${o.status}`;

    return `
      <div class="order-card ${borderClass}" onclick="window.__viewOrderDetail(${o.id})">
        <div class="order-card-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-client">${clientName}</div>
        <div class="order-details">${deliveryText} · ${o.payment_method.toUpperCase()}</div>
        ${extraInfo}
        ${receiptBadge}
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
    if (newStatus === 'entregado') {
      updateData.delivered_at = new Date().toISOString();
    }
    if (newStatus === 'en_camino' && staffRole === 'delivery') {
      updateData.delivery_person_id = staffProfile.id;
    }

    const { error } = await window.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      alert('Error: ' + error.message);
      await loadOrders();
    } else if (newStatus === 'entregado') {
      alert(`✅ Pedido #${orderId} entregado correctamente.`);
    } else if (newStatus === 'en_camino') {
      alert(`🛵 Pedido #${orderId} en camino.`);
    }
  };

  window.__confirmPayment = async (orderId) => {
    const order = allOrders.find(o => o.id === orderId);
    
    if (order && order.payment_method !== 'efectivo' && !order.receipt_url) {
      alert('⚠️ Este pedido no tiene comprobante de pago adjunto. El cliente debe subirlo antes de confirmar.');
      return;
    }

    try {
      const { error } = await window.supabase
        .rpc('confirm_order_payment', { p_order_id: orderId });

      if (error) {
        if (error.message.includes('SOLD_OUT')) {
          alert('❌ No se puede confirmar: uno de los productos se agotó.');
          await window.supabase.rpc('cancel_order_and_restore_stock', { p_order_id: orderId });
        } else {
          throw error;
        }
      } else {
        alert('✅ Pago confirmado y stock descontado.');
        await loadOrders();
      }
    } catch (err) {
      alert('Error al confirmar pago: ' + err.message);
    }
  };

  window.__cancelPendingOrder = async (orderId) => {
    if (!confirm(`¿Cancelar el pedido #${orderId}?`)) return;
    try {
      const { error } = await window.supabase
        .rpc('cancel_order_and_restore_stock', { p_order_id: orderId });
      if (error) alert('Error al cancelar: ' + error.message);
      else { alert(`✅ Pedido #${orderId} cancelado.`); await loadOrders(); }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  window.__viewOrderDetail = async (orderId) => {
    const modal = document.getElementById('orderDetailModal');
    if (!modal) return;

    const order = allOrders.find(o => o.id === orderId);
    console.log('🔍 Cajero ve pedido:', {
      id: order?.id,
      status: order?.status,
      payment_method: order?.payment_method,
      receipt_url: order?.receipt_url
    });

    document.getElementById('detailOrderTitle').textContent = `Pedido #${orderId}`;
    document.getElementById('detailOrderInfo').innerHTML = '<p>Cargando...</p>';
    document.getElementById('detailOrderItems').innerHTML = '';
    modal.classList.add('active');

    if (!order) return;

    const clientName = order.client_name || 'Cliente';
    const deliveryText = order.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo';

    // Comprobante
    let receiptHtml = '';
    if (order.receipt_url) {
      let actionButtons = '';
      if (order.status === 'pendiente_pago' && (staffRole === 'cashier' || staffRole === 'admin')) {
        actionButtons = `
          <div style="display:flex; gap:0.75rem; margin-top:1rem;">
            <button onclick="window.__confirmPayment(${order.id}); document.getElementById('orderDetailModal').classList.remove('active');" 
                    style="flex:1; padding:0.75rem; background:#10b981; color:#fff; border:none; border-radius:0.5rem; font-weight:700; cursor:pointer; font-size:0.95rem;">
              ✅ Confirmar Pago
            </button>
            <button onclick="window.__rejectReceipt(${order.id})" 
                    style="flex:1; padding:0.75rem; background:#ef4444; color:#fff; border:none; border-radius:0.5rem; font-weight:700; cursor:pointer; font-size:0.95rem;">
              ❌ Rechazar
            </button>
          </div>
        `;
      }

      receiptHtml = `
        <div style="margin-top:1.5rem; padding:1rem; background:#0b1120; border-radius:0.5rem; border:1px solid var(--border-dark);">
          <p style="font-size:0.9rem; color:var(--text-main); margin-bottom:0.75rem; font-weight:700;">📎 Comprobante de pago:</p>
          <a href="${order.receipt_url}" target="_blank" style="display:block;">
            <img src="${order.receipt_url}" alt="Comprobante" style="width:100%; max-height:400px; object-fit:contain; border-radius:0.5rem; border:1px solid var(--border-dark); background:#fff; cursor:zoom-in;" />
          </a>
          ${actionButtons}
        </div>
      `;
    }

    // Evidencia de entrega (si existe)
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
      ${order.client_phone ? `<p style="margin-bottom:0.25rem;"><strong>Teléfono:</strong> ${order.client_phone}</p>` : ''}
      <p style="margin-bottom:0.25rem;"><strong>Entrega:</strong> ${deliveryText} ${order.delivery_address ? `- ${order.delivery_address}` : ''}</p>
      <p style="margin-bottom:0.25rem;"><strong>Pago:</strong> ${order.payment_method.toUpperCase()}</p>
      <p style="margin-bottom:0.25rem;"><strong>Hora programada:</strong> ${new Date(order.scheduled_time).toLocaleString()}</p>
      ${order.delivery_person_name ? `<p style="margin-bottom:0.25rem;"><strong>Repartidor:</strong> ${order.delivery_person_name}</p>` : ''}
      <p><strong>Estado:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
      ${receiptHtml}
      ${evidenceHtml}
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

  window.__rejectReceipt = async (orderId) => {
    if (!confirm('¿Rechazar este comprobante? El pedido volverá a "Pendiente de Pago" y el cliente deberá subir uno nuevo.')) return;

    try {
      const { error } = await window.supabase
        .from('orders')
        .update({ status: 'pendiente_pago', receipt_url: null })
        .eq('id', orderId);

      if (error) {
        alert('Error al rechazar: ' + error.message);
      } else {
        alert('❌ Comprobante rechazado.');
        document.getElementById('orderDetailModal').classList.remove('active');
        await loadOrders();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ============================================
  // EVIDENCIA DE ENTREGA
  // ============================================
  function initEvidenceModal() {
    const modal = document.getElementById('evidenceModal');
    const form = document.getElementById('evidenceForm');
    const canvas = document.getElementById('signatureCanvas');
    const btnClear = document.getElementById('btnClearSignature');
    const btnCancel = document.getElementById('btnCancelEvidence');
    const photoInput = document.getElementById('evidencePhoto');

    if (!canvas) return;

    signatureCanvas = canvas;
    signatureCtx = canvas.getContext('2d');

    canvas.width = 500;
    canvas.height = 200;
    signatureCtx.fillStyle = '#f8fafc';
    signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
    signatureCtx.strokeStyle = '#0f172a';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDrawing = (e) => {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      signatureCtx.beginPath();
      signatureCtx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      signatureCtx.lineTo(pos.x, pos.y);
      signatureCtx.stroke();
    };

    const stopDrawing = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    btnClear?.addEventListener('click', () => {
      signatureCtx.fillStyle = '#f8fafc';
      signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
    });

    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById('evidencePhotoPreview');
      const img = document.getElementById('evidencePhotoImg');
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          img.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        preview.style.display = 'none';
      }
    });

    btnCancel?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitEvidence();
    });
  }

  function isCanvasEmpty() {
    if (!signatureCanvas) return true;
    const blank = document.createElement('canvas');
    blank.width = signatureCanvas.width;
    blank.height = signatureCanvas.height;
    return signatureCanvas.toDataURL() === blank.toDataURL();
  }

  window.__openEvidence = (orderId) => {
    const modal = document.getElementById('evidenceModal');
    if (!modal) return;

    document.getElementById('evidenceOrderId').value = orderId;
    document.getElementById('evidenceForm').reset();
    document.getElementById('evidenceError').classList.add('hidden');
    document.getElementById('evidencePhotoPreview').style.display = 'none';
    document.getElementById('evidenceTitle').textContent = `Evidencia de Entrega — Pedido #${orderId}`;

    if (signatureCtx) {
      signatureCtx.fillStyle = '#f8fafc';
      signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }

    modal.classList.add('active');
  };

  async function uploadEvidenceFile(file, prefix) {
    const fileExt = file.name ? file.name.split('.').pop() : 'png';
    const fileName = `${prefix}-${staffProfile.id}-${Date.now()}.${fileExt}`;

    const { error } = await window.supabase.storage
      .from('delivery-evidence')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Error al subir archivo: ' + error.message);

    const { data: urlData } = window.supabase.storage
      .from('delivery-evidence')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }

  async function submitEvidence() {
    const errorEl = document.getElementById('evidenceError');
    const btn = document.querySelector('#evidenceForm button[type="submit"]');
    errorEl.classList.add('hidden');

    const orderId = parseInt(document.getElementById('evidenceOrderId').value);
    const receiverName = document.getElementById('receiverName').value.trim();
    const receiverIdNumber = document.getElementById('receiverIdNumber').value.trim();
    const notes = document.getElementById('evidenceNotes').value.trim();
    const photoInput = document.getElementById('evidencePhoto');

    if (!receiverName) {
      return showEvidenceError('Ingresa el nombre de quien recibe.');
    }

    if (isCanvasEmpty()) {
      return showEvidenceError('Se requiere la firma del receptor.');
    }

    btn.disabled = true;
    btn.textContent = 'Guardando evidencia...';

    try {
      const signatureBlob = await new Promise(resolve => {
        signatureCanvas.toBlob(resolve, 'image/png');
      });
      const signatureFile = new File([signatureBlob], 'signature.png', { type: 'image/png' });
      const signatureUrl = await uploadEvidenceFile(signatureFile, `sig-order${orderId}`);

      let photoUrl = null;
      if (photoInput.files && photoInput.files.length > 0) {
        photoUrl = await uploadEvidenceFile(photoInput.files[0], `photo-order${orderId}`);
      }

      const { error: insertError } = await window.supabase
        .from('delivery_evidence')
        .insert({
          order_id: orderId,
          receiver_name: receiverName,
          receiver_id_number: receiverIdNumber || null,
          signature_url: signatureUrl,
          photo_url: photoUrl,
          delivered_by: staffProfile.id,
          notes: notes || null
        });

      if (insertError) throw insertError;

      const { error: updateError } = await window.supabase
        .from('orders')
        .update({ 
          status: 'entregado',
          delivered_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      alert(`✅ Entrega confirmada para el pedido #${orderId}`);
      document.getElementById('evidenceModal').classList.remove('active');
      await loadOrders();

    } catch (err) {
      console.error('Error guardando evidencia:', err);
      showEvidenceError(err.message);
      btn.disabled = false;
      btn.textContent = '✅ Confirmar Entrega';
    }
  }

  function showEvidenceError(msg) {
    const errorEl = document.getElementById('evidenceError');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  // --- CHAT ---
  function initChat() {
    const btnCloseChat = document.getElementById('btnCloseChat');
    btnCloseChat?.addEventListener('click', () => {
      document.getElementById('chatModal').classList.remove('active');
      if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
    });

    document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const msg = input.value.trim();
      if (!msg || !currentChatOrderId || !staffProfile) return;

      input.value = '';
      const { error } = await window.supabase.from('order_messages').insert({
        order_id: currentChatOrderId,
        sender_id: staffProfile.id,
        sender_role: staffRole === 'delivery' ? 'delivery' : 'staff',
        message: msg
      });

      if (error) alert('Error al enviar: ' + error.message);
    });
  }

  window.__openChat = async (orderId) => {
    currentChatOrderId = orderId;
    const modal = document.getElementById('chatModal');
    const title = document.getElementById('chatTitle');
    if (!modal) return;

    title.textContent = `Chat del Pedido #${orderId}`;
    modal.classList.add('active');
    await loadChatMessages(orderId);

    if (chatSubscription) chatSubscription.unsubscribe();
    chatSubscription = window.supabase
      .channel(`chat-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        loadChatMessages(orderId);
      })
      .subscribe();
  };

  async function loadChatMessages(orderId) {
    const container = document.getElementById('chatMessages');
    
    const { data: messages, error } = await window.supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error cargando mensajes:', error);
      container.innerHTML = `<p style="color: #fca5a5; text-align: center; font-size: 0.85rem;">Error al cargar mensajes.</p>`;
      return;
    }

    if (!messages || messages.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">No hay mensajes aún. Inicia la conversación.</p>`;
      return;
    }

    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    const { data: profiles } = await window.supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds);

    const profilesMap = {};
    (profiles || []).forEach(p => { profilesMap[p.id] = p; });

    container.innerHTML = messages.map(m => {
      const sender = profilesMap[m.sender_id] || { full_name: 'Usuario', role: m.sender_role };
      return renderChatMessage({ ...m, sender_name: sender.full_name });
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function renderChatMessage(msg) {
    const isMe = msg.sender_id === staffProfile.id;
    const senderName = msg.sender_name || 'Usuario';
    const bubbleStyle = isMe 
      ? 'background: var(--brand-500); color: #fff; margin-left: auto;' 
      : 'background: #1e293b; color: var(--text-main); margin-right: auto;';
    
    return `
      <div style="margin-bottom: 0.75rem; max-width: 80%; ${bubbleStyle} padding: 0.6rem 0.9rem; border-radius: 0.75rem; word-wrap: break-word;">
        <div style="font-size: 0.7rem; opacity: 0.8; margin-bottom: 0.2rem;">${senderName}</div>
        <div style="font-size: 0.9rem;">${msg.message}</div>
        <div style="font-size: 0.65rem; opacity: 0.7; margin-top: 0.2rem;">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
      </div>
    `;
  }
})();