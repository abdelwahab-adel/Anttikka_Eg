/* ==========================================================================
   Anttikka (Anttikka) — main.js
   Header scroll state, mobile nav, category tab product grid, scroll reveal
   ========================================================================== */

/* ---------- Broken image fallback (site-wide, catches dynamic images too) ----------
   Registered immediately (not inside DOMContentLoaded) so it also catches images
   whose requests fail before the DOM-ready event fires. Uses the capturing phase
   because the native "error" event does not bubble. */
(function () {
  var FALLBACK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#F0EBE2"/>' +
      '<g fill="none" stroke="#C9BFAF" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">' +
        '<rect x="85" y="105" width="230" height="190" rx="12"/>' +
        '<circle cx="148" cy="163" r="20"/>' +
        '<path d="M85 268l65-66 45 45 65-66 65 66"/>' +
      '</g>' +
    '</svg>';
  var FALLBACK_SRC = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(FALLBACK_SVG);

  function handleImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.src = FALLBACK_SRC;
    img.style.objectFit = 'cover';
  }
  document.addEventListener('error', handleImgError, true);
})();

/* ==========================================================================
   CART + WHATSAPP CHECKOUT
   Cart is persisted in localStorage so it survives navigation between pages.
   Checkout does not go through a payment backend — it opens WhatsApp with a
   pre-filled message containing the product details, quantities, discounts
   and total, so the store owner receives the order directly on WhatsApp.
   ========================================================================== */
window.AnttikkaCart = (function () {
  var STORAGE_KEY = 'Anttikka_cart_v1';
  /* Store's WhatsApp number, international format, no + or spaces */
  var STORE_WHATSAPP_NUMBER = '201068300432';

  function getCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var cart = raw ? JSON.parse(raw) : [];
      return Array.isArray(cart) ? cart : [];
    } catch (err) {
      return [];
    }
  }

  function saveCart(cart) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (err) { /* storage unavailable */ }
    renderBadges();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }

  function slugify(str) {
    return (str || 'item').trim().toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
      .slice(0, 60) || 'item';
  }

  function addItem(item) {
    var cart = getCart();
    var id = item.id || slugify(item.name);
    var existing = cart.find(function (c) { return c.id === id; });
    if (existing) {
      existing.qty += (item.qty || 1);
    } else {
      cart.push({
        id: id,
        name: item.name || 'منتج',
        price: Number(item.price) || 0,
        oldPrice: item.oldPrice ? Number(item.oldPrice) : null,
        off: item.off || null,
        img: item.img || '',
        cat: item.cat || null,
        qty: item.qty || 1
      });
    }
    saveCart(cart);
    document.dispatchEvent(new CustomEvent('cart:item-added'));
    return cart;
  }

  function removeItem(id) {
    var cart = getCart().filter(function (c) { return c.id !== id; });
    saveCart(cart);
    return cart;
  }

  function setQty(id, qty) {
    var cart = getCart();
    var item = cart.find(function (c) { return c.id === id; });
    if (item) {
      item.qty = Math.max(1, qty);
      saveCart(cart);
    }
    return cart;
  }

  function clearCart() {
    saveCart([]);
  }

  function count(cart) {
    cart = cart || getCart();
    return cart.reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  function total(cart) {
    cart = cart || getCart();
    return cart.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0);
  }

  /* Sum of "original" (pre-discount) line totals — falls back to the current price
     for items that have no oldPrice, so items with no discount don't skew the subtotal. */
  function subtotal(cart) {
    cart = cart || getCart();
    return cart.reduce(function (sum, it) { return sum + (it.oldPrice || it.price) * it.qty; }, 0);
  }

  function discountTotal(cart) {
    cart = cart || getCart();
    return Math.max(0, subtotal(cart) - total(cart));
  }

  function renderBadges() {
    var n = count();
    document.querySelectorAll('.cart-count').forEach(function (el) {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  }

  function fmt(num) {
    return Number(num || 0).toLocaleString('en-US');
  }

  /* Builds the Arabic order message sent to the store's WhatsApp */
  function buildMessage(items) {
    var lines = ['مرحباً، أرغب في إتمام طلب من متجر Anttikka:', ''];
    items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name);
      lines.push('   الكمية: ' + it.qty);
      if (it.off && it.oldPrice) {
        lines.push('   السعر: ' + fmt(it.price) + ' ج.م للقطعة (بعد خصم ' + it.off + '، السعر الأصلي ' + fmt(it.oldPrice) + ' ج.م)');
      } else {
        lines.push('   السعر: ' + fmt(it.price) + ' ج.م للقطعة');
      }
      lines.push('   الإجمالي الفرعي: ' + fmt(it.price * it.qty) + ' ج.م');
      lines.push('');
    });
    lines.push('---');
    lines.push('الإجمالي الكلي: ' + fmt(total(items)) + ' ج.م');
    return lines.join('\n');
  }

  function checkoutUrl(items) {
    var msg = buildMessage(items);
    return 'https://wa.me/' + STORE_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  function checkout(items) {
    window.open(checkoutUrl(items), '_blank', 'noopener');
  }

  /* Reads the visible product info out of the closest .product-card / PDP panel,
     so no manual data-* tagging is needed across the site's many product cards. */
  function extractFromCard(cardEl) {
    if (!cardEl) return null;
    var nameEl = cardEl.querySelector('.product-name a, .product-name, h1');
    var name = nameEl ? nameEl.textContent.trim() : 'منتج';
    var imgEl = cardEl.querySelector('img');
    var img = imgEl ? imgEl.getAttribute('src') : '';
    var priceNowEl = cardEl.querySelector('.price-now');
    var price = priceNowEl ? parseFloat(priceNowEl.textContent.replace(/[^\d.]/g, '')) : 0;
    var priceOldEl = cardEl.querySelector('.price-old');
    var oldPrice = priceOldEl ? parseFloat(priceOldEl.textContent.replace(/[^\d.]/g, '')) : null;
    var offEl = cardEl.querySelector('.price-off, .badge-sale');
    var off = offEl ? offEl.textContent.trim().replace(/^خصم\s*/, '') : null;
    var catEl = cardEl.querySelector('.product-cat');
    var cat = catEl ? catEl.textContent.trim() : null;
    var explicitId = cardEl.getAttribute('data-id');
    return { id: explicitId || slugify(name), name: name, img: img, price: price || 0, oldPrice: oldPrice, off: off, cat: cat, qty: 1 };
  }

  function toast(message) {
    var el = document.createElement('div');
    el.className = 'cart-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 2200);
  }

  /* Cross-tab sync: if the cart is changed in another tab/window, this tab's
     "storage" event fires (it never fires in the same tab that made the change),
     so badges and any open cart page pick up the update without a manual refresh. */
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    renderBadges();
    document.dispatchEvent(new CustomEvent('cart:change'));
  });

  return {
    getCart: getCart, addItem: addItem, removeItem: removeItem, setQty: setQty,
    clearCart: clearCart, count: count, total: total, subtotal: subtotal,
    discountTotal: discountTotal, fmt: fmt,
    buildMessage: buildMessage, checkoutUrl: checkoutUrl, checkout: checkout,
    extractFromCard: extractFromCard, renderBadges: renderBadges, toast: toast
  };
})();

/* ==========================================================================
   WISHLIST
   Persisted in localStorage like the cart, so the heart buttons across the
   site actually save favorites instead of just toggling a visual state.
   ========================================================================== */
window.AnttikkaWishlist = (function () {
  var STORAGE_KEY = 'Anttikka_wishlist_v1';

  function getList() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveList(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (err) { /* storage unavailable */ }
    renderBadges();
    document.dispatchEvent(new CustomEvent('wishlist:change'));
  }

  function has(id) {
    return getList().some(function (it) { return it.id === id; });
  }

  /* Adds/removes the item and returns true if it is now saved, false if it was just removed */
  function toggle(item) {
    var list = getList();
    var idx = list.findIndex(function (it) { return it.id === item.id; });
    if (idx > -1) {
      list.splice(idx, 1);
      saveList(list);
      return false;
    }
    list.push(item);
    saveList(list);
    return true;
  }

  function removeItem(id) {
    var list = getList().filter(function (it) { return it.id !== id; });
    saveList(list);
  }

  function count() {
    return getList().length;
  }

  function renderBadges() {
    var n = count();
    document.querySelectorAll('.wishlist-count').forEach(function (el) {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  }

  /* Cross-tab sync — see the matching listener in AnttikkaCart for details. */
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    renderBadges();
    document.dispatchEvent(new CustomEvent('wishlist:change'));
  });

  return {
    getList: getList, has: has, toggle: toggle, removeItem: removeItem,
    count: count, renderBadges: renderBadges
  };
})();

document.addEventListener('DOMContentLoaded', function () {

  AnttikkaCart.renderBadges();
  AnttikkaWishlist.renderBadges();

  /* ---------- Cart icon "bump" feedback on add-to-cart ---------- */
  document.addEventListener('cart:item-added', function () {
    document.querySelectorAll('a[href="cart.html"]').forEach(function (el) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      setTimeout(function () { el.classList.remove('bump'); }, 450);
    });
  });

  /* ---------- Wishlist: sync active state + delegated toggle (persists via localStorage) ---------- */
  function wishlistItemFromBtn(btn) {
    var card = btn.closest('.product-card') || btn.closest('.pdp-info');
    if (!card) return null;
    return AnttikkaCart.extractFromCard(card);
  }
  function syncWishlistButtons(scope) {
    (scope || document).querySelectorAll('.wishlist-btn').forEach(function (btn) {
      var item = wishlistItemFromBtn(btn);
      if (item) btn.classList.toggle('active', AnttikkaWishlist.has(item.id));
    });
  }
  syncWishlistButtons();
  document.addEventListener('wishlist:change', function () { syncWishlistButtons(); });

  function pulseHeart(btn) {
    btn.classList.remove('wishlist-pulse');
    void btn.offsetWidth; /* force reflow so the animation can restart on rapid re-clicks */
    btn.classList.add('wishlist-pulse');
    setTimeout(function () { btn.classList.remove('wishlist-pulse'); }, 450);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.wishlist-btn');
    if (!btn) return;
    e.preventDefault();
    var item = wishlistItemFromBtn(btn);
    if (!item) return;
    var nowSaved = AnttikkaWishlist.toggle(item);
    syncWishlistButtons();
    if (nowSaved) pulseHeart(btn);
    AnttikkaCart.toast(nowSaved ? 'أُضيف "' + item.name + '" إلى المفضلة' : 'أُزيل "' + item.name + '" من المفضلة');
  });

  /* ---------- Product links: remember which product was clicked so product.html can render it ----------
     Every "product.html" link across the site (featured cards, shop grid, wishlist, quick view, related
     products...) points to the same static file. Instead of maintaining a per-card product id, we scrape
     the same info already used for cart/wishlist (AnttikkaCart.extractFromCard) right as the link is
     clicked and hand it to the product page via sessionStorage — so whichever product the user clicked
     is the one that actually shows up on product.html. */
  var SELECTED_PRODUCT_KEY = 'Anttikka_selected_product';
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href="product.html"], a[href^="product.html?"]');
    if (!link) return;
    var item = null;
    var card = link.closest('.product-card');
    if (card) {
      item = AnttikkaCart.extractFromCard(card);
    } else if (link.closest('#qvOverlay') && typeof qvCurrentItem !== 'undefined' && qvCurrentItem) {
      item = qvCurrentItem;
    }
    if (item) {
      try { sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(item)); } catch (err) { /* storage unavailable */ }
    }
  });

  /* ---------- Site-wide "add to cart" wiring (delegated, no per-card markup needed) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.icon-btn[aria-label="أضف للسلة"], .btn-cart-inline');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.product-card');
    var item = AnttikkaCart.extractFromCard(card);
    if (item) {
      AnttikkaCart.addItem(item);
      AnttikkaCart.toast('تمت إضافة "' + item.name + '" إلى السلة');
    }
  });

  /* ---------- Quick View modal ---------- */
  var qvOverlay = document.getElementById('qvOverlay');
  if (qvOverlay) {
    var qvImg = document.getElementById('qvImg');
    var qvBadge = document.getElementById('qvBadge');
    var qvCat = document.getElementById('qvCat');
    var qvTitle = document.getElementById('qvTitle');
    var qvPriceNow = document.getElementById('qvPriceNow');
    var qvPriceOld = document.getElementById('qvPriceOld');
    var qvPriceOff = document.getElementById('qvPriceOff');
    var qvQtyVal = document.getElementById('qvQtyVal');
    var qvQtyMinus = document.getElementById('qvQtyMinus');
    var qvQtyPlus = document.getElementById('qvQtyPlus');
    var qvAddToCart = document.getElementById('qvAddToCart');
    var qvClose = document.getElementById('qvClose');
    var qvCurrentItem = null;

    function openQuickView(item) {
      qvCurrentItem = item;
      qvImg.setAttribute('src', item.img);
      qvImg.setAttribute('alt', item.name);
      qvTitle.textContent = item.name;
      qvPriceNow.textContent = AnttikkaCart.fmt(item.price) + ' ج.م';

      if (item.cat) {
        qvCat.textContent = item.cat;
        qvCat.style.display = '';
      } else {
        qvCat.style.display = 'none';
      }

      if (item.oldPrice) {
        qvPriceOld.textContent = AnttikkaCart.fmt(item.oldPrice) + ' ج.م';
        qvPriceOld.style.display = '';
      } else {
        qvPriceOld.style.display = 'none';
      }

      if (item.off) {
        qvPriceOff.textContent = 'خصم ' + item.off;
        qvPriceOff.style.display = '';
        qvBadge.textContent = 'خصم ' + item.off;
        qvBadge.style.display = '';
      } else {
        qvPriceOff.style.display = 'none';
        qvBadge.style.display = 'none';
      }

      qvQtyVal.textContent = '1';
      qvOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeQuickView() {
      qvOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.icon-btn[aria-label="عرض سريع"], .icon-btn-outline[aria-label="عرض سريع"]');
      if (!btn) return;
      e.preventDefault();
      var card = btn.closest('.product-card');
      if (!card) return;
      var item = AnttikkaCart.extractFromCard(card);
      if (item) openQuickView(item);
    });

    if (qvClose) qvClose.addEventListener('click', closeQuickView);
    qvOverlay.addEventListener('click', function (e) {
      if (e.target === qvOverlay) closeQuickView();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && qvOverlay.classList.contains('open')) closeQuickView();
    });

    if (qvQtyMinus) {
      qvQtyMinus.addEventListener('click', function () {
        var v = parseInt(qvQtyVal.textContent, 10) || 1;
        qvQtyVal.textContent = Math.max(1, v - 1);
      });
    }
    if (qvQtyPlus) {
      qvQtyPlus.addEventListener('click', function () {
        var v = parseInt(qvQtyVal.textContent, 10) || 1;
        qvQtyVal.textContent = v + 1;
      });
    }
    if (qvAddToCart) {
      qvAddToCart.addEventListener('click', function () {
        if (!qvCurrentItem) return;
        var qty = parseInt(qvQtyVal.textContent, 10) || 1;
        AnttikkaCart.addItem({
          id: qvCurrentItem.id, name: qvCurrentItem.name, img: qvCurrentItem.img,
          price: qvCurrentItem.price, oldPrice: qvCurrentItem.oldPrice, off: qvCurrentItem.off, qty: qty
        });
        AnttikkaCart.toast('تمت إضافة "' + qvCurrentItem.name + '" إلى السلة');
        closeQuickView();
      });
    }
  }

  /* ---------- Homepage: hero search redirects to shop with query ---------- */
  var heroSearchForm = document.getElementById('heroSearchForm');
  if (heroSearchForm) {
    heroSearchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = document.getElementById('heroSearchInput').value.trim();
      window.location.href = 'shop.html' + (q ? '?search=' + encodeURIComponent(q) : '');
    });
  }

  /* ---------- Contact page: send message via WhatsApp ---------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('cfName').value.trim();
      var phone = document.getElementById('cfPhone').value.trim();
      var subject = document.getElementById('cfSubject').value.trim();
      var message = document.getElementById('cfMessage').value.trim();

      var lines = ['رسالة جديدة من نموذج التواصل — Anttikka', ''];
      lines.push('الاسم: ' + name);
      lines.push('الهاتف: ' + phone);
      if (subject) lines.push('الموضوع: ' + subject);
      lines.push('');
      lines.push('الرسالة:');
      lines.push(message);

      var url = 'https://wa.me/201068300432?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener');
    });
  }

  /* ---------- Shared body-scroll lock (drawer / bottom sheets) ---------- */
  var openOverlaysCount = 0;
  function lockScroll() {
    openOverlaysCount++;
    document.body.classList.add('no-scroll');
  }
  function unlockScroll() {
    openOverlaysCount = Math.max(0, openOverlaysCount - 1);
    if (openOverlaysCount === 0) document.body.classList.remove('no-scroll');
  }

  /* ---------- Mobile nav drawer ---------- */
  var menuToggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');
  var mobileNavClose = document.getElementById('mobileNavClose');
  var mobileNavBackdrop = document.getElementById('mobileNavBackdrop');

  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.add('open');
    if (mobileNavBackdrop) mobileNavBackdrop.classList.add('open');
    lockScroll();
  }
  function closeMobileNav() {
    if (!mobileNav || !mobileNav.classList.contains('open')) return;
    mobileNav.classList.remove('open');
    if (mobileNavBackdrop) mobileNavBackdrop.classList.remove('open');
    unlockScroll();
  }
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', openMobileNav);
  }
  if (mobileNavClose && mobileNav) {
    mobileNavClose.addEventListener('click', closeMobileNav);
  }
  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', closeMobileNav);
  }
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMobileNav);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileNav();
  });

  /* Customer-service accordion inside the drawer */
  var mnServiceToggle = document.getElementById('mnServiceToggle');
  var mnServicePanel = document.getElementById('mnServicePanel');
  if (mnServiceToggle && mnServicePanel) {
    mnServiceToggle.addEventListener('click', function () {
      var isOpen = mnServicePanel.classList.toggle('open');
      mnServiceToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  /* ---------- Bottom navigation: active state + search sheet ---------- */
  var bottomNav = document.getElementById('bottomNav');
  if (bottomNav) {
    var currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (currentFile === '' || currentFile === '/') currentFile = 'index.html';
    var pageMap = { 'index.html': 'index', 'shop.html': 'shop', 'wishlist.html': 'wishlist', 'cart.html': 'cart' };
    var activePage = pageMap[currentFile];
    if (activePage) {
      var activeItem = bottomNav.querySelector('.bn-item[data-page="' + activePage + '"]');
      if (activeItem) activeItem.classList.add('active');
    }
  }

  var bottomNavSearchBtn = document.getElementById('bottomNavSearchBtn');
  var searchSheet = document.getElementById('searchSheet');
  var searchSheetBackdrop = document.getElementById('searchSheetBackdrop');
  var searchSheetClose = document.getElementById('searchSheetClose');
  var bottomSearchForm = document.getElementById('bottomSearchForm');
  var bottomSearchInput = document.getElementById('bottomSearchInput');

  function openSearchSheet() {
    if (!searchSheet) return;
    searchSheet.classList.add('open');
    if (searchSheetBackdrop) searchSheetBackdrop.classList.add('open');
    lockScroll();
    setTimeout(function () { if (bottomSearchInput) bottomSearchInput.focus(); }, 260);
  }
  function closeSearchSheet() {
    if (!searchSheet || !searchSheet.classList.contains('open')) return;
    searchSheet.classList.remove('open');
    if (searchSheetBackdrop) searchSheetBackdrop.classList.remove('open');
    unlockScroll();
  }
  if (bottomNavSearchBtn) bottomNavSearchBtn.addEventListener('click', openSearchSheet);
  if (searchSheetClose) searchSheetClose.addEventListener('click', closeSearchSheet);
  if (searchSheetBackdrop) searchSheetBackdrop.addEventListener('click', closeSearchSheet);
  if (bottomSearchForm) {
    bottomSearchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = (bottomSearchInput && bottomSearchInput.value || '').trim();
      window.location.href = 'shop.html' + (q ? '?search=' + encodeURIComponent(q) : '');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearchSheet();
  });

  /* ---------- Header scroll state ---------- */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();


  /* ---------- Homepage: dressing room carousel ---------- */
  var dcCarousel = document.getElementById('dcCarousel');
  if (dcCarousel) {
    var dcSlides = dcCarousel.querySelectorAll('.dc-slide');
    var dcCurrentEl = document.getElementById('dcCurrent');
    var dcPrevBtn = document.getElementById('dcPrev');
    var dcNextBtn = document.getElementById('dcNext');
    var dcIndex = 0;

    function showDcSlide(i) {
      dcIndex = (i + dcSlides.length) % dcSlides.length;
      dcSlides.forEach(function (s) { s.classList.remove('active'); });
      dcSlides[dcIndex].classList.add('active');
      if (dcCurrentEl) dcCurrentEl.textContent = dcIndex + 1;
    }

    if (dcPrevBtn) dcPrevBtn.addEventListener('click', function () { showDcSlide(dcIndex - 1); });
    if (dcNextBtn) dcNextBtn.addEventListener('click', function () { showDcSlide(dcIndex + 1); });
  }

  /* ---------- Homepage: decor spotlight gallery (click a thumbnail to swap the big image) ---------- */
  var decorGrid = document.getElementById('decorGrid');
  var decorFeature = document.getElementById('decorFeature');
  var decorFeatureTitle = document.getElementById('decorFeatureTitle');
  if (decorGrid && decorFeature) {
    var swapDecorFeature = function (card) {
      if (!card) return;
      var largeUrl = card.getAttribute('data-large');
      var titleEl = card.querySelector('.product-name');
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!largeUrl) return;

      decorGrid.querySelectorAll('.product-card').forEach(function (c) { c.classList.remove('is-active'); });
      card.classList.add('is-active');

      decorFeature.classList.add('is-switching');
      setTimeout(function () {
        decorFeature.style.backgroundImage = "url('" + largeUrl + "')";
        if (decorFeatureTitle && title) decorFeatureTitle.textContent = title;
        decorFeature.classList.remove('is-switching');
      }, 220);
    };

    decorGrid.addEventListener('click', function (e) {
      if (e.target.closest('.wishlist-btn')) return;
      var mediaEl = e.target.closest('.product-media');
      if (!mediaEl) return;
      swapDecorFeature(e.target.closest('.product-card'));
    });

    decorGrid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var mediaEl = e.target.closest('.product-media');
      if (!mediaEl) return;
      e.preventDefault();
      swapDecorFeature(e.target.closest('.product-card'));
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Category tabs product data ---------- */
  var categoryData = {
    sofas: [
      { img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=700&auto=format&fit=crop', cat: 'أرائك', name: 'أريكة نور المخملية', price: '22,500', old: '27,900', off: '19%' },
      { img: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?q=80&w=700&auto=format&fit=crop', cat: 'أرائك', name: 'أريكة زاوية ريفا', price: '31,200', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=700&auto=format&fit=crop', cat: 'كراسي', name: 'كرسي بيرش المنجّد', price: '9,850', old: '12,300', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=700&auto=format&fit=crop', cat: 'كراسي', name: 'كرسي لونا الجانبي', price: '1,399', old: '1,699', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1550254478-ead40cc54513?q=80&w=700&auto=format&fit=crop', cat: 'أرائك', name: 'أريكة بوهو ثلاثية', price: '26,400', old: null, off: null }
    ],
    bedrooms: [
      { img: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=80&w=700&auto=format&fit=crop', cat: 'غرف نوم', name: 'سرير أوما الخشبي', price: '18,750', old: '22,900', off: '18%' },
      { img: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=700&auto=format&fit=crop', cat: 'غرف نوم', name: 'خزانة ملابس فيلانو', price: '27,300', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=700&auto=format&fit=crop', cat: 'غرف نوم', name: 'طاولة زينة كلارا', price: '7,400', old: '9,100', off: '19%' },
      { img: 'https://images.unsplash.com/photo-1616627988645-1a1eaef4f6d8?q=80&w=700&auto=format&fit=crop', cat: 'غرف نوم', name: 'كومودينو نوكس', price: '4,600', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?q=80&w=700&auto=format&fit=crop', cat: 'غرف نوم', name: 'مقعد نهاية السرير', price: '5,950', old: '7,200', off: '17%' }
    ],
    dining: [
      { img: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'طاولة سفرة أوك', price: '24,900', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'كرسي سفرة تلمار', price: '3,650', old: '4,400', off: '17%' },
      { img: 'https://images.unsplash.com/photo-1615529162924-f8605388461d?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'بوفيه فينزو', price: '16,800', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'طاولة سفرة مستديرة', price: '5,399', old: '24,999', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1533090368676-1fd25485db88?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'خزانة أطباق كريستال', price: '21,300', old: null, off: null }
    ],
    cabinets: [
      { img: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=700&auto=format&fit=crop', cat: 'خزائن أحذية', name: 'خزانة أحذية 4 أبواب', price: '490', old: '620', off: '21%' },
      { img: 'https://images.unsplash.com/photo-1631048305493-b23dceb8b6c3?q=80&w=700&auto=format&fit=crop', cat: 'خزائن أحذية', name: 'خزانة أحذية موجية', price: '475', old: '650', off: '27%' },
      { img: 'https://images.unsplash.com/photo-1618221639331-4de74ce5b830?q=80&w=700&auto=format&fit=crop', cat: 'خزائن أحذية', name: 'خزانة أحذية باين أدوار', price: '307', old: '450', off: '32%' },
      { img: 'https://images.unsplash.com/photo-1605774337664-7a846e9cdf17?q=80&w=700&auto=format&fit=crop', cat: 'خزائن أحذية', name: 'خزانة أحذية مودرن', price: '399', old: '549', off: '27%' },
      { img: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?q=80&w=700&auto=format&fit=crop', cat: 'خزائن أحذية', name: 'خزانة أحذية خشبية مزدوجة', price: '520', old: '690', off: '24%' }
    ],
    lighting: [
      { img: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?q=80&w=700&auto=format&fit=crop', cat: 'إضاءة', name: 'ثريا القبة الذهبية', price: '14,999', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?q=80&w=700&auto=format&fit=crop', cat: 'إضاءة', name: 'مصباح أرضي أوركا', price: '5,200', old: '6,500', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=700&auto=format&fit=crop', cat: 'إضاءة', name: 'ثريا كريستال فينوس', price: '32,000', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1543198126-8a0472ce56b4?q=80&w=700&auto=format&fit=crop', cat: 'إضاءة', name: 'مصباح طاولة أمبر', price: '2,150', old: '2,700', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?q=80&w=700&auto=format&fit=crop', cat: 'إضاءة', name: 'إضاءة معلقة ثلاثية', price: '6,800', old: null, off: null }
    ],
    tv_tables: [
      { img: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?q=80&w=700&auto=format&fit=crop', cat: 'طاولة تلفزيون', name: 'طاولة تلفزيون خشب مقاس 200 سم', price: '345', old: '580', off: '41%' },
      { img: 'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?q=80&w=700&auto=format&fit=crop', cat: 'طاولة تلفزيون', name: 'طاولة تلفزيون مع أرفف جدارية', price: '519', old: '950', off: '45%' },
      { img: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=700&auto=format&fit=crop', cat: 'طاولة تلفزيون', name: 'طاولة تلفزيون زجاج وخشب', price: '448.99', old: '580', off: '23%' },
      { img: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=700&auto=format&fit=crop', cat: 'طاولة تلفزيون مودرن', name: 'طاولة تلفزيون ماليزي رمادي', price: '345', old: '448.99', off: '23%' },
      { img: 'https://images.unsplash.com/photo-1615529162924-f8605388461d?q=80&w=700&auto=format&fit=crop', cat: 'طاولة تلفزيون مودرن', name: 'طاولة تلفزيون مقاس 140 سم', price: '385', old: '490', off: '21%' }
    ],
    buffets: [
      { img: 'https://images.unsplash.com/photo-1615529162924-f8605388461d?q=80&w=700&auto=format&fit=crop', cat: 'بوفيه مودرن', name: 'بوفيه مودرن 140×80 سم خشب وزجاج', price: '995', old: '1250', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1533090368676-1fd25485db88?q=80&w=700&auto=format&fit=crop', cat: 'بوفيه مودرن', name: 'بوفيه مودرن قاعدة معدنية رمادي', price: '995', old: '1250', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1618221639331-4de74ce5b830?q=80&w=700&auto=format&fit=crop', cat: 'بوفية معدنية', name: 'خزانة حديد متعددة الاستعمال', price: '529', old: '599', off: '12%' },
      { img: 'https://images.unsplash.com/photo-1605774337664-7a846e9cdf17?q=80&w=700&auto=format&fit=crop', cat: 'دولاب بوفية سيراميك', name: 'دولاب بوفية سيراميك 160 سم', price: '949', old: '1299.99', off: '27%' },
      { img: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?q=80&w=700&auto=format&fit=crop', cat: 'بوفيه تخزين', name: 'بوفيه تخزين 80 سم بأبواب زجاج', price: '399', old: '549', off: '27%' }
    ],
    outdoor: [
      { img: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=700&auto=format&fit=crop', cat: 'أثاث خارجي', name: 'جلسة راتان خارجية', price: '28,900', old: '36,000', off: '20%' },
      { img: 'https://images.unsplash.com/photo-1519974719765-e6559eac2575?q=80&w=700&auto=format&fit=crop', cat: 'أثاث خارجي', name: 'طاولة حديقة تيك', price: '11,400', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?q=80&w=700&auto=format&fit=crop', cat: 'أثاث خارجي', name: 'كرسي استرخاء خارجي', price: '6,300', old: '7,800', off: '19%' },
      { img: 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?q=80&w=700&auto=format&fit=crop', cat: 'أثاث خارجي', name: 'أرجوحة حديقة خشبية', price: '9,999', old: null, off: null },
      { img: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?q=80&w=700&auto=format&fit=crop', cat: 'أثاث خارجي', name: 'مظلة حديقة قماشية', price: '13,500', old: '16,900', off: '20%' }
    ]
  };

  function heartIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.4 2 5 5.3 5c2 0 3.4 1.1 4.2 2.3.3.5 1.3 2 1.3 2s1-1.5 1.3-2C13 6.1 14.5 5 16.4 5c3.3 0 5 3.4 3.4 6.8C19.5 16.4 12 21 12 21z"/></svg>';
  }
  function eyeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  function bagIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"></path></svg>';
  }
  /* Full-width "add to cart" button shown only on mobile, placed under the price
     (the on-image btn-cart-inline pill is hidden on touch widths via CSS).
     Shares the .btn-cart-inline class so the existing delegated click handler
     (site-wide "add to cart" wiring) picks it up automatically — no extra JS needed. */
  function mobileCartBtnHtml() {
    return '<button type="button" class="btn-cart-inline mobile-add-cart-btn" aria-label="أضف للسلة">' + bagIcon() + '<span>أضف للسلة</span></button>';
  }

  function renderProducts(list) {
    return list.map(function (p) {
      var badge = p.off ? '<span class="badge-sale">خصم ' + p.off + '</span>' : '';
      var priceOld = p.old ? '<span class="price-old">' + p.old + ' ج.م</span>' : '';
      var priceOff = p.off ? '<span class="price-off">خصم ' + p.off + '</span>' : '';
      return (
        '<article class="product-card">' +
          '<div class="product-media">' +
            badge +
            '<button class="wishlist-btn" aria-label="أضف للمفضلة">' + heartIcon() + '</button>' +
            '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
            '<div class="product-actions">' +
              '<button class="icon-btn-outline" aria-label="عرض سريع">' + eyeIcon() + '</button>' +
              '<button class="btn-cart-inline" aria-label="أضف للسلة"><span>أضف للسلة</span></button>' +
            '</div>' +
          '</div>' +
          '<div class="product-info">' +
            '<span class="product-cat">' + p.cat + '</span>' +
            '<h3 class="product-name"><a href="product.html">' + p.name + '</a></h3>' +
            '<div class="product-rating"><span class="stars">★★★★★</span><span class="count">(80)</span></div>' +
            '<div class="product-price"><span class="price-now">' + p.price + ' ج.م</span>' + priceOld + priceOff + '</div>' +
            mobileCartBtnHtml() +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  var grid = document.getElementById('categoryGrid');
  var tabs = document.getElementById('categoryTabs');
  if (grid && tabs) {
    grid.innerHTML = renderProducts(categoryData.sofas.slice(0, 4));
    syncWishlistButtons(grid);

    tabs.querySelectorAll('.tab-btn').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var cat = tab.getAttribute('data-cat');
        grid.style.opacity = '0';
        setTimeout(function () {
          grid.innerHTML = renderProducts((categoryData[cat] || []).slice(0, 4));
          syncWishlistButtons(grid);
          grid.style.opacity = '1';
        }, 180);
      });
    });
    grid.style.transition = 'opacity .25s ease';
  }

  /* ---------- Product page: hydrate with whichever product the user actually clicked ----------
     Reads what the click-listener above stored in sessionStorage. If nothing is there (direct
     visit, bookmark, refreshed session) the page just keeps its hardcoded default product, so it
     never renders empty. */
  var pdpInfoForHydrate = document.querySelector('.pdp-info');
  if (pdpInfoForHydrate) {
    (function hydrateProductPage() {
      var raw;
      try { raw = sessionStorage.getItem(SELECTED_PRODUCT_KEY); } catch (err) { raw = null; }
      if (!raw) return;
      var sel;
      try { sel = JSON.parse(raw); } catch (err) { return; }
      if (!sel || !sel.name) return;

      var h1 = pdpInfoForHydrate.querySelector('h1');
      if (h1) h1.textContent = sel.name;
      document.title = sel.name + ' | Anttikka';

      var priceNow = pdpInfoForHydrate.querySelector('.price-now');
      if (priceNow) priceNow.textContent = AnttikkaCart.fmt(sel.price) + ' ج.م';
      var priceOld = pdpInfoForHydrate.querySelector('.price-old');
      if (priceOld) {
        if (sel.oldPrice) { priceOld.textContent = AnttikkaCart.fmt(sel.oldPrice) + ' ج.م'; priceOld.style.display = ''; }
        else priceOld.style.display = 'none';
      }
      var priceOff = pdpInfoForHydrate.querySelector('.price-off');
      if (priceOff) {
        if (sel.off) { priceOff.textContent = 'خصم ' + sel.off; priceOff.style.display = ''; }
        else priceOff.style.display = 'none';
      }

      var mainBadge = document.querySelector('#pdpMain .badge-sale');
      if (mainBadge) {
        if (sel.off) { mainBadge.textContent = 'خصم ' + sel.off; mainBadge.style.display = ''; }
        else mainBadge.style.display = 'none';
      }

      if (sel.img) {
        document.querySelectorAll('.pdp-thumb').forEach(function (t) {
          t.setAttribute('data-img', sel.img);
          var timg = t.querySelector('img');
          if (timg) { timg.setAttribute('src', sel.img); timg.setAttribute('alt', sel.name); }
        });
        var mainImgEl = document.getElementById('pdpMainImg');
        if (mainImgEl) { mainImgEl.setAttribute('src', sel.img); mainImgEl.setAttribute('alt', sel.name); }
      }

      var crumbLinks = document.querySelectorAll('.breadcrumb-strip .breadcrumb a');
      if (sel.cat && crumbLinks.length) {
        crumbLinks[crumbLinks.length - 1].textContent = sel.cat;
      }
      var crumbCurrent = document.querySelector('.breadcrumb-strip .current');
      if (crumbCurrent) crumbCurrent.textContent = sel.name;

      /* If the clicked product belongs to one of the main catalogue categories, swap the
         "related products" section for real items from that same category. */
      var relatedGrid = document.querySelector('.section-alt .product-grid');
      if (relatedGrid && typeof categoryData !== 'undefined') {
        var matchedCatKey = null;
        Object.keys(categoryData).some(function (catKey) {
          if (categoryData[catKey].some(function (p) { return p.name === sel.name; })) {
            matchedCatKey = catKey;
            return true;
          }
          return false;
        });
        if (matchedCatKey) {
          var relatedItems = categoryData[matchedCatKey]
            .filter(function (p) { return p.name !== sel.name; })
            .slice(0, 4);
          if (relatedItems.length) {
            relatedGrid.innerHTML = renderProducts(relatedItems);
            syncWishlistButtons(relatedGrid);
          }
        }
      }

      /* The PDP's own wishlist heart was synced earlier against the placeholder product
         (before hydration swapped in the actually-clicked product's name/price), so its
         id has since changed — resync it now that the DOM reflects the real product. */
      syncWishlistButtons(pdpInfoForHydrate);
    })();
  }

  /* ---------- Product page: thumbnail gallery + lightbox zoom ---------- */
  var pdpThumbs = document.querySelectorAll('.pdp-thumb');
  var pdpMainImg = document.getElementById('pdpMainImg');
  var pdpMain = document.getElementById('pdpMain');
  var pdpDots = document.querySelectorAll('.pdp-dots span');
  var galleryImages = Array.prototype.map.call(pdpThumbs, function (t) { return t.getAttribute('data-img'); });
  var currentImgIndex = 0;

  function selectThumb(i) {
    if (!pdpThumbs.length || i < 0 || i >= pdpThumbs.length) return;
    currentImgIndex = i;
    pdpThumbs.forEach(function (t) { t.classList.remove('active'); });
    pdpThumbs[i].classList.add('active');
    pdpMainImg.setAttribute('src', galleryImages[i]);
    pdpDots.forEach(function (d) { d.classList.remove('active'); });
    if (pdpDots[i]) pdpDots[i].classList.add('active');
  }

  if (pdpThumbs.length && pdpMainImg) {
    pdpThumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () { selectThumb(i); });
    });
  }

  /* Lightbox */
  var lightboxOverlay = document.getElementById('lightboxOverlay');
  if (lightboxOverlay && galleryImages.length) {
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxCounter = document.getElementById('lightboxCounter');
    var lightboxClose = document.getElementById('lightboxClose');
    var lightboxPrev = document.getElementById('lightboxPrev');
    var lightboxNext = document.getElementById('lightboxNext');

    function renderLightboxImage() {
      lightboxImg.classList.remove('loaded');
      lightboxImg.setAttribute('src', galleryImages[currentImgIndex]);
      lightboxImg.setAttribute('alt', pdpMainImg.getAttribute('alt') || '');
      lightboxCounter.textContent = (currentImgIndex + 1) + ' / ' + galleryImages.length;
      /* Fallback in case the browser doesn't refire "load" for an already-cached image */
      if (lightboxImg.complete) lightboxImg.classList.add('loaded');
    }
    lightboxImg.addEventListener('load', function () { lightboxImg.classList.add('loaded'); });

    function openLightbox() {
      renderLightboxImage();
      lightboxOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightboxOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    function showPrev() {
      currentImgIndex = (currentImgIndex - 1 + galleryImages.length) % galleryImages.length;
      renderLightboxImage();
      selectThumb(currentImgIndex);
    }
    function showNext() {
      currentImgIndex = (currentImgIndex + 1) % galleryImages.length;
      renderLightboxImage();
      selectThumb(currentImgIndex);
    }

    if (pdpMain) pdpMain.addEventListener('click', openLightbox);
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', function (e) {
      if (e.target === lightboxOverlay) closeLightbox();
    });
    if (lightboxPrev) lightboxPrev.addEventListener('click', showPrev);
    if (lightboxNext) lightboxNext.addEventListener('click', showNext);
    document.addEventListener('keydown', function (e) {
      if (!lightboxOverlay.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') showPrev();
      else if (e.key === 'ArrowLeft') showNext();
    });
  }

  /* ---------- Product page: quantity selector ---------- */
  var qtyVal = document.getElementById('qtyVal');
  var qtyMinus = document.getElementById('qtyMinus');
  var qtyPlus = document.getElementById('qtyPlus');
  if (qtyVal && qtyMinus && qtyPlus) {
    qtyMinus.addEventListener('click', function () {
      var v = parseInt(qtyVal.textContent, 10) || 1;
      qtyVal.textContent = Math.max(1, v - 1);
    });
    qtyPlus.addEventListener('click', function () {
      var v = parseInt(qtyVal.textContent, 10) || 1;
      qtyVal.textContent = v + 1;
    });
  }

  /* ---------- Product page: Add to Cart / Buy Now ---------- */
  var pdpAddToCart = document.getElementById('pdpAddToCart');
  var pdpBuyNow = document.getElementById('pdpBuyNow');
  var pdpInfo = document.querySelector('.pdp-info');
  if (pdpInfo && (pdpAddToCart || pdpBuyNow)) {
    var getPdpItem = function () {
      var item = AnttikkaCart.extractFromCard(pdpInfo);
      var mainImg = document.getElementById('pdpMainImg');
      if (mainImg) item.img = mainImg.getAttribute('src');
      item.qty = parseInt((qtyVal && qtyVal.textContent) || '1', 10) || 1;
      return item;
    };
    if (pdpAddToCart) {
      pdpAddToCart.addEventListener('click', function () {
        var item = getPdpItem();
        AnttikkaCart.addItem(item);
        AnttikkaCart.toast('تمت إضافة "' + item.name + '" إلى السلة');
      });
    }
    if (pdpBuyNow) {
      pdpBuyNow.addEventListener('click', function () {
        AnttikkaCart.checkout([getPdpItem()]);
      });
    }
  }

  /* ---------- Product page: accordion ---------- */
  document.querySelectorAll('.acc-item .acc-header').forEach(function (header) {
    header.addEventListener('click', function () {
      var item = header.closest('.acc-item');
      var wasOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.acc-item').forEach(function (el) { el.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ---------- FAQ page: live search filter across grouped questions ---------- */
  var faqSearchInput = document.getElementById('faqSearchInput');
  if (faqSearchInput) {
    var faqItems = document.querySelectorAll('.content-accordion .acc-item');
    var faqGroups = document.querySelectorAll('.content-accordion .acc-group-title');
    var faqNoResults = document.getElementById('faqNoResults');

    faqSearchInput.addEventListener('input', function () {
      var q = faqSearchInput.value.trim().toLowerCase();
      var anyVisible = false;

      faqItems.forEach(function (item) {
        var match = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
        item.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });

      /* Hide a category label if every question under it got filtered out */
      faqGroups.forEach(function (group) {
        var hasVisible = false;
        var el = group.nextElementSibling;
        while (el && !el.classList.contains('acc-group-title')) {
          if (el.classList.contains('acc-item') && el.style.display !== 'none') hasVisible = true;
          el = el.nextElementSibling;
        }
        group.style.display = hasVisible ? '' : 'none';
      });

      if (faqNoResults) faqNoResults.classList.toggle('show', !anyVisible);
    });
  }

  /* ---------- Policy pages: sticky table-of-contents scrollspy ---------- */
  var policyToc = document.querySelector('.policy-toc');
  if (policyToc) {
    var tocLinks = Array.prototype.slice.call(policyToc.querySelectorAll('a[href^="#"]'));
    var tocTargets = tocLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    function setActiveTocLink() {
      var pos = window.scrollY + 150;
      var current = tocTargets[0];
      tocTargets.forEach(function (el) { if (el.offsetTop <= pos) current = el; });
      tocLinks.forEach(function (a) {
        a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id);
      });
    }
    if (tocTargets.length) {
      setActiveTocLink();
      window.addEventListener('scroll', setActiveTocLink, { passive: true });
    }
  }

  /* ==========================================================================
     SHOP PAGE — full catalogue, real filtering, sorting & pagination
     ========================================================================== */
  var shopGrid = document.getElementById('shopGrid');
  if (shopGrid) {

    var catLabels = {
      sofas: 'الأرائك والكراسي', bedrooms: 'غرف نوم', dining: 'سفرة',
      tv_tables: 'طاولة تلفزيون', buffets: 'بوفيه', cabinets: 'خزائن أحذية',
      lighting: 'إضاءة', outdoor: 'أثاث خارجي'
    };
    var materialMap = {
      sofas: function () { return 'قماش مخملي'; },
      bedrooms: function () { return 'خشب طبيعي'; },
      dining: function (i) { return i % 2 === 0 ? 'خشب طبيعي' : 'رخام'; },
      cabinets: function () { return 'خشب طبيعي'; },
      lighting: function () { return 'معدن'; },
      tv_tables: function (i) { return i % 2 === 0 ? 'خشب طبيعي' : 'معدن'; },
      buffets: function (i) { var m = ['خشب طبيعي', 'معدن', 'رخام']; return m[i % m.length]; },
      outdoor: function () { return 'راتان'; }
    };
    var colorMap = {
      sofas: ['beige', 'darkbrown', 'black'],
      bedrooms: ['wood', 'white'],
      dining: ['wood', 'white'],
      cabinets: ['darkbrown', 'black', 'wood'],
      lighting: ['black', 'wood'],
      tv_tables: ['wood', 'black'],
      buffets: ['wood', 'black', 'white'],
      outdoor: ['darkbrown', 'beige', 'green']
    };

    /* Deterministic pseudo "rating" / "reviews" / "sold" — hashed from the product name so
       they're stable across reloads (not random) and give the "الأكثر مبيعاً" / "الأعلى تقييماً"
       sort options something real to sort by, without needing a backend. */
    function hashStr(str) {
      var h = 0;
      for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
      return h;
    }
    function pseudoStatsFor(name) {
      var h = hashStr(name);
      return {
        rating: Math.round((4.3 + (h % 71) / 100) * 10) / 10, /* 4.3 – 5.0 */
        reviews: 18 + (h % 320),                                /* 18 – 337 */
        sold: 12 + ((h >> 3) % 480)                             /* 12 – 491 */
      };
    }

    var ALL_PRODUCTS = [];
    Object.keys(categoryData).forEach(function (cat) {
      categoryData[cat].forEach(function (p, i) {
        var stats = pseudoStatsFor(p.name);
        ALL_PRODUCTS.push({
          id: cat + '-' + i,
          catKey: cat,
          catLabel: catLabels[cat] || p.cat,
          img: p.img,
          name: p.name,
          price: p.price,
          priceNum: parseFloat(String(p.price).replace(/,/g, '')) || 0,
          old: p.old,
          off: p.off,
          material: materialMap[cat](i),
          colorKey: colorMap[cat][i % colorMap[cat].length],
          rating: stats.rating,
          reviews: stats.reviews,
          sold: stats.sold
        });
      });
    });

    /* Fill category & material counts in the sidebar */
    document.querySelectorAll('[data-count-for]').forEach(function (el) {
      var cat = el.getAttribute('data-count-for');
      el.textContent = (categoryData[cat] || []).length;
    });
    document.querySelectorAll('[data-material-count-for]').forEach(function (el) {
      var mat = el.getAttribute('data-material-count-for');
      el.textContent = ALL_PRODUCTS.filter(function (p) { return p.material === mat; }).length;
    });

    var shopTabs = document.getElementById('shopTabs');
    var priceRange = document.getElementById('priceRange');
    var priceMaxLabel = document.getElementById('priceMaxLabel');
    var onSaleOnly = document.getElementById('onSaleOnly');
    var shopSort = document.getElementById('shopSort');
    var shopSearchInput = document.getElementById('shopSearchInput');
    var shopSearchInputMobile = document.getElementById('shopSearchInputMobile');
    var shopResultCount = document.getElementById('shopResultCount');
    var mobileResultCount = document.getElementById('mobileResultCount');
    var shopPagination = document.getElementById('shopPagination');
    var resetFiltersBtn = document.getElementById('resetFilters');
    var applyFiltersBtn = document.getElementById('applyFiltersBtn');
    var categoryChecks = document.querySelectorAll('#shopFilters [data-cat]');
    var materialChecks = document.querySelectorAll('#shopFilters [data-material]');
    var colorSwatches = document.querySelectorAll('#colorSwatches .swatch');

    var PAGE_SIZE = 15;
    var state = { categories: [], materials: [], colors: [], sort: 'newest', page: 1, search: '' };
    var currentList = ALL_PRODUCTS.slice();

    function shopCardHtml(p) {
      var badge = p.off ? '<span class="badge-sale">خصم ' + p.off + '</span>' : '';
      var priceOld = p.old ? '<span class="price-old">' + p.old + ' ج.م</span>' : '';
      var priceOff = p.off ? '<span class="price-off">خصم ' + p.off + '</span>' : '';
      return (
        '<article class="product-card shop-card">' +
          '<div class="product-media">' +
            badge +
            '<button class="wishlist-btn" aria-label="أضف للمفضلة">' + heartIcon() + '</button>' +
            '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
            '<div class="product-actions">' +
              '<button class="icon-btn-outline" aria-label="عرض سريع">' + eyeIcon() + '</button>' +
              '<button class="btn-cart-inline" aria-label="أضف للسلة"><span>أضف للسلة</span></button>' +
            '</div>' +
          '</div>' +
          '<div class="product-info">' +
            '<span class="product-cat">' + p.catLabel + '</span>' +
            '<h3 class="product-name"><a href="product.html">' + p.name + '</a></h3>' +
            '<div class="product-rating"><span class="stars">★★★★★</span><span class="count">(' + p.reviews + ')</span></div>' +
            '<div class="product-price"><span class="price-now">' + p.price + ' ج.م</span>' + priceOld + priceOff + '</div>' +
            mobileCartBtnHtml() +
          '</div>' +
        '</article>'
      );
    }

    function computeFiltered() {
      var q = state.search.trim().toLowerCase();
      return ALL_PRODUCTS.filter(function (p) {
        if (state.categories.length && state.categories.indexOf(p.catKey) === -1) return false;
        if (p.priceNum > Number(priceRange.value)) return false;
        if (state.materials.length && state.materials.indexOf(p.material) === -1) return false;
        if (state.colors.length && state.colors.indexOf(p.colorKey) === -1) return false;
        if (onSaleOnly && onSaleOnly.checked && !p.off) return false;
        if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function sortList(list) {
      var sorted = list.slice();
      if (state.sort === 'price-asc') sorted.sort(function (a, b) { return a.priceNum - b.priceNum; });
      else if (state.sort === 'price-desc') sorted.sort(function (a, b) { return b.priceNum - a.priceNum; });
      else if (state.sort === 'bestselling') sorted.sort(function (a, b) { return b.sold - a.sold; });
      else if (state.sort === 'rating-desc') sorted.sort(function (a, b) { return b.rating - a.rating || b.reviews - a.reviews; });
      return sorted;
    }

    function renderPagination(totalPages) {
      if (totalPages <= 1) { shopPagination.innerHTML = ''; return; }
      var html = '';
      html += '<button class="page-btn arrow" data-page="prev" aria-label="السابق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg></button>';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button class="page-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }
      html += '<button class="page-btn arrow" data-page="next" aria-label="التالي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
      shopPagination.innerHTML = html;

      shopPagination.querySelectorAll('.page-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = btn.getAttribute('data-page');
          if (val === 'prev') state.page = Math.max(1, state.page - 1);
          else if (val === 'next') state.page = Math.min(totalPages, state.page + 1);
          else state.page = Number(val);
          renderGrid();
          shopGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    function renderGrid() {
      currentList = sortList(computeFiltered());
      var total = currentList.length;
      var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      state.page = Math.min(Math.max(1, state.page), totalPages);
      var start = (state.page - 1) * PAGE_SIZE;
      var pageItems = currentList.slice(start, start + PAGE_SIZE);

      if (!total) {
        shopGrid.innerHTML = '<div class="shop-no-results"><h4>لا توجد منتجات مطابقة</h4><p>جرّب تعديل الفلاتر أو مسحها لعرض المزيد من النتائج.</p></div>';
        shopResultCount.innerHTML = 'لا توجد نتائج';
      } else {
        shopGrid.innerHTML = pageItems.map(shopCardHtml).join('');
        syncWishlistButtons(shopGrid);
        var from = start + 1, to = Math.min(start + PAGE_SIZE, total);
        shopResultCount.innerHTML = 'عرض <strong>' + from + '–' + to + '</strong> من أصل <strong>' + total + '</strong> منتج';
      }
      if (mobileResultCount) mobileResultCount.innerHTML = shopResultCount.innerHTML;
      renderPagination(totalPages);
    }

    function syncTabsFromCategories() {
      if (!shopTabs) return;
      var tabs = shopTabs.querySelectorAll('.tab-btn');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      if (state.categories.length === 1) {
        var match = shopTabs.querySelector('.tab-btn[data-cat="' + state.categories[0] + '"]');
        if (match) { match.classList.add('active'); return; }
      }
      var allTab = shopTabs.querySelector('.tab-btn[data-cat="all"]');
      if (allTab) allTab.classList.add('active');
    }

    function applyFilters() {
      state.categories = Array.prototype.map.call(
        document.querySelectorAll('#shopFilters [data-cat]:checked'),
        function (el) { return el.getAttribute('data-cat'); }
      );
      state.materials = Array.prototype.map.call(
        document.querySelectorAll('#shopFilters [data-material]:checked'),
        function (el) { return el.getAttribute('data-material'); }
      );
      state.colors = Array.prototype.map.call(
        document.querySelectorAll('#colorSwatches .swatch.active'),
        function (el) { return el.getAttribute('data-color'); }
      );
      state.search = shopSearchInput ? shopSearchInput.value : '';
      state.page = 1;
      syncTabsFromCategories();
      renderGrid();
      var mobileFilterBtnEl = document.getElementById('mobileFilterBtn');
      if (mobileFilterBtnEl) {
        var hasActiveFilters = !!(state.categories.length || state.materials.length || state.colors.length ||
          (onSaleOnly && onSaleOnly.checked) || (priceRange && Number(priceRange.value) < Number(priceRange.max)));
        mobileFilterBtnEl.classList.toggle('has-active', hasActiveFilters);
      }
    }

    /* Tabs */
    if (shopTabs) {
      shopTabs.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var cat = tab.getAttribute('data-cat');
          categoryChecks.forEach(function (chk) {
            chk.checked = (cat !== 'all' && chk.getAttribute('data-cat') === cat);
          });
          applyFilters();
        });
      });
    }

    /* Category & material checkboxes */
    categoryChecks.forEach(function (chk) { chk.addEventListener('change', applyFilters); });
    materialChecks.forEach(function (chk) { chk.addEventListener('change', applyFilters); });

    /* Price range */
    if (priceRange && priceMaxLabel) {
      priceRange.addEventListener('input', function () {
        priceMaxLabel.textContent = Number(priceRange.value).toLocaleString('en-US') + ' ج.م';
      });
      priceRange.addEventListener('change', applyFilters);
    }

    /* On-sale toggle */
    if (onSaleOnly) onSaleOnly.addEventListener('change', applyFilters);

    /* Color swatches (multi-select) */
    colorSwatches.forEach(function (sw) {
      sw.setAttribute('aria-pressed', 'false');
      sw.addEventListener('click', function () {
        sw.classList.toggle('active');
        sw.setAttribute('aria-pressed', sw.classList.contains('active') ? 'true' : 'false');
        applyFilters();
      });
    });

    /* Search box (debounced live filtering) */
    if (shopSearchInput) {
      var searchDebounce;
      shopSearchInput.addEventListener('input', function () {
        if (shopSearchInputMobile && shopSearchInputMobile.value !== shopSearchInput.value) {
          shopSearchInputMobile.value = shopSearchInput.value;
        }
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(applyFilters, 200);
      });
    }
    /* Mobile persistent search box — mirrors into the (hidden-on-mobile) desktop input and
       dispatches its native "input" event so it reuses the exact same debounced handler above,
       instead of duplicating the filtering logic. */
    if (shopSearchInputMobile && shopSearchInput) {
      shopSearchInputMobile.addEventListener('input', function () {
        shopSearchInput.value = shopSearchInputMobile.value;
        shopSearchInput.dispatchEvent(new Event('input'));
      });
    }

    /* Sort */
    if (shopSort) {
      shopSort.addEventListener('change', function () {
        state.sort = shopSort.value;
        state.page = 1;
        renderGrid();
      });
    }

    /* Reset & apply buttons */
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function () {
        categoryChecks.forEach(function (c) { c.checked = false; });
        materialChecks.forEach(function (c) { c.checked = false; });
        colorSwatches.forEach(function (s) { s.classList.remove('active'); s.setAttribute('aria-pressed', 'false'); });
        if (onSaleOnly) onSaleOnly.checked = false;
        if (shopSearchInput) shopSearchInput.value = '';
        if (shopSearchInputMobile) shopSearchInputMobile.value = '';
        priceRange.value = priceRange.max;
        priceMaxLabel.textContent = Number(priceRange.max).toLocaleString('en-US') + ' ج.م';
        if (shopSort) shopSort.value = 'newest';
        state.sort = 'newest';
        applyFilters();
      });
    }
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);

    /* ---------- Mobile: filter bottom sheet ---------- */
    var mobileFilterBtn = document.getElementById('mobileFilterBtn');
    var filterSheetClose = document.getElementById('filterSheetClose');
    var shopFiltersAside = document.getElementById('shopFilters');
    var mobileSheetBackdrop = document.getElementById('mobileSheetBackdrop');
    var mobileSortBtn = document.getElementById('mobileSortBtn');
    var sortSheet = document.getElementById('sortSheet');
    var sortSheetClose = document.getElementById('sortSheetClose');

    function closeAllShopSheets() {
      if (shopFiltersAside) shopFiltersAside.classList.remove('sheet-open');
      if (sortSheet) sortSheet.classList.remove('open');
      if (mobileSheetBackdrop && mobileSheetBackdrop.classList.contains('open')) {
        mobileSheetBackdrop.classList.remove('open');
        unlockScroll();
      }
      if (mobileFilterBtn) mobileFilterBtn.setAttribute('aria-expanded', 'false');
      if (mobileSortBtn) mobileSortBtn.setAttribute('aria-expanded', 'false');
    }

    if (mobileFilterBtn && shopFiltersAside && mobileSheetBackdrop) {
      mobileFilterBtn.addEventListener('click', function () {
        var isOpen = shopFiltersAside.classList.contains('sheet-open');
        closeAllShopSheets();
        if (!isOpen) {
          shopFiltersAside.classList.add('sheet-open');
          mobileSheetBackdrop.classList.add('open');
          mobileFilterBtn.setAttribute('aria-expanded', 'true');
          lockScroll();
        }
      });
    }
    if (filterSheetClose) filterSheetClose.addEventListener('click', closeAllShopSheets);
    /* Applying filters on mobile also closes the sheet so the updated grid is visible */
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', closeAllShopSheets);

    /* ---------- Mobile: sort bottom sheet ---------- */
    function setActiveSortOption(value) {
      if (!sortSheet) return;
      sortSheet.querySelectorAll('.sort-option').forEach(function (opt) {
        opt.classList.toggle('active', opt.getAttribute('data-sort') === value);
      });
      if (mobileSortBtn) mobileSortBtn.classList.toggle('has-active', value !== 'newest');
    }
    if (mobileSortBtn && sortSheet && mobileSheetBackdrop) {
      mobileSortBtn.addEventListener('click', function () {
        var isOpen = sortSheet.classList.contains('open');
        closeAllShopSheets();
        if (!isOpen) {
          setActiveSortOption(state.sort);
          sortSheet.classList.add('open');
          mobileSheetBackdrop.classList.add('open');
          mobileSortBtn.setAttribute('aria-expanded', 'true');
          lockScroll();
        }
      });
      sortSheet.querySelectorAll('.sort-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          var val = opt.getAttribute('data-sort');
          if (shopSort) shopSort.value = val;
          state.sort = val;
          state.page = 1;
          setActiveSortOption(val);
          renderGrid();
          closeAllShopSheets();
        });
      });
    }
    if (sortSheetClose) sortSheetClose.addEventListener('click', closeAllShopSheets);
    if (mobileSheetBackdrop) mobileSheetBackdrop.addEventListener('click', closeAllShopSheets);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllShopSheets();
    });

    /* Initial render — read ?cat= and ?search= from URL for deep-linking from other pages */
    var urlParams = new URLSearchParams(window.location.search);
    var initialCat = urlParams.get('cat');
    if (initialCat && categoryData[initialCat]) {
      var initialChk = document.querySelector('#shopFilters [data-cat="' + initialCat + '"]');
      if (initialChk) initialChk.checked = true;
    }
    var initialSearch = urlParams.get('search');
    if (initialSearch && shopSearchInput) {
      shopSearchInput.value = initialSearch;
      if (shopSearchInputMobile) shopSearchInputMobile.value = initialSearch;
    }
    applyFilters();
  }

  /* ==========================================================================
     CART PAGE — render items, qty controls, remove, summary, WhatsApp checkout
     ========================================================================== */
  var cartRoot = document.getElementById('cartRoot');
  if (cartRoot) {
    var STORE_WA_NUMBER = '201068300432';

    function minusIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>'; }
    function plusIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'; }
    function lockIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/></svg>'; }
    function removeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }
    function xSmallIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }

    var EGYPT_GOVERNORATES = [
      'القاهرة','الجيزة','الإسكندرية','أسوان','الأقصر','بورسعيد','السويس','الدقهلية','الشرقية',
      'الغربية','المنوفية','القليوبية','البحيرة','كفر الشيخ','دمياط','بني سويف','الفيوم','المنيا',
      'أسيوط','سوهاج','قنا','البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء'
    ];

    function renderCartPage() {
      var cart = AnttikkaCart.getCart();

      if (!cart.length) {
        cartRoot.innerHTML =
          '<div class="cart-empty">' +
            '<span class="cart-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"></path></svg></span>' +
            '<h3>سلتك فارغة حالياً</h3>' +
            '<p>لم تتم إضافة أي منتجات بعد. تصفّح المتجر واختر ما يناسب مساحتك.</p>' +
            '<a href="shop.html" class="btn btn-dark">تصفّح المتجر</a>' +
          '</div>';
        return;
      }

      var summaryItemsHtml = cart.map(function (it) {
        var variantHtml = it.cat ? '<span class="summary-item-variant">' + it.cat + '</span>' : '';
        return (
          '<div class="summary-item" data-id="' + it.id + '">' +
            '<div class="summary-item-media">' +
              '<img src="' + it.img + '" alt="' + it.name + '" loading="lazy">' +
            '</div>' +
            '<div class="summary-item-info">' +
              '<span class="summary-item-name">' + it.name + '</span>' +
              variantHtml +
              '<div class="summary-item-qty">' +
                '<button type="button" data-qty-minus="' + it.id + '" aria-label="إنقاص الكمية">' + minusIcon() + '</button>' +
                '<span class="qty-num">' + it.qty + '</span>' +
                '<button type="button" data-qty-plus="' + it.id + '" aria-label="زيادة الكمية">' + plusIcon() + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="summary-item-right">' +
              '<button type="button" class="summary-item-remove" data-remove="' + it.id + '" aria-label="حذف من السلة">' + xSmallIcon() + '</button>' +
              '<span class="summary-item-price">' + AnttikkaCart.fmt(it.price * it.qty) + ' ج.م</span>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      var subtotal = AnttikkaCart.subtotal(cart);
      var grandTotal = AnttikkaCart.total(cart);
      var discount = AnttikkaCart.discountTotal(cart);
      var discountRowHtml = discount > 0
        ? '<div class="cart-summary-row cart-summary-discount"><span>الخصم</span><span class="cart-summary-neg">-' + AnttikkaCart.fmt(discount) + ' ج.م</span></div>'
        : '';

      var govOptionsHtml = EGYPT_GOVERNORATES.map(function (g) {
        return '<option' + (g === 'أسوان' ? ' selected' : '') + '>' + g + '</option>';
      }).join('');

      cartRoot.innerHTML =
        '<div class="cart-layout checkout-layout">' +

          '<div class="checkout-form">' +

            '<div class="checkout-section">' +
              '<h3>معلومات التواصل</h3>' +
              '<div class="checkout-field"><input type="text" id="ckContact" placeholder="البريد الإلكتروني أو رقم الهاتف"></div>' +
              '<label class="checkout-check"><input type="checkbox" id="ckNews"><span>راسلني بالعروض والأخبار</span></label>' +
            '</div>' +

            '<div class="checkout-section">' +
              '<h3>عنوان التوصيل</h3>' +
              '<div class="checkout-field">' +
                '<select id="ckCountry" disabled><option selected>مصر</option></select>' +
              '</div>' +
              '<div class="checkout-row-2">' +
                '<input type="text" id="ckFirstName" placeholder="الاسم الأول">' +
                '<input type="text" id="ckLastName" placeholder="اسم العائلة">' +
              '</div>' +
              '<div class="checkout-field"><input type="text" id="ckAddress" placeholder="العنوان"></div>' +
              '<div class="checkout-row-3">' +
                '<input type="text" id="ckCity" placeholder="المدينة">' +
                '<select id="ckGov">' + govOptionsHtml + '</select>' +
                '<input type="text" id="ckPostal" placeholder="الرمز البريدي (اختياري)">' +
              '</div>' +
              '<div class="checkout-field"><input type="tel" id="ckPhone" placeholder="رقم الهاتف"></div>' +
              '<label class="checkout-check"><input type="checkbox" id="ckSaveInfo"><span>احفظ هذه المعلومات للمرة القادمة</span></label>' +
            '</div>' +

            '<div class="checkout-section">' +
              '<h3>الدفع</h3>' +
              '<p class="checkout-muted">جميع المعاملات آمنة ومشفّرة بالكامل.</p>' +
              '<p class="checkout-muted checkout-deposit-note">المقدم 25%</p>' +
              '<label class="checkout-radio checkout-option is-selected">' +
                '<input type="radio" name="ckPayment" value="InstaPay" checked>' +
                '<span class="checkout-radio-label">InstaPay</span>' +
              '</label>' +
              '<label class="checkout-radio checkout-option">' +
                '<input type="radio" name="ckPayment" value="Vodafone Cash">' +
                '<span class="checkout-radio-label">Vodafone Cash</span>' +
              '</label>' +
              '<label class="checkout-radio checkout-option">' +
                '<input type="radio" name="ckPayment" value="Sympl">' +
                '<span class="checkout-radio-label">Sympl</span>' +
              '</label>' +
              '<label class="checkout-radio checkout-option">' +
                '<input type="radio" name="ckPayment" value="Souhoola">' +
                '<span class="checkout-radio-label">Souhoola</span>' +
              '</label>' +
            '</div>' +

            '<button type="button" class="btn btn-gold checkout-complete-btn" id="cartCheckoutBtn">إتمام الطلب</button>' +
            '<a href="privacy.html" class="checkout-privacy-link">سياسة الخصوصية</a>' +

          '</div>' +

          '<aside class="cart-summary checkout-summary" aria-label="ملخص الطلب">' +
            '<div class="summary-items">' + summaryItemsHtml + '</div>' +
            '<div class="cart-summary-row"><span>الإجمالي الفرعي</span><span>' + AnttikkaCart.fmt(subtotal) + ' ج.م</span></div>' +
            discountRowHtml +
            '<div class="cart-summary-row"><span>الشحن</span><span class="cart-shipping-free">مجاني</span></div>' +
            '<div class="cart-summary-row total"><span>الإجمالي</span><span>' + AnttikkaCart.fmt(grandTotal) + ' ج.م</span></div>' +
            '<a href="shop.html" class="btn btn-outline cart-continue-link">متابعة التسوق</a>' +
            '<div class="cart-trust">' +
              '<div class="cart-trust-badges">' +
                '<span class="payment-icon">InstaPay</span>' +
                '<span class="payment-icon">Vodafone Cash</span>' +
                '<span class="payment-icon">Sympl</span>' +
                '<span class="payment-icon">Souhoola</span>' +
              '</div>' +
              '<p class="cart-trust-msg">' + lockIcon() + '<span>الدفع آمن ومشفّر بالكامل — بياناتك محمية دائماً.</span></p>' +
            '</div>' +
          '</aside>' +

        '</div>';

      cartRoot.querySelectorAll('[data-qty-plus]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-qty-plus');
          var item = AnttikkaCart.getCart().find(function (c) { return c.id === id; });
          AnttikkaCart.setQty(id, (item ? item.qty : 1) + 1);
          renderCartPage();
        });
      });
      cartRoot.querySelectorAll('[data-qty-minus]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-qty-minus');
          var item = AnttikkaCart.getCart().find(function (c) { return c.id === id; });
          if (item && item.qty <= 1) { AnttikkaCart.removeItem(id); }
          else { AnttikkaCart.setQty(id, (item ? item.qty : 1) - 1); }
          renderCartPage();
        });
      });
      cartRoot.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          AnttikkaCart.removeItem(btn.getAttribute('data-remove'));
          renderCartPage();
        });
      });

      /* Keeps the visual "selected" state in sync across all checkout radio
         groups (currently just payment method) as the user clicks between them. */
      cartRoot.querySelectorAll('.checkout-radio input').forEach(function (radio) {
        radio.addEventListener('change', function () {
          cartRoot.querySelectorAll('.checkout-radio').forEach(function (label) {
            label.classList.toggle('is-selected', label.contains(radio) ? radio.checked : label.querySelector('input').checked);
          });
        });
      });

      var checkoutBtn = document.getElementById('cartCheckoutBtn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function () {
          var currentCart = AnttikkaCart.getCart();
          var selectedPayment = (cartRoot.querySelector('input[name="ckPayment"]:checked') || {}).value || '—';
          var contactInfo =
            '\nالتواصل: ' + ((document.getElementById('ckContact') || {}).value || '—') +
            '\nالاسم: ' + ((document.getElementById('ckFirstName') || {}).value || '') + ' ' + ((document.getElementById('ckLastName') || {}).value || '') +
            '\nالعنوان: ' + ((document.getElementById('ckAddress') || {}).value || '—') + '، ' + ((document.getElementById('ckCity') || {}).value || '') + '، ' + ((document.getElementById('ckGov') || {}).value || '') +
            '\nالهاتف: ' + ((document.getElementById('ckPhone') || {}).value || '—') +
            '\nطريقة الدفع: ' + selectedPayment;

          var msg = AnttikkaCart.buildMessage(currentCart) + '\n' + contactInfo;
          window.open('https://wa.me/' + STORE_WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        });
      }
    }

    renderCartPage();
    document.addEventListener('cart:change', renderCartPage);
  }

  /* ==========================================================================
     WISHLIST PAGE — render saved products as a grid with remove + add-to-cart
     ========================================================================== */
  var wishlistRoot = document.getElementById('wishlistRoot');
  if (wishlistRoot) {
    function renderWishlistPage() {
      var list = AnttikkaWishlist.getList();

      if (!list.length) {
        wishlistRoot.innerHTML =
          '<div class="cart-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.4 2 5 5.3 5c2 0 3.4 1.1 4.2 2.3.3.5 1.3 2 1.3 2s1-1.5 1.3-2C13 6.1 14.5 5 16.4 5c3.3 0 5 3.4 3.4 6.8C19.5 16.4 12 21 12 21z"/></svg>' +
            '<h3>مفضلتك فارغة حالياً</h3>' +
            '<p>اضغط على أيقونة القلب في أي منتج يعجبك لحفظه هنا والرجوع إليه لاحقاً.</p>' +
            '<a href="shop.html" class="btn btn-dark">تصفّح المتجر</a>' +
          '</div>';
        return;
      }

      wishlistRoot.innerHTML =
        '<div class="product-grid cols-4">' +
          list.map(function (it) {
            var badge = it.off ? '<span class="badge-sale">خصم ' + it.off + '</span>' : '';
            var priceOld = it.oldPrice ? '<span class="price-old">' + AnttikkaCart.fmt(it.oldPrice) + ' ج.م</span>' : '';
            var priceOff = it.off ? '<span class="price-off">خصم ' + it.off + '</span>' : '';
            return (
              '<article class="product-card shop-card" data-id="' + it.id + '">' +
                '<div class="product-media">' +
                  badge +
                  '<button class="wishlist-btn active wishlist-remove-btn" aria-label="إزالة من المفضلة">' + heartIcon() + '</button>' +
                  '<img src="' + it.img + '" alt="' + it.name + '" loading="lazy">' +
                  '<div class="product-actions">' +
                    '<button type="button" class="icon-btn-outline" aria-label="عرض سريع">' + eyeIcon() + '</button>' +
                    '<button type="button" class="btn-cart-inline wishlist-add-cart-btn" aria-label="أضف للسلة"><span>أضف للسلة</span></button>' +
                  '</div>' +
                '</div>' +
                '<div class="product-info">' +
                  '<h3 class="product-name"><a href="product.html">' + it.name + '</a></h3>' +
                  '<div class="product-price"><span class="price-now">' + AnttikkaCart.fmt(it.price) + ' ج.م</span>' + priceOld + priceOff + '</div>' +
                  '<button type="button" class="btn-cart-inline mobile-add-cart-btn wishlist-add-cart-btn" aria-label="أضف للسلة">' + bagIcon() + '<span>أضف للسلة</span></button>' +
                '</div>' +
              '</article>'
            );
          }).join('') +
        '</div>';

      wishlistRoot.querySelectorAll('.wishlist-add-cart-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.product-card');
          var id = card.getAttribute('data-id');
          var item = AnttikkaWishlist.getList().find(function (it) { return it.id === id; });
          if (item) {
            AnttikkaCart.addItem(item);
            AnttikkaCart.toast('تمت إضافة "' + item.name + '" إلى السلة');
          }
        });
      });
    }

    renderWishlistPage();
    /* The remove button reuses the global .wishlist-btn delegated handler (it toggles the
       item out of storage, updates the badge, and shows a toast) — this page just needs to
       re-render itself whenever the wishlist changes, from this button or any other on the site. */
    document.addEventListener('wishlist:change', renderWishlistPage);
  }
});


const video = document.getElementById("processVideo");
const playBtn = document.getElementById("processPlayBtn");

if (video && playBtn) {
  playBtn.addEventListener("click", () => {
      if (video.paused) {
          video.play();
          video.setAttribute("controls", "");
          playBtn.style.display = "none";
      } else {
          video.pause();
          playBtn.style.display = "flex";
      }
  });

  video.addEventListener("ended", () => {
      playBtn.style.display = "flex";
  });

  video.addEventListener("pause", () => {
      playBtn.style.display = "flex";
  });
}

/* ---------- Site-wide floating video widget (bottom-left, PiP style, auto-opens on every page) ---------- */
(function () {
  var path = window.location.pathname.split("/").pop();
  var isHome = path === "" || path === "index.html";
  if (!isHome) return;

  var VIDEO_SRC = "images/WhatsApp Video 2026-07-15 at 12.53.35 PM.mp4";

  var widget = document.createElement("div");
  widget.className = "floating-video-widget";
  widget.setAttribute("role", "complementary");
  widget.setAttribute("aria-label", "فيديو مصغّر: استكشف مجموعتنا الفاخرة");

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "floating-video-widget-close";
  closeBtn.setAttribute("aria-label", "إغلاق الفيديو المصغّر");
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var vid = document.createElement("video");
  vid.src = VIDEO_SRC;
  vid.muted = true;
  vid.loop = true;
  vid.playsInline = true;
  vid.preload = "metadata";
  vid.setAttribute("aria-hidden", "true");
  vid.tabIndex = -1;

  widget.appendChild(closeBtn);
  widget.appendChild(vid);
  document.body.appendChild(widget);

  function closeWidget() {
    widget.classList.remove("open");
    vid.pause();
    window.setTimeout(function () {
      if (widget.parentNode) widget.parentNode.removeChild(widget);
    }, 420);
  }

  closeBtn.addEventListener("click", closeWidget);
  closeBtn.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeWidget();
  });

  window.setTimeout(function () {
    widget.classList.add("open");
    vid.play().catch(function () { /* autoplay may be blocked by the browser; widget still shows */ });
  }, 900);
})();