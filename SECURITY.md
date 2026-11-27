# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a pull request or anywhere public. On GitHub, open this repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/ram-nadella/claire/security/advisories/new)). The report and the conversation about it stay private until a fix is out.

Include what you found, the steps to reproduce it, and the Claire version you're running (it's on Claire's card in `chrome://extensions`).

## What's in scope

Problems in the extension itself, for example:

- a web page being able to run script in Claire's popup or service worker, or change what the popup shows
- Claire exposing browsing data (URLs, IPs, headers) to a page or another extension
- permissions broader than what the extension needs

Problems in the websites Claire reports on, or in Cloudflare's services, aren't in scope here.

## Supported versions

Only the latest version on the [Chrome Web Store](https://chromewebstore.google.com/detail/claire/fgbpcgddpmjmamlibbaobboigaijnmkl) gets fixes.
