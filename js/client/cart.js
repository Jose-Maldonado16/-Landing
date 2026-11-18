/* ============================================
   CART.JS — Carrito con soporte para complementos
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

  function saveCart() { localStorage.setItem('dulcemania_cart', JSON.stringify(cart)); }

  function addToCart(product) {
    const isExtra = product.is_extra === true;
    const existing = cart.find(i => i.product_id === product.id && i.is_extra === isExtra);
    const stockDisponible = product.stock || 0;
    
    if (existing) {
      if (existing.quantity >= stockDisponible) {
        alert(`Solo hay ${stockDisponible} unidades de ${product.name} disponibles.`);
        return;
      }
      existing.quantity += 1;
    } else {
      if (stockDisponible <= 0) {
        alert(`${product.name} está agotado.`);
        return;
      }
      cart.push({ 
        product_id: product.id, 
        name: product.name, 
        price: product.price, 
        image_url: product.image_url, 
        quantity: 1,
        stock_max: stockDisponible,
        is_extra: isExtra,
        parent_product: product.parent_product || null
      });
    }
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
      // Agrupar: primero productos principales, luego sus complementos
      const principales = cart.filter(i => !i.is_extra);
      const extras = cart.filter(i => i.is_extra);

      itemsContainer.innerHTML = principales.map(item => {
        const extrasDeEste = extras.filter(e => e.parent_product === item.name);
        
        return `
          <div class="cart-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <img src="${item.image_url}" class="cart-item-img" alt="${item.name}">
              <div class="cart-item-info" style="flex:1;">
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
            ${extrasDeEste.length > 0 ? `
              <div style="margin-left:2rem; margin-top:0.5rem; padding-left:0.75rem; border-left:2px solid var(--accent-500);">
                ${extrasDeEste.map(e => `
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">
                    <span>➕ ${e.name} (x${e.quantity})</span>
                    <span>Bs. ${(e.price * e.quantity).toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Extras huérfanos (sin producto principal)
      const extrasHuerfanos = extras.filter(e => !principales.some(p => p.name === e.parent_product));
      if (extrasHuerfanos.length > 0) {
        itemsContainer.innerHTML += `
          <div style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--border-dark);">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Complementos sueltos:</p>
            ${extrasHuerfanos.map(e => `
              <div class="cart-item">
                <div class="cart-item-info">
                  <p class="cart-item-title">${e.name}</p>
                  <p class="cart-item-price">Bs. ${e.price} c/u</p>
                </div>
                <button class="cart-item-remove" onclick="window.__removeItem(${e.product_id})">🗑️</button>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalEl.textContent = `Bs. ${total.toFixed(2)}`;
  }

  window.__changeQty = (id, delta) => {
    const item = cart.find(i => i.product_id === id);
    if (!item) return;
    
    if (delta > 0 && item.quantity >= (item.stock_max || 999)) {
      alert(`Solo hay ${item.stock_max} unidades disponibles.`);
      return;
    }
    
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.product_id !== id);
    }
    saveCart();
    updateCartUI();
  };
  
  window.__removeItem = (id) => {
    cart = cart.filter(i => i.product_id !== id);
    saveCart();
    updateCartUI();
  };
})();