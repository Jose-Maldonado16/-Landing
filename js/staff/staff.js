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

    // 4. Cargar pedidos
    await loadOrders();

    // 5. Configurar tiempo real (Realtime)
    window.supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        console.log('Cambio en pedido:', payload);
        loadOrders(); // Recargar al detectar cambios
      })
      .subscribe();
  });

  async function loadOrders() {
    // Traemos solo los pedidos activos (no entregados/cancelados) con nombre del cliente
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
    // Limpiar columnas
    const cols = {
      confirmado: document.getElementById('col-confirmado'),
      en_preparacion: document.getElementById('col-en_preparacion'),
      listo: document.getElementById('col-listo')
    };
    
    Object.values(cols).forEach(c => c.innerHTML = '');

    // Agrupar
    const groups = {
      confirmado: allOrders.filter(o => o.status === 'confirmado'),
      en_preparacion: allOrders.filter(o => o.status === 'en_preparacion'),
      listo: allOrders.filter(o => o.status === 'listo'),
    };

    // Actualizar contadores
    document.getElementById('countConfirmados').textContent = groups.confirmado.length;
    document.getElementById('countPreparacion').textContent = groups.en_preparacion.length;
    document.getElementById('countListo').textContent = groups.listo.length;

    // Renderizar cada grupo
    Object.keys(groups).forEach(status => {
      const container = cols[status];
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
      actionBtn = `<button class="btn-sm-action btn-prepare" onclick="window.__changeStatus(${o.id}, 'en_preparacion')">👨‍🍳 Preparar</button>`;
    } else if (o.status === 'en_preparacion') {
      actionBtn = `<button class="btn-sm-action btn-ready" onclick="window.__changeStatus(${o.id}, 'listo')">✅ Marcar Listo</button>`;
    } else if (o.status === 'listo') {
      actionBtn = `<button class="btn-sm-action btn-deliver" onclick="window.__changeStatus(${o.id}, 'entregado')">📦 Entregar</button>`;
    }

    return `
      <div class="order-card">
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
        <div class="order-actions">
          ${actionBtn}
        </div>
      </div>
    `;
  }

  // Cambiar estado de un pedido
  window.__changeStatus = async (orderId, newStatus) => {
    const { error } = await window.supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error al cambiar estado: ' + error.message);
    }
  };
})();