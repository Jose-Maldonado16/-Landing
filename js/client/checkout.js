/* ============================================
   CHECKOUT.JS — Crear pedido en Supabase (V2)
   ============================================ */
(function() {
  let currentUser = null;
  let cart = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard
    const profile = await window.guardPage(['client']);
    if (!profile) return;
    currentUser = profile;

    // 2. Cargar carrito
    cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];
    
    if (cart.length === 0) {
      alert('Tu carrito está vacío. Redirigiendo al menú.');
      window.location.replace('/client/dashboard.html');
      return;
    }

    // 3. Render y formulario
    renderSummary();
    initForm();
    setDateLimits();
  });

  function renderSummary() {
    const itemsContainer = document.getElementById('summaryItems');
    if (!itemsContainer) return;

    itemsContainer.innerHTML = cart.map(item => `
      <div class="summary-item">
        <span><span class="summary-item-qty">${item.quantity}x</span> ${item.name}</span>
        <span class="summary-item-price">Bs. ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('summarySubtotal').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = `Bs. ${total.toFixed(2)}`;
  }

  function setDateLimits() {
    const dateInput = document.getElementById('scheduleDate');
    const timeInput = document.getElementById('scheduleTime');
    if (!dateInput || !timeInput) return;

    const now = new Date();
    
    // 1. Fecha de hoy formateada YYYY-MM-DD
    const fmtDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 2. Hora redondeada (siguiente media hora)
    const fmtTime = (d) => {
      let hours = d.getHours();
      let minutes = d.getMinutes();
      
      if (minutes < 30) {
        minutes = 30;
      } else {
        minutes = 0;
        hours += 1;
      }
      
      // Si pasa de las 23:59, ajustamos a mañana (pero como es solo hora, lo dejamos en 00:00)
      if (hours >= 24) hours = 0;

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    // 3. Calcular límites
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 3);

    // 4. Autocompletar
    dateInput.min = fmtDate(today);
    dateInput.max = fmtDate(maxDate);
    dateInput.value = fmtDate(today); // Fecha de hoy

    timeInput.value = fmtTime(now);   // Hora actual o siguiente media hora
  }

  function initForm() {
    const deliveryRadios = document.querySelectorAll('input[name="deliveryType"]');
    const addressField = document.getElementById('addressField');
    const addressInput = document.getElementById('deliveryAddress');

    deliveryRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'domicilio') {
          addressField.classList.remove('hidden');
          addressInput.required = true;
        } else {
          addressField.classList.add('hidden');
          addressInput.required = false;
          addressInput.value = '';
        }
      });
    });

    const form = document.getElementById('checkoutForm');
    form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const errorEl = document.getElementById('checkoutError');
    const btnSubmit = document.getElementById('btnConfirmOrder');
    errorEl.classList.add('hidden');

    // Recopilar datos
    const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
    const scheduleDate = document.getElementById('scheduleDate')?.value;
    const scheduleTime = document.getElementById('scheduleTime')?.value;
    const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';

    // Validaciones
    if (!deliveryType || !paymentMethod) {
      return showError('Selecciona el tipo de entrega y método de pago.');
    }
    if (deliveryType === 'domicilio' && !deliveryAddress) {
      return showError('Por favor, ingresa tu dirección de entrega.');
    }
    if (!scheduleDate || !scheduleTime) {
      return showError('Selecciona una fecha y hora para tu pedido.');
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // UI Loading
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando pedido...';

    try {
      console.log('Insertando pedido:', {
        user_id: currentUser.id,
        delivery_type: deliveryType,
        payment_method: paymentMethod,
        total: total
      });

      // 1. Crear la orden
      const { data: orderData, error: orderError } = await window.supabase
        .from('orders')
        .insert({
          user_id: currentUser.id,
          status: 'confirmado',
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'domicilio' ? deliveryAddress : null,
          scheduled_time: scheduledDateTime,
          payment_method: paymentMethod,
          total: total,
        })
        .select()
        .single();

      if (orderError) {
        console.error('ERROR al crear order:', orderError);
        throw new Error(`No se pudo crear el pedido: ${orderError.message}`);
      }

      console.log('Orden creada:', orderData);

      // 2. Crear los items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
        custom_notes: orderNotes || null,
      }));

      console.log('Insertando items:', orderItems);

      const { error: itemsError } = await window.supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('ERROR al crear order_items:', itemsError);
        // Rollback manual: borrar la orden si fallan los items
        await window.supabase.from('orders').delete().eq('id', orderData.id);
        throw new Error(`No se pudieron guardar los productos: ${itemsError.message}`);
      }

      // 3. Éxito
      console.log('¡Pedido completado con éxito!');
      localStorage.removeItem('dulcemania_cart');
      
      // Mostrar mensaje y redirigir
      alert(`✅ ¡Pedido #${orderData.id} confirmado!\n\nTotal: Bs. ${total.toFixed(2)}\n\nTe avisaremos cuando esté listo.`);
      window.location.replace(`/client/order-success.html?id=${orderData.id}`);

    } catch (err) {
      console.error('Error completo:', err);
      showError(err.message || 'Hubo un problema al procesar tu pedido. Intenta de nuevo.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Confirmar Pedido';
    }
  }

  function showError(msg) {
    const errorEl = document.getElementById('checkoutError');
    if (!errorEl) return alert(msg);
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();