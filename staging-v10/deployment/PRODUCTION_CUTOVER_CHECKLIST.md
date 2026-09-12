# Berryman Electrical Version 10 — Production Cutover Checklist

This package is intentionally protected from indexing while staged.

Before going live:
1. Replace every staging robots meta tag (`noindex,nofollow,noarchive,nosnippet`) with the production robots directive (`index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`) except pages intentionally kept noindex (Recent Work until genuine project case studies are ready, the project template, and 404).
2. Replace `/robots.txt` with `/robots.production.txt`.
3. Remove the staging X-Robots-Tag from `_headers` (retain the security headers).
4. Remove the visible `Version 10 · Staging` badges.
5. Connect and test the enquiry form, photo uploads, spam protection and transactional email.
6. Finalise the Privacy page with the actual form/storage/email providers.
7. Re-run schema, sitemap, canonical, internal-link, mobile, accessibility and performance checks.
8. Confirm production domain and HTTPS.
9. Submit sitemap in Google Search Console and Bing Webmaster Tools after launch.
10. Reconcile redirects against any historical URLs found in Search Console before cutover.
