/**
 * GULF SOUQ — Client-Side Wishlist Manager & Renderer
 */
class GSWishlist {
  constructor() {
    this.STORAGE_KEY = 'gs_wishlist_items';
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateAllButtons();
    this.renderWishlistPage();
  }

  getWishlist() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error reading wishlist from localStorage', e);
      return [];
    }
  }

  saveWishlist(items) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('gs:wishlist:updated', { detail: { items } }));
    } catch (e) {
      console.error('Error saving wishlist to localStorage', e);
    }
  }

  isInWishlist(productId) {
    const items = this.getWishlist();
    return items.some(item => String(item.id) === String(productId));
  }

  toggle(productData) {
    let items = this.getWishlist();
    const existsIndex = items.findIndex(item => String(item.id) === String(productData.id));
    let isAdded = false;

    if (existsIndex > -1) {
      items.splice(existsIndex, 1);
      isAdded = false;
    } else {
      items.push({
        id: String(productData.id),
        variant_id: productData.variant_id ? String(productData.variant_id) : '',
        handle: productData.handle || '',
        title: productData.title || '',
        vendor: productData.vendor || '',
        price: productData.price || '',
        compare_at_price: productData.compare_at_price || '',
        image: productData.image || '',
        url: productData.url || '',
        available: productData.available !== undefined ? productData.available : true
      });
      isAdded = true;
    }

    this.saveWishlist(items);
    this.updateAllButtons();
    this.renderWishlistPage();
    return isAdded;
  }

  updateAllButtons() {
    const items = this.getWishlist();
    const itemIds = new Set(items.map(item => String(item.id)));

    document.querySelectorAll('.gs-wishlist-btn, [data-wishlist-id]').forEach(btn => {
      const pId = String(btn.dataset.productId || btn.dataset.wishlistId);
      if (!pId) return;

      const active = itemIds.has(pId);
      if (active) {
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        btn.setAttribute('aria-label', `Remove ${btn.dataset.productTitle || 'product'} from wishlist`);
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
        btn.setAttribute('aria-label', `Add ${btn.dataset.productTitle || 'product'} to wishlist`);
      }
    });

    // Update wishlist count in header if element exists
    document.querySelectorAll('.gs-wishlist-count').forEach(counter => {
      counter.textContent = items.length;
      counter.style.display = items.length > 0 ? 'inline-flex' : 'none';
    });
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.gs-wishlist-btn, [data-wishlist-btn]');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const productData = {
        id: btn.dataset.productId,
        variant_id: btn.dataset.variantId,
        handle: btn.dataset.productHandle,
        title: btn.dataset.productTitle,
        vendor: btn.dataset.productVendor,
        price: btn.dataset.productPrice,
        compare_at_price: btn.dataset.productCompareAtPrice,
        image: btn.dataset.productImage,
        url: btn.dataset.productUrl,
        available: btn.dataset.productAvailable !== 'false'
      };

      if (!productData.id) return;

      const isAdded = this.toggle(productData);

      // Micro-animation visual feedback
      btn.style.transform = 'scale(1.25)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 200);
    });

    window.addEventListener('gs:wishlist:updated', () => {
      this.updateAllButtons();
    });
  }

  renderWishlistPage() {
    const container = document.getElementById('gs-wishlist-container');
    if (!container) return;

    const items = this.getWishlist();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="gs-wishlist-empty">
          <h3>Your wishlist is empty</h3>
          <p>Save products you love by tapping the heart icon while browsing.</p>
          <a href="/collections/all" class="gs-btn-continue">Continue Shopping</a>
        </div>
      `;
      return;
    }

    let cardsHtml = items.map(item => `
      <div class="gs-card product-card gs-card-wrapper" data-product-id="${item.id}">
        <div class="gs-card-media">
          <button class="gs-wishlist-btn active" 
                  aria-label="Remove from wishlist" 
                  aria-checked="true"
                  data-product-id="${item.id}"
                  data-product-title="${item.title}">
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
          <a href="${item.url || '#'}">
            <img src="${item.image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1.png'}" 
                 alt="${item.title}" 
                 loading="lazy" 
                 class="primary-img">
          </a>
        </div>
        <div class="gs-card-content">
          ${item.vendor ? `<p class="gs-card-vendor">${item.vendor}</p>` : ''}
          <h3 class="gs-card-title">
            <a href="${item.url || '#'}">${item.title}</a>
          </h3>
          <div class="gs-card-price-wrap">
            <span class="gs-price-current">${item.price || ''}</span>
            ${item.compare_at_price ? `<span class="gs-price-compare">${item.compare_at_price}</span>` : ''}
          </div>
          <div class="gs-card-actions">
            ${item.available ? `
              <button class="gs-add-cart-btn gs-ajax-add-btn" 
                      data-variant-id="${item.variant_id || ''}" 
                      data-product-handle="${item.handle}">
                <span>+ ADD TO CART</span>
              </button>
            ` : `
              <button class="gs-add-cart-btn disabled" disabled>
                OUT OF STOCK
              </button>
            `}
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="gs-product-grid">
        ${cardsHtml}
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.gsWishlist = new GSWishlist();
});
