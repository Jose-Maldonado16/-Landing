/* ============================================
   CHECKOUT.JS — Crear pedido con reserva de stock
   (el stock se descuenta al confirmar pago)
   ============================================ */
(function() {
  let currentUser = null;
  let cart = [];
  let paypalRendered = false;

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = await window.guardPage(['client']);
    if (!profile) return;
    currentUser = profile;

    cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];
    if (cart.length === 0) {
      alert('Tu carrito está vacío. Redirigiendo al menú.');
      window.location.replace('/client/dashboard.html');
      return;
    }

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
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const fmtTime = (d) => {
      let h = d.getHours(), m = d.getMinutes();
      if (m < 30) m = 30; else { m = 0; h += 1; }
      if (h >= 24) h = 0;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    };

    const maxDate = new Date();
    maxDate.setDate(now.getDate() + 3);

    dateInput.min = fmtDate(now);
    dateInput.max = fmtDate(maxDate);
    dateInput.value = fmtDate(now);
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

    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const qrContainer = document.getElementById('qr-container');
    const paypalContainer = document.getElementById('paypal-button-container');
    const btnSubmit = document.getElementById('btnConfirmOrder');

    paymentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        qrContainer.style.display = 'none';
        paypalContainer.style.display = 'none';
        paypalContainer.innerHTML = '';
        paypalRendered = false;
        btnSubmit.style.display = 'block';

        if (val === 'qr') {
          qrContainer.style.display = 'block';
          generateQR();
        } else if (val === 'paypal') {
          paypalContainer.style.display = 'block';
          btnSubmit.style.display = 'none';
          renderPayPalButton();
        }
      });
    });

    generateQR();
    const form = document.getElementById('checkoutForm');
    form.addEventListener('submit', handleSubmit);
  }

  function generateQR() {
    const qrDiv = document.getElementById('qrcode');
    if (!qrDiv || typeof QRCode === 'undefined') return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('qrAmount').textContent = total.toFixed(2);

    qrDiv.innerHTML = '';
    const qrData = `DULCEMANIA-PAGO:${Date.now()}:${total.toFixed(2)}:${currentUser.id.substring(0,8)}`;

    new QRCode(qrDiv, {
      text: qrData, width: 200, height: 200,
      colorDark: '#0f172a', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  function renderPayPalButton() {
    if (paypalRendered) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalUSD = (total / 6.96).toFixed(2);

    if (typeof paypal === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://www.paypal.com/sdk/js?client-id=test&currency=USD';
      script.onload = () => renderPayPalButtons(totalUSD);
      document.body.appendChild(script);
    } else {
      renderPayPalButtons(totalUSD);
    }
    paypalRendered = true;
  }

  function renderPayPalButtons(totalUSD) {
    const container = document.getElementById('paypal-button-container');
    container.innerHTML = '';
    paypal.Buttons({
      createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: totalUSD } }] }),
      onApprove: async (data, actions) => {
        await actions.order.capture();
        await createOrder('paypal');
      },
      onError: (err) => {
        console.error('Error PayPal:', err);
        alert('El pago con PayPal falló o fue cancelado.');
      }
    }).render('#paypal-button-container');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (paymentMethod === 'paypal') return;

    const btnSubmit = document.getElementById('btnConfirmOrder');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando pedido...';

    await createOrder(paymentMethod);
  }

  async function createOrder(paymentMethod) {
    const errorEl = document.getElementById('checkoutError');
    errorEl.classList.add('hidden');

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value;
    const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
    const scheduleDate = document.getElementById('scheduleDate')?.value;
    const scheduleTime = document.getElementById('scheduleTime')?.value;
    const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';

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
        custom_notes: item.is_extra ? `Complemento para: ${item.parent_product}` : (orderNotes || null)
      }));

      // La función RPC valida stock, determina estado inicial y crea el pedido.
      // NO descuenta el stock (eso se hace cuando el cajero confirma el pago).
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
          throw new Error('Uno de los productos se agotó. Actualiza tu carrito.');
        }
        throw new Error(rpcError.message);
      }

      localStorage.removeItem('dulcemania_cart');
      alert(`✅ ¡Pedido #${orderId} confirmado!\n\nTotal: Bs. ${total.toFixed(2)}\nMétodo: ${paymentMethod.toUpperCase()}\n\n${paymentMethod === 'qr' || paymentMethod === 'efectivo' ? 'Espera a que el cajero confirme tu pago.' : 'Tu pedido ya está en preparación.'}`);
      window.location.replace(`/client/order-success.html?id=${orderId}`);

    } catch (err) {
      console.error('Error:', err);
      showError(err.message || 'Error al procesar el pedido.');
      const btnSubmit = document.getElementById('btnConfirmOrder');
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Confirmar Pedido'; }
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