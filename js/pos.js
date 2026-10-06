'use strict';

(() => {
  const products = [
    { id: 'coffee', name: 'Coffee', price: 4500 },
    { id: 'sandwich', name: 'Sandwich', price: 5000 },
    { id: 'soft-drink', name: 'Soft Drink', price: 3500 },
    { id: 'cookies', name: 'Cookies', price: 2500 },
    { id: 'bottled-water', name: 'Bottled Water', price: 2000 },
    { id: 'chocolate', name: 'Chocolate', price: 2500 }
  ];
  const cart = [];
  const maxQuantity = 20;
  const panel = document.querySelector('.cart-panel');
  const populated = panel.querySelector('[data-order="populated"]');
  const empty = panel.querySelector('[data-order="empty"]');
  const itemCount = populated.querySelector('.item-count');
  // Reuse the existing row, including its classes and trash icon.
  const rowTemplate = populated.querySelector('.cart-item').cloneNode(true);
  const review = document.getElementById('review');
  const reviewTable = review.querySelector('.order-table');
  const reviewRowTemplate = reviewTable.querySelector('.table-row').cloneNode(true);

  review.querySelector('.view-heading p.muted').textContent =
    'Here’s your order. Everything look good?';

  function formatMoney(centavos) {
    return `P${(centavos / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function showMessage(message) {
    document.getElementById('view-announcement').textContent = message;
  }

  function addItem(productId) {
    const existing = cart.find(item => item.id === productId);
    if (existing) {
      const previousQuantity = existing.quantity;
      changeQuantity(productId, 1);
      if (existing.quantity > previousQuantity) showMessage(`${existing.name} added`);
      return;
    }
    const product = products.find(item => item.id === productId);
    if (!product) return;
    cart.push({ ...product, quantity: 1 });
    renderCart();
    showMessage(`${product.name} added`);
  }

  function removeItem(productId) {
    const index = cart.findIndex(item => item.id === productId);
    if (index === -1) return;
    const name = cart[index].name;
    cart.splice(index, 1);
    renderCart();
    showMessage(`${name} removed`);
  }

  function changeQuantity(productId, change) {
    const index = cart.findIndex(item => item.id === productId);
    if (index === -1) return;
    const item = cart[index];
    const quantity = item.quantity + change;
    if (quantity > maxQuantity) {
      window.alert(`Maximum ${maxQuantity} per item reached for ${item.name}.`);
      return;
    }
    if (quantity < 1) cart.splice(index, 1);
    else item.quantity = quantity;
    renderCart();
  }

  function getTotal() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  function getItemCount() {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function renderReview() {
    reviewTable.querySelectorAll('.table-row').forEach(row => row.remove());
    cart.forEach(item => {
      const row = reviewRowTemplate.cloneNode(true);
      row.querySelector('[role="cell"] strong').textContent = item.name;
      const card = document.querySelector(`.product-card[data-product-id="${item.id}"]`);
      const icon = card.querySelector('svg.product-icon').cloneNode(true);
      icon.setAttribute('class', 'icon');
      row.querySelector('svg.icon').replaceWith(icon);
      row.querySelector('[data-label="Quantity"]').textContent = item.quantity;
      row.querySelector('[data-label="Unit price"]').textContent = formatMoney(item.price);
      row.querySelector('[data-label="Subtotal"] strong').textContent =
        formatMoney(item.price * item.quantity);
      reviewTable.appendChild(row);
    });
    const count = getItemCount();
    review.querySelector('.review-panel .panel-heading .pill').textContent =
      `${count} ${count === 1 ? 'item' : 'items'}`;
    review.querySelector('.review-total strong').textContent = formatMoney(getTotal());
  }

  function renderCart() {
    populated.querySelectorAll('.cart-item').forEach(row => row.remove());
    cart.forEach(item => {
      const row = rowTemplate.cloneNode(true);
      row.dataset.productId = item.id;
      row.querySelector('.cart-name strong').textContent = item.name;
      const removeButton = row.querySelector('.remove');
      removeButton.disabled = false;
      removeButton.setAttribute('aria-label', `Remove ${item.name}`);
      row.querySelector('p.muted').textContent = `${formatMoney(item.price)} each`;
      const buttons = row.querySelectorAll('.quantity button');
      buttons.forEach((button, index) => {
        button.disabled = false;
        button.dataset.change = index === 0 ? '-1' : '1';
        button.setAttribute('aria-label',
          `${index === 0 ? 'Decrease' : 'Increase'} ${item.name} quantity`);
      });
      const quantity = row.querySelector('.quantity span');
      quantity.textContent = item.quantity;
      quantity.setAttribute('aria-label', `Quantity ${item.quantity}`);
      const subtotal = row.querySelector('.cart-controls > strong');
      subtotal.textContent = formatMoney(item.price * item.quantity);
      subtotal.setAttribute('aria-label', `Subtotal ${subtotal.textContent}`);
      populated.querySelector('.cart-items').appendChild(row);
    });
    const count = getItemCount();
    itemCount.textContent = `${count} ${count === 1 ? 'item' : 'items'} · ${cart.length} ${cart.length === 1 ? 'favorite' : 'favorites'}`;
    panel.querySelectorAll('.cart-total strong').forEach(total => {
      total.textContent = formatMoney(getTotal());
    });
    populated.hidden = cart.length === 0;
    empty.hidden = cart.length > 0;
    renderReview();
  }

  document.querySelectorAll('.product-card').forEach(card => {
    const product = products.find(item => item.name === card.querySelector('strong').textContent.trim());
    if (!product) return;
    card.disabled = false;
    card.dataset.productId = product.id;
    card.setAttribute('aria-label', `${product.name}, ${formatMoney(product.price)}. Add product.`);
  });

  // Registered after navigation.js: its screen changes finish before this runs.
  document.addEventListener('click', event => {
    const card = event.target.closest('.product-card');
    const button = event.target.closest('.cart-panel .quantity button');
    const removeButton = event.target.closest('.cart-panel .remove');
    if (card) addItem(card.dataset.productId);
    else if (removeButton) {
      removeItem(removeButton.closest('.cart-item').dataset.productId);
    }
    else if (button) {
      changeQuantity(button.closest('.cart-item').dataset.productId, Number(button.dataset.change));
    } else if (event.target.closest('[data-view], [data-preview]')) {
      renderCart();
    }
  });

  renderCart();
})();
