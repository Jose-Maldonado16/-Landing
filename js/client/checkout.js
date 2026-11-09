/* ============================================
   CHECKOUT.JS — Crear pedido en Supabase
   ============================================ */
let currentUser = null;
let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Proteger página
  const profile = await window.guardPage(['client']);
  if (!profile) return;
  currentUser = profile;

  // 2. Cargar carrito del localStorage
  cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];
  
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Redirigiendo al menú.');
    window.location.replace('/client/dashboard.html');
    return;
  }

  // 3. Renderizar resumen
  renderSummary();

  // 4. Configurar formulario
  initForm();
  
  // 5. Fechas: limitar a hoy y máximo +3 días
  setDateLimits();
});

function renderSummary() {
  const itemsContainer = document.getElementById('summaryItems');
  
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
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 3); // Máximo 3 días

  const fmt = (d) => d.toISOString().split('T')[0];
  dateInput.min = fmt(today);
  dateInput.max = fmt(maxDate);
  dateInput.value = fmt(today);
}

function initForm() {
  // Mostrar/ocultar campo de dirección según tipo de entrega
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

  // Enviar formulario
  const form = document.getElementById('checkoutForm');
  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const errorEl = document.getElementById('checkoutError');
  const btnSubmit = document.getElementById('btnConfirmOrder');
  errorEl.classList.add('hidden');

  // 1. Recopilar datos
  const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
  const scheduleDate = document.getElementById('scheduleDate').value;
  const scheduleTime = document.getElementById('scheduleTime').value;
  const orderNotes = document.getElementById('orderNotes').value.trim();

  // 2. Validaciones
  if (deliveryType === 'domicilio' && !deliveryAddress) {
    return showError('Por favor, ingresa tu dirección de entrega.');
  }
  if (!scheduleDate || !scheduleTime) {
    return showError('Selecciona una fecha y hora para tu pedido.');
  }

  const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // 3. UI Loading
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Procesando...';

  try {
    // 4. Insertar en 'orders'
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

    if (orderError) throw orderError;

    // 5. Insertar en 'order_items'
    const orderItems = cart.map(item => ({
      order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      custom_notes: orderNotes || null,
    }));

    const { error: itemsError } = await window.supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // 6. Vaciar carrito
    localStorage.removeItem('dulcemania_cart');

    // 7. Éxito: redirigir a confirmación
    window.location.replace(`/client/order-success.html?id=${orderData.id}`);

  } catch (err) {
    console.error('Error al crear pedido:', err);
    showError(err.message || 'Hubo un problema al procesar tu pedido. Intenta de nuevo.');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Confirmar Pedido';
  }
}

function showError(msg) {
  const errorEl = document.getElementById('checkoutError');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}