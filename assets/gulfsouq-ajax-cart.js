/**
 * GULF SOUQ — AJAX Cart & Quick Variant Add Modal
 * Ensures Add to Cart opens Cart Drawer directly or redirects to /cart, never to Product Page.
 */
(function() {
  function updateCartCounters(cart) {
    const count = cart.item_count !== undefined ? cart.item_count : 0;
    document.querySelectorAll('#cart-count, #cart-count--m, .cart-count, [data-cart-count]').forEach(el => {
      el.textContent = count;
      el.style.display = 'inline-flex';
    });

    // 1. Try triggering theme side-cart drawer
    const drawerTrigger = document.querySelector('a[data-panel="cart"], .js-cart-drawer-trigger, #cart-icon-bubble, .header__icon--cart');
    if (drawerTrigger && typeof drawerTrigger.click === 'function') {
      drawerTrigger.click();
    }

    // 2. Dispatch custom events for theme listeners
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
    document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { cart } }));

    // 3. Direct to /cart if side-cart panel does not open
    setTimeout(() => {
      const isDrawerOpen = document.body.classList.contains('cart-drawer-open') ||
                           document.body.classList.contains('panel-open') ||
                           document.querySelector('#side-cart.active, .side-cart.active, [data-side-cart].active, .panel-cart.active, [aria-expanded="true"]');
      if (!isDrawerOpen) {
        window.location.href = '/cart';
      }
    }, 450);
  }

  async function addToCart(variantId, quantity = 1, buttonElement = null) {
    if (!variantId) return;

    let originalHtml = '';
    if (buttonElement) {
      originalHtml = buttonElement.innerHTML;
      buttonElement.disabled = true;
      buttonElement.innerHTML = `<span>ADDING...</span>`;
    }

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          items: [{
            id: Number(variantId),
            quantity: Number(quantity)
          }]
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (buttonElement) {
          buttonElement.classList.add('added');
          buttonElement.innerHTML = `<span>ADDED ✓</span>`;
          setTimeout(() => {
            buttonElement.classList.remove('added');
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalHtml;
          }, 1500);
        }

        // Fetch fresh cart state & update header counters / open cart
        const cartResponse = await fetch('/cart.js');
        const cart = await cartResponse.json();
        updateCartCounters(cart);
      } else {
        alert(data.description || 'Could not add product to cart.');
        if (buttonElement) {
          buttonElement.disabled = false;
          buttonElement.innerHTML = originalHtml;
        }
      }
    } catch (e) {
      console.error('Error adding to cart:', e);
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalHtml;
      }
    }
  }

  // Quick Variant Add Modal Handler (No Product Page Redirects)
  async function openQuickAddModal(handle, initialVariantId, buttonElement) {
    if (!handle) return;

    try {
      const response = await fetch(`/products/${handle}.js`);
      const product = await response.json();

      let modalBackdrop = document.getElementById('gs-quick-modal');
      if (!modalBackdrop) {
        modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'gs-quick-modal';
        modalBackdrop.className = 'gs-modal-backdrop';
        document.body.appendChild(modalBackdrop);
      }

      const availableVariants = product.variants.filter(v => v.available);
      if (availableVariants.length === 0) {
        alert('This product is currently out of stock.');
        return;
      }

      const variantOptionsHtml = availableVariants.map(v => `
        <option value="${v.id}" ${String(v.id) === String(initialVariantId) ? 'selected' : ''}>
          ${v.title} — ${(v.price / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        </option>
      `).join('');

      modalBackdrop.innerHTML = `
        <div class="gs-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="gs-modal-product-title">
          <button type="button" class="gs-modal-close" aria-label="Close modal">&times;</button>
          <div class="gs-modal-header">
            <img src="${product.featured_image || ''}" alt="${product.title}" class="gs-modal-img">
            <div>
              <h3 id="gs-modal-product-title" class="gs-modal-title">${product.title}</h3>
              <p class="gs-price-current" id="gs-modal-price">
                ${(availableVariants[0].price / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
              </p>
            </div>
          </div>
          <div class="gs-modal-variants">
            <label for="gs-modal-select" style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase;">Select Variant Option:</label>
            <select id="gs-modal-select" class="gs-modal-variant-select">
              ${variantOptionsHtml}
            </select>
          </div>
          <button type="button" id="gs-modal-submit-btn" class="gs-add-cart-btn">
            + ADD TO CART
          </button>
        </div>
      `;

      modalBackdrop.classList.add('active');

      const closeBtn = modalBackdrop.querySelector('.gs-modal-close');
      const submitBtn = modalBackdrop.querySelector('#gs-modal-submit-btn');
      const selectEl = modalBackdrop.querySelector('#gs-modal-select');

      const closeModal = () => {
        modalBackdrop.classList.remove('active');
      };

      closeBtn.addEventListener('click', closeModal);
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });

      submitBtn.addEventListener('click', async () => {
        const selectedVariantId = selectEl.value;
        closeModal();
        await addToCart(selectedVariantId, 1, buttonElement);
      });

    } catch (e) {
      console.error('Error fetching product variant details:', e);
      // Fallback direct add if variant ID present
      if (initialVariantId) {
        addToCart(initialVariantId, 1, buttonElement);
      }
    }
  }

  // Global Event Listener for AJAX Cart & Quick Add Buttons
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.gs-ajax-add-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const variantId = btn.dataset.variantId;
    const handle = btn.dataset.productHandle;
    const hasVariants = btn.dataset.hasVariants === 'true';

    if (hasVariants && handle) {
      openQuickAddModal(handle, variantId, btn);
    } else if (variantId) {
      addToCart(variantId, 1, btn);
    }
  });
})();
