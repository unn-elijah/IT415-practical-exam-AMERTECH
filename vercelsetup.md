# Vercel deployment and QR setup

## Current project status

The project now includes `vercel.json`, Vercel Functions in `api/qr/`, a static
build script, and shared Redis storage in `lib/qr-store.js`. These files were
already present in commit `7958080` when the deployment work began.
Production was deployed and verified on October 6, 2026:
[CS Campus Store](https://it415-practical-exam-amertech.vercel.app/).
The Upstash Redis database `campus-store-qr` uses the Free plan and is connected
to Production and Preview. Its `KV_REST_API_URL` and `KV_REST_API_TOKEN`
variables are supported by the backend; credentials remain in Vercel.

The live QR image was decoded into its public payment link. Opening that link,
submitting Done, kiosk polling, confirmation, and receipt navigation were
verified. Live feedback submission was also verified.

## Deploy from the Vercel website

1. Sign in at https://vercel.com/dashboard.
2. Import `unn-elijah/IT415-practical-exam-AMERTECH`, or select its existing project.
3. Use the repository root containing `vercel.json`. Select Framework Other.
4. Keep the configured build command `node scripts/build-static.js` and output
   directory `public`. The `api` folder supplies server functions separately.
5. Connect an Upstash Redis database through Storage/Marketplace.
6. Configure these server environment variables for the deployment environment:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN` (read/write REST token)
   The equivalent `KV_REST_API_URL` and `KV_REST_API_TOKEN` names also work.
7. Deploy or redeploy after configuring storage. Check the branch and commit.
   This checkout uses `codex/fix-vercel-qr-flow`. The current Production release
   was built from that branch; the configured production Git branch is still
   `main`. Merge the feature branch through the normal review flow before
   relying on future pushes to `main` to retain these changes.
8. Use a deployment accessible to the phone. Login-protected previews require
   the phone to sign in; a public production deployment is suitable for scanning.

Do not put the Redis token in browser JavaScript or commit it. `.env.example`
contains placeholders. `.vercelignore` excludes local `server.js` to avoid
backend auto-detection, and the build copies only public kiosk files.

## QR behavior

- POST `/api/qr` creates a random session and returns a same-site payment link.
- GET `/api/qr/:id` lets the kiosk poll the session.
- POST `/api/qr/:id` records Done with the entered amount.
- DELETE `/api/qr/:id` cancels the session.
- Redis sessions expire after 30 minutes and are shared across function instances.
- Payment completion uses an atomic Redis operation; repeated submissions cannot
  replace the first accepted payment amount.
- Hosted pages use their own HTTPS API address. Local Live Server uses port 3000.

This is a prototype payment acknowledgement. It does not process real funds.
Supabase integration is a separate task; the QR backend currently uses Redis.

## Final feedback behavior

After a transaction completes, the feedback modal waits for a tap on a
non-button area of Payment Successful or Enter while that screen has focus.
It does not open automatically or reopen after it is dismissed.
It contains five selectable stars, optional comments, Send Feedback, and an X
at the top right. Closing it returns to the original success screen. Neither
the success screen nor the receipt contains an inline feedback form.

POST `/api/feedback` validates and saves one submission per receipt reference.
Feedback is retained in Redis for 90 days under `campus-pos:feedback:<reference>`.
Storage failures show a retry message instead of reporting success. The modal
supports keyboard star selection and resets for each new transaction.

## Checks

```powershell
node tests/vercel-qr.cjs
node tests/feedback.cjs
node scripts/build-static.js
```

The browser check requires Playwright and Microsoft Edge:

```powershell
node tests/qr-browser.cjs
```

Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is not in
local dependencies. Run this test with local port 3000 available. It exercises
Vercel handlers over HTTP with the Redis boundary mocked: QR generation, phone
link, insufficient amount, Done, kiosk polling, confirmation, feedback modal,
star selection, saving, closing, mobile layout, receipt navigation, and reset.
It does not verify a live Redis service or a deployed site.

After deployment, repeat the flow on the public URL using a phone: add products,
Review, Continue to Payment, QR Payment, scan, enter the total or more, Done,
wait for Confirm Payment, confirm, and View Receipt. Check New Transaction and
fresh QR sessions, plus Cash and Card. Confirm no browser errors appear.

## References

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/git/vercel-for-github
