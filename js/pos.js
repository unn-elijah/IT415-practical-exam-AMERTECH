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
  const paymentAmountDue = document.getElementById('payment-amount-due');
  let reviewTotalCentavos = 0;
  let paymentTotalCentavos = 0;
  let cashInput = '';
  let cashReceivedCentavos = 0;
  let cashChangeCentavos = 0;
  let lastTransaction = null;
  const receipt = document.getElementById('receipt');
  const receiptItems = receipt.querySelector('.receipt-items');
  const receiptRowTemplate = receiptItems.querySelector('.receipt-row:not(.receipt-labels)').cloneNode(true);
  const cashPanel = document.getElementById('cash');
  const cashReceived = document.getElementById('cash-received');
  const cashChange = document.getElementById('cash-change');
  const cashConfirm = cashPanel.querySelector('[data-payment="cash"]');
  const cashError = cashPanel.querySelector('#cash-error');
  const qrPanel = document.getElementById('qr');
  const qrConfirm = qrPanel.querySelector('[data-payment="qr"]');
  // Live Server serves the UI; the Node server receives the phone's Done signal.
  const qrServer = new URL(location.protocol === 'file:' ? 'http://localhost:3000' : location.origin);
  qrServer.port = '3000';
  const qrApi = `${qrServer.origin}/api/qr`;
  let qrSession = null;
  let qrDone = false;
  let qrPaidCentavos = 0;
  let qrChangeCentavos = 0;
  let qrTimer = null;
  let qrGeneration = 0;
  let qrLibrary;
  qrConfirm.disabled = true;

  function loadQrLibrary() {
    if (!qrLibrary) qrLibrary = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/qrcodegen.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load the QR generator.'));
      document.head.appendChild(script);
    });
    return qrLibrary;
  }

  function closeQrSession() {
    qrGeneration++;
    clearTimeout(qrTimer);
    if (qrSession) fetch(`${qrApi}/${qrSession}`, { method: 'DELETE' }).catch(() => {});
    qrSession = null;
    qrDone = false;
    qrPaidCentavos = 0;
    qrChangeCentavos = 0;
    qrConfirm.disabled = true;
  }

  async function openQr() {
    closeQrSession();
    const generation = qrGeneration;
    const total = paymentTotalCentavos;
    const note = qrPanel.querySelector('.preview-note');
    const svg = qrPanel.querySelector('svg.qr-art');
    qrPanel.querySelector('.amount-box strong').textContent = formatCurrency(total);
    qrPanel.querySelector('.instructions li:nth-child(2)').textContent =
      `Enter ${formatCurrency(total)} or more on the payment page and tap Done.`;
    qrPanel.querySelector('.instructions li:first-child').textContent = 'Scan the QR code to open the payment page.';
    qrPanel.querySelector('.qr-placeholder strong').textContent = 'QR PAYMENT';
    qrPanel.querySelector('.qr-placeholder span').textContent = 'Scan to enter the amount';
    qrPanel.querySelector('.reference').textContent = '';
    note.textContent = 'Preparing QR payment…';
    try {
      if (!['http:', 'https:'].includes(location.protocol)) {
        throw new Error('Open the kiosk using Live Server or the Node server.');
      }
      if (total <= 0) throw new Error('Add items before choosing QR Payment.');
      await loadQrLibrary();
      if (generation !== qrGeneration) return;
      const response = await fetch(qrApi, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total })
      });
      if (!response.ok) throw new Error('Unable to create QR payment. Check that node server.js is running.');
      const { id, paymentUrl } = await response.json();
      if (generation !== qrGeneration) {
        fetch(`${qrApi}/${id}`, { method: 'DELETE' }).catch(() => {});
        return;
      }
      qrSession = id;
      const link = new URL(paymentUrl);
      const code = qrcodegen.QrCode.encodeText(link.href, qrcodegen.QrCode.Ecc.MEDIUM);
      const size = code.size + 8;
      svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('stroke', 'none');
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', size);
      background.setAttribute('height', size);
      background.setAttribute('fill', 'white');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let modules = '';
      for (let y = 0; y < code.size; y++) {
        for (let x = 0; x < code.size; x++) {
          if (code.getModule(x, y)) modules += `M${x + 4},${y + 4}h1v1h-1z`;
        }
      }
      path.setAttribute('d', modules);
      path.setAttribute('fill', 'black');
      svg.replaceChildren(background, path);
      note.textContent = 'Waiting for Done on the payment page.';
      pollQr(id, generation, total);
    } catch (error) {
      if (generation === qrGeneration) {
        svg.replaceChildren();
        note.textContent = error instanceof TypeError
          ? 'QR server unavailable. Run node server.js, then reopen QR Payment.'
          : error.message;
      }
    }
  }

  async function pollQr(id, generation, total) {
    if (generation !== qrGeneration || qrPanel.hidden) return;
    const note = qrPanel.querySelector('.preview-note');
    try {
      const response = await fetch(`${qrApi}/${id}`, { cache: 'no-store' });
      if (generation !== qrGeneration) return;
      if (response.status === 404) {
        note.textContent = 'Session expired. Reopen QR Payment to get a new code.';
        return;
      }
      if (!response.ok) throw new Error('Unable to check payment.');
      const session = await response.json();
      if (generation !== qrGeneration || qrPanel.hidden) return;
      if (session.done && session.total === total && Number.isSafeInteger(session.paid) && session.paid >= total) {
        qrPaidCentavos = session.paid;
        qrChangeCentavos = session.paid - total;
        qrDone = true;
        qrConfirm.disabled = false;
        note.textContent = `${formatCurrency(session.paid)} entered. Tap Confirm Payment.`;
        return;
      }
    } catch {
      if (generation !== qrGeneration) return;
      note.textContent = 'Connection interrupted. Waiting to reconnect…';
    }
    if (generation === qrGeneration) qrTimer = setTimeout(() => pollQr(id, generation, total), 1000);
  }

  function renderQrSuccess() {
    const details = document.getElementById('success').querySelectorAll('.payment-details > div');
    const values = [formatCurrency(lastTransaction.total), 'QR Payment',
      formatCurrency(lastTransaction.paid), formatCurrency(lastTransaction.change), lastTransaction.reference];
    details.forEach((detail, index) => {
      const span = [...detail.querySelectorAll('[data-method]')]
        .find(element => element.dataset.method.split(' ').includes('qr'));
      if (span) span.textContent = values[index];
    });
  }

  function renderCardSuccess() {
    const details = document.getElementById('success').querySelectorAll('.payment-details > div');
    const values = [formatCurrency(lastTransaction.total), lastTransaction.method,
      formatCurrency(lastTransaction.paid), formatCurrency(lastTransaction.change), lastTransaction.reference];
    details.forEach((detail, index) => {
      const span = [...detail.querySelectorAll('[data-method]')]
        .find(element => element.dataset.method.split(' ').includes('card'));
      span.textContent = values[index];
    });
  }

  cashPanel.querySelector('.quick-amounts').innerHTML =
    [20, 50, 100, 200, 500, 1000].map(amount =>
      `<button type="button" data-cash-amount="${amount * 100}">${formatCurrency(amount * 100)}</button>`
    ).join('') + '<button type="button" data-cash-amount="exact">Exact Amount</button>';
  cashPanel.querySelector('.keypad').innerHTML =
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace', 'clear'].map(key =>
      `<button type="button" data-cash-key="${key}" aria-label="${key === 'backspace' ? 'Backspace' : key}">${key === 'backspace' ? '⌫' : key === 'clear' ? 'Clear' : key}</button>`
    ).join('');
  cashPanel.querySelector('.view-heading p.muted').textContent = 'Enter the cash received to calculate change.';
  cashPanel.querySelector('label[for="amount-paid"]').textContent = 'Cash Received';
  cashPanel.querySelector('#input-note').textContent = 'Use the keypad or a quick amount.';
  cashPanel.querySelector('.quick-amounts').previousElementSibling.textContent = 'Quick amounts';
  cashPanel.querySelector('.keypad').previousElementSibling.textContent = 'Numeric keypad';
  cashConfirm.firstChild.textContent = 'Confirm Payment ';
  cashConfirm.nextElementSibling.textContent = 'Confirm when the cash received covers the total due.';

  function formatCurrency(centavos) {
    return formatMoney(centavos).replace(/^P/, '₱');
  }

  function renderCardPayment() {
    const cardPanel = document.getElementById('card');
    const amount = formatCurrency(paymentTotalCentavos);
    cardPanel.querySelector('.amount-box strong').textContent = amount;
    cardPanel.querySelector('.terminal-art text').textContent = amount;
    cardPanel.querySelector('[data-card="ready"] p.muted').textContent =
      `Present your card at the reader to pay ${amount}.`;
  }

  function getCashReceived() {
    const [pesos, decimals = ''] = cashInput.split('.');
    return Number(pesos || 0) * 100 + Number(decimals.padEnd(2, '0'));
  }

  function updateCash() {
    const received = getCashReceived();
    cashReceivedCentavos = received;
    cashChangeCentavos = Math.max(0, received - paymentTotalCentavos);
    const insufficient = received < paymentTotalCentavos;
    cashReceived.textContent = formatCurrency(received);
    cashChange.textContent = formatCurrency(cashChangeCentavos);
    cashPanel.querySelector('#amount-paid').value = (received / 100).toFixed(2);
    cashError.hidden = !insufficient;
    cashError.querySelector('strong').textContent = 'Insufficient amount';
    cashError.querySelector('p').textContent =
      `${formatCurrency(paymentTotalCentavos - received)} more is needed.`;
    cashPanel.querySelector('.change-box[data-cash="normal"] small').textContent =
      `${formatCurrency(received)} received · ${formatCurrency(paymentTotalCentavos)} total`;
    cashConfirm.disabled = insufficient || paymentTotalCentavos <= 0;
  }

  function enterCashKey(key) {
    if (key === 'clear') cashInput = '';
    else if (key === 'backspace') cashInput = cashInput.slice(0, -1);
    else {
      const next = cashInput + key;
      if (!/^\d*(\.\d{0,2})?$/.test(next)) return;
      const [pesos, decimals = ''] = next.split('.');
      const centavos = Number(pesos || 0) * 100 + Number(decimals.padEnd(2, '0'));
      if (!Number.isSafeInteger(centavos)) return;
      cashInput = next;
    }
    updateCash();
  }

  function openCash() {
    cashInput = '';
    cashPanel.querySelector('.amount-box strong').textContent = formatCurrency(paymentTotalCentavos);
    cashPanel.querySelectorAll('[data-cash]').forEach(group => {
      group.hidden = group.dataset.cash === 'error';
    });
    cashPanel.querySelector('.change-box[data-cash="normal"] > span').textContent = 'Change';
    updateCash();
  }

  function renderCashSuccess() {
    document.getElementById('success-amount').textContent = formatCurrency(paymentTotalCentavos);
    document.getElementById('success-method').textContent = 'Cash';
    document.getElementById('success-paid').textContent = formatCurrency(cashReceivedCentavos);
    document.getElementById('success-change').textContent = formatCurrency(cashChangeCentavos);
  }

  function saveTransaction(method = 'Cash', paid = cashReceivedCentavos, change = cashChangeCentavos) {
    const date = new Date();
    const datePart = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date).replace(/-/g, '');
    lastTransaction = {
      date,
      reference: `REF-${datePart}-${Math.floor(100000 + Math.random() * 900000)}`,
      items: cart.map(item => ({ ...item, subtotal: item.price * item.quantity })),
      total: paymentTotalCentavos,
      method,
      paid,
      change
    };
    const methodKey = method === 'Cash' ? 'cash' : method === 'QR Payment' ? 'qr' : 'card';
    document.getElementById('success').querySelector(`.reference [data-method="${methodKey}"]`).textContent =
      lastTransaction.reference;
  }

  function renderReceipt() {
    if (!lastTransaction) return;
    const transaction = lastTransaction;
    const time = receipt.querySelector('.receipt-date time');
    time.dateTime = transaction.date.toISOString();
    time.textContent = transaction.date.toLocaleString('en-US', {
      timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    receiptItems.querySelectorAll('.receipt-row:not(.receipt-labels)').forEach(row => row.remove());
    transaction.items.forEach(item => {
      const row = receiptRowTemplate.cloneNode(true);
      row.querySelector('span strong').textContent = item.name;
      row.querySelector('small').textContent = `${item.quantity} × ${formatCurrency(item.price)}`;
      row.querySelector(':scope > strong').textContent = formatCurrency(item.subtotal);
      receiptItems.appendChild(row);
    });
    receipt.querySelector('.cart-total strong').textContent = formatCurrency(transaction.total);
    const details = receipt.querySelectorAll('.payment-details > div');
    details[0].querySelector('dd').textContent = formatCurrency(transaction.total);
    const method = transaction.method === 'Cash' ? 'cash' :
      transaction.method === 'QR Payment' ? 'qr' : 'card';
    const values = [null, transaction.method, formatCurrency(transaction.paid),
      formatCurrency(transaction.change), transaction.reference];
    details.forEach((detail, index) => {
      if (index === 0) return;
      const span = [...detail.querySelectorAll('[data-method]')]
        .find(element => element.dataset.method.split(' ').includes(method));
      span.textContent = values[index];
    });
    receipt.querySelectorAll('[data-method]').forEach(element => {
      element.hidden = !element.dataset.method.split(' ').includes(method);
    });
  }

  function startNewOrder() {
    closeQrSession();
    cart.length = 0;
    renderCart();
    paymentTotalCentavos = 0;
    paymentAmountDue.textContent = formatCurrency(0);
    openCash();
    renderCashSuccess();
    lastTransaction = null;
    receiptItems.querySelectorAll('.receipt-row:not(.receipt-labels)').forEach(row => row.remove());
    receipt.querySelector('.cart-total strong').textContent = formatCurrency(0);
    const time = receipt.querySelector('.receipt-date time');
    time.textContent = '';
    time.removeAttribute('datetime');
    [document.getElementById('success'), receipt].forEach(screen => {
      const details = screen.querySelectorAll('.payment-details > div');
      details.forEach((detail, index) => {
        const value = detail.querySelector('dd');
        const spans = value.querySelectorAll('span');
        const text = [0, 2, 3].includes(index) ? formatCurrency(0) : '';
        if (spans.length) spans.forEach(span => {
          if (index === 1 && span.dataset.method !== 'cash') return;
          span.textContent = text;
        });
        else value.textContent = text;
      });
    });
    document.querySelectorAll('[data-method]').forEach(element => { element.hidden = true; });
    cashPanel.querySelector('#amount-paid').removeAttribute('aria-invalid');
  }

  // Fill the summary before navigation.js shows it; block invalid confirmation.
  document.addEventListener('click', event => {
    const cardPayment = event.target.closest('#card [data-payment="card"][data-view="success"]');
    if (cardPayment) {
      if (cardPayment.disabled || document.getElementById('card').hidden || paymentTotalCentavos <= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      saveTransaction('Credit/Debit Card', paymentTotalCentavos, 0);
      renderCardSuccess();
    }
    const qrPayment = event.target.closest('#qr [data-payment="qr"][data-view="success"]');
    if (qrPayment) {
      if (qrPayment.disabled || qrPanel.hidden || !qrDone || paymentTotalCentavos <= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      saveTransaction('QR Payment', qrPaidCentavos, qrChangeCentavos);
      renderQrSuccess();
    }
    const confirm = event.target.closest('#cash [data-payment="cash"][data-view="success"]');
    if (confirm) {
      if (confirm.disabled || cashPanel.hidden || paymentTotalCentavos <= 0 ||
          cashReceivedCentavos < paymentTotalCentavos) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      saveTransaction();
      renderCashSuccess();
    }
    const viewReceipt = event.target.closest('#success [data-view="receipt"]');
    if (viewReceipt && !viewReceipt.disabled && lastTransaction) {
      const method = lastTransaction.method === 'Cash' ? 'cash' :
        lastTransaction.method === 'QR Payment' ? 'qr' : 'card';
      const activeMethod = document.getElementById('success')
        .querySelector(`.payment-details [data-method="${method}"]`);
      if (!activeMethod.hidden) renderReceipt();
    }
    const newOrder = event.target.closest('#success [data-new-order]');
    if (newOrder && !newOrder.disabled) startNewOrder();
  }, { capture: true });

  cashPanel.addEventListener('click', event => {
    const key = event.target.closest('[data-cash-key]');
    const amount = event.target.closest('[data-cash-amount]');
    if (key) enterCashKey(key.dataset.cashKey);
    else if (amount) {
      const centavos = amount.dataset.cashAmount === 'exact'
        ? paymentTotalCentavos : Number(amount.dataset.cashAmount);
      cashInput = (centavos / 100).toFixed(2);
      updateCash();
    }
  });

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
    reviewTotalCentavos = getTotal();
    review.querySelector('.review-total strong').textContent = formatMoney(reviewTotalCentavos);
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

  // Capture runs before navigation.js's bubbling click handler shows payment.
  document.addEventListener('click', event => {
    const button = event.target.closest('#review [data-view="methods"]');
    if (!button || button.disabled) return;
    paymentTotalCentavos = reviewTotalCentavos;
    paymentAmountDue.textContent = formatCurrency(paymentTotalCentavos);
  }, { capture: true });

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-view="card"], [data-preview^="card-"]');
    if (control && !control.disabled) renderCardPayment();
  }, { capture: true });

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
      const control = event.target.closest('[data-view], [data-preview]');
      // Run after navigation's fixture reset so it cannot restore old cash values.
      if (!control.disabled && control.hasAttribute('data-new-transaction')) startNewOrder();
      else renderCart();
      if (!control.disabled && (control.dataset.view === 'cash' ||
          control.dataset.preview?.startsWith('cash-'))) openCash();
      if (!control.disabled && control.dataset.view === 'qr') openQr();
      else if (qrPanel.hidden && qrSession) closeQrSession();
    }
  });

  renderCart();
})();
