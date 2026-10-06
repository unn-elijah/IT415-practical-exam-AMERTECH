'use strict';

// UI navigation only. All amounts, order rows, references and messages are
// authored fixtures in index.html; nothing here computes a transaction.
(() => {
  const views = [...document.querySelectorAll('.view')];
  const stages = [...document.querySelectorAll('.progress-nav li')];
  const amountInput = document.getElementById('amount-paid');

  function showGroup(attribute, selected) {
    document.querySelectorAll(`[${attribute}]`).forEach(element => {
      element.hidden = !element.getAttribute(attribute).split(' ').includes(selected);
    });
  }

  function showView(id, focus = true) {
    const next = views.find(view => view.id === id);
    if (!next) return;
    views.forEach(view => { view.hidden = view !== next; });
    const stage = Number(next.dataset.stage);
    stages.forEach(step => {
      const number = Number(step.dataset.stage);
      step.classList.toggle('active', number === stage);
      step.classList.toggle('complete', number < stage);
      if (number === stage) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    document.title = `${next.getAttribute('aria-label')} · CS Campus Store UI Prototype`;
    document.getElementById('view-announcement').textContent = next.getAttribute('aria-label');
    if (focus) {
      next.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function cashPreview(state) {
    showGroup('data-cash', state);
    amountInput.value = state === 'error' ? '100.00' : '200.00';
    // The error is a design fixture, never the result of input validation.
    if (state === 'error') amountInput.setAttribute('aria-invalid', 'true');
    else amountInput.removeAttribute('aria-invalid');
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-view], [data-preview]');
    if (!control || control.disabled) return;
    event.preventDefault();
    if (control.hasAttribute('data-preview')) {
      const preview = control.dataset.preview;
      if (preview === 'populated' || preview === 'empty') {
        showGroup('data-order', preview);
        showView('order');
      } else if (preview.startsWith('cash-')) {
        cashPreview(preview === 'cash-error' ? 'error' : 'normal');
        showView('cash');
      } else if (preview.startsWith('card-')) {
        showGroup('data-card', preview === 'card-processing' ? 'processing' : 'ready');
        showView('card');
      }
      return;
    }
    if (control.hasAttribute('data-new-transaction')) {
      showGroup('data-order', 'empty');
      cashPreview('normal');
      showGroup('data-card', 'ready');
      showGroup('data-method', 'cash');
    }
    if (control.dataset.payment) showGroup('data-method', control.dataset.payment);
    if (control.dataset.view === 'cash') cashPreview('normal');
    if (control.dataset.view === 'card') showGroup('data-card', 'ready');
    showView(control.dataset.view);
  });

  showView('order', false);
})();
