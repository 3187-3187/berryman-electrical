# Berryman Electrical — staged contact form endpoint

Status: **prepared but disabled, not production-ready**. The Contact page contains a hidden online-submit enhancement but its checked-in public configuration has `enabled: false` and no Turnstile sitekey. The existing email-draft workflow remains visible and working. Do not enable or replace it until a real end-to-end submission has been received in the intended inbox.

## Why this exists
The twelve-page SEO rebuild must not increase leads to a form that only appears to submit. This Cloudflare Pages Function lives at `functions/api/enquiry.js` and prepares a genuine same-origin POST endpoint with server validation, Turnstile verification and a server-to-server email delivery API. It was added for review, not activated for customer traffic.

## Configuration and ownership decisions needed
1. Confirm the repository is connected to the correct Cloudflare Pages project and verify a preview deploy can run Pages Functions. Confirm any deployments are not accidentally indexed.
2. Approve **Resend** (third-party email service) or choose Cloudflare Email Service if available in this account. The current reviewed endpoint uses Resend's HTTPS email API.
3. Verify ownership of an allowed sender domain and configure sender DNS records.
4. Store these bindings in **Cloudflare's encrypted secrets/settings only**, separately for preview and production:
   - `FORM_ENABLE_SEND` — exactly `true` is required to allow any submission; unset/false fails closed even when provider credentials exist. Enable preview only after approvals, and production only after a verified preview and release signoff.
   - `FORM_TURNSTILE_SECRET` — private Turnstile Siteverify key
   - `FORM_RESEND_API_KEY` — outbound sender API key
   - `FORM_EMAIL_FROM` — verified sender address
   - `FORM_EMAIL_TO` — recipient inbox confirmed by business owner
5. Create a Turnstile widget for the approved public hostname and preview hostnames used for testing. Review `assets/enquiry-config.js`: only when approved, set `enabled: true` and the widget's **public site key** for a preview branch. This file intentionally has the feature disabled. The secret must never be in HTML or GitHub.
6. Add Cloudflare WAF/rate limiting; the endpoint checks origin and Turnstile, but does not implement a distributed rate limiter.
7. Configure email delivery failure visibility/alerts, test a real email in the recipient inbox and confirm reply-to handling. A 200 API acceptance only means the provider accepted the message; it is not proof of delivery.
8. Review privacy notice, retention/access, and expected request volume. Do not log form details or tokens.

## Tests and release gate
Run `node --experimental-default-type=module --test tests/contact-enquiry.test.mjs` to exercise mocked server-side safety checks and outbound provider acceptance, and `NODE_PATH=/tmp/berryman-qa/node_modules node .github/qa/contact-online-qa.cjs` under the GitHub test workflow to check browser interaction with mocked Turnstile/API success and failure. **Neither sends real email.**

The user-facing online flow is already staged in `assets/enquiry-online.js` and is hidden unless both the public `enabled` flag and a correctly formatted public Turnstile site key are set. The current form therefore sends no data to the endpoint. Before switching:
- Review the staged JavaScript submission flow: native form validation, Turnstile, accessible busy/errors/acceptance states, request timeout and preserved phone/email draft fallbacks. Keep the online UI disabled until preview tests succeed.
- Keep the server's `FORM_ENABLE_SEND` secret flag separately disabled until an approved test environment is ready. Never put the Resend or Turnstile private keys in the browser config.
- Do not show success on fetch/network/provider failure, and distinguish provider acceptance from delivered-to-inbox confirmation.
- Confirm a real low-risk end-to-end submission to the configured recipient in preview, then on the approved production hostname only after sign-off.
- Keep draft PR open and production untouched until the complete change is reviewed.

Reference: [Cloudflare Pages form tutorial](https://developers.cloudflare.com/pages/tutorials/forms/), [Turnstile validation](https://developers.cloudflare.com/turnstile/tutorials/login-pages/), [Cloudflare sending with Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/).


## Release acceptance checklist

- [ ] Confirm actual hosting is Cloudflare Pages with Functions enabled (not a static-only mirror). The GitHub connector cannot inspect Cloudflare's account or its secrets.
- [ ] Confirm sending provider and permitted recipient inbox; verify a sender domain in DNS and its SPF/DKIM.
- [ ] Configure preview-only secrets plus private `FORM_TURNSTILE_SECRET`, public widget site key and `FORM_ENABLE_SEND=true` in approved test environment; use the correct Turnstile hostname settings.
- [ ] Rate limit the endpoint at Cloudflare and set delivery-failure monitoring before public enabling.
- [ ] Use a safe test message on preview; verify successful receipt in the destination inbox, correct reply-to, and failure/no-duplicate behaviour.
- [ ] Review personal-data handling, retention, privacy-policy language and access to provider logs.
- [ ] Obtain explicit launch approval; deploy verified release and test again on the public hostname.

**No production backend or email has been activated by the assistant.**
