<p align="center">
  <img src="icons/icon128.png" alt="Cookie Token Retriever icon" width="128" height="128" />
</p>

<h1 align="center">Cookie Token Retriever</h1>

<p align="center">

**English** | [繁體中文](README.zh-TW.md)

</p>

A Chrome extension that lists the cookies of any site you visit and lets you copy a
specific cookie / token (e.g. a login `access_token` or `session`) in one click. Because it
uses the extension `chrome.cookies` API, it can read even **HttpOnly** cookies that
JavaScript cannot access.

The popup has two sections:

- **Top | Tracking list (watch list) — always visible**: based on the rules in the settings page
  (e.g. `example.com` → display name "Login token" for cookie `token`), it **fetches each cookie from
  its own domain and lists it** under your custom name. It is visible no matter which tab you are on,
  and each item can be copied in one click. Cookies that can't be found (e.g. not logged in) are marked "not found".
- **Bottom | All cookies of the current tab (collapsed by default)**: shown as a collapsible
  "All cookies (N)" row that expands on click (and automatically while searching). The star button
  on each row adds the cookie to your tracking rules (under the current tab's domain).

Other features:

- Thanks to the `chrome.cookies` API, even **HttpOnly** cookies that JavaScript can't read are available.
- **Automatic parent-domain fallback**: when fetching `app.example.com`, it walks up the domain
  (`example.com`) and also lists cookies registered on parent domains like `.example.com` that are
  actually sent to that site (marked "incl. parent domain"). Cookies belonging to sibling subdomains
  (such as ones scoped to `api.example.com`) are not mixed in.
- **Rule = domain → (display name + cookie name + login URL)**: each rule can give a cookie a
  memorable display name (e.g. name `token` as "Login token"; optional). You can also set a
  "login URL" — when the cookie can't be found, the tracking card shows "not found — you may need
  to log in" with a "Log in" button that opens that URL.
- **Rules grouped by domain**: a rule for `example.com` also applies to the subdomain
  `app.example.com`; a domain of `*` means all sites (used only as a marker in the bottom browse section).
- **Export / import rules**: the settings page can export rules as a JSON file for backup or sharing.
  Importing merges them into the editor (non-destructive; they only take effect after you click "Save").
- Search box at the top: filters both lists (matches name, value and domain).
- **Multi-language**: the UI defaults to English and can be switched to Chinese from the language
  dropdown at the top of the settings page (the choice is synced and applied to both the popup and the settings page).
- Dark mode support.

## Installation (load unpacked extension)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on "Developer mode" in the top-right corner.
3. Click "Load unpacked".
4. Select this folder (`cookie-token-retriver`).
5. A cookie icon appears in the toolbar; pinning it with 📌 is recommended.

## Usage

1. Click the extension icon in the toolbar.
2. The top "Tracking" section shows the cookies matched by your rules (visible from any tab),
   and the bottom section shows all cookies of the current tab's URL. Use "Copy" on a row to copy
   its value, and "Add rule" to start tracking it.
3. To track specific cookies permanently: click "Add rule" on a cookie in the bottom list (it is filed
   under the current tab's domain), or click ⚙ in the top-right to open the settings page, create a
   group with "+ Add domain", add cookie names under that domain, and save
   (domain `*` = all sites).

## File structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (Manifest V3) |
| `i18n.js` | UI translation dictionary and helpers (en / zh), shared by the popup and settings page |
| `popup.html` / `popup.css` / `popup.js` | The popup window opened from the toolbar icon |
| `options.html` / `options.js` | Settings page for tracking rules (grouped by domain) |
| `icons/` | Extension icons |
| `package.json` / `scripts/build.mjs` | `yarn package` build script, outputs to `releases/` |
| `releases/` | Packaged zip for each version |

## Permissions

- `cookies` + `host_permissions: <all_urls>`: read cookies of any domain (including HttpOnly);
  the tracking list relies on this to fetch cookies from each rule's domain without opening that tab.
- `tabs`: get the current tab's URL as the target of the bottom browse section.
- `storage`: store tracking rules (`storage.sync`, synced with your Chrome account).

All cookies read are only displayed in the local extension window and are never uploaded to any server.
