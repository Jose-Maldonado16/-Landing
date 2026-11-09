/* ============================================
   STAFF.JS — Lógica del Panel de Cocina
   ============================================ */
(function() {
  let allOrders = [];
  let allOrderItems = []; // Para no hacer una petición por cada pedido

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard (solo admin y staff)
    const profile = await window.guardPage(['staff', 'admin']);
    if (!profile) return;

    // 2. Mostrar UI
    document.getElementById('appLoader').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    document.getElementById('userName').textContent = profile.full_name || 'Staff';

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', () => window.logoutUser());

    // 4. Cargar datos iniciales
    await loadData();

    // 5. Suscribirse a cambios en tiempo real
    setupRealtime();
  });

  // --- CARGA DE DATOS ---
  async function loadData() {
    // Cargar pedidos activos (no entregados ni cancelados)
    const { data: orders, error: ordersError } = await window.supabase
      .from('orders')
      .select('*')
      .in('status', ['confirmado', 'en_preparacion', 'listo'])
      .order('created_at', { ascending: true }); // Los más viejos primero

    if (ordersError) {
      console.error('Error cargando pedidos:', ordersError);
      return;
    }
    allOrders = orders || [];

    // Cargar items de esos pedidos
    if (allOrders.length > 0) {
      const orderIds = allOrders.map(o => o.id);
      const { data: items, error: itemsError } = await window.supabase
        .from('order_items')
        .select('*, products(name)')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error cargando items:', itemsError);
      } else {
        allOrderItems = items || [];
      }
    }

    renderKanban();
  }

  // --- RENDERIZADO DEL KANBAN ---
  function renderKanban() {
    const columns = {
      confirmado: document.getElementById('col-confirmado'),
      en_preparacion: document.getElementById('col-en_preparacion'),
      listo: document.getElementById('col-listo'),
    };

    // Limpiar columnas
    Object.values(columns).forEach(col => col.innerHTML = '');

    // Contadores
    let counts = { confirmado: 0, en_preparacion: 0, listo: 0 };

    // Clasificar pedidos
    allOrders.forEach(order => {
      counts[order.status]++;
      const col = columns[order.status];
      if (!col) return;

      const orderItems = allOrderItems.filter(i => i.order_id === order.id);
      col.innerHTML += createOrderCardHTML(order, orderItems);
    });

    // Actualizar contadores en UI
    document.getElementById('count-confirmado').textContent = counts.confirmado;
    document.getElementById('count-en_preparacion').textContent = counts.en_preparacion;
    document.getElementById('count-listo').textContent = counts.listo;

    // Mensajes de vacío
    Object.keys(columns).forEach(status => {
      if (counts[status] === 0) {
        columns[status].innerHTML = `<div class="empty-state">No hay pedidos aquí.</div>`;
      }
    });
  }

  function createOrderCardHTML(order, items) {
    const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const itemsHTML = items.map(item => 
      `<li><strong>${item.quantity}x</strong> ${item.products?.name || 'Producto'} ${item.custom_notes ? `<em>(${item.custom_notes})</em>` : ''}</li>`
    ).join('');

    let actionsHTML = '';
    if (order.status === 'confirmado') {
      actionsHTML = `<button class="btn-action btn-prep" onclick="window.__updateStatus(${order.id}, 'en_preparacion')">Iniciar Preparación</button>`;
    } else if (order.status === 'en_preparacion') {
      actionsHTML = `<button class="btn-action btn-ready" onclick="window.__updateStatus(${order.id}, 'listo')">Marcar Listo</button>`;
    } else if (order.status === 'listo') {
      actionsHTML = `<button class="btn-action btn-done" onclick="window.__updateStatus(${order.id}, 'entregado')">Entregar</button>`;
    }

    return `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-id">#${order.id}</span>
          <span class="order-time">${time}</span>
        </div>
        <ul class="order-items-list">
          ${itemsHTML || '<li>Sin detalles</li>'}
        </ul>
        ${order.delivery_type === 'domicilio' ? `<div class="order-notes">🛵 Delivery: ${order.delivery_address}</div>` : '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;">🏪 Recojo en tienda</div>'}
        <div class="order-actions">
          ${actionsHTML}
        </div>
      </div>
    `;
  }

  // --- ACTUALIZAR ESTADO ---
  window.__updateStatus = async (orderId, newStatus) => {
    // Buscar el botón y deshabilitarlo para evitar doble clic
    const btns = document.querySelectorAll(`button[onclick*="__updateStatus(${orderId}"]`);
    btns.forEach(b => { b.disabled = true; b.textContent = '...'; });

    const { error } = await window.supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error actualizando el pedido: ' + error.message);
      // Recargar para restaurar el estado visual
      await loadData();
    } else {
      // Supabase Realtime se encargará de actualizar la UI automáticamente
      // Pero por si acaso, recargamos localmente también
      await loadData();
    }
  };

  // --- TIEMPO REAL (SUPABASE REALTIME) ---
  function setupRealtime() {
    // Escuchar cambios en la tabla 'orders'
    window.supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('Cambio en tiempo real:', payload);
          // Si un pedido se crea, actualiza o elimina, recargamos los datos
          loadData();
        }
      )
      .subscribe();
  }
})();