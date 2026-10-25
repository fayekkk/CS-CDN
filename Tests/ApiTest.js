/* =============================================================================
 * DCDN — every method with EVERY option (v1.2.0)
 * -----------------------------------------------------------------------------
 * Paste into the Chrome Console on a Daftra page where the CDN is loaded,
 * or run one block at a time. Every call returns JSON:
 *   { success: true, data, meta? }   or   { success: false, error }
 *
 * WRITE calls (post / put / patch / del / bulkPost / uploadFile / entity create...)
 * only run when WRITE_ENTITY is set to a SAFE test entity.
 * ===========================================================================*/

// v2 entity you can safely create / edit / delete in (e.g. "le_dcdn_test"); null = skip writes
var WRITE_ENTITY = null;
// a record body that is valid for WRITE_ENTITY (include its required fields)
var WRITE_BODY = { name: "DCDN test" };

/* =============================================================================
 * 1) CONFIG + DOCS
 * ===========================================================================*/

DCDN.version;

DCDN.configure({
  // API key — only needed when calling Daftra from OUTSIDE a Daftra page
  apiKey: null,
  // base url prepended to relative urls — only outside Daftra, e.g. "https://mysite.daftra.com"
  baseUrl: "",
  // how many times a failed request is retried (network errors, 5xx, 429)
  retries: 3,
  // ms before the first retry, doubled each time (600, 1200, 2400…)
  retryDelay: 600,
  // default page size used by fetchAll
  perPage: 100,
  // how many requests fetchAll / bulkPost run at the same time
  concurrency: 4,
  // force the UI language "ar" | "en" — null = detect from the page
  lang: null,
  // localStorage key shared with the old apps for site info
  siteInfoKey: "site_info",
  // clear the cached site info automatically when the settings page is saved
  autoResetSiteInfo: true,
  // z-index of loader / popup / toast
  zIndex: 1000000,
  // color of progress bars and primary buttons
  primaryColor: "#1877f2",
  // true = log every request in the console as JSON lines
  debug: true,
});

// function name (optional) — no name = list of every function, a name = its docs
DCDN.help();
DCDN.help("fetch");
DCDN.help("storage.set");

/* =============================================================================
 * 2) NUMBERS, DATES, TEXT
 * ===========================================================================*/

// value: number or any displayed text ("1,250.50 ر.س", "SR 99", "١٢٣", "(50)")
DCDN.parseNumber("1,250.50 ر.س");

DCDN.formatNumber(
  // value: number or text
  1234567.891,
  // decimals: fixed decimals (omit to keep as is)
  2,
  {
    // separator: thousands separator
    separator: ",",
    // decimalPoint: decimal mark
    decimalPoint: ".",
    // prefix: text before the number
    prefix: "",
    // suffix: text after the number
    suffix: " ر.س",
  },
);

// number, decimals (default 2)
DCDN.round(1.005, 2);

// text with Arabic-Indic / Persian digits
DCDN.toEnDigits("١٢٣٫٥");

DCDN.formatDate(
  // date: Date | timestamp | "2026-01-05" (default now)
  new Date(),
  // format tokens: YYYY MM DD HH mm ss (default "YYYY-MM-DD")
  "DD/MM/YYYY HH:mm:ss",
);

// format (default "YYYY-MM-DD")
DCDN.today("DD/MM/YYYY");

DCDN.addDays(
  // start date
  new Date(),
  // days to add (negative = subtract)
  7,
  // format: omit to get a Date object, give it to get text
  "YYYY-MM-DD",
);

// prefix of the random id
DCDN.uid("test");

// text to escape before putting it in HTML
DCDN.escapeHtml('<b class="x">hi & bye</b>');

// array, group size
DCDN.chunk([1, 2, 3, 4, 5], 2);

DCDN.numberToWords(
  // amount: number or text
  1250.5,
  {
    // lang: "ar" | "en" (default page language)
    lang: "ar",
    // currency: SAR EGP AED KWD BHD OMR QAR JOD IQD USD, or your own object
    currency: "SAR",
    // prefix: default "فقط " / "Only ", false = none
    prefix: "فقط ",
    // suffix: default " لا غير" / "", false = none
    suffix: " لا غير",
  },
);
DCDN.numberToWords(1250.5, {
  lang: "en",
  currency: "USD",
  prefix: false,
  suffix: false,
});

// whole number -> words (no currency)
DCDN.numberToArabicWords(2021);
DCDN.numberToEnglishWords(2021);

// currencies list (plain object, not a function)
DCDN.currencies;

/* =============================================================================
 * 3) URL + PAGE + USER
 * ===========================================================================*/

// url (default current page): last number in the path
DCDN.getRecordId();
DCDN.getRecordId("/v2/owner/entity/le_projects/15/show");

// url (default current page): { isV2, entity | controller, action, id }
DCDN.getPageInfo();
DCDN.getPageInfo("/owner/invoices/view/123");

DCDN.getUrlParam(
  // name of the query parameter
  "client_id",
  // url (default current page)
  "https://x.daftra.com/owner/invoices/index?client_id=5",
);

DCDN.getUser();
DCDN.isOwner();
DCDN.getCsrfToken();

DCDN.buildQuery({
  // any nested object -> bracket query string
  filter: {
    // equals
    client_id: 5,
    // operator objects: like, in, not_equal, gte, lte, is_null...
    name: { like: "abc" },
    branch_id: { in: [1, 2] },
    follow_up_status: { is_null: null },
  },
  per_page: 10,
});

DCDN.buildUrl("/v2/api/entity/client/list/1", {
  // params: extra raw query parameters
  params: { mode: "full" },
  // filters: -> filter[...]
  filters: { id: { in: [1, 2, 3] } },
  // sort: -> sort[...]
  sort: { id: "desc" },
  // page: page number
  page: 2,
  // perPage: -> per_page (v2) or limit (api2)
  perPage: 10,
});

/* =============================================================================
 * 4) LANGUAGE + TRANSLATION
 * ===========================================================================*/

DCDN.detectLang();
DCDN.isRTL();
DCDN.isEn();

// arabicText, englishText  (or one { ar, en } object)
DCDN.t("حفظ", "Save");
DCDN.t({ ar: "حفظ", en: "Save" });

DCDN.translateText(
  // text to translate
  "سجل الطلبات",
  // words: [[ar, en]] or [{ ar, en }]
  [["سجل الطلبات", "Services Log"]],
  // lang: target language (default page language)
  "en",
);

// returns { success, data: { replacements, lang, translate(), addWords(), stop() } }
const translator = DCDN.translate(
  // words: [{ ar, en }] (or [ar, en] pairs)
  [{ ar: "الاعدادات", en: "Settings" }, { ar: "العميل", en: "Client" }, ["الخدمات", "Services"]],
  {
    // root: where to translate + observe (selector / element, default <body>)
    root: "body",
    // observe: true (default) = keep translating new / changed DOM
    observe: true,
    // ignoreCase: true (default) = "settings" also matches "Settings"
    ignoreCase: true,
    // wholeWords: true = don't replace inside longer words
    wholeWords: false,
    // exact: true = only replace when the whole text equals the word
    exact: false,
    // attributes: attributes to translate too
    attributes: ["placeholder", "title", "aria-label", "data-original-title", "data-float-label"],
    // skipSelector: elements never translated
    skipSelector: "script, style, noscript, textarea, code, pre, .dcdn-no-translate",
    // debounce: ms to wait before translating DOM changes
    debounce: 80,
    // mode: "translate" (default) = put matches in the page language | "swap" = Arabic <-> English, ignore language
    mode: "translate",
    // lang: mode "translate" only, force the target "ar" | "en" (default page language)
    lang: undefined,
  },
);
// if translator.data.replacements is 0, translator.data.hint says why
// addWords: add more pairs and translate again
translator.data.addWords([{ ar: "حفظ", en: "Save" }]);
// translate: run again on a part of the page
translator.data.translate("body");
// stop: stop the observer
translator.data.stop();

/* =============================================================================
 * 5) SITE INFO + APP SETTINGS
 * ===========================================================================*/

// force: true = ignore the localStorage cache and fetch again
await DCDN.getSiteInfo({ force: false });
await DCDN.getSite({ force: false });
DCDN.getSiteInfoSync();
DCDN.clearSiteInfo();
await DCDN.getSiteInfo({ force: true });
await DCDN.applyBodyClasses();

await DCDN.getAppSettings(
  // settings entity key
  "le_pos_general_Settings",
  {
    // appId: storage id -> key "app_{appId}_settings" (default = entity key)
    appId: 82,
    // id: settings record id (default 1)
    id: 1,
    // depth: relation depth (default 1)
    depth: 1,
    // ttl: cache seconds (default forever)
    ttl: 3600,
    // force: true = ignore the cache
    force: false,
  },
);

/* =============================================================================
 * 6) STORAGE  (key = "app_{appId}_{name}")
 * ===========================================================================*/

// appId, name -> the real localStorage key
DCDN.storage.key(397, "workflow");

DCDN.storage.set(
  // appId
  397,
  // name
  "cache",
  // value: anything JSON-able
  { a: 1 },
  {
    // ttl: seconds until it expires (omit = forever)
    ttl: 60,
  },
);

DCDN.storage.get(
  // appId
  397,
  // name
  "cache",
  // defaultValue when missing / expired
  {},
);

DCDN.storage.has(397, "cache");
DCDN.storage.remove(397, "cache");
DCDN.storage.clear(397);

// aliases
DCDN.setLocalStorage(397, "workflow", "12", { ttl: 3600 });
DCDN.getLocalStorage(397, "workflow", null);
DCDN.removeLocalStorage(397, "workflow");

/* =============================================================================
 * 7) READ REQUESTS
 * ===========================================================================*/

await DCDN.fetch("/v2/api/entity/client/list/1", {
  // filters: -> filter[...]  (operators: like, in, not_equal, gte, lte, is_null…)
  filters: { id: { in: [1, 2, 3, 4, 5] } },
  // sort: -> sort[...]
  sort: { id: "desc" },
  // params: extra raw query parameters
  params: {},
  // page: page number
  page: 1,
  // perPage: rows per page (per_page for v2, limit for api2)
  perPage: 5,
  // all: true = fetch EVERY page (same as fetchAll)
  all: false,
  // full: true = return the raw Daftra response in data
  full: false,
  // unwrap: api2 model name ("Invoice"), true / auto, or false
  unwrap: true,
  // loader: true | "text" | { ar, en } = full-screen loader while it runs
  loader: { ar: "جاري التحميل...", en: "Loading..." },
  // successMessage: success toast text
  successMessage: { ar: "تم التحميل", en: "Loaded" },
  // errorMessage: true = show the error, or your own text
  errorMessage: true,
  // onSuccess: callback with the plain result
  onSuccess: function (rows) {
    console.log(JSON.stringify({ onSuccess: rows.length }));
  },
  // onError: callback with the error (the call then reports success: false + fallback)
  onError: function (error) {
    console.log(JSON.stringify({ onError: error.message }));
  },
  // onComplete: always runs at the end
  onComplete: function () {
    console.log(JSON.stringify({ onComplete: true }));
  },
  // silent: true = handle errors (report success: false) without throwing
  silent: true,
  // fallback: data returned on error
  fallback: [],
  // headers: extra request headers
  headers: {},
  // retries: override DCDN.config.retries for this call
  retries: 1,
  // signal: AbortController signal to cancel the request
  signal: new AbortController().signal,
});

// get = alias of fetch
await DCDN.get("/api2/site_info");

// api2 list, rows unwrapped from { Invoice: {...} }
await DCDN.fetch("/api2/invoices", { perPage: 5, unwrap: "Invoice" });

// raw Daftra response (pagination included)
await DCDN.fetch("/api2/invoices", { perPage: 2, full: true });

// failing request -> { success: false, error }
await DCDN.fetch("/v2/api/entity/does_not_exist/list/1", { retries: 0 });

await DCDN.fetchAll("/v2/api/entity/client/list/1", {
  // filters / sort / params / perPage: same as fetch
  filters: {},
  sort: { id: "asc" },
  params: {},
  perPage: 20,
  // ids: array of ids (only with a {id} url template, see below)
  ids: undefined,
  // maxPages: stop after N pages
  maxPages: 5,
  // concurrency: pages requested at the same time
  concurrency: 4,
  // unwrap: api2 model name, true / auto, or false
  unwrap: true,
  // progress: true | "title" = progress bar
  progress: { ar: "تحميل العملاء", en: "Loading clients" },
  // onProgress: (done, total) after each page
  onProgress: function (done, total) {
    console.log(JSON.stringify({ done: done, total: total }));
  },
  // stopOnError: ids / urls modes — stop at the first failed item
  stopOnError: false,
  // loader / successMessage / errorMessage / onSuccess / onError / onComplete / silent / fallback: same as fetch
  loader: false,
  successMessage: { ar: "تم تحميل كل العملاء", en: "All clients loaded" },
  errorMessage: true,
  onSuccess: function (rows) {
    console.log(JSON.stringify({ allRows: rows.length }));
  },
  onComplete: function () {},
  silent: false,
  fallback: [],
});

// ids mode: {id} is replaced by each id
await DCDN.fetchAll("/v2/api/entity/client/{id}/1", {
  ids: [1, 2, 3],
  concurrency: 2,
  stopOnError: false,
});

// urls mode: many endpoints at once (same order)
await DCDN.fetchAll(["/api2/site_info", "/v2/api/entity/staff/list/1"]);

// low-level request (no JSON wrapper inside, no loader / toast options)
await DCDN.request("/v2/api/entity/client/list/1", {
  // method: GET | POST | PUT | PATCH | DELETE
  method: "GET",
  // body: object | FormData | string (not for GET)
  body: undefined,
  // params / filters / sort / page / perPage: query string
  params: {},
  filters: {},
  sort: {},
  page: 1,
  perPage: 2,
  // headers: extra headers
  headers: {},
  // retries: override config.retries
  retries: 0,
  // raw: true = the browser Response object instead of JSON
  raw: false,
});

// entity helper -> data = { get, list, all, create, update, updateFields, remove }
var Clients = DCDN.entity("client").data;
// id, depth (default 1)
await Clients.get(1, 1);
// options: same as fetch (+ depth)
await Clients.list({ perPage: 3, depth: 1, filters: {} });
// options: same as fetchAll (+ depth)
await Clients.all({ perPage: 50, maxPages: 2 });

/* =============================================================================
 * 8) WRITE REQUESTS  (only with WRITE_ENTITY)
 * ===========================================================================*/

if (WRITE_ENTITY) {
  var created = await DCDN.post(
    // url
    "/v2/api/entity/" + WRITE_ENTITY,
    // body: JSON object (FormData also accepted)
    WRITE_BODY,
    {
      // method: override (default POST)
      method: "POST",
      // full: true = raw Daftra response
      full: false,
      // unwrap: api2 model name to unwrap from the response
      unwrap: true,
      // loader / successMessage / errorMessage / onSuccess / onError / onComplete / silent / fallback
      loader: { ar: "جاري الحفظ...", en: "Saving..." },
      successMessage: { ar: "تم الحفظ", en: "Saved" },
      errorMessage: true,
      onSuccess: function (record) {
        console.log(JSON.stringify({ created: record && record.id }));
      },
      onComplete: function () {},
      silent: false,
      fallback: null,
      // headers / retries
      headers: {},
      retries: 0,
    },
  );
  var newId = created.data && created.data.id;

  // update some fields: POST /fields
  await DCDN.post(
    "/v2/api/entity/" + WRITE_ENTITY + "/" + newId + "/fields",
    { name: "DCDN updated" },
    { errorMessage: true },
  );

  // put / patch: url, body, same options as post
  await DCDN.put("/v2/api/entity/" + WRITE_ENTITY + "/" + newId, WRITE_BODY, {
    errorMessage: true,
    silent: true,
  });
  await DCDN.patch(
    "/v2/api/entity/" + WRITE_ENTITY + "/" + newId,
    { name: "DCDN patched" },
    { errorMessage: true, silent: true },
  );

  var bulk = await DCDN.bulkPost(
    // url: string, or (item, index) => url
    "/v2/api/entity/" + WRITE_ENTITY,
    // items: array of bodies (or anything + transform)
    [1, 2, 3],
    {
      // method: POST (default) | PUT | PATCH | DELETE
      method: "POST",
      // concurrency: requests at the same time (default 3)
      concurrency: 2,
      // delay: ms to wait after each request
      delay: 100,
      // transform: (item, index) => body
      transform: function (n) {
        return Object.assign({}, WRITE_BODY, { name: "DCDN bulk " + n });
      },
      // stopOnError: true = skip the rest after the first error
      stopOnError: false,
      // progress: true | "title" = progress bar
      progress: { ar: "إضافة سجلات", en: "Adding records" },
      // onProgress: (done, total, result) after each item
      onProgress: function (done, total) {
        console.log(JSON.stringify({ bulkDone: done, total: total }));
      },
      // loader / successMessage / errorMessage / onSuccess / onComplete
      successMessage: { ar: "تمت الإضافة", en: "Added" },
      errorMessage: true,
    },
  );
  var bulkIds = bulk.data.success.map(function (r) {
    return r.data && r.data.id;
  });

  // delete: url, options (same as post)
  await DCDN.del("/v2/api/entity/" + WRITE_ENTITY + "/" + newId, {
    successMessage: "تم الحذف",
    errorMessage: true,
  });

  // delete many: url per item, method DELETE, no body
  await DCDN.bulkPost(
    function (id) {
      return "/v2/api/entity/" + WRITE_ENTITY + "/" + id;
    },
    bulkIds,
    {
      method: "DELETE",
      transform: function () {
        return undefined;
      },
      progress: "Deleting",
    },
  );

  // entity helper writes
  var Test = DCDN.entity(WRITE_ENTITY).data;
  var made = await Test.create(WRITE_BODY);
  await Test.updateFields(made.data.id, { name: "via entity()" });
  await Test.update(made.data.id, WRITE_BODY);
  await Test.remove(made.data.id);

  // upload: entity, field key, File / Blob, file name
  // await DCDN.uploadFile(WRITE_ENTITY, WRITE_ENTITY + ".file", new Blob(["hello"], { type: "text/plain" }), "dcdn.txt");
}

/* =============================================================================
 * 9) UI: LOADER, TOAST, PROGRESS, POPUP
 * ===========================================================================*/

// text: string | { ar, en } (optional)
DCDN.showLoader({ ar: "جاري التحميل...", en: "Loading..." });
// force: true = hide now, ignoring nested showLoader calls
DCDN.hideLoader(true);

await DCDN.withLoader(
  // work: a Promise or an (async) function
  DCDN.sleep(1500),
  // text shown under the spinner
  { ar: "انتظر...", en: "Please wait..." },
);

// show: true / false, text (old name)
DCDN.toggleLoadingSpinner(true, "Loading");
DCDN.toggleLoadingSpinner(false);

DCDN.toast(
  // message: string | { ar, en }
  { ar: "تم الحفظ بنجاح", en: "Saved successfully" },
  // type: "success" | "error" | "warning" | "info"
  "success",
  {
    // title: bold first line
    title: { ar: "تم", en: "Done" },
    // timeout: ms before closing (0 = stay open; default 3500, errors 6000)
    timeout: 5000,
    // position: top-right | top-left | top-center | bottom-right | bottom-left | bottom-center
    position: "top-center",
    // html: true = message is HTML (trusted content only)
    html: false,
  },
);
DCDN.toast.success("success");
DCDN.toast.error("error", { timeout: 0 });
DCDN.toast.warning("warning", { position: "top-left" });
DCDN.toast.info("<b>info</b>", { html: true });

var bar = DCDN.progressBar({
  // title: string | { ar, en }
  title: { ar: "ترحيل البنود", en: "Posting items" },
  // total: number of steps
  total: 10,
  // target: selector / element to render inside (omit = floating at the bottom)
  target: null,
  // autoClose: ms after done() before removing (false = keep)
  autoClose: 1500,
}).data;
// current, total (optional)
bar.update(3, 10);
// steps (default 1)
bar.increment(2);
bar.setTitle("New title");
bar.setText("custom text under the bar");
// text, autoClose ms
bar.done({ ar: "تم", en: "Done" }, 2000);
// (bar.error("failed") turns it red;  bar.remove() removes it)

var popup = DCDN.showPopup(
  // content: HTML | element | jQuery | { ar, en }
  '<p>مرحبا</p><input id="dcdn-note" class="form-control" placeholder="note">',
  {
    // title: string | { ar, en } | false (no header)
    title: { ar: "اختبار النافذة", en: "Popup test" },
    // width: px number or CSS value
    width: 600,
    // buttons: text, class ("primary" | "danger"), onClick(popup, button) — no onClick = close
    buttons: [
      { text: { ar: "إلغاء", en: "Cancel" } },
      {
        text: { ar: "حفظ", en: "Save" },
        class: "primary",
        onClick: function (p) {
          DCDN.toast(p.body.querySelector("#dcdn-note").value || "empty");
          p.close("saved");
        },
      },
    ],
    // onOpen(popup): after it is shown
    onOpen: function (p) {
      p.body.querySelector("input").focus();
    },
    // onClose(result, popup): after it closes
    onClose: function (result) {
      console.log(JSON.stringify({ popupClosed: result || null }));
    },
    // closeOnBackdrop: click outside closes it
    closeOnBackdrop: true,
    // closeOnEsc: Esc key closes it
    closeOnEsc: true,
    // id: fixed id (opening the same id again replaces it)
    id: "dcdn-test-popup",
    // className: extra class on the box
    className: "",
    // dir: "rtl" | "ltr" (default page direction)
    dir: "rtl",
  },
).data;
// content: replace the body
popup.setContent("<p>new content</p>");
// id (optional) = close a popup by id, none = the top one
DCDN.closePopup("dcdn-test-popup");

await DCDN.confirm(
  // message: string | { ar, en }
  { ar: "هل أنت متأكد؟", en: "Are you sure?" },
  {
    // title / okText / cancelText: string | { ar, en }
    title: { ar: "تأكيد الحذف", en: "Confirm delete" },
    okText: { ar: "حذف", en: "Delete" },
    cancelText: { ar: "إلغاء", en: "Cancel" },
    // danger: true = red OK button
    danger: true,
    // width: px
    width: 420,
  },
);

await DCDN.alert(
  // message
  { ar: "تمت العملية", en: "Done" },
  {
    // title / okText / width
    title: { ar: "تنبيه", en: "Notice" },
    okText: { ar: "حسناً", en: "OK" },
    width: 420,
  },
);

/* =============================================================================
 * 10) TABS  (on a view / show page)
 * ===========================================================================*/

DCDN.registerTabPage(
  // page name -> creates DCDN.appendtab_<name>
  "dcdn_test",
  {
    // layout: "auto" | "classic" | "v2"
    layout: "auto",
    // match: RegExp of the page url (only used for a debug note)
    match: /view|show/,
    // nav / content: custom selectors of the tabs <ul> and the panes container (optional)
    // nav: "#myTabs", content: "#myTabsContent",
  },
);

await DCDN.appendtab_invoice({
  // id: unique id (also the pane id) — REQUIRED
  id: "dcdn_tab_html",
  // title: string | { ar, en }
  title: { ar: "اختبار", en: "Test" },
  // content: HTML | element | (pane, tab) => HTML | Promise<HTML>
  content: function () {
    return DCDN.raw
      .fetch("/v2/api/entity/client/list/1", { perPage: 5 })
      .then(function (rows) {
        return (
          "<pre>" +
          DCDN.raw.escapeHtml(JSON.stringify(rows, null, 2)) +
          "</pre>"
        );
      });
  },
  // url: load a Daftra page into the tab instead of content
  url: undefined,
  // selector: part of `url` to keep (default ".list-table, table, .panel")
  selector: undefined,
  // lazy: load content on first open (default true)
  lazy: true,
  // reload: reload every time the tab opens
  reload: false,
  // active: open it right away
  active: true,
  // position: index to insert at (default last)
  position: undefined,
  // badge: number / text next to the title
  badge: 5,
  // onOpen(pane, tab): every time it opens
  onOpen: function (pane) {
    console.log(JSON.stringify({ tabOpened: pane.id }));
  },
  // timeout: ms to wait for the tabs to appear
  timeout: 15000,
});

await DCDN.appendtab_entity({
  id: "dcdn_tab_url",
  title: { ar: "قائمة العملاء", en: "Clients list" },
  url: "/v2/owner/entity/client/list",
  selector: ".list-table",
  lazy: true,
  reload: true,
  active: false,
});

/* =============================================================================
 * 11) DOM + FORM FIELDS  (on a form page — change the field keys)
 * ===========================================================================*/

await DCDN.waitForElement(
  // selector
  "body",
  {
    // timeout: ms (0 = wait forever)
    timeout: 10000,
    // root: element to search inside
    root: document,
  },
);

await DCDN.waitFor(
  // condition: function, resolves with its first truthy value
  function () {
    return document.readyState === "complete";
  },
  {
    // interval: ms between checks
    interval: 100,
    // timeout: ms (0 = forever)
    timeout: 10000,
  },
);

var watcher = DCDN.onElement(
  // selector: elements to handle now and in the future
  ".dcdn-watch-me",
  // callback(element): runs once per element
  function (el) {
    el.style.outline = "2px solid green";
  },
  {
    // root: where to watch
    root: document.body,
  },
).data;
watcher.stop();

// key, root (optional): finds [id$="--key"] / [name$="[key]"] / #key
DCDN.field("qty", document);
DCDN.fields("qty", document);
// target: field key | selector | element
DCDN.getFieldValue("qty");
DCDN.setFieldValue(
  // target: field key | selector | element
  "qty",
  // value
  5,
  // text: option text when a select needs a new option
  undefined,
);

await DCDN.addDropdown('[id$="--single_line_field"]', {
  // options: array | () => array | Promise — "text", { value, text } or raw objects
  options: ["الرياض", "جدة", { value: "dmm", text: "الدمام" }],
  // source: load options from the API instead (url, filters, sort, perPage, valueKey, textKey, all)
  source: undefined,
  // valueKey / textKey: key, "dot.path" or function for raw objects
  valueKey: "value",
  textKey: "text",
  // saveAs: "value" | "text" — what is written into the original field
  saveAs: "text",
  // placeholder: string | { ar, en }
  placeholder: { ar: "-- اختر المدينة --", en: "-- Select city --" },
  // hideOriginal: hide the original field
  hideOriginal: true,
  // searchable: use select2 if it is loaded on the page
  searchable: false,
  // className: extra class for the new select
  className: "dcdn-test-dropdown",
  // live: also apply to matching fields added later (subform rows)
  live: false,
  // onSelect(option, controller): option = { value, text, data }
  onSelect: function (option) {
    console.log(JSON.stringify({ selected: option }));
  },
});

await DCDN.addDropdown('[id$="--city"]', {
  source: {
    // url: list endpoint
    url: "/v2/api/entity/client/list/1",
    // filters / sort / perPage: same as fetch
    filters: {},
    sort: { id: "asc" },
    perPage: 100,
    // valueKey / textKey: fields of each row
    valueKey: "id",
    textKey: "business_name",
    // all: false = first page only (default all pages)
    all: false,
  },
  saveAs: "value",
});

DCDN.calculatePercent('[id$="--discountvalue"]', {
  // base: what to take the percent of — selector | element | number | (input) => number
  base: 1000,
  // baseScope: find the base selector inside input.closest(baseScope), e.g. "tr"
  baseScope: undefined,
  // decimals: result decimals
  decimals: 2,
  // ratio: width kept for the value input (0.7 = 70%)
  ratio: 0.7,
  // max: max percent
  max: 100,
  // sync: typing a value updates the percent
  sync: true,
  // placeholder of the % input
  placeholder: "%",
  // live: also apply to inputs added later
  live: false,
  // onChange({ percent, value, base, target })
  onChange: function (r) {
    console.log(
      JSON.stringify({ percent: r.percent, value: r.value, base: r.base }),
    );
  },
});

DCDN.addMenuItem({
  // parent: selector of the parent sidebar menu
  parent: ".mn_inventory",
  // sidebarId: data-app-sidebar-list-item id (fallback)
  sidebarId: 36,
  // url: link
  url: "/v2/owner/entity/client/list",
  // title: string | { ar, en }
  title: { ar: "رابط اختبار", en: "Test link" },
  // after: insert after this item index (default last)
  after: 0,
});

// target: input selector / element
DCDN.triggerEnter('[id$="--barcode"]');

/* =============================================================================
 * 12) SCRIPTS, STYLES, CLIPBOARD, TIMING
 * ===========================================================================*/

await DCDN.loadScript(
  "https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js",
  {
    // id: id of the <script> tag
    id: "dcdn-dayjs",
    // test: () => true skips loading (already on the page)
    test: function () {
      return !!window.dayjs;
    },
  },
);
// href of the stylesheet
await DCDN.loadStyle(
  "https://cdn.jsdelivr.net/npm/animate.css@4.1.1/animate.min.css",
);
// cssText, id (added once per id)
DCDN.injectCSS(".dcdn-watch-me{background:#fffbe6}", "dcdn-test-css");
// text
await DCDN.copyToClipboard("copied from DCDN");
// ms
await DCDN.sleep(300);
// callback, waitMs -> data = the debounced / throttled function
var debounced = DCDN.debounce(function () {
  DCDN.toast("debounced");
}, 300).data;
var throttled = DCDN.throttle(function () {
  DCDN.toast("throttled");
}, 1000).data;
debounced();
throttled();

/* =============================================================================
 * 13) TABLES + EXPORT  (on a page with a table)
 * ===========================================================================*/

// table -> rows as objects
DCDN.table.toJSON("table");
DCDN.formatCells(".removeCurr", {
  // decimals
  decimals: 2,
  // prefix / suffix text
  prefix: "",
  suffix: " ر.س",
  // suffixHtml: HTML after the number (e.g. a currency symbol span) — overrides suffix
  suffixHtml: undefined,
});
// table, file name (no extension)
DCDN.exportTableToExcel("table", "dcdn-table");
// rows (array of objects) or a table, file name
DCDN.exportCSV([{ name: "Ahmed", total: 100 }], "dcdn-rows");
// blob, file name
DCDN.downloadBlob(
  new Blob([JSON.stringify({ ok: true })], { type: "application/json" }),
  "dcdn.json",
);

/* =============================================================================
 * 14) OLD GLOBAL NAMES + PLAIN VALUES
 * ===========================================================================*/

// defines toggleLoadingSpinner, getSiteInfo, swap... on window (only if free)
DCDN.exposeGlobals();

// DCDN.raw = same functions returning plain values (no JSON wrapper)
DCDN.raw.isRTL();
DCDN.raw.parseNumber("1,250.50");
await DCDN.raw.fetch("/v2/api/entity/client/list/1", { perPage: 2 });


/* =============================================================================
 * 15) FROM THE LANGUAGE PACKS — Daftra-native UI, money, entities, translation
 * ===========================================================================*/

// ---- Daftra's own loader ----
DCDN.nativeLoader(
  // show: true = show, false = hide (after 500 ms)
  true,
  // text: string | { ar, en } under the spinner
  { ar: "جارِ التحميل...", en: "Loading..." }
);
DCDN.nativeLoader(false);

await DCDN.initPage(
  // work: function (may be async) or Promise — the page set-up
  async function () { await DCDN.raw.sleep(500); },
  // text: loader text (default "Initializing page...")
  { ar: "جارِ تهيئة الصفحة...", en: "Initializing page..." }
);

// ---- Daftra's own alerts ----
DCDN.nativeAlert(
  // text: string (HTML allowed) | { ar, en }
  { ar: "تم الحفظ", en: "Saved" },
  // type: "success" | "error" | "warning"
  "success",
  {
    // mode: "auto" ($.toast -> classic banner -> v2 banner) | "toast" | "classic" | "v2"
    mode: "auto",
    // scroll: scroll the banner into view
    scroll: true,
    // container: selector for the v2 banner (default the page content)
    container: undefined,
  }
);

DCDN.flashToast(
  // text: string (HTML allowed) | { ar, en }
  { ar: "تعذر الحفظ", en: "Could not save" },
  // type: "success" | "error" | "warning" | "info"
  "error",
  {
    // gravity: "top" | "bottom"
    gravity: "top",
    // timeout: ms (success 2500, warning 4000, error 5000; 0 = stay)
    timeout: 4000,
  }
);

DCDN.noticeAfterReload(
  // text: shown on the NEXT page load
  { ar: "تم التحديث", en: "Updated" },
  // type
  "success",
  {
    // style: "native" | "flash" | "toast"
    style: "native",
    // maxAgeMs: ignore it if the next page loads later than this
    maxAgeMs: 60000,
  }
);
// shows (once) a saved notice — runs automatically on every page load
DCDN.showPendingNotice();

// ---- field errors (form page: change the field) ----
// field: field id, field key, selector or element
DCDN.getFieldColumn("qty");
DCDN.showFieldError(
  // field
  "qty",
  // message: string | { ar, en }
  { ar: "أدخل الكمية", en: "Enter the quantity" }
);
DCDN.clearFieldError("qty");
// form: selector / element (default document)
DCDN.clearAllFieldErrors("form");
DCDN.bindSaveValidation(
  // form: selector / element
  "form",
  // collectErrors(): [{ field, message }] — [] when valid
  function () {
    return DCDN.raw.getFieldValue("qty") ? [] : [{ field: "qty", message: { ar: "أدخل الكمية", en: "Enter the quantity" } }];
  },
  // beforeValidate(): optional, runs first
  function () {}
);

// ---- breadcrumbs ----
DCDN.prependBreadcrumb({
  // label: string | { ar, en }
  label: { ar: "إعدادات دورة العمل", en: "Workflow Settings" },
  // url: link
  url: "/v2/owner/workflow/settings",
  // id: marker so it is added once
  id: "workflow-settings",
  // onlyFor: entity key — only on that entity's pages
  onlyFor: undefined,
});
DCDN.setBreadcrumbs({
  // first: rename / relink the first crumb
  first: { label: { ar: "إعدادات دورات العمل", en: "Workflow Settings" }, url: "/v2/owner/workflow/settings" },
  // hideMiddle: hide every crumb between the first and the active one
  hideMiddle: true,
  // active: text of the current page crumb
  active: { ar: "الصلاحيات", en: "Permissions" },
  // onlyActive: remove every crumb except the last (wizards)
  onlyActive: false,
  // title: browser tab title (true = same as active)
  title: true,
});

// ---- wizard steps strip ----
DCDN.stepsHeader(
  // steps: [{ title, number?, url? }]
  [
    { number: 1, title: { ar: "الربط", en: "Connect" }, url: "/step1" },
    { number: 2, title: { ar: "الحسابات", en: "Accounts" } },
    { number: 4, title: { ar: "الإعدادات", en: "Settings" } },
  ],
  // currentStep: the step's number
  2,
  {
    // target: container to prepend it into
    target: ".main-area > .container",
    // links: finished steps are clickable (need url)
    links: true,
  }
);

// ---- list page: buttons, add button, hiding ----
DCDN.addListButton({
  // id: unique (added once)
  id: "dcdn-refresh",
  // label: string | { ar, en }
  label: { ar: "تحديث", en: "Refresh" },
  // icon: mdi icon class
  icon: "mdi-refresh",
  // href: link (ignored with onClick)
  href: "#",
  // onClick(event, button)
  onClick: function () { DCDN.noticeAfterReload("Refreshed"); location.reload(); },
  // className: extra classes (default btn-secondary)
  className: "btn-secondary",
  // container: bar selector
  container: ".pages-head-btns",
});
// selector, id (optional) -> data = { reveal(), style }
var addBtn = DCDN.hideEarly('.pages-head-btns .add-new-btn, a[name="Add-Work-Flow"]', "hide-add").data;
addBtn.reveal();
DCDN.replaceAddButton({
  // href: new link
  href: "/v2/owner/entity/client/create",
  // label: new text
  label: { ar: "إضافة عميل", en: "Add Client" },
  // reveal: remove a hideEarly on the add button
  reveal: true,
});
// selectors (string or list), id
DCDN.hideElements(['.btn-group[aria-label="item-actions-group"] a[href$="/edit"]'], "hide-edit-action");
// fieldKey, entityKey (default from the URL)
DCDN.hideFormField("status");

await DCDN.addSidebarLink({
  // id: unique (an existing link with this id is replaced)
  id: "dcdn-link",
  // label: string | { ar, en }
  label: { ar: "رابط اختبار", en: "Test link" },
  // url
  url: "/v2/owner/entity/client/list",
  // classicGroup: classic sidebar group selector
  classicGroup: ".mn_dashboard",
  // v2Group: v2 data-app-sidebar-list-item value
  v2Group: 1,
  // retryMs: keep trying while the sidebar loads
  retryMs: 10000,
});

// ---- money ----
DCDN.formatCurrency(
  // amount: number or text
  1250.5,
  // currencyCode: ISO code (150+ supported, see DCDN.currencyFormats)
  "EGP",
  {
    // lang: "ar" | "en" (default page language)
    lang: "ar",
    // decimals
    decimals: 2,
    // html: false = plain text (SAR symbol HTML -> "SAR")
    html: true,
  }
);
DCDN.currencyFormats;

// ---- entities ----
// response: raw JSON -> the record ({ payload: { data } } unwrapped)
DCDN.unwrapEntity({ payload: { data: { id: 5 } } });
// name: exact workflow name, options.force: ignore the cache
var wf = await DCDN.getWorkflowType("Customer Deliveries", { force: false });
// entity key or workflow_type record -> trailing id
DCDN.getEntityKeyId("le_workflow-type-entity-36");
await DCDN.getFirstRecord("client", {
  // filters: same as fetch
  filters: {},
  // depth: relation depth
  depth: 1,
});
if (WRITE_ENTITY) {
  await DCDN.updateRecord(
    // entityKey
    WRITE_ENTITY,
    // id
    1,
    // fields to save
    { name: "updated via updateRecord" },
    {
      // parentLink: for a child entity, its parent-link field
      parentLink: undefined,
    }
  );
  await DCDN.upsertSubformRows(
    // entityKey, recordId, subform field
    WRITE_ENTITY, 1, "rows",
    // rows: with id = update, without id = add
    [{ name: "new row" }],
    {
      // mode: "merge" keeps other rows, "replace" sends exactly these rows
      mode: "merge",
      // parentLink: see updateRecord
      parentLink: undefined,
    }
  );
}
// entityKey, subform field -> real key
DCDN.subformKey("app_897_tariff", "price_condition");
// MultipleDropdown value -> array of strings
DCDN.parseMultiValue("1, 2,3");

// ---- page / time ----
DCDN.getPageContext();
// timeZone (IANA), date (default now)
DCDN.nowInTimeZone("Asia/Riyadh", new Date());
// dateOfBirth, onDate (default today)
DCDN.ageOnDate("2015-06-01", "2026-05-31");
await DCDN.cached(
  // key
  "dcdn-test-cache",
  // work: produces the value (may be async)
  function () { return DCDN.raw.fetch("/api2/site_info"); },
  {
    // ttl: ms in localStorage (0 = this page only)
    ttl: 60000,
    // force: run again
    force: false,
  }
);
// key, url (default current page)
DCDN.setReturnUrl("dcdn-return", location.href);
DCDN.handleReturnRedirect({
  // key: same as setReturnUrl
  key: "dcdn-return-not-set",
  // pathPattern: new record id in group 1
  pathPattern: /\/app_609_car\/(\d+)/,
  // param: URL parameter for the id
  param: "car_id",
  // text: loader text
  text: { ar: "جاري التوجيه...", en: "Redirecting..." },
});

// ---- language pack ----
var pack = DCDN.languagePack({
  // phrases: [{ en, ar }] or [en, ar] — case-sensitive, longest first
  phrases: [{ en: "Clients", ar: "العملاء" }, ["Client", "العميل"]],
  // sentences: whole sentences with {slots}, or { pattern, ar, length } from build-sentences
  sentences: [{ en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }],
  // direction: "auto" | "toArabic" | "toEnglish"
  direction: "auto",
  // arabicPagesOnly: leave English pages untouched
  arabicPagesOnly: false,
  // wholeWords: "Test" never changes "Testing"
  wholeWords: true,
  // skipSelector: never translated
  skipSelector: "script, style, noscript, textarea, input, select, option, iframe, .dcdn-no-translate",
  // attributes translated too
  attributes: ["placeholder", "title", "aria-label", "data-float-label"],
  // dropdowns: placeholder options + dynamic-dropdown display inputs
  dropdowns: true,
  // iframes: same-origin iframes
  iframes: true,
  // title: browser tab title
  title: true,
  // observe: content added later
  observe: true,
  // autoStart: run on ready + load + dropdown open
  autoStart: true,
}).data;
// rootOrSelector (default whole page)
pack.translate("body");
pack.translateText("Clients");
pack.translateSentence("Sent 5 journals");
pack.addPhrases([{ en: "Name", ar: "الاسم" }]);
pack.addSentences([{ en: "Saved {n} rows", ar: "تم حفظ {n} صفوف" }]);
// run every pack on a container
DCDN.translateLanguagePack("body");
pack.stop();
