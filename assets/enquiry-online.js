/* Progressive enhancement for the Berryman Electrical contact form.
 * Online delivery only appears after explicit reviewed public configuration.
 * Email-draft fallback remains operational at all times.
 */
(() => {
  const form = document.querySelector('form[data-email-enquiry]');
  const options = window.BERRYMAN_ENQUIRY;
  if (!form || options?.enabled !== true ||
      typeof options.turnstileSiteKey !== 'string' ||
      !/^[\w-]{10,}$/.test(options.turnstileSiteKey)) return;

  const block = form.querySelector('[data-online-enquiry]');
  const button = form.querySelector('[data-online-send]');
  const status = form.querySelector('[data-online-status]');
  const challenge = form.querySelector('[data-turnstile-widget]');
  const fallback = form.querySelector('[data-draft-explanation]');
  const heading = form.querySelector('[data-form-heading]');
  if (!block || !button || !status || !challenge) return;
  block.hidden = false;
  if (heading) heading.textContent = 'Send an electrical enquiry';
  if (fallback) fallback.textContent =
    'Choose Send enquiry online once verification is ready, or use Open email draft. Your email app must be used to send a draft; no job is booked automatically.';

  let widgetId = null;
  let token = '';
  let pending = false;
  let finished = false;
  let hasError = false;
  const state = (message, error = false) => {
    status.textContent = message;
    status.dataset.state = error ? 'error' : 'info';
  };
  const reset = () => {
    token = '';
    button.disabled = true;
    if (widgetId !== null && window.turnstile?.reset) {
      try { window.turnstile.reset(widgetId); } catch {}
    }
  };
  button.disabled = true;
  state('Loading secure verification…');

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    if (!window.turnstile?.render) {
      state('Online verification is unavailable. Use the email draft or call us.', true);
      return;
    }
    try {
      widgetId = window.turnstile.render(challenge, {
        sitekey: options.turnstileSiteKey,
        theme: 'auto',
        callback: value => {
          if (finished) return;
          token = value;
          button.disabled = pending || finished || !token;
          if (!hasError) state('Secure verification complete. You can send your enquiry online.');
        },
        'expired-callback': () => {
          if (finished) return;
          token = '';
          button.disabled = true;
          hasError = true;
          state('Verification expired. Please complete it again.', true);
        },
        'error-callback': () => {
          token = '';
          button.disabled = true;
          hasError = true;
          state('Verification unavailable. Use the email draft or call.', true);
        },
      });
      if (widgetId === undefined || widgetId === null) {
        button.disabled = true;
        state('Online verification could not load. Use the email draft or call.', true);
      }
    } catch {
      state('Online verification could not load. Use the email draft or call.', true);
    }
  };
  script.onerror = () => state('Online verification could not load. Use the email draft or call.', true);
  document.head.appendChild(script);

  button.addEventListener('click', async () => {
    if (pending || finished || !token) return;
    if (!form.reportValidity()) {
      state('Complete the required details before sending.', true);
      return;
    }
    pending = true;
    hasError = false;
    button.disabled = true;
    button.textContent = 'Sending enquiry…';
    state('Sending your enquiry…');
    const fields = new FormData(form);
    const payload = {
      name: String(fields.get('name') || ''),
      contact: String(fields.get('contact') || ''),
      suburb: String(fields.get('suburb') || ''),
      details: String(fields.get('job_details') || ''),
      jobType: String(fields.get('job_type') || ''),
      website: '',
      turnstileToken: token,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let accepted = false;
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true) {
        accepted = true;
        finished = true;
        state('Your enquiry was accepted for email delivery. This is not a confirmed booking. We will be in touch.');
        form.reset();
        const draft = form.querySelector('.success');
        if (draft) draft.hidden = true;
      } else {
        hasError = true;
        state('Online delivery could not be confirmed. Your details are still here. Please retry or use the email draft or phone.', true);
      }
    } catch {
      hasError = true;
      state('Online delivery could not be confirmed. Your details are still here. Please use the email draft or phone.', true);
    } finally {
      clearTimeout(timer);
      pending = false;
      reset();
      button.textContent = accepted ? 'Enquiry accepted for delivery' : 'Send enquiry online';
    }
  });
})();
