# Vercel handoff

The code is ready for a static kiosk plus Vercel Functions. No UI changes are required.

1. Import the repository into Vercel. Select the root folder containing `vercel.json`, `index.html`, and `api/` (not the nested `IT415-AMERTECH` folder).
2. Connect an Upstash Redis database using the Vercel Marketplace, or create one in Upstash.
3. Configure server environment variables for the environments you deploy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN` (read/write REST token)
   The equivalent `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are also supported.
   Keep tokens out of browser code and Git. `.env.example` contains placeholders only.
4. Let `vercel.json` control the build: Framework Other, `node scripts/build-static.js`, output `public`. Do not replace the build command with an empty command.
5. Deploy/redeploy after adding the variables. Use a deployment accessible to the phone; a login-protected preview cannot be scanned by an unsigned-in phone.

`api/qr/index.js` creates sessions at `/api/qr`; `api/qr/[id].js` handles status, Done, and cancellation. Sessions expire after 30 minutes. Done is saved atomically, and repeated submissions cannot replace the first accepted amount. The phone link uses the same public deployment as the kiosk.

Only public kiosk assets are copied into `public/`. The local `server.js` is excluded from Vercel deployment to avoid Node server auto-detection. It remains available locally: run `node server.js`, then use either that server or Live Server as before.

Test on the public site: add products, Review, Continue to Payment, QR Payment, scan with a phone (mobile data is fine), enter the total or more, Done, wait for Confirm Payment to enable, confirm, and View Receipt. New Transaction and reopening QR should create a fresh session and disable confirmation again. Also verify Cash and Card.

This is a prototype payment acknowledgement, not a real payment processor. No deployment or database has been created by these code changes.
