# Berryman GSC Bridge — proof of concept

A tiny private Google Search Console bridge. It uses Google's official OAuth flow and Search Console API. No GSC Wizard or rank-tracker subscription is required.

## What this proof does

- Connects a Google account with read-only Search Console permission.
- Lists the Search Console properties that account can access.
- Pulls the top queries for a chosen property.
- Pulls an exact keyword and reports page, clicks, impressions, CTR and average position.
- Keeps the Google refresh token in an AES-GCM encrypted, HttpOnly browser cookie for this proof. It is not committed to GitHub or stored in the page.

## Deploy to Cloudflare Workers

This code lives on the `gsc-bridge-poc` branch so the live Berryman website is untouched.

Worker settings:
- Name: `berryman-gsc-bridge`
- Entry point: `tools/gsc-bridge/src/index.js`
- Wrangler config: `tools/gsc-bridge/wrangler.toml`

After first deployment, note the Worker URL, for example:
`https://berryman-gsc-bridge.<your-subdomain>.workers.dev`

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable **Google Search Console API**.
3. Configure the OAuth consent screen for your own Google account.
4. Create an **OAuth 2.0 Client ID** of type **Web application**.
5. Add this Authorized redirect URI:
   `https://YOUR-WORKER-URL/api/oauth-callback`
6. Copy the Client ID and Client Secret.

## Cloudflare secrets

In Worker > Settings > Variables and Secrets, add these as encrypted secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` — any long random value (32+ bytes recommended)

Do not put any of those secrets in GitHub.

Then open the Worker URL and click **Connect Google Search Console**.

## Success test

Choose `sc-domain:berrymanelectrical.com.au`, leave the keyword as:
`electrician byron bay`

Set 28 days and click **Run test**.

If Google returns rows, the direct Search Console connection is proven.

## Next phase

Once this proof works, the browser-only session can be replaced with a server-side credential store and a small authenticated API/MCP surface so ChatGPT can call:
- list sites
- top queries
- exact keyword
- pages
- period comparison
- URL inspection

That is the point where ChatGPT can pull the data itself instead of relying on screenshots.
