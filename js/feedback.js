'use strict';

(() => {
  const receipt = document.getElementById('receipt');
  const button = receipt?.querySelector('[data-new-transaction]');
  if (!button) return;
  const form = document.createElement('form');
  form.id = 'receipt-feedback';
  form.className = 'mt-3';
  form.setAttribute('aria-label', 'Receipt feedback');
  form.innerHTML = `
    <h2 class="h5">How was your experience?</h2>
    <label class="form-label" for="feedback-rating">Rating</label>
    <select class="form-select mb-3" id="feedback-rating" name="rating" required>
      <option value="">Choose a rating</option>
      <option value="5">5 — Excellent</option>
      <option value="4">4 — Good</option>
      <option value="3">3 — Okay</option>
      <option value="2">2 — Poor</option>
      <option value="1">1 — Very poor</option>
    </select>
    <label class="form-label" for="feedback-comment">Comments (optional)</label>
    <textarea class="form-control" id="feedback-comment" name="comment" rows="3" maxlength="1000" placeholder="Tell us what we can improve"></textarea>
    <button class="btn btn-primary" type="submit">Send Feedback</button>
    <p class="small-note" id="feedback-status" role="status" aria-live="polite"></p>`;
  button.insertAdjacentElement('afterend', form);
  const status = form.querySelector('[role="status"]');
  const submit = form.querySelector('button');
  form.elements.rating.style.minHeight = '48px';
  const completed = new Set();
  let reference = '';
  let pending = false;
  receipt.addEventListener('receipt-ready', event => {
    const next = event.detail.reference;
    if (reference !== next) {
      reference = next;
      form.reset();
      pending = false;
    }
    submit.disabled = pending || completed.has(reference);
    status.textContent = completed.has(reference) ? 'Thank you! Your feedback has been saved.' : '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || completed.has(reference) || !form.reportValidity()) return;
    if (!reference) { status.textContent = 'Complete a transaction before sending feedback.'; return; }
    const sentReference = reference;
    pending = true;
    submit.disabled = true;
    status.textContent = 'Sending feedback…';
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: sentReference, rating: Number(form.elements.rating.value), comment: form.elements.comment.value.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save feedback. Please try again.');
      completed.add(sentReference);
      if (reference === sentReference) status.textContent = 'Thank you! Your feedback has been saved.';
    } catch (error) {
      if (reference === sentReference) status.textContent = error.message || 'Unable to save feedback. Please try again.';
    } finally {
      if (reference === sentReference) {
        pending = false;
        submit.disabled = completed.has(reference);
      }
    }
  });
})();
