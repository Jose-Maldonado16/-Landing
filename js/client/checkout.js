/* ============================================
   CHECKOUT.JS — Crear pedido con control de stock
   y PayPal simulado (V3)
   ============================================ */
(function() {
  let currentUser = null;
  let cart = [];
  let paypalRendered = false;

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
    const fmtDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const fmtTime = (d) => {
      let h = d.getHours();
      let min = d.getMinutes();
      if (min < 30) { min = 30; } else { min = 0; h += 1; }
      if (h >= 24) h = 0;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 3);

    dateInput.min = fmtDate(today);
    dateInput.max = fmtDate(maxDate);
    dateInput.value = fmtDate(today);
    timeInput.value = fmtTime(now);
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

    // Manejar el cambio de método de pago (para mostrar el botón de PayPal)
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    paymentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const paypalContainer = document.getElementById('paypal-button-container');
        if (e.target.value === 'paypal') {
          if (paypalContainer) {
            paypalContainer.style.display = 'block';
            renderPayPalButton();
          }
          // Deshabilitar el botón de submit normal (usaremos el de PayPal)
          const btnSubmit = document.getElementById('btnConfirmOrder');
          if (btnSubmit) btnSubmit.style.display = 'none';
        } else {
          if (paypalContainer) {
            paypalContainer.style.display = 'none';
            paypalContainer.innerHTML = '';
            paypalRendered = false;
          }
          const btnSubmit = document.getElementById('btnConfirmOrder');
          if (btnSubmit) btnSubmit.style.display = 'block';
        }
      });
    });

    const form = document.getElementById('checkoutForm');
    form.addEventListener('submit', handleSubmit);
  }

  // --- LÓGICA DE PAYPAL SIMULADO ---
  function renderPayPalButton() {
    if (paypalRendered) return;
    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Simulamos la conversión a USD (ej: 6.96 Bs = 1 USD)
    const totalUSD = (total / 6.96).toFixed(2);

    // Botón de PayPal simulado (diseño real, sin API real)
    container.innerHTML = `
      <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 0.75rem; border: 1px solid #e2e8f0;">
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">
          Pago seguro con PayPal (Simulado)
        </p>
        <button type="button" id="btnSimulatePayPal" style="
          background: #0070ba; 
          color: white; 
          border: none; 
          padding: 0.75rem 2rem; 
          border-radius: 99px; 
          font-weight: 700; 
          font-size: 1rem; 
          cursor: pointer; 
          display: inline-flex; 
          align-items: center; 
          gap: 0.5rem;
          transition: background 0.2s;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
          Pagar Bs. ${total.toFixed(2)} (≈ $${totalUSD} USD)
        </button>
      </div>
    `;

    document.getElementById('btnSimulatePayPal').addEventListener('click', simulatePayPalPayment);
    paypalRendered = true;
  }

  async function simulatePayPalPayment() {
    const btn = document.getElementById('btnSimulatePayPal');
    btn.disabled = true;
    btn.textContent = 'Procesando pago...';

    // Simulamos un retraso de red (como si fuera real)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Crear el pedido con el método 'paypal'
    await createOrder('paypal');
  }

  // --- LÓGICA PRINCIPAL DE CREACIÓN DE PEDIDO ---
  async function handleSubmit(e) {
    e.preventDefault();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    
    if (paymentMethod === 'paypal') {
      // Si es PayPal, no hacemos nada aquí (el botón de PayPal maneja todo)
      return;
    }

    const btnSubmit = document.getElementById('btnConfirmOrder');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando pedido...';

    await createOrder(paymentMethod);
  }

  async function createOrder(paymentMethod) {
    const errorEl = document.getElementById('checkoutError');
    const btnSubmit = document.getElementById('btnConfirmOrder');
    errorEl.classList.add('hidden');

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value;
    const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
    const scheduleDate = document.getElementById('scheduleDate')?.value;
    const scheduleTime = document.getElementById('scheduleTime')?.value;
    const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';

    // Validaciones
    if (!deliveryType) return showError('Selecciona el tipo de entrega.');
    if (deliveryType === 'domicilio' && !deliveryAddress) return showError('Ingresa tu dirección.');
    if (!scheduleDate || !scheduleTime) return showError('Selecciona fecha y hora.');

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      const itemsJson = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        custom_notes: orderNotes || null
      }));

      console.log('Creando pedido con RPC:', { paymentMethod, total });

      const { data: orderId, error: rpcError } = await window.supabase.rpc('create_order_with_stock_check', {
        p_user_id: currentUser.id,
        p_delivery_type: deliveryType,
        p_delivery_address: deliveryType === 'domicilio' ? deliveryAddress : null,
        p_scheduled_time: scheduledDateTime,
        p_payment_method: paymentMethod,
        p_total: total,
        p_items: itemsJson
      });

      if (rpcError) {
        if (rpcError.message.includes('SOLD_OUT')) {
          throw new Error('Lo sentimos, uno de los productos se agotó mientras completabas tu pedido. Actualiza tu carrito.');
        }
        throw new Error(rpcError.message);
      }

      console.log('Pedido creado con ID:', orderId);

      // Si es QR, dejar en pendiente_pago; si es efectivo/tarjeta/paypal, confirmado
      if (paymentMethod === 'qr') {
        await window.supabase.from('orders').update({ status: 'pendiente_pago' }).eq('id', orderId);
      }

      localStorage.removeItem('dulcemania_cart');
      alert(`✅ ¡Pedido #${orderId} confirmado!\n\nTotal: Bs. ${total.toFixed(2)}\nMétodo: ${paymentMethod.toUpperCase()}`);
      window.location.replace(`/client/order-success.html?id=${orderId}`);

    } catch (err) {
      console.error('Error completo:', err);
      showError(err.message || 'Hubo un problema al procesar tu pedido.');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Confirmar Pedido';
      }
      const paypalBtn = document.getElementById('btnSimulatePayPal');
      if (paypalBtn) {
        paypalBtn.disabled = false;
        paypalBtn.textContent = `Pagar Bs. ${total.toFixed(2)}`;
      }
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