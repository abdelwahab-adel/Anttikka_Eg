/* ==========================================================================
   OPULENT SPACES — main.js
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
window.OpulentCart = (function () {
  var STORAGE_KEY = 'opulent_cart_v1';
  /* TODO: replace with the store's real WhatsApp number (international format, no + or spaces) */
  var STORE_WHATSAPP_NUMBER = '966500000000';

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
        qty: item.qty || 1
      });
    }
    saveCart(cart);
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
    var lines = ['مرحباً، أرغب في إتمام طلب من متجر أوبولنت سبيسز:', ''];
    items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name);
      lines.push('   الكمية: ' + it.qty);
      if (it.off && it.oldPrice) {
        lines.push('   السعر: ' + fmt(it.price) + ' ر.س للقطعة (بعد خصم ' + it.off + '، السعر الأصلي ' + fmt(it.oldPrice) + ' ر.س)');
      } else {
        lines.push('   السعر: ' + fmt(it.price) + ' ر.س للقطعة');
      }
      lines.push('   الإجمالي الفرعي: ' + fmt(it.price * it.qty) + ' ر.س');
      lines.push('');
    });
    lines.push('---');
    lines.push('الإجمالي الكلي: ' + fmt(total(items)) + ' ر.س');
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
    return { id: slugify(name), name: name, img: img, price: price || 0, oldPrice: oldPrice, off: off, qty: 1 };
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

  return {
    getCart: getCart, addItem: addItem, removeItem: removeItem, setQty: setQty,
    clearCart: clearCart, count: count, total: total, fmt: fmt,
    buildMessage: buildMessage, checkoutUrl: checkoutUrl, checkout: checkout,
    extractFromCard: extractFromCard, renderBadges: renderBadges, toast: toast
  };
})();

document.addEventListener('DOMContentLoaded', function () {

  OpulentCart.renderBadges();

  /* ---------- Site-wide "add to cart" wiring (delegated, no per-card markup needed) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.icon-btn[aria-label="أضف للسلة"], .btn-cart-inline');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.product-card');
    var item = OpulentCart.extractFromCard(card);
    if (item) {
      OpulentCart.addItem(item);
      OpulentCart.toast('تمت إضافة "' + item.name + '" إلى السلة');
    }
  });

  /* ---------- Contact page: send message via WhatsApp ---------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('cfName').value.trim();
      var phone = document.getElementById('cfPhone').value.trim();
      var subject = document.getElementById('cfSubject').value.trim();
      var message = document.getElementById('cfMessage').value.trim();

      var lines = ['رسالة جديدة من نموذج التواصل — أوبولنت سبيسز', ''];
      lines.push('الاسم: ' + name);
      lines.push('الهاتف: ' + phone);
      if (subject) lines.push('الموضوع: ' + subject);
      lines.push('');
      lines.push('الرسالة:');
      lines.push(message);

      var url = 'https://wa.me/966500000000?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener');
    });
  }

  /* ---------- Header scroll state ---------- */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav drawer ---------- */
  var menuToggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');
  var mobileNavClose = document.getElementById('mobileNavClose');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', function () { mobileNav.classList.add('open'); });
  }
  if (mobileNavClose && mobileNav) {
    mobileNavClose.addEventListener('click', function () { mobileNav.classList.remove('open'); });
  }
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobileNav.classList.remove('open'); });
    });
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

  /* ---------- Wishlist toggle ---------- */
  document.querySelectorAll('.wishlist-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      btn.classList.toggle('active');
    });
  });

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
      { img: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=700&auto=format&fit=crop', cat: 'كراسي', name: 'كرسي لونا الجانبي', price: '19,999', old: '24,999', off: '20%' },
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
      { img: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=700&auto=format&fit=crop', cat: 'سفرة', name: 'طاولة سفرة مستديرة', price: '19,999', old: '24,999', off: '20%' },
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
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h2l2.4 12.2a2 2 0 002 1.8h8.4a2 2 0 002-1.8L21 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>';
  }

  function renderProducts(list) {
    return list.map(function (p) {
      var badge = p.off ? '<span class="badge-sale">خصم ' + p.off + '</span>' : '';
      var priceOld = p.old ? '<span class="price-old">' + p.old + ' ر.س</span>' : '';
      var priceOff = p.off ? '<span class="price-off">خصم ' + p.off + '</span>' : '';
      return (
        '<article class="product-card">' +
          '<div class="product-media">' +
            badge +
            '<button class="wishlist-btn" aria-label="أضف للمفضلة">' + heartIcon() + '</button>' +
            '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
            '<div class="product-actions">' +
              '<button class="icon-btn" aria-label="عرض سريع">' + eyeIcon() + '</button>' +
              '<button class="icon-btn" aria-label="أضف للسلة">' + bagIcon() + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="product-info">' +
            '<span class="product-cat">' + p.cat + '</span>' +
            '<h3 class="product-name"><a href="product.html">' + p.name + '</a></h3>' +
            '<div class="product-rating"><span class="stars">★★★★★</span><span class="count">(80)</span></div>' +
            '<div class="product-price"><span class="price-now">' + p.price + ' ر.س</span>' + priceOld + priceOff + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  var grid = document.getElementById('categoryGrid');
  var tabs = document.getElementById('categoryTabs');
  if (grid && tabs) {
    grid.innerHTML = renderProducts(categoryData.sofas);
    grid.querySelectorAll('.wishlist-btn').forEach(bindWishlist);

    tabs.querySelectorAll('.tab-btn').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var cat = tab.getAttribute('data-cat');
        grid.style.opacity = '0';
        setTimeout(function () {
          grid.innerHTML = renderProducts(categoryData[cat] || []);
          grid.querySelectorAll('.wishlist-btn').forEach(bindWishlist);
          grid.style.opacity = '1';
        }, 180);
      });
    });
    grid.style.transition = 'opacity .25s ease';
  }

  function bindWishlist(btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      btn.classList.toggle('active');
    });
  }

  /* ---------- Product page: thumbnail gallery ---------- */
  var pdpThumbs = document.querySelectorAll('.pdp-thumb');
  var pdpMainImg = document.getElementById('pdpMainImg');
  var pdpDots = document.querySelectorAll('.pdp-dots span');
  if (pdpThumbs.length && pdpMainImg) {
    pdpThumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () {
        pdpThumbs.forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        pdpMainImg.setAttribute('src', thumb.getAttribute('data-img'));
        pdpDots.forEach(function (d) { d.classList.remove('active'); });
        if (pdpDots[i]) pdpDots[i].classList.add('active');
      });
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
      var item = OpulentCart.extractFromCard(pdpInfo);
      var mainImg = document.getElementById('pdpMainImg');
      if (mainImg) item.img = mainImg.getAttribute('src');
      item.qty = parseInt((qtyVal && qtyVal.textContent) || '1', 10) || 1;
      return item;
    };
    if (pdpAddToCart) {
      pdpAddToCart.addEventListener('click', function () {
        var item = getPdpItem();
        OpulentCart.addItem(item);
        OpulentCart.toast('تمت إضافة "' + item.name + '" إلى السلة');
      });
    }
    if (pdpBuyNow) {
      pdpBuyNow.addEventListener('click', function () {
        OpulentCart.checkout([getPdpItem()]);
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

    var ALL_PRODUCTS = [];
    Object.keys(categoryData).forEach(function (cat) {
      categoryData[cat].forEach(function (p, i) {
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
          colorKey: colorMap[cat][i % colorMap[cat].length]
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
    var shopResultCount = document.getElementById('shopResultCount');
    var shopPagination = document.getElementById('shopPagination');
    var resetFiltersBtn = document.getElementById('resetFilters');
    var applyFiltersBtn = document.getElementById('applyFiltersBtn');
    var categoryChecks = document.querySelectorAll('#shopFilters [data-cat]');
    var materialChecks = document.querySelectorAll('#shopFilters [data-material]');
    var colorSwatches = document.querySelectorAll('#colorSwatches .swatch');

    var PAGE_SIZE = 15;
    var state = { categories: [], materials: [], colors: [], sort: 'newest', page: 1 };
    var currentList = ALL_PRODUCTS.slice();

    function shopCardHtml(p) {
      var badge = p.off ? '<span class="badge-sale">خصم ' + p.off + '</span>' : '';
      var priceOld = p.old ? '<span class="price-old">' + p.old + ' ر.س</span>' : '';
      var priceOff = p.off ? '<span class="price-off">خصم ' + p.off + '</span>' : '';
      return (
        '<article class="product-card shop-card">' +
          '<div class="product-media">' +
            badge +
            '<button class="wishlist-btn" aria-label="أضف للمفضلة">' + heartIcon() + '</button>' +
            '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
          '</div>' +
          '<div class="product-info">' +
            '<span class="product-cat">' + p.catLabel + '</span>' +
            '<h3 class="product-name"><a href="product.html">' + p.name + '</a></h3>' +
            '<div class="product-rating"><span class="stars">★★★★★</span><span class="count">(80)</span></div>' +
            '<div class="product-price"><span class="price-now">' + p.price + ' ر.س</span>' + priceOld + priceOff + '</div>' +
            '<div class="shop-card-actions">' +
              '<button class="icon-btn-outline" aria-label="عرض سريع">' + eyeIcon() + '</button>' +
              '<button class="btn-cart-inline">' + bagIcon() + '<span>إضافة للسلة</span></button>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }

    function computeFiltered() {
      return ALL_PRODUCTS.filter(function (p) {
        if (state.categories.length && state.categories.indexOf(p.catKey) === -1) return false;
        if (p.priceNum > Number(priceRange.value)) return false;
        if (state.materials.length && state.materials.indexOf(p.material) === -1) return false;
        if (state.colors.length && state.colors.indexOf(p.colorKey) === -1) return false;
        if (onSaleOnly && onSaleOnly.checked && !p.off) return false;
        return true;
      });
    }

    function sortList(list) {
      var sorted = list.slice();
      if (state.sort === 'price-asc') sorted.sort(function (a, b) { return a.priceNum - b.priceNum; });
      else if (state.sort === 'price-desc') sorted.sort(function (a, b) { return b.priceNum - a.priceNum; });
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
        shopGrid.querySelectorAll('.wishlist-btn').forEach(bindWishlist);
        var from = start + 1, to = Math.min(start + PAGE_SIZE, total);
        shopResultCount.innerHTML = 'عرض <strong>' + from + '–' + to + '</strong> من أصل <strong>' + total + '</strong> منتج';
      }
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
      state.page = 1;
      syncTabsFromCategories();
      renderGrid();
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
        priceMaxLabel.textContent = Number(priceRange.value).toLocaleString('en-US') + ' ر.س';
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
        priceRange.value = priceRange.max;
        priceMaxLabel.textContent = Number(priceRange.max).toLocaleString('en-US') + ' ر.س';
        if (shopSort) shopSort.value = 'newest';
        state.sort = 'newest';
        applyFilters();
      });
    }
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);

    /* Initial render — read ?cat= from URL for deep-linking from other pages */
    var urlParams = new URLSearchParams(window.location.search);
    var initialCat = urlParams.get('cat');
    if (initialCat && categoryData[initialCat]) {
      var initialChk = document.querySelector('#shopFilters [data-cat="' + initialCat + '"]');
      if (initialChk) initialChk.checked = true;
    }
    applyFilters();
  }

  /* ==========================================================================
     CART PAGE — render items, qty controls, remove, summary, WhatsApp checkout
     ========================================================================== */
  var cartRoot = document.getElementById('cartRoot');
  if (cartRoot) {
    function renderCartPage() {
      var cart = OpulentCart.getCart();

      if (!cart.length) {
        cartRoot.innerHTML =
          '<div class="cart-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 6h2l2.4 12.2a2 2 0 002 1.8h8.4a2 2 0 002-1.8L21 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>' +
            '<h3>سلتك فارغة حالياً</h3>' +
            '<p>لم تتم إضافة أي منتجات بعد. تصفّح المتجر واختر ما يناسب مساحتك.</p>' +
            '<a href="shop.html" class="btn btn-dark">تصفّح المتجر</a>' +
          '</div>';
        return;
      }

      var itemsHtml = cart.map(function (it) {
        var oldHtml = it.oldPrice ? '<span class="cart-item-old">' + OpulentCart.fmt(it.oldPrice) + ' ر.س</span>' : '';
        return (
          '<div class="cart-item" data-id="' + it.id + '">' +
            '<div class="cart-item-img"><img src="' + it.img + '" alt="' + it.name + '"></div>' +
            '<div class="cart-item-info">' +
              '<h4>' + it.name + '</h4>' +
              '<div><span class="cart-item-price">' + OpulentCart.fmt(it.price) + ' ر.س</span>' + oldHtml + '</div>' +
            '</div>' +
            '<div class="cart-item-qty">' +
              '<button type="button" class="cart-qty-minus" aria-label="إنقاص الكمية">−</button>' +
              '<span class="qty-num">' + it.qty + '</span>' +
              '<button type="button" class="cart-qty-plus" aria-label="زيادة الكمية">+</button>' +
            '</div>' +
            '<button type="button" class="cart-item-remove" aria-label="إزالة من السلة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
          '</div>'
        );
      }).join('');

      var total = OpulentCart.total(cart);

      cartRoot.innerHTML =
        '<div class="cart-layout">' +
          '<div class="cart-items">' + itemsHtml + '</div>' +
          '<div class="cart-summary">' +
            '<h3>ملخص الطلب</h3>' +
            '<div class="cart-summary-row"><span>عدد القطع</span><span>' + OpulentCart.count(cart) + '</span></div>' +
            '<div class="cart-summary-row total"><span>الإجمالي</span><span>' + OpulentCart.fmt(total) + ' ر.س</span></div>' +
            '<button type="button" class="btn btn-gold cart-checkout-btn" id="cartCheckoutBtn">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1s-.6.8-.8 1c-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4.1-.1 0-.3 0-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.1 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3z"/></svg>' +
              '<span>إتمام الطلب عبر واتساب</span>' +
            '</button>' +
            '<a href="shop.html" class="cart-continue-link">متابعة التسوق</a>' +
          '</div>' +
        '</div>';

      cartRoot.querySelectorAll('.cart-qty-minus').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.cart-item').getAttribute('data-id');
          var current = OpulentCart.getCart().find(function (c) { return c.id === id; });
          if (current) OpulentCart.setQty(id, current.qty - 1 > 0 ? current.qty - 1 : 1);
          renderCartPage();
        });
      });
      cartRoot.querySelectorAll('.cart-qty-plus').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.cart-item').getAttribute('data-id');
          var current = OpulentCart.getCart().find(function (c) { return c.id === id; });
          if (current) OpulentCart.setQty(id, current.qty + 1);
          renderCartPage();
        });
      });
      cartRoot.querySelectorAll('.cart-item-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.cart-item').getAttribute('data-id');
          OpulentCart.removeItem(id);
          renderCartPage();
        });
      });

      var checkoutBtn = document.getElementById('cartCheckoutBtn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function () {
          OpulentCart.checkout(OpulentCart.getCart());
        });
      }
    }

    renderCartPage();
  }
});
