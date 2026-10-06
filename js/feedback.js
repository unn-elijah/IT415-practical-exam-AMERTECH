'use strict';

(() => {
  const success = document.getElementById('success');
  if (!success) return;
  const modal = document.createElement('dialog');
  modal.id = 'feedback-modal';
  modal.className = 'feedback-modal';
  modal.setAttribute('aria-labelledby', 'feedback-modal-title');
  modal.innerHTML = '<button type="button" class="feedback-close" aria-label="Close feedback">×</button>';
  document.body.appendChild(modal);
  const close = modal.querySelector('.feedback-close');
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => {
    if (!success.hidden) success.querySelector('h1').focus();
  });
  const forms = [];
  const saved = new Map();
  let reference = '', rating = 0, comment = '', pending = false, message = '';
  let feedbackTimer;

  function render() {
    for (const form of forms) {
      form.querySelectorAll('[name="rating"]').forEach(input => {
        input.checked = Number(input.value) === rating;
        input.disabled = pending || saved.has(reference);
        input.nextElementSibling.classList.toggle('is-selected', Number(input.value) <= rating);
      });
      form.elements.comment.value = comment;
      form.elements.comment.disabled = pending || saved.has(reference);
      form.querySelector('[type="submit"]').disabled = !reference || pending || saved.has(reference);
      form.querySelector('[role="status"]').textContent = message;
    }
  }

  function ready(next) {
    if (next !== reference) {
      reference = next;
      const previous = saved.get(next);
      rating = previous?.rating || 0;
      comment = previous?.comment || '';
      pending = false;
      message = previous ? 'Thank you! Your feedback has been saved.' : '';
    }
    render();
  }

  function addForm(screen, anchor, position) {
    if (!anchor) return;
    const id = screen.id;
    const form = document.createElement('form');
    form.id = `${id}-feedback`;
    form.className = 'feedback-form mt-3';
    form.setAttribute('aria-label', 'Payment feedback');
    form.innerHTML = `
      <h2 class="h5" id="feedback-modal-title">How was your experience?</h2>
      <fieldset class="feedback-rating">
        <legend class="form-label">Rating</legend>
        <div class="feedback-stars">${[1, 2, 3, 4, 5].map(value => `
          <input class="visually-hidden" type="radio" id="${id}-star-${value}" name="rating" value="${value}" required>
          <label for="${id}-star-${value}" title="${value} ${value === 1 ? 'star' : 'stars'}">
            <span aria-hidden="true">★</span><span class="visually-hidden">${value} ${value === 1 ? 'star' : 'stars'}</span>
          </label>`).join('')}</div>
      </fieldset>
      <label class="form-label" for="${id}-feedback-comment">Comments (optional)</label>
      <textarea class="form-control" id="${id}-feedback-comment" name="comment" rows="3" maxlength="1000" placeholder="Tell us what we can improve"></textarea>
      <button class="btn btn-primary" type="submit">Send Feedback</button>
      <p class="small-note" role="status" aria-live="polite"></p>`;
    anchor.insertAdjacentElement(position, form);
    forms.push(form);
    form.addEventListener('change', event => {
      if (event.target.name === 'rating') { rating = Number(event.target.value); render(); }
    });
    form.elements.comment.addEventListener('input', event => {
      comment = event.target.value;
      for (const other of forms) if (other !== form) other.elements.comment.value = comment;
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!reference || pending || saved.has(reference) || !form.reportValidity()) return;
      const sentReference = reference;
      const submission = { reference, rating, comment: comment.trim() };
      pending = true;
      message = 'Sending feedback…';
      render();
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to save feedback. Please try again.');
        saved.set(sentReference, submission);
        if (reference === sentReference) message = 'Thank you! Your feedback has been saved.';
      } catch (error) {
        if (reference === sentReference) message = error.message || 'Unable to save feedback. Please try again.';
      } finally {
        if (reference === sentReference) { pending = false; render(); }
      }
    });
  }

  addForm(modal, close, 'afterend');
  document.addEventListener('transaction-ready', event => {
    clearTimeout(feedbackTimer);
    ready(event.detail.reference);
    const paymentReference = reference;
    feedbackTimer = setTimeout(() => {
      if (reference !== paymentReference || success.hidden || modal.open) return;
      modal.showModal();
      close.focus();
    }, 4000);
  });
  document.addEventListener('transaction-reset', () => {
    clearTimeout(feedbackTimer);
    if (modal.open) modal.close();
    ready('');
  });
  render();
})();
