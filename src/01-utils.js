/* ==========================================================================
 * 01-utils.js
 * ----------------------------------------------------------------------------
 * General helpers found repeated across cs-daily code:
 * timing, numbers, dates, URL, waiting for DOM, loading scripts,
 * Daftra form fields, sidebar menu.
 * ======================================================================== */

/* ============================== timing =================================== */

DCDN.sleep = function sleep(milliseconds) {
  /**
   * Wait for some milliseconds (use with await).
   *
   * @param {number} milliseconds
   * @returns {Promise<void>}
   *
   * Example:
   *   await DCDN.sleep(500);
   */
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
};

DCDN.debounce = function debounce(callback, waitMs) {
  /**
   * Return a function that runs `callback` only after calls stop for `waitMs`.
   * Good for search inputs / resize / input events.
   *
   * @param {Function} callback
   * @param {number} [waitMs=250]
   * @returns {Function}   the debounced function
   *
   * Example:
   *   $("#search").on("input", DCDN.debounce(function () { search(this.value); }, 300));
   */
  var timer;
  return function () {
    var context = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, waitMs == null ? 250 : waitMs);
  };
};

DCDN.throttle = function throttle(callback, waitMs) {
  /**
   * Return a function that runs `callback` at most once every `waitMs`.
   *
   * @param {Function} callback
   * @param {number} [waitMs=250]
   * @returns {Function}   the throttled function
   *
   * Example:
   *   window.addEventListener("scroll", DCDN.throttle(onScroll, 200));
   */
  var lastRun = 0;
  return function () {
    var now = Date.now();
    if (now - lastRun >= (waitMs || 250)) {
      lastRun = now;
      return callback.apply(this, arguments);
    }
  };
};

DCDN.chunk = function chunk(array, size) {
  /**
   * Split an array into groups of `size`.
   *
   * @param {Array} array
   * @param {number} size          items per group
   * @returns {Array<Array>}
   *
   * Example:
   *   DCDN.chunk([1, 2, 3, 4, 5], 2)   // [[1, 2], [3, 4], [5]]
   */
  var groups = [];
  for (var i = 0; i < array.length; i += size) groups.push(array.slice(i, i + size));
  return groups;
};

DCDN.uid = function uid(prefix) {
  /**
   * Random unique id string.
   *
   * @param {string} [prefix="dcdn"]
   * @returns {string}
   *
   * Example:
   *   DCDN.uid("tab")   // "tab_k3j9x2a"
   */
  return (prefix || "dcdn") + "_" + Math.random().toString(36).slice(2, 9);
};

DCDN.escapeHtml = function escapeHtml(text) {
  /**
   * Escape text before putting it inside HTML (prevents broken markup / XSS).
   *
   * @param {*} text
   * @returns {string}
   *
   * Example:
   *   $("#box").html("<b>" + DCDN.escapeHtml(client.name) + "</b>");
   */
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/* ============================== numbers ================================== */

DCDN.toEnDigits = function toEnDigits(text) {
  /**
   * Convert Arabic-Indic (٠١٢) and Persian (۰۱۲) digits to 0-9.
   *
   * @param {*} text
   * @returns {string}
   *
   * Example:
   *   DCDN.toEnDigits("١٢٣٫٥")   // "123.5"
   */
  return String(text == null ? "" : text)
    .replace(/[٠-٩]/g, function (digit) {
      return digit.charCodeAt(0) - 0x0660;
    })
    .replace(/[۰-۹]/g, function (digit) {
      return digit.charCodeAt(0) - 0x06f0;
    })
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/٬/g, ","); // Arabic thousands separator
};

DCDN.parseNumber = function parseNumber(value) {
  /**
   * Read a number from any displayed amount (removes commas, currency, Arabic digits).
   * Replaces the many  parseFloat(x.replace(/,/g, ""))  /  removeCurr  snippets.
   *
   * @param {number|string} value      number or displayed text
   * @returns {number}                  0 when no number is found
   *
   * Examples:
   *   DCDN.parseNumber("1,250.50 ر.س")    // 1250.5
   *   DCDN.parseNumber("SR 99")            // 99
   *   DCDN.parseNumber("١٢٣")              // 123
   *   DCDN.parseNumber("(50.00)")          // -50
   *   DCDN.parseNumber("")                 // 0
   */
  value = unwrapEnvelope(value);
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  var text = DCDN.toEnDigits(value).replace(/,/g, "");
  var isNegative = /^\s*-|\(\s*[\d.]+\s*\)/.test(text);
  var match = text.match(/\d+(\.\d+)?|\.\d+/);
  if (!match) return 0;
  var number = parseFloat(match[0]);
  return isNegative ? -number : number;
};

DCDN.round = function round(number, decimals) {
  /**
   * Correct rounding (fixes 1.005 -> 1.01).
   *
   * @param {number|string} number
   * @param {number} [decimals=2]
   * @returns {number}
   *
   * Example:
   *   DCDN.round(1.005, 2)   // 1.01
   */
  var factor = Math.pow(10, decimals == null ? 2 : decimals);
  return Math.round((Number(number) + Number.EPSILON) * factor) / factor;
};

DCDN.formatNumber = function formatNumber(value, decimals, options) {
  /**
   * Format a number with thousands separators.
   *
   * @param {number|string} value              number or text
   * @param {number} [decimals]                 fixed decimals (omit = keep as is)
   * @param {Object} [options]
   * @param {string} [options.separator=","]    thousands separator
   * @param {string} [options.decimalPoint="."] decimal mark
   * @param {string} [options.prefix=""]        text before
   * @param {string} [options.suffix=""]        text after
   * @returns {string}
   *
   * Examples:
   *   DCDN.formatNumber(1250.5)                       // "1,250.5"
   *   DCDN.formatNumber(1250.5, 2)                    // "1,250.50"
   *   DCDN.formatNumber(1250.5, 2, { suffix: " ر.س" })  // "1,250.50 ر.س"
   */
  options = options || {};
  var number = DCDN.parseNumber(value);
  var text = decimals == null ? String(number) : DCDN.round(number, decimals).toFixed(decimals);
  var parts = text.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, options.separator == null ? "," : options.separator);
  return (options.prefix || "") + parts.join(options.decimalPoint || ".") + (options.suffix || "");
};

DCDN.addThousandSeparator = function addThousandSeparator(value) {
  /**
   * Old name kept for compatibility. Same as DCDN.formatNumber(value).
   *
   * @param {number|string} value
   * @returns {string}
   *
   * Example:
   *   DCDN.addThousandSeparator(1234567.5)   // "1,234,567.5"
   */
  return DCDN.formatNumber(value);
};

/* =============================== dates =================================== */

function padTwoDigits(number) {
  return (number < 10 ? "0" : "") + number;
}

DCDN.formatDate = function formatDate(date, format) {
  /**
   * Format a date. Tokens: YYYY MM DD HH mm ss
   *
   * @param {Date|number|string} [date=now]
   * @param {string} [format="YYYY-MM-DD"]      tokens: YYYY MM DD HH mm ss
   * @returns {string}                          "" for an invalid date
   *
   * Examples:
   *   DCDN.formatDate(new Date(), "YYYY-MM-DD")         // "2026-10-18"
   *   DCDN.formatDate("2026-01-05", "DD/MM/YYYY")       // "05/01/2026"
   *   DCDN.formatDate(Date.now(), "YYYY-MM-DD HH:mm:ss")
   */
  var dateObject = date instanceof Date ? date : new Date(date || Date.now());
  if (isNaN(dateObject)) return "";
  var tokens = {
    YYYY: dateObject.getFullYear(),
    MM: padTwoDigits(dateObject.getMonth() + 1),
    DD: padTwoDigits(dateObject.getDate()),
    HH: padTwoDigits(dateObject.getHours()),
    mm: padTwoDigits(dateObject.getMinutes()),
    ss: padTwoDigits(dateObject.getSeconds()),
  };
  return (format || "YYYY-MM-DD").replace(/YYYY|MM|DD|HH|mm|ss/g, function (token) {
    return tokens[token];
  });
};

DCDN.today = function today(format) {
  /**
   * Today's date as text.
   *
   * @param {string} [format="YYYY-MM-DD"]
   * @returns {string}
   *
   * Examples:
   *   DCDN.today()                  // "2026-10-18"
   *   DCDN.today("DD/MM/YYYY")      // "18/10/2026"
   */
  return DCDN.formatDate(new Date(), format);
};

DCDN.addDays = function addDays(date, days, format) {
  /**
   * Add (or subtract) days. Returns a Date, or text when `format` is given.
   *
   * @param {Date|number|string} [date=now]
   * @param {number} days                       negative = subtract
   * @param {string} [format]                   give it to get text instead of a Date
   * @returns {Date|string}
   *
   * Examples:
   *   DCDN.addDays(new Date(), 7)                   // Date object, next week
   *   DCDN.addDays("2026-10-01", -1, "YYYY-MM-DD")  // "2026-09-30"
   */
  var result = new Date(date || Date.now());
  result.setDate(result.getDate() + Number(days || 0));
  return format ? DCDN.formatDate(result, format) : result;
};

/* ================================ URL ==================================== */

DCDN.getUrlParam = function getUrlParam(name, url) {
  /**
   * Read a query-string parameter.
   *
   * @param {string} name
   * @param {string} [url=current page]
   * @returns {string|null}
   *
   * Example (url ...?client_id=5):
   *   DCDN.getUrlParam("client_id")   // "5"
   */
  try {
    return new URL(url || location.href).searchParams.get(name);
  } catch (e) {
    return null;
  }
};

DCDN.getRecordId = function getRecordId(url) {
  /**
   * The record id of the current view / show / edit page
   * (= last number in the URL path).
   *
   * @param {string} [url=current page]
   * @returns {number|null}
   *
   * Examples:
   *   /owner/invoices/view/123                -> 123
   *   /v2/owner/entity/le_projects/15/show    -> 15
   *   DCDN.getRecordId()                      // current page
   */
  var path = new URL(url || location.href, location.origin).pathname;
  var numbers = path.split("/").filter(function (segment) {
    return /^\d+$/.test(segment);
  });
  return numbers.length ? Number(numbers[numbers.length - 1]) : null;
};

DCDN.getPageInfo = function getPageInfo(url) {
  /**
   * Describe the current Daftra page from its URL.
   *
   * @param {string} [url=current page]
   * @returns {{path:string, isV2:boolean, id:(number|null), entity?:string, workflow?:boolean, controller?:string, action:string}}
   *
   * Examples:
   *   /v2/owner/entity/le_x/15/show  -> { isV2: true,  entity: "le_x", action: "show", id: 15 }
   *   /owner/invoices/view/123       -> { isV2: false, controller: "invoices", action: "view", id: 123 }
   */
  var parsed = new URL(url || location.href, location.origin);
  var segments = parsed.pathname.split("/").filter(Boolean);
  var info = { path: parsed.pathname, isV2: segments[0] === "v2", id: DCDN.getRecordId(parsed.href) };
  if (info.isV2) {
    // /v2/owner/entity/{key}/...   /v2/owner/entity/workflow/{key}/...   /v2/owner/future-entity/workflow/{key}/...
    var entityIndex = segments.indexOf("entity");
    if (entityIndex === -1) entityIndex = segments.indexOf("future-entity");
    var keyIndex = entityIndex > -1 ? entityIndex + 1 : 2;
    if (segments[keyIndex] === "workflow") {
      info.workflow = true;
      keyIndex++;
    }
    info.entity = segments[keyIndex];
    info.action = segments[segments.length - 1];
  } else {
    var ownerIndex = segments.indexOf("owner");
    info.controller = segments[ownerIndex + 1];
    info.action = segments[ownerIndex + 2] || "index";
  }
  return info;
};

/* ================================ DOM ==================================== */

DCDN.onReady = function onReady(callback) {
  /**
   * Run `callback` when the DOM is ready (runs immediately if already ready).
   *
   * @param {Function} callback
   * @returns {void}
   *
   * Example:
   *   DCDN.onReady(function () { DCDN.toast("ready"); });
   */
  if (document.readyState !== "loading") callback();
  else document.addEventListener("DOMContentLoaded", callback);
};

DCDN.waitForElement = function waitForElement(selector, options) {
  /**
   * Wait until an element exists in the page, then resolve with it.
   * Uses MutationObserver (no setInterval loops).
   *
   * @param {string} selector
   * @param {Object} [options]
   * @param {number} [options.timeout=15000]       ms (0 = forever)
   * @param {Element|Document} [options.root=document]
   * @returns {Promise<Element>}                   rejects on timeout
   *
   * Examples:
   *   const res = await DCDN.waitForElement("#InvoiceForm");
   *   res.success      // false on timeout
   *   res.data         // "<form#InvoiceForm>"  (JSON text)
   *   res.element      // the real element
   *
   *   DCDN.waitForElement(".invoice-actions", { timeout: 5000 }).then(res => { if (res.success) $(res.element).append(btn); });
   */
  options = options || {};
  var root = options.root || document;
  var timeout = options.timeout == null ? 15000 : options.timeout;

  return new Promise(function (resolve, reject) {
    var existing = root.querySelector(selector);
    if (existing) return resolve(existing);

    var timer;
    var observer = new MutationObserver(function () {
      var element = root.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(element);
      }
    });
    observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });

    if (timeout) {
      timer = setTimeout(function () {
        observer.disconnect();
        reject(new Error("waitForElement timeout: " + selector));
      }, timeout);
    }
  });
};

DCDN.waitFor = function waitFor(condition, options) {
  /**
   * Check `condition()` every `interval` ms until it returns something truthy.
   * Replaces the  setInterval(() => { if (...) clearInterval(...) })  pattern.
   *
   * @param {function():*} condition               resolves with its first truthy value
   * @param {Object} [options]
   * @param {number} [options.interval=100]        ms between checks
   * @param {number} [options.timeout=15000]       ms (0 = forever)
   * @returns {Promise<*>}
   *
   * Examples:
   *   await DCDN.waitFor(() => $("body").hasClass("custom_app"));
   *   const res = await DCDN.waitFor(() => $("#city")[0].selectize);
   *   res.data   // the selectize instance
   */
  options = options || {};
  var interval = options.interval || 100;
  var timeout = options.timeout == null ? 15000 : options.timeout;
  var startedAt = Date.now();

  return new Promise(function (resolve, reject) {
    (function check() {
      var value;
      try {
        value = condition();
      } catch (e) {
        value = false;
      }
      if (value) return resolve(value);
      if (timeout && Date.now() - startedAt > timeout) return reject(new Error("waitFor timeout"));
      setTimeout(check, interval);
    })();
  });
};

DCDN.onElement = function onElement(selector, callback, options) {
  /**
   * Run `callback(element)` once for every element matching `selector`,
   * now AND for elements added later (e.g. new subform rows).
   *
   * @param {string} selector
   * @param {function(Element):void} callback      runs once per element
   * @param {Object} [options]
   * @param {Element} [options.root=document]      where to watch
   * @returns {{stop:Function}}
   *
   * Example:
   *   DCDN.onElement('[id$="--qty"]', function (input) {
   *     input.style.background = "#fffbe6";
   *   });
   */
  options = options || {};
  var markKey = "dcdnSeen" + DCDN.uid("").slice(1);

  function scan() {
    getElements(selector, options.root).forEach(function (element) {
      if (element.dataset[markKey]) return; // already handled
      element.dataset[markKey] = "1";
      try {
        callback(element);
      } catch (error) {
        warnLog("onElement callback error", error);
      }
    });
  }

  scan();
  var observer = new MutationObserver(DCDN.debounce(scan, 50));
  observer.observe(options.root || document.documentElement, { childList: true, subtree: true });
  return {
    stop: function () {
      observer.disconnect();
    },
  };
};

var loadedScripts = {};

DCDN.loadScript = function loadScript(src, options) {
  /**
   * Load an external script once (cached). Returns a Promise.
   *
   * @param {string} src
   * @param {Object} [options]
   * @param {string} [options.id]                  id of the <script>
   * @param {function():boolean} [options.test]    return true to skip loading (already on the page)
   * @returns {Promise<void>}
   *
   * Example:
   *   await DCDN.loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
   *                         { test: () => window.XLSX });
   */
  options = options || {};
  if (loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise(function (resolve, reject) {
    if (options.test && options.test()) return resolve();
    var script = document.createElement("script");
    script.src = src;
    script.async = true;
    if (options.id) script.id = options.id;
    script.onload = function () {
      resolve();
    };
    script.onerror = function () {
      delete loadedScripts[src];
      reject(new Error("failed to load " + src));
    };
    document.head.appendChild(script);
  });
  return loadedScripts[src];
};

DCDN.loadStyle = function loadStyle(href) {
  /**
   * Load an external stylesheet once.
   *
   * @param {string} href
   * @returns {Promise<void>}
   *
   * Example:
   *   DCDN.loadStyle("https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css");
   */
  if (document.querySelector('link[href="' + href + '"]')) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = function () {
      resolve();
    };
    link.onerror = reject;
    document.head.appendChild(link);
  });
};

DCDN.injectCSS = function injectCSS(cssText, id) {
  /**
   * Add a <style> tag. With an id it is added only once.
   *
   * @param {string} cssText
   * @param {string} [id]          added once per id
   * @returns {HTMLStyleElement}
   *
   * Example:
   *   DCDN.injectCSS(".invoice-actions .btn { border-radius: 8px }", "my-app-css");
   */
  if (id && document.getElementById(id)) return document.getElementById(id);
  var style = document.createElement("style");
  if (id) style.id = id;
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
  return style;
};

DCDN.copyToClipboard = function copyToClipboard(text) {
  /**
   * Copy text to the clipboard. Returns a Promise.
   *
   * @param {string} text
   * @returns {Promise<void>}
   *
   * Example:
   *   DCDN.copyToClipboard(invoiceLink).then(() => DCDN.toast("Copied"));
   */
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  var textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  return Promise.resolve();
};

DCDN.triggerEnter = function triggerEnter(target) {
  /**
   * Simulate pressing Enter on an input
   * (used to trigger Daftra's barcode / serial number lookups).
   *
   * @param {string|Element} target   input selector / element
   * @returns {void}
   *
   * Example:
   *   $(".item-serial input").val("SN-001");
   *   DCDN.triggerEnter(".item-serial input");
   */
  var element = getElement(target);
  if (!element) return;
  ["keydown", "keypress", "keyup"].forEach(function (type) {
    element.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  });
  if (window.jQuery) {
    window.jQuery(element).trigger(window.jQuery.Event("keydown", { which: 13, keyCode: 13 }));
    window.jQuery(element).trigger(window.jQuery.Event("keyup", { which: 13, keyCode: 13 }));
  }
};

/* ========================= Daftra page context =========================== */

DCDN.getUser = function getUser() {
  /**
   * The logged-in user object Daftra puts on the page (window.USER).
   *
   * @returns {{staff_id?:(number|string), branch_id?:(number|string), is_owner?:(number|boolean), role_id?:(number|string)}}  window.USER
   *
   * Example:
   *   DCDN.getUser().data.staff_id     // 0 = owner
   *   DCDN.getUser().data.branch_id
   */
  return window.USER || {};
};

DCDN.isOwner = function isOwner() {
  /**
   * true when the logged-in user is the account owner.
   *
   * @returns {boolean}
   *
   * Example:
   *   if (!DCDN.isOwner().data) $(".delete-btn").hide();
   */
  var user = DCDN.getUser();
  return !!(Number(user.is_owner) || Number(user.staff_id) === 0);
};

DCDN.getCsrfToken = function getCsrfToken() {
  /**
   * CSRF token of the page (sent automatically by DCDN.post / put / del).
   *
   * @returns {string}   "" when the page has none
   *
   * Example:
   *   $.ajaxSetup({ headers: { "X-CSRF-Token": DCDN.getCsrfToken() } });
   */
  var meta = document.querySelector('meta[name="csrf-token"]');
  var input = document.querySelector('input[name="_csrfToken"]') || document.querySelector('input[name="data[_Token][key]"]');
  return (meta && meta.getAttribute("content")) || (input && input.value) || "";
};

DCDN.field = function field(key, root) {
  /**
   * Find a v2 form field by its key.
   * Looks for  [id$="--key"]  then  [name$="[key]"]  then  #key.
   *
   * @param {string} key                 field key, e.g. "qty"
   * @param {Element|Document} [root=document]
   * @returns {Element|null}
   *
   * Examples:
   *   DCDN.field("discountvalue")            // <input id="data-le_x--discountvalue">
   *   DCDN.field("qty", rowElement)          // inside one subform row
   */
  root = root || document;
  return (
    root.querySelector('[id$="--' + key + '"]') ||
    root.querySelector('[name$="[' + key + ']"]') ||
    root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(key) : key))
  );
};

DCDN.fields = function fields(key, root) {
  /**
   * All fields with this key (e.g. the same field in every subform row).
   *
   * @param {string} key
   * @param {Element|Document} [root=document]
   * @returns {Element[]}
   *
   * Example:
   *   DCDN.fields("qty").elements.forEach(input => console.log(input.value));
   *   DCDN.fields("qty").data   // ["<input#data-le_x--qty>", ...]
   */
  return getElements('[id$="--' + key + '"]', root);
};

DCDN.getFieldValue = function getFieldValue(target) {
  /**
   * Read a field value. Works with selectize, select2, checkbox and normal inputs.
   *
   * @param {string|Element} target     field key, selector or element
   * @returns {string|string[]|boolean|null}   selectize value / checkbox state / input value
   *
   * Examples:
   *   DCDN.getFieldValue("qty")              // by field key
   *   DCDN.getFieldValue("#ClientCity")      // by selector
   */
  var element = typeof target === "string" ? getElement(target) || DCDN.field(target) : getElement(target);
  if (!element) return null;
  if (element.selectize) return element.selectize.getValue();
  if (element.type === "checkbox" || element.type === "radio") return element.checked;
  return element.value;
};

DCDN.setFieldValue = function setFieldValue(target, value, text) {
  /**
   * Set a field value AND fire change, so Daftra recalculates.
   * Works with selectize, select2, plain selects (adds the option if missing) and inputs.
   *
   * @param {string|Element} target     field key, selector or element
   * @param {*} value
   * @param {string} [text]             option text when a select needs a new option
   * @returns {boolean}                 false when the field was not found
   *
   * Examples:
   *   DCDN.setFieldValue("qty", 5);
   *   DCDN.setFieldValue("#data-le_custom_data_client--city", 9, "Riyadh");
   */
  var element = typeof target === "string" ? getElement(target) || DCDN.field(target) : getElement(target);
  if (!element) return false;

  if (element.selectize) {
    var selectize = element.selectize;
    if (!selectize.options[value]) selectize.addOption({ value: value, text: text != null ? text : value });
    selectize.setValue(value);
    return true;
  }

  var optionExists =
    element.tagName === "SELECT" &&
    Array.prototype.some.call(element.options, function (option) {
      return option.value == value;
    });
  if (element.tagName === "SELECT" && !optionExists) {
    element.add(new Option(text != null ? text : value, value, true, true));
  }

  if (element.type === "checkbox" || element.type === "radio") element.checked = !!value;
  else element.value = value;

  if (window.jQuery && window.jQuery(element).data("select2")) window.jQuery(element).trigger("change");
  else triggerEvents(element);
  return true;
};

DCDN.addMenuItem = function addMenuItem(options) {
  /**
   * Add a link inside a sidebar sub-menu (was addNewItemInSubMenu).
   * The new item is a clone of the first item, so it keeps Daftra's style.
   *
   * @param {Object} options
   * @param {string} [options.parent]                 parent menu selector, e.g. ".mn_inventory"
   * @param {number|string} [options.sidebarId]       data-app-sidebar-list-item id (fallback)
   * @param {string} options.url                      link
   * @param {string|{ar:string,en:string}} options.title
   * @param {number} [options.after=last]             insert after this item index
   * @returns {Element|null}                          the new <li>
   *
   * Example:
   *   DCDN.addMenuItem({
   *     parent: ".mn_inventory", sidebarId: 36,
   *     url: "/v2/owner/entity/le_service_packages/list",
   *     title: { ar: "إدارة الباقات", en: "Manage Packages" },
   *     after: 0,
   *   });
   */
  var parent =
    getElement(options.parent) ||
    (options.sidebarId != null && document.querySelector('li[data-app-sidebar-list-item="' + options.sidebarId + '"]'));
  if (!parent) return null;

  var list = parent.querySelector("ul");
  if (!list || !list.children.length) return null;

  var alreadyAdded = list.querySelector('a[href="' + options.url + '"]');
  if (alreadyAdded) return alreadyAdded.closest("li");

  var newItem = list.children[0].cloneNode(true);
  newItem.classList.remove("active");
  var link = newItem.querySelector("a");
  link.setAttribute("href", options.url);
  (link.querySelector("span") || link).textContent = pickText(options.title);

  var afterIndex = options.after == null ? list.children.length - 1 : Math.min(options.after, list.children.length - 1);
  var reference = list.children[afterIndex];
  reference.parentNode.insertBefore(newItem, reference.nextSibling);
  return newItem;
};
