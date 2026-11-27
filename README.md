# Claire

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/fgbpcgddpmjmamlibbaobboigaijnmkl.svg?style=flat-square)](https://chromewebstore.google.com/detail/claire/fgbpcgddpmjmamlibbaobboigaijnmkl)
[![CI](https://github.com/ram-nadella/claire/actions/workflows/ci.yml/badge.svg)](https://github.com/ram-nadella/claire/actions/workflows/ci.yml)

Claire is a Chrome extension that shows whether the page you're on is served by [Cloudflare](https://www.cloudflare.com). Its toolbar icon turns orange on Cloudflare sites and grey on others. Click the icon to see:

- whether the site uses Cloudflare
- the HTTP version (`h2`, `h3`, `http/1.1`) and IP version (4 or 6)
- the server's IP address
- on Cloudflare sites: the Ray ID, the data center code (e.g. `SFO`) and a link to the site's `/cdn-cgi/trace`

Claire is an independent project. It isn't affiliated with or endorsed by Cloudflare.

## Install

Install Claire from the [Chrome Web Store](https://chromewebstore.google.com/detail/claire/fgbpcgddpmjmamlibbaobboigaijnmkl), then pin it: Chrome puts new extensions in the extensions menu (the puzzle-piece icon), and Claire's icon only shows in the toolbar once it's pinned.

To share Claire, use https://is.gd/claire, which points to the store listing.

### From source

Claire has no build step: the `src/` folder is the extension.

1. Clone this repository: `git clone https://github.com/ram-nadella/claire.git`
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `src/` folder.
4. Pin Claire from the extensions menu.

After editing files in `src/`, click the reload button on Claire's card in `chrome://extensions`.

## Development

The dev tooling (ESLint and Prettier) runs in a Docker dev container, so Docker is all you need installed:

```bash
docker compose run --rm dev npm run lint     # ESLint + Prettier check, as CI runs it
docker compose run --rm dev npm run format   # apply Prettier and ESLint fixes
```

[AGENTS.md](AGENTS.md) explains how the extension works, the repo layout and the conventions. [docs/modernization-plan.md](docs/modernization-plan.md) is the roadmap.

Pull requests are welcome. Keep each one to a single change, and make sure `npm run lint` passes.

## License

BSD 3-Clause. See [LICENSE](LICENSE).
