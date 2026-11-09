/* ============================================
   CART.JS — Lógica del carrito con localStorage
   ============================================ */

let cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  
  // Escuchar el evento de "Agregar al carrito" desde catalog.js
  window.addEventListener('add-to-cart', (e) => {
    addToCart(e.detail);
  });

  // UI del carrito
  const cartToggle = document.getElementById('cartToggle');
  const cartClose = document.getElementById('cartClose');
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');

  const openCart = () => {
    cartSidebar.classList.add('cart--open');
    cartOverlay.classList.remove('hidden');
    // Pequeño delay para la transición de opacidad
    setTimeout(() => cartOverlay.classList.add('cart--open'), 10);
  };

  const closeCart = () => {
    cartSidebar.classList.remove('cart--open');
    cartOverlay.classList.remove('cart--open');
    setTimeout(() => cartOverlay.classList.add('hidden'), 300);
  };

  cartToggle.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // Ir a pagar
  document.getElementById('btnCheckout').addEventListener('click', () => {
    if (cart.length === 0) {
      alert('Tu carrito está vacío. Agrega algo rico primero. 🍦');
      return;
    }
    // Guardamos en localStorage (ya se guarda en cada cambio) y redirigimos
    window.location.href = '/client/checkout.html';
  });
});

function saveCart() {
  localStorage.setItem('dulcemania_cart', JSON.stringify(cart));
}

function addToCart(product) {
  const existing = cart.find(item => item.product_id === product.id);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1,
    });
  }
  
  saveCart();
  updateCartUI();
  showToast(`${product.name} agregado 🛒`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product_id !== productId);
  saveCart();
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  
  item.quantity += delta;
  
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveCart();
    updateCartUI();
  }
}

function updateCartUI() {
  const badge = document.getElementById('cartBadge');
  const itemsContainer = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  
  // Actualizar badge
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Actualizar lista
  if (cart.length === 0) {
    itemsContainer.innerHTML = `<p style="text-align:center;color:var(--slate-500);margin-top:2rem;">Tu carrito está vacío.</p>`;
  } else {
    itemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <p class="cart-item-title">${item.name}</p>
          <p class="cart-item-price">Bs. ${item.price} c/u</p>
          <div class="cart-item-actions">
            <button class="cart-qty-btn" onclick="window.__changeQty(${item.product_id}, -1)">-</button>
            <span class="cart-qty">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="window.__changeQty(${item.product_id}, 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="window.__removeItem(${item.product_id})">🗑️</button>
      </div>
    `).join('');
  }

  // Actualizar total
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalEl.textContent = `Bs. ${total.toFixed(2)}`;
}

// Exponer funciones para los botones inline
window.__changeQty = changeQty;
window.__removeItem = removeFromCart;

// Toast notification simple
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: white; padding: 10px 20px; border-radius: 50px;
      font-size: 0.9rem; z-index: 300; opacity: 0; transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}