/* ============================================
   STAFF.JS — Gestión de pedidos en tiempo real
   ============================================ */
(function() {
  let allOrders = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard (solo staff o admin)
    const profile = await window.guardPage(['staff', 'admin']);
    if (!profile) return;

    // 2. Mostrar UI
    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Staff';

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    // 4. Modal de detalle: botón de cerrar
    const btnCloseDetail = document.getElementById('btnCloseDetail');
    if (btnCloseDetail) {
      btnCloseDetail.addEventListener('click', () => {
        document.getElementById('orderDetailModal').classList.remove('active');
      });
    }

    // 5. Cargar pedidos
    await loadOrders();

    // 6. Realtime
    window.supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType !== 'UPDATE' || payload.new.status !== payload.old.status) {
          loadOrders();
        }
      })
      .subscribe();
  });

  async function loadOrders() {
    const { data, error } = await window.supabase
      .from('orders')
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .in('status', ['confirmado', 'en_preparacion', 'listo'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error cargando pedidos:', error);
      return;
    }

    allOrders = data || [];
    renderKanban();
  }

  function renderKanban() {
    const cols = {
      confirmado: document.getElementById('col-confirmado'),
      en_preparacion: document.getElementById('col-en_preparacion'),
      listo: document.getElementById('col-listo')
    };
    
    Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

    const groups = {
      confirmado: allOrders.filter(o => o.status === 'confirmado'),
      en_preparacion: allOrders.filter(o => o.status === 'en_preparacion'),
      listo: allOrders.filter(o => o.status === 'listo'),
    };

    document.getElementById('countConfirmados').textContent = groups.confirmado.length;
    document.getElementById('countPreparacion').textContent = groups.en_preparacion.length;
    document.getElementById('countListo').textContent = groups.listo.length;

    Object.keys(groups).forEach(status => {
      const container = cols[status];
      if (!container) return;
      
      if (groups[status].length === 0) {
        container.innerHTML = `<p class="empty-col">No hay pedidos aquí.</p>`;
        return;
      }

      container.innerHTML = groups[status].map(o => renderOrderCard(o)).join('');
    });
  }

  function renderOrderCard(o) {
    const clientName = o.profiles?.full_name || 'Cliente';
    const time = new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let actionBtn = '';
    if (o.status === 'confirmado') {
      actionBtn = `<button class="btn-sm-action btn-prepare" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
    } else if (o.status === 'en_preparacion') {
      actionBtn = `<button class="btn-sm-action btn-ready" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
    } else if (o.status === 'listo') {
      actionBtn = `<button class="btn-sm-action btn-deliver" onclick="event.stopPropagation(); window.__changeStatus(${o.id}, 'entregado')">📦 Entregar</button>`;
    }

    return `
      <div class="order-card" onclick="window.__viewOrderDetail(${o.id})" style="cursor: pointer;">
        <div class="order-card-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-client">${clientName}</div>
        <div class="order-details">
          ${o.delivery_type === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo'} · 
          ${o.payment_method.toUpperCase()}
        </div>
        <div class="order-total">Bs. ${o.total}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">👁️ Clic para ver detalle</div>
        <div class="order-actions">
          ${actionBtn}
        </div>
      </div>
    `;
  }

  window.__changeStatus = async (orderId, newStatus) => {
    const orderIndex = allOrders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      allOrders[orderIndex].status = newStatus;
      if (newStatus === 'entregado') allOrders.splice(orderIndex, 1);
      renderKanban();
    }

    const { error } = await window.supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error al actualizar: ' + error.message);
      await loadOrders();
    }
  };

  // --- DETALLE DEL PEDIDO ---
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
      <p style="margin-bottom:0.25rem;"><strong>Hora programada:</strong> ${new Date(order.scheduled_time).toLocaleString()}</p>
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
            <div>
              <strong>${i.quantity} x ${productName}</strong>
            </div>
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