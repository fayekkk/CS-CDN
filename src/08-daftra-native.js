/* ==========================================================================
 * 08-daftra-native.js
 * ----------------------------------------------------------------------------
 * Helpers taken from the apps' "Language Pack" page codes, made generic:
 *   - Daftra's OWN UI: native loader, native alerts, flash toast, field errors,
 *     breadcrumbs, list-page buttons, sidebar links, steps header, early hiding
 *   - Money: formatCurrency + DCDN.currencyFormats (150+ currencies)
 *   - Entities: unwrapEntity, getWorkflowType, getEntityKeyId, getFirstRecord,
 *     updateRecord, subformKey, upsertSubformRows, parseMultiValue
 *   - Page: getPageContext, nowInTimeZone, ageOnDate, cached,
 *     return-redirects, notices that survive a reload
 * ======================================================================== */

var NATIVE_CSS = [
  /* native alerts: Daftra's $.toast has no warning colour */
  ".toast-warning { color: #7a5200; background: #fff3cd; border: 1px solid #ffc107; }",
  ".toast-warning a { color: #4d3300; text-decoration: none; font-weight: 700; }",
  ".toast .toast-content, .toast .toast-body { align-items: center !important; }",
  ".toast p { padding-top: 0; }",
  /* v2 banner layout (Daftra ships its colours, not a layout) */
  ".dcdn-ui-flash { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }",
  ".dcdn-ui-flash .ui-flash-message-body-icon { font-size: 22px; line-height: 1; }",
  ".dcdn-ui-flash .ui-flash-message-body-text { flex: 1; }",
  ".dcdn-ui-flash .ui-flash-message-body-text a { color: inherit; text-decoration: underline; }",
  ".dcdn-ui-flash .ui-flash-message-close-icon { flex-shrink: 0; background: transparent; border: 0; width: 24px; height: 24px; padding: 0; line-height: 1; cursor: pointer; color: inherit; }",
  /* flash toast: floating banner that looks like Daftra's flash messages */
  ".dcdn-flash-toasts { position: fixed; left: 50%; transform: translateX(-50%); width: 92vw; max-width: 600px; z-index: calc(var(--dcdn-z, 1000000) + 2); display: flex; flex-direction: column; gap: 8px; }",
  ".dcdn-flash-toasts.top { top: 16px; } .dcdn-flash-toasts.bottom { bottom: 16px; }",
  ".dcdn-flash-toast { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; border-radius: 4px; font-size: 1.1em; font-weight: 500; text-align: start; animation: dcdn-in .25s ease; }",
  ".dcdn-flash-toast a { color: inherit !important; font-weight: 700; }",
  ".dcdn-flash-toast--error { color: #fff; background: #fc5f7d; border: 1px solid #fc5f7d; }",
  ".dcdn-flash-toast--success { color: #0a5d3b; background: #d0f0e3; border: 1px solid #13b272; }",
  ".dcdn-flash-toast--warning { color: #7a5200; background: #fff3cd; border: 1px solid #ffc107; }",
  ".dcdn-flash-toast--info { color: #0c4a6e; background: #e0f2fe; border: 1px solid #38bdf8; }",
  ".dcdn-flash-toast-close { flex-shrink: 0; background: transparent; border: 0; padding: 0; cursor: pointer; color: inherit; font-size: 20px; line-height: 1; }",
  /* text under Daftra's native .page-loader spinner */
  ".loading-spinner-text { margin-top: 16px; font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center; }",
  /* steps header (wizards) */
  ".dcdn-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0; padding: 14px 20px; list-style: none; background: #fff; border-radius: 2px; }",
  ".dcdn-step { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #9aa0b4; }",
  ".dcdn-step + .dcdn-step::before { content: ''; width: 32px; height: 1px; margin-inline-end: 4px; background: #dee2e6; }",
  ".dcdn-step-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #dee2e6; border-radius: 50%; font-size: 13px; font-weight: 700; }",
  ".dcdn-step.is-current { font-weight: 700; color: #4e5381; }",
  ".dcdn-step.is-current .dcdn-step-number { border-color: #026bff; color: #fff; background: #026bff; }",
  ".dcdn-step.is-done { color: #4e5381; }",
  ".dcdn-step.is-done .dcdn-step-number { border-color: #13b272; color: #fff; background: #13b272; }",
].join("\n");

function ensureNativeStyles() {
  ensureStyles();
  return DCDN.injectCSS(NATIVE_CSS, "dcdn-native-styles");
}

/* ============================ native loader ============================== */

DCDN.nativeLoader = function nativeLoader(show, text) {
  /**
   * Daftra's OWN full-page loader (.page-loader + .spinner-border), with optional text.
   * Calling it again while shown only changes the text.
   *
   * @param {boolean} show                      true = show, false = hide (after `hideDelay` ms)
   * @param {string|{ar:string,en:string}} [text]  text under the spinner
   * @returns {void}
   *
   * Examples:
   *   DCDN.nativeLoader(true, { ar: "جارِ التحميل...", en: "Loading..." });
   *   DCDN.nativeLoader(false);
   */
  ensureNativeStyles();
  var loader = document.querySelector(".page-loader.dcdn-native-loader") || document.querySelector(".page-loader");
  if (show) {
    if (!loader) {
      loader = createElementFromHtml(
        '<div class="page-loader dcdn-native-loader"><div class="spinner-wrap" style="text-align:center;">' +
          '<div class="spinner-border loading-spinner-icon" role="status"></div>' +
          '<div class="loading-spinner-text"></div></div></div>'
      );
      document.body.appendChild(loader);
    }
    var textElement = loader.querySelector(".loading-spinner-text");
    if (textElement) textElement.textContent = text ? pickText(text) : "";
    return;
  }
  setTimeout(function () {
    getElements(".page-loader.dcdn-native-loader").forEach(function (element) {
      element.remove();
    });
  }, 500);
};

DCDN.initPage = function initPage(work, text) {
  /**
   * Run a page set-up under Daftra's native loader, so users never see the page
   * half changed. The loader is hidden on every way out (errors included).
   *
   * @param {Function|Promise} work                    set-up function (may be async) or a Promise
   * @param {string|{ar:string,en:string}} [text]      loader text (default "Initializing page...")
   * @returns {Promise<*>}                             what `work` returned
   *
   * Example:
   *   DCDN.initPage(async function () {
   *     DCDN.prependBreadcrumb({ label: "NTMP", url: "/v2/owner/entity/app_924_ntmp_dashboard/list" });
   *     await loadSomething();
   *   });
   */
  DCDN.nativeLoader(true, text || { ar: "جارِ تهيئة الصفحة...", en: "Initializing page..." });
  return Promise.resolve()
    .then(function () {
      return typeof work === "function" ? work() : work;
    })
    .finally(function () {
      DCDN.nativeLoader(false);
    });
};

/* ============================ native alerts ============================== */

DCDN.nativeAlert = function nativeAlert(text, type, options) {
  /**
   * Show a message EXACTLY like Daftra does on the current page
   * (was showToastifyAlert in the Language Packs):
   *   1. page has Daftra's $.toast plugin (v2 create/edit)  -> $.toast
   *   2. classic /owner/ page (.flash-wrapper)               -> Daftra's server-style banner
   *   3. other v2 pages (list, show)                          -> Daftra's v2 ui-flash-message banner
   * Banners (2, 3) replace the previous one and scroll into view.
   *
   * @param {string|{ar:string,en:string}} text        message (HTML allowed)
   * @param {"success"|"error"|"warning"} [type="success"]
   * @param {Object}  [options]
   * @param {"auto"|"toast"|"classic"|"v2"} [options.mode="auto"]  force one of the 3 styles
   * @param {boolean} [options.scroll=true]             scroll the banner into view
   * @param {string}  [options.container]               selector to put a v2 banner in (default the page content)
   * @returns {Element|null}                            the banner element (null for $.toast)
   *
   * Examples:
   *   DCDN.nativeAlert("تم الحفظ");
   *   DCDN.nativeAlert({ ar: "حدث خطأ", en: "Something went wrong" }, "error");
   *   DCDN.nativeAlert("Check the settings", "warning", { mode: "v2", scroll: false });
   */
  options = options || {};
  ensureNativeStyles();
  var message = pickText(text);
  var kind = type === "error" ? "error" : type === "warning" ? "warning" : "success";
  var mode = options.mode || "auto";
  var $ = window.jQuery;

  // 1. Daftra's $.toast plugin
  if ((mode === "auto" || mode === "toast") && $ && typeof $.toast === "function") {
    $.toast(message, kind === "error" ? "danger" : kind);
    return null;
  }

  getElements(".dcdn-native-flash").forEach(function (element) {
    element.remove();
  });
  var banner;
  var flashWrapper = document.querySelector(".flash-wrapper");

  if ((mode === "auto" && flashWrapper) || mode === "classic") {
    // 2. classic /owner/ layout
    if (kind === "error") {
      banner = createElementFromHtml(
        '<div id="CustomErrorMessage" class="Errormessage dcdn-native-flash"><ul><li></li></ul>' +
          '<button onclick="this.parentNode.remove()" type="button" class="bg-transparent border-0 btn ml-auto p-0 s2020">' +
          '<i class="fs-22 mdi mdi-close-circle-outline"></i></button></div>'
      );
      banner.querySelector("li").innerHTML = message;
    } else {
      banner = createElementFromHtml(
        kind === "success"
          ? '<div id="flashMessage" class="Sucmessage dcdn-native-flash"></div>'
          : '<div class="Notemessage dcdn-native-flash"></div>'
      );
      banner.innerHTML = message;
    }
    (flashWrapper || document.body).insertBefore(banner, (flashWrapper || document.body).firstChild);
  } else {
    // 3. v2 layout
    var variant = kind === "error" ? "danger" : kind === "warning" ? "info" : "success";
    var icon = kind === "success" ? "mdi-check-circle-outline" : kind === "error" ? "mdi-alert-circle-outline" : "mdi-information-outline";
    banner = createElementFromHtml(
      '<div class="ui-flash-message ui-flash-message--' + variant + ' dcdn-ui-flash dcdn-native-flash" role="alert">' +
        '<i class="ui-flash-message-body-icon mdi ' + icon + '"></i>' +
        '<div class="ui-flash-message-body-text"></div>' +
        '<button onclick="this.parentNode.remove()" type="button" class="ui-flash-message-close-icon"><i class="mdi mdi-close"></i></button>' +
        "</div>"
    );
    banner.querySelector(".ui-flash-message-body-text").innerHTML = message;
    var host = getElement(options.container) || document.querySelector(".main-area > .container, .main-area > .container-fluid") || document.body;
    host.insertBefore(banner, host.firstChild);
  }

  if (options.scroll !== false && banner.getBoundingClientRect) {
    var rect = banner.getBoundingClientRect();
    if (rect.top < 60 || rect.bottom > window.innerHeight) {
      window.scrollTo({ top: Math.max(0, (window.scrollY || 0) + rect.top - 80) });
    }
  }
  return banner;
};

DCDN.flashToast = function flashToast(text, type, options) {
  /**
   * Floating, auto-closing banner that LOOKS like Daftra's flash messages
   * (the Toastify version of the Language Pack, without the Toastify library).
   *
   * @param {string|{ar:string,en:string}} text                     message (HTML allowed)
   * @param {"success"|"error"|"warning"|"info"} [type="success"]
   * @param {Object}  [options]
   * @param {"top"|"bottom"} [options.gravity="top"]  screen edge
   * @param {number}  [options.timeout]               ms before closing (success 2500, warning 4000, error 5000; 0 = stay)
   * @returns {{el: Element, close: Function}}
   *
   * Examples:
   *   DCDN.flashToast("تم الحفظ");
   *   DCDN.flashToast({ ar: "تعذر الحفظ", en: "Could not save" }, "error", { gravity: "bottom" });
   */
  options = options || {};
  ensureNativeStyles();
  var kind = ["success", "error", "warning", "info"].indexOf(type) > -1 ? type : "success";
  var gravity = options.gravity === "bottom" ? "bottom" : "top";
  var container = document.querySelector(".dcdn-flash-toasts." + gravity);
  if (!container) {
    container = createElementFromHtml('<div class="dcdn-flash-toasts ' + gravity + '"></div>');
    document.body.appendChild(container);
  }
  container.setAttribute("dir", DCDN.isRTL() ? "rtl" : "ltr");
  var toastElement = createElementFromHtml(
    '<div class="dcdn-flash-toast dcdn-flash-toast--' + kind + '" role="alert"><div class="dcdn-flash-toast-body"></div>' +
      '<button type="button" class="dcdn-flash-toast-close" aria-label="close">×</button></div>'
  );
  toastElement.querySelector(".dcdn-flash-toast-body").innerHTML = pickText(text);
  container.appendChild(toastElement);

  var timer;
  function close() {
    clearTimeout(timer);
    toastElement.remove();
  }
  toastElement.querySelector(".dcdn-flash-toast-close").onclick = close;
  var timeout = options.timeout != null ? options.timeout : kind === "error" ? 5000 : kind === "warning" ? 4000 : 2500;
  if (timeout) timer = setTimeout(close, timeout);
  return { el: toastElement, close: close };
};

/* ===================== notices that survive a reload ===================== */

var NOTICE_KEY = "dcdn_pending_notice";

DCDN.noticeAfterReload = function noticeAfterReload(text, type, options) {
  /**
   * Save a message to show on the NEXT page load (e.g. after location.reload()
   * or a redirect). Show it there with DCDN.showPendingNotice() (called automatically
   * on every page where the CDN loads).
   *
   * @param {string|{ar:string,en:string}} text
   * @param {"success"|"error"|"warning"} [type="success"]
   * @param {Object} [options]
   * @param {"native"|"flash"|"toast"} [options.style="native"]  how to show it (nativeAlert / flashToast / toast)
   * @param {number} [options.maxAgeMs=60000]     ignore it if the next page loads later than this
   * @returns {boolean}                            false when sessionStorage is blocked
   *
   * Example:
   *   DCDN.noticeAfterReload({ ar: "تم التحديث", en: "Updated" });
   *   location.reload();
   */
  options = options || {};
  try {
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify({
      text: text,
      type: type || "success",
      style: options.style || "native",
      until: Date.now() + (options.maxAgeMs || 60000),
    }));
    return true;
  } catch (e) {
    return false;
  }
};

DCDN.showPendingNotice = function showPendingNotice() {
  /**
   * Show (once) the message saved by DCDN.noticeAfterReload. Runs automatically on page load.
   *
   * @returns {Object|null}  the notice { text, type, style } that was shown, or null
   *
   * Example:
   *   DCDN.showPendingNotice();
   */
  var notice = null;
  try {
    notice = JSON.parse(sessionStorage.getItem(NOTICE_KEY) || "null");
    sessionStorage.removeItem(NOTICE_KEY);
  } catch (e) {
    return null;
  }
  if (!notice || (notice.until && Date.now() > notice.until)) return null;
  if (notice.style === "flash") DCDN.flashToast(notice.text, notice.type);
  else if (notice.style === "toast") DCDN.toast(notice.text, notice.type);
  else DCDN.nativeAlert(notice.text, notice.type);
  return notice;
};

/* ============================== field errors ============================= */

var FIELD_ERROR_CLASS = "dcdn-field-error";
var FIELD_INVALID_CLASSES = ["is-invalid", "is-invalid-box", "dcdn-field-invalid"];

function resolveFieldElement(field) {
  if (typeof field === "string") return document.getElementById(field) || getElement(field) || DCDN.field(field);
  return getElement(field);
}

DCDN.getFieldColumn = function getFieldColumn(field) {
  /**
   * The column (label + input) of a form field: its nearest [class*="col-lg-"] ancestor,
   * or the .form-group inside it (subform rows), which is what Daftra's red-border CSS targets.
   *
   * @param {string|Element} field   field id ("data-le_x--qty"), field key ("qty"), selector or element
   * @returns {Element|null}
   *
   * Example:
   *   DCDN.getFieldColumn("data-le_x--qty");
   */
  var input = resolveFieldElement(field);
  if (!input) return null;
  var column = input.closest('[class*="col-lg-"]') || input.closest(".form-group") || input.parentNode;
  var group = column && column.querySelector(":scope > .form-group");
  return group || column;
};

DCDN.clearFieldError = function clearFieldError(field) {
  /**
   * Remove the message + red border DCDN.showFieldError added to one field.
   *
   * @param {string|Element} field   field id, field key, selector or element
   * @returns {void}
   *
   * Example:
   *   DCDN.clearFieldError("qty");
   */
  var column = DCDN.getFieldColumn(field);
  if (!column) return;
  if (column.classList.contains("dcdn-field-invalid")) {
    FIELD_INVALID_CLASSES.forEach(function (className) {
      column.classList.remove(className);
    });
  }
  getElements("." + FIELD_ERROR_CLASS, column).forEach(function (element) {
    element.remove();
  });
};

DCDN.clearAllFieldErrors = function clearAllFieldErrors(form) {
  /**
   * Remove every message DCDN.showFieldError added inside a form.
   *
   * @param {string|Element} [form=document]   form selector / element
   * @returns {void}
   *
   * Example:
   *   DCDN.clearAllFieldErrors("form");
   */
  var root = getElement(form) || document;
  getElements(".dcdn-field-invalid", root).forEach(function (column) {
    FIELD_INVALID_CLASSES.forEach(function (className) {
      column.classList.remove(className);
    });
  });
  getElements("." + FIELD_ERROR_CLASS, root).forEach(function (element) {
    element.remove();
  });
};

DCDN.showFieldError = function showFieldError(field, message) {
  /**
   * Red message under a form field, with Daftra's own classes (.is-invalid + .form-validation > p.error).
   * The message goes away as soon as the field changes.
   *
   * @param {string|Element} field                       field id, field key, selector or element
   * @param {string|{ar:string,en:string}} message       what to fix
   * @returns {boolean}                                  false when the field was not found
   *
   * Example:
   *   DCDN.showFieldError("data-le_x--qty", { ar: "أدخل الكمية", en: "Enter the quantity" });
   */
  var input = resolveFieldElement(field);
  var column = DCDN.getFieldColumn(input);
  if (!input || !column) return false;
  DCDN.clearFieldError(input);
  var messageElement = createElementFromHtml('<div class="form-validation ' + FIELD_ERROR_CLASS + '"><p class="error"></p></div>');
  messageElement.querySelector("p").textContent = pickText(message);
  FIELD_INVALID_CLASSES.forEach(function (className) {
    column.classList.add(className);
  });
  column.appendChild(messageElement);
  function clearOnce() {
    DCDN.clearFieldError(input);
    input.removeEventListener("input", clearOnce);
    input.removeEventListener("change", clearOnce);
  }
  input.addEventListener("input", clearOnce);
  input.addEventListener("change", clearOnce);
  return true;
};

DCDN.bindSaveValidation = function bindSaveValidation(form, collectErrors, beforeValidate) {
  /**
   * Block a form's save while `collectErrors()` returns errors, and show them under the fields.
   * Runs in the capture phase on submit AND on every submit button, before Daftra's own handlers.
   *
   * @param {string|Element} form                                    form selector / element
   * @param {function(): Array<{field:(string|Element), message:(string|{ar:string,en:string})}>} collectErrors
   *        return [] when everything is valid  (`fieldId` is accepted as an alias of `field`)
   * @param {Function} [beforeValidate]                              runs first (e.g. sync hidden values)
   * @returns {boolean}                                              false when the form was not found / already bound
   *
   * Example:
   *   DCDN.bindSaveValidation("form", function () {
   *     var errors = [];
   *     if (!DCDN.raw.getFieldValue("qty")) errors.push({ field: "qty", message: { ar: "أدخل الكمية", en: "Enter the quantity" } });
   *     return errors;
   *   });
   */
  var formElement = getElement(form);
  if (!formElement || formElement.__dcdnSaveValidation) return false;
  formElement.__dcdnSaveValidation = true;

  function guard(event) {
    if (beforeValidate) beforeValidate();
    DCDN.clearAllFieldErrors(formElement);
    var errors = unwrapEnvelope(collectErrors()) || [];
    if (!errors.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    errors.forEach(function (error) {
      DCDN.showFieldError(error.field || error.fieldId, error.message);
    });
    var firstColumn = DCDN.getFieldColumn(errors[0].field || errors[0].fieldId);
    if (firstColumn && firstColumn.scrollIntoView) firstColumn.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  formElement.addEventListener("submit", guard, true);
  getElements('button[type="submit"], input[type="submit"]', formElement).forEach(function (button) {
    button.addEventListener("click", guard, true);
  });
  return true;
};

/* ============================== breadcrumbs ============================== */

DCDN.prependBreadcrumb = function prependBreadcrumb(options) {
  /**
   * Put a breadcrumb in FRONT of the page's own trail. Works on both Daftra layouts:
   * list/show pages (<ol id="header-breadcrumb">) and create/edit pages (.header-breadcrumbs).
   * Safe to call more than once (added once per id).
   *
   * @param {Object} options
   * @param {string|{ar:string,en:string}} options.label   crumb text
   * @param {string} options.url                            crumb link
   * @param {string} [options.id="dcdn-crumb"]              marker so it is added only once
   * @param {string} [options.onlyFor]                      entity key: only on that entity's pages
   * @returns {Element|null}                                the new crumb
   *
   * Example:
   *   DCDN.prependBreadcrumb({ label: { ar: "إعدادات دورة العمل", en: "Workflow Settings" }, url: "/v2/owner/workflow/settings" });
   */
  options = options || {};
  if (options.onlyFor && !new RegExp("/entity/(workflow/)?" + options.onlyFor + "/").test(location.pathname)) return null;
  var marker = options.id || "dcdn-crumb";
  var label = pickText(options.label);
  var container = document.querySelector("#header-breadcrumb, .header-breadcrumbs");
  if (!container || container.querySelector('[data-dcdn-crumb="' + marker + '"]')) return null;
  var first = container.firstElementChild;
  var crumb;
  if (container.tagName === "OL") {
    crumb = createElementFromHtml('<li class="breadcrumb-item"><a></a></li>');
    crumb.querySelector("a").textContent = label;
    crumb.querySelector("a").setAttribute("href", options.url);
  } else {
    var template = container.querySelector("a.header-breadcrumb");
    crumb = template ? template.cloneNode(true) : createElementFromHtml('<a class="header-breadcrumb"><span></span></a>');
    crumb.setAttribute("href", options.url);
    (crumb.querySelector("span") || crumb).textContent = label;
  }
  crumb.setAttribute("data-dcdn-crumb", marker);
  container.insertBefore(crumb, first);
  return crumb;
};

DCDN.setBreadcrumbs = function setBreadcrumbs(options) {
  /**
   * Rewrite the page's breadcrumb trail (both layouts).
   *
   * @param {Object} options
   * @param {{label:(string|{ar:string,en:string}), url:string}} [options.first]   rename / relink the first crumb
   * @param {boolean} [options.hideMiddle=false]          hide every crumb between the first and the active one
   * @param {string|{ar:string,en:string}} [options.active]  text of the last (current page) crumb
   * @param {boolean} [options.onlyActive=false]          remove every crumb except the last one (wizards)
   * @param {string|{ar:string,en:string}|boolean} [options.title]  browser tab title (true = same as `active`)
   * @returns {void}
   *
   * Examples:
   *   DCDN.setBreadcrumbs({
   *     first: { label: { ar: "إعدادات دورات العمل", en: "Workflow Settings" }, url: "/v2/owner/workflow/settings" },
   *     hideMiddle: true,
   *     active: { ar: "صلاحيات أوامر التوصيل", en: "Delivery Orders Permissions" },
   *     title: true,
   *   });
   *   DCDN.setBreadcrumbs({ onlyActive: true, active: { ar: "إعداد رصد", en: "Rasd Setup" }, title: true });
   */
  options = options || {};
  [
    { items: "#header-breadcrumb .breadcrumb-item" },
    { items: ".header-breadcrumbs .header-breadcrumb" },
  ].forEach(function (layout) {
    var crumbs = getElements(layout.items);
    if (!crumbs.length) return;
    var last = crumbs[crumbs.length - 1];
    if (options.onlyActive) {
      crumbs.slice(0, -1).forEach(function (crumb) {
        crumb.remove();
      });
    } else {
      if (options.first && crumbs.length > 1) {
        var link = crumbs[0].tagName === "A" ? crumbs[0] : crumbs[0].querySelector("a");
        if (link) {
          if (options.first.url) link.setAttribute("href", options.first.url);
          if (options.first.label) (link.querySelector("span") || link).textContent = pickText(options.first.label);
        }
      }
      if (options.hideMiddle) {
        crumbs.slice(1, -1).forEach(function (crumb) {
          crumb.style.display = "none";
        });
      }
    }
    if (options.active) (last.querySelector("span") || last).textContent = pickText(options.active);
  });
  if (options.title) {
    document.title = pickText(options.title === true ? options.active : options.title);
  }
};

/* ============================ steps header ============================== */

DCDN.stepsHeader = function stepsHeader(steps, currentStep, options) {
  /**
   * Numbered steps strip for wizards: a dot per step, a tick on finished steps.
   *
   * @param {Array<{title:(string|{ar:string,en:string}), number?:number, url?:string}>} steps
   * @param {number} currentStep          `number` of the current step (or its 1-based position)
   * @param {Object} [options]
   * @param {string|Element} [options.target]   insert into this container (prepend)
   * @param {boolean} [options.links=false]     make finished steps clickable (needs step.url)
   * @returns {Element}                         the <ol class="dcdn-steps">
   *
   * Example:
   *   DCDN.stepsHeader([
   *     { number: 1, title: { ar: "الربط", en: "Connect" } },
   *     { number: 2, title: { ar: "الحسابات", en: "Accounts" } },
   *     { number: 4, title: { ar: "الإعدادات", en: "Settings" } },
   *   ], 2, { target: ".main-area > .container" });
   */
  options = options || {};
  ensureNativeStyles();
  var currentIndex = -1;
  steps.forEach(function (step, index) {
    if ((step.number != null ? step.number : index + 1) === currentStep) currentIndex = index;
  });
  var list = createElementFromHtml('<ol class="dcdn-steps"></ol>');
  steps.forEach(function (step, index) {
    var item = createElementFromHtml('<li class="dcdn-step"><span class="dcdn-step-number"></span><span class="dcdn-step-title"></span></li>');
    if (index === currentIndex) item.classList.add("is-current");
    if (index < currentIndex) item.classList.add("is-done");
    var number = item.querySelector(".dcdn-step-number");
    number.textContent = index < currentIndex ? "✓" : String(index + 1);
    var titleElement = item.querySelector(".dcdn-step-title");
    if (options.links && step.url && index < currentIndex) {
      titleElement.innerHTML = "<a></a>";
      titleElement.firstChild.href = step.url;
      titleElement.firstChild.textContent = pickText(step.title);
    } else {
      titleElement.textContent = pickText(step.title);
    }
    list.appendChild(item);
  });
  var target = getElement(options.target);
  if (target) target.insertBefore(list, target.firstChild);
  return list;
};

/* ======================== list buttons + add button ===================== */

var ADD_BUTTON_SELECTOR = '.pages-head-btns .add-new-btn, a[name="Add-Work-Flow"]';

DCDN.addListButton = function addListButton(options) {
  /**
   * Add a button to a list page's top bar, in Daftra's style, beside "Add".
   *
   * @param {Object} options
   * @param {string} options.id                               unique id (added once)
   * @param {string|{ar:string,en:string}} options.label      button text
   * @param {string} [options.icon="mdi-plus"]                mdi icon class
   * @param {string} [options.href="#"]                       link (ignored when onClick is given)
   * @param {function(Event, Element)} [options.onClick]      click handler
   * @param {string} [options.className="btn-secondary"]      extra classes
   * @param {string} [options.container=".pages-head-btns"]   bar selector
   * @returns {Element|null}                                  the button, null when the bar is missing
   *
   * Example:
   *   DCDN.addListButton({
   *     id: "refresh-accounts", icon: "mdi-refresh",
   *     label: { ar: "تحديث الحسابات", en: "Refresh Accounts" },
   *     onClick: function () { DCDN.noticeAfterReload("Done"); location.reload(); },
   *   });
   */
  options = options || {};
  var bar = document.querySelector(options.container || ".pages-head-btns");
  if (!bar) return null;
  var existing = bar.querySelector('[data-dcdn-button="' + options.id + '"]');
  if (existing) return existing;
  var button = createElementFromHtml('<a class="btn btn-touch btn-icon responsive dcdn-list-button"><i class="mdi"></i><span></span></a>');
  button.className += " " + (options.className || "btn-secondary");
  button.setAttribute("href", options.href || "#");
  button.setAttribute("data-dcdn-button", options.id || DCDN.uid("btn"));
  button.querySelector("i").classList.add(options.icon || "mdi-plus");
  button.querySelector("span").textContent = pickText(options.label);
  if (options.onClick) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      options.onClick(event, button);
    });
  }
  bar.appendChild(button);
  return button;
};

DCDN.hideEarly = function hideEarly(selector, id) {
  /**
   * Hide elements with CSS right away (even before Daftra paints them), so they never flash.
   * Call reveal() later to show them again.
   *
   * @param {string} selector        CSS selector to hide
   * @param {string} [id]            style id (default derived from the selector)
   * @returns {{reveal: Function, style: Element}}
   *
   * Example:
   *   var add = DCDN.raw.hideEarly('.pages-head-btns .add-new-btn, a[name="Add-Work-Flow"]');
   *   if (canAdd) add.reveal();
   */
  var styleId = id || "dcdn-hide-" + selector.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  var style = DCDN.injectCSS(selector + " { display: none !important; }", styleId);
  style.setAttribute("data-dcdn-hide-early", selector);
  return {
    style: style,
    reveal: function () {
      var element = document.getElementById(styleId);
      if (element) element.remove();
    },
  };
};

DCDN.hideElements = function hideElements(selectors, id) {
  /**
   * Hide elements permanently with one CSS rule (e.g. action buttons, a form field container).
   *
   * @param {string|string[]} selectors   one selector or a list
   * @param {string} [id]                 style id (added once)
   * @returns {Element}                   the <style>
   *
   * Example:
   *   DCDN.hideElements([
   *     '.btn-group[aria-label="item-actions-group"] a[href$="/edit"]',
   *     '.btn-group[aria-label="item-actions-group"] a[data-delete-prompt]',
   *   ], "hide-workflow-actions");
   */
  var list = Array.isArray(selectors) ? selectors : [selectors];
  // one rule per selector: an unsupported selector (e.g. :has in old browsers) can't break the others
  var css = list
    .map(function (selector) {
      return selector + " { display: none !important; }";
    })
    .join("\n");
  return DCDN.injectCSS(css, id || "dcdn-hide-" + DCDN.uid("x"));
};

DCDN.hideFormField = function hideFormField(fieldKey, entityKey) {
  /**
   * Hide a v2 form field (label + input) with CSS.
   *
   * @param {string} fieldKey             field key, e.g. "status"
   * @param {string} [entityKey]          entity key (default: from the current URL)
   * @returns {Element}                   the <style>
   *
   * Example:
   *   DCDN.hideFormField("status");
   *   DCDN.hideFormField("status", "le_workflow-type-entity-36");
   */
  var key = entityKey || DCDN.getPageInfo().entity;
  return DCDN.hideElements(
    [".container-" + key + "_custom_data-" + fieldKey, ".container-" + key + "-" + fieldKey, '[class*="col-lg-"]:has(> * [id$="--' + fieldKey + '"])'],
    "dcdn-hide-field-" + fieldKey
  );
};

DCDN.replaceAddButton = function replaceAddButton(options) {
  /**
   * Point the page's native "Add" button somewhere else and rename it
   * (works on the old theme .add-new-btn and the v4 theme a[name="Add-Work-Flow"]).
   *
   * @param {Object} options
   * @param {string} [options.href]                                new link
   * @param {string|{ar:string,en:string}} [options.label]         new text
   * @param {boolean} [options.reveal=true]                        remove a DCDN.hideEarly on the button
   * @returns {number}                                             how many buttons were changed
   *
   * Example:
   *   DCDN.replaceAddButton({ href: "/v2/owner/entity/app_609_add_delivery/create", label: { ar: "أضف أوامر توصيل", en: "Add Delivery Orders" } });
   */
  options = options || {};
  var buttons = getElements(ADD_BUTTON_SELECTOR);
  buttons.forEach(function (button) {
    if (options.href) button.setAttribute("href", options.href);
    if (options.label) {
      Array.prototype.slice.call(button.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue.trim()) node.remove();
      });
      var span = button.querySelector("span");
      if (!span) {
        span = document.createElement("span");
        button.appendChild(span);
      }
      span.textContent = pickText(options.label);
    }
  });
  if (options.reveal !== false) {
    // remove any DCDN.hideEarly rule that hides an add button
    getElements("style[data-dcdn-hide-early]").forEach(function (style) {
      if (/add-new-btn|Add-Work-Flow/.test(style.getAttribute("data-dcdn-hide-early"))) style.remove();
    });
  }
  return buttons.length;
};

DCDN.addSidebarLink = function addSidebarLink(options) {
  /**
   * Add (or replace) a link at the end of a sidebar group, in BOTH Daftra sidebar layouts
   * (classic .mn_xxx .sub-menu and v2 li[data-app-sidebar-list-item]). The link is a copy
   * of the group's last entry, so it looks like its neighbours. Retries while the sidebar is drawn.
   *
   * @param {Object} options
   * @param {string} options.id                                 unique id (an existing link with this id is replaced)
   * @param {string|{ar:string,en:string}} options.label        link text
   * @param {string} options.url                                link
   * @param {string} [options.classicGroup=".mn_dashboard"]     classic layout group selector
   * @param {number|string} [options.v2Group=1]                 v2 layout data-app-sidebar-list-item value
   * @param {number} [options.retryMs=10000]                    keep trying this long while the sidebar loads
   * @returns {Promise<boolean>}                                true when at least one link was added
   *
   * Example:
   *   DCDN.addSidebarLink({ id: "ntmp", label: { ar: "إعداد NTMP", en: "NTMP Setup" }, url: "/v2/owner/entity/app_924_rasd_settings/create" });
   */
  options = options || {};
  var id = options.id || "dcdn-link";
  function draw() {
    var classicItems = getElements((options.classicGroup || ".mn_dashboard") + " .sub-menu li").filter(function (li) {
      return !li.hasAttribute("data-dcdn-sidebar");
    });
    var v2Items = getElements('li.sidebar-list-item[data-app-sidebar-list-item="' + (options.v2Group == null ? 1 : options.v2Group) + '"] .sidebar-list-item-sublist-item').filter(function (li) {
      return !li.hasAttribute("data-dcdn-sidebar");
    });
    if (!classicItems.length && !v2Items.length) return false;
    getElements('[data-dcdn-sidebar="' + id + '"]').forEach(function (element) {
      element.remove();
    });
    [classicItems[classicItems.length - 1], v2Items[v2Items.length - 1]].forEach(function (last) {
      if (!last) return;
      var copy = last.cloneNode(true);
      copy.classList.remove("active");
      copy.setAttribute("data-dcdn-sidebar", id);
      var anchor = copy.querySelector("a");
      if (anchor) {
        anchor.classList.remove("active");
        anchor.setAttribute("href", options.url);
        var spans = anchor.querySelectorAll("span");
        (spans.length ? spans[spans.length - 1] : anchor).textContent = pickText(options.label);
      }
      last.parentNode.insertBefore(copy, last.nextSibling);
    });
    return true;
  }
  if (draw()) return Promise.resolve(true);
  return DCDN.waitFor(draw, { interval: 500, timeout: options.retryMs == null ? 10000 : options.retryMs })
    .then(function () {
      return true;
    })
    .catch(function () {
      return false;
    });
};

/* =============================== money ================================== */

function sameCurrency(symbol, position) {
  return { ar: { symbol: symbol, pos: position }, en: { symbol: symbol, pos: position } };
}
var SAR_SYMBOL_HTML = '<span class="sar_symbol">元&nbsp;</span>';

/**
 * Currency display rules: { CODE: { ar: { symbol, pos }, en: { symbol, pos } } }
 * pos = "prefix" (before the amount) | "suffix" (after). Add your own: DCDN.currencyFormats.XYZ = {...}
 */
DCDN.currencyFormats = {
  SAR: { ar: { symbol: SAR_SYMBOL_HTML, pos: "prefix" }, en: { symbol: SAR_SYMBOL_HTML, pos: "prefix" } },
  EGP: { ar: { symbol: "ج.م", pos: "suffix" }, en: { symbol: "L.E", pos: "suffix" } },
  AED: { ar: { symbol: "د.إ", pos: "suffix" }, en: { symbol: "AED", pos: "suffix" } },
  KWD: { ar: { symbol: "د.ك", pos: "suffix" }, en: { symbol: "KD", pos: "suffix" } },
  QAR: { ar: { symbol: "ر.ق", pos: "suffix" }, en: { symbol: "QR", pos: "suffix" } },
  OMR: { ar: { symbol: "ر.ع.", pos: "suffix" }, en: { symbol: "OMR", pos: "suffix" } },
  BHD: { ar: { symbol: "د.ب", pos: "suffix" }, en: { symbol: "BD", pos: "suffix" } },
  JOD: { ar: { symbol: "د.أ", pos: "suffix" }, en: { symbol: "JD", pos: "suffix" } },
  LBP: { ar: { symbol: "ل.ل", pos: "suffix" }, en: { symbol: "L.L.", pos: "suffix" } },
  MAD: { ar: { symbol: "د.م.", pos: "suffix" }, en: { symbol: "DH", pos: "suffix" } },
  TND: { ar: { symbol: "د.ت", pos: "suffix" }, en: { symbol: "DT", pos: "suffix" } },
  DZD: { ar: { symbol: "د.ج", pos: "suffix" }, en: { symbol: "DA", pos: "suffix" } },
  IQD: { ar: { symbol: "د.ع", pos: "suffix" }, en: { symbol: "ID", pos: "suffix" } },
  SYP: { ar: { symbol: "ل.س", pos: "suffix" }, en: { symbol: "SP", pos: "suffix" } },
  YER: { ar: { symbol: "ر.ي", pos: "suffix" }, en: { symbol: "YR", pos: "suffix" } },
  SDG: { ar: { symbol: "ج.س", pos: "suffix" }, en: { symbol: "SDG", pos: "suffix" } },
  LYD: { ar: { symbol: "د.ل", pos: "suffix" }, en: { symbol: "LD", pos: "suffix" } },
  MRU: { ar: { symbol: "أ.م", pos: "suffix" }, en: { symbol: "UM", pos: "suffix" } },
  KMF: { ar: { symbol: "ف.ق", pos: "suffix" }, en: { symbol: "CF", pos: "suffix" } },
  DJF: { ar: { symbol: "ف.ج", pos: "suffix" }, en: { symbol: "Fdj", pos: "suffix" } },
  SOS: { ar: { symbol: "ش.ص", pos: "suffix" }, en: { symbol: "Sh", pos: "suffix" } },
  TRY: { ar: { symbol: "ل.ت", pos: "suffix" }, en: { symbol: "₺", pos: "prefix" } },
};
[
  ["USD", "$", "prefix"], ["EUR", "€", "prefix"], ["GBP", "£", "prefix"], ["JPY", "¥", "prefix"], ["CNY", "¥", "prefix"],
  ["CHF", "CHF", "suffix"], ["CAD", "$", "prefix"], ["AUD", "$", "prefix"], ["NZD", "$", "prefix"], ["HKD", "$", "prefix"],
  ["SGD", "$", "prefix"], ["INR", "₹", "prefix"], ["PKR", "₨", "prefix"], ["BDT", "৳", "prefix"], ["LKR", "₨", "prefix"],
  ["NPR", "₨", "prefix"], ["MVR", "Rf", "prefix"], ["BTN", "Nu.", "prefix"], ["IDR", "Rp", "prefix"], ["MYR", "RM", "prefix"],
  ["THB", "฿", "suffix"], ["PHP", "₱", "prefix"], ["VND", "₫", "suffix"], ["MMK", "K", "suffix"], ["KHR", "៛", "suffix"],
  ["LAK", "₭", "suffix"], ["MNT", "₮", "suffix"], ["BND", "$", "prefix"], ["TWD", "NT$", "prefix"], ["MOP", "MOP$", "prefix"],
  ["KRW", "₩", "prefix"], ["KPW", "₩", "prefix"], ["NOK", "kr", "suffix"], ["SEK", "kr", "suffix"], ["DKK", "kr", "suffix"],
  ["ISK", "kr", "suffix"], ["PLN", "zł", "suffix"], ["CZK", "Kč", "suffix"], ["HUF", "Ft", "suffix"], ["RON", "lei", "suffix"],
  ["BGN", "лв", "suffix"], ["RSD", "дин.", "suffix"], ["BAM", "KM", "suffix"], ["MKD", "ден", "suffix"], ["ALL", "Lek", "suffix"],
  ["MDL", "L", "suffix"], ["BYN", "Br", "suffix"], ["UAH", "₴", "suffix"], ["GEL", "₾", "suffix"], ["AMD", "֏", "suffix"],
  ["AZN", "₼", "suffix"], ["RUB", "₽", "suffix"], ["ILS", "₪", "prefix"], ["MXN", "$", "prefix"], ["BRL", "R$", "prefix"],
  ["ARS", "$", "prefix"], ["CLP", "$", "prefix"], ["COP", "$", "prefix"], ["PEN", "S/", "prefix"], ["UYU", "$", "prefix"],
  ["BOB", "Bs.", "prefix"], ["PYG", "₲", "prefix"], ["VES", "Bs.", "prefix"], ["GTQ", "Q", "prefix"], ["HNL", "L", "prefix"],
  ["NIO", "C$", "prefix"], ["CRC", "₡", "prefix"], ["PAB", "B/.", "prefix"], ["DOP", "RD$", "prefix"], ["JMD", "J$", "prefix"],
  ["TTD", "TT$", "prefix"], ["BBD", "$", "prefix"], ["BSD", "$", "prefix"], ["BZD", "BZ$", "prefix"], ["BMD", "$", "prefix"],
  ["KYD", "$", "prefix"], ["XCD", "$", "prefix"], ["HTG", "G", "suffix"], ["CUP", "$", "prefix"], ["GYD", "$", "prefix"],
  ["SRD", "$", "prefix"], ["ZAR", "R", "prefix"], ["NAD", "N$", "prefix"], ["BWP", "P", "prefix"], ["LSL", "L", "suffix"],
  ["SZL", "L", "suffix"], ["MWK", "MK", "suffix"], ["ZMW", "ZK", "suffix"], ["KES", "KSh", "prefix"], ["TZS", "TSh", "prefix"],
  ["UGX", "USh", "prefix"], ["ETB", "Br", "suffix"], ["ERN", "Nfk", "suffix"], ["RWF", "FRw", "suffix"], ["BIF", "FBu", "suffix"],
  ["CDF", "FC", "suffix"], ["GNF", "FG", "suffix"], ["XOF", "CFA", "suffix"], ["XAF", "FCFA", "suffix"], ["GMD", "D", "suffix"],
  ["SLL", "Le", "suffix"], ["LRD", "$", "prefix"], ["CVE", "Esc", "suffix"], ["STN", "Db", "suffix"], ["AOA", "Kz", "suffix"],
  ["MGA", "Ar", "suffix"], ["MZN", "MT", "suffix"], ["GHS", "₵", "prefix"], ["NGN", "₦", "prefix"], ["FJD", "$", "prefix"],
  ["PGK", "K", "prefix"], ["WST", "WS$", "prefix"], ["TOP", "T$", "prefix"], ["SBD", "$", "prefix"], ["VUV", "VT", "suffix"],
  ["XPF", "F", "suffix"], ["KZT", "₸", "suffix"], ["UZS", "so'm", "suffix"], ["TJS", "SM", "suffix"], ["KGS", "som", "suffix"],
  ["TMT", "m", "suffix"], ["IRR", "Rial", "suffix"], ["AFN", "؋", "suffix"], ["FKP", "£", "prefix"], ["GIP", "£", "prefix"],
  ["SHP", "£", "prefix"], ["SSP", "SSP", "suffix"], ["XDR", "SDR", "suffix"],
].forEach(function (row) {
  DCDN.currencyFormats[row[0]] = sameCurrency(row[1], row[2]);
});

DCDN.formatCurrency = function formatCurrency(amount, currencyCode, options) {
  /**
   * Amount + currency symbol, placed before/after per currency and page language
   * (was formatCurrencyHtml). Unknown codes are shown after the amount ("123.00 XYZ").
   *
   * @param {number|string} amount                 number or text ("1,250.5")
   * @param {string} currencyCode                  ISO 4217 code, e.g. "SAR", "EGP", "USD"
   * @param {Object} [options]
   * @param {"ar"|"en"} [options.lang]             default page language
   * @param {number} [options.decimals=2]          fixed decimals
   * @param {boolean} [options.html=true]          false = plain text (SAR symbol HTML becomes "SAR")
   * @returns {string}                             e.g. "1,250.50 ج.م" or "$1,250.50"
   *
   * Examples:
   *   DCDN.formatCurrency(1250.5, "EGP")                  // "1,250.50 ج.م" on Arabic pages
   *   DCDN.formatCurrency(1250.5, "USD")                  // "$1,250.50"
   *   DCDN.formatCurrency("99", "SAR", { html: false })   // "SAR 99.00"
   */
  options = options || {};
  var decimals = options.decimals == null ? 2 : options.decimals;
  var number = DCDN.parseNumber(amount);
  var money = number.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  var lang = options.lang || DCDN.detectLang();
  var code = String(currencyCode || "").toUpperCase();
  var known = DCDN.currencyFormats[code];
  var format = known ? known[lang] || known.en : { symbol: code, pos: "suffix" };
  var symbol = format.symbol;
  if (options.html === false && /</.test(symbol)) symbol = code + " ";
  if (format.pos === "prefix") return symbol + money;
  return money + (symbol ? " " + symbol : "");
};

/* ============================= entity helpers =========================== */

DCDN.unwrapEntity = function unwrapEntity(response) {
  /**
   * Normalize a single-record v2 response: { payload: { data: {...} } } -> {...}
   * (any other shape is returned as is). DCDN.fetch already does this for you.
   *
   * @param {Object} response    raw response JSON
   * @returns {Object}           the record
   *
   * Example:
   *   DCDN.unwrapEntity({ payload: { data: { id: 5 } } })   // { id: 5 }
   */
  if (response && typeof response === "object" && response.payload && typeof response.payload === "object" &&
      response.payload.data && typeof response.payload.data === "object") {
    return response.payload.data;
  }
  return response;
};

var workflowTypeRequests = {};

DCDN.getWorkflowType = function getWorkflowType(name, options) {
  /**
   * Find a workflow type by its exact name ({ id, entity_key, name, ... }).
   * Cached per name for the page; failures are not cached.
   *
   * @param {string} name                     exact workflow name, e.g. "Customer Deliveries"
   * @param {Object} [options]
   * @param {boolean} [options.force=false]   ignore the cache
   * @returns {Promise<Object>}               the workflow_type record (rejects when not found)
   *
   * Example:
   *   const res = await DCDN.getWorkflowType("Customer Deliveries");
   *   res.data.entity_key                      // "le_workflow-type-entity-36"
   */
  options = options || {};
  if (!workflowTypeRequests[name] || options.force) {
    workflowTypeRequests[name] = DCDN.request("/v2/api/entity/workflow_type/list", { filters: { name: name } })
      .then(function (response) {
        var rows = getRows(response);
        if (!rows.length) throw new Error('Workflow type "' + name + '" not found');
        return rows[0];
      })
      .catch(function (error) {
        delete workflowTypeRequests[name];
        throw error;
      });
  }
  return workflowTypeRequests[name];
};

DCDN.getEntityKeyId = function getEntityKeyId(entityKeyOrType) {
  /**
   * The record id at the end of an entity key ("le_workflow-type-entity-36" -> "36"),
   * used by /workflow_type/{id}/show and /permissions URLs.
   *
   * @param {string|{entity_key:string}} entityKeyOrType   entity key or a workflow_type record
   * @returns {string|null}
   *
   * Example:
   *   DCDN.getEntityKeyId("le_workflow-type-entity-36")   // "36"
   */
  var key = typeof entityKeyOrType === "string" ? entityKeyOrType : entityKeyOrType && entityKeyOrType.entity_key;
  var match = /(\d+)$/.exec(key || "");
  return match ? match[1] : null;
};

DCDN.getFirstRecord = function getFirstRecord(entityKey, options) {
  /**
   * The first record of an entity (for single-record "settings" entities), or null when empty.
   *
   * @param {string} entityKey                e.g. "app_897_settings"
   * @param {Object} [options]
   * @param {Object} [options.filters]        same as DCDN.fetch
   * @param {number} [options.depth=1]        relation depth (list/{depth})
   * @returns {Promise<Object|null>}
   *
   * Example:
   *   const res = await DCDN.getFirstRecord("app_897_settings");
   *   if (res.data && res.data.child_pricing == 1) { ... }
   */
  options = options || {};
  return DCDN.request("/v2/api/entity/" + entityKey + "/list/" + (options.depth == null ? 1 : options.depth), {
    filters: options.filters,
    perPage: 1,
  }).then(function (response) {
    var rows = getRows(response);
    return rows.length ? rows[0] : null;
  });
};

DCDN.updateRecord = function updateRecord(entityKey, id, fields, options) {
  /**
   * PUT an update to a v2 record the safe way: the record's own `id` (and, for a child
   * entity, its parent-link field) is put in the BODY too — without it Daftra treats it as an insert.
   *
   * @param {string} entityKey
   * @param {number|string} id                                         record id
   * @param {Object} fields                                            fields to save
   * @param {Object} [options]
   * @param {{field:string, value:(number|string)}} [options.parentLink]  e.g. { field: "reference_id", value: visitId }
   * @returns {Promise<Object>}                                        the saved record
   *
   * Example:
   *   await DCDN.updateRecord("app_897_extend_823", 12, { status: "Playing" }, { parentLink: { field: "reference_id", value: 5 } });
   */
  options = options || {};
  var body = Object.assign({}, unwrapEnvelope(fields), { id: id });
  if (options.parentLink) body[options.parentLink.field] = options.parentLink.value;
  return DCDN.request("/v2/api/entity/" + entityKey + "/" + id, { method: "PUT", body: body }).then(function (response) {
    return extractResult(response, {});
  });
};

DCDN.subformKey = function subformKey(entityKey, subformField) {
  /**
   * The real (double-prefixed) key a SubForm is read/written under.
   *
   * @param {string} entityKey         e.g. "app_897_tariff"
   * @param {string} subformField      e.g. "price_condition"
   * @returns {string}                 "app_897_tariff_app_897_tariff_price_condition"
   *
   * Example:
   *   record[DCDN.raw.subformKey("app_897_tariff", "price_condition")]
   */
  return entityKey + "_" + entityKey + "_" + subformField;
};

DCDN.upsertSubformRows = function upsertSubformRows(entityKey, recordId, subformField, rows, options) {
  /**
   * Add / update SubForm rows WITHOUT wiping the rows you don't mention.
   * (A SubForm write replaces the whole array, so this reads the record first and sends
   * every existing row back, plus the record's other subforms untouched.)
   *
   * @param {string} entityKey                    owner entity key
   * @param {number|string} recordId              owner record id
   * @param {string} subformField                 subform field name (without prefixes)
   * @param {Object[]} rows                       rows WITH `id` update that row, rows WITHOUT `id` are added
   * @param {Object} [options]
   * @param {"merge"|"replace"} [options.mode="merge"]   "replace" = send exactly `rows` (deletes the others)
   * @param {{field:string, value:(number|string)}} [options.parentLink]  see DCDN.updateRecord
   * @returns {Promise<Object>}                   the saved owner record
   *
   * Example:
   *   await DCDN.upsertSubformRows("app_897_visit", 5, "resources_list", [{ resource: "3", calc_price_rate: 50 }]);
   */
  options = options || {};
  rows = unwrapEnvelope(rows) || [];
  var key = DCDN.subformKey(entityKey, subformField);
  return DCDN.request("/v2/api/entity/" + entityKey + "/" + recordId + "/1").then(function (response) {
    var record = extractResult(response, {}) || {};
    var finalRows;
    if (options.mode === "replace") {
      finalRows = rows;
    } else {
      var byId = {};
      rows.forEach(function (row) {
        if (row.id != null) byId[row.id] = row;
      });
      var existing = record[key] || [];
      finalRows = existing
        .map(function (row) {
          return row.id in byId ? Object.assign({}, row, byId[row.id]) : row;
        })
        .concat(rows.filter(function (row) {
          return row.id == null;
        }));
    }
    var body = {};
    body[key] = finalRows;
    var prefix = entityKey + "_" + entityKey + "_";
    Object.keys(record).forEach(function (field) {
      if (field !== key && field.indexOf(prefix) === 0 && Array.isArray(record[field])) body[field] = record[field];
    });
    return DCDN.updateRecord(entityKey, recordId, body, { parentLink: options.parentLink });
  });
};

DCDN.parseMultiValue = function parseMultiValue(value) {
  /**
   * Read a MultipleDropdown value (comma-separated text OR array) as an array of strings.
   *
   * @param {string|Array|null|undefined} value
   * @returns {string[]}
   *
   * Examples:
   *   DCDN.parseMultiValue("1, 2,3")    // ["1", "2", "3"]
   *   DCDN.parseMultiValue([4, 5])      // ["4", "5"]
   *   DCDN.parseMultiValue(null)        // []
   */
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === "") return [];
  return String(value)
    .split(",")
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);
};

/* =============================== page / time ============================= */

DCDN.getPageContext = function getPageContext() {
  /**
   * Who and where: site id, subdomain, domain and user, read from what Daftra puts on every page.
   *
   * @returns {{siteId:(string|null), subdomain:(string|null), domain:string, isDaftraDomain:boolean,
   *            userName:string, isOwner:boolean, staffId:(number|null), branchId:(number|null), roleId:(number|null)}}
   *
   * Example:
   *   DCDN.getPageContext().data.siteId     // "4245753"
   */
  var pageData = window.visitEvent || (window.dataLayer || []).filter(function (entry) {
    return entry && entry.site_id;
  })[0];
  var menuNumber = getElements("[data-copy-btn]")
    .map(function (element) {
      return element.getAttribute("data-copy-btn");
    })
    .filter(function (value) {
      return /^\d+$/.test(value);
    })[0];
  var siteId = String((pageData && pageData.site_id) || menuNumber || "");
  var host = location.hostname.match(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)\.(daftara|daftra)\.com$/i);
  var header = document.querySelector(".drop-cont .text-truncate, .header-user");
  var user = DCDN.getUser();
  var headerName = header ? header.textContent.trim().split("\n")[0].trim() : "";
  return {
    siteId: /^\d{1,12}$/.test(siteId) ? siteId : null,
    subdomain: host ? host[1] : null,
    domain: location.hostname,
    isDaftraDomain: !!host,
    userName: headerName || (DCDN.isOwner() ? "Owner" : "Staff #" + (user.staff_id != null ? user.staff_id : "")),
    isOwner: DCDN.isOwner(),
    staffId: user.staff_id != null ? Number(user.staff_id) : null,
    branchId: user.branch_id != null ? Number(user.branch_id) : null,
    roleId: user.role_id != null ? Number(user.role_id) : null,
  };
};

DCDN.nowInTimeZone = function nowInTimeZone(timeZone, date) {
  /**
   * Date and time in another time zone (e.g. to stamp records in Riyadh time).
   *
   * @param {string} [timeZone="Asia/Riyadh"]   IANA zone, e.g. "Africa/Cairo"
   * @param {Date|number|string} [date=now]
   * @returns {{date:string, time:string, dateTime:string}}   "YYYY-MM-DD", "HH:mm", "YYYY-MM-DD HH:mm:ss"
   *
   * Example:
   *   DCDN.nowInTimeZone("Asia/Riyadh").data   // { date: "2026-10-22", time: "14:05", dateTime: "2026-10-22 14:05:09" }
   */
  var formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  var parts = {};
  formatter.formatToParts(date ? new Date(date) : new Date()).forEach(function (part) {
    parts[part.type] = part.value;
  });
  var day = parts.year + "-" + parts.month + "-" + parts.day;
  var time = parts.hour + ":" + parts.minute;
  return { date: day, time: time, dateTime: day + " " + time + ":" + parts.second };
};

/** "YYYY-MM-DD..." or Date -> { y, m, d } without time-zone shifts. */
function parseDateParts(value) {
  if (value instanceof Date && !isNaN(value)) return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  var match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(value || "").trim());
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
}

DCDN.ageOnDate = function ageOnDate(dateOfBirth, onDate) {
  /**
   * Whole years between a birth date and another date (age on that day).
   *
   * @param {string|Date} dateOfBirth             "YYYY-MM-DD" or Date
   * @param {string|Date} [onDate=today]          "YYYY-MM-DD" or Date
   * @returns {number|null}                       null when a date is missing / invalid
   *
   * Example:
   *   DCDN.ageOnDate("2015-06-01", "2026-05-31")   // 10
   */
  var birth = parseDateParts(dateOfBirth);
  var on = parseDateParts(onDate || new Date());
  if (!birth || !on) return null;
  var age = on.y - birth.y;
  if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) age -= 1;
  return age >= 0 ? age : null;
};

var cachedRequests = {};

DCDN.cached = function cached(key, work, options) {
  /**
   * Run an async check once and reuse the answer: shared between callers on the page
   * (one request at a time) and, with `ttl`, kept in localStorage between pages.
   *
   * @param {string} key                      cache name
   * @param {function(): (Promise<*>|*)} work  produces the value
   * @param {Object} [options]
   * @param {number} [options.ttl=0]          ms to keep the answer in localStorage (0 = this page only)
   * @param {boolean} [options.force=false]   ignore the cache and run `work` again
   * @returns {Promise<*>}                    the value
   *
   * Example:
   *   const res = await DCDN.cached("setupDone", async () => {
   *     const settings = await DCDN.raw.getFirstRecord("app_924_rasd_settings");
   *     return !!settings && settings.status === "Connected";
   *   }, { ttl: 10 * 60 * 1000 });
   */
  options = options || {};
  var storageKey = "dcdn_cache_" + key;
  if (!options.force) {
    if (options.ttl) {
      try {
        var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (saved && Date.now() - saved.at < options.ttl) return Promise.resolve(saved.value);
      } catch (e) {}
    }
    if (cachedRequests[key]) return cachedRequests[key];
  }
  cachedRequests[key] = Promise.resolve()
    .then(function () {
      return unwrapEnvelope(work());
    })
    .then(function (value) {
      value = unwrapEnvelope(value);
      if (options.ttl) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ value: value, at: Date.now() }));
        } catch (e) {}
      }
      return value;
    })
    .catch(function (error) {
      delete cachedRequests[key];
      throw error;
    });
  return cachedRequests[key];
};

/* ============================ return redirects ========================== */

DCDN.setReturnUrl = function setReturnUrl(key, url) {
  /**
   * Remember where to send the user back after they create a record on another page
   * (e.g. "Add Vehicle" from a delivery form). Pair with DCDN.handleReturnRedirect on the target page.
   *
   * @param {string} key              storage key, e.g. "car_create_return"
   * @param {string} [url=current]    url to return to
   * @returns {boolean}               false when localStorage is blocked
   *
   * Example:
   *   DCDN.setReturnUrl("car_create_return");
   *   location.href = "/v2/owner/entity/app_609_car/create";
   */
  try {
    localStorage.setItem(key, url || location.href);
    return true;
  } catch (e) {
    return false;
  }
};

DCDN.handleReturnRedirect = function handleReturnRedirect(options) {
  /**
   * On the page reached after saving (usually the new record's show page): if a return url
   * was saved with DCDN.setReturnUrl, go back to it with the new record id as a URL parameter.
   *
   * @param {Object} options
   * @param {string} options.key                         same key as DCDN.setReturnUrl
   * @param {RegExp} options.pathPattern                 path pattern with the new id in group 1, e.g. /\/app_609_car\/(\d+)/
   * @param {string} options.param                       URL parameter for the id, e.g. "car_id"
   * @param {string|{ar:string,en:string}} [options.text]   loader text (default "Redirecting...")
   * @returns {boolean}                                  true when it redirects
   *
   * Example:
   *   DCDN.handleReturnRedirect({ key: "car_create_return", pathPattern: /\/app_609_car\/(\d+)/, param: "car_id" });
   */
  options = options || {};
  var returnUrl = null;
  try {
    returnUrl = localStorage.getItem(options.key);
  } catch (e) {}
  if (!returnUrl) return false;
  var match = location.pathname.match(options.pathPattern);
  if (!match) return false;
  try {
    localStorage.removeItem(options.key);
  } catch (e) {}
  var separator = returnUrl.indexOf("?") > -1 ? "&" : "?";
  DCDN.nativeLoader(true, options.text || { ar: "جاري التوجيه...", en: "Redirecting..." });
  location.replace(returnUrl + separator + options.param + "=" + encodeURIComponent(match[1]));
  return true;
};

/* Show a notice saved before the reload (runs once per page). */
DCDN.onReady(function () {
  DCDN.showPendingNotice();
});
