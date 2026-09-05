/**
 * GULF SOUQ — AJAX Cart & Quick Variant Add Modal & Side Cart Drawer Controller
 * Ensures header cart icon and Add to Cart triggers open the side cart drawer reliably.
 */
(function() {
  // Ensure async panels CSS is loaded
  function ensurePanelsCss() {
    if (!document.getElementById('css-panels')) {
      const link = document.createElement('link');
      link.id = 'css-panels';
      link.rel = 'stylesheet';
      link.href = (window.filepaths && window.filepaths.async_panels_css) || '/cdn/shop/t/29/assets/async-panels.css';
      document.head.appendChild(link);
    }
  }

  // Open the side cart drawer
  window.openGulfSouqCart = async function() {
    const sideCart = document.getElementById('cart');
    if (!sideCart) {
      window.location.href = window.routes?.cart_url || '/cart';
      return;
    }

    ensurePanelsCss();

    // Visual open state immediately
    document.documentElement.classList.add('has-panels', 'm6pn-open');
    sideCart.classList.add('toggle');
    sideCart.setAttribute('aria-hidden', 'false');

    // Ensure close button exists
    if (!sideCart.querySelector('.m6pn-close')) {
      const closeBtn = document.createElement('a');
      closeBtn.href = './';
      closeBtn.className = 'm6pn-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = 'Close';
      sideCart.appendChild(closeBtn);
    }

    // Fetch and sync latest side-cart markup
    try {
      const rootUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || window.routes?.root_url || '/';
      const cleanRoot = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';
      const res = await fetch(cleanRoot + '?section_id=side-cart');
      if (res.ok) {
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const markup = doc.querySelector('#shopify-section-side-cart')?.innerHTML;
        if (markup) {
          sideCart.innerHTML = markup;
          if (!sideCart.querySelector('.m6pn-close')) {
            const closeBtn = document.createElement('a');
            closeBtn.href = './';
            closeBtn.className = 'm6pn-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.textContent = 'Close';
            sideCart.appendChild(closeBtn);
          }
          if (typeof ajaxCart !== 'undefined' && typeof ajaxCart.init === 'function') {
            ajaxCart.init();
          }
          window.dispatchEvent(new CustomEvent('recommendedProducts'));
        }
      }
    } catch (err) {
      console.warn('Error fetching side-cart markup:', err);
    }

    window.dispatchEvent(new CustomEvent('recommendedProducts'));
    window.dispatchEvent(new CustomEvent('themeCartOpened'));
  };

  // Close the side cart drawer
  window.closeGulfSouqCart = function() {
    document.documentElement.classList.remove('has-panels', 'm6pn-open');
    const sideCart = document.getElementById('cart');
    if (sideCart) {
      sideCart.classList.remove('toggle');
      sideCart.setAttribute('aria-hidden', 'true');
    }
  };

  function updateCartCounters(cart) {
    const count = cart.item_count !== undefined ? cart.item_count : 0;
    document.querySelectorAll('#cart-count, #cart-count--m, .cart-count, [data-cart-count]').forEach(el => {
      el.textContent = count;
      el.style.display = 'inline-flex';
    });

    const isCartPage = window.location.pathname.endsWith('/cart') || window.location.pathname.includes('/cart');
    if (!isCartPage) {
      // Open side-cart drawer
      window.openGulfSouqCart();
    } else {
      // When on the cart page, reload smoothly after giving visual button feedback
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }

    // Dispatch custom events for theme listeners
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
    document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { cart } }));
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
      if (initialVariantId) {
        addToCart(initialVariantId, 1, buttonElement);
      }
    }
  }

  // Global Event Listener for Cart Trigger Clicks
  document.addEventListener('click', function(e) {
    const cartTrigger = e.target.closest('a[data-panel="cart"], .gs-cart-btn, .js-cart-drawer-trigger');
    if (cartTrigger) {
      e.preventDefault();
      e.stopPropagation();
      window.openGulfSouqCart();
      return;
    }

    // Close buttons
    if (e.target.closest('.overlay-close, .overlay-close-clipping, .m6pn-close, .gs-cart-close')) {
      window.closeGulfSouqCart();
      e.preventDefault();
      return;
    }

    // Remove item from side-cart drawer
    const removeBtn = e.target.closest('.gs-drawer-remove-btn, .remove-from-cart-link');
    if (removeBtn && removeBtn.closest('#cart')) {
      e.preventDefault();
      e.stopPropagation();
      const line = removeBtn.dataset.line;
      const row = removeBtn.closest('.gs-drawer-item-row');
      if (line) {
        changeCartItemQty(line, 0, row);
      }
      return;
    }

    // Quantity Stepper buttons (+ / -)
    const qtyBtn = e.target.closest('.gs-qty-btn');
    if (qtyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const stepper = qtyBtn.closest('.gs-qty-stepper');
      if (!stepper) return;
      const input = stepper.querySelector('input[type="number"]');
      if (!input) return;

      const isPlus = qtyBtn.classList.contains('gs-qty-plus');
      const currentVal = parseInt(input.value) || 1;
      const step = parseInt(input.step) || 1;
      const min = parseInt(input.min) !== undefined && !isNaN(parseInt(input.min)) ? parseInt(input.min) : 0;
      const max = parseInt(input.max) || 99999;

      let newVal = isPlus ? (currentVal + step) : (currentVal - step);
      if (newVal < min) newVal = min;
      if (newVal > max) newVal = max;

      input.value = newVal;
      
      // Trigger change event for listeners (like custom-async.js on cart page)
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // If inside side-cart drawer, directly sync side cart markup
      if (qtyBtn.closest('#cart')) {
        const line = input.dataset.line;
        const row = qtyBtn.closest('.gs-drawer-item-row');
        if (line) {
          changeCartItemQty(line, newVal, row);
        }
      }
      return;
    }

    // Handle Select Options navigation
    const selectOptBtn = e.target.closest('.gs-select-options-btn');
    if (selectOptBtn) {
      const targetHref = selectOptBtn.getAttribute('href');
      if (targetHref) {
        window.location.href = targetHref;
        return;
      }
    }

    // AJAX Add-to-cart buttons
    const addBtn = e.target.closest('.gs-ajax-add-btn');
    if (addBtn) {
      const variantId = addBtn.dataset.variantId;
      const handle = addBtn.dataset.productHandle;
      const hasVariants = addBtn.dataset.hasVariants === 'true';

      if (hasVariants) {
        const targetUrl = addBtn.getAttribute('href') || (handle ? `/products/${handle}` : null);
        if (targetUrl) {
          window.location.href = targetUrl;
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();

      if (variantId) {
        addToCart(variantId, 1, addBtn);
      }
    }
  });

  async function changeCartItemQty(line, quantity, rowEl = null) {
    if (rowEl) {
      rowEl.style.opacity = '0.4';
      rowEl.style.pointerEvents = 'none';
      rowEl.style.transition = 'opacity 0.2s ease';
    }
    const rootUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || window.routes?.root_url || '/';
    const cleanRoot = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';
    try {
      const res = await fetch(cleanRoot + 'cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ line: parseInt(line), quantity: parseInt(quantity), sections: 'side-cart' })
      });
      if (res.ok) {
        const data = await res.json();
        const sideCart = document.getElementById('cart');
        let markup = '';
        if (data.sections && data.sections['side-cart']) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(data.sections['side-cart'], 'text/html');
          markup = doc.querySelector('#shopify-section-side-cart')?.innerHTML || doc.body.innerHTML;
        } else {
          const fallbackRes = await fetch(cleanRoot + '?section_id=side-cart');
          if (fallbackRes.ok) {
            const fallbackText = await fallbackRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(fallbackText, 'text/html');
            markup = doc.querySelector('#shopify-section-side-cart')?.innerHTML || doc.body.innerHTML;
          }
        }
        if (sideCart && markup) {
          sideCart.innerHTML = markup;
          if (!sideCart.querySelector('.m6pn-close')) {
            const closeBtn = document.createElement('a');
            closeBtn.href = './';
            closeBtn.className = 'm6pn-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.textContent = 'Close';
            sideCart.appendChild(closeBtn);
          }
          if (typeof ajaxCart !== 'undefined' && typeof ajaxCart.init === 'function') {
            ajaxCart.init();
          }
          window.dispatchEvent(new CustomEvent('recommendedProducts'));
        }
        if (typeof data.item_count !== 'undefined') {
          document.querySelectorAll('#cart-count, #cart-count--m, .cart-count, [data-cart-count]').forEach(el => {
            el.textContent = data.item_count;
            el.style.display = data.item_count > 0 ? 'inline-flex' : 'none';
          });
        }
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: data } }));
        document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { cart: data } }));
      } else {
        if (rowEl) {
          rowEl.style.opacity = '1';
          rowEl.style.pointerEvents = '';
        }
      }
    } catch (err) {
      console.warn('changeCartItemQty error:', err);
      if (rowEl) {
        rowEl.style.opacity = '1';
        rowEl.style.pointerEvents = '';
      }
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.closeGulfSouqCart();
    }
  });

  // Pre-fetch side-cart section markup and panels CSS on idle
  function warmCartDrawer() {
    ensurePanelsCss();
    const sideCart = document.getElementById('cart');
    if (!sideCart || (sideCart.querySelector('header') && sideCart.children.length > 1)) return;
    
    const rootUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || window.routes?.root_url || '/';
    const cleanRoot = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';
    fetch(cleanRoot + '?section_id=side-cart')
      .then(res => res.text())
      .then(text => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const markup = doc.querySelector('#shopify-section-side-cart')?.innerHTML;
        if (markup && !sideCart.classList.contains('toggle')) {
          sideCart.innerHTML = markup;
          if (!sideCart.querySelector('.m6pn-close')) {
            const closeBtn = document.createElement('a');
            closeBtn.href = './';
            closeBtn.className = 'm6pn-close';
            closeBtn.setAttribute('aria-label', 'Close');
            sideCart.appendChild(closeBtn);
          }
        }
      })
      .catch(() => {});
  }

  // =========================================================================
  // GULF SOUQ: "You May Also Like" Carousel Controller
  // =========================================================================
  function updateDrawerUpsellNavButtons() {
    const upsellWrap = document.querySelector('#cart .gs-drawer-upsell-wrap, .cart-upsell');
    if (!upsellWrap) return;

    const track = upsellWrap.querySelector('.gs-upsell-carousel, .gs-drawer-upsell-list, ul.l4ca');
    const prevBtn = upsellWrap.querySelector('.gs-upsell-prev-btn');
    const nextBtn = upsellWrap.querySelector('.gs-upsell-next-btn');
    const navControls = upsellWrap.querySelector('.gs-upsell-nav-controls');

    if (!track) return;

    const canScroll = track.scrollWidth > track.clientWidth + 4;
    if (navControls) {
      if (!canScroll) {
        navControls.style.display = 'none';
      } else {
        navControls.style.display = '';
      }
    }

    if (prevBtn) {
      prevBtn.disabled = track.scrollLeft <= 3;
    }
    if (nextBtn) {
      const isEnd = (track.scrollLeft + track.clientWidth) >= (track.scrollWidth - 6);
      nextBtn.disabled = isEnd;
    }
  }

  function scrollDrawerUpsellCarousel(direction) {
    const upsellWrap = document.querySelector('#cart .gs-drawer-upsell-wrap, .cart-upsell');
    if (!upsellWrap) return;

    const track = upsellWrap.querySelector('.gs-upsell-carousel, .gs-drawer-upsell-list, ul.l4ca');
    if (!track) return;

    // Scroll by exactly one product card width + gap (12px)
    const firstItem = track.querySelector('li');
    const step = firstItem ? (firstItem.offsetWidth + 12) : 168;

    track.scrollBy({
      left: direction === 'next' ? step : -step,
      behavior: 'smooth'
    });

    setTimeout(updateDrawerUpsellNavButtons, 350);
  }

  // Delegated click handler for prev/next buttons
  document.addEventListener('click', function(e) {
    const prevBtn = e.target.closest('.gs-upsell-prev-btn');
    if (prevBtn) {
      e.preventDefault();
      scrollDrawerUpsellCarousel('prev');
      return;
    }

    const nextBtn = e.target.closest('.gs-upsell-next-btn');
    if (nextBtn) {
      e.preventDefault();
      scrollDrawerUpsellCarousel('next');
      return;
    }
  });

  // Attach scroll listeners to the carousel track
  function bindDrawerUpsellScrollListener() {
    const track = document.querySelector('#cart .gs-upsell-carousel, #cart .gs-drawer-upsell-list, #cart ul.l4ca');
    if (track && !track.dataset.navBound) {
      track.dataset.navBound = 'true';
      let scrollTimer = null;
      track.addEventListener('scroll', function() {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(updateDrawerUpsellNavButtons, 60);
      }, { passive: true });
    }
    updateDrawerUpsellNavButtons();
  }

  window.addEventListener('recommendedProducts', function() {
    setTimeout(bindDrawerUpsellScrollListener, 200);
  });
  window.addEventListener('themeCartOpened', function() {
    setTimeout(bindDrawerUpsellScrollListener, 200);
  });
  document.addEventListener('cart:updated', function() {
    setTimeout(bindDrawerUpsellScrollListener, 200);
  });
  window.addEventListener('resize', function() {
    updateDrawerUpsellNavButtons();
  });

  // Global Cart Checkout Button Trigger Handler (Cart Page & Drawer)
  document.addEventListener('click', function(e) {
    const checkoutBtn = e.target.closest('.gs-checkout-main-btn, .gs-sticky-checkout-btn, .gs-cart-checkout-btn');
    if (!checkoutBtn) return;

    // Check for terms and conditions if present on cart page
    const termsCheckbox = document.querySelector('.gs-terms-checkbox-wrap input[type="checkbox"][required]');
    if (termsCheckbox && !termsCheckbox.checked) {
      e.preventDefault();
      termsCheckbox.focus();
      try {
        termsCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        termsCheckbox.reportValidity();
      } catch (err) {}
      return;
    }

    const form = checkoutBtn.form || checkoutBtn.closest('form') || document.querySelector('.gs-cart-checkout-form');
    if (form) {
      const checkoutUrl = (window.routes?.root_url || '/').replace(/\/$/, '') + '/checkout';
      form.action = checkoutUrl;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(warmCartDrawer);
      else setTimeout(warmCartDrawer, 300);
      setTimeout(bindDrawerUpsellScrollListener, 500);
    });
  } else {
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmCartDrawer);
    else setTimeout(warmCartDrawer, 300);
    setTimeout(bindDrawerUpsellScrollListener, 500);
  }
})();
