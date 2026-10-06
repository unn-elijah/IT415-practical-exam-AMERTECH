'use strict';

(() => {
  const params = new URLSearchParams(location.search);
  const id = params.get('session');
  const total = Number(params.get('total'));
  const input = document.getElementById('paid');
  const done = document.getElementById('done');
  const message = document.getElementById('message');
  const money = value => `₱${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('total').textContent = `Total due: ${money(total)}`;

  async function request(options) {
    const response = await fetch(`/api/qr/${id}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (data.total !== total) throw new Error('Invalid payment link. Scan the QR code again.');
    return data;
  }

  async function initialise() {
    try {
      if (!/^[a-f0-9]{32}$/.test(id || '') || !Number.isSafeInteger(total) || total <= 0) throw new Error('Invalid payment link.');
      const session = await request();
      done.disabled = session.done;
      if (session.done) message.textContent = 'Done already sent. Return to the kiosk.';
    } catch (error) { message.textContent = error.message; }
  }

  document.getElementById('payment-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (done.disabled) return;
    const value = input.value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      message.textContent = 'Enter an amount with at most two decimal places.';
      return;
    }
    const [pesos, decimals = ''] = value.split('.');
    const paid = Number(pesos) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(paid) || paid < total) {
      message.textContent = 'Insufficient amount.';
      return;
    }
    done.disabled = true;
    try {
      await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid }) });
      message.textContent = 'Done sent. You can confirm payment on the kiosk.';
    } catch (error) {
      message.textContent = error.message;
      done.disabled = false;
    }
  });
  initialise();
})();
