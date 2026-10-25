# Daftra CDN

Reusable functions and UI components for Daftra page codes. They were extracted from the patterns that repeat across `cs-daily-client-requests`: `fetchWithRetry`, `toggleLoadingSpinner`, `getSiteInfo`, `addNewTab`, `addNewItemInSubMenu`, `swap`, `addserials`, `removeCurr`, `convertFN`, `exportTableToExcel`, selectize/`new Option` dropdowns, percentage inputs, and others.

The library is one file with no dependencies. It works with or without jQuery, and it detects selectize and select2 when they're on the page.

```html
<script src="https://YOUR-CDN/dist/daftra-cdn.js"></script>
<script>
  DCDN.onReady(async () => {
    const site = await DCDN.getSite();          // cached in localStorage["site_info"]
    DCDN.toast(DCDN.t("تم التحميل", "Loaded"));
  });
</script>
```

Global name: `window.DCDN` (alias `window.DaftraCDN`). If several apps include the script on the same page, it only loads once.

## Every function returns JSON

```js
DCDN.parseNumber("1,250.50")          // { "success": true, "data": 1250.5 }
DCDN.storage.remove(397, "x")         // { "success": true }
await DCDN.fetch("/v2/api/entity/client/list/1")
// { "success": true, "data": [ {...}, {...} ], "meta": { "total": 40, "pages": 8, "page": 1 } }
await DCDN.fetch("/v2/api/entity/nope/list/1")
// { "success": false, "error": { "name": "DaftraError", "message": "...", "status": 404, "data": {...} } }
```

| Result | JSON |
|---|---|
| Nothing to return | `{ success: true }` |
| A value | `{ success: true, data }` |
| A list | `{ success: true, data: [rows], meta: { total, pages, page } }` |
| An error | `{ success: false, error: { name, message, status, data } }` (handled with `silent`/`onError`: also `data: fallback`) |
| An element | `{ success: true, data: "<input#id.class>" }` and the real node in `res.element` (`res.elements` for lists) |
| A UI controller (tab, popup, bar, dropdown…) | `data` is the controller; its methods work, its element properties are hidden from JSON |

- Async functions return a Promise of the JSON and **never reject**, so you don't need try/catch. Check `res.success` instead.
- Callbacks you pass in (`onSuccess`, `onSelect`, `content`, `onOpen`…) receive plain values.
- You can pass a JSON result back into DCDN, for example `title: DCDN.t("أ", "A")`.
- **Plain values / old behaviour:** `DCDN.raw.xxx()`, for example `if (DCDN.raw.isRTL()) ...`.

> ⚠️ Because every result is an object, `if (DCDN.isRTL())` is always true. Use `DCDN.isRTL().data` or `DCDN.raw.isRTL()`.

## Docs in the console

Every function has its docs and examples written inside it, so you can learn it straight from the browser:

```js
DCDN.help()                 // JSON: { functions: [{ function, description }] }
DCDN.help("addDropdown")    // JSON: { function, docs: [lines] }
DCDN.addDropdown            // prints the function: docs on top, readable code below
```

In DevTools you can also right-click the printed function and choose **Show function definition** to jump to its code in the Sources panel.

---

## Files

| Path | Purpose |
|---|---|
| `dist/daftra-cdn.js` | **The file you link.** Readable, with docs and examples inside every function. |
| `dist/daftra-cdn.min.js` | Optional minified copy (~53 KB). Comments are removed, so `DCDN.help()` can't show docs with it. |
| `dist/daftra-cdn.min.js.map` | Source map for the minified copy. |
| `dist/v1.3.0/` | Pinned version copy. Old pages keep working after you release v2. |
| `src/*.js` | Source modules. Edit these files, then run `npm run build`. |
| `test/test.js` | jsdom tests (`npm test`). |
| `examples/demo.html` | Playground that uses a mocked API. Open it in a browser. |
| `index.html` | Landing page for the hosted CDN. |
| `netlify.toml`, `_headers`, `vercel.json` | CORS and cache headers for static hosting. |

```bash
npm install      # once (terser + jsdom)
npm run build    # src -> dist
npm test         # build + run the tests on both files
```

---

## Deploy as a CDN

Pick one option.

**A. GitHub + jsDelivr (free, fastest to set up)**
1. Push this folder to a **public** GitHub repo, for example `izam/daftra-cdn`. jsDelivr does not serve Bitbucket repos.
2. Tag a release: `git tag v1.0.0 && git push --tags`
3. Use it from your page code:
   `https://cdn.jsdelivr.net/gh/izam/daftra-cdn@1.0.0/dist/daftra-cdn.js`
   (Use `@latest` for the newest version. After a push, purge the cache with `https://purge.jsdelivr.net/gh/izam/daftra-cdn@latest/dist/daftra-cdn.js`.)

**B. npm + jsDelivr/unpkg**
`npm publish --access public` (rename the package to `@izam/daftra-cdn` if the name is taken), then use
`https://cdn.jsdelivr.net/npm/@izam/daftra-cdn@1/dist/daftra-cdn.js`

**C. Netlify / Cloudflare Pages / Vercel**
Deploy the folder as a static site. The build command is `npm run build` and the publish directory is `.`. CORS and cache headers are already configured.
`https://your-site.netlify.app/dist/daftra-cdn.js`

**Add it to Daftra:** go to `/owner/settings/index2`, then **Add**. Use key `code_*` (all pages) or a page key, and plugin `0`:
```html
<script src="https://cdn.jsdelivr.net/gh/izam/daftra-cdn@1.0.0/dist/daftra-cdn.js"
        data-site-info="true" data-body-classes="true"></script>
```
Script tag options: `data-debug="true"`, `data-lang="en"`, `data-primary-color="#0d6efd"`, `data-site-info="true"` (prefetch site info), `data-body-classes="true"` (adds `custom_app en_app|ar_app SA SAR` to `<body>`, the same as the old apps).

For **POS** (`pos_global_js`, raw JS only), load the file dynamically:
```js
var s = document.createElement("script"); s.src = "https://.../dist/daftra-cdn.js"; document.head.appendChild(s);
```

---

## Config

```js
DCDN.configure({
  retries: 3, retryDelay: 600,   // retry on network / 5xx / 429 (exponential)
  perPage: 100, concurrency: 4,  // bulk defaults
  lang: null,                    // force "ar" | "en"
  apiKey: null, baseUrl: "",     // only when calling Daftra from OUTSIDE Daftra
  primaryColor: "#1877f2", zIndex: 1000000, debug: false,
});
```

---

## API

### Requests
Every request retries automatically and throws a `DaftraError` (`err.status`, `err.data`) on HTTP errors or on `result: "failed"`. The CSRF token and `X-Requested-With` header are added automatically.

**Results come back ready to use.** You don't dig into `res.data`:

| You call | You get |
|---|---|
| a list URL | the rows array. `rows.meta` has `{ total, pages, page, response }` |
| a record URL | the record object |
| api2 (`{ Invoice: {...} }`) | auto-unwrapped when a row has one model key; or pass `unwrap: "Invoice"` |
| `full: true` | the raw response |
| `all: true` on `fetch` | every page (same as `fetchAll`) |

Options shared by `fetch`, `get`, `post`, `put`, `patch`, `del`, `fetchAll` and `bulkPost`:

| Option | What it does |
|---|---|
| `loader: true \| "text"` | Full-screen loader while the request runs |
| `successMessage: "text"` | Success toast |
| `errorMessage: true \| "text"` | Error toast |
| `onSuccess(result)`, `onError(err)`, `onComplete()` | Callback style, no `await` needed. With `onError`, the call resolves `fallback` instead of throwing |
| `silent: true`, `fallback: []` | Never throws; resolves `fallback` (default `null`) on error |

```js
const clients = await DCDN.fetch("/v2/api/entity/client/list/1", { filters: { category: "VIP" } });
clients.length; clients.meta.total;

const invoice = await DCDN.fetch("/v2/api/entity/invoice/" + DCDN.getRecordId() + "/1");
invoice.no;

DCDN.post("/v2/api/entity/le_notes", { note: "hi" }, {
  loader: true, successMessage: "تم الحفظ", errorMessage: true,
  onSuccess: (record) => console.log(record.id),
});
```

```js
// fetch one endpoint — filters / sort / page / perPage are serialized for you
const res = await DCDN.fetch("/v2/api/entity/invoice/list/1", {
  filters: { client_id: 5, "invoice.type": 12, branch_id: { in: [1, 2] }, name: { like: "abc" }, x: { is_null: null } },
  sort: { id: "desc" }, perPage: 50, page: 1,
});
// -> /v2/api/entity/invoice/list/1?filter[client_id]=5&filter[invoice.type]=12&filter[branch_id][in][]=1&...&per_page=50

// bulk fetch: ALL pages (v2 `last_page` and api2 `pagination.page_count` both supported)
const products = await DCDN.bulkFetch("/v2/api/entity/product/list/1", {
  filters: { "category.name": "extras" }, perPage: 100, concurrency: 4, maxPages: 50,
  progress: true,                               // shows a progress bar
  onProgress: (done, total) => {},
});
const invoices = await DCDN.bulkFetch("/api2/invoices", { unwrap: "Invoice" }); // api2 rows -> row.Invoice

// bulk fetch: many records by id, or many urls
const recs = await DCDN.bulkFetch("/v2/api/entity/invoice/{id}/1", { ids: [10, 11, 12] });
const many = await DCDN.bulkFetch(["/api2/site_info", "/v2/api/entity/staff/1/1"]);

// write
await DCDN.post("/v2/api/entity/le_invoice-items", { invoice_id: 5, item_status: "Not Assigned" });
await DCDN.put("/v2/api/entity/app_367_package/3", { name: "x" });
await DCDN.del("/v2/api/entity/le_x/3");

// bulk post: concurrency-limited, never stops on one failure (unless stopOnError)
const { success, failed, results } = await DCDN.bulkPost("/v2/api/entity/le_invoice-items", items, {
  concurrency: 3, delay: 100, progress: "جاري ترحيل البنود", transform: (item) => ({ ...item }),
});
await DCDN.bulkPost((row) => `/v2/api/entity/invoice_item/${row.id}/fields`, rows, { transform: (r) => ({ status: 1 }) });

// v2 entity shortcut
const E = DCDN.entity("le_invoice-items");
await E.get(5); await E.list({ filters: { invoice_id: 9 } }); await E.all(); await E.create({...});
await E.update(5, {...}); await E.updateFields(5, {...}); await E.remove(5);

// file upload
await DCDN.uploadFile("le_client_m", "le_client_m.file", blob, "photo.png");

DCDN.buildQuery({ filter: { a: 1 } });  // -> "filter[a]=1"
```

### Site info, app settings, user
```js
const info = await DCDN.getSiteInfo();     // { Site: {...} }
const site = await DCDN.getSite();         // info.Site
DCDN.getSiteInfoSync();                    // cached value or null (no request)
DCDN.clearSiteInfo();                      // runs automatically when /settings is saved
await DCDN.getAppSettings("le_pos_general_Settings", { appId: 82, ttl: 3600 }); // cached in app_82_settings
DCDN.getUser(); DCDN.isOwner();            // window.USER
DCDN.getPageInfo();  // { isV2, entity|controller, action, id }
DCDN.getRecordId();  // id from the current url
```
`getSiteInfo` first checks `localStorage["site_info"]`. If another app already stored it, no request is made. Otherwise it fetches the site info and stores it, but only if the key is still empty, so an existing value is never overwritten. Parallel calls share one request.

### Language & translation
```js
DCDN.detectLang();       // "ar" | "en"  (body.en_app/ar_app -> dir -> computed direction -> html[lang] -> site_info)
DCDN.isRTL(); DCDN.isEn();
DCDN.t("حفظ", "Save");   // or DCDN.t({ ar: "حفظ", en: "Save" })

// Pass { ar, en } pairs. Two modes:
//   mode "translate" (default): detect the page language and put every matched word in it
//       (Arabic page: "settings" -> "الاعدادات"). Calling it twice changes nothing more.
//   mode "swap": ignore the language, Arabic -> English and English -> Arabic. Calling it twice swaps back.
// It keeps watching the DOM (MutationObserver): popups, ajax rows, re-rendered text
// and new placeholders/titles are translated automatically.
const tr = DCDN.translate([
  { ar: "الاعدادات", en: "Settings" },
  { ar: "العميل", en: "Client" },
  ["الخدمات", "Services"],          // [ar, en] still works
], {
  root: "body",        // where to translate + observe
  observe: true,       // default true; false = translate once
  ignoreCase: true,    // "settings" / "SETTINGS" also match
  wholeWords: false,   // true = don't match inside longer words
  exact: false,        // true = whole text must equal the word
  debounce: 80,        // ms to wait before translating new DOM
  mode: "translate",   // "translate" (default) | "swap"
  lang: undefined,     // mode "translate" only: force "ar" | "en" (default page language)
});
// Arabic matching is tolerant: "الاعدادات" also matches "الإعدادات" (ا/أ/إ/آ, ى/ي, ة/ه, tashkeel, &nbsp;).
// If nothing changed, tr.data.hint explains why (e.g. the page is Arabic so only English texts are replaced).
tr.data.addWords([{ ar: "حفظ", en: "Save" }]); // add more words, re-translates now
tr.data.translate("#modal");                     // translate a part manually
tr.data.stop();                                  // stop watching

DCDN.translateText("سجل الطلبات", [["سجل الطلبات", "Services Log"]]);
```

### Storage (app-scoped)
```js
DCDN.setLocalStorage(397, "workflow", 12);              // key: app_397_workflow
DCDN.setLocalStorage(397, "cache", data, { ttl: 600 }); // expires in 600 s
DCDN.getLocalStorage(397, "workflow");                  // -> 12
DCDN.storage.remove(397, "workflow"); DCDN.storage.clear(397);
```

### Loader, toast, progress bar, popup
```js
DCDN.showLoader("جاري الحفظ..."); DCDN.hideLoader();    // nested-safe counter; hideLoader(true) forces it closed
await DCDN.withLoader(() => DCDN.post(url, body), { ar: "جاري الحفظ", en: "Saving" });
DCDN.toggleLoadingSpinner(true | false);                 // old name

DCDN.toast("تم الحفظ");                                  // success
DCDN.toast("حدث خطأ", "error", { title: "خطأ", timeout: 6000, position: "top-center" });
DCDN.toast.warning({ ar: "تنبيه", en: "Warning" });

const bar = DCDN.progressBar({ title: "ترحيل", total: items.length /*, target: "#box" for inline */ });
bar.update(5); bar.increment(); bar.setText("..."); bar.done("تم"); bar.error("فشل"); bar.remove();

const p = DCDN.showPopup("<div id='x'>...</div>", {
  title: { ar: "تفاصيل", en: "Details" }, width: 700,
  buttons: [{ text: "حفظ", class: "primary", onClick: (p) => { /*...*/ p.close(); } }, { text: "إلغاء" }],
  onOpen: (p) => {}, onClose: () => {}, closeOnBackdrop: true,
});
p.body; p.setContent(html); p.close(); DCDN.closePopup();
if (await DCDN.confirm("متأكد؟", { danger: true })) { /* ... */ }
await DCDN.alert("تم");
```

### Tabs — `appendtab_<page>`
The function works on both Daftra tab layouts: classic `/owner/.../view` (Bootstrap 3 `ul.nav-tabs` plus the mobile accordion) and v2 `/v2/owner/entity/.../show` (`#item-nav-tabs-responsive`). The layout is detected automatically.

```js
const invoiceId = DCDN.getRecordId();
DCDN.appendtab_invoice({
  id: "invoice_items",
  title: { ar: "سجل الطلبات", en: "Services Log" },
  url: `/v2/owner/entity/le_invoice-items/list?filter[invoice_id]=${invoiceId}`, // loads `.list-table` from that page
});

DCDN.appendtab_entity({
  id: "payments-log", title: "المدفوعات", badge: 3,
  content: async (pane, tab) => {                 // html | Element | fn returning html/Promise
    const rows = await DCDN.bulkFetch("/v2/api/entity/le_x/list/1", { filters: { ref: invoiceId } });
    return `<ul>${rows.map((r) => `<li>${r.id}</li>`).join("")}</ul>`;
  },
  lazy: true, reload: false, active: false, position: 2,
  onOpen: (pane, tab) => {},
}).then((tab) => tab.setBadge(5));
```
Built-in pages: `invoice, estimate, sales_order, credit_note, refund, client, supplier, product, purchase_invoice, purchase_order, payment, expense, work_order, workflow, booking, requisition, staff, journal, entity`.
To add a new page name, call `DCDN.registerTabPage("my_page")`, which creates `DCDN.appendtab_my_page(...)`. You can also use `DCDN.appendTab("anything", opts)` directly.

### Dropdown — `addDropdown`
```js
// A) Replace a single-line text field. The chosen value (or text) is written into the hidden input.
DCDN.addDropdown('[id$="--single_line_field"]', {
  options: ["A", "B", { value: 3, text: "Three" }],   // or async () => [...]
  saveAs: "text",                                     // "value" (default) | "text"
  placeholder: { ar: "-- اختر --", en: "-- Select --" },
  searchable: true,                                   // uses select2 if loaded
  onSelect: (opt, ctrl) => console.log(opt.data),
  live: true,                                         // also new subform rows
});

// B) Replace a dynamic dropdown (plain / selectize / select2). The chosen option is APPENDED to the original select and selected.
const dd = await DCDN.addDropdown("#data-le_custom_data_client--city", {
  source: { url: "/v2/api/entity/le_cities/list/1", filters: { active: 1 }, valueKey: "id", textKey: "city" },
});
dd.setValue("9"); dd.setOptions([...]); dd.getSelected(); dd.destroy();
```

### Percent — `calculatePercent`
This adds a `%` input before the target and shrinks the target to 70% of its width. Typing a percent sets `target = base × % / 100`. Typing in the target updates the percent.
```js
DCDN.calculatePercent('[id$="--discountvalue"]', { base: "#subtotal" });             // base: input or text element
DCDN.calculatePercent(".value-input", { base: ".row-total", baseScope: "tr", live: true }); // per row
DCDN.calculatePercent("#amount", { base: () => DCDN.parseNumber($("#total").text()), decimals: 3, max: 100,
  onChange: ({ percent, value, base }) => {} });
```

### DOM, fields, menu
```js
await DCDN.waitForElement("#InvoiceForm", { timeout: 10000 });
await DCDN.waitFor(() => document.body.classList.contains("custom_app"));
DCDN.onElement(".item-row", (row) => {/* runs for existing + future rows */});
DCDN.onReady(fn);
DCDN.field("qty");                 // [id$="--qty"]
DCDN.getFieldValue("qty"); DCDN.setFieldValue("city", 9, "Riyadh"); // selectize/select2 aware
DCDN.triggerEnter("#barcode");     // simulates Enter (serial / barcode lookups)
DCDN.addMenuItem({ parent: ".mn_inventory", sidebarId: 36, url: "/v2/owner/entity/le_packages/list", title: { ar: "الباقات", en: "Packages" }, after: 0 });
DCDN.loadScript(src); DCDN.loadStyle(href); DCDN.injectCSS(css, "my-id"); DCDN.copyToClipboard(text);
DCDN.getCsrfToken(); DCDN.getUrlParam("id");
```

### Numbers, dates, words, tables
```js
DCDN.parseNumber("1,250.50 ر.س");     // 1250.5 (Arabic digits too)
DCDN.formatNumber(1250.5, 2);          // "1,250.50"
DCDN.round(1.005, 2);
DCDN.formatDate(new Date(), "YYYY-MM-DD HH:mm"); DCDN.today(); DCDN.addDays(d, 7, "YYYY-MM-DD");
DCDN.numberToWords(1250.5, { currency: "SAR" });  // فقط ألف ومائتان وخمسون ريالاً وخمسون هللة لا غير
DCDN.numberToWords(1250.5, { lang: "en", currency: "SAR" }); // Only One Thousand Two Hundred Fifty Riyals and Fifty Halalas
// currencies: SAR EGP AED KWD BHD OMR QAR JOD IQD USD (or pass a custom object)
DCDN.swap(3, 6, "listing_table");   // standard column swap (content + id + class)
DCDN.table.addSerials("#listing_table", { header: { ar: "م", en: "#" } });
DCDN.table.hideColumn("#listing_table", 4);
DCDN.formatCells(".removeCurr", { decimals: 2, suffix: " ر.س" });
DCDN.exportTableToExcel("#report", "report"); DCDN.exportCSV(rows, "data"); DCDN.table.toJSON("#t");
DCDN.sleep(ms); DCDN.debounce(fn, 300); DCDN.throttle(fn, 300); DCDN.chunk(arr, 50); DCDN.escapeHtml(s); DCDN.uid();
```

### From the Language Packs (Daftra-native UI, money, entities, translation)
```js
DCDN.nativeAlert({ ar: "تم الحفظ", en: "Saved" }, "success");          // Daftra's own $.toast / classic banner / v2 banner
DCDN.flashToast("Could not save", "error");                            // floating Daftra-style banner
DCDN.nativeLoader(true, "Loading...");  DCDN.nativeLoader(false);      // Daftra's .page-loader
await DCDN.initPage(async () => { /* set-up */ });                     // native loader around page set-up
DCDN.noticeAfterReload("Updated"); location.reload();                  // shown on the next page load

DCDN.showFieldError("qty", { ar: "أدخل الكمية", en: "Enter the quantity" });
DCDN.bindSaveValidation("form", () => DCDN.raw.getFieldValue("qty") ? [] : [{ field: "qty", message: "Required" }]);

DCDN.prependBreadcrumb({ label: "Workflow Settings", url: "/v2/owner/workflow/settings" });
DCDN.setBreadcrumbs({ first: { label: "Settings", url: "/x" }, hideMiddle: true, active: "Permissions", title: true });
DCDN.stepsHeader([{ number: 1, title: "Connect" }, { number: 2, title: "Accounts" }], 2, { target: ".main-area > .container" });
DCDN.addListButton({ id: "refresh", label: "Refresh", icon: "mdi-refresh", onClick: () => location.reload() });
DCDN.replaceAddButton({ href: "/v2/owner/entity/app_609_add_delivery/create", label: "Add Delivery Orders" });
await DCDN.addSidebarLink({ id: "ntmp", label: "NTMP", url: "/v2/owner/entity/app_924_ntmp_dashboard/list" });

DCDN.formatCurrency(1250.5, "EGP");                                    // "1,250.50 ج.م" (150+ currencies)
await DCDN.getWorkflowType("Customer Deliveries");                     // cached workflow_type record
await DCDN.updateRecord("app_x", 12, { status: "Done" }, { parentLink: { field: "reference_id", value: 5 } });
await DCDN.upsertSubformRows("app_x", 5, "rows", [{ id: 2, qty: 3 }, { qty: 1 }]);   // keeps rows you don't mention
DCDN.getPageContext();  DCDN.nowInTimeZone("Asia/Riyadh");  DCDN.ageOnDate("2015-06-01");

const pack = DCDN.languagePack({
  phrases: [{ en: "Driver", ar: "سائق" }],
  sentences: [{ en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }],
  wholeWords: true,
}).data;
pack.translate("#myModal");
```
Every parameter and option, with its data type: `DCDN.help("languagePack")`, or see `Tests/ApiTest.js` section 15.

### Migrating old page codes
`DCDN.exposeGlobals()` defines `toggleLoadingSpinner`, `getSiteInfo`, `addThousandSeparator`, `exportTableToExcel`, `swap`, `showPopup`, and `closePopup` on `window`, but only for names that aren't already defined. Old snippets can then run unchanged.

> **PDF/print templates:** Daftra's PDF engine does not run external scripts. Keep template JS (`swap`, `convertFN`, …) inline in the template. Use the CDN for on-screen page codes.

---

## Releasing a new version
1. Edit `src/`, then bump `version` in `package.json` and add a line to `CHANGELOG.md`.
2. `npm test`
3. Commit, tag `vX.Y.Z`, and push (or `npm publish`). Pages pinned to an old version keep working.
