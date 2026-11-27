# AGENTS.md

Guidance for AI coding agents (and humans) working on this repo. Keep it current: when a change affects the commands, layout or conventions described here, update this file in the same change.

## What this is

**Claire** is a browser extension. Its page-action icon turns **orange** when the current page was served by Cloudflare and **grey** when it wasn't. The icon also shows whether the page came over HTTP/2 and IPv6. Clicking it opens a popup with:

- the server IP (v4 or v6), with a copy button
- the Cloudflare **Ray ID** and the **data center** (colo) that served the request, e.g. "San Francisco, United States (SFO)"
- a link to the site's `/cdn-cgi/trace`
- Railgun details (legacy; see "Read this first")

`origin` is `ram-nadella/claire` and the default branch is `master`. The version number lives only in `source/manifest.json` (currently 0.11.1).

## Project status: an independently maintained fork

- **This repo is the maintained Claire.** Ram Nadella forked it and maintains it, and intends to keep doing so.
- **Ignore the upstream `cloudflare/claire`.** Cloudflare deprecated it and replaced Claire with Cloudflare Optics. None of that applies here:
  - Don't pull, rebase or cherry-pick from upstream.
  - Don't open issues or PRs there, or point users to it.
  - Don't cite the deprecation as a reason to change direction.
  - Don't suggest Cloudflare Optics as an alternative.
  - Upstream commits in `git log` are just history.
- **Sources of truth:** this repo, and the Chrome Web Store listing `fgbpcgddpmjmamlibbaobboigaijnmkl`, which the maintainer publishes.
- **Leftover upstream references** (`package.json` repository/bugs/homepage, README links and badges) are stale. Cleaning them up is chunk 0.2 in the plan.
- **License:** keep the BSD-3 license text and its existing copyright notices; the license requires them. Don't use Cloudflare's name in a way that implies endorsement.

## Read this first: current state

- **This repo is behind the published extension.** The Chrome Web Store has **v0.21.0** (updated July 2024), which must be Manifest V3 because the store removed all MV2 extensions in Aug 2026. This repo's `master` is **v0.11.1, Manifest V2**. The 0.21.0 source isn't on any branch of `ram-nadella/claire`: `origin/manifest-v3-update`, despite its name, is one 2021 comment-only commit on top of 0.11.1. The published package, `claire-0-21-0.crx` in the repo root (gitignored; never commit it), turned out to be unbundled plain JS: an MV3 rewrite with no build step and no dependencies. Importing it as the new codebase is chunk 0.1 of the plan, and the plan's appendix summarizes how it differs from 0.11.1. **Don't modernize or fix the MV2 code in `source/`:** it gets replaced in 0.1. Most of this file (*Layout*, *How it works*, *Commands*) still describes that MV2 code and gets rewritten in 0.1.
- **Work follows [`docs/modernization-plan.md`](docs/modernization-plan.md).** See "Roadmap" below.
- **The code in this repo won't run in current Chrome.** Chrome 139+ removed MV2 support entirely (unpacked builds included). Until the MV3 source is back, Firefox (which kept MV2) is the practical way to try a build: `about:debugging` → *Load Temporary Add-on* → `dist/manifest.json`.
- **The toolchain dates from 2017–2018:** webpack 3, jest 20, eslint 3, extract-text-webpack-plugin. The dev container pins Node 16 for that reason. If webpack fails with `ERR_OSSL_EVP_UNSUPPORTED` on a newer Node, retry with `NODE_OPTIONS=--openssl-legacy-provider`.
- **CI is broken.** `.github/workflows/main.yml` uses `actions/cache@v2` (GitHub retired it in 2025) and the deprecated `::set-output`. `.travis.yml` is dead.
- **Railgun is dead upstream.** Cloudflare shut Railgun down on 2024-01-31. The Railgun code is harmless, but don't extend it.

## Commands

Package manager: **yarn v1** for now (`yarn.lock` is committed; don't add a `package-lock.json`). Plan chunk 1.1 moves to Node 26 + npm; update this section when it lands.

**Run everything in the dev container** (`compose.yaml` + `docker/`). It has network access, a pinned Node, and its own `node_modules` volume, so nothing depends on what's installed on the host. Dependencies install automatically on the first run and whenever `package.json` or `yarn.lock` changes. Pass `-T` when running without a terminal (agents, scripts).

| Task | Command |
|---|---|
| Lint + all tests | `docker compose run --rm -T dev yarn test` (eslint on `source/` excluding `airports.js`, then jest) |
| One test file | `docker compose run --rm -T dev npx jest source/request.test.js` |
| Lint one file | `docker compose run --rm -T dev npx eslint source/request.js` |
| Build | `docker compose run --rm -T dev yarn build` → `dist/` on the host (unpacked extension) |
| Add a dependency | `docker compose run --rm -T dev yarn add -D <pkg>` (commit both `package.json` and `yarn.lock`) |
| Shell | `docker compose run --rm dev` |
| Rebuild image / reset deps | `docker compose build` / `docker compose down -v` |

If you edited `package.json` by hand and `--frozen-lockfile` install fails, run `docker compose run --rm -T -e SKIP_INSTALL=1 dev yarn install` to update the lockfile.

Definition of done: `yarn test` passes. If you touched `manifest.json`, HTML, images or `webpack.config.js`, also run `yarn build` and check that every file `manifest.json` references exists in `dist/`. If you couldn't run a command (no network for `yarn install`, for example), say so. Don't claim it passed.

## Layout

```
source/
  manifest.json            MV2 manifest (copied to dist/ as-is)
  claire.js                background page (AMD define), event wiring, per-tab state
  request.js               Request class: all header parsing / detection logic  <- most changes go here
  request.test.js          unit tests for Request
  contentscript.js         runs at document_start, reports nextHopProtocol
  page-action-popup.html/.js   popup UI
  options.html/.js         options page (2 checkboxes)
  options.test.js          jsdom test for options
  style.css                shared styles (bundled with purecss + octicons)
  airports.js              ~1 MB, single line: IATA code -> {city, country, ...} (OpenFlights data)
  images/                  icon variants (see "Icon naming")
resources/chrome-promo/    Web Store promo art (not shipped)
webpack.config.js          4 entries: background, contentscript, options, popup -> dist/[name].js/.css
compose.yaml, docker/      dev container (Dockerfile + entrypoint that auto-installs deps)
docs/modernization-plan.md the roadmap: ordered, chunked work with acceptance criteria
CLAUDE.md                  imports this file for Claude Code
```

## How it works

1. **Capture.** `claire.js` listens to `chrome.webRequest.onCompleted` for `main_frame` requests with `responseHeaders`. It builds a `new Request(details)` and stores it in `window.requests[tabId]`, and it cleans up on `tabs.onRemoved` and `tabs.onReplaced`.
2. **Protocol.** `contentscript.js` reads `performance.getEntriesByType('navigation')[0].nextHopProtocol` (`'h2'`, `'h3'`, `'http/1.1'`) and sends `{type}` to the background, which calls `request.setConnectionInfo()`.
3. **Icon.** On `webNavigation.onDOMContentLoaded` (top frame only, skipped when `details.fromCache`), the background calls `request.queryConnectionInfoAndSetIcon()`. That asks the content script (`{action: 'check_connection_info'}`) if it doesn't have protocol info yet, then calls `setPageActionIconAndPopup()`.
4. **Popup.** `page-action-popup.js` gets the background page via `chrome.extension.getBackgroundPage()`, reads `requests[activeTabId]`, and fills the DOM from `Request` getters. It hides the Ray, location, actions and Railgun cards when they don't apply.
5. **Options.** These are stored as `localStorage` flags with `'yes'`/`'no'` values: `debug_logging` (read by `Request.logToConsole`) and `hide_guide` (read by the popup). The options page, the popup and the background share one `localStorage` because they share the extension origin.

Detection rules (in `request.js`):

- **Cloudflare:** the `Server` header matches `/^cloudflare/i`.
- **Ray ID / colo:** the `CF-RAY` header has the form `<rayid>-<IATA>`. The colo code is looked up in `airports.js`, and the code itself is shown if the lookup fails.
- **IPv6:** `details.ip` contains `:`.
- **H2:** `connectionType === 'h2'`.
- Header names are **upper-cased** into `request.headers`. Duplicate header names collapse to the last value.

### Icon naming

The icon is chosen purely by file name in `Request.getImagePath()`:

```
images/claire-3-{on|off}[-h2][-ipv6][-rg].png  (+ @2x.png)   page-action icon, 19/38px
images/claire-3-popup-{on|off}[-h2][-ipv6][-rg].png          popup "guide" image (no @2x)
```

Suffix order is fixed: `h2`, then `ipv6`, then `rg`. `off-*-rg` files don't exist, because Railgun implies Cloudflare. Adding a new flag (e.g. `h3`) means creating every combination for both sets (plus `@2x`) or changing the scheme. Never produce a name that has no file.

## Conventions

- **Style:** xo-space via eslint, i.e. 2-space indent, single quotes, semicolons. Source uses ES5-style `var` + prototype methods (some `let`, and arrow functions in tests). Match the surrounding code. Don't introduce ESM `import`/`export`, classes or newer syntax unless you are deliberately upgrading the toolchain in the same change.
- **Modules:** CommonJS (`require` / `module.exports`). `claire.js` uses AMD `define`, which webpack resolves too.
- **`if (require.main === module)` guard** (options.js, page-action-popup.js): code inside runs only in the webpack bundle, never under jest. CSS `require`s live inside this guard so tests don't need loaders. Keep that pattern.
- **Keep logic testable.** Put detection and parsing in `Request` methods that only read `this.details` and `this.headers`. Keep `chrome.*` calls in `claire.js`, the popup, and the two existing icon/message methods.
- **Tests:** jest 20 with the default **jsdom** environment. The `chrome` global is **not** mocked, so stub `global.chrome` in the test if you must exercise those paths. Build fake inputs the way the existing tests do: `{responseHeaders: [{name, value}], ip, url, tabId, fromCache}`. Every behavior change to `Request` needs a test.
- **Commits:** conventional style, as in history: `fix: ...`, `chore: ...`, `test: ...`, `fix(request): ...`. One logical change per commit/PR.
- **Version bumps** go in `source/manifest.json` only.

## Gotchas and don'ts

- **Never `cat` or open `source/airports.js`** (it's being replaced in plan Phase 3). It's ~1 MB on one line and will flood your context. To look up an entry: `grep -o '"SFO":{[^}]*}' source/airports.js`.
- Don't commit `dist/`, `node_modules/` or `coverage/` (all gitignored).
- No remote code or CDN assets. CSP is `script-src 'self'` (MV3 forbids remote code anyway). CSS and fonts are bundled by webpack, and inlined under 10 KB via url-loader.
- `manifest.json` → `page_action.default_popup` is `"popup.html"`, but the build ships `page-action-popup.html`. It only works because `setPopup()` overrides it at runtime. Keep the two consistent if you touch either.
- `browser_style` in the manifest is a Firefox-only key.
- Don't add permissions without stating why in the PR. Host access is already `http://*/` + `https://*/`.
- Don't push, tag, or publish to a store unless explicitly asked.

## Manual check (for a human, after `yarn build`)

Load `dist/` unpacked (Firefox for now, Chrome after the MV3 migration), then:

- `https://www.cloudflare.com` → orange icon. The popup shows the IP, a Ray ID, a colo city, and a Trace link that opens `/cdn-cgi/trace`.
- `https://www.google.com` → grey icon. The popup shows only the IP.
- An IPv6-reachable Cloudflare site (if your network has v6) → icon with the ipv6 badge.
- Options page: toggling "Hide Claire's icon guide" hides the image at the top of the popup.

## Roadmap: how to pick up work

All planned work lives in [`docs/modernization-plan.md`](docs/modernization-plan.md), as ordered chunks with acceptance criteria. Known bugs in 0.21.0 are listed in Phase 2; don't fix them during the 0.1 import.

1. Take the first unchecked chunk whose dependencies are done, unless the maintainer names a different one.
2. Branch `modernize/<id>-<slug>`, and do only that chunk. Ideas and bugs you find along the way go into the plan, not into this PR.
3. Meet the chunk's acceptance criteria in the dev container, tick its checkbox in the plan, and update this file if commands or conventions changed, all in the same PR.
4. If the plan no longer matches the code, or a chunk says *decision needed*, stop and ask the maintainer before writing code.
