# AGENTS.md

Guidance for AI coding agents (and humans) working on this repo. Keep it current: when a change affects the commands, layout or conventions described here, update this file in the same change.

## What this is

**Claire** is a Chrome extension (Manifest V3). Its toolbar icon turns **orange** when the current page was served by Cloudflare and **grey** when it wasn't. Clicking it opens a popup with:

- whether the site uses Cloudflare
- the HTTP version (`h2`, `h3`, `http/1.1`) and IP version (4 or 6)
- the server IP
- for Cloudflare sites: the **Ray ID**, the **data center** code (e.g. `SFO`) and a link to the site's `/cdn-cgi/trace`

`origin` is `ram-nadella/claire` and the default branch is `master`. The version number lives only in `src/manifest.json` (currently 0.21.0).

## Project status: an independently maintained fork

- **This repo is the maintained Claire.** Ram Nadella forked it and maintains it, and intends to keep doing so.
- **Ignore the upstream `cloudflare/claire`.** Cloudflare deprecated it and replaced Claire with Cloudflare Optics. None of that applies here:
  - Don't pull, rebase or cherry-pick from upstream.
  - Don't open issues or PRs there, or point users to it.
  - Don't cite the deprecation as a reason to change direction.
  - Don't suggest Cloudflare Optics as an alternative.
  - Upstream commits in `git log` are just history.
- **Sources of truth:** this repo, and the Chrome Web Store listing `fgbpcgddpmjmamlibbaobboigaijnmkl`, which the maintainer publishes.
- **License:** `LICENSE` is the standard BSD-3 text with Cloudflare's original copyright line. Keep it, since the license requires it, and don't add copyright lines (the maintainer's included) unless the maintainer asks. Nothing third-party ships, so there are no third-party notices: if you ever copy a library into `src/`, add its notice. Don't use Cloudflare's name in a way that implies endorsement.

## Read this first: current state

- **`src/` is v0.21.0 exactly as published** on the Chrome Web Store, imported from the store package in plan chunk 0.1. The only change is the store-injected `update_url` key, which was removed. It's plain JavaScript with no build step and no dependencies.
- **It has known bugs**, listed in Phase 2 of the plan (stale per-tab state, popup crashes, debug logging always on, no `http://` host permission, an invisible default icon). Fix each one only in its chunk, with a test.
- **Work follows [`docs/modernization-plan.md`](docs/modernization-plan.md).** See "Roadmap" below.
- **The old Manifest V2 code (v0.11.1)** is at tag `v0.11.1`: webpack, jest, `airports.js`, Railgun. Current Chrome can't run it. Look there for old behavior or tests to port; don't restore it.
- **Lint and CI exist; tests don't yet.** `npm run lint` runs ESLint and Prettier, in the dev container and in CI. Chunk 1.4 adds unit tests and 1.5 an end-to-end test.

## Commands

Node 26 (`.node-version`) and **npm**, for dev tooling only: the extension has no runtime dependencies and no build step. Don't add Yarn or pnpm files.

**Run commands in the dev container** (`compose.yaml` + `docker/`), not on the host. It has network access, Node 26, and its own `node_modules` volume. Dependencies install automatically (`npm ci`) on the first run and whenever `package.json` or `package-lock.json` changes. Pass `-T` when running without a terminal (agents, scripts).

| Task | Command |
|---|---|
| Lint (ESLint + Prettier check) | `docker compose run --rm -T dev npm run lint` |
| Format (Prettier, then ESLint fixes) | `docker compose run --rm -T dev npm run format` |
| Lint one file | `docker compose run --rm -T dev npx eslint src/popup.js` |
| Add a dev dependency | `docker compose run --rm -T dev npm install -D <pkg>` (commit `package.json` and `package-lock.json`) |
| Shell | `docker compose run --rm dev` |
| Rebuild image (after editing `docker/`) / reset volumes | `docker compose build` / `docker compose down -v` |

If you edited `package.json` by hand and `npm ci` fails, run `docker compose run --rm -T -e SKIP_INSTALL=1 dev npm install` to update the lockfile.

**Definition of done:** `npm run lint` passes. If you touched anything in `src/`, also do the manual check below. If you couldn't run something, say so. Don't claim it passed.

## Layout

```
src/                       the extension; load this folder unpacked. Everything in it ships.
  manifest.json            MV3 manifest
  background.js            service worker: webRequest/webNavigation listeners, per-tab state, toolbar icon
  popup.html, popup.js     popup UI
  icons/                   cloud-{orange,grey,white}-{32,64,128}px.png
package.json               dev tooling only (private, no runtime dependencies); scripts: lint, format
eslint.config.js           ESLint flat config: browser/webextension globals for src/, Node for tooling
.prettierrc.json           Prettier defaults, plus 4-space HTML; .prettierignore skips Markdown
.node-version              Node major for CI and the dev container (keep docker/compose in sync)
.github/workflows/ci.yml   lint on every PR and push to master; uploads src/ as an artifact
.github/dependabot.yml     weekly version-update PRs for npm dev deps and GitHub Actions
SECURITY.md                how to report a vulnerability privately
compose.yaml, docker/      dev container (Dockerfile + entrypoint)
docs/modernization-plan.md the roadmap: ordered, chunked work with acceptance criteria
CLAUDE.md                  imports this file for Claude Code
```

## How it works

1. **Capture.** `background.js` listens to `chrome.webRequest.onCompleted` for `main_frame` requests with `responseHeaders`. It builds a `RequestInfo` (tab ID, request ID, URL, IP, `Server` and `CF-RAY` values, `servedByCloudflare`) and stores it in `chrome.storage.local` under `tab-request-details-<tabId>`.
2. **Icon.** It then calls `chrome.action.setIcon({ path, tabId })`: orange if Cloudflare, grey if not. The manifest's default icon is the white cloud. On `webNavigation.onDOMContentLoaded` (only when `frameId === 0`), it reads the tab's stored entry and sets the icon again, for navigations that don't produce a fresh `webRequest` event.
3. **Cleanup.** `tabs.onRemoved` deletes the tab's entry; `tabs.onReplaced` moves it to the new tab ID.
4. **Popup.** `popup.js` finds the active tab, reads its entry from `chrome.storage.local`, and fills in the page. For the HTTP version it runs `chrome.scripting.executeScript` in the tab to read `performance.getEntriesByType('navigation')[0].nextHopProtocol`.
5. **Debug logging.** `debug_log` prints to the service worker console when `chrome.storage.local` has `debug: true`. `background.js` sets that on every start (a bug; chunk 2.2).

Detection rules:

- **Cloudflare:** the `Server` header equals `cloudflare`, ignoring case. (Chunk 2.5 revisits this.)
- **Ray ID / data center:** `CF-RAY` is split on `-` into `<rayid>-<colo>`. The colo is shown as a code.
- **IP version:** the IP contains `.` → 4, `:` → 6, otherwise `?`.
- **Header lookup** ignores case; the first matching header wins.

## Conventions

- **Style:** Prettier's defaults (2-space indent, double quotes, semicolons, trailing commas), with 4 spaces in HTML. Prettier and ESLint enforce it; `npm run format` fixes most problems. Markdown is hand-formatted. Plain scripts, not modules, until chunk 1.4: `const`/`let`, arrow functions, `async`/`await`.
- **No build step.** What's in `src/` is what ships, so keep tests, fixtures and docs out of it.
- **Service worker:** register listeners synchronously at the top level, and don't keep state in globals. Chrome stops the worker when it's idle, so state lives in `chrome.storage`.
- **Commits:** conventional style: `fix: ...`, `chore: ...`, `test: ...`, `fix(popup): ...`. One logical change per commit/PR.
- **Version bumps** go in `src/manifest.json` only.

## Gotchas and don'ts

- Don't commit `*.crx` store packages, `dist/`, `node_modules/` or `coverage/` (all gitignored).
- No remote code or CDN assets. MV3's extension CSP is `script-src 'self'`, so the popup can't use inline scripts or inline event handlers either.
- `host_permissions` lists `https://*/*` twice and has no `http://` pattern, so plain-HTTP sites get no icon. That's a known bug (chunk 2.4). Don't add permissions without stating why in the PR.
- The dev container's entrypoint is copied into the image, so run `docker compose build` after editing anything in `docker/`.
- ESLint doesn't read `.gitignore`. If you add a gitignored output folder, add it to `globalIgnores` in `eslint.config.js` too.
- `no-unused-vars` ignores top-level declarations in `src/` for now (`vars: "local"`), because `popup.js` has unused leftovers that chunk 2.3 removes. Restore the default once they're gone.
- Don't push, tag, or publish to a store unless explicitly asked.
- Most security tooling lives in the repo's security settings, not in files: Dependabot alerts and security updates, CodeQL code scanning (*default setup*, which covers `src/` and the workflows), secret scanning with push protection, and private vulnerability reporting. Don't add a `codeql.yml` workflow: GitHub rejects advanced-setup results while default setup is on. Dependabot's PRs are titled `chore(deps): ...` and `ci(deps): ...`.

## Manual check (for a human)

In Chrome, open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked* and pick `src/`. Pin Claire from the extensions menu so its icon shows in the toolbar. Then:

- `https://www.cloudflare.com` → orange icon. The popup says the site uses Cloudflare and shows the HTTP version, IP version, IP, Ray ID, data center code, and a Trace link that opens `/cdn-cgi/trace`.
- `https://www.google.com` → grey icon. The popup says the site doesn't use Cloudflare and shows the HTTP version, IP version and IP.

## Roadmap: how to pick up work

All planned work lives in [`docs/modernization-plan.md`](docs/modernization-plan.md), as ordered chunks with acceptance criteria. Known bugs in 0.21.0 are listed in Phase 2.

1. Take the first unchecked chunk whose dependencies are done, unless the maintainer names a different one.
2. Branch `modernize/<id>-<slug>`, and do only that chunk. Ideas and bugs you find along the way go into the plan, not into this PR.
3. Meet the chunk's acceptance criteria in the dev container, tick its checkbox in the plan, and update this file if commands or conventions changed, all in the same PR.
4. If the plan no longer matches the code, or a chunk says *decision needed*, stop and ask the maintainer before writing code.
