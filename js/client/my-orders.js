/* ============================================
   MY-ORDERS.JS — Historial con timeline + chat
   sin JOIN (evita error 406)
   ============================================ */
(function() {
  let currentUser = null;
  let orders = [];

  let currentChatOrderId = null;
  let chatSubscription = null;

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['client']);
    if (!profile) return;
    currentUser = profile;

    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';

    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    initChat();
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

    // Cargar items de cada pedido + info del repartidor
    const ordersWithData = await Promise.all(orders.map(async (order) => {
      const { data: items } = await window.supabase
        .from('order_items')
        .select(`*, products:product_id (name)`)
        .eq('order_id', order.id);
      
      let deliveryPersonName = null;
      if (order.delivery_person_id) {
        const { data: dp } = await window.supabase
          .from('profiles')
          .select('full_name')
          .eq('id', order.delivery_person_id)
          .single();
        deliveryPersonName = dp?.full_name;
      }
      
      return { ...order, items: items || [], delivery_person_name: deliveryPersonName };
    }));

    container.innerHTML = ordersWithData.map(order => renderOrderCard(order)).join('');
  }

  function renderOrderCard(order) {
    const status = order.status;
    const isCancelled = status === 'cancelado';
    const isDelivered = status === 'entregado';
    const isReady = status === 'listo';
    const isOnTheWay = status === 'en_camino';
    const deliveryType = order.delivery_type;

    const steps = [
      { key: 'pendiente_pago', label: 'Pago', icon: '💳' },
      { key: 'confirmado', label: 'Confirmado', icon: '✅' },
      { key: 'en_preparacion', label: 'Cocina', icon: '👨‍🍳' },
      { key: 'listo', label: 'Listo', icon: '📦' },
      { key: 'en_camino', label: 'En Camino', icon: '🛵' },
      { key: 'entregado', label: 'Entregado', icon: '🎉' }
    ];

    const statusOrder = ['pendiente_pago', 'confirmado', 'en_preparacion', 'listo', 'en_camino', 'entregado'];
    const currentIndex = statusOrder.indexOf(status);

    const timelineHtml = steps.map((step, index) => {
      if (deliveryType === 'recojo' && step.key === 'en_camino') return '';
      
      let cls = 'timeline-step';
      if (isCancelled) {
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

    const statusLabels = {
      pendiente_pago: '⏳ Esperando Pago',
      confirmado: '✅ Confirmado',
      en_preparacion: '👨‍🍳 En Cocina',
      listo: deliveryType === 'domicilio' ? '📦 Listo para Envío' : '📦 Listo para Recoger',
      en_camino: '🛵 En Camino',
      entregado: '🎉 Entregado',
      cancelado: '❌ Cancelado'
    };

    let deliveryBanner = '';
    if (!isCancelled) {
      if (isOnTheWay) {
        deliveryBanner = `<div class="delivery-banner delivery-banner--domicilio">🛵 Tu pedido está en camino${order.delivery_person_name ? ` con ${order.delivery_person_name}` : ''}.</div>`;
      } else if (isReady) {
        if (deliveryType === 'recojo') {
          deliveryBanner = `<div class="delivery-banner delivery-banner--recojo">📦 ¡Tu pedido está listo! Pasa a recogerlo a la tienda.</div>`;
        } else {
          deliveryBanner = `<div class="delivery-banner delivery-banner--recojo">📦 ¡Tu pedido está listo! Un repartidor lo recogerá pronto.</div>`;
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

    let chatButton = '';
    if (deliveryType === 'domicilio' && ['listo', 'en_camino'].includes(status) && !isCancelled) {
      chatButton = `<button class="btn btn--outline" onclick="window.__openChat(${order.id})" style="margin-top:1rem; width:100%;">💬 Chatear con el repartidor</button>`;
    }

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
          ${chatButton}
          
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
            ${order.delivery_person_name ? `
              <div class="order-meta-item">
                <div class="order-meta-label">Repartidor</div>
                <div class="order-meta-value">${order.delivery_person_name}</div>
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
        const idx = orders.findIndex(o => o.id === payload.new.id);
        if (idx !== -1) {
          orders[idx] = { ...orders[idx], ...payload.new };
          renderOrders();
        }
      })
      .subscribe();
  }

  // --- CHAT (SIN JOIN) ---
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
      if (!msg || !currentChatOrderId || !currentUser) return;

      input.value = '';
      const { error } = await window.supabase.from('order_messages').insert({
        order_id: currentChatOrderId,
        sender_id: currentUser.id,
        sender_role: 'client',
        message: msg
      });

      if (error) alert('Error al enviar: ' + error.message);
    });
  }

  window.__openChat = async (orderId) => {
    currentChatOrderId = orderId;
    const modal = document.getElementById('chatModal');
    document.getElementById('chatTitle').textContent = `Chat del Pedido #${orderId}`;
    modal.classList.add('active');
    await loadChatMessages(orderId);

    if (chatSubscription) chatSubscription.unsubscribe();
    chatSubscription = window.supabase
      .channel(`chat-client-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        // 🔧 Sin JOIN: recargar mensajes completos
        loadChatMessages(orderId);
      })
      .subscribe();
  };

  // 🔧 CORREGIDO: sin JOIN, dos queries separadas
  async function loadChatMessages(orderId) {
    const container = document.getElementById('chatMessages');
    
    // 1. Cargar mensajes (sin JOIN)
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
      container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">No hay mensajes aún.</p>`;
      return;
    }

    // 2. Cargar perfiles por separado
    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    const { data: profiles } = await window.supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds);

    const profilesMap = {};
    (profiles || []).forEach(p => { profilesMap[p.id] = p; });

    // 3. Renderizar
    container.innerHTML = messages.map(m => {
      const sender = profilesMap[m.sender_id] || { full_name: 'Usuario', role: m.sender_role };
      return renderChatMessage({ ...m, sender_name: sender.full_name });
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function renderChatMessage(msg) {
    const isMe = msg.sender_id === currentUser.id;
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