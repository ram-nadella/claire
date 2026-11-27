# Claire modernization plan

*Last updated: 2026-11-27. Maintainer: Ram Nadella.*

This plan gets the repo back in sync with the published extension (v0.21.0, MV3), then hardens it and builds it out in small steps that each leave `master` working. The 0.21.0 code is tiny (about 300 lines of plain JavaScript, with no build step and no dependencies), so most chunks fit in one focused session.

## How to work this plan

- **Do chunks in order.** Each chunk lists what it depends on. Chunks marked *parallel-safe* can be done in any order once their dependencies are done.
- **One chunk = one branch = one PR**, named `modernize/<id>-<slug>` (e.g. `modernize/1.1-toolchain`). Don't fold in work from other chunks. If you find something worth doing, add it to this plan instead.
- **Behavior-neutral unless the chunk says otherwise.** Tooling chunks must not change what users see.
- **Done means:** the acceptance criteria are met, CI is green (once it exists), this file's checkbox is ticked in the same PR, and AGENTS.md is updated if commands or conventions changed.
- **If reality disagrees with the plan** (code moved, a step is wrong, a decision is needed), stop. Update the plan, or ask the maintainer, before writing code.

## Progress

- [x] **Phase 0: Get back in sync with the store**
  - [x] 0.1 Import v0.21.0 as the new codebase
  - [x] 0.2 Fork identity cleanup
- [ ] **Phase 1: Foundation**
  - [x] 1.1 Node 26 + npm + formatting and lint, in the dev container and CI
  - [ ] 1.2 Build tooling decision (no-build vs WXT)
  - [ ] 1.3 Release workflow (store zip built from a tag)
  - [ ] 1.4 Shared ES module + unit tests
  - [ ] 1.5 End-to-end smoke test
  - [ ] 1.6 Type checking
- [ ] **Phase 2: Harden v0.21.0**
  - [ ] 2.1 Tab state: `chrome.storage.session`, tied to the page on screen
  - [ ] 2.2 Debug logging off by default
  - [ ] 2.3 Popup: empty state, crashes, no `innerHTML`
  - [ ] 2.4 Host permissions (HTTP sites are missed)
  - [ ] 2.5 Detection rules
  - [ ] 2.6 Toolbar icon and listing text
  - [ ] 2.7 Release 0.22.0
- [ ] **Phase 3: Data center names (without `airports.js`)**
  - [ ] 3.1 Colo data generator
  - [ ] 3.2 Show city and country in the popup
  - [ ] 3.3 Scheduled data refresh
- [ ] **Phase 4: Features**
  - [ ] 4.1 Copy buttons for IP and Ray ID
  - [ ] 4.2 Settings (debug toggle, and anything else that earns a place)
  - [ ] 4.3 Icon badges for HTTP version and IPv6 (decision needed)
  - [ ] 4.4 Permissions review
  - [ ] 4.5 On-demand `/cdn-cgi/trace` details (optional)
  - [ ] 4.6 Firefox build (decision needed)
- [ ] **Phase 5: Distribution and docs**
  - [ ] 5.1 Automated store upload (optional)
  - [ ] 5.2 README and privacy note

## Where we're going

| Area | Today (store v0.21.0) | Target |
|---|---|---|
| Repo vs store | `master` is v0.11.1 (MV2); 0.21.0 was never committed | Every store upload is built from a tagged commit (1.3) |
| Manifest | MV3, service worker | Same, with a corrected permission list |
| Code | Plain JS, no modules; storage-key helper duplicated in popup and background | ES modules (`"type": "module"` service worker, module script in the popup) with one shared module |
| Node / package manager | none needed | **Node 26** (current Active LTS) and **npm**, for dev tooling only. npm ships with Node; Corepack no longer does from Node 25 on. |
| Build | none (load the folder unpacked) | Stay no-build unless 1.2 decides otherwise |
| Tests | none | Vitest unit tests + Playwright smoke test |
| Lint / format | none (code looks Prettier-formatted) | Prettier + ESLint flat config, enforced in CI |
| Types | none | JSDoc + `tsc --checkJs` (no build step) |
| Tab state | `chrome.storage.local`, keyed by tab only: written to disk, never cleared on navigation, so it goes stale | `chrome.storage.session`, checked against the page on screen (2.1) |
| Default icon | pure white, invisible on light toolbars | readable on light and dark toolbars (2.6) |
| Data center names | the code only (e.g. `SFO`) | City and country from a small generated `colos.js` |
| CI | broken (retired `actions/cache@v2`) | lint, typecheck, unit tests, e2e, zip artifact |

---

## Phase 0: Get back in sync with the store

### 0.1 Import v0.21.0 as the new codebase

**Input:** `claire-0-21-0.crx`, downloaded from the Chrome Web Store into the repo root. **Don't commit it**; `*.crx` is gitignored. Its SHA-256 is `8313e9477a978a65273ea64182d2c654f09ab1189e2c3d0aa186058629342400`; check it before importing. It unpacks with `unzip` (ignore the "extra bytes" warning: that's the CRX header). The JavaScript isn't bundled, so the package is the source. If the maintainer later finds the original working tree (with any `package.json`, Prettier config or tests), prefer that and redo this step from it.

**Steps**
1. If the scaffolding isn't committed yet, commit it on its own first: `AGENTS.md`, `CLAUDE.md`, `compose.yaml`, `docker/`, `docs/`, `.gitignore`, `.dockerignore`. The uncommitted `package.json` build-script tweak can go with it or be dropped, since step 4 deletes that file.
2. Tag the last commit with the 0.11.1 code (`a708a8d`) as `v0.11.1`, so the old code stays easy to find. No such tag exists yet; the newest is `v0.6.1`. Pushing the tag is the maintainer's call.
3. Unpack the CRX outside the repo. Copy `manifest.json`, `background.js`, `popup.html`, `popup.js` and `icons/` into `src/`, so the extension loads unpacked from that folder.
   - **Drop `_metadata/`** (the store's signature data).
   - **Drop the `"update_url"` key** from `manifest.json` (the store injects it).
   - Change nothing else. Fixes come in later chunks.
4. Remove the MV2 codebase and its tooling:
   - `source/`, `webpack.config.js`, `package.json`, `yarn.lock`
   - `resources/` (stale promo art for the old icons)
   - `.travis.yml`, and the broken `.github/workflows/main.yml` (CI returns in 1.1)

   Keep `AGENTS.md`, `CLAUDE.md`, `compose.yaml`, `docker/`, `docs/`, `LICENSE.md` and `README.markdown`.
5. Keep the dev container starting. `docker/entrypoint.sh` runs `cat package.json yarn.lock` under `set -euo pipefail`, so once step 4 deletes those files, every `docker compose run` fails. Make it skip the install check when `package.json` is missing. 1.1 replaces the entrypoint anyway.
6. Commit everything as `chore: import v0.21.0 from the published package`, with the CRX's SHA-256 in the commit message.
7. Rewrite AGENTS.md's *Layout*, *How it works*, *Commands*, *Conventions* and *Gotchas* sections for the new code. Until 1.1 adds lint, there's nothing to run, so the definition of done is the manual check below. Say so in AGENTS.md, and update CLAUDE.md's dev-container note to match.

**Acceptance:**
- Loading `src/` unpacked in Chrome behaves like the store build: orange on cloudflare.com, grey on google.com, and the popup shows the IP, IP version, HTTP version, Ray ID, data center code and a Trace link. The 0.21.0 bugs listed in Phase 2 stay as they are.
- `git diff` between `src/` and the unpacked CRX shows only the removed `update_url`.
- `docker compose run --rm -T dev true` succeeds.

### 0.2 Fork identity cleanup (*parallel-safe after 0.1*)

**Steps**
- README:
  - Describe the project as maintained here, and keep the Chrome Web Store badge (it's the maintainer's listing).
  - Remove the Firefox Add-ons badge and link unless the maintainer confirms that listing is theirs.
  - Rewrite "From source": load `src/` unpacked, with no build step.
  - Remove the `is.gd` short link if it doesn't point at the current listing.
- LICENSE: keep the BSD-3 text and all existing copyright notices (the license requires it). Add a line for the maintainer's own copyright on new work. Drop the jQuery and RequireJS/Dojo notices if those libraries no longer ship. Don't use Cloudflare's name in ways that imply endorsement (clause 3).

**Acceptance:** no remaining links send users to `cloudflare/claire` for support, issues or installs.

**Done (2026-11-27):** `README.markdown` → `README.md` and `LICENSE.md` → `LICENSE` (plain text, so GitHub detects BSD-3-Clause). The Firefox badge is gone: AMO's API doesn't return the `cloudflare-claire` listing publicly, so it isn't a live listing to send users to (4.6). `is.gd/claire` still redirects to the store listing, so it stays. The jQuery, RequireJS, Pure, Normalize.css and Octicons notices are gone, since none of them ship in 0.21.0. The maintainer chose not to add a copyright line of their own. The disclaimer's "YAHOO! INC.", copied from Pure's license, now reads "THE COPYRIGHT HOLDER OR CONTRIBUTORS", the standard BSD-3 wording.

---

## Phase 1: Foundation

### 1.1 Node 26 + npm + formatting and lint, in the dev container and CI

**Steps**
1. Add a dev-only `package.json` (`"private": true`, no runtime dependencies), `package-lock.json`, `.node-version` (26), and `engines`.
2. Switch the dev container to `node:26-slim`, with the entrypoint running `npm ci` (replacing 0.1's stopgap).
3. Add Prettier (matching the existing style, so the first run changes little or nothing) and an ESLint flat config with browser + `chrome` globals. Scripts: `npm run lint`, `npm run format`.
4. Add a GitHub Actions workflow (current majors of `actions/checkout` and `actions/setup-node`, Node from `.node-version`, npm cache) that runs lint and uploads a zip of `src/` as an artifact.

**Acceptance:** `docker compose run --rm -T dev npm run lint` passes, and CI is green on a PR. The extension files are untouched apart from formatting.

### 1.2 Build tooling decision (*decision needed; settle it before 1.4*)

**Why now:** WXT would change the file layout and test setup that 1.4 and 1.5 build on.

**No-build (recommended):** what's in `src/` is exactly what ships. You get zero runtime dependencies, easy store review, and ES modules plus JSDoc types without compiling. Firefox doesn't need a build either: one manifest can serve both browsers (see 4.6).

**WXT (Vite-based framework):** generates per-browser manifests, and brings a dev mode with auto-reload and `wxt zip`/`wxt submit`. The cost is a framework dependency and a build step, for about 300 lines of code.

**Acceptance:** the decision is recorded here. If WXT, add a migration chunk right after this one and rewrite 1.3–1.5 for its layout.

### 1.3 Release workflow (*parallel-safe after 1.1*)

**Why:** this whole recovery exercise happened because 0.21.0 was uploaded from a working tree that was never committed. From now on, uploads come only from CI artifacts. This comes before Phase 2 so its fixes can ship (2.7).

**Steps:** on a `v*` tag, CI checks that the tag matches `manifest.json`'s version, zips an explicit list of runtime files from `src/` (or the build output), and attaches the zip to a GitHub release. That zip is what gets uploaded to the store. Add a `CHANGELOG.md`.

**Acceptance:** a manual run (`workflow_dispatch`) produces a zip that loads unpacked and holds only runtime files, and a tag that doesn't match the manifest version fails.

### 1.4 Shared ES module + unit tests (*depends on 1.2*)

**Why:** `getStorageKeyForTab` is duplicated (there's a TODO about it), and nothing is tested.

**Steps**
1. Move the pure logic into `src/lib/request-info.js` and export it:
   - header lookup
   - details → request info
   - storage key
   - Ray ID / colo parsing
   - IP version
   - Cloudflare detection
2. Split the popup's rendering into a function that takes the saved request info, so tests (and 1.5) don't depend on `chrome.tabs`.
3. Load the background as a module (`"background": {"service_worker": "background.js", "type": "module"}`) and the popup with `<script type="module">`, both importing from the shared module. No bundler is needed.
4. Add `minimum_chrome_version`. `"106"` covers the module service worker, `chrome.storage.session` and the `documentLifecycle`/`frameType` fields that 2.1 uses. Raise it when a later chunk needs something newer.
5. Add Vitest with plain-object fixtures. Put tests in `test/`, not `src/`: with no build step, everything in `src/` ships. Port the still-relevant cases from the old `source/request.test.js` (available at tag `v0.11.1`): Server-header detection, Ray ID and colo parsing, IPv4/IPv6.

**Acceptance:** `npm test` passes in the container and in CI, the duplication is gone, and the extension behaves the same (checked by hand, or by 1.5 once it exists).

### 1.5 End-to-end smoke test (*depends on 1.4*)

**Steps:** a Playwright test, run in the dev container (which has network), that loads `src/` as an unpacked extension.
- Use Playwright's bundled Chromium (or Chrome for Testing) with `launchPersistentContext`. Branded Chrome 137+ ignores `--load-extension`, so don't use `channel: 'chrome'`.
- Serve local fixture pages: one with `Server: cloudflare` and a `CF-RAY` like `0123456789abcdef-SFO`, one without. Until 2.4 adds `http://` host permissions, webRequest only fires for https, so serve them over https with a self-signed certificate and launch with `--ignore-certificate-errors`. Keep live sites to one optional check that can be skipped offline.
- Check the stored tab state, and render the popup against it. Opening `popup.html` in a tab doesn't work as it is: the popup looks up the active tab, which would be the popup itself. Pass the tab in (for example `popup.html?tab=<id>`), or test 1.4's render function.
- Add it to CI.

As Phase 2 fixes land, add their cases here (2.1 lists the navigation ones).

**Acceptance:** green in the container and in CI. It fails if detection or the popup breaks.

### 1.6 Type checking (*parallel-safe after 1.4; doesn't block Phase 2*)

**Steps:** add `// @ts-check`/`checkJs` with a `jsconfig.json`, JSDoc types for the request-info shape and storage values, `@types/chrome`, and `npm run typecheck` in CI. Where types reveal a bug, add it to Phase 2 rather than fixing it here.

**Acceptance:** `typecheck` passes.

---

## Phase 2: Harden v0.21.0

Bugs found reading the 0.21.0 code. Each fix needs a unit or e2e test, so Phase 2 depends on 1.4 and 1.5 (not on 1.6).

### 2.1 Tab state: `chrome.storage.session`, tied to the page on screen

The background keeps one entry per tab in `chrome.storage.local` (`tab-request-details-<tabId>`). It writes the entry on every top-level `webRequest.onCompleted` and never clears it when the tab navigates. Neither the `webNavigation.onDOMContentLoaded` handler nor the popup checks that the entry belongs to the page on screen. That causes:

- **Stale data on pages with no webRequest event.** Navigation events fire on every page, webRequest events only where Claire has host permission. So in a tab that last loaded a Cloudflare site, a later `http://` page (no host permission until 2.4) gets the old entry re-applied, and its icon turns orange. On `http://`, `chrome://`, new-tab and network-error pages, the popup shows the old site's IP and Ray ID. Restores from the back/forward cache probably do the same.
- **Responses that never replace the page overwrite it.** A 204 response (and probably a download) fires `onCompleted` for the tab and replaces the visible page's entry.
- **Prerendered pages overwrite the visible one.** When Chrome prerenders a page (omnibox predictions, speculation rules), webRequest reports a `main_frame` request with the current tab's ID, a non-zero `frameId` and `documentLifecycle: "prerender"`. `onCompleted` doesn't filter these, so the icon can flip to a page the user hasn't opened. Chrome's guidance is to check `frameType` and `documentLifecycle` rather than `frameId === 0`, which the DOMContentLoaded handler relies on.
- **A browsing log on disk.** Every top-level URL (query string included) and its IP is written to disk, including incognito tabs when the user allows incognito (both modes share storage by default). `tabs.onRemoved` cleans up, but not for tabs still open at shutdown or crash. Tab IDs restart with the browser, so an old entry can even match a new tab.
- **`tabs.onReplaced` overwrites the new tab's own entry** with the old tab's, and stores `undefined` when the old tab had none.
- **Unhandled rejections.** `chrome.action.setIcon` on a tab that just closed rejects, and nothing catches it.

**Steps**
- Move tab state to `chrome.storage.session`. It stays in memory, so nothing reaches disk, and popups can read it because they're a trusted context.
- Keep two slots per tab: `pending` (the latest top-level response) and `current` (the page on screen).
  - `onCompleted` fills `pending`, or `current` if the tab has already committed that URL.
  - A top-frame commit (`webNavigation.onCommitted` with `frameType: "outermost_frame"` and `documentLifecycle: "active"`) moves `pending` to `current` when the URLs match, ignoring the fragment. Otherwise it clears `current` and resets the icon.
  - The icon and the popup only ever read `current`.
  - This covers responses that never commit (204s, downloads), prerendered pages (moved over on activation), and pages with no webRequest event. Confirm Chrome's event order for prerender activation in the 1.5 smoke test before relying on it.
- Store only what matching and the popup need: the URL without its fragment, the IP, and the `Server` and `CF-RAY` values.
- In `tabs.onReplaced`, copy the old tab's entry only when the new tab has none.
- Catch `setIcon` failures and route them through the debug logger.
- In `runtime.onInstalled`, remove the old `tab-request-details-*` keys from `storage.local`.

**Tests:** unit tests for the slot logic. E2e cases: a Cloudflare page followed, in the same tab, by `chrome://version`, a network-error page, and Back; a link to a 204 response; a page prerendered with speculation rules.

### 2.2 Debug logging off by default

`background.js` runs `chrome.storage.local.set({ debug: true })` on every service worker start, so debug logging is always on in production. Every log call also reads storage.
- Default it to off, and remove the write.
- In `runtime.onInstalled`, when `previousVersion` is 0.21.x, remove the `debug: true` that version left behind. Don't clear it on later updates, since 4.2's toggle will store the user's choice under that key.
- Read the flag once per service worker start and keep it current with `chrome.storage.onChanged`, instead of reading storage on every log call.

The toggle UI comes in 4.2.

### 2.3 Popup: empty state, crashes, no `innerHTML`

- **No entry for the tab:** the popup throws. That happens on `chrome://` pages, new tabs, tabs opened before install or a browser restart, and (after 2.1) any page whose entry was cleared. Show a short empty state instead, such as "Reload the page to see details."
- **No IP:** `details.ip` is missing for responses from the HTTP cache (common after Back), so `ipAddress.includes(...)` throws and the HTTP version never appears. Show "unknown".
- **No `CF-RAY`:** a response with `Server: cloudflare` and no `CF-RAY` header throws at `.split("-")`. Show the Cloudflare state without the Ray ID and data center.
- **Everything shows when it fails:** the HTML shows both clouds and both "using / not using Cloudflare" lines, and the script hides what doesn't apply. So when the script throws, all of them stay visible. Hide them by default and reveal the right one on success.
- **HTTP version:** `chrome.scripting.executeScript` (used to read `nextHopProtocol`) rejects on pages it can't script, and nothing catches it. `nextHopProtocol` is also `""` for pages from the cache. Show "unknown" for both.
- **No `innerHTML`:** the popup builds HTML from response-header values (`CF-RAY`) and the page URL, and a site can send any header. MV3's extension-page CSP blocks inline scripts, so this is HTML injection (fake text or links in the popup) rather than script execution, but build DOM nodes with `textContent` anyway.
- **Trace link:** setting `pathname` on the page URL keeps its query string and fragment. Use `new URL('/cdn-cgi/trace', url)`.
- Add `alt` text to the cloud images.
- Remove unused code: `getTitle`, the module-level `servedByCloudflare`/`protocolVersion`, and the `console.log` calls (or route them through the debug logger).

### 2.4 Host permissions (HTTP sites are missed)

`host_permissions` is `["https://*/*", "https://*/*"]` (https twice). Without an `http://` pattern, plain-HTTP sites never get `webRequest` events, so they never get an icon. Change it to `["http://*/*", "https://*/*"]`.

**Before shipping:** check whether this changes the install-time permission warning. If it does, Chrome disables the extension for existing users until they approve. It probably doesn't: Chrome already treats `https://*/*` as access to all sites when it words the warning. Confirm by comparing the permissions listed on the extension's details page in `chrome://extensions` before and after.

### 2.5 Detection rules

- 0.21.0 treats a page as Cloudflare only when `Server` is exactly `cloudflare`. 0.11.1 matched any `Server` starting with `cloudflare`.
- Decide the rule, and consider the `CF-RAY` header as a second signal. (2.3 already keeps the popup working when `CF-RAY` is missing.)
- Record the rule in AGENTS.md, and cover it with tests (`cloudflare`, `Cloudflare`, a missing header, `nginx` with `CF-RAY`, and so on).

### 2.6 Toolbar icon and listing text

- **The default icon is invisible.** `cloud-white-*.png` is pure white on a transparent background. It's what shows on new tabs, `chrome://` pages and anywhere nothing was detected, and it disappears on Chrome's default light toolbar and in the extensions menu. Replace it with an icon that reads on light and dark toolbars (see the open questions).
- **No 16 px icon.** `setIcon` and `default_icon` only provide 32 px and larger, while toolbar icons are 16 px (32 px on high-DPI screens). Add 16 px variants and pass both sizes.
- **Listing text.** The manifest `description` says "omnibar", but MV3 action icons live in the toolbar, and they start hidden in the extensions menu until the user pins them. Update the description, and tell users to pin Claire (README, 5.2).

**Acceptance:** checked by hand in light and dark themes, the icon is visible in each state (default, Cloudflare, not Cloudflare).

### 2.7 Release 0.22.0 (*maintainer; depends on 1.3 and the rest of Phase 2*)

Phase 2 fixes bugs users have had since July 2024, so ship them before starting Phase 3.
- Bump `manifest.json` to `0.22.0` and add the changelog entry.
- The maintainer tags `v0.22.0` and uploads the zip from 1.3's release to the store.

**Acceptance:** the store lists 0.22.0, and the uploaded zip is the one attached to the `v0.22.0` release.

---

## Phase 3: Data center names (without `airports.js`)

0.21.0 already dropped the 1.1 MB `airports.js` and shows only the colo code (e.g. `SFO`). This phase brings back city and country names in a way that stays small and current.

### Why `airports.js` was a bad pattern, and what replaces it

- **Size:** 1.1 MB on one line, loaded into the background on every start, for a lookup that needs a few hundred entries.
- **Wrong dataset:** it was every airport in the world from a dated OpenFlights dump, not Cloudflare's data center list. New colos could be missing, and city names came from the airport rather than how Cloudflare names the location.
- **Not maintainable:** there was no script to regenerate it, so it could only go stale. It was also hostile to agents, since opening it floods the context window.

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **A. Generated snapshot (recommended)** | A script pulls Cloudflare's own location list at dev time and writes a compact, sorted `colos.js` that's committed | Small, reviewable diffs. No runtime network or extra permissions. Works offline. | Can lag new colos until the next refresh (3.3) |
| B. Runtime fetch + cache | The extension fetches the list and caches it in `chrome.storage.local` with a TTL, with a bundled fallback | Always fresh | Network calls from every install, more failure modes, a harder privacy story, and still needs a fallback |
| C. Ask the site (`/cdn-cgi/trace`) | Request the trace for each page | Gives `colo=` directly | Only a code, not a city. An extra request to every site is intrusive. |

**Data sources for the generator:**
- `https://speed.cloudflare.com/locations` returns JSON entries with `iata`, `city` and `cca2` (country code). It's undocumented but widely used.
- As a cross-check, the public Statuspage API at `https://www.cloudflarestatus.com/api/v2/components.json` lists each data center as a component named like `Ashburn, United States - (IAD)`.

Because the result is a committed snapshot, the extension never depends on either endpoint at runtime.

**Data shape:** `src/data/colos.js`, a generated ES module: `export default { "SFO": ["San Francisco", "US"], ... }`. Store only the city and the two-letter country code. Unlike a JSON file, a JS module imports anywhere without `fetch` or JSON import attributes (Chrome 123+). Render the country with `new Intl.DisplayNames([navigator.language], { type: 'region' }).of('US')`, which keeps the file small and gives localized country names for free.

### 3.1 Colo data generator (*parallel-safe after 1.1*)

**Steps:** write `scripts/update-colos.mjs` (run with `npm run update-colos` in the container). It fetches both sources, merges them with the speed list as primary and the status page filling gaps, and applies `scripts/colo-overrides.json` for manual fixes. It writes `src/data/colos.js` with sorted keys and stable formatting, and prints the added and removed codes.
- **Guard against upstream glitches:** if a source returns far fewer entries than the current file has (say, under 90%), fail without writing.
- **Don't delete codes automatically.** Keep codes that disappear upstream and print them for review; the maintainer removes them through the overrides file.

**Acceptance:** two runs with no upstream changes give byte-identical output, and the file is well under 50 KB.

### 3.2 Show city and country in the popup (*depends on 1.4, 3.1*)

**Steps:** a `coloInfo(code)` helper in the shared module returns `{ code, city, countryCode, countryName }`, or just `{ code }` for unknown codes. The popup shows "San Francisco, United States (SFO)", or the bare code when the city is unknown. Import the data from `src/data/colos.js`.

**Tests:** known code, unknown code, localized country name.

### 3.3 Scheduled data refresh

**Steps:** a monthly GitHub Actions workflow runs the generator and opens a PR if `colos.js` changed. There's no auto-merge; the maintainer reviews the diff.
- PRs opened with the default `GITHUB_TOKEN` don't trigger `pull_request` workflows, so CI won't run on the refresh PR. Open it with a GitHub App token, or run lint and tests in the refresh workflow before opening the PR.
- The repository setting that lets GitHub Actions create pull requests must be on.

**Acceptance:** a manually triggered run opens a PR or reports "no changes".

---

## Phase 4: Features

All of these are *parallel-safe* after Phase 2.

### 4.1 Copy buttons for IP and Ray ID

0.11.1 had them; 0.21.0 dropped them. Use `navigator.clipboard.writeText` from the popup, with no extra permission.

### 4.2 Settings

At minimum, a debug-logging toggle (there's a TODO in `background.js`). Use `chrome.storage.local`, either in a small options page or a footer link in the popup. Only add settings that earn their place.

### 4.3 Icon badges for HTTP version and IPv6 (*decision needed*)

0.11.1 encoded h2/IPv6 in the toolbar icon through 36 PNG combinations; 0.21.0 shows only orange or grey. If this comes back, compose the icon from layers with `OffscreenCanvas` → `chrome.action.setIcon({ imageData })` instead of making a PNG for every combination. A simpler option is `chrome.action.setBadgeText` (e.g. `6` or `h3`).

The protocol is only known after a script runs in the page, which today happens when the popup opens. To have it at page load, the background can call `chrome.scripting.executeScript` on each top-frame navigation, or the manifest can declare a content script. Neither needs a new permission, since `scripting` and the host permissions already cover it. The cost is running a script in every page.

### 4.4 Permissions review

Justify or remove each permission, and write the final list and reasons into AGENTS.md:
- `webRequest`: response headers and IP
- `webNavigation`: restores the icon on back/forward and prerender, and (after 2.1) tells Claire when a tab moves to a new page
- `storage`
- `scripting` + `activeTab`: reading `nextHopProtocol` from the popup. Once 2.4 adds `http://*/*`, `activeTab` is redundant, because the host permissions already cover every page it could unlock. Removing a permission never prompts.
- the host permissions

Adding permissions on update triggers a re-approval prompt, so batch any additions. The Web Store's privacy practices tab asks for a justification of each permission; reuse this text there.

### 4.5 On-demand `/cdn-cgi/trace` details (*optional*)

When the popup opens on a Cloudflare page, fetch that site's `/cdn-cgi/trace` once and show the useful fields, such as TLS version, HTTP version and WARP status. Only on popup open, never on every navigation.
- Fetch with `credentials: 'omit'`, so the site's cookies aren't sent.
- Label the result as a new request: its data center and HTTP version can differ from the page load's.
- The response includes the user's public IP; say so in the 5.2 privacy note.

### 4.6 Firefox build (*decision needed*)

**Question for the maintainer:** ship on Firefox? The old README's Firefox badge pointed to an `addons.mozilla.org/.../cloudflare-claire/` listing that's probably upstream's and isn't publicly listed anymore; 0.2 removed the badge.
- It doesn't need separate manifests or a build step. One manifest can carry both `background.service_worker` (Chrome) and `background.scripts` (Firefox): Chrome 121+ ignores `scripts` in MV3, and Firefox 121+ ignores `service_worker`. Raise `minimum_chrome_version` to 121.
- Firefox needs `browser_specific_settings.gecko.id`. New Firefox listings must also declare `data_collection_permissions` (required since November 2025); Claire would declare `none`.
- Check each API Claire uses against MDN's compatibility tables. Playwright only loads extensions in Chromium, so test Firefox by hand or with `web-ext run`.
- It needs a new AMO listing under the maintainer's account.

---

## Phase 5: Distribution and docs

### 5.1 Automated store upload (*optional*)

Upload from CI with the Chrome Web Store API, using secrets held in GitHub. This is the maintainer's call; uploading the 1.3 zip by hand is fine.

### 5.2 README and privacy note

Cover install (including pinning Claire to the toolbar, see 2.6), development (dev container), the project's maintained-fork status, and how to report issues. Add a privacy note:
- what the extension reads: response headers, IP and protocol of the top-level page
- that it keeps them in memory only (2.1)
- that nothing leaves the browser except the optional 4.5 request to the site itself, whose response includes the user's public IP

---

## Ongoing

- Security tooling is on as of 2026-11-27: Dependabot alerts and security updates, weekly grouped version updates with a 7-day cooldown (`.github/dependabot.yml`), CodeQL default setup, secret scanning with push protection, and private vulnerability reporting (`SECURITY.md`). Triage Dependabot PRs and code scanning alerts as they come in.
- Keep AGENTS.md's command table and conventions in sync with each chunk.

## Open questions for the maintainer

1. Is the store CRX the best copy of 0.21.0, or is a source tree with extra files (`package.json`, tests, Prettier config) still out there? (0.1)
2. Stay no-build, or move to WXT? (1.2) The recommendation is no-build. One manifest can serve Firefox too (4.6), so Firefox is no longer a reason for WXT.
3. Ship a 0.21.1 hotfix of 2.2, 2.4 and the 2.3 crash fixes, checked by hand, before Phase 1 is done? Or wait for 0.22.0 (2.7)?
4. Detection rule: exact `Server: cloudflare`, a prefix match, or also `CF-RAY`? (2.5)
5. Default icon: the grey cloud, or a new outlined cloud so "unknown" looks different from "not Cloudflare"? (2.6)
6. Bring back HTTP-version and IPv6 badges on the toolbar icon? (4.3)
7. Ship on Firefox? Was the `cloudflare-claire` AMO listing yours? (4.6)

---

## Appendix: what 0.21.0 changed vs 0.11.1

From reading the store package (`claire-0-21-0.crx`, 14 files, 17 KB). The bugs found in it are listed in Phase 2.

| | 0.11.1 (`master`, MV2) | 0.21.0 (store, MV3) |
|---|---|---|
| Background | persistent page, AMD module, `window.requests` | service worker, plain script, `RequestInfo` objects in `chrome.storage.local` |
| HTTP version | content script on every page sends `nextHopProtocol` | the popup runs `executeScript` in the tab when opened (`scripting` + `activeTab`), so there's no content script |
| Toolbar | `page_action` with 36 PNG variants (on/off × h2 × ipv6 × railgun) | `action` with orange/grey/white clouds at 32/64/128 px |
| Popup | IP, Ray ID, city/country (via `airports.js`), Trace link, Railgun, copy buttons, guide image | Cloudflare yes/no, HTTP version, IP version, IP, Ray ID, data center **code**, Trace link |
| Options | debug logging, hide guide (`localStorage`) | none (`debug` hard-coded to `true` on startup) |
| Detection | `Server` starts with `cloudflare` (case-insensitive) | `Server` is exactly `cloudflare` (case-insensitive) |
| Permissions | `tabs`, `clipboardWrite`, `webNavigation`, `webRequest`, http+https hosts | `webRequest`, `webNavigation`, `activeTab`, `storage`, `scripting`; hosts `https://*/*` (listed twice, no http) |
| Build / deps | webpack 3, jest, eslint, purecss, octicons | none |
| Removed | — | `airports.js`, Railgun, options page, copy buttons, IPv6/h2 icon variants |
