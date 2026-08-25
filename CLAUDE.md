# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server on port 5174 (fixed via `strictPort` in `vite.config.js`)
- `npm run build` — production build (base path `/RootedUpright/`, see below)
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run preview` — serve the production build locally
- `node importPlants.mjs` — one-off script that bulk-POSTs a hardcoded plant list to `/plants`; not part of the app runtime

There is no test suite/framework configured in this project.

## Architecture

This is a single-page React (Vite) frontend for a fully serverless AWS backend — there is no backend code in this repo. `src/App.jsx` is effectively the entire application: one component owns all catalog state (plants, search, grid/list view, edit-in-place forms, add-specimen form, care-log entries/timeline, image upload) and talks directly to API Gateway via `axios`, no router, no state library, no component splitting beyond a few inline icon components.

**Auth:** `src/main.jsx` wraps `<App />` in `react-oidc-context`'s `AuthProvider`, configured against a Cognito user pool (hardcoded pool/client IDs in `main.jsx`; the client ID is duplicated in `App.jsx`'s `signOutRedirect` for the hosted-UI logout URL). Cognito's hosted UI drives sign-in/sign-out via redirect — there's no custom login form. Every data-fetching call filters by `auth.user?.profile.sub` as the `userId` query param, so plant data is scoped per Cognito user.

**Backend:** AWS API Gateway (HTTP API) → Lambda → DynamoDB, none of it checked into this repo. The API base URL comes from `VITE_API_URL` (`.env`). Two DynamoDB tables:
- **Plants** — `plantId` (UUID, partition key), `name`, `species`, `cultivar`, `lore`, `careInstructions`, `watchFor`, `imageUrl`, `dateAdded`, `userId`.
- **CareLogs** — `logId` (UUID, partition key), `plantId` (sort key, GSI for per-plant queries), `careType`, `notes`, `dateLogged`.

Endpoints used by the frontend: `GET/POST/PUT/DELETE /plants`, `GET/POST/DELETE /carelogs`, `POST /upload-url` (returns a presigned S3 PUT URL + the resulting public `imageUrl`).

**Image upload flow:** a new/edited plant's photo is not sent inline. The client POSTs to `/upload-url` with `plantId`+`fileType`, PUTs the file directly to the returned presigned S3 URL, then PUTs the plant record again with the resulting `imageUrl` (the `PUT /plants` endpoint replaces the whole item, so every field is resent on any edit, not just the changed ones).

**Deployment:** production is served from `kimberlyminer.com/RootedUpright/`, sharing a CloudFront distribution with other unrelated sites at that domain — `vite.config.js` sets `base: '/RootedUpright/'` only for `build`, and `src/config.js` switches the Cognito `redirect_uri`/logout URL between that production URL and `http://localhost:5174` based on `import.meta.env.PROD`.

**Styling:** hand-written CSS (`src/App.css`, `src/index.css`, no framework) implementing a "cyberpunk lab/specimen" theme (lime/magenta on dark, monospace/Orbitron fonts, scanline/grid background layers). Theme tokens live in `:root` in `index.css`.

## Related repo

`../RootedUprightMobile` is a Flutter mobile client for the same backend (same API Gateway URL, same Cognito pool). It has diverged from the web app in places — e.g. it already has bulk/quick "log care" actions and sorts care logs by `dateLogged` — so don't assume feature parity between the two without checking.
