# Changelog

## 1.0.0 — 2026-10-15
- First release, built from the patterns repeated across cs-daily-client-requests.
- Requests: fetch / bulkFetch (all pages, ids, url lists) / post / put / del / bulkPost / uploadFile / entity helper, plus retries and CSRF.
- Site info cache shared through localStorage["site_info"] (never overwritten), app settings cache.
- Language detection, `t()`, and two-way `translate()` with observe mode.
- App-scoped storage `app_{appId}_{name}` with TTL.
- UI: loader (nested-safe), toast, progress bar, popup / confirm / alert.
- `appendtab_<page>` for classic and v2 tab layouts, with `registerTabPage`.
- `addDropdown` for single-line fields and dynamic dropdowns (plain / selectize / select2).
- `calculatePercent` with per-row (`baseScope`) and live mode.
- Number to words (ar/en and currencies), table swap / serials / export, number and date helpers, DOM wait helpers, menu item, field helpers.

## 1.0.1 — 2026-10-18
- Fixed: "Cannot read properties of undefined (reading 'currentScript')" when pasted in the console or loaded on pages that define `module`.
- Rewrote every source file to be readable: full variable names, named functions, docs and examples inside each function body.
- Added `DCDN.help()` / `DCDN.help("name")` to print docs in the console.
- `dist/daftra-cdn.js` (readable) is now the recommended file; the minified file is optional.

## 1.1.0 — 2026-10-18
- `fetch` / `get` / `post` / `put` / `patch` / `del` / `fetchAll` / `bulkPost` return the RESULT directly: rows array (with `rows.meta`), record object, auto-unwrapped api2 models. `full: true` returns the raw response.
- New shared options: `loader`, `successMessage`, `errorMessage`, `onSuccess`, `onError`, `onComplete`, `silent`, `fallback`; `fetch(url, { all: true })` fetches every page.
- Requests send `X-Requested-With: XMLHttpRequest` like jQuery.
- Breaking: code that read `res.data` / `res.total` from `DCDN.fetch` should use the result directly / `res.meta.total`, or pass `full: true`.

## 1.1.1 — 2026-10-18
- A newer CDN version now replaces an older one already loaded on the page (before, the first copy loaded always won).
- `/dist/*` cache lowered to 5 minutes (versioned folders stay cached forever).

## 1.1.2 — 2026-10-18
- Console output is JSON only: debug logs / warnings are single `[DCDN] {"event":...}` lines, no `%c` styles, DOM elements shown as text ("<input#id.class>").
- `DCDN.help()` prints and returns JSON (no console.table).
- Fixed `_headers` rule rejected by Wrangler ("Only one wildcard is allowed per rule").

## 1.2.0 — 2026-10-18  (breaking)
- Every public `DCDN.xxx()` returns JSON:
  `{ success: true }`, `{ success: true, data }`, `{ success: true, data, meta }` (lists) or `{ success: false, error: { name, message, status, data } }`.
- Async functions resolve that JSON and never reject; sync functions return it directly.
- Elements are never inside the JSON: element results give `data: "<input#id.class>"` plus `res.element`; controllers keep their methods with element properties hidden.
- Plain values / old behaviour: `DCDN.raw.xxx()`.
- Envelopes can be passed back into DCDN options (e.g. `title: DCDN.t("أ", "A")`).

## 1.3.0 — 2026-10-22
- Added the reusable parts of the apps' "Language Pack" page codes:
  - Daftra-native UI: `nativeLoader`, `initPage`, `nativeAlert` (was showToastifyAlert), `flashToast`, `noticeAfterReload` / `showPendingNotice`,
    `showFieldError` / `clearFieldError` / `clearAllFieldErrors` / `getFieldColumn` / `bindSaveValidation`,
    `prependBreadcrumb`, `setBreadcrumbs`, `stepsHeader`, `addListButton`, `hideEarly`, `hideElements`, `hideFormField`, `replaceAddButton`, `addSidebarLink`.
  - Money: `formatCurrency` (was formatCurrencyHtml) + `currencyFormats` (150+ currencies).
  - Entities: `unwrapEntity`, `getWorkflowType`, `getEntityKeyId`, `getFirstRecord`, `updateRecord`, `subformKey`, `upsertSubformRows`, `parseMultiValue`.
  - Page / time: `getPageContext`, `nowInTimeZone`, `ageOnDate`, `cached`, `setReturnUrl` / `handleReturnRedirect`.
  - Translation engine: `languagePack` (phrases, {slot} sentences, whole words, dropdowns, iframes, observer) + `translateLanguagePack`.
- `DCDN.fetch` unwraps the `{ payload: { data } }` record shape; `getPageInfo` understands `/entity/workflow/` and `/future-entity/workflow/` urls.
- Every function's docs now list parameters and option fields with data types (`@param {type}`, `@returns {type}`); aliases share the original's docs.
- `exposeGlobals()` also defines the Language Pack names: showToastifyAlert, isRtlLanguage, formatCurrencyHtml, unwrapSingleEntityResponse, fetchWorkflowTypeByName, getWorkflowTypeRecordId, translateLanguagePack.

## 1.4.0 — 2026-10-22
- `translate(words, options)` rewritten:
  - Takes an array of `{ ar, en }` objects (`[ar, en]` pairs still work) and replaces every match in the DOM with the other language, based on the page language (Arabic page → English becomes Arabic, English page → Arabic becomes English).
  - Observer is on by default: added nodes, changed text and changed placeholder/title/aria-label are translated again (debounced). Typed input values are never touched.
  - New options: `ignoreCase` (default true), `wholeWords`, `skipSelector`, `debounce`.
  - Returns a controller `{ replacements, lang, translate(root), addWords(list), stop() }`. A new translator on the same root in the other direction stops the old one.

## 1.4.1 — 2026-10-22
- `translate`: every text node is checked with ONE combined regex (longest word first, no ping-pong).
- Tolerant Arabic matching: ا/أ/إ/آ/ٱ, ي/ى/ئ, ه/ة, و/ؤ, tashkeel and tatweel are ignored; any spaces / &nbsp; / new lines match.
- `lang: "swap"` replaces both ways (Arabic → English and English → Arabic) whatever the page language.
- The result has `words` (rules count) and, when nothing matched, a `hint` explaining why.

## 1.4.2 — 2026-10-22
- `translate` now replaces BOTH ways by default (`lang: "swap"`): any text with the Arabic word gets the English and vice versa. `lang: "page"` keeps the old page-language behaviour.
- The observer remembers what it wrote, so re-scans never flip its own output back.

## 1.5.0 — 2026-10-22
- `translate` gets `mode`:
  - `"translate"` (default): detects the page language and puts every matched word in it; calling it twice is safe.
  - `"swap"`: ignores the language, Arabic ↔ English; calling it twice swaps back.
- `lang` now only forces the target in translate mode (`lang: "swap"` still works as `mode: "swap"`).
- Observers of several translate() calls share what they wrote, so two calls never ping-pong.
