/* ============================================
   MY-ORDERS.JS — Historial de pedidos del cliente
   con timeline de estado en tiempo real
   ============================================ */
(function() {
  let currentUser = null;
  let orders = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['client']);
    if (!profile) return;
    currentUser = profile;

    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';

    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    await loadOrders();
    initRealtime();
  });

  async function loadOrders() {
    const { data, error } = await window.supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando pedidos:', error);
      document.getElementById('ordersList').innerHTML = `<p style="text-align:center;color:red;">Error al cargar pedidos.</p>`;
      return;
    }

    orders = data || [];
    await renderOrders();
  }

  async function renderOrders() {
    const container = document.getElementById('ordersList');

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-orders">
          <div class="empty-orders-icon">🍦</div>
          <p class="empty-orders-text">Aún no tienes pedidos.</p>
          <a href="/client/dashboard.html" class="btn btn--primary">Ver el Menú</a>
        </div>
      `;
      return;
    }

    // Cargar los items de cada pedido
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const { data: items } = await window.supabase
        .from('order_items')
        .select(`*, products:product_id (name)`)
        .eq('order_id', order.id);
      return { ...order, items: items || [] };
    }));

    container.innerHTML = ordersWithItems.map(order => renderOrderCard(order)).join('');
  }

  function renderOrderCard(order) {
    const status = order.status;
    const isCancelled = status === 'cancelado';
    const isDelivered = status === 'entregado';
    const isReady = status === 'listo';
    const deliveryType = order.delivery_type;

    // Configurar timeline
    const steps = [
      { key: 'pendiente_pago', label: 'Pago', icon: '💳' },
      { key: 'confirmado', label: 'Confirmado', icon: '✅' },
      { key: 'en_preparacion', label: 'Cocina', icon: '👨‍🍳' },
      { key: 'listo', label: deliveryType === 'domicilio' ? 'En camino' : 'Listo', icon: deliveryType === 'domicilio' ? '🛵' : '📦' },
      { key: 'entregado', label: 'Entregado', icon: '🎉' }
    ];

    // Determinar índices
    const statusOrder = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo', 'entregado'];
    const currentIndex = statusOrder.indexOf(status);

    const timelineHtml = steps.map((step, index) => {
      let cls = 'timeline-step';
      if (isCancelled) {
        // Si está cancelado, mostrar todo gris excepto el primero
        if (index === 0) cls += ' completed';
      } else if (index < currentIndex) {
        cls += ' completed';
      } else if (index === currentIndex) {
        cls += ' active';
      }
      return `
        <div class="${cls}">
          <div class="timeline-icon">${step.icon}</div>
          <div class="timeline-label">${step.label}</div>
        </div>
      `;
    }).join('');

    // Badge de estado
    const statusLabels = {
      pendiente_pago: '⏳ Esperando Pago',
      confirmado: '✅ Confirmado',
      en_preparacion: '👨‍🍳 En Cocina',
      listo: deliveryType === 'domicilio' ? '🛵 En Camino' : '📦 Listo para Recoger',
      entregado: '🎉 Entregado',
      cancelado: '❌ Cancelado'
    };

    // Banner de entrega
    let deliveryBanner = '';
    if (!isCancelled) {
      if (isReady) {
        if (deliveryType === 'recojo') {
          deliveryBanner = `<div class="delivery-banner delivery-banner--recojo">📦 ¡Tu pedido está listo! Pasa a recogerlo a la tienda.</div>`;
        } else {
          deliveryBanner = `<div class="delivery-banner delivery-banner--domicilio">🛵 ¡Tu pedido está en camino! Llega pronto a tu domicilio.</div>`;
        }
      } else if (isDelivered) {
        deliveryBanner = `<div class="delivery-banner delivery-banner--recojo">🎉 Pedido entregado. ¡Gracias por tu compra!</div>`;
      } else if (status === 'en_preparacion') {
        deliveryBanner = `<div class="delivery-banner delivery-banner--waiting">👨‍🍳 Estamos preparando tu pedido...</div>`;
      } else if (status === 'pendiente_pago') {
        deliveryBanner = `<div class="delivery-banner delivery-banner--waiting">⏳ Esperando confirmación de pago en caja.</div>`;
      } else if (status === 'confirmado') {
        deliveryBanner = `<div class="delivery-banner delivery-banner--waiting">✅ Pedido confirmado, esperando turno en cocina.</div>`;
      }
    } else {
      deliveryBanner = `<div class="delivery-banner" style="background:rgba(239,68,68,0.15); color:#fca5a5; border-left:3px solid #ef4444;">❌ Este pedido fue cancelado.</div>`;
    }

    // Lista de items
    const itemsHtml = order.items.map(item => {
      const isComplemento = item.custom_notes?.startsWith('Complemento para');
      const name = item.products?.name || 'Producto';
      return `
        <div class="order-item-row" style="${isComplemento ? 'padding-left:1.5rem; font-size:0.85rem; color:var(--text-muted);' : ''}">
          <span>${isComplemento ? '➕ ' : ''}${item.quantity}x ${name}</span>
          <span>Bs. ${Number(item.subtotal).toFixed(2)}</span>
        </div>
      `;
    }).join('');

    const total = order.items.reduce((sum, i) => sum + Number(i.subtotal), 0);

    return `
      <article class="order-card-detail">
        <div class="order-card-header">
          <div>
            <span class="order-id-tag">Pedido #${order.id}</span>
            <div class="order-date">${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <span class="status-badge status-${status}">${statusLabels[status] || status}</span>
        </div>
        <div class="order-card-body">
          
          ${!isCancelled ? `<div class="timeline">${timelineHtml}</div>` : ''}
          
          ${deliveryBanner}
          
          <div class="order-meta-grid">
            <div class="order-meta-item">
              <div class="order-meta-label">Tipo de entrega</div>
              <div class="order-meta-value">${deliveryType === 'domicilio' ? '🛵 Domicilio' : '🏪 Recojo en tienda'}</div>
            </div>
            ${order.delivery_address ? `
              <div class="order-meta-item">
                <div class="order-meta-label">Dirección</div>
                <div class="order-meta-value">${order.delivery_address}</div>
              </div>
            ` : ''}
            <div class="order-meta-item">
              <div class="order-meta-label">Método de pago</div>
              <div class="order-meta-value">${order.payment_method.toUpperCase()}</div>
            </div>
            <div class="order-meta-item">
              <div class="order-meta-label">Hora programada</div>
              <div class="order-meta-value">${new Date(order.scheduled_time).toLocaleString()}</div>
            </div>
          </div>

          <div class="order-items-list">
            ${itemsHtml}
          </div>
          <div class="order-total-row">
            <span>Total</span>
            <span class="order-total-value">Bs. ${total.toFixed(2)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function initRealtime() {
    window.supabase
      .channel('my-orders-realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `user_id=eq.${currentUser.id}`
      }, (payload) => {
        console.log('Pedido actualizado:', payload.new);
        // Actualizar el pedido en la lista local
        const idx = orders.findIndex(o => o.id === payload.new.id);
        if (idx !== -1) {
          orders[idx] = { ...orders[idx], ...payload.new };
          renderOrders();
        }
      })
      .subscribe();
  }
})();