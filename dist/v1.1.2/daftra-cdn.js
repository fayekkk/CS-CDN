/*!
 * Daftra CDN v1.1.2 — reusable functions & components for Daftra page codes
 * Global: window.DCDN (alias window.DaftraCDN)
 * Docs in the console: DCDN.help()  or  DCDN.help("addDropdown")
 * Built: 2026-10-18T13:07:05.582Z
 */
(function (factory) {
  // Resolve the real browser global, even when pasted in DevTools or loaded by a bundler
  var g =
    (typeof window !== "undefined" && window.document && window) ||
    (typeof self !== "undefined" && self.document && self) ||
    (typeof globalThis !== "undefined" && globalThis.document && globalThis) ||
    null;
  if (!g) {
    // no page document: Node / worker / wrong DevTools console context
    if (typeof module === "object" && module && module.exports) module.exports = factory;
    else if (typeof console !== "undefined")
      console.warn('[DCDN] {"event":"no page document","hint":"In DevTools choose the top context in the console dropdown, then paste again"}');
    return;
  }
  // Several apps may include the CDN on the same page: load once, but a NEWER
  // version always replaces an older one that was loaded first.
  var NEW_VERSION = "1.1.2";
  function isNewer(a, b) {
    var x = String(a).split("."), y = String(b).split(".");
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0;
    }
    return false;
  }
  var existing = g.DCDN && g.DCDN.version;
  if (!existing || isNewer(NEW_VERSION, existing)) {
    if (existing && typeof console !== "undefined") console.info('[DCDN] {"event":"replacing older version","from":"' + existing + '","to":"' + NEW_VERSION + '"}');
    g.DCDN = g.DaftraCDN = factory(g);
  }
  if (typeof module === "object" && module && module.exports) module.exports = g.DCDN;
})(function (window) {
  "use strict";
  var document = window.document;
  var VERSION = "1.1.2";
  var DCDN = {};

/* ---- 00-core.js ---- */
/* ==========================================================================
 * 00-core.js
 * ----------------------------------------------------------------------------
 * The DCDN namespace, the global configuration, and small private helpers
 * used by every other file.
 *
 * TIP (console):
 *   DCDN.help()                 -> JSON list of every public function
 *   DCDN.help("addDropdown")    -> JSON docs + examples of one function
 *   DCDN.addDropdown            -> print the function itself (docs are inside)
 * ======================================================================== */

DCDN.version = VERSION;

/**
 * Global configuration object.
 * Read it with  DCDN.config  and change it with  DCDN.configure({...}).
 */
DCDN.config = {
  apiKey: null, // only needed when calling Daftra from OUTSIDE a Daftra page
  baseUrl: "", // e.g. "https://mysite.daftra.com" when used outside Daftra
  retries: 3, // how many times a failed request is retried (network / 5xx / 429)
  retryDelay: 600, // ms before the first retry, doubled each time
  perPage: 100, // default page size used by bulkFetch
  concurrency: 4, // how many requests bulkFetch / bulkPost run at the same time
  lang: null, // force "ar" or "en" (otherwise detected from the page)
  siteInfoKey: "site_info", // localStorage key shared with the old apps
  autoResetSiteInfo: true, // clear cached site_info when /settings is saved
  zIndex: 1000000, // z-index used by loader / popup / toast
  primaryColor: "#1877f2", // color of progress bars and primary buttons
  debug: false, // true -> log every request in the console
};

DCDN.configure = function configure(newOptions) {
  /**
   * Change the global configuration (merges with the current values).
   *
   * @param  {Object} newOptions  any key of DCDN.config
   * @return {Object}             the full config after the change
   *
   * Examples:
   *   DCDN.configure({ debug: true })               // log every request
   *   DCDN.configure({ lang: "en" })                // force English UI texts
   *   DCDN.configure({ retries: 5, perPage: 200 })
   */
  if (newOptions) {
    for (var key in newOptions) {
      if (hasOwn(newOptions, key)) DCDN.config[key] = newOptions[key];
    }
  }
  return DCDN.config;
};

/* --------------------------------------------------------------------------
 * Private helpers (not part of the public API)
 * ------------------------------------------------------------------------ */

/** Safe hasOwnProperty. */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Make any value safe for JSON console output:
 * DOM elements -> "<input#id.class>", Errors -> { name, message, status }, functions -> "function name".
 */
function toPlainValue(value, depth) {
  depth = depth || 0;
  if (value == null || typeof value !== "object") {
    return typeof value === "function" ? "function " + (value.name || "anonymous") : value;
  }
  if (value.nodeType === 1) {
    return "<" + value.tagName.toLowerCase() + (value.id ? "#" + value.id : "") +
      (typeof value.className === "string" && value.className.trim() ? "." + value.className.trim().split(/\s+/).join(".") : "") + ">";
  }
  if (value.nodeType) return "<" + value.nodeName + ">";
  if (value.jquery) return { jquery: Array.prototype.map.call(value, function (el) { return toPlainValue(el); }) };
  if (value instanceof Error) return { name: value.name, message: value.message, status: value.status };
  if (depth > 4) return "[...]";
  if (Array.isArray(value)) return value.map(function (item) { return toPlainValue(item, depth + 1); });
  var plain = {};
  Object.keys(value).forEach(function (key) {
    plain[key] = toPlainValue(value[key], depth + 1);
  });
  return plain;
}

/** One JSON line in the console:  [DCDN] {"event":"...", ...} */
function toJsonLine(event, details) {
  var payload = { event: event };
  if (details !== undefined) payload.details = toPlainValue(details);
  try {
    return "[DCDN] " + JSON.stringify(payload);
  } catch (e) {
    return "[DCDN] " + JSON.stringify({ event: event, details: String(details) });
  }
}

/** console.log only when DCDN.config.debug is true (JSON, no styles). */
function debugLog(event, details) {
  if (!DCDN.config.debug) return;
  console.log(toJsonLine(event, details));
}

/** console.warn (always shown, JSON, no styles). */
function warnLog(event, details) {
  console.warn(toJsonLine(event, details));
}

/**
 * Turn "selector" | Element | jQuery object  into ONE DOM element (or null).
 *   getElement("#total")        -> <input id="total">
 *   getElement($("#total"))     -> <input id="total">
 */
function getElement(target, root) {
  if (!target) return null;
  if (typeof target === "string") return (root || document).querySelector(target);
  if (target.jquery) return target[0] || null;
  if (target.nodeType) return target;
  if (target.length && target[0] && target[0].nodeType) return target[0];
  return null;
}

/**
 * Turn "selector" | Element | NodeList | jQuery object  into an ARRAY of elements.
 *   getElements(".item-row")  -> [tr, tr, tr]
 */
function getElements(target, root) {
  if (!target) return [];
  if (typeof target === "string") {
    return Array.prototype.slice.call((root || document).querySelectorAll(target));
  }
  if (target.nodeType) return [target];
  if (target.jquery || typeof target.length === "number") {
    return Array.prototype.slice.call(target).filter(function (node) {
      return node && node.nodeType;
    });
  }
  return [];
}

/**
 * Create a DOM element from an HTML string (returns the first element).
 *   createElementFromHtml('<div class="x">hi</div>')  -> <div class="x">
 */
function createElementFromHtml(html) {
  var template = document.createElement("template");
  template.innerHTML = String(html).trim();
  return template.content.firstElementChild;
}

/**
 * Fire native DOM events on an element so Daftra's own listeners react.
 * Native events also reach jQuery `.on()` handlers.
 *   triggerEvents(input)                 -> fires "input" then "change"
 *   triggerEvents(select, ["change"])    -> fires only "change"
 */
function triggerEvents(element, eventNames) {
  if (!element) return;
  (eventNames || ["input", "change"]).forEach(function (eventName) {
    var event;
    try {
      event = new Event(eventName, { bubbles: true });
    } catch (e) {
      // very old browsers
      event = document.createEvent("Event");
      event.initEvent(eventName, true, true);
    }
    element.dispatchEvent(event);
  });
}

/**
 * Pick the text for the current page language.
 * Accepts: "plain text" | { ar: "...", en: "..." } | ["ar text", "en text"]
 *   pickText({ ar: "حفظ", en: "Save" })  -> "Save" on English pages
 */
function pickText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  var lang = DCDN.detectLang ? DCDN.detectLang() : "ar";
  if (Array.isArray(value)) return lang === "en" ? value[1] : value[0];
  if (value[lang] != null) return value[lang];
  if (value.ar != null) return value.ar;
  return value.en || "";
}

/**
 * Run `worker(item, index)` for every item, with at most `limit` running at once.
 * Results keep the same order as the input.
 *   runWithConcurrency([1,2,3], 2, id => DCDN.fetch("/x/" + id))
 */
function runWithConcurrency(items, limit, worker) {
  var results = new Array(items.length);
  var nextIndex = 0;
  limit = Math.max(1, limit || 1);

  function startNext() {
    if (nextIndex >= items.length) return Promise.resolve();
    var index = nextIndex++;
    return Promise.resolve()
      .then(function () {
        return worker(items[index], index);
      })
      .then(function (result) {
        results[index] = result;
      })
      .then(startNext);
  }

  var runners = [];
  for (var i = 0; i < Math.min(limit, items.length); i++) runners.push(startNext());
  return Promise.all(runners).then(function () {
    return results;
  });
}

/** Exposed for advanced use / debugging only. */
DCDN._internal = {
  getElement: getElement,
  getElements: getElements,
  createElementFromHtml: createElementFromHtml,
  triggerEvents: triggerEvents,
  pickText: pickText,
  runWithConcurrency: runWithConcurrency,
  debugLog: debugLog,
  toPlainValue: toPlainValue,
};

/* --------------------------------------------------------------------------
 * DCDN.help()  — documentation in the console
 * ------------------------------------------------------------------------ */

/** Read the first /** ... *\/ comment written inside a function body. */
function readDocComment(fn) {
  var source = Function.prototype.toString.call(fn);
  var match = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) return "";
  return match[1]
    .split("\n")
    .map(function (line) {
      return line.replace(/^\s*\* ?/, "");
    })
    .join("\n")
    .trim();
}

DCDN.help = function help(functionName) {
  /**
   * Print documentation in the console as JSON (and return it).
   *
   * Examples:
   *   DCDN.help()                  // { functions: [{ function, description }, ...] }
   *   DCDN.help("bulkFetch")       // { function: "DCDN.bulkFetch", docs: [lines...] }
   *   DCDN.help("storage.set")     // nested functions work too
   */
  if (functionName) {
    var name = String(functionName).replace(/^DCDN\./, "");
    var fn = name.split(".").reduce(function (object, key) {
      return object == null ? object : object[key];
    }, DCDN);
    if (typeof fn !== "function") {
      var notFound = { error: "'" + functionName + "' is not a DCDN function", hint: "Run DCDN.help() for the list" };
      console.warn(JSON.stringify(notFound, null, 2));
      return notFound;
    }
    var docs = { function: "DCDN." + name, docs: (readDocComment(fn) || "(no docs)").split("\n") };
    console.log(JSON.stringify(docs, null, 2));
    return docs;
  }

  var rows = [];
  function collect(object, prefix) {
    Object.keys(object).forEach(function (key) {
      if (key.charAt(0) === "_") return;
      var value = object[key];
      if (typeof value === "function") {
        var firstLine = (readDocComment(value).split("\n")[0] || "").trim();
        rows.push({ function: prefix + key, description: firstLine });
      }
      if (value && typeof value === "object" && (key === "storage" || key === "table")) collect(value, prefix + key + ".");
      if (typeof value === "function" && key === "toast") {
        ["success", "error", "warning", "info"].forEach(function (type) {
          if (value[type]) rows.push({ function: prefix + "toast." + type, description: "Shortcut for DCDN.toast(message, '" + type + "')" });
        });
      }
    });
  }
  collect(DCDN, "DCDN.");
  var list = { functions: rows, details: 'DCDN.help("functionName")' };
  console.log(JSON.stringify(list, null, 2));
  return list;
};


/* ---- 01-utils.js ---- */
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
   * Example:
   *   DCDN.uid("tab")   // "tab_k3j9x2a"
   */
  return (prefix || "dcdn") + "_" + Math.random().toString(36).slice(2, 9);
};

DCDN.escapeHtml = function escapeHtml(text) {
  /**
   * Escape text before putting it inside HTML (prevents broken markup / XSS).
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
   * Examples:
   *   DCDN.parseNumber("1,250.50 ر.س")    // 1250.5
   *   DCDN.parseNumber("SR 99")            // 99
   *   DCDN.parseNumber("١٢٣")              // 123
   *   DCDN.parseNumber("(50.00)")          // -50
   *   DCDN.parseNumber("")                 // 0
   */
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
   * @param value     number or text ("1250.5", "1,250.5 SR")
   * @param decimals  fixed decimals (optional)
   * @param options   { separator: ",", decimalPoint: ".", prefix: "", suffix: "" }
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
   * Examples:
   *   /v2/owner/entity/le_x/15/show  -> { isV2: true,  entity: "le_x", action: "show", id: 15 }
   *   /owner/invoices/view/123       -> { isV2: false, controller: "invoices", action: "view", id: 123 }
   */
  var parsed = new URL(url || location.href, location.origin);
  var segments = parsed.pathname.split("/").filter(Boolean);
  var info = { path: parsed.pathname, isV2: segments[0] === "v2", id: DCDN.getRecordId(parsed.href) };
  if (info.isV2) {
    var entityIndex = segments.indexOf("entity");
    info.entity = entityIndex > -1 ? segments[entityIndex + 1] : segments[2];
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
   * @param selector  CSS selector
   * @param options   { timeout: 15000 (ms, 0 = forever), root: document }
   * @return Promise<Element>   (rejects on timeout)
   *
   * Examples:
   *   const form = await DCDN.waitForElement("#InvoiceForm");
   *   DCDN.waitForElement(".invoice-actions", { timeout: 5000 }).then(bar => { ... });
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
   * @param options  { interval: 100, timeout: 15000 }
   *
   * Examples:
   *   await DCDN.waitFor(() => $("body").hasClass("custom_app"));
   *   const selectize = await DCDN.waitFor(() => $("#city")[0].selectize);
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
   * @return { stop() }   call stop() to stop watching
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
   * @param options  { id, test: () => boolean (skip if it returns true) }
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
   * Example:
   *   DCDN.getUser().staff_id     // 0 = owner
   *   DCDN.getUser().branch_id
   */
  return window.USER || {};
};

DCDN.isOwner = function isOwner() {
  /**
   * true when the logged-in user is the account owner.
   *
   * Example:
   *   if (!DCDN.isOwner()) $(".delete-btn").hide();
   */
  var user = DCDN.getUser();
  return !!(Number(user.is_owner) || Number(user.staff_id) === 0);
};

DCDN.getCsrfToken = function getCsrfToken() {
  /**
   * CSRF token of the page (sent automatically by DCDN.post / put / del).
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
   * Example:
   *   DCDN.fields("qty").forEach(input => console.log(input.value));
   */
  return getElements('[id$="--' + key + '"]', root);
};

DCDN.getFieldValue = function getFieldValue(target) {
  /**
   * Read a field value. Works with selectize, select2, checkbox and normal inputs.
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
   * @param target  field key | selector | element
   * @param value   new value
   * @param text    option text (for selects when the option does not exist yet)
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
   * @param options {
   *   parent:    selector of the parent menu  (e.g. ".mn_inventory", ".mn_pos_sessions")
   *   sidebarId: data-app-sidebar-list-item id (fallback when parent class is missing)
   *   url:       link url
   *   title:     text or { ar, en }
   *   after:     index of the item to insert after (default: last)
   * }
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


/* ---- 02-api.js ---- */
/* ==========================================================================
 * 02-api.js
 * ----------------------------------------------------------------------------
 * Requests: fetch, bulkFetch, post, put, del, bulkPost, uploadFile, entity.
 *
 * Works with both Daftra APIs:
 *   v2  : /v2/api/entity/{entity}/list/1?filter[x]=..&per_page=..&page=..
 *         response -> { data: [...], last_page, total, current_page }
 *   api2: /api2/invoices?limit=..&page=..
 *         response -> { data: [...], pagination: { page_count, total_results } }
 * ======================================================================== */

DCDN.buildQuery = function buildQuery(params) {
  /**
   * Turn a nested object into Daftra's bracket query string.
   * null values become a key without value (needed for is_null filters).
   *
   * Examples:
   *   DCDN.buildQuery({ filter: { client_id: 5 } })
   *     // "filter[client_id]=5"
   *   DCDN.buildQuery({ filter: { name: { like: "abc" }, branch_id: { in: [1, 2] } } })
   *     // "filter[name][like]=abc&filter[branch_id][in][]=1&filter[branch_id][in][]=2"
   *   DCDN.buildQuery({ filter: { follow_up_status: { is_null: null } } })
   *     // "filter[follow_up_status][is_null]"
   */
  var parts = [];

  function encodeKey(key) {
    // keep [ ] readable, Daftra accepts them raw
    return encodeURIComponent(key).replace(/%5B/g, "[").replace(/%5D/g, "]");
  }

  function addValue(prefix, value) {
    if (value === undefined) return;
    if (value === null) return parts.push(encodeKey(prefix));
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        addValue(prefix + "[]", item);
      });
    } else if (typeof value === "object" && !(value instanceof Date)) {
      Object.keys(value).forEach(function (key) {
        addValue(prefix ? prefix + "[" + key + "]" : key, value[key]);
      });
    } else {
      var text = value instanceof Date ? DCDN.formatDate(value) : value;
      parts.push(encodeKey(prefix) + "=" + encodeURIComponent(text));
    }
  }

  addValue("", params || {});
  return parts.join("&");
};

/** true for /api2/ urls (they use `limit`), false for v2 urls (they use `per_page`). */
function isApi2Url(url) {
  return /\/api2\//.test(url);
}

DCDN.buildUrl = function buildUrl(url, options) {
  /**
   * Build the final request url from url + options.
   * Used by every request function — you rarely need it directly.
   *
   * @param options { params, filters, sort, page, perPage }
   *
   * Example:
   *   DCDN.buildUrl("/v2/api/entity/invoice/list/1", { filters: { client_id: 5 }, perPage: 50 })
   *   // "/v2/api/entity/invoice/list/1?filter[client_id]=5&per_page=50"
   */
  options = options || {};
  var query = {};
  if (options.params) {
    for (var key in options.params) query[key] = options.params[key];
  }
  if (options.filters) query.filter = options.filters;
  if (options.sort) query.sort = options.sort;
  if (options.page != null) query.page = options.page;
  if (options.perPage != null) query[isApi2Url(url) ? "limit" : "per_page"] = options.perPage;

  var queryString = DCDN.buildQuery(query);
  var fullUrl = /^https?:\/\//.test(url) ? url : (DCDN.config.baseUrl || "") + url;
  if (!queryString) return fullUrl;
  return fullUrl + (fullUrl.indexOf("?") > -1 ? "&" : "?") + queryString;
};

/** Error object thrown by every request: err.status, err.data, err.message */
function createDaftraError(message, status, data) {
  var error = new Error(message);
  error.name = "DaftraError";
  error.status = status;
  error.data = data;
  return error;
}

DCDN.request = function request(url, options) {
  /**
   * The core request used by fetch / post / put / del. Retries automatically.
   *
   * - JSON body is stringified and Content-Type is set for you.
   * - X-CSRF-Token is added to POST / PUT / PATCH / DELETE.
   * - Retries network errors, 5xx and 429 (DCDN.config.retries times, delay doubles).
   * - Throws a DaftraError when HTTP fails OR the response has result: "failed".
   *
   * @param options {
   *   method:  "GET" | "POST" | "PUT" | "PATCH" | "DELETE"   (default GET)
   *   body:    object | FormData | string
   *   params, filters, sort, page, perPage   -> query string (see DCDN.buildUrl)
   *   headers: extra headers
   *   retries: override DCDN.config.retries
   *   raw:     true -> return the raw Response instead of JSON
   *   signal:  AbortController signal
   * }
   *
   * Example:
   *   DCDN.request("/v2/api/entity/le_x/5", { method: "PATCH", body: { status: 1 } })
   *     .then(res => console.log(res))
   *     .catch(err => console.log(err.status, err.data));
   */
  options = options || {};
  var method = (options.method || "GET").toUpperCase();
  var maxRetries = options.retries == null ? DCDN.config.retries : options.retries;
  var finalUrl = DCDN.buildUrl(url, options);

  // X-Requested-With: same header jQuery sends, some Daftra endpoints expect it
  var headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  if (DCDN.config.apiKey) headers.apikey = DCDN.config.apiKey;

  var body = options.body;
  if (body != null && !(body instanceof FormData) && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  } else if (typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET") {
    var csrfToken = DCDN.getCsrfToken();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  }
  if (options.headers) {
    for (var name in options.headers) headers[name] = options.headers[name];
  }

  var attempt = 0;

  function sendOnce() {
    attempt++;
    return fetch(finalUrl, {
      method: method,
      headers: headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      credentials: "same-origin",
      signal: options.signal,
    })
      .then(function (response) {
        if (options.raw) return response;
        return response.text().then(function (text) {
          var data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = text; // not JSON (e.g. HTML page)
          }
          if (!response.ok) {
            var message = (data && (data.message || data.error)) || "Request failed (" + response.status + ")";
            throw createDaftraError(message, response.status, data);
          }
          if (data && data.result === "failed") {
            throw createDaftraError(data.message || "Daftra returned failed", response.status, data);
          }
          return data;
        });
      })
      .catch(function (error) {
        var canRetry = !error.status || error.status >= 500 || error.status === 429;
        if (error.name === "AbortError" || !canRetry || attempt > maxRetries) throw error;
        debugLog("retry", { attempt: attempt, method: method, url: finalUrl, error: error.message });
        return DCDN.sleep(DCDN.config.retryDelay * Math.pow(2, attempt - 1)).then(sendOnce);
      });
  }

  debugLog("request", { method: method, url: finalUrl });
  return sendOnce();
};

/* ================== auto results: unwrap + loader + toast + callbacks ================== */

/** Total rows / pages / current page of a list response (v2 or api2). */
function readListMeta(response, perPage) {
  var pagination = (response && (response.pagination || response.meta)) || {};
  var total = response.total != null ? response.total : pagination.total_results != null ? pagination.total_results : pagination.total;
  return {
    total: total != null ? Number(total) : null,
    pages: getPageCount(response, perPage),
    page: Number(response.current_page || pagination.page || 1),
  };
}

/**
 * api2 rows are wrapped by model name: { Invoice: {...}, Client: {...} }.
 *   unwrap: "Invoice" -> row.Invoice
 *   unwrap: true / auto -> unwrap only when the row has ONE object key ({ Client: {...} })
 *   unwrap: false -> keep as is
 */
function unwrapModel(row, unwrap) {
  if (!row || typeof row !== "object" || Array.isArray(row) || unwrap === false) return row;
  if (typeof unwrap === "string") return row[unwrap] !== undefined ? row[unwrap] : row;
  var keys = Object.keys(row);
  if (keys.length === 1 && /^[A-Z]/.test(keys[0]) && row[keys[0]] && typeof row[keys[0]] === "object") return row[keys[0]];
  return row;
}

/**
 * Turn a raw Daftra response into the useful result:
 *   list   { data: [...] }        -> the rows array (+ rows.meta = { total, pages, page, response })
 *   single { data: {...} }        -> the record object
 *   v2 record { id, ... }         -> itself
 * options.full = true            -> the raw response untouched
 */
function extractResult(response, options) {
  options = options || {};
  if (options.full || !response || typeof response !== "object") return response;

  if (Array.isArray(response.data)) {
    var rows = response.data.map(function (row) {
      return unwrapModel(row, options.unwrap);
    });
    var meta = readListMeta(response, options.perPage);
    meta.response = response;
    // non-enumerable: rows still behaves like a normal array
    Object.defineProperty(rows, "meta", { value: meta, enumerable: false });
    return rows;
  }
  if (response.data && typeof response.data === "object") return unwrapModel(response.data, options.unwrap);
  return response;
}

/**
 * Shared extras for fetch / post / put / patch / del / bulkFetch / bulkPost:
 * loader, success / error toast, callbacks, silent mode.
 */
function runWithExtras(work, options, defaultLoaderText) {
  options = options || {};
  if (options.loader) DCDN.showLoader(options.loader === true ? defaultLoaderText : options.loader);

  return Promise.resolve()
    .then(work)
    .then(function (result) {
      if (options.successMessage) DCDN.toast(options.successMessage, "success");
      if (options.onSuccess) options.onSuccess(result);
      return result;
    })
    .catch(function (error) {
      if (options.errorMessage) {
        var text = options.errorMessage === true ? error.message : pickText(options.errorMessage) + (error.message ? " — " + error.message : "");
        DCDN.toast(text, "error");
      }
      if (options.onError) options.onError(error);
      if (options.silent || options.onError) return options.fallback === undefined ? null : options.fallback;
      throw error;
    })
    .finally(function () {
      if (options.loader) DCDN.hideLoader();
      if (options.onComplete) options.onComplete();
    });
}

/*
 * Options shared by DCDN.fetch / get / post / put / patch / del
 * ---------------------------------------------------------------------------
 *   filters, sort, params, page, perPage   query string (see DCDN.buildUrl)
 *   full:           true  -> return the raw response instead of the result
 *   unwrap:         "Invoice" | true | false   api2 model unwrapping (default: auto)
 *   loader:         true | "text" | { ar, en }  full-screen loader while it runs
 *   successMessage: "text" | { ar, en }  success toast
 *   errorMessage:   true (show error) | "text" | { ar, en }  error toast
 *   onSuccess:      (result) => {}      callback style (no await needed)
 *   onError:        (error) => {}       error is handled -> the promise resolves with `fallback`
 *   onComplete:     () => {}            always runs at the end
 *   silent:         true -> never throws, resolves `fallback` (default null) on error
 *   fallback:       value returned on error in silent / onError mode (e.g. [])
 *   headers, retries, signal
 */

DCDN.fetch = function fetchOne(url, options) {
  /**
   * GET one endpoint and return the RESULT directly (no res.data digging):
   *   list url    -> array of rows       (rows.meta = { total, pages, page, response })
   *   record url  -> the record object
   *   full: true  -> the raw response
   * Add  all: true  to get EVERY page (same as DCDN.fetchAll).
   *
   * Options: filters, sort, params, page, perPage, all, full, unwrap,
   *          loader, successMessage, errorMessage, onSuccess, onError, onComplete, silent, fallback
   *
   * Examples:
   *   // await style
   *   const clients = await DCDN.fetch("/v2/api/entity/client/list/1", { filters: { category: "VIP" } });
   *   clients.length          // rows of page 1
   *   clients.meta.total      // total rows on the server
   *
   *   const allClients = await DCDN.fetch("/v2/api/entity/client/list/1", { all: true, loader: true });
   *
   *   const invoice = await DCDN.fetch("/v2/api/entity/invoice/" + DCDN.getRecordId() + "/1");
   *   invoice.no
   *
   *   const invoices = await DCDN.fetch("/api2/invoices", { unwrap: "Invoice", perPage: 20 });
   *   invoices[0].id          // instead of res.data[0].Invoice.id
   *
   *   const site = await DCDN.fetch("/api2/site_info");   // the Site object (auto-unwrapped): site.currency_code
   *
   *   // callback style (no await)
   *   DCDN.fetch("/v2/api/entity/staff/list/1", {
   *     loader: "جاري التحميل...",
   *     errorMessage: true,
   *     onSuccess: function (staff) { console.log(staff); },
   *   });
   *
   *   // never throws, [] on error
   *   const rows = await DCDN.fetch(url, { silent: true, fallback: [] });
   *
   *   // raw response
   *   const raw = await DCDN.fetch("/api2/invoices", { full: true });
   *   raw.pagination.total_results
   */
  options = options || {};
  if (options.all) return DCDN.bulkFetch(url, options);
  return runWithExtras(
    function () {
      return DCDN.request(url, Object.assign({}, options, { method: "GET" })).then(function (response) {
        return extractResult(response, options);
      });
    },
    options,
    { ar: "جاري التحميل...", en: "Loading..." }
  );
};
DCDN.get = DCDN.fetch;

/** Shared body for post / put / patch / del. */
function sendWithMethod(method, url, body, options) {
  options = options || {};
  return runWithExtras(
    function () {
      return DCDN.request(url, Object.assign({}, options, { method: method, body: body })).then(function (response) {
        return extractResult(response, options);
      });
    },
    options,
    { ar: "جاري الحفظ...", en: "Saving..." }
  );
}

DCDN.post = function post(url, body, options) {
  /**
   * POST a JSON body and return the RESULT directly
   * (the created record, or what the server returns).
   *
   * Options: loader, successMessage, errorMessage, onSuccess, onError, onComplete,
   *          silent, fallback, full, unwrap, headers, retries
   *
   * Examples:
   *   const created = await DCDN.post("/v2/api/entity/le_invoice-items",
   *     { invoice_id: 15, item_status: "Not Assigned" },
   *     { loader: true, successMessage: "تم الحفظ", errorMessage: true });
   *   created.id
   *
   *   // update fields of a v2 record
   *   await DCDN.post("/v2/api/entity/invoice/15/fields", { follow_up_status: 3 });
   *
   *   // callback style
   *   DCDN.post(url, body, {
   *     onSuccess: function (record) { location.reload(); },
   *     onError:   function (err) { DCDN.toast(err.message, "error"); },
   *   });
   *
   *   // api2 create invoice -> unwrap the Invoice object
   *   const invoice = await DCDN.post("/api2/invoices", { Invoice: {...}, InvoiceItem: [...] }, { unwrap: "Invoice" });
   */
  return sendWithMethod((options && options.method) || "POST", url, body, options);
};

DCDN.put = function put(url, body, options) {
  /**
   * PUT a JSON body (full update). Returns the result. Same options as DCDN.post.
   *
   * Example:
   *   await DCDN.put("/v2/api/entity/app_367_package/3", { name: "Gold" }, { successMessage: "تم التعديل" });
   */
  return sendWithMethod("PUT", url, body, options);
};

DCDN.patch = function patch(url, body, options) {
  /**
   * PATCH a JSON body (partial update). Returns the result. Same options as DCDN.post.
   *
   * Example:
   *   await DCDN.patch("/v2/api/entity/le_x/3", { status: 1 });
   */
  return sendWithMethod("PATCH", url, body, options);
};

DCDN.del = function del(url, options) {
  /**
   * DELETE a record. Returns the result. Same options as DCDN.post.
   *
   * Example:
   *   if (await DCDN.confirm("Delete?", { danger: true })) {
   *     await DCDN.del("/v2/api/entity/le_x/3", { successMessage: "تم الحذف", errorMessage: true });
   *   }
   */
  return sendWithMethod("DELETE", url, undefined, options);
};
DCDN["delete"] = DCDN.del;

/** Number of pages in a list response (works for v2 and api2 shapes). */
function getPageCount(response, perPage) {
  if (!response || typeof response !== "object") return 1;
  if (response.last_page) return Number(response.last_page); // v2
  var pagination = response.pagination || response.meta; // api2
  if (pagination) {
    if (pagination.page_count) return Number(pagination.page_count);
    if (pagination.last_page) return Number(pagination.last_page);
    var total = pagination.total_results || pagination.total;
    var limit = pagination.limit || pagination.per_page || perPage;
    if (total && limit) return Math.ceil(total / limit);
  }
  if (response.total && (response.per_page || perPage)) {
    return Math.ceil(response.total / (response.per_page || perPage));
  }
  return 1;
}

/** Rows array of a list response. */
function getRows(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  return [];
}

DCDN.bulkFetch = function bulkFetch(url, options) {
  /**
   * Fetch MANY things in one call and return the RESULTS directly. Three ways:
   *
   * 1) ALL pages of a list (pages are requested in parallel, then merged):
   *      const products = await DCDN.fetchAll("/v2/api/entity/product/list/1", {
   *        filters: { "category.name": "extras" },
   *        perPage: 100,
   *        progress: true,              // shows a progress bar
   *      });
   *      products.length                // every row of every page
   *      products.meta.total            // total reported by the server
   *
   *    api2 rows are wrapped by model name -> `unwrap`:
   *      const invoices = await DCDN.fetchAll("/api2/invoices", { unwrap: "Invoice" });
   *      // [{ id, no, ... }]  instead of [{ Invoice: {...}, InvoiceItem: [...] }]
   *
   * 2) Many records by id (url template with {id}) -> array of records:
   *      const invoices = await DCDN.fetchAll("/v2/api/entity/invoice/{id}/1", { ids: [10, 11, 12] });
   *
   * 3) A list of urls -> array of results (same order):
   *      const [site, staff] = await DCDN.fetchAll(["/api2/site_info", "/v2/api/entity/staff/list/1"]);
   *      site.currency_code;   staff.length
   *
   * @param options {
   *   filters, sort, params, perPage   -> same as DCDN.fetch
   *   ids:          array of ids for mode 2
   *   maxPages:     stop after N pages
   *   concurrency:  parallel requests (default DCDN.config.concurrency = 4)
   *   unwrap:       "Invoice" | true | false  (api2 model unwrapping, default auto)
   *   progress:     true | "title"  -> progress bar
   *   onProgress:   (done, total) => {}
   *   stopOnError:  modes 2/3 — reject on first error (default: keep going,
   *                 failed items become { __error: Error })
   *   loader, successMessage, errorMessage, onSuccess, onError, onComplete, silent, fallback
   *                 -> same as DCDN.fetch
   * }
   * @return Promise<Array>
   *
   * Callback style:
   *   DCDN.fetchAll("/v2/api/entity/client/list/1", {
   *     progress: "تحميل العملاء",
   *     onSuccess: function (clients) { DCDN.toast(clients.length + " clients"); },
   *     errorMessage: true,
   *   });
   */
  options = options || {};
  var concurrency = options.concurrency || DCDN.config.concurrency;

  var progressBar = null;
  function reportProgress(done, total) {
    if (progressBar) progressBar.update(done, total);
    if (options.onProgress) options.onProgress(done, total);
  }

  function work() {
    if (options.progress) {
      progressBar = DCDN.progressBar({
        title: typeof options.progress === "string" ? options.progress : pickText({ ar: "جاري التحميل...", en: "Loading..." }),
      });
    }
    var job = Array.isArray(url) || options.ids ? fetchManyUrls() : fetchAllPages();
    return job.then(
      function (result) {
        if (progressBar) progressBar.done();
        return result;
      },
      function (error) {
        if (progressBar) progressBar.remove();
        throw error;
      }
    );
  }

  /* ---- modes 2 and 3: many urls ---- */
  function fetchManyUrls() {
    var urls = Array.isArray(url)
      ? url
      : options.ids.map(function (id) {
          return url.replace(/\{id\}/g, id);
        });
    var finishedCount = 0;

    return runWithConcurrency(urls, concurrency, function (oneUrl) {
      return DCDN.request(oneUrl, { method: "GET", params: options.params, filters: options.filters })
        .then(function (response) {
          return extractResult(response, { unwrap: options.unwrap });
        })
        .catch(function (error) {
          if (options.stopOnError) throw error;
          return { __error: error };
        })
        .then(function (result) {
          finishedCount++;
          reportProgress(finishedCount, urls.length);
          return result;
        });
    });
  }

  /* ---- mode 1: all pages of one list ---- */
  function fetchAllPages() {
    var perPage = options.perPage || DCDN.config.perPage;
    var pageOptions = { method: "GET", filters: options.filters, sort: options.sort, params: options.params, perPage: perPage };

    return DCDN.request(url, Object.assign({ page: 1 }, pageOptions)).then(function (firstPage) {
      var totalPages = getPageCount(firstPage, perPage);
      if (options.maxPages) totalPages = Math.min(totalPages, options.maxPages);
      reportProgress(1, totalPages);

      var remainingPages = [];
      for (var page = 2; page <= totalPages; page++) remainingPages.push(page);

      var finishedPages = 1;
      return runWithConcurrency(remainingPages, concurrency, function (page) {
        return DCDN.request(url, Object.assign({}, pageOptions, { page: page })).then(function (response) {
          finishedPages++;
          reportProgress(finishedPages, totalPages);
          return getRows(response);
        });
      }).then(function (otherPagesRows) {
        var allRows = getRows(firstPage);
        otherPagesRows.forEach(function (rows) {
          allRows = allRows.concat(rows);
        });
        allRows = allRows.map(function (row) {
          return unwrapModel(row, options.unwrap);
        });
        var meta = readListMeta(firstPage, perPage);
        meta.fetchedPages = totalPages;
        meta.firstResponse = firstPage;
        Object.defineProperty(allRows, "meta", { value: meta, enumerable: false });
        return allRows;
      });
    });
  }

  return runWithExtras(work, options, { ar: "جاري التحميل...", en: "Loading..." });
};
DCDN.fetchAll = DCDN.bulkFetch;

DCDN.bulkPost = function bulkPost(url, items, options) {
  /**
   * Send MANY records (POST by default) with limited parallel requests.
   * One failure does not stop the others (unless stopOnError: true).
   *
   * @param url      string, or (item, index) => url   (different url per item)
   * @param items    array of bodies
   * @param options {
   *   method:      "POST" (default) | "PUT" | "PATCH"
   *   concurrency: parallel requests (default 3)
   *   delay:       ms to wait after each request (to be gentle with the server)
   *   transform:   (item, index) => body     (build the body from the item)
   *   stopOnError: true -> skip the remaining items after the first error
   *   progress:    true | "title"  -> progress bar
   *   onProgress:  (done, total, result) => {}
   *   loader, successMessage, errorMessage, onSuccess, onComplete -> same as DCDN.fetch
   * }
   * @return Promise<{ results, success, failed }>
   *         each result = { item, ok, data } or { item, ok: false, error }
   *         (data = the result, already unwrapped like DCDN.post)
   *
   * Examples:
   *   const res = await DCDN.bulkPost("/v2/api/entity/le_invoice-items", items, { progress: true });
   *   console.log(res.success.length, "saved", res.failed.length, "failed");
   *
   *   // update many invoice items, one url per item
   *   await DCDN.bulkPost(
   *     row => "/v2/api/entity/invoice_item/" + row.id + "/fields",
   *     rows,
   *     { transform: row => ({ status: 1 }), concurrency: 2, delay: 100 }
   *   );
   */
  options = options || {};
  items = items || [];
  return runWithExtras(function () {
    return sendMany(url, items, options);
  }, options, { ar: "جاري الحفظ...", en: "Saving..." });
};

/** The real work of bulkPost. */
function sendMany(url, items, options) {
  var concurrency = options.concurrency || Math.min(3, DCDN.config.concurrency);
  var method = options.method || "POST";
  var progressBar = options.progress
    ? DCDN.progressBar({
        title: typeof options.progress === "string" ? options.progress : pickText({ ar: "جاري الحفظ...", en: "Saving..." }),
        total: items.length,
      })
    : null;
  var finishedCount = 0;
  var stopped = false;

  return runWithConcurrency(items, concurrency, function (item, index) {
    if (stopped) return { item: item, ok: false, skipped: true };

    var itemUrl = typeof url === "function" ? url(item, index) : url;
    var body = options.transform ? options.transform(item, index) : item;

    return DCDN.request(itemUrl, { method: method, body: body })
      .then(function (response) {
        return { item: item, ok: true, data: extractResult(response, options) };
      })
      .catch(function (error) {
        if (options.stopOnError) stopped = true;
        return { item: item, ok: false, error: error };
      })
      .then(function (result) {
        finishedCount++;
        if (progressBar) progressBar.update(finishedCount, items.length);
        if (options.onProgress) options.onProgress(finishedCount, items.length, result);
        if (!options.delay) return result;
        return DCDN.sleep(options.delay).then(function () {
          return result;
        });
      });
  }).then(function (results) {
    var failed = results.filter(function (result) {
      return !result.ok && !result.skipped;
    });
    if (progressBar) progressBar.done(failed.length ? pickText({ ar: "تم مع وجود أخطاء", en: "Done with errors" }) : null);
    return {
      results: results,
      success: results.filter(function (result) {
        return result.ok;
      }),
      failed: failed,
    };
  });
}

DCDN.uploadFile = function uploadFile(entity, fieldKey, file, filename) {
  /**
   * Upload a file / image to a v2 entity file field.
   * Returns the upload response (use its id when saving the record).
   *
   * Example:
   *   const input = document.querySelector("#photo");
   *   const uploaded = await DCDN.uploadFile("le_client_m", "le_client_m.file", input.files[0]);
   *   uploaded.id
   */
  var formData = new FormData();
  formData.append("file", file, filename || file.name || "file-" + Date.now());
  return DCDN.request("/v2/api/entity/upload_file/" + entity + "/" + fieldKey, { method: "POST", body: formData });
};

DCDN.entity = function entity(entityKey) {
  /**
   * Shortcut object for one v2 entity (custom forms, invoices, products...).
   *
   * Example:
   *   const Items = DCDN.entity("le_invoice-items");
   *   await Items.get(5);                               // GET    /v2/api/entity/le_invoice-items/5/1
   *   await Items.list({ filters: { invoice_id: 9 } }); // first page
   *   await Items.all({ filters: { invoice_id: 9 } });  // ALL pages (bulkFetch)
   *   await Items.create({ invoice_id: 9 });            // POST   /v2/api/entity/le_invoice-items
   *   await Items.update(5, { status: 1 });             // PUT    /v2/api/entity/le_invoice-items/5
   *   await Items.updateFields(5, { status: 1 });       // POST   /v2/api/entity/le_invoice-items/5/fields
   *   await Items.remove(5);                            // DELETE /v2/api/entity/le_invoice-items/5
   */
  var base = "/v2/api/entity/" + entityKey;
  return {
    get: function (id, depth) {
      return DCDN.fetch(base + "/" + id + "/" + (depth == null ? 1 : depth));
    },
    list: function (options) {
      return DCDN.fetch(base + "/list/" + ((options && options.depth) || 1), options);
    },
    all: function (options) {
      return DCDN.bulkFetch(base + "/list/" + ((options && options.depth) || 1), options);
    },
    create: function (body) {
      return DCDN.post(base, body);
    },
    update: function (id, body) {
      return DCDN.put(base + "/" + id, body);
    },
    updateFields: function (id, body) {
      return DCDN.post(base + "/" + id + "/fields", body);
    },
    remove: function (id) {
      return DCDN.del(base + "/" + id);
    },
  };
};


/* ---- 03-site-i18n-storage.js ---- */
/* ==========================================================================
 * 03-site-i18n-storage.js
 * ----------------------------------------------------------------------------
 * - App-scoped localStorage          (DCDN.storage / setLocalStorage)
 * - Shared site info cache           (DCDN.getSiteInfo / getSite)
 * - Cached app settings              (DCDN.getAppSettings)
 * - Language detection & translation (DCDN.detectLang / t / translate)
 * ======================================================================== */

/* ============================ localStorage =============================== */

/* Safe wrappers: localStorage can throw (private mode, blocked storage). */
function storageRead(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function storageWrite(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    warnLog("localStorage unavailable", e);
    return false;
  }
}
function storageDelete(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {}
}

DCDN.storage = {};

DCDN.storage.key = function key(appId, name) {
  /**
   * The real localStorage key used for an app value: "app_{appId}_{name}"
   * (same format already used by old apps, e.g. "app_397_workflow").
   *
   * Example:
   *   DCDN.storage.key(397, "workflow")   // "app_397_workflow"
   */
  return "app_" + appId + "_" + name;
};

DCDN.storage.set = function set(appId, name, value, options) {
  /**
   * Save a value for one app.
   * Strings are saved as-is, other values as JSON.
   *
   * @param appId    app id (number or text)
   * @param name     value name
   * @param value    anything JSON-able
   * @param options  { ttl: seconds }  -> value expires automatically
   *
   * Examples:
   *   DCDN.storage.set(397, "workflow", "12");                 // key: app_397_workflow
   *   DCDN.storage.set(397, "settings", { auto: true });
   *   DCDN.storage.set(397, "cache", rows, { ttl: 600 });      // expires after 10 minutes
   */
  options = options || {};
  var storedValue;
  if (options.ttl) {
    storedValue = JSON.stringify({ __dcdn: 1, v: value, e: Date.now() + options.ttl * 1000 });
  } else {
    storedValue = typeof value === "string" ? value : JSON.stringify(value);
  }
  return storageWrite(DCDN.storage.key(appId, name), storedValue);
};

DCDN.storage.get = function get(appId, name, defaultValue) {
  /**
   * Read a value saved with DCDN.storage.set (JSON is parsed for you).
   * Returns defaultValue (or null) when missing or expired.
   *
   * Examples:
   *   DCDN.storage.get(397, "workflow")              // "12"
   *   DCDN.storage.get(397, "settings", {})          // { auto: true }  or {}
   */
  var fallback = defaultValue === undefined ? null : defaultValue;
  var raw = storageRead(DCDN.storage.key(appId, name));
  if (raw == null) return fallback;

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return raw; // plain string
  }

  if (parsed && parsed.__dcdn === 1) {
    // value saved with ttl
    if (parsed.e && Date.now() > parsed.e) {
      storageDelete(DCDN.storage.key(appId, name));
      return fallback;
    }
    return parsed.v;
  }
  return parsed;
};

DCDN.storage.has = function has(appId, name) {
  /**
   * true when a (non expired) value exists.
   *
   * Example:
   *   if (!DCDN.storage.has(82, "settings")) loadSettings();
   */
  return DCDN.storage.get(appId, name) !== null;
};

DCDN.storage.remove = function remove(appId, name) {
  /**
   * Delete one value.
   *
   * Example:
   *   DCDN.storage.remove(397, "workflow");
   */
  storageDelete(DCDN.storage.key(appId, name));
};

DCDN.storage.clear = function clear(appId) {
  /**
   * Delete every value of one app (all keys starting with "app_{appId}_").
   *
   * Example:
   *   DCDN.storage.clear(397);
   */
  var prefix = "app_" + appId + "_";
  try {
    Object.keys(localStorage).forEach(function (storageKey) {
      if (storageKey.indexOf(prefix) === 0) localStorage.removeItem(storageKey);
    });
  } catch (e) {}
};

/* Short aliases asked for by name */
DCDN.setLocalStorage = DCDN.storage.set;
DCDN.getLocalStorage = DCDN.storage.get;
DCDN.removeLocalStorage = DCDN.storage.remove;

/* ============================== site info ================================ */

var siteInfoRequest = null; // shared promise so parallel calls send ONE request

function readCachedSiteInfo() {
  var raw = storageRead(DCDN.config.siteInfoKey);
  if (!raw) return null;
  try {
    var value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch (e) {
    return null;
  }
}

DCDN.getSiteInfo = function getSiteInfo(options) {
  /**
   * Site info shared by ALL apps on the account.
   *
   * How it works:
   *   1. If localStorage["site_info"] already exists (set by ANY app) -> return it, no request.
   *   2. Otherwise GET /api2/site_info and save `response.data`
   *      ONLY if the key is still empty (another app may have saved it meanwhile —
   *      we never overwrite it).
   *   Parallel calls share one request.
   *
   * Saved shape (same as the old apps):  { Site: { language_code, currency_code, country_code, ... } }
   *
   * @param options { force: true }  -> ignore the cache and fetch again
   *
   * Examples:
   *   const info = await DCDN.getSiteInfo();
   *   info.Site.currency_code          // "SAR"
   *
   *   DCDN.getSiteInfo().then(info => console.log(info.Site.language_code));   // 7 = ar, 41 = en
   */
  options = options || {};
  if (!options.force) {
    var cached = readCachedSiteInfo();
    if (cached) return Promise.resolve(cached);
    if (siteInfoRequest) return siteInfoRequest;
  }

  siteInfoRequest = DCDN.fetch("/api2/site_info", { full: true })
    .then(function (response) {
      var data = (response && response.data) || response;
      var savedMeanwhile = readCachedSiteInfo();
      if (savedMeanwhile && !options.force) return savedMeanwhile; // another app won the race
      storageWrite(DCDN.config.siteInfoKey, JSON.stringify(data));
      return data;
    })
    .finally(function () {
      siteInfoRequest = null;
    });
  return siteInfoRequest;
};

DCDN.getSite = function getSite(options) {
  /**
   * Shortcut for (await DCDN.getSiteInfo()).Site
   *
   * Example:
   *   const site = await DCDN.getSite();
   *   site.currency_code   // "SAR"
   *   site.country_code    // "SA"
   */
  return DCDN.getSiteInfo(options).then(function (info) {
    return (info && info.Site) || info || {};
  });
};

DCDN.getSiteInfoSync = function getSiteInfoSync() {
  /**
   * Cached site info WITHOUT a request (null if no app cached it yet).
   *
   * Example:
   *   const info = DCDN.getSiteInfoSync();
   *   if (info) console.log(info.Site.currency_code);
   */
  return readCachedSiteInfo();
};

DCDN.clearSiteInfo = function clearSiteInfo() {
  /**
   * Remove the cached site info (next getSiteInfo() fetches again).
   * Done automatically when the settings form is saved.
   *
   * Example:
   *   DCDN.clearSiteInfo();
   */
  storageDelete(DCDN.config.siteInfoKey);
};

DCDN.getAppSettings = function getAppSettings(entityKey, options) {
  /**
   * Read an app's settings record once and cache it in localStorage
   * (like the old setAppInfo / getAppGeneralSettings).
   *
   * @param entityKey  settings entity, e.g. "le_pos_general_Settings"
   * @param options {
   *   appId:  storage app id (default = entityKey) -> key "app_{appId}_settings"
   *   id:     record id (default 1)
   *   depth:  relation depth (default 1)
   *   ttl:    cache seconds (default: forever)
   *   force:  true -> ignore the cache
   * }
   *
   * Example:
   *   const settings = await DCDN.getAppSettings("le_pos_general_Settings", { appId: 82, ttl: 3600 });
   *   if (settings.activate_beauty_app == "2") { ... }
   */
  options = options || {};
  var appId = options.appId || entityKey;
  var recordId = options.id || 1;

  if (!options.force) {
    var cached = DCDN.storage.get(appId, "settings");
    if (cached) return Promise.resolve(cached);
  }

  var url = "/v2/api/entity/" + entityKey + "/" + recordId + "/" + (options.depth == null ? 1 : options.depth);
  return DCDN.fetch(url).then(function (data) {
    DCDN.storage.set(appId, "settings", data, options.ttl ? { ttl: options.ttl } : undefined);
    return data;
  });
};

/* ============================== language ================================= */

var LANGUAGE_CODES = { 7: "ar", 41: "en" }; // Daftra Site.language_code

DCDN.detectLang = function detectLang() {
  /**
   * Detect the page language. Returns "ar" or "en".
   *
   * Checks in this order:
   *   1. DCDN.config.lang (forced)
   *   2. <body class="en_app"> / "ar_app"  (set by the old apps)
   *   3. dir attribute on <html> / <body>
   *   4. computed CSS direction of <body>
   *   5. <html lang="...">
   *   6. cached site_info language_code (7 = ar, 41 = en)
   *   7. "ar"
   *
   * Examples:
   *   DCDN.detectLang()                               // "ar"
   *   if (DCDN.detectLang() === "en") { ... }
   */
  if (DCDN.config.lang) return DCDN.config.lang;

  var body = document.body;
  if (body) {
    if (body.classList.contains("en_app")) return "en";
    if (body.classList.contains("ar_app")) return "ar";
  }

  var html = document.documentElement;
  var dir = (html.getAttribute("dir") || (body && body.getAttribute("dir")) || "").toLowerCase();
  if (dir === "rtl") return "ar";
  if (dir === "ltr") return "en";

  if (body && window.getComputedStyle && getComputedStyle(body).direction === "rtl") return "ar";

  var htmlLang = (html.getAttribute("lang") || "").toLowerCase();
  if (htmlLang.indexOf("ar") === 0) return "ar";

  var info = readCachedSiteInfo();
  var code = info && info.Site && info.Site.language_code;
  if (code && LANGUAGE_CODES[code]) return LANGUAGE_CODES[code];

  if (htmlLang.indexOf("en") === 0) return "en";
  return "ar";
};

DCDN.isRTL = function isRTL() {
  /**
   * true on Arabic (right-to-left) pages.
   *
   * Example:
   *   $box.css("text-align", DCDN.isRTL() ? "right" : "left");
   */
  return DCDN.detectLang() === "ar";
};

DCDN.isEn = function isEn() {
  /**
   * true on English pages.
   *
   * Example:
   *   const label = DCDN.isEn() ? "Save" : "حفظ";
   */
  return DCDN.detectLang() === "en";
};

DCDN.t = function t(arabicText, englishText) {
  /**
   * Pick the text for the page language.
   *
   * Examples:
   *   DCDN.t("حفظ", "Save")                 // "حفظ" on Arabic pages, "Save" on English pages
   *   DCDN.t({ ar: "حفظ", en: "Save" })     // same, object form
   */
  if (englishText === undefined) return pickText(arabicText);
  return DCDN.detectLang() === "en" ? englishText : arabicText;
};

DCDN.translate = function translate(words, options) {
  /**
   * Translate texts on the page in the right direction:
   *   page is English -> Arabic words are replaced by English
   *   page is Arabic  -> English words are replaced by Arabic
   * Replaces text nodes + placeholder / title / aria-label attributes + button values.
   *
   * @param words    [[ar, en], ...]  or  [{ ar, en }, ...]
   * @param options {
   *   root:       where to translate (selector/element, default <body>)
   *   exact:      true -> only replace when the whole text equals the word
   *   observe:    true -> keep translating new content (subform rows, popups...)
   *   attributes: attributes to translate (default placeholder, title, aria-label, data-original-title)
   *   lang:       force target language "ar" | "en"
   * }
   * @return number of replacements
   *
   * Examples:
   *   DCDN.translate([
   *     ["العميل", "Client"],
   *     ["الخدمات", "Services"],
   *     { ar: "العمولة (%)", en: "Commission (%)" },
   *   ]);
   *
   *   DCDN.translate([["حفظ", "Save"]], { root: "#myForm", observe: true });
   */
  options = options || {};
  var lang = options.lang || DCDN.detectLang();

  // build [from, to] pairs for this direction, longest first
  var pairs = (words || [])
    .map(function (word) {
      var arabic = Array.isArray(word) ? word[0] : word.ar;
      var english = Array.isArray(word) ? word[1] : word.en;
      return lang === "en" ? [arabic, english] : [english, arabic];
    })
    .filter(function (pair) {
      return pair[0] && pair[1] != null && pair[0] !== pair[1];
    })
    .sort(function (a, b) {
      return b[0].length - a[0].length;
    });
  if (!pairs.length) return 0;

  var attributes = options.attributes || ["placeholder", "title", "aria-label", "data-original-title"];
  var root = getElement(options.root) || document.body;
  var replacements = 0;

  function translateString(text) {
    if (!text || !text.trim()) return text;
    if (options.exact) {
      var trimmed = text.trim();
      for (var i = 0; i < pairs.length; i++) {
        if (trimmed === pairs[i][0]) {
          replacements++;
          return text.replace(trimmed, pairs[i][1]);
        }
      }
      return text;
    }
    var result = text;
    for (var j = 0; j < pairs.length; j++) {
      if (result.indexOf(pairs[j][0]) > -1) {
        result = result.split(pairs[j][0]).join(pairs[j][1]);
        replacements++;
      }
    }
    return result;
  }

  function translateTree(node) {
    // 1) text nodes (skip script / style / textarea)
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function (textNode) {
        var parentTag = textNode.parentNode && textNode.parentNode.nodeName;
        var skip = parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "TEXTAREA" || parentTag === "NOSCRIPT";
        return skip ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    var textNodes = [];
    var current;
    while ((current = walker.nextNode())) textNodes.push(current);
    textNodes.forEach(function (textNode) {
      var translated = translateString(textNode.nodeValue);
      if (translated !== textNode.nodeValue) textNode.nodeValue = translated;
    });

    // 2) attributes + button values
    var elements = [node].concat(Array.prototype.slice.call(node.querySelectorAll ? node.querySelectorAll("*") : []));
    elements.forEach(function (element) {
      if (!element.getAttribute) return;
      attributes.forEach(function (attributeName) {
        var value = element.getAttribute(attributeName);
        if (!value) return;
        var translated = translateString(value);
        if (translated !== value) element.setAttribute(attributeName, translated);
      });
      if (element.tagName === "INPUT" && /^(button|submit|reset)$/i.test(element.type) && element.value) {
        element.value = translateString(element.value);
      }
    });
  }

  translateTree(root);

  if (options.observe) {
    var busy = false;
    var observer = new MutationObserver(
      DCDN.debounce(function () {
        if (busy) return;
        busy = true;
        translateTree(root);
        busy = false;
      }, 80)
    );
    observer.observe(root, { childList: true, subtree: true });
    DCDN.translate._observers = (DCDN.translate._observers || []).concat(observer);
  }
  return replacements;
};

DCDN.translateText = function translateText(text, words, lang) {
  /**
   * Translate ONE string with the same word list format (no DOM).
   *
   * Example:
   *   DCDN.translateText("سجل الطلبات", [["سجل الطلبات", "Services Log"]])   // "Services Log" on English pages
   */
  lang = lang || DCDN.detectLang();
  var result = String(text == null ? "" : text);
  (words || []).forEach(function (word) {
    var arabic = Array.isArray(word) ? word[0] : word.ar;
    var english = Array.isArray(word) ? word[1] : word.en;
    var from = lang === "en" ? arabic : english;
    var to = lang === "en" ? english : arabic;
    if (from) result = result.split(from).join(to);
  });
  return result;
};

DCDN.applyBodyClasses = function applyBodyClasses() {
  /**
   * Add the body classes the old apps use:
   *   "custom_app ar_app|en_app {country_code} {currency_code}"
   * Also done automatically with  <script ... data-body-classes="true">.
   *
   * Example:
   *   DCDN.applyBodyClasses().then(site => console.log(document.body.className));
   */
  return DCDN.getSite().then(function (site) {
    if (!document.body) return;
    var lang = LANGUAGE_CODES[site.language_code] || (DCDN.isRTL() ? "ar" : "en");
    document.body.classList.add("custom_app", lang + "_app");
    if (site.country_code) document.body.classList.add(site.country_code);
    if (site.currency_code) document.body.classList.add(site.currency_code);
    return site;
  });
};

/* Clear the cached site_info when the settings form is saved (runs from 99-init.js). */
function watchSettingsSave() {
  if (!DCDN.config.autoResetSiteInfo) return;
  if (!/\/settings/.test(location.pathname)) return;
  document.addEventListener(
    "submit",
    function (event) {
      var isSettingsForm = event.target && event.target.id === "SiteChangeSettingsForm";
      var isSettingsPage = location.pathname === "/settings" || /\/owner\/sites\/change_settings/.test(location.pathname);
      if (isSettingsForm || isSettingsPage) DCDN.clearSiteInfo();
    },
    true
  );
}


/* ---- 04-ui.js ---- */
/* ==========================================================================
 * 04-ui.js
 * ----------------------------------------------------------------------------
 * UI components: loader, toast, progress bar, popup, confirm, alert.
 * All styles are injected once in <style id="dcdn-styles">.
 * Every class starts with "dcdn-" so nothing clashes with Daftra's CSS.
 * ======================================================================== */

var DCDN_CSS = [
  /* ---------- overlay + loader ---------- */
  ".dcdn-overlay {",
  "  position: fixed; top: 0; left: 0; width: 100%; height: 100%;",
  "  background: rgba(15, 23, 42, .45);",
  "  display: flex; align-items: center; justify-content: center;",
  "  z-index: var(--dcdn-z, 1000000);",
  "}",
  ".dcdn-spinner {",
  "  width: 64px; height: 64px; border-radius: 50%;",
  "  border: 6px solid rgba(255, 255, 255, .3); border-top-color: #fff;",
  "  animation: dcdn-spin .9s linear infinite;",
  "}",
  ".dcdn-loader-box { display: flex; flex-direction: column; align-items: center; gap: 14px; color: #fff; font-weight: 600; font-size: 15px; }",
  "@keyframes dcdn-spin { to { transform: rotate(360deg); } }",
  ".dcdn-inline-spinner {",
  "  display: inline-block; width: 18px; height: 18px; border-radius: 50%; vertical-align: middle;",
  "  border: 3px solid #cbd5e1; border-top-color: var(--dcdn-primary, #1877f2);",
  "  animation: dcdn-spin .8s linear infinite;",
  "}",

  /* ---------- toast ---------- */
  ".dcdn-toasts {",
  "  position: fixed; z-index: calc(var(--dcdn-z, 1000000) + 2);",
  "  display: flex; flex-direction: column; gap: 8px;",
  "  max-width: 380px; width: calc(100% - 32px); pointer-events: none;",
  "}",
  ".dcdn-toasts.top-right { top: 16px; right: 16px; }",
  ".dcdn-toasts.top-left { top: 16px; left: 16px; }",
  ".dcdn-toasts.bottom-right { bottom: 16px; right: 16px; }",
  ".dcdn-toasts.bottom-left { bottom: 16px; left: 16px; }",
  ".dcdn-toasts.top-center { top: 16px; left: 50%; transform: translateX(-50%); }",
  ".dcdn-toasts.bottom-center { bottom: 16px; left: 50%; transform: translateX(-50%); }",
  ".dcdn-toast {",
  "  pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;",
  "  background: #fff; color: #1e293b; border-radius: 8px; padding: 12px 14px;",
  "  box-shadow: 0 8px 24px rgba(0, 0, 0, .15); border-inline-start: 4px solid #64748b;",
  "  font-size: 14px; line-height: 1.5; animation: dcdn-in .25s ease; transition: opacity .25s, transform .25s;",
  "}",
  ".dcdn-toast.success { border-color: #16a34a; }",
  ".dcdn-toast.error { border-color: #dc2626; }",
  ".dcdn-toast.warning { border-color: #d97706; }",
  ".dcdn-toast.info { border-color: #2563eb; }",
  ".dcdn-toast-icon {",
  "  flex: 0 0 22px; height: 22px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 13px;",
  "  display: flex; align-items: center; justify-content: center;",
  "}",
  ".dcdn-toast.success .dcdn-toast-icon { background: #16a34a; }",
  ".dcdn-toast.error .dcdn-toast-icon { background: #dc2626; }",
  ".dcdn-toast.warning .dcdn-toast-icon { background: #d97706; }",
  ".dcdn-toast.info .dcdn-toast-icon { background: #2563eb; }",
  ".dcdn-toast-body { flex: 1; word-break: break-word; }",
  ".dcdn-toast-title { font-weight: 700; margin-bottom: 2px; }",
  ".dcdn-toast-close { background: none; border: 0; font-size: 18px; line-height: 1; color: #94a3b8; cursor: pointer; padding: 0; }",
  ".dcdn-toast.hide { opacity: 0; transform: translateY(-6px); }",
  "@keyframes dcdn-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }",

  /* ---------- progress bar ---------- */
  ".dcdn-progress { background: #fff; border-radius: 10px; padding: 12px 14px; box-shadow: 0 8px 24px rgba(0, 0, 0, .15); font-size: 13px; color: #1e293b; }",
  ".dcdn-progress.floating {",
  "  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);",
  "  width: min(420px, calc(100% - 32px)); z-index: calc(var(--dcdn-z, 1000000) + 1);",
  "}",
  ".dcdn-progress-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-weight: 600; }",
  ".dcdn-progress-track { height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }",
  ".dcdn-progress-fill { height: 100%; width: 0; background: var(--dcdn-primary, #1877f2); border-radius: 6px; transition: width .25s ease; }",
  ".dcdn-progress.done .dcdn-progress-fill { background: #16a34a; }",
  ".dcdn-progress.error .dcdn-progress-fill { background: #dc2626; }",
  ".dcdn-progress-text { margin-top: 6px; color: #64748b; font-size: 12px; }",

  /* ---------- popup ---------- */
  ".dcdn-popup {",
  "  background: #fff; color: #1e293b; border-radius: 10px; box-shadow: 0 20px 50px rgba(0, 0, 0, .25);",
  "  max-width: calc(100% - 32px); max-height: calc(100vh - 40px);",
  "  display: flex; flex-direction: column; animation: dcdn-in .2s ease;",
  "}",
  ".dcdn-popup-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 16px; }",
  ".dcdn-popup-close { background: none; border: 0; font-size: 24px; line-height: 1; cursor: pointer; color: #64748b; }",
  ".dcdn-popup-body { padding: 18px; overflow: auto; flex: 1; }",
  ".dcdn-popup-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; }",
  ".dcdn-btn { border: 0; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer; background: #e2e8f0; color: #1e293b; }",
  ".dcdn-btn.primary { background: var(--dcdn-primary, #1877f2); color: #fff; }",
  ".dcdn-btn.danger { background: #dc2626; color: #fff; }",
  ".dcdn-btn:disabled { opacity: .6; cursor: not-allowed; }",

  /* ---------- dropdown / percent / tabs ---------- */
  ".dcdn-dropdown { box-sizing: border-box; }",
  ".dcdn-percent-input { box-sizing: border-box; text-align: center; }",
  ".dcdn-tab-loading { padding: 20px; text-align: center; }",
].join("\n");

function ensureStyles() {
  var style = DCDN.injectCSS(DCDN_CSS, "dcdn-styles");
  document.documentElement.style.setProperty("--dcdn-z", DCDN.config.zIndex);
  document.documentElement.style.setProperty("--dcdn-primary", DCDN.config.primaryColor);
  return style;
}
DCDN.ensureStyles = ensureStyles;

/* ================================ loader ================================= */

var openLoaderCount = 0; // nested showLoader() calls

DCDN.showLoader = function showLoader(text) {
  /**
   * Show a full-screen loader (spinner + optional text).
   * Safe for nested calls: every showLoader() needs one hideLoader().
   *
   * @param text  string | { ar, en }  (optional)
   *
   * Examples:
   *   DCDN.showLoader();
   *   DCDN.showLoader({ ar: "جاري الحفظ...", en: "Saving..." });
   *   ...
   *   DCDN.hideLoader();
   */
  ensureStyles();
  openLoaderCount++;

  var loader = document.getElementById("dcdn-loader");
  if (!loader) {
    loader = createElementFromHtml(
      '<div id="dcdn-loader" class="dcdn-overlay" role="status" aria-live="polite">' +
        '<div class="dcdn-loader-box"><div class="dcdn-spinner"></div><div class="dcdn-loader-text"></div></div>' +
        "</div>"
    );
    document.body.appendChild(loader);
  }
  loader.querySelector(".dcdn-loader-text").textContent = text ? pickText(text) : "";
  loader.style.display = "flex";
  return loader;
};

DCDN.hideLoader = function hideLoader(force) {
  /**
   * Hide the loader. It really hides when every showLoader() got its hideLoader().
   *
   * @param force  true -> hide now, whatever the count
   *
   * Examples:
   *   DCDN.hideLoader();
   *   DCDN.hideLoader(true);
   */
  openLoaderCount = force ? 0 : Math.max(0, openLoaderCount - 1);
  if (openLoaderCount > 0) return;
  var loader = document.getElementById("dcdn-loader");
  if (loader) loader.style.display = "none";
};

DCDN.toggleLoadingSpinner = function toggleLoadingSpinner(show, text) {
  /**
   * Old name kept for compatibility with existing page codes.
   *
   * Examples:
   *   DCDN.toggleLoadingSpinner(true);
   *   DCDN.toggleLoadingSpinner(false);
   */
  return show ? DCDN.showLoader(text) : DCDN.hideLoader(true);
};

DCDN.withLoader = function withLoader(work, text) {
  /**
   * Show the loader while a promise / async function runs, then hide it
   * (even when it fails). Returns the work result.
   *
   * Examples:
   *   const res = await DCDN.withLoader(DCDN.post(url, body), "جاري الحفظ...");
   *
   *   await DCDN.withLoader(async () => {
   *     await step1();
   *     await step2();
   *   }, { ar: "جاري المعالجة", en: "Processing" });
   */
  DCDN.showLoader(text);
  return Promise.resolve()
    .then(function () {
      return typeof work === "function" ? work() : work;
    })
    .finally(function () {
      DCDN.hideLoader();
    });
};

/* ================================ toast ================================== */

var TOAST_ICONS = { success: "✓", error: "✕", warning: "!", info: "i" };

DCDN.toast = function toast(message, type, options) {
  /**
   * Show a small notification that disappears by itself.
   *
   * @param message  string | { ar, en }
   * @param type     "success" (default) | "error" | "warning" | "info"
   * @param options {
   *   title:    bold title above the message
   *   timeout:  ms before closing (default 3500, errors 6000, 0 = stay open)
   *   position: "top-right" | "top-left" | "top-center" | "bottom-right" | "bottom-left" | "bottom-center"
   *             (default: top-left on Arabic pages, top-right on English pages)
   *   html:     true -> message is HTML (only with trusted content)
   * }
   * @return { el, close() }
   *
   * Examples:
   *   DCDN.toast("تم الحفظ");
   *   DCDN.toast({ ar: "تم", en: "Done" }, "info");
   *   DCDN.toast("حدث خطأ", "error", { title: "خطأ", timeout: 0 });
   *   DCDN.toast.success("Saved");    DCDN.toast.error("Failed");
   */
  ensureStyles();
  if (type && typeof type === "object") {
    // allow DCDN.toast(message, { type: "error", ... })
    options = type;
    type = options.type;
  }
  options = options || {};
  type = type || "success";

  var position = options.position || (DCDN.isRTL() ? "top-left" : "top-right");
  var container = document.querySelector(".dcdn-toasts." + position);
  if (!container) {
    container = createElementFromHtml('<div class="dcdn-toasts ' + position + '"></div>');
    document.body.appendChild(container);
  }
  container.setAttribute("dir", DCDN.isRTL() ? "rtl" : "ltr");

  var toastElement = createElementFromHtml(
    '<div class="dcdn-toast ' + type + '" role="alert">' +
      '<span class="dcdn-toast-icon">' + (TOAST_ICONS[type] || "i") + "</span>" +
      '<div class="dcdn-toast-body"></div>' +
      '<button type="button" class="dcdn-toast-close" aria-label="close">×</button>' +
      "</div>"
  );
  var body = toastElement.querySelector(".dcdn-toast-body");

  if (options.title) {
    var titleElement = document.createElement("div");
    titleElement.className = "dcdn-toast-title";
    titleElement.textContent = pickText(options.title);
    body.appendChild(titleElement);
  }
  var messageElement = document.createElement("div");
  if (options.html) messageElement.innerHTML = pickText(message);
  else messageElement.textContent = pickText(message);
  body.appendChild(messageElement);

  // newest toast closest to the screen edge
  if (position.indexOf("bottom") === 0) container.insertBefore(toastElement, container.firstChild);
  else container.appendChild(toastElement);

  var closeTimer;
  function close() {
    clearTimeout(closeTimer);
    toastElement.classList.add("hide");
    setTimeout(function () {
      toastElement.remove();
    }, 260);
  }
  toastElement.querySelector(".dcdn-toast-close").onclick = close;

  var timeout = options.timeout == null ? (type === "error" ? 6000 : 3500) : options.timeout;
  if (timeout) closeTimer = setTimeout(close, timeout);

  return { el: toastElement, close: close };
};

/* DCDN.toast.success(msg) / .error / .warning / .info */
["success", "error", "warning", "info"].forEach(function (type) {
  DCDN.toast[type] = function (message, options) {
    return DCDN.toast(message, type, options);
  };
});

/* ============================= progress bar ============================== */

DCDN.progressBar = function progressBar(options) {
  /**
   * Show a progress bar (floating at the bottom, or inside a container).
   *
   * @param options {
   *   title:     string | { ar, en }
   *   total:     number of steps (can also be passed to update())
   *   target:    selector / element -> render inside it instead of floating
   *   autoClose: ms after done() before removing (default 1500, false = keep)
   * }
   * @return controller {
   *   update(current, total?)  set progress
   *   increment(n = 1)         +1 step
   *   setText(text)            text under the bar (default "3 / 10")
   *   setTitle(text)
   *   done(text?, autoCloseMs?)  green + auto remove
   *   error(text?)             red (stays until remove())
   *   remove()
   * }
   *
   * Examples:
   *   const bar = DCDN.progressBar({ title: "ترحيل البنود", total: items.length });
   *   for (const item of items) {
   *     await DCDN.post(url, item);
   *     bar.increment();
   *   }
   *   bar.done("تم");
   *
   *   // inside a popup / div
   *   const bar2 = DCDN.progressBar({ title: "Import", total: 100, target: "#import-box" });
   */
  ensureStyles();
  options = options || {};
  var total = options.total || 0;
  var current = 0;
  var target = getElement(options.target);
  var hasCustomText = false;

  var barElement = createElementFromHtml(
    '<div class="dcdn-progress' + (target ? "" : " floating") + '">' +
      '<div class="dcdn-progress-head"><span class="dcdn-progress-title"></span><span class="dcdn-progress-pct">0%</span></div>' +
      '<div class="dcdn-progress-track"><div class="dcdn-progress-fill"></div></div>' +
      '<div class="dcdn-progress-text"></div>' +
      "</div>"
  );
  barElement.setAttribute("dir", DCDN.isRTL() ? "rtl" : "ltr");
  barElement.querySelector(".dcdn-progress-title").textContent = pickText(options.title || { ar: "جاري التنفيذ...", en: "Processing..." });
  (target || document.body).appendChild(barElement);

  var fillElement = barElement.querySelector(".dcdn-progress-fill");
  var percentElement = barElement.querySelector(".dcdn-progress-pct");
  var textElement = barElement.querySelector(".dcdn-progress-text");

  var controller = {
    el: barElement,

    update: function (newCurrent, newTotal) {
      current = newCurrent;
      if (newTotal != null) total = newTotal;
      var percent = total ? Math.min(100, Math.round((current / total) * 100)) : Math.min(100, current);
      fillElement.style.width = percent + "%";
      percentElement.textContent = percent + "%";
      if (!hasCustomText && total) textElement.textContent = current + " / " + total;
      return controller;
    },

    increment: function (steps) {
      return controller.update(current + (steps || 1));
    },

    setText: function (text) {
      hasCustomText = true;
      textElement.textContent = pickText(text);
      return controller;
    },

    setTitle: function (text) {
      barElement.querySelector(".dcdn-progress-title").textContent = pickText(text);
      return controller;
    },

    done: function (text, autoCloseMs) {
      controller.update(total || 100, total || 100);
      barElement.classList.add("done");
      if (text) controller.setText(text);
      var delay = autoCloseMs == null ? (options.autoClose == null ? 1500 : options.autoClose) : autoCloseMs;
      if (delay !== false) setTimeout(controller.remove, delay);
      return controller;
    },

    error: function (text) {
      barElement.classList.add("error");
      if (text) controller.setText(text);
      return controller;
    },

    remove: function () {
      barElement.remove();
    },
  };
  return controller;
};

/* ================================= popup ================================= */

var openPopups = []; // stack, the last one is on top

DCDN.showPopup = function showPopup(content, options) {
  /**
   * Open a modal popup with any HTML content.
   *
   * @param content  HTML string | Element | jQuery object | { ar, en }
   * @param options {
   *   title:           string | { ar, en } | false (no header)
   *   width:           number (px) or CSS value (default 560px)
   *   buttons:         [{ text, class: "primary" | "danger", onClick(popup, button) }]
   *                    (a button without onClick just closes the popup)
   *   onOpen(popup)    after it is shown
   *   onClose(result, popup)
   *   closeOnBackdrop: default true
   *   closeOnEsc:      default true
   *   id:              fixed id (opening the same id again replaces it)
   *   className:       extra class on the box
   *   dir:             "rtl" | "ltr" (default: page direction)
   * }
   * @return popup { id, el, box, body, setContent(html), close(result) }
   *
   * Examples:
   *   DCDN.showPopup("<p>مرحبا</p>", { title: "رسالة" });
   *
   *   const popup = DCDN.showPopup('<input id="note" class="form-control">', {
   *     title: { ar: "إضافة ملاحظة", en: "Add note" },
   *     width: 500,
   *     buttons: [
   *       { text: "إلغاء" },
   *       { text: "حفظ", class: "primary", onClick: function (p) {
   *           const note = p.body.querySelector("#note").value;
   *           DCDN.post("/v2/api/entity/le_notes", { note }).then(() => p.close());
   *       } },
   *     ],
   *   });
   *
   *   // show JSON
   *   DCDN.showPopup("<pre>" + DCDN.escapeHtml(JSON.stringify(res, null, 2)) + "</pre>", { title: "Response", width: 800 });
   */
  ensureStyles();
  options = options || {};
  var popupId = options.id || DCDN.uid("popup");
  var previous = document.getElementById(popupId);
  if (previous) previous.remove();

  var overlay = createElementFromHtml(
    '<div class="dcdn-overlay dcdn-popup-overlay" id="' + popupId + '"><div class="dcdn-popup" role="dialog" aria-modal="true"></div></div>'
  );
  overlay.style.zIndex = DCDN.config.zIndex + 3 + openPopups.length;

  var box = overlay.firstChild;
  box.setAttribute("dir", options.dir || (DCDN.isRTL() ? "rtl" : "ltr"));
  box.style.width = typeof options.width === "number" ? options.width + "px" : options.width || "560px";
  if (options.className) box.className += " " + options.className;

  // header
  if (options.title !== false) {
    var header = createElementFromHtml(
      '<div class="dcdn-popup-head"><span class="dcdn-popup-title"></span>' +
        '<button type="button" class="dcdn-popup-close" aria-label="close">×</button></div>'
    );
    header.querySelector(".dcdn-popup-title").textContent = pickText(options.title || "");
    box.appendChild(header);
  }

  // body
  var body = createElementFromHtml('<div class="dcdn-popup-body"></div>');
  box.appendChild(body);

  var popup = {
    id: popupId,
    el: overlay,
    box: box,
    body: body,

    setContent: function (newContent) {
      body.innerHTML = "";
      if (newContent && newContent.nodeType) body.appendChild(newContent);
      else if (newContent && newContent.jquery) body.appendChild(newContent[0]);
      else body.innerHTML = pickText(newContent);
      return popup;
    },

    close: function (result) {
      if (!overlay.parentNode) return; // already closed
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
      openPopups = openPopups.filter(function (item) {
        return item !== popup;
      });
      if (options.onClose) options.onClose(result, popup);
    },
  };
  popup.setContent(content);

  // footer buttons
  if (options.buttons && options.buttons.length) {
    var footer = createElementFromHtml('<div class="dcdn-popup-foot"></div>');
    options.buttons.forEach(function (buttonOptions) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "dcdn-btn " + (buttonOptions["class"] || buttonOptions.className || "");
      button.textContent = pickText(buttonOptions.text);
      button.onclick = function () {
        if (buttonOptions.onClick) buttonOptions.onClick(popup, button);
        else popup.close();
      };
      footer.appendChild(button);
    });
    box.appendChild(footer);
  }

  // closing: Esc, backdrop, ×
  function onKeyDown(event) {
    var isTopPopup = openPopups[openPopups.length - 1] === popup;
    if (event.key === "Escape" && isTopPopup) popup.close();
  }
  if (options.closeOnEsc !== false) document.addEventListener("keydown", onKeyDown);

  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay && options.closeOnBackdrop !== false) popup.close();
  });

  var closeButton = box.querySelector(".dcdn-popup-close");
  if (closeButton) {
    closeButton.onclick = function () {
      popup.close();
    };
  }

  document.body.appendChild(overlay);
  openPopups.push(popup);
  if (options.onOpen) options.onOpen(popup);
  return popup;
};

DCDN.closePopup = function closePopup(popupId) {
  /**
   * Close the top popup, or the popup with this id.
   *
   * Examples:
   *   DCDN.closePopup();
   *   DCDN.closePopup("my-popup");
   */
  var popup = popupId
    ? openPopups.filter(function (item) {
        return item.id === popupId;
      })[0]
    : openPopups[openPopups.length - 1];
  if (popup) popup.close();
};

DCDN.confirm = function confirm(message, options) {
  /**
   * Yes / no popup. Resolves true (OK) or false (Cancel / closed).
   *
   * @param options { title, okText, cancelText, danger: true (red OK button), width }
   *
   * Examples:
   *   if (await DCDN.confirm("هل تريد الحذف؟", { danger: true })) {
   *     await DCDN.del(url);
   *   }
   *
   *   DCDN.confirm({ ar: "متأكد؟", en: "Sure?" }).then(ok => { if (ok) save(); });
   */
  options = options || {};
  return new Promise(function (resolve) {
    var answered = false;
    DCDN.showPopup('<div style="font-size:15px;line-height:1.7"></div>', {
      title: options.title || { ar: "تأكيد", en: "Confirm" },
      width: options.width || 420,
      onOpen: function (popup) {
        popup.body.firstChild.textContent = pickText(message);
      },
      onClose: function () {
        if (!answered) resolve(false);
      },
      buttons: [
        {
          text: options.cancelText || { ar: "إلغاء", en: "Cancel" },
          onClick: function (popup) {
            answered = true;
            resolve(false);
            popup.close();
          },
        },
        {
          text: options.okText || { ar: "تأكيد", en: "OK" },
          class: options.danger ? "danger" : "primary",
          onClick: function (popup) {
            answered = true;
            resolve(true);
            popup.close();
          },
        },
      ],
    });
  });
};

DCDN.alert = function alertPopup(message, options) {
  /**
   * Message popup with one OK button. Resolves when closed.
   * (Nicer replacement for window.alert, does not block the page.)
   *
   * @param options { title, okText, width }
   *
   * Example:
   *   await DCDN.alert("تم إنشاء 5 مدفوعات");
   */
  options = options || {};
  return new Promise(function (resolve) {
    DCDN.showPopup('<div style="font-size:15px;line-height:1.7"></div>', {
      title: options.title || { ar: "تنبيه", en: "Alert" },
      width: options.width || 420,
      onOpen: function (popup) {
        popup.body.firstChild.textContent = pickText(message);
      },
      onClose: function () {
        resolve();
      },
      buttons: [{ text: options.okText || { ar: "حسناً", en: "OK" }, class: "primary" }],
    });
  });
};


/* ---- 05-tabs.js ---- */
/* ==========================================================================
 * 05-tabs.js
 * ----------------------------------------------------------------------------
 * Add a custom tab to Daftra view / show pages:  DCDN.appendtab_<page>(...)
 *
 * Daftra has two tab layouts (auto-detected):
 *
 *  classic  (/owner/.../view/ID, Bootstrap 3)
 *     ul.nav.nav-tabs(.responsive) > li > a[data-toggle=tab]
 *     div.tab-content > .tab-pane
 *     + mobile accordion: .responsive.visible-sm .panel
 *
 *  v2       (/v2/owner/entity/{entity}/{id}/show, Bootstrap 4)
 *     ul#item-nav-tabs-responsive > li.nav-item > a.nav-link
 *     #item-nav-tabs-content-responsive > .tab-pane
 * ======================================================================== */

var TAB_PAGES = {}; // name -> { layout, match, nav, content }

DCDN.registerTabPage = function registerTabPage(pageName, pageConfig) {
  /**
   * Register a page name and create  DCDN.appendtab_<pageName>(options).
   * The name after "appendtab_" is free — use any page you need.
   *
   * @param pageConfig (optional) {
   *   layout:  "auto" (default) | "classic" | "v2"
   *   match:   RegExp of the page url (only used for a debug warning)
   *   nav:     custom selector of the tabs <ul>
   *   content: custom selector of the tab panes container
   * }
   *
   * Examples:
   *   DCDN.registerTabPage("school_contract");
   *   DCDN.appendtab_school_contract({ id: "marks", title: "الدرجات", content: "..." });
   *
   *   DCDN.registerTabPage("my_screen", { nav: "#myTabs", content: "#myTabsContent" });
   */
  TAB_PAGES[pageName] = Object.assign({ layout: "auto" }, pageConfig || {});
  DCDN["appendtab_" + pageName] = function (options) {
    return DCDN.appendTab(pageName, options);
  };
  return DCDN["appendtab_" + pageName];
};

/* Built-in page names -> DCDN.appendtab_invoice, DCDN.appendtab_client, ... */
[
  ["invoice", /\/owner\/invoices\/view\//],
  ["estimate", /\/owner\/(invoices\/view_estimate|estimates\/view)/],
  ["sales_order", /sales_order/],
  ["credit_note", /credit_note/],
  ["refund", /refund/],
  ["client", /\/owner\/clients\/view\//],
  ["supplier", /\/owner\/suppliers\/view\//],
  ["product", /\/owner\/products\/view\//],
  ["purchase_invoice", /\/owner\/purchase_invoices\/view\//],
  ["purchase_order", /purchase_order/],
  ["payment", /payments\/view\//],
  ["expense", /\/owner\/(expenses|incomes)\/view\//],
  ["work_order", /\/owner\/work_orders\/view\//],
  ["workflow", /workflow/],
  ["booking", /booking/],
  ["requisition", /requisition/],
  ["staff", /staff/],
  ["journal", /journals\/view/],
  ["entity", /\/v2\/owner\/entity\/.+\/show/],
].forEach(function (page) {
  DCDN.registerTabPage(page[0], { match: page[1] });
});

var V2_TABS_NAV = "#item-nav-tabs-responsive";
var V2_TABS_CONTENT = "#item-nav-tabs-content-responsive";
var CLASSIC_TABS_NAV = "ul.nav.nav-tabs.responsive, ul.nav.nav-tabs";

/** Find the tabs <ul> and the panes container on this page. */
function findTabsContainers(pageConfig) {
  if (pageConfig.nav && pageConfig.content) {
    return {
      layout: pageConfig.layout === "v2" ? "v2" : "classic",
      nav: getElement(pageConfig.nav),
      content: getElement(pageConfig.content),
    };
  }

  if (pageConfig.layout !== "classic" && document.querySelector(V2_TABS_NAV)) {
    return {
      layout: "v2",
      nav: document.querySelector(V2_TABS_NAV),
      content: document.querySelector(V2_TABS_CONTENT),
    };
  }

  var nav = document.querySelector(CLASSIC_TABS_NAV);
  if (!nav) return null;
  var content =
    (nav.parentNode && nav.parentNode.querySelector(":scope > .tab-content")) ||
    (nav.nextElementSibling && nav.nextElementSibling.classList.contains("tab-content") ? nav.nextElementSibling : null) ||
    document.querySelector("div.tab-content");
  return { layout: "classic", nav: nav, content: content };
}

/** Remove "active" from every tab and pane. */
function deactivateAllTabs(containers) {
  getElements(":scope > li", containers.nav).forEach(function (listItem) {
    listItem.classList.remove("active");
    var link = listItem.querySelector("a");
    if (link) {
      link.classList.remove("active");
      link.setAttribute("aria-selected", "false");
    }
  });
  getElements(":scope > .tab-pane", containers.content).forEach(function (pane) {
    pane.classList.remove("active", "show", "in");
  });
}

/** One listener per tabs <ul>: clicking a NATIVE tab hides our custom panes. */
function listenToNativeTabs(containers) {
  if (containers.nav.dataset.dcdnBound) return;
  containers.nav.dataset.dcdnBound = "1";

  containers.nav.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link || !containers.nav.contains(link) || link.dataset.dcdnTab) return; // our own tab handles itself

    getElements(".tab-pane[data-dcdn-tab]", containers.content).forEach(function (pane) {
      pane.classList.remove("active", "show", "in");
    });
    getElements("a[data-dcdn-tab]", containers.nav).forEach(function (ourLink) {
      ourLink.classList.remove("active");
      ourLink.closest("li").classList.remove("active");
    });

    // pages without Bootstrap's tab plugin: switch manually
    var href = link.getAttribute("href") || "";
    var pane = href.charAt(0) === "#" && href.length > 1 ? containers.content.querySelector(href) : null;
    if (pane && !window.jQuery) {
      deactivateAllTabs(containers);
      link.classList.add("active");
      link.closest("li").classList.add("active");
      pane.classList.add("active", "show", "in");
    }
  });
}

DCDN.appendTab = function appendTab(pageName, options) {
  /**
   * Add a custom tab to the current view / show page.
   * Usually called through a page alias:  DCDN.appendtab_invoice(options),
   * DCDN.appendtab_client(options), DCDN.appendtab_entity(options) ...
   * Works on classic and v2 layouts and on the mobile accordion.
   *
   * @param pageName  registered page name (see DCDN.registerTabPage), or "auto"
   * @param options {
   *   id:        unique id (also the pane id)                       REQUIRED
   *   title:     string | { ar, en }
   *   content:   HTML | Element | (pane, tab) => HTML | Promise<HTML>
   *   url:       load another page into the tab (e.g. a v2 list page)
   *   selector:  part of `url` to keep (default ".list-table, table, .panel")
   *   lazy:      load content on first open (default true)
   *   reload:    reload content every time the tab opens (default false)
   *   active:    open the tab immediately (default false)
   *   position:  index to insert at (default: last)
   *   badge:     number / text next to the title
   *   onOpen:    (pane, tab) => {}   runs every time the tab opens
   *   timeout:   ms to wait for the tabs to appear (default 15000)
   * }
   * @return Promise<tab> {
   *   link, li, pane, layout,
   *   open(), setContent(html), reload(), setBadge(value), remove()
   * }
   * Calling it again with the same id returns the existing tab (no duplicates).
   *
   * Examples:
   *   // 1) list page inside the tab
   *   DCDN.appendtab_invoice({
   *     id: "services_log",
   *     title: { ar: "سجل الطلبات", en: "Services Log" },
   *     url: "/v2/owner/entity/le_invoice-items/list?filter[invoice_id]=" + DCDN.getRecordId(),
   *   });
   *
   *   // 2) your own HTML from the API
   *   DCDN.appendtab_entity({
   *     id: "payments",
   *     title: "المدفوعات",
   *     content: async function () {
   *       const rows = await DCDN.bulkFetch("/v2/api/entity/le_x/list/1", { filters: { ref: DCDN.getRecordId() } });
   *       return "<ul>" + rows.map(r => "<li>" + r.id + "</li>").join("") + "</ul>";
   *     },
   *   }).then(tab => tab.setBadge(3));
   *
   *   // 3) any page name
   *   DCDN.appendTab("client", { id: "notes", title: "Notes", onOpen: pane => console.log(pane) });
   */
  if (pageName && typeof pageName === "object") {
    // allow DCDN.appendTab({ ... })
    options = pageName;
    pageName = "auto";
  }
  options = options || {};

  var pageConfig = TAB_PAGES[pageName] || { layout: "auto" };
  if (pageConfig.match && !pageConfig.match.test(location.pathname)) {
    debugLog("appendTab", { page: pageName, note: "url pattern does not match this page, continuing anyway" });
  }
  if (!options.id) options.id = DCDN.uid("tab");
  var paneId = options.id;

  var waitSelector = pageConfig.nav || V2_TABS_NAV + ", " + CLASSIC_TABS_NAV;
  var waitTimeout = options.timeout == null ? 15000 : options.timeout;

  return DCDN.waitForElement(waitSelector, { timeout: waitTimeout }).then(function () {
    var containers = findTabsContainers(pageConfig);
    if (!containers || !containers.content) throw new Error("appendTab: tabs container not found");
    ensureStyles();
    listenToNativeTabs(containers);

    // no duplicates
    var existingLink = containers.nav.querySelector('a[data-dcdn-tab="' + paneId + '"]');
    if (existingLink && existingLink._dcdnTab) return existingLink._dcdnTab;

    /* ---------- build the tab link ---------- */
    var title = pickText(options.title || paneId);
    var listItem;
    var link;

    if (containers.layout === "v2") {
      listItem = createElementFromHtml('<li class="nav-item"><a class="nav-link" role="tab" data-toggle="tab" aria-selected="false"></a></li>');
      link = listItem.firstChild;
      link.id = paneId + "-tab";
      link.textContent = title;
    } else {
      // classic: copy the first <li> so it keeps Daftra's classes
      var templateItem = containers.nav.querySelector(":scope > li");
      listItem = templateItem ? templateItem.cloneNode(false) : document.createElement("li");
      listItem.classList.remove("active");
      listItem.setAttribute("role", "presentation");
      link = document.createElement("a");
      link.setAttribute("role", "tab");
      link.setAttribute("data-toggle", "tab");
      link.className = "nav-link";
      link.innerHTML = '<span class="one-line"></span>';
      link.firstChild.textContent = title;
      listItem.appendChild(link);
    }
    link.setAttribute("href", "#" + paneId);
    link.setAttribute("aria-controls", paneId);
    link.setAttribute("title", title);
    link.dataset.dcdnTab = paneId;

    var badge = document.createElement("span");
    badge.className = "badge dcdn-tab-badge";
    badge.style.cssText = "margin-inline-start:6px;display:none";
    link.appendChild(badge);

    /* ---------- build the pane ---------- */
    var pane = document.createElement("div");
    pane.className = "tab-pane" + (containers.layout === "v2" ? " p-3" : "");
    pane.id = paneId;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", link.id || paneId);
    pane.dataset.dcdnTab = paneId;

    /* ---------- insert ---------- */
    var currentItems = containers.nav.querySelectorAll(":scope > li");
    if (options.position != null && currentItems[options.position]) {
      containers.nav.insertBefore(listItem, currentItems[options.position]);
    } else {
      containers.nav.appendChild(listItem);
    }
    containers.content.appendChild(pane);

    /* ---------- the tab controller ---------- */
    var contentLoaded = false;

    var tab = {
      id: paneId,
      link: link,
      li: listItem,
      pane: pane,
      layout: containers.layout,

      setContent: function (newContent) {
        pane.innerHTML = "";
        if (newContent && newContent.nodeType) pane.appendChild(newContent);
        else if (newContent && newContent.jquery) pane.appendChild(newContent[0]);
        else if (newContent != null) pane.innerHTML = newContent;
        return tab;
      },

      setBadge: function (value) {
        badge.textContent = value == null ? "" : value;
        badge.style.display = value == null || value === "" ? "none" : "";
        return tab;
      },

      reload: function () {
        contentLoaded = false;
        return loadContent();
      },

      open: function () {
        deactivateAllTabs(containers);
        listItem.classList.add("active");
        link.classList.add("active");
        link.setAttribute("aria-selected", "true");
        pane.classList.add("active", "show", "in");
        var loading = !contentLoaded || options.reload ? loadContent() : Promise.resolve();
        return loading.then(function () {
          if (options.onOpen) options.onOpen(pane, tab);
          return tab;
        });
      },

      remove: function () {
        listItem.remove();
        pane.remove();
        if (tab.mobilePanel) tab.mobilePanel.remove();
      },
    };
    link._dcdnTab = tab;
    if (options.badge != null) tab.setBadge(options.badge);

    /** Fill the pane from options.url or options.content. */
    function loadContent() {
      contentLoaded = true;
      if (options.content == null && !options.url) return Promise.resolve();
      pane.innerHTML = '<div class="dcdn-tab-loading"><span class="dcdn-inline-spinner"></span></div>';

      var loading;
      if (options.url) {
        // load a Daftra page and keep only the useful part (the list table)
        loading = fetch(options.url, { credentials: "same-origin" })
          .then(function (response) {
            return response.text();
          })
          .then(function (html) {
            var page = new DOMParser().parseFromString(html, "text/html");
            var part = page.querySelector(options.selector || ".list-table, table, .panel");
            return part ? part.outerHTML : '<div class="alert alert-info">' + pickText({ ar: "لا توجد بيانات", en: "No data" }) + "</div>";
          });
      } else if (typeof options.content === "function") {
        loading = Promise.resolve(options.content(pane, tab));
      } else {
        loading = Promise.resolve(options.content);
      }

      return loading
        .then(function (result) {
          if (result !== undefined) tab.setContent(result);
          else if (pane.querySelector(".dcdn-tab-loading")) pane.innerHTML = ""; // function filled the pane itself
        })
        .catch(function (error) {
          warnLog("tab load error", error);
          pane.innerHTML = '<div class="alert alert-danger">' + DCDN.escapeHtml(error.message) + "</div>";
        });
    }

    link.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      tab.open();
    });

    /* ---------- classic mobile accordion (small screens) ---------- */
    if (containers.layout === "classic") {
      var mobileTabs = document.querySelector(".responsive.visible-sm, .responsive.visible-xs");
      var templatePanel = mobileTabs && mobileTabs.querySelector(".panel");
      if (templatePanel) {
        var mobilePanel = templatePanel.cloneNode(false);
        mobilePanel.classList.remove("active");
        mobilePanel.innerHTML =
          '<div class="panel-heading"><h4 class="panel-title">' +
          '<a class="accordion-toggle collapsed" data-toggle="collapse" href="#collapse-' + paneId + '" aria-expanded="false"><span class="one-line"></span></a>' +
          "</h4></div>" +
          '<div id="collapse-' + paneId + '" class="panel-collapse collapse"><div class="panel-body"></div></div>';
        mobilePanel.querySelector(".one-line").textContent = title;
        mobileTabs.appendChild(mobilePanel);

        mobilePanel.querySelector("a").addEventListener("click", function (event) {
          event.preventDefault();
          var collapse = mobilePanel.querySelector(".panel-collapse");
          var panelBody = mobilePanel.querySelector(".panel-body");
          var opening = !collapse.classList.contains("in");
          collapse.classList.toggle("in", opening);
          collapse.style.display = opening ? "block" : "";
          if (!opening) return;
          var loading = contentLoaded && !options.reload ? Promise.resolve() : loadContent();
          loading.then(function () {
            panelBody.innerHTML = "";
            panelBody.appendChild(pane.cloneNode(true)).classList.add("active", "in", "show");
          });
        });
        tab.mobilePanel = mobilePanel;
      }
    }

    if (options.lazy === false) loadContent();
    if (options.active) return tab.open();
    return tab;
  });
};


/* ---- 06-dropdown-percent.js ---- */
/* ==========================================================================
 * 06-dropdown-percent.js
 * ----------------------------------------------------------------------------
 * DCDN.addDropdown       replace a text field / dynamic dropdown with a select
 * DCDN.calculatePercent  add a "%" input that fills a value field
 * ======================================================================== */

/**
 * Only copy Bootstrap styling classes from the original field
 * (never functional classes like "value-input" that other code selects on).
 */
function getStyleClasses(element) {
  var keep = (element.className || "").split(/\s+/).filter(function (className) {
    return /^(form-control|form-select|input-(sm|lg)|custom-select)/.test(className);
  });
  return keep.length ? keep.join(" ") : "form-control";
}

/** Read a value from an object by key, "dot.path", or function. */
function readByPath(object, path) {
  if (typeof path === "function") return path(object);
  return String(path)
    .split(".")
    .reduce(function (current, key) {
      return current == null ? current : current[key];
    }, object);
}

/**
 * Convert any option list to [{ value, text, data }].
 * Accepts strings, { value, text } objects, or raw API rows + valueKey / textKey.
 */
function normalizeOptions(list, settings) {
  var valueKey = settings.valueKey || "value";
  var textKey = settings.textKey || "text";

  return (list || [])
    .map(function (item) {
      if (item == null) return null;
      if (typeof item !== "object") return { value: String(item), text: String(item), data: item };

      var value = readByPath(item, valueKey);
      var text = readByPath(item, textKey);
      if (value == null) value = item.id != null ? item.id : item.value;
      if (text == null) {
        text = item.name != null ? item.name : item.text != null ? item.text : item.title != null ? item.title : value;
      }
      return { value: String(value), text: pickText(text), data: item };
    })
    .filter(Boolean);
}

/** Get the options from settings.options (array / function / promise) or settings.source (API). */
function loadDropdownOptions(settings) {
  if (settings.source) {
    var source = settings.source;
    var request =
      source.all === false
        ? DCDN.fetch(source.url, Object.assign({}, source, { all: false }))
        : DCDN.bulkFetch(source.url, source);
    return request.then(function (rows) {
      return normalizeOptions(rows, {
        valueKey: source.valueKey || settings.valueKey || "id",
        textKey: source.textKey || settings.textKey || "name",
      });
    });
  }
  var options = typeof settings.options === "function" ? settings.options() : settings.options;
  return Promise.resolve(options).then(function (list) {
    return normalizeOptions(list, settings);
  });
}

DCDN.addDropdown = function addDropdown(target, settings) {
  /**
   * Replace a field with a dropdown whose options YOU choose.
   * The original field stays in the form (hidden) and receives the chosen value,
   * so Daftra saves it normally.
   *
   * ---------------------------------------------------------------------------
   * A) Single-line text field
   *    The chosen value (or text) is written into the hidden input.
   *
   *    DCDN.addDropdown('[id$="--single_line_field"]', {
   *      options: ["الرياض", "جدة", { value: "dmm", text: "الدمام" }],
   *      saveAs: "text",             // write the text ("value" = default)
   *    });
   *
   * B) Dynamic dropdown  (plain <select>, selectize or select2)
   *    The chosen option is APPENDED to the original select (if missing) and selected.
   *
   *    DCDN.addDropdown("#data-le_custom_data_client--city", {
   *      source: {
   *        url: "/v2/api/entity/le_cities/list/1",
   *        filters: { active: 1 },
   *        valueKey: "id",
   *        textKey: "city",
   *      },
   *    });
   *
   * C) Every subform row, also rows added later
   *    DCDN.addDropdown('[id$="--item_name"]', { options: loadItems, live: true });
   * ---------------------------------------------------------------------------
   *
   * @param target    selector | element | jQuery object
   * @param settings {
   *   options:      array | () => array | Promise<array>
   *                 items can be "text", { value, text }, or raw objects (use valueKey / textKey)
   *   source:       { url, filters, sort, perPage, valueKey, textKey, all }   load options from the API
   *                 (all: false -> only the first page)
   *   valueKey:     key / "dot.path" / function for the option value  (default "value", or "id" for source)
   *   textKey:      key / "dot.path" / function for the option text   (default "text", or "name" for source)
   *   saveAs:       "value" (default) | "text"   what is written into the original field
   *   placeholder:  string | { ar, en }   (default "-- اختر --" / "-- Select --")
   *   hideOriginal: default true
   *   searchable:   true -> use select2 if it is loaded on the page
   *   className:    extra class for the new select
   *   live:         true -> also apply to matching fields added later (selector target only)
   *   onSelect:     (option, controller) => {}   option = { value, text, data }
   * }
   *
   * @return Promise<controller>  (array of controllers when several fields match)
   *   controller = {
   *     select,           the new <select>
   *     original,         the original field
   *     options,          current options [{ value, text, data }]
   *     getSelected(),    selected option or null
   *     setValue(value),  select by value (writes into the original too)
   *     setOptions(list), replace options
   *     destroy()         remove the dropdown and show the original again
   *   }
   *
   * Example with onSelect (fill other fields from the selected row):
   *   DCDN.addDropdown('[id$="--product_name"]', {
   *     source: { url: "/v2/api/entity/product/list/1", textKey: "name" },
   *     saveAs: "text",
   *     onSelect: function (option) {
   *       DCDN.setFieldValue("unit_price", option.data.unit_price);
   *     },
   *   });
   */
  settings = settings || {};

  // live mode: enhance now + every matching field added later
  if (typeof target === "string" && settings.live) {
    var controllers = [];
    DCDN.onElement(target, function (element) {
      createDropdown(element, settings).then(function (controller) {
        controllers.push(controller);
      });
    });
    return Promise.resolve(controllers);
  }

  var elements = getElements(target);
  if (!elements.length) {
    warnLog("addDropdown: target not found", target);
    return Promise.resolve(null);
  }

  return Promise.all(
    elements.map(function (element) {
      return createDropdown(element, settings);
    })
  ).then(function (controllers) {
    return controllers.length === 1 ? controllers[0] : controllers;
  });
};
DCDN.addDropDown = DCDN.addDropdown; // alias (common typo)

/** Build ONE dropdown for ONE original field. */
function createDropdown(original, settings) {
  ensureStyles();
  if (original._dcdnDropdown) return Promise.resolve(original._dcdnDropdown); // already done

  var originalIsSelect = original.tagName === "SELECT";
  var saveAs = settings.saveAs || "value";

  /* ---------- the new <select> ---------- */
  var select = document.createElement("select");
  select.className = "dcdn-dropdown " + getStyleClasses(original) + (settings.className ? " " + settings.className : "");
  select.id = (original.id || DCDN.uid("dd")) + "_dcdn_select";

  /* ---------- what to hide: the field, or its selectize / select2 wrapper ---------- */
  var elementToHide = original;
  if (originalIsSelect && original.selectize) {
    elementToHide = original.selectize.$wrapper ? original.selectize.$wrapper[0] : original.nextElementSibling;
  } else if (originalIsSelect && original.classList.contains("select2-hidden-accessible")) {
    elementToHide = original.nextElementSibling;
  }

  // same size as the original
  if (elementToHide.offsetWidth) select.style.width = elementToHide.offsetWidth + "px";
  else select.style.width = "100%";
  var originalHeight = window.getComputedStyle ? getComputedStyle(elementToHide).height : "";
  if (originalHeight && originalHeight !== "auto" && elementToHide.offsetHeight) select.style.minHeight = originalHeight;

  elementToHide.parentNode.insertBefore(select, elementToHide.nextSibling);
  if (settings.hideOriginal !== false) elementToHide.style.display = "none";

  /* ---------- controller ---------- */
  var currentOptions = [];

  var controller = {
    select: select,
    original: original,
    options: currentOptions,

    getSelected: function () {
      return (
        currentOptions.filter(function (option) {
          return option.value === select.value;
        })[0] || null
      );
    },

    setOptions: function (list) {
      currentOptions = normalizeOptions(list, settings);
      controller.options = currentOptions;
      renderOptions();
      return controller;
    },

    setValue: function (value) {
      select.value = value;
      writeToOriginal();
      return controller;
    },

    destroy: function () {
      select.remove();
      elementToHide.style.display = "";
      delete original._dcdnDropdown;
    },
  };
  original._dcdnDropdown = controller;

  function readOriginalValue() {
    if (originalIsSelect && original.selectize) return original.selectize.getValue();
    return original.value;
  }

  /** Fill the <select> and preselect the original field's current value. */
  function renderOptions() {
    var originalValue = readOriginalValue();
    select.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = pickText(settings.placeholder || { ar: "-- اختر --", en: "-- Select --" });
    select.appendChild(placeholder);

    currentOptions.forEach(function (option, index) {
      var optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      optionElement.dataset.index = index;
      select.appendChild(optionElement);
    });

    if (originalValue) {
      var match = currentOptions.filter(function (option) {
        return option.value == originalValue || option.text == originalValue;
      })[0];
      if (match) select.value = match.value;
    }

    if (settings.searchable && window.jQuery && window.jQuery.fn.select2) {
      var $select = window.jQuery(select);
      if ($select.data("select2")) $select.select2("destroy");
      $select.select2({ width: select.style.width || "100%", dir: DCDN.isRTL() ? "rtl" : "ltr" });
    }
  }

  /** Copy the chosen option into the original field and fire change. */
  function writeToOriginal() {
    var selected = controller.getSelected();
    var valueToSave = selected ? (saveAs === "text" ? selected.text : selected.value) : "";

    if (!originalIsSelect) {
      // A) single-line text field
      original.value = valueToSave;
      triggerEvents(original);
    } else if (original.selectize) {
      // B) selectize dynamic dropdown
      var selectize = original.selectize;
      if (valueToSave && !selectize.options[valueToSave]) {
        selectize.addOption({ value: valueToSave, text: selected.text });
        selectize.refreshOptions(false);
      }
      selectize.setValue(valueToSave);
    } else {
      // B) plain / select2 dynamic dropdown: append the option if missing, then select it
      var optionExists = Array.prototype.some.call(original.options, function (optionElement) {
        return optionElement.value == valueToSave;
      });
      if (valueToSave && !optionExists) original.add(new Option(selected.text, valueToSave, true, true));
      original.value = valueToSave;
      if (window.jQuery && window.jQuery(original).data("select2")) window.jQuery(original).trigger("change");
      else triggerEvents(original, ["change"]);
    }

    if (settings.onSelect) settings.onSelect(selected, controller);
  }

  select.addEventListener("change", writeToOriginal);
  if (window.jQuery) window.jQuery(select).on("select2:select", writeToOriginal);

  return loadDropdownOptions(settings).then(function (list) {
    currentOptions = list;
    controller.options = currentOptions;
    renderOptions();
    return controller;
  });
}

/* ============================ calculatePercent ============================ */

/** Read a number from: number | function | input | text element. */
function readBaseNumber(source, targetInput) {
  if (source == null) return 0;
  if (typeof source === "number") return source;
  if (typeof source === "function") return DCDN.parseNumber(source(targetInput));
  var element = getElement(source);
  if (!element) return 0;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) return DCDN.parseNumber(element.value);
  return DCDN.parseNumber(element.textContent);
}

DCDN.calculatePercent = function calculatePercent(target, settings) {
  /**
   * Add a "%" input BEFORE a value input.
   *   - typing a percent fills the value:   value = base × percent / 100
   *   - typing a value updates the percent: percent = value / base × 100
   *   - when the base input changes, the value is recalculated
   * The target input keeps 70% of its width, the % input takes the rest.
   *
   * @param target    selector | element | jQuery object   (the value input)
   * @param settings {
   *   base:        what to take the percent OF:
   *                selector | element | number | (targetInput) => number
   *                (inputs: value is read, other elements: text is read, "1,000.00 ر.س" works)
   *   baseScope:   look for the `base` selector inside target.closest(baseScope)
   *                -> one base per table row / subform row, e.g. "tr"
   *   decimals:    default 2
   *   ratio:       width kept for the target (default 0.7)
   *   max:         max percent (default 100)
   *   sync:        typing in the value updates the percent (default true)
   *   placeholder: default "%"
   *   live:        also apply to matching inputs added later (selector target only)
   *   onChange:    ({ percent, value, base, target }) => {}
   * }
   *
   * @return controller (array when several inputs match) {
   *   percentInput, target,
   *   getPercent(), setPercent(p), recalc(), destroy()
   * }
   *
   * Examples:
   *   // discount value = % of the subtotal shown on the page
   *   DCDN.calculatePercent('[id$="--discountvalue"]', { base: "#subtotal" });
   *
   *   // one base per row, also new rows
   *   DCDN.calculatePercent(".value-input", { base: ".row-total", baseScope: "tr", live: true });
   *
   *   // base from code, 3 decimals
   *   DCDN.calculatePercent("#amount", {
   *     base: () => DCDN.parseNumber($("#invoice-total").text()),
   *     decimals: 3,
   *     onChange: ({ percent, value }) => console.log(percent + "% =", value),
   *   });
   *
   *   const ctrl = DCDN.calculatePercent("#amount", { base: 1000 });
   *   ctrl.setPercent(15);   // #amount = 150.00
   */
  settings = settings || {};

  if (typeof target === "string" && settings.live) {
    var controllers = [];
    DCDN.onElement(target, function (input) {
      controllers.push(createPercentInput(input, settings));
    });
    return controllers;
  }

  var inputs = getElements(target);
  if (!inputs.length) {
    warnLog("calculatePercent: target not found", target);
    return null;
  }
  var result = inputs.map(function (input) {
    return createPercentInput(input, settings);
  });
  return result.length === 1 ? result[0] : result;
};

/** Build the % input for ONE target input. */
function createPercentInput(targetInput, settings) {
  ensureStyles();
  if (targetInput._dcdnPercent) return targetInput._dcdnPercent; // already done

  var decimals = settings.decimals == null ? 2 : settings.decimals;
  var widthRatio = settings.ratio || 0.7;
  var maxPercent = settings.max == null ? 100 : settings.max;
  var gapPx = 4;

  /** The base element for this target (respects baseScope). */
  function resolveBaseSource() {
    var base = settings.base;
    if (typeof base === "string" && settings.baseScope) {
      var scope = targetInput.closest(settings.baseScope);
      return scope ? scope.querySelector(base) : base;
    }
    return base;
  }
  function getBaseValue() {
    return readBaseNumber(resolveBaseSource(), targetInput);
  }

  /* ---------- the % input ---------- */
  var percentInput = document.createElement("input");
  percentInput.type = "text";
  percentInput.inputMode = "decimal";
  percentInput.className = "dcdn-percent-input " + getStyleClasses(targetInput);
  percentInput.placeholder = pickText(settings.placeholder || "%");
  percentInput.title = pickText({ ar: "النسبة %", en: "Percent %" });
  if (targetInput.id) percentInput.id = targetInput.id + "_percent";

  /* ---------- widths: target 70%, percent 30% ---------- */
  var originalWidth = targetInput.style.width;
  var originalDisplay = targetInput.style.display;
  var currentWidth = targetInput.offsetWidth;
  if (currentWidth) {
    targetInput.style.width = Math.floor(currentWidth * widthRatio) + "px";
    percentInput.style.width = Math.floor(currentWidth * (1 - widthRatio)) - gapPx + "px";
  } else {
    // hidden right now -> use percentages
    targetInput.style.width = widthRatio * 100 + "%";
    percentInput.style.width = "calc(" + (1 - widthRatio) * 100 + "% - " + gapPx + "px)";
  }
  targetInput.style.display = "inline-block";
  percentInput.style.display = "inline-block";
  percentInput.style.marginInlineEnd = gapPx + "px";
  targetInput.parentNode.insertBefore(percentInput, targetInput);

  /* ---------- calculations ---------- */
  var isUpdating = false; // prevents percent -> value -> percent loops

  function updateValueFromPercent() {
    if (isUpdating) return;
    var typed = percentInput.value.trim();
    if (typed === "") return;

    var percent = DCDN.parseNumber(typed);
    if (percent > maxPercent) {
      percent = maxPercent;
      percentInput.value = maxPercent;
    }
    var base = getBaseValue();
    var value = DCDN.round((base * percent) / 100, decimals);

    isUpdating = true;
    targetInput.value = value.toFixed(decimals);
    triggerEvents(targetInput); // let Daftra recalculate totals
    isUpdating = false;

    if (settings.onChange) settings.onChange({ percent: percent, value: value, base: base, target: targetInput });
  }

  function updatePercentFromValue() {
    if (isUpdating || settings.sync === false) return;
    var base = getBaseValue();
    if (!base) return;
    var percent = DCDN.round((DCDN.parseNumber(targetInput.value) / base) * 100, decimals);
    isUpdating = true;
    percentInput.value = targetInput.value === "" ? "" : String(percent);
    isUpdating = false;
  }

  percentInput.addEventListener("input", updateValueFromPercent);
  percentInput.addEventListener("change", updateValueFromPercent);
  targetInput.addEventListener("input", updatePercentFromValue);
  targetInput.addEventListener("change", updatePercentFromValue);

  /* ---------- recalc when the base input changes ---------- */
  var baseSource = resolveBaseSource();
  var baseElement = typeof baseSource === "string" ? getElement(baseSource) : baseSource && baseSource.nodeType ? baseSource : null;

  function onBaseChanged() {
    if (percentInput.value.trim() !== "") updateValueFromPercent();
  }
  if (baseElement && /^(INPUT|SELECT|TEXTAREA)$/.test(baseElement.tagName)) {
    baseElement.addEventListener("input", onBaseChanged);
    baseElement.addEventListener("change", onBaseChanged);
    // jQuery .trigger("change") does not fire native listeners
    if (window.jQuery) window.jQuery(baseElement).on("change.dcdn", onBaseChanged);
  }

  if (targetInput.value) updatePercentFromValue(); // show the current percent

  var controller = {
    percentInput: percentInput,
    target: targetInput,
    recalc: updateValueFromPercent,

    getPercent: function () {
      return DCDN.parseNumber(percentInput.value);
    },

    setPercent: function (percent) {
      percentInput.value = percent;
      updateValueFromPercent();
      return controller;
    },

    destroy: function () {
      percentInput.remove();
      targetInput.style.width = originalWidth;
      targetInput.style.display = originalDisplay;
      targetInput.removeEventListener("input", updatePercentFromValue);
      targetInput.removeEventListener("change", updatePercentFromValue);
      if (baseElement) {
        baseElement.removeEventListener("input", onBaseChanged);
        baseElement.removeEventListener("change", onBaseChanged);
        if (window.jQuery) window.jQuery(baseElement).off("change.dcdn", onBaseChanged);
      }
      delete targetInput._dcdnPercent;
    },
  };
  targetInput._dcdnPercent = controller;
  return controller;
}


/* ---- 07-table-words.js ---- */
/* ==========================================================================
 * 07-table-words.js
 * ----------------------------------------------------------------------------
 * - Table helpers: serials, swap columns, hide column, toJSON, Excel / CSV export
 * - formatCells (was removeCurr)
 * - Number to words in Arabic / English with currency (tafqeet / convertFN)
 * ======================================================================== */

DCDN.table = {};

DCDN.table.addSerials = function addSerials(table, options) {
  /**
   * Add a serial-number column at the start of a table (was addserials).
   * Runs only once per table.
   *
   * @param table    selector | element   (default "#listing_table")
   * @param options  { header: "م" | { ar, en } }
   *
   * Examples:
   *   DCDN.table.addSerials();                                    // #listing_table
   *   DCDN.table.addSerials("#my-table", { header: { ar: "م", en: "#" } });
   */
  options = options || {};
  var tableElement = getElement(table || "#listing_table");
  if (!tableElement || tableElement.dataset.dcdnSerials) return;
  tableElement.dataset.dcdnSerials = "1";

  var rowNumber = 0;
  for (var i = 0; i < tableElement.rows.length; i++) {
    var row = tableElement.rows[i];
    var isHeaderRow = row.parentNode.tagName === "THEAD" || (i === 0 && row.cells[0] && row.cells[0].tagName === "TH");
    var cell = document.createElement(isHeaderRow ? "th" : "td");
    cell.className = "dcdn-serial";
    cell.textContent = isHeaderRow ? pickText(options.header || { ar: "م", en: "#" }) : String(++rowNumber);
    row.insertBefore(cell, row.cells[0] || null);
  }
};

DCDN.table.swapColumns = function swapColumns(firstIndex, secondIndex, table) {
  /**
   * Swap two columns in every row: content + id + class.
   * Same as the standard  swap(in1, in2, "listing_table")  used in templates.
   *
   * @param firstIndex, secondIndex  0-based column indexes
   * @param table   table id ("listing_table") | selector | element
   *
   * Examples:
   *   DCDN.swap(3, 6, "listing_table");
   *   DCDN.table.swapColumns(0, 1, "#my-table");
   */
  var tableElement =
    typeof table === "string" && !/^[#.\[]/.test(table) ? document.getElementById(table) : getElement(table);
  if (!tableElement) return;

  for (var i = 0, row; (row = tableElement.rows[i]); i++) {
    var firstCell = row.cells[firstIndex];
    var secondCell = row.cells[secondIndex];
    if (!firstCell || !secondCell) continue;

    var temp = firstCell.innerHTML;
    firstCell.innerHTML = secondCell.innerHTML;
    secondCell.innerHTML = temp;

    temp = firstCell.id;
    firstCell.id = secondCell.id;
    secondCell.id = temp;

    temp = firstCell.className;
    firstCell.className = secondCell.className;
    secondCell.className = temp;
  }
};
DCDN.swap = DCDN.table.swapColumns;

DCDN.table.hideColumn = function hideColumn(table, columnIndex) {
  /**
   * Hide one column (0-based) in every row.
   *
   * Example:
   *   DCDN.table.hideColumn("#listing_table", 4);
   */
  var tableElement = getElement(table);
  if (!tableElement) return;
  for (var i = 0, row; (row = tableElement.rows[i]); i++) {
    if (row.cells[columnIndex]) row.cells[columnIndex].style.display = "none";
  }
};

DCDN.table.toJSON = function toJSON(table) {
  /**
   * Read a table into an array of objects (first row = keys).
   *
   * Example:
   *   DCDN.table.toJSON("#report")
   *   // [{ "Name": "Ahmed", "Total": "1,200" }, ...]
   */
  var tableElement = getElement(table);
  if (!tableElement || !tableElement.rows.length) return [];

  var headers = Array.prototype.map.call(tableElement.rows[0].cells, function (cell, index) {
    return cell.textContent.trim() || "col" + index;
  });

  var rows = [];
  for (var i = 1; i < tableElement.rows.length; i++) {
    var rowObject = {};
    Array.prototype.forEach.call(tableElement.rows[i].cells, function (cell, index) {
      rowObject[headers[index] || "col" + index] = cell.textContent.trim();
    });
    rows.push(rowObject);
  }
  return rows;
};

DCDN.table.exportToExcel = function exportToExcel(table, filename) {
  /**
   * Download a table as an .xls file that Excel opens (RTL sheet on Arabic pages).
   *
   * Examples:
   *   DCDN.exportTableToExcel("#report", "sales-report");
   *   DCDN.table.exportToExcel(document.querySelector(".list-table"));
   */
  var tableElement = getElement(table);
  if (!tableElement) return;
  var rightToLeft = DCDN.isRTL();
  var html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="UTF-8">' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
    "<x:Name>Sheet1</x:Name><x:WorksheetOptions>" +
    (rightToLeft ? "<x:DisplayRightToLeft/>" : "") +
    "</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    "</head><body>" +
    tableElement.outerHTML +
    "</body></html>";
  var blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
  DCDN.downloadBlob(blob, (filename || "export") + ".xls");
};
DCDN.exportTableToExcel = DCDN.table.exportToExcel;

DCDN.exportCSV = function exportCSV(rows, filename) {
  /**
   * Download rows (array of objects) or a table as a CSV file (UTF-8, Excel friendly).
   *
   * Examples:
   *   const clients = await DCDN.bulkFetch("/v2/api/entity/client/list/1");
   *   DCDN.exportCSV(clients, "clients");
   *
   *   DCDN.exportCSV("#report", "report");     // from a table
   */
  if (rows && (rows.nodeType || typeof rows === "string")) rows = DCDN.table.toJSON(rows);
  rows = rows || [];
  var headers = rows.length ? Object.keys(rows[0]) : [];

  function escapeCsv(value) {
    value = value == null ? "" : String(value);
    return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  var lines = [headers.map(escapeCsv).join(",")].concat(
    rows.map(function (row) {
      return headers
        .map(function (header) {
          return escapeCsv(row[header]);
        })
        .join(",");
    })
  );
  var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  DCDN.downloadBlob(blob, (filename || "export") + ".csv");
};

DCDN.downloadBlob = function downloadBlob(blob, filename) {
  /**
   * Download any Blob as a file.
   *
   * Example:
   *   DCDN.downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "data.json");
   */
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 500);
};

DCDN.formatCells = function formatCells(selector, options) {
  /**
   * Re-format the amounts inside elements (was removeCurr).
   *
   * @param options { decimals: 2, prefix, suffix, suffixHtml (e.g. a currency symbol span) }
   *
   * Examples:
   *   DCDN.formatCells(".removeCurr");                                  // "1234.5" -> "1,234.50"
   *   DCDN.formatCells(".removeCurr", { suffix: " ر.س" });
   *   DCDN.formatCells(".amount", { suffixHtml: '<span class="sar_symbol">&nbsp;元</span>' });
   */
  options = options || {};
  getElements(selector).forEach(function (element) {
    var number = DCDN.parseNumber(element.textContent);
    var formatted = DCDN.formatNumber(number, options.decimals == null ? 2 : options.decimals);
    if (options.suffixHtml) {
      element.innerHTML = DCDN.escapeHtml((options.prefix || "") + formatted) + options.suffixHtml;
    } else {
      element.textContent = (options.prefix || "") + formatted + (options.suffix || "");
    }
  });
};

/* ============================ number to words ============================ */

var ARABIC_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
var ARABIC_TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
var ARABIC_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
var ARABIC_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
// each scale: [singular, dual, plural (3-10), accusative singular (11-99)]
var ARABIC_SCALES = [
  null,
  ["ألف", "ألفان", "آلاف", "ألفاً"],
  ["مليون", "مليونان", "ملايين", "مليوناً"],
  ["مليار", "ملياران", "مليارات", "ملياراً"],
  ["تريليون", "تريليونان", "تريليونات", "تريليوناً"],
];

/** 0-99 in Arabic words. */
function arabicBelow100(number) {
  if (number < 10) return ARABIC_ONES[number];
  if (number < 20) return ARABIC_TEENS[number - 10];
  var ones = number % 10;
  return (ones ? ARABIC_ONES[ones] + " و" : "") + ARABIC_TENS[Math.floor(number / 10)];
}

/** 0-999 in Arabic words. */
function arabicBelow1000(number) {
  var hundreds = Math.floor(number / 100);
  var rest = number % 100;
  var parts = [];
  if (hundreds) parts.push(ARABIC_HUNDREDS[hundreds]);
  if (rest) parts.push(arabicBelow100(rest));
  return parts.join(" و");
}

/** Choose the noun form for a count: [singular, dual, plural, accusative]. */
function arabicCountedNoun(count, forms) {
  var lastTwoDigits = count % 100;
  if (count === 1) return forms[0];
  if (count === 2) return forms[1];
  if (lastTwoDigits >= 3 && lastTwoDigits <= 10) return forms[2];
  if (lastTwoDigits >= 11 && lastTwoDigits <= 99) return forms[3];
  return forms[0];
}

/** A 3-digit group with its scale word, e.g. 3 + thousands -> "ثلاثة آلاف". */
function arabicGroupWithScale(group, forms) {
  if (group === 1) return forms[0];
  if (group === 2) return forms[1];

  var lastTwoDigits = group % 100;
  var hundredsText = group >= 100 ? ARABIC_HUNDREDS[Math.floor(group / 100)] : "";
  var tailText;
  if (lastTwoDigits === 0) tailText = "";
  else if (lastTwoDigits === 1) tailText = forms[0];
  else if (lastTwoDigits === 2) tailText = forms[1];
  else tailText = arabicBelow100(lastTwoDigits);

  if (group < 100) return tailText + " " + arabicCountedNoun(group, forms);
  if (lastTwoDigits === 0) return hundredsText + " " + forms[0];
  if (lastTwoDigits <= 2) return hundredsText + " و" + tailText;
  return hundredsText + " و" + tailText + " " + arabicCountedNoun(lastTwoDigits, forms);
}

DCDN.numberToArabicWords = function numberToArabicWords(number) {
  /**
   * Whole number -> Arabic words (no currency).
   *
   * Examples:
   *   DCDN.numberToArabicWords(21)        // "واحد وعشرون"
   *   DCDN.numberToArabicWords(1250)      // "ألف ومائتان وخمسون"
   *   DCDN.numberToArabicWords(2000000)   // "مليونان"
   */
  number = Math.floor(Math.abs(Number(number) || 0));
  if (number === 0) return "صفر";

  var groups = []; // groups of 3 digits, smallest first
  while (number > 0) {
    groups.push(number % 1000);
    number = Math.floor(number / 1000);
  }

  var parts = [];
  for (var i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(i === 0 ? arabicBelow1000(groups[i]) : arabicGroupWithScale(groups[i], ARABIC_SCALES[i]));
  }
  return parts.join(" و");
};

var ENGLISH_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
var ENGLISH_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
var ENGLISH_SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

/** 0-999 in English words. */
function englishBelow1000(number) {
  var parts = [];
  if (number >= 100) {
    parts.push(ENGLISH_ONES[Math.floor(number / 100)] + " Hundred");
    number %= 100;
  }
  if (number >= 20) {
    parts.push(ENGLISH_TENS[Math.floor(number / 10)] + (number % 10 ? "-" + ENGLISH_ONES[number % 10] : ""));
  } else if (number) {
    parts.push(ENGLISH_ONES[number]);
  }
  return parts.join(" ");
}

DCDN.numberToEnglishWords = function numberToEnglishWords(number) {
  /**
   * Whole number -> English words (no currency).
   *
   * Example:
   *   DCDN.numberToEnglishWords(1250)   // "One Thousand Two Hundred Fifty"
   */
  number = Math.floor(Math.abs(Number(number) || 0));
  if (number === 0) return "Zero";
  var parts = [];
  var scaleIndex = 0;
  while (number > 0) {
    var group = number % 1000;
    if (group) parts.unshift(englishBelow1000(group) + (ENGLISH_SCALES[scaleIndex] ? " " + ENGLISH_SCALES[scaleIndex] : ""));
    number = Math.floor(number / 1000);
    scaleIndex++;
  }
  return parts.join(" ");
};

/**
 * Currency names used by numberToWords.
 *   ar / arSub: [singular, dual, plural (3-10), accusative (11-99)]
 *   en / enSub: [singular, plural]
 *   sub:        fraction units in one main unit (100 or 1000)
 *   subFem:     fraction unit is feminine in Arabic ("هللة واحدة")
 * Add your own:  DCDN.currencies.LYD = { ... }
 */
DCDN.currencies = {
  SAR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["هللة", "هللتان", "هللات", "هللة"], subFem: true, en: ["Riyal", "Riyals"], enSub: ["Halala", "Halalas"], sub: 100 },
  EGP: { ar: ["جنيه", "جنيهان", "جنيهات", "جنيهاً"], arSub: ["قرش", "قرشان", "قروش", "قرشاً"], en: ["Pound", "Pounds"], enSub: ["Piaster", "Piasters"], sub: 100 },
  AED: { ar: ["درهم", "درهمان", "دراهم", "درهماً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dirham", "Dirhams"], enSub: ["Fils", "Fils"], sub: 100 },
  KWD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  BHD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  OMR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["بيسة", "بيستان", "بيسات", "بيسة"], subFem: true, en: ["Rial", "Rials"], enSub: ["Baisa", "Baisa"], sub: 1000 },
  QAR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["درهم", "درهمان", "دراهم", "درهماً"], en: ["Riyal", "Riyals"], enSub: ["Dirham", "Dirhams"], sub: 100 },
  JOD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  IQD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  USD: { ar: ["دولار", "دولاران", "دولارات", "دولاراً"], arSub: ["سنت", "سنتان", "سنتات", "سنتاً"], en: ["Dollar", "Dollars"], enSub: ["Cent", "Cents"], sub: 100 },
};

DCDN.numberToWords = function numberToWords(amount, options) {
  /**
   * Amount -> words with currency (tafqeet / convertFN).
   *
   * @param amount   number or text ("1,250.50")
   * @param options {
   *   lang:     "ar" | "en"   (default: page language)
   *   currency: "SAR" | "EGP" | "AED" | "KWD" | "BHD" | "OMR" | "QAR" | "JOD" | "IQD" | "USD"
   *             or your own object (see DCDN.currencies)
   *   prefix:   default "فقط " / "Only "  (false = none)
   *   suffix:   default " لا غير" / ""    (false = none)
   * }
   *
   * Examples:
   *   DCDN.numberToWords(1250.5, { currency: "SAR", lang: "ar" })
   *   // "فقط ألف ومائتان وخمسون ريالاً وخمسون هللة لا غير"
   *
   *   DCDN.numberToWords(1250.5, { currency: "SAR", lang: "en" })
   *   // "Only One Thousand Two Hundred Fifty Riyals and Fifty Halalas"
   *
   *   DCDN.numberToWords(3000, { currency: "EGP", prefix: false, suffix: false })
   *   // "ثلاثة آلاف جنيه"
   *
   *   // in a page: write the total in words under the invoice total
   *   $("#total-words").text(DCDN.numberToWords($("#invoice-total").text(), { currency: "SAR" }));
   */
  options = options || {};
  var lang = options.lang || DCDN.detectLang();
  var currency =
    typeof options.currency === "object" ? options.currency : DCDN.currencies[(options.currency || "").toUpperCase()];

  var number = Math.abs(DCDN.parseNumber(amount));
  var fractionUnits = currency ? currency.sub : 100;
  var fractionDigits = String(fractionUnits).length - 1;
  var mainPart = Math.floor(number);
  var fractionPart = Math.round((number - mainPart) * fractionUnits);
  if (fractionPart >= fractionUnits) {
    // e.g. 0.999 rounds up
    mainPart += 1;
    fractionPart = 0;
  }

  /* ---------- English ---------- */
  if (lang === "en") {
    var englishText = DCDN.numberToEnglishWords(mainPart);
    if (currency) englishText += " " + (mainPart === 1 ? currency.en[0] : currency.en[1]);
    if (fractionPart) {
      englishText +=
        " and " +
        DCDN.numberToEnglishWords(fractionPart) +
        (currency ? " " + (fractionPart === 1 ? currency.enSub[0] : currency.enSub[1]) : "");
    }
    var englishPrefix = options.prefix === false ? "" : options.prefix || "Only ";
    var englishSuffix = options.suffix === false ? "" : options.suffix || "";
    return (englishPrefix + englishText + englishSuffix).trim();
  }

  /* ---------- Arabic ---------- */
  var arabicText;
  if (!currency) arabicText = DCDN.numberToArabicWords(mainPart);
  else if (mainPart === 1) arabicText = currency.ar[0] + " واحد";
  else if (mainPart === 2) arabicText = currency.ar[1];
  else arabicText = DCDN.numberToArabicWords(mainPart) + " " + arabicCountedNoun(mainPart, currency.ar);

  if (fractionPart) {
    var fractionText;
    if (!currency) fractionText = DCDN.numberToArabicWords(fractionPart) + " من " + Math.pow(10, fractionDigits);
    else if (fractionPart === 1) fractionText = currency.arSub[0] + (currency.subFem ? " واحدة" : " واحد");
    else if (fractionPart === 2) fractionText = currency.arSub[1];
    else fractionText = DCDN.numberToArabicWords(fractionPart) + " " + arabicCountedNoun(fractionPart, currency.arSub);
    arabicText += " و" + fractionText;
  }

  var arabicPrefix = options.prefix === false ? "" : options.prefix || "فقط ";
  var arabicSuffix = options.suffix === false ? "" : options.suffix || " لا غير";
  return arabicPrefix + arabicText + arabicSuffix;
};
DCDN.tafqeet = DCDN.numberToWords;


/* ---- 99-init.js ---- */
/* ==========================================================================
 * 99-init.js
 * ----------------------------------------------------------------------------
 * Runs once when the file loads.
 * ======================================================================== */

/*
 * Read options from the <script> tag itself:
 *
 *   <script src=".../daftra-cdn.js"
 *           data-debug="true"            log every request
 *           data-lang="en"               force the language
 *           data-primary-color="#0d6efd" color of bars / buttons
 *           data-site-info="true"        prefetch site info into localStorage
 *           data-body-classes="true"     add "custom_app ar_app SA SAR" to <body>
 *   ></script>
 */
(function readScriptTagOptions() {
  var scriptTag = document && document.currentScript;
  if (!scriptTag || !scriptTag.dataset) return;
  var data = scriptTag.dataset;

  if (data.debug) DCDN.config.debug = data.debug === "true";
  if (data.lang) DCDN.config.lang = data.lang;
  if (data.primaryColor) DCDN.config.primaryColor = data.primaryColor;
  if (data.siteInfo === "true") {
    DCDN.onReady(function () {
      DCDN.getSiteInfo().catch(function () {});
    });
  }
  if (data.bodyClasses === "true") {
    DCDN.onReady(function () {
      DCDN.applyBodyClasses().catch(function () {});
    });
  }
})();

/* Clear cached site_info when the settings page is saved. */
DCDN.onReady(watchSettingsSave);

DCDN.exposeGlobals = function exposeGlobals() {
  /**
   * Define the OLD global function names some page codes still call,
   * only when they are not defined already:
   *   toggleLoadingSpinner, getSiteInfo, addThousandSeparator,
   *   exportTableToExcel, swap, showPopup, closePopup
   *
   * Example:
   *   DCDN.exposeGlobals();
   *   toggleLoadingSpinner(true);   // old code keeps working
   */
  var oldNames = {
    toggleLoadingSpinner: DCDN.toggleLoadingSpinner,
    getSiteInfo: DCDN.getSiteInfo,
    addThousandSeparator: DCDN.addThousandSeparator,
    exportTableToExcel: DCDN.exportTableToExcel,
    swap: DCDN.swap,
    showPopup: DCDN.showPopup,
    closePopup: DCDN.closePopup,
  };
  Object.keys(oldNames).forEach(function (name) {
    if (typeof window[name] === "undefined") window[name] = oldNames[name];
  });
};

debugLog("loaded", { version: VERSION, docs: "DCDN.help()" });


  return DCDN;
});
