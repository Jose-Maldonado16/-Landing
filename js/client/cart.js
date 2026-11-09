/* ============================================
   CART.JS — Lógica del carrito (Encapsulado)
   ============================================ */
(function() {
  let cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];

  document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    
    window.addEventListener('add-to-cart', (e) => addToCart(e.detail));

    const cartToggle = document.getElementById('cartToggle');
    const cartClose = document.getElementById('cartClose');
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');

    const openCart = () => {
      if(!cartSidebar || !cartOverlay) return;
      cartSidebar.classList.add('cart--open');
      cartOverlay.classList.remove('hidden');
      setTimeout(() => cartOverlay.classList.add('cart--open'), 10);
    };
    const closeCart = () => {
      if(!cartSidebar || !cartOverlay) return;
      cartSidebar.classList.remove('cart--open');
      cartOverlay.classList.remove('cart--open');
      setTimeout(() => cartOverlay.classList.add('hidden'), 300);
    };

    cartToggle?.addEventListener('click', openCart);
    cartClose?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);

    document.getElementById('btnCheckout')?.addEventListener('click', () => {
      if (cart.length === 0) return alert('Tu carrito está vacío.');
      window.location.href = '/client/checkout.html';
    });
  });

  function saveCart() {
    localStorage.setItem('dulcemania_cart', JSON.stringify(cart));
  }

  function addToCart(product) {
    const existing = cart.find(i => i.product_id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ 
        product_id: product.id, 
        name: product.name, 
        price: product.price, 
        image_url: product.image_url, 
        quantity: 1 
      });
    }
    saveCart();
    updateCartUI();
  }

  function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const itemsContainer = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    
    if (!badge || !itemsContainer || !totalEl) return; // Si no estamos en el dashboard, salir

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (totalItems > 0) { 
      badge.textContent = totalItems; 
      badge.classList.remove('hidden'); 
    } else { 
      badge.classList.add('hidden'); 
    }

    if (cart.length === 0) {
      itemsContainer.innerHTML = `<p style="text-align:center;color:#64748b;margin-top:2rem;">Tu carrito está vacío.</p>`;
    } else {
      itemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
          <img src="${item.image_url}" class="cart-item-img" alt="${item.name}">
          <div class="cart-item-info">
            <p class="cart-item-title">${item.name}</p>
            <p class="cart-item-price">Bs. ${item.price}</p>
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
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalEl.textContent = `Bs. ${total.toFixed(2)}`;
  }

  // Funciones globales para los botones inline
  window.__changeQty = (id, delta) => {
    const item = cart.find(i => i.product_id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.product_id !== id);
    saveCart();
    updateCartUI();
  };
  
  window.__removeItem = (id) => {
    cart = cart.filter(i => i.product_id !== id);
    saveCart();
    updateCartUI();
  };
})();