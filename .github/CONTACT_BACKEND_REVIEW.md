# Berryman Electrical — staged contact form endpoint

Status: **not wired to the public form and not production-ready**. The Contact page continues to open an email draft. Do not replace the mailto flow until a real end-to-end submission has been received and checked.

## Why this exists
The twelve-page SEO rebuild must not increase leads to a form that only appears to submit. This Cloudflare Pages Function lives at `functions/api/enquiry.js` and prepares a genuine same-origin POST endpoint with server validation, Turnstile verification and a server-to-server email delivery API. It was added for review, not activated for customer traffic.

## Configuration and ownership decisions needed
1. Confirm the repository is connected to the correct Cloudflare Pages project and verify a preview deploy can run Pages Functions. Confirm any deployments are not accidentally indexed.
2. Approve **Resend** (third-party email service) or choose Cloudflare Email Service if available in this account. The current reviewed endpoint uses Resend's HTTPS email API.
3. Verify ownership of an allowed sender domain and configure sender DNS records.
4. Store these bindings in **Cloudflare's encrypted secrets/settings only**, separately for preview and production:
   - `FORM_TURNSTILE_SECRET` — private Turnstile Siteverify key
   - `FORM_RESEND_API_KEY` — outbound sender API key
   - `FORM_EMAIL_FROM` — verified sender address
   - `FORM_EMAIL_TO` — recipient inbox confirmed by business owner
5. Create a Turnstile widget for the approved public hostname and preview hostnames used for testing. Add its **public site key** to the Contact form when implementing the frontend integration. The secret must never be in HTML or GitHub.
6. Add Cloudflare WAF/rate limiting; the endpoint checks origin and Turnstile, but does not implement a distributed rate limiter.
7. Configure email delivery failure visibility/alerts, test a real email in the recipient inbox and confirm reply-to handling. A 200 API acceptance only means the provider accepted the message; it is not proof of delivery.
8. Review privacy notice, retention/access, and expected request volume. Do not log form details or tokens.

## Tests and release gate
Run `node --experimental-default-type=module --test tests/contact-enquiry.test.mjs` to exercise mocked server-side safety checks and outbound provider acceptance. This does **not** send real email.

Current form sends no data to this endpoint. Before switching:
- Build a JavaScript submission flow with native browser validation, Turnstile, accessible busy/errors/success states, request timeouts and a clear phone/email fallback.
- Do not show success on fetch/network/provider failure.
- Confirm a real low-risk end-to-end submission to the configured recipient in preview, then on the approved production hostname only after sign-off.
- Keep draft PR open and production untouched until the complete change is reviewed.

Reference: [Cloudflare Pages form tutorial](https://developers.cloudflare.com/pages/tutorials/forms/), [Turnstile validation](https://developers.cloudflare.com/turnstile/tutorials/login-pages/), [Cloudflare sending with Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/).
