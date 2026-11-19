/* ============================================
   CHECKOUT.JS — Con validación de horarios
   de atención + comprobante de pago
   ============================================ */
(function() {
  let currentUser = null;
  let cart = [];
  let paypalRendered = false;

  // --- HORARIOS DE ATENCIÓN ---
  const SCHEDULE = {
    0: [], // Domingo: cerrado
    1: [{ start: '08:00', end: '13:00' }, { start: '14:30', end: '20:00' }], // Lunes
    2: [{ start: '08:00', end: '13:00' }, { start: '14:30', end: '20:00' }], // Martes
    3: [{ start: '08:00', end: '13:00' }, { start: '14:30', end: '20:00' }], // Miércoles
    4: [{ start: '08:00', end: '13:00' }, { start: '14:30', end: '20:00' }], // Jueves
    5: [{ start: '08:00', end: '13:00' }, { start: '14:30', end: '20:00' }], // Viernes
    6: [{ start: '08:00', end: '14:00' }], // Sábado
  };

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
    initReceiptPreview();
  });

  // --- VERIFICAR SI UNA FECHA ESTÁ DENTRO DEL HORARIO ---
  function isWithinSchedule(date) {
    const day = date.getDay();
    const hours = SCHEDULE[day];
    if (!hours || hours.length === 0) return false;

    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    return hours.some(range => {
      return timeStr >= range.start && timeStr <= range.end;
    });
  }

  // --- OBTENER MENSAJE DE ERROR DE HORARIO ---
  function getScheduleErrorMessage(date) {
    const day = date.getDay();
    if (day === 0) return 'Los domingos estamos cerrados. Elige otro día.';
    if (day === 6) return 'Los sábados atendemos solo de 08:00 a 14:00.';
    return 'El horario es de Lunes a Viernes de 08:00 a 13:00 y de 14:30 a 20:00.';
  }

  // --- OBTENER PRÓXIMO HORARIO VÁLIDO ---
  function getNextValidSchedule() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);

    for (let i = 0; i < 7; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);

      if (i > 0) candidate.setHours(8, 0, 0, 0);

      const day = candidate.getDay();
      const ranges = SCHEDULE[day];
      if (!ranges || ranges.length === 0) continue;

      for (const range of ranges) {
        const [startH, startM] = range.start.split(':').map(Number);
        const [endH, endM] = range.end.split(':').map(Number);

        const startDate = new Date(candidate);
        startDate.setHours(startH, startM, 0, 0);

        const endDate = new Date(candidate);
        endDate.setHours(endH, endM, 0, 0);

        if (candidate < startDate) {
          return { date: startDate, valid: true };
        }
        if (candidate >= startDate && candidate <= endDate) {
          return { date: candidate, valid: true };
        }
      }
    }

    return { date: null, valid: false };
  }

  // --- FECHAS CON VALIDACIÓN DE HORARIOS ---
  function setDateLimits() {
    const dateInput = document.getElementById('scheduleDate');
    const timeInput = document.getElementById('scheduleTime');
    if (!dateInput || !timeInput) return;

    const nextValid = getNextValidSchedule();
    if (!nextValid.valid) {
      alert('No hay horarios disponibles próximamente.');
      return;
    }

    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const fmtTime = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(now.getDate() + 3);

    dateInput.min = fmtDate(now);
    dateInput.max = fmtDate(maxDate);
    dateInput.value = fmtDate(nextValid.date);
    timeInput.value = fmtTime(nextValid.date);

    dateInput.addEventListener('change', validateDateTime);
    timeInput.addEventListener('change', validateDateTime);
  }

  function validateDateTime() {
    const dateInput = document.getElementById('scheduleDate');
    const timeInput = document.getElementById('scheduleTime');
    const errorEl = document.getElementById('checkoutError');
    
    if (!dateInput.value || !timeInput.value) return;

    const selected = new Date(`${dateInput.value}T${timeInput.value}`);
    
    if (!isWithinSchedule(selected)) {
      errorEl.textContent = getScheduleErrorMessage(selected);
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  }

  // --- CALCULAR TOTAL ---
  function calcularTotal() {
    return cart.reduce((sum, item) => {
      const base = item.price * item.quantity;
      const extrasTotal = (item.extras || []).reduce((s, e) => s + (e.price * e.quantity * item.quantity), 0);
      return sum + base + extrasTotal;
    }, 0);
  }

  // --- RESUMEN ---
  function renderSummary() {
    const itemsContainer = document.getElementById('summaryItems');
    if (!itemsContainer) return;

    itemsContainer.innerHTML = cart.map(item => {
      const extrasHtml = (item.extras || []).map(e => {
        const totalExtras = e.quantity * item.quantity;
        return `
          <div style="margin-left:1.25rem; font-size:0.8rem; color:#94a3b8; display:flex; justify-content:space-between; margin-bottom:0.2rem;">
            <span>➕ ${e.name} (${e.quantity}x por unidad = ${totalExtras} total)</span>
            <span>Bs. ${(e.price * totalExtras).toFixed(2)}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="summary-item" style="flex-direction:column; align-items:stretch; margin-bottom:0.5rem;">
          <div style="display:flex; justify-content:space-between;">
            <span><span class="summary-item-qty">${item.quantity}x</span> ${item.name}</span>
            <span class="summary-item-price">Bs. ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          ${extrasHtml}
        </div>
      `;
    }).join('');

    const total = calcularTotal();
    document.getElementById('summarySubtotal').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = `Bs. ${total.toFixed(2)}`;
  }

  // --- FORMULARIO ---
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
    const receiptContainer = document.getElementById('receipt-container');
    const btnSubmit = document.getElementById('btnConfirmOrder');

    paymentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        qrContainer.style.display = 'none';
        paypalContainer.style.display = 'none';
        paypalContainer.innerHTML = '';
        receiptContainer.style.display = 'none';
        paypalRendered = false;
        btnSubmit.style.display = 'block';

        if (['qr', 'tarjeta', 'paypal'].includes(val)) {
          receiptContainer.style.display = 'block';
        }

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

    const currentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (['qr', 'tarjeta', 'paypal'].includes(currentMethod)) {
      document.getElementById('receipt-container').style.display = 'block';
    }
    if (currentMethod === 'qr') generateQR();

    document.getElementById('checkoutForm').addEventListener('submit', handleSubmit);
  }

  // --- PREVISUALIZAR COMPROBANTE ---
  function initReceiptPreview() {
    const receiptInput = document.getElementById('receiptInput');
    const receiptPreview = document.getElementById('receiptPreview');
    const receiptImg = document.getElementById('receiptImg');

    receiptInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          alert('El archivo debe ser una imagen (JPG, PNG, etc.)');
          receiptInput.value = '';
          receiptPreview.style.display = 'none';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert('La imagen no debe pesar más de 5MB');
          receiptInput.value = '';
          receiptPreview.style.display = 'none';
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          receiptImg.src = ev.target.result;
          receiptPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        receiptPreview.style.display = 'none';
      }
    });
  }

  // --- GENERAR QR ---
  function generateQR() {
    const qrDiv = document.getElementById('qrcode');
    if (!qrDiv || typeof QRCode === 'undefined') return;

    const total = calcularTotal();
    document.getElementById('qrAmount').textContent = total.toFixed(2);

    qrDiv.innerHTML = '';
    const qrData = `DULCEMANIA-PAGO:${Date.now()}:${total.toFixed(2)}:${currentUser.id.substring(0,8)}`;
    new QRCode(qrDiv, {
      text: qrData, width: 200, height: 200,
      colorDark: '#0f172a', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // --- PAYPAL ---
  function renderPayPalButton() {
    if (paypalRendered) return;
    const totalUSD = (calcularTotal() / 6.96).toFixed(2);

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
      onError: (err) => { console.error('Error PayPal:', err); alert('El pago falló.'); }
    }).render('#paypal-button-container');
  }

  // --- SUBIR COMPROBANTE ---
  async function uploadReceipt(file) {
    console.log('📤 Iniciando subida de comprobante...');
    console.log('Archivo:', file.name, '| Tipo:', file.type, '| Tamaño:', file.size, 'bytes');

    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen (JPG, PNG, etc.)');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('La imagen no debe pesar más de 5MB');
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `receipt-${currentUser.id}-${Date.now()}.${fileExt}`;

    try {
      const { data: uploadData, error: uploadError } = await window.supabase.storage
        .from('receipts')
        .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type });

      if (uploadError) {
        console.error('❌ Error de Storage:', uploadError);
        throw new Error('Error al subir imagen: ' + uploadError.message);
      }

      const { data: urlData } = window.supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (err) {
      console.error('❌ Error completo:', err);
      throw err;
    }
  }

  // --- SUBMIT ---
  async function handleSubmit(e) {
    e.preventDefault();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (paymentMethod === 'paypal') return;

    const btnSubmit = document.getElementById('btnConfirmOrder');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando pedido...';

    await createOrder(paymentMethod);
  }

  // --- CREAR ORDEN ---
  async function createOrder(paymentMethod) {
    const errorEl = document.getElementById('checkoutError');
    errorEl.classList.add('hidden');

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value;
    const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
    const scheduleDate = document.getElementById('scheduleDate')?.value;
    const scheduleTime = document.getElementById('scheduleTime')?.value;
    const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';
    const receiptInput = document.getElementById('receiptInput');

    if (!deliveryType) return showError('Selecciona el tipo de entrega.');
    if (deliveryType === 'domicilio' && !deliveryAddress) return showError('Ingresa tu dirección.');
    if (!scheduleDate || !scheduleTime) return showError('Selecciona fecha y hora.');

    // Validar horario de atención
    const selectedDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (!isWithinSchedule(selectedDateTime)) {
      return showError(getScheduleErrorMessage(selectedDateTime));
    }

    // Subir comprobante
    let receiptUrl = null;
    if (['qr', 'tarjeta', 'paypal'].includes(paymentMethod)) {
      if (!receiptInput || !receiptInput.files || receiptInput.files.length === 0) {
        return showError('Debes subir el comprobante de pago para continuar.');
      }
      try {
        receiptUrl = await uploadReceipt(receiptInput.files[0]);
        console.log('✅ Comprobante subido, URL:', receiptUrl);
      } catch (err) {
        return showError(err.message);
      }
    }

    const scheduledDateTime = selectedDateTime.toISOString();
    const total = calcularTotal();

    try {
      const itemsJson = [];
      cart.forEach(item => {
        itemsJson.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          custom_notes: orderNotes || null
        });
        (item.extras || []).forEach(extra => {
          itemsJson.push({
            product_id: extra.product_id,
            quantity: extra.quantity * item.quantity,
            unit_price: extra.price,
            custom_notes: `Complemento para: ${item.name} (${item.quantity}x)`
          });
        });
      });

      const { data: orderId, error: rpcError } = await window.supabase.rpc('create_order_with_stock_check', {
        p_user_id: currentUser.id,
        p_delivery_type: deliveryType,
        p_delivery_address: deliveryType === 'domicilio' ? deliveryAddress : null,
        p_scheduled_time: scheduledDateTime,
        p_payment_method: paymentMethod,
        p_total: total,
        p_items: itemsJson,
        p_receipt_url: receiptUrl
      });

      if (rpcError) {
        if (rpcError.message.includes('SOLD_OUT')) {
          throw new Error('Uno de los productos se agotó. Actualiza tu carrito.');
        }
        if (rpcError.message.includes('SCHEDULE_CLOSED')) {
          throw new Error(rpcError.message.replace('SCHEDULE_CLOSED: ', ''));
        }
        throw new Error(rpcError.message);
      }

      localStorage.removeItem('dulcemania_cart');
      localStorage.removeItem('dulcemania_cart_owner');
      alert(`✅ ¡Pedido #${orderId} confirmado!\n\nTotal: Bs. ${total.toFixed(2)}\nMétodo: ${paymentMethod.toUpperCase()}\n\n${receiptUrl ? 'Comprobante subido correctamente.' : 'Espera a que el cajero confirme tu pago.'}`);
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