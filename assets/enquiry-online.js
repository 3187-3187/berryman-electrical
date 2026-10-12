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
  const draftSubmit = form.querySelector('button[type="submit"]');
  const attachmentField = form.querySelector('[data-online-attachments]');
  const attachmentInput = form.querySelector('input[name="attachments"]');
  const attachmentStatus = form.querySelector('[data-attachment-status]');
  const MAX_FILES = 4;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
  const FILE_EXTENSIONS = new Set(['jpg','jpeg','png','webp','heic','heif','pdf']);
  // Once online submission is truly enabled, the in-house form is primary.
  // Visitors still have a plain email link and phone number if delivery fails.
  if (draftSubmit) draftSubmit.hidden = true;
  if (!block || !button || !status || !challenge) return;
  block.hidden = false;
  if (attachmentField) attachmentField.hidden = false;
  if (heading) heading.textContent = 'Send an electrical enquiry';
  if (fallback) fallback.textContent =
    'Fill in the details, complete the security check and press Send enquiry online. No email app is needed. This does not confirm a booking.';

  let widgetId = null;
  let token = '';
  let pending = false;
  let finished = false;
  let hasError = false;
  let fileError = '';
  const validateFiles = () => {
    const files = Array.from(attachmentInput?.files || []);
    let error = '';
    if (files.length > MAX_FILES) error = 'Please select no more than 4 files.';
    let total = 0;
    for (const file of files) {
      total += file.size;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!FILE_EXTENSIONS.has(ext) || file.name.length > 120) {
        error = 'Select JPG, PNG, WebP, HEIC, HEIF or PDF files only.';
        break;
      }
      if (!file.size || file.size > MAX_FILE_BYTES) {
        error = 'Each file must be 5 MB or smaller.';
        break;
      }
    }
    if (!error && total > MAX_TOTAL_BYTES) error = 'All files together must be 10 MB or smaller.';
    fileError = error;
    if (attachmentStatus) {
      attachmentStatus.textContent = error || (files.length ? files.length + ' ready: ' +
        files.map(f => f.name).join(', ') : 'No files selected (optional).');
      attachmentStatus.dataset.state = error ? 'error' : 'info';
    }
    if (button) button.disabled = pending || finished || !token || !!fileError;
    return !error;
  };
  if (attachmentInput) attachmentInput.addEventListener('change', validateFiles);
  const readBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File could not be read'));
    reader.onload = () => {
      const data = reader.result;
      const marker = ';base64,';
      if (typeof data !== 'string' || !data.includes(marker))
        return reject(new Error('Invalid file encoding'));
      resolve({filename:file.name,content:data.slice(data.indexOf(marker)+marker.length)});
    };
    reader.readAsDataURL(file);
  });
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
          button.disabled = pending || finished || !token || !!fileError;
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
    if (!validateFiles()) {
      state('Please correct the selected attachments before sending.', true);
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
    let timer;
    let accepted = false;
    let preparingFiles = true;
    try {
      const files = Array.from(attachmentInput?.files || []);
      if (files.length) {
        state('Preparing ' + files.length + ' attachment(s)…');
        payload.attachments = await Promise.all(files.map(readBase64));
      }
      preparingFiles = false;
      button.textContent = 'Sending enquiry…';
      state('Sending your enquiry…');
      timer = setTimeout(() => controller.abort(), files.length ? 35000 : 12000);
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
        fileError = '';
        if (attachmentStatus) attachmentStatus.textContent = '';
        const draft = form.querySelector('.success');
        if (draft) draft.hidden = true;
      } else {
        hasError = true;
        // Explain known, safe server-side validation/configuration failures to the customer.
        // Keep a generic message for unexpected responses, and preserve the retry guidance.
        const knownReasons = new Set([
          'Online enquiries are not enabled. Please call or email directly.',
          'Online enquiries are unavailable. Please call or email directly.',
          'Please complete the required enquiry details.',
          'Verification failed. Please try again.',
          'Verification unavailable. Try again later.',
          'We could not deliver your enquiry. Please call or email directly.',
          'Email provider acceptance could not be confirmed. Please contact us directly.',
          'Files must be JPG, PNG, WebP, HEIC, HEIF or PDF (up to 4 files, 5 MB each, 10 MB total).'
        ]);
        const reason = knownReasons.has(body?.error) ? body.error + ' ' : '';
        state(reason + 'Online delivery could not be confirmed. Your details are still here. Please retry or use the email draft or phone.', true);
      }
    } catch {
      hasError = true;
      state(preparingFiles
        ? 'Your attachments could not be read. Please select the files again, or send your enquiry without attachments.'
        : 'Online delivery could not be confirmed. Your details are still here. Please use the email draft or phone.', true);
    } finally {
      if (timer) clearTimeout(timer);
      pending = false;
      reset();
      button.textContent = accepted ? 'Enquiry accepted for delivery' : 'Send enquiry online';
    }
  });
})();
