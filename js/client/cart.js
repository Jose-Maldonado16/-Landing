/* ============================================
   CART.JS — Carrito con validación de dueño
   y soporte para extras anidados
   ============================================ */
(function() {
  let cart = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar dueño del carrito
    const { data: { session } } = await window.supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    const cartOwner = localStorage.getItem('dulcemania_cart_owner');

    if (cartOwner && currentUserId && cartOwner !== currentUserId) {
      // El carrito es de otro usuario: limpiar
      console.log('Carrito de otro usuario detectado. Limpiando...');
      localStorage.removeItem('dulcemania_cart');
      localStorage.removeItem('dulcemania_cart_owner');
      cart = [];
    } else {
      cart = JSON.parse(localStorage.getItem('dulcemania_cart')) || [];
    }

    // 2. Guardar dueño actual
    if (currentUserId) {
      localStorage.setItem('dulcemania_cart_owner', currentUserId);
    }

    // 3. Setup UI
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
    // Guardar dueño actual
    window.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        localStorage.setItem('dulcemania_cart_owner', session.user.id);
      }
    });
  }

  function generateCartItemId() {
    return `cart_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  function addToCart(product) {
    const isExtra = product.is_extra === true;
    const parentCartItemId = product.parent_cart_item_id || null;
    const stockDisponible = product.stock || 0;

    if (isExtra) {
      // Es un complemento
      const parentItem = cart.find(i => i.cart_item_id === parentCartItemId);
      if (!parentItem) {
        alert('No se encontró el producto principal para este complemento.');
        return;
      }

      if (stockDisponible <= 0) {
        alert(`${product.name} está agotado.`);
        return;
      }

      if (!parentItem.extras) parentItem.extras = [];
      
      const existingExtra = parentItem.extras.find(e => e.product_id === product.id);
      if (existingExtra) {
        existingExtra.quantity += 1;
      } else {
        parentItem.extras.push({
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          stock_max: stockDisponible
        });
      }

      saveCart();
      updateCartUI();
      return;
    }

    // Producto principal
    if (stockDisponible <= 0) {
      alert(`${product.name} está agotado.`);
      return;
    }

    cart.push({
      cart_item_id: generateCartItemId(),
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1,
      stock_max: stockDisponible,
      extras: []
    });

    saveCart();
    updateCartUI();
  }

  function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const itemsContainer = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!badge || !itemsContainer || !totalEl) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (totalItems > 0) { badge.textContent = totalItems; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }

    if (cart.length === 0) {
      itemsContainer.innerHTML = `<p style="text-align:center;color:#64748b;margin-top:2rem;">Tu carrito está vacío.</p>`;
    } else {
      itemsContainer.innerHTML = cart.map(item => {
        const extrasHtml = (item.extras && item.extras.length > 0)
          ? `
            <div style="margin-left:1rem; margin-top:0.5rem; padding-left:0.75rem; border-left:2px solid var(--accent-500);">
              ${item.extras.map(e => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">
                  <span>➕ ${e.name} (x${e.quantity})</span>
                  <span>Bs. ${(e.price * e.quantity).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          `
          : '';

        return `
          <div class="cart-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <img src="${item.image_url}" class="cart-item-img" alt="${item.name}">
              <div class="cart-item-info" style="flex:1;">
                <p class="cart-item-title">${item.name}</p>
                <p class="cart-item-price">Bs. ${item.price} c/u</p>
                <div class="cart-item-actions">
                  <button class="cart-qty-btn" onclick="window.__changeQty('${item.cart_item_id}', -1)">-</button>
                  <span class="cart-qty">${item.quantity}</span>
                  <button class="cart-qty-btn" onclick="window.__changeQty('${item.cart_item_id}', 1)">+</button>
                </div>
              </div>
              <button class="cart-item-remove" onclick="window.__removeItem('${item.cart_item_id}')">🗑️</button>
            </div>
            ${extrasHtml}
          </div>
        `;
      }).join('');
    }

    // Total con extras
    const total = cart.reduce((sum, item) => {
      const base = item.price * item.quantity;
      const extrasTotal = (item.extras || []).reduce((s, e) => s + (e.price * e.quantity), 0);
      return sum + base + extrasTotal;
    }, 0);
    totalEl.textContent = `Bs. ${total.toFixed(2)}`;
  }

  window.__changeQty = (cartItemId, delta) => {
    const item = cart.find(i => i.cart_item_id === cartItemId);
    if (!item) return;
    
    if (delta > 0 && item.quantity >= (item.stock_max || 999)) {
      alert(`Solo hay ${item.stock_max} unidades disponibles.`);
      return;
    }
    
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.cart_item_id !== cartItemId);
    }
    saveCart();
    updateCartUI();
  };
  
  window.__removeItem = (cartItemId) => {
    cart = cart.filter(i => i.cart_item_id !== cartItemId);
    saveCart();
    updateCartUI();
  };
})();