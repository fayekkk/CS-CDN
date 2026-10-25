/*!
 * Daftra CDN v1.3.0 — reusable functions & components for Daftra page codes
 * Global: window.DCDN (alias window.DaftraCDN)
 * Docs in the console: DCDN.help()  or  DCDN.help("addDropdown")
 * Built: 2026-10-22T10:46:07.083Z
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
  var NEW_VERSION = "1.3.0";
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
  var VERSION = "1.3.0";
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
  /* docs + examples: DCDN.help("configure")  or  DCDN.configure in the console */
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
 * If a value is a DCDN JSON envelope ({ success, data }), return its data.
 * Lets you pass  DCDN.t(...)  or  await DCDN.fetch(...)  straight into other DCDN options.
 */
function unwrapEnvelope(value) {
  return value && typeof value === "object" && value.__dcdn === true ? value.data : value;
}

/**
 * Pick the text for the current page language.
 * Accepts: "plain text" | { ar: "...", en: "..." } | ["ar text", "en text"]
 *   pickText({ ar: "حفظ", en: "Save" })  -> "Save" on English pages
 */
function pickText(value) {
  value = unwrapEnvelope(value);
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

/** Read the first /** ... *\/ comment written inside a function body (public wrapper first). */
function readDocComment(fn, path) {
  var hasPublic = typeof PUBLIC_FUNCTIONS !== "undefined";
  var publicWrapper = path && hasPublic ? PUBLIC_FUNCTIONS[path] : null;
  if (!publicWrapper && hasPublic && fn) {
    // aliases (get, fetchAll, swap, toast.success, appendtab_invoice...) share the docs of the original
    var original = null;
    if (/^appendtab_/.test(path || "")) original = "appendTab";
    else if (/^toast\./.test(path || "")) original = "toast";
    else {
      for (var known in PUBLIC_FUNCTIONS) {
        var real = known.split(".").reduce(function (object, key) {
          return object == null ? object : object[key];
        }, DCDN);
        if (real === fn) {
          original = known;
          break;
        }
      }
    }
    if (original && PUBLIC_FUNCTIONS[original]) {
      var aliasDocs = readDocComment(null, original);
      var how = /^appendtab_/.test(path)
        ? "Same as DCDN.appendTab(\"" + path.replace("appendtab_", "") + "\", options)."
        : /^toast\./.test(path)
        ? "Same as DCDN.toast(message, \"" + path.split(".")[1] + "\", options)."
        : "Alias of DCDN." + original + ".";
      return how + "\n" + aliasDocs;
    }
  }
  if (!publicWrapper && !fn) return "";
  var source = Function.prototype.toString.call(publicWrapper || fn);
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
  /* docs + examples: DCDN.help("help")  or  DCDN.help in the console */
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
    var docs = { function: "DCDN." + name, docs: (readDocComment(fn, name) || "(no docs)").split("\n") };
    console.log(JSON.stringify(docs, null, 2));
    return docs;
  }

  var rows = [];
  function collect(object, prefix) {
    Object.keys(object).forEach(function (key) {
      if (key.charAt(0) === "_") return;
      var value = object[key];
      if (typeof value === "function") {
        var firstLine = (readDocComment(value, (prefix + key).replace(/^DCDN\./, "")).split("\n")[0] || "").trim();
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
  /* docs + examples: DCDN.help("sleep")  or  DCDN.sleep in the console */
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
};

DCDN.debounce = function debounce(callback, waitMs) {
  /* docs + examples: DCDN.help("debounce")  or  DCDN.debounce in the console */
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
  /* docs + examples: DCDN.help("throttle")  or  DCDN.throttle in the console */
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
  /* docs + examples: DCDN.help("chunk")  or  DCDN.chunk in the console */
  var groups = [];
  for (var i = 0; i < array.length; i += size) groups.push(array.slice(i, i + size));
  return groups;
};

DCDN.uid = function uid(prefix) {
  /* docs + examples: DCDN.help("uid")  or  DCDN.uid in the console */
  return (prefix || "dcdn") + "_" + Math.random().toString(36).slice(2, 9);
};

DCDN.escapeHtml = function escapeHtml(text) {
  /* docs + examples: DCDN.help("escapeHtml")  or  DCDN.escapeHtml in the console */
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/* ============================== numbers ================================== */

DCDN.toEnDigits = function toEnDigits(text) {
  /* docs + examples: DCDN.help("toEnDigits")  or  DCDN.toEnDigits in the console */
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
  /* docs + examples: DCDN.help("parseNumber")  or  DCDN.parseNumber in the console */
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
  /* docs + examples: DCDN.help("round")  or  DCDN.round in the console */
  var factor = Math.pow(10, decimals == null ? 2 : decimals);
  return Math.round((Number(number) + Number.EPSILON) * factor) / factor;
};

DCDN.formatNumber = function formatNumber(value, decimals, options) {
  /* docs + examples: DCDN.help("formatNumber")  or  DCDN.formatNumber in the console */
  options = options || {};
  var number = DCDN.parseNumber(value);
  var text = decimals == null ? String(number) : DCDN.round(number, decimals).toFixed(decimals);
  var parts = text.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, options.separator == null ? "," : options.separator);
  return (options.prefix || "") + parts.join(options.decimalPoint || ".") + (options.suffix || "");
};

DCDN.addThousandSeparator = function addThousandSeparator(value) {
  /* docs + examples: DCDN.help("addThousandSeparator")  or  DCDN.addThousandSeparator in the console */
  return DCDN.formatNumber(value);
};

/* =============================== dates =================================== */

function padTwoDigits(number) {
  return (number < 10 ? "0" : "") + number;
}

DCDN.formatDate = function formatDate(date, format) {
  /* docs + examples: DCDN.help("formatDate")  or  DCDN.formatDate in the console */
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
  /* docs + examples: DCDN.help("today")  or  DCDN.today in the console */
  return DCDN.formatDate(new Date(), format);
};

DCDN.addDays = function addDays(date, days, format) {
  /* docs + examples: DCDN.help("addDays")  or  DCDN.addDays in the console */
  var result = new Date(date || Date.now());
  result.setDate(result.getDate() + Number(days || 0));
  return format ? DCDN.formatDate(result, format) : result;
};

/* ================================ URL ==================================== */

DCDN.getUrlParam = function getUrlParam(name, url) {
  /* docs + examples: DCDN.help("getUrlParam")  or  DCDN.getUrlParam in the console */
  try {
    return new URL(url || location.href).searchParams.get(name);
  } catch (e) {
    return null;
  }
};

DCDN.getRecordId = function getRecordId(url) {
  /* docs + examples: DCDN.help("getRecordId")  or  DCDN.getRecordId in the console */
  var path = new URL(url || location.href, location.origin).pathname;
  var numbers = path.split("/").filter(function (segment) {
    return /^\d+$/.test(segment);
  });
  return numbers.length ? Number(numbers[numbers.length - 1]) : null;
};

DCDN.getPageInfo = function getPageInfo(url) {
  /* docs + examples: DCDN.help("getPageInfo")  or  DCDN.getPageInfo in the console */
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
  /* docs + examples: DCDN.help("onReady")  or  DCDN.onReady in the console */
  if (document.readyState !== "loading") callback();
  else document.addEventListener("DOMContentLoaded", callback);
};

DCDN.waitForElement = function waitForElement(selector, options) {
  /* docs + examples: DCDN.help("waitForElement")  or  DCDN.waitForElement in the console */
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
  /* docs + examples: DCDN.help("waitFor")  or  DCDN.waitFor in the console */
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
  /* docs + examples: DCDN.help("onElement")  or  DCDN.onElement in the console */
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
  /* docs + examples: DCDN.help("loadScript")  or  DCDN.loadScript in the console */
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
  /* docs + examples: DCDN.help("loadStyle")  or  DCDN.loadStyle in the console */
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
  /* docs + examples: DCDN.help("injectCSS")  or  DCDN.injectCSS in the console */
  if (id && document.getElementById(id)) return document.getElementById(id);
  var style = document.createElement("style");
  if (id) style.id = id;
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
  return style;
};

DCDN.copyToClipboard = function copyToClipboard(text) {
  /* docs + examples: DCDN.help("copyToClipboard")  or  DCDN.copyToClipboard in the console */
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
  /* docs + examples: DCDN.help("triggerEnter")  or  DCDN.triggerEnter in the console */
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
  /* docs + examples: DCDN.help("getUser")  or  DCDN.getUser in the console */
  return window.USER || {};
};

DCDN.isOwner = function isOwner() {
  /* docs + examples: DCDN.help("isOwner")  or  DCDN.isOwner in the console */
  var user = DCDN.getUser();
  return !!(Number(user.is_owner) || Number(user.staff_id) === 0);
};

DCDN.getCsrfToken = function getCsrfToken() {
  /* docs + examples: DCDN.help("getCsrfToken")  or  DCDN.getCsrfToken in the console */
  var meta = document.querySelector('meta[name="csrf-token"]');
  var input = document.querySelector('input[name="_csrfToken"]') || document.querySelector('input[name="data[_Token][key]"]');
  return (meta && meta.getAttribute("content")) || (input && input.value) || "";
};

DCDN.field = function field(key, root) {
  /* docs + examples: DCDN.help("field")  or  DCDN.field in the console */
  root = root || document;
  return (
    root.querySelector('[id$="--' + key + '"]') ||
    root.querySelector('[name$="[' + key + ']"]') ||
    root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(key) : key))
  );
};

DCDN.fields = function fields(key, root) {
  /* docs + examples: DCDN.help("fields")  or  DCDN.fields in the console */
  return getElements('[id$="--' + key + '"]', root);
};

DCDN.getFieldValue = function getFieldValue(target) {
  /* docs + examples: DCDN.help("getFieldValue")  or  DCDN.getFieldValue in the console */
  var element = typeof target === "string" ? getElement(target) || DCDN.field(target) : getElement(target);
  if (!element) return null;
  if (element.selectize) return element.selectize.getValue();
  if (element.type === "checkbox" || element.type === "radio") return element.checked;
  return element.value;
};

DCDN.setFieldValue = function setFieldValue(target, value, text) {
  /* docs + examples: DCDN.help("setFieldValue")  or  DCDN.setFieldValue in the console */
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
  /* docs + examples: DCDN.help("addMenuItem")  or  DCDN.addMenuItem in the console */
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
  /* docs + examples: DCDN.help("buildQuery")  or  DCDN.buildQuery in the console */
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
  /* docs + examples: DCDN.help("buildUrl")  or  DCDN.buildUrl in the console */
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
  /* docs + examples: DCDN.help("request")  or  DCDN.request in the console */
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

  // newer v2 single-record shape: { payload: { data: {...record} } }
  if (!Array.isArray(response.data) && response.payload && typeof response.payload === "object" &&
      response.payload.data && typeof response.payload.data === "object" && !Array.isArray(response.payload.data)) {
    return unwrapModel(response.payload.data, options.unwrap);
  }

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
/* Errors that were handled by silent / onError: the public JSON wrapper still reports success: false. */
var handledFailures = typeof WeakMap !== "undefined" ? new WeakMap() : null;

function runWithExtras(work, options, defaultLoaderText) {
  options = options || {};
  if (options.loader) DCDN.showLoader(options.loader === true ? defaultLoaderText : options.loader);
  var failure = {}; // filled when an error is handled instead of thrown

  var promise = Promise.resolve()
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
      if (options.silent || options.onError) {
        failure.error = error;
        return options.fallback === undefined ? null : options.fallback;
      }
      throw error;
    })
    .finally(function () {
      if (options.loader) DCDN.hideLoader();
      if (options.onComplete) options.onComplete();
    });

  if (handledFailures) handledFailures.set(promise, failure);
  return promise;
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
  /* docs + examples: DCDN.help("fetch")  or  DCDN.fetch in the console */
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
  /* docs + examples: DCDN.help("post")  or  DCDN.post in the console */
  return sendWithMethod((options && options.method) || "POST", url, body, options);
};

DCDN.put = function put(url, body, options) {
  /* docs + examples: DCDN.help("put")  or  DCDN.put in the console */
  return sendWithMethod("PUT", url, body, options);
};

DCDN.patch = function patch(url, body, options) {
  /* docs + examples: DCDN.help("patch")  or  DCDN.patch in the console */
  return sendWithMethod("PATCH", url, body, options);
};

DCDN.del = function del(url, options) {
  /* docs + examples: DCDN.help("del")  or  DCDN.del in the console */
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
  /* docs + examples: DCDN.help("bulkFetch")  or  DCDN.bulkFetch in the console */
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
  /* docs + examples: DCDN.help("bulkPost")  or  DCDN.bulkPost in the console */
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
  /* docs + examples: DCDN.help("uploadFile")  or  DCDN.uploadFile in the console */
  var formData = new FormData();
  formData.append("file", file, filename || file.name || "file-" + Date.now());
  return DCDN.request("/v2/api/entity/upload_file/" + entity + "/" + fieldKey, { method: "POST", body: formData });
};

DCDN.entity = function entity(entityKey) {
  /* docs + examples: DCDN.help("entity")  or  DCDN.entity in the console */
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
  /* docs + examples: DCDN.help("storage.key")  or  DCDN.storage.key in the console */
  return "app_" + appId + "_" + name;
};

DCDN.storage.set = function set(appId, name, value, options) {
  /* docs + examples: DCDN.help("storage.set")  or  DCDN.storage.set in the console */
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
  /* docs + examples: DCDN.help("storage.get")  or  DCDN.storage.get in the console */
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
  /* docs + examples: DCDN.help("storage.has")  or  DCDN.storage.has in the console */
  return DCDN.storage.get(appId, name) !== null;
};

DCDN.storage.remove = function remove(appId, name) {
  /* docs + examples: DCDN.help("storage.remove")  or  DCDN.storage.remove in the console */
  storageDelete(DCDN.storage.key(appId, name));
};

DCDN.storage.clear = function clear(appId) {
  /* docs + examples: DCDN.help("storage.clear")  or  DCDN.storage.clear in the console */
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
  /* docs + examples: DCDN.help("getSiteInfo")  or  DCDN.getSiteInfo in the console */
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
  /* docs + examples: DCDN.help("getSite")  or  DCDN.getSite in the console */
  return DCDN.getSiteInfo(options).then(function (info) {
    return (info && info.Site) || info || {};
  });
};

DCDN.getSiteInfoSync = function getSiteInfoSync() {
  /* docs + examples: DCDN.help("getSiteInfoSync")  or  DCDN.getSiteInfoSync in the console */
  return readCachedSiteInfo();
};

DCDN.clearSiteInfo = function clearSiteInfo() {
  /* docs + examples: DCDN.help("clearSiteInfo")  or  DCDN.clearSiteInfo in the console */
  storageDelete(DCDN.config.siteInfoKey);
};

DCDN.getAppSettings = function getAppSettings(entityKey, options) {
  /* docs + examples: DCDN.help("getAppSettings")  or  DCDN.getAppSettings in the console */
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
  /* docs + examples: DCDN.help("detectLang")  or  DCDN.detectLang in the console */
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
  /* docs + examples: DCDN.help("isRTL")  or  DCDN.isRTL in the console */
  return DCDN.detectLang() === "ar";
};

DCDN.isEn = function isEn() {
  /* docs + examples: DCDN.help("isEn")  or  DCDN.isEn in the console */
  return DCDN.detectLang() === "en";
};

DCDN.t = function t(arabicText, englishText) {
  /* docs + examples: DCDN.help("t")  or  DCDN.t in the console */
  if (englishText === undefined) return pickText(arabicText);
  return DCDN.detectLang() === "en" ? englishText : arabicText;
};

DCDN.translate = function translate(words, options) {
  /* docs + examples: DCDN.help("translate")  or  DCDN.translate in the console */
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
  /* docs + examples: DCDN.help("translateText")  or  DCDN.translateText in the console */
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
  /* docs + examples: DCDN.help("applyBodyClasses")  or  DCDN.applyBodyClasses in the console */
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
  /**
   * Inject the DCDN styles (<style id="dcdn-styles">) once. Called automatically by every UI function.
   *
   * @returns {HTMLStyleElement}
   */
  var style = DCDN.injectCSS(DCDN_CSS, "dcdn-styles");
  document.documentElement.style.setProperty("--dcdn-z", DCDN.config.zIndex);
  document.documentElement.style.setProperty("--dcdn-primary", DCDN.config.primaryColor);
  return style;
}
DCDN.ensureStyles = ensureStyles;

/* ================================ loader ================================= */

var openLoaderCount = 0; // nested showLoader() calls

DCDN.showLoader = function showLoader(text) {
  /* docs + examples: DCDN.help("showLoader")  or  DCDN.showLoader in the console */
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
  /* docs + examples: DCDN.help("hideLoader")  or  DCDN.hideLoader in the console */
  openLoaderCount = force ? 0 : Math.max(0, openLoaderCount - 1);
  if (openLoaderCount > 0) return;
  var loader = document.getElementById("dcdn-loader");
  if (loader) loader.style.display = "none";
};

DCDN.toggleLoadingSpinner = function toggleLoadingSpinner(show, text) {
  /* docs + examples: DCDN.help("toggleLoadingSpinner")  or  DCDN.toggleLoadingSpinner in the console */
  return show ? DCDN.showLoader(text) : DCDN.hideLoader(true);
};

DCDN.withLoader = function withLoader(work, text) {
  /* docs + examples: DCDN.help("withLoader")  or  DCDN.withLoader in the console */
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
  /* docs + examples: DCDN.help("toast")  or  DCDN.toast in the console */
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
  /* docs + examples: DCDN.help("progressBar")  or  DCDN.progressBar in the console */
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
  /* docs + examples: DCDN.help("showPopup")  or  DCDN.showPopup in the console */
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
      newContent = unwrapEnvelope(newContent);
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
  /* docs + examples: DCDN.help("closePopup")  or  DCDN.closePopup in the console */
  var popup = popupId
    ? openPopups.filter(function (item) {
        return item.id === popupId;
      })[0]
    : openPopups[openPopups.length - 1];
  if (popup) popup.close();
};

DCDN.confirm = function confirm(message, options) {
  /* docs + examples: DCDN.help("confirm")  or  DCDN.confirm in the console */
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
  /* docs + examples: DCDN.help("alert")  or  DCDN.alert in the console */
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
  /* docs + examples: DCDN.help("registerTabPage")  or  DCDN.registerTabPage in the console */
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
  /* docs + examples: DCDN.help("appendTab")  or  DCDN.appendTab in the console */
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
        newContent = unwrapEnvelope(newContent);
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
  list = unwrapEnvelope(list);
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
  /* docs + examples: DCDN.help("addDropdown")  or  DCDN.addDropdown in the console */
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
  if (typeof source === "function") return DCDN.parseNumber(unwrapEnvelope(source(targetInput)));
  var element = getElement(source);
  if (!element) return 0;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) return DCDN.parseNumber(element.value);
  return DCDN.parseNumber(element.textContent);
}

DCDN.calculatePercent = function calculatePercent(target, settings) {
  /* docs + examples: DCDN.help("calculatePercent")  or  DCDN.calculatePercent in the console */
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
  /* docs + examples: DCDN.help("table.addSerials")  or  DCDN.table.addSerials in the console */
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
  /* docs + examples: DCDN.help("table.swapColumns")  or  DCDN.table.swapColumns in the console */
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
  /* docs + examples: DCDN.help("table.hideColumn")  or  DCDN.table.hideColumn in the console */
  var tableElement = getElement(table);
  if (!tableElement) return;
  for (var i = 0, row; (row = tableElement.rows[i]); i++) {
    if (row.cells[columnIndex]) row.cells[columnIndex].style.display = "none";
  }
};

DCDN.table.toJSON = function toJSON(table) {
  /* docs + examples: DCDN.help("table.toJSON")  or  DCDN.table.toJSON in the console */
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
  /* docs + examples: DCDN.help("table.exportToExcel")  or  DCDN.table.exportToExcel in the console */
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
  /* docs + examples: DCDN.help("exportCSV")  or  DCDN.exportCSV in the console */
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
  /* docs + examples: DCDN.help("downloadBlob")  or  DCDN.downloadBlob in the console */
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
  /* docs + examples: DCDN.help("formatCells")  or  DCDN.formatCells in the console */
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
  /* docs + examples: DCDN.help("numberToArabicWords")  or  DCDN.numberToArabicWords in the console */
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
  /* docs + examples: DCDN.help("numberToEnglishWords")  or  DCDN.numberToEnglishWords in the console */
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
  /* docs + examples: DCDN.help("numberToWords")  or  DCDN.numberToWords in the console */
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


/* ---- 08-daftra-native.js ---- */
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
  /* docs + examples: DCDN.help("nativeLoader")  or  DCDN.nativeLoader in the console */
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
  /* docs + examples: DCDN.help("initPage")  or  DCDN.initPage in the console */
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
  /* docs + examples: DCDN.help("nativeAlert")  or  DCDN.nativeAlert in the console */
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
  /* docs + examples: DCDN.help("flashToast")  or  DCDN.flashToast in the console */
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
  /* docs + examples: DCDN.help("noticeAfterReload")  or  DCDN.noticeAfterReload in the console */
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
  /* docs + examples: DCDN.help("showPendingNotice")  or  DCDN.showPendingNotice in the console */
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
  /* docs + examples: DCDN.help("getFieldColumn")  or  DCDN.getFieldColumn in the console */
  var input = resolveFieldElement(field);
  if (!input) return null;
  var column = input.closest('[class*="col-lg-"]') || input.closest(".form-group") || input.parentNode;
  var group = column && column.querySelector(":scope > .form-group");
  return group || column;
};

DCDN.clearFieldError = function clearFieldError(field) {
  /* docs + examples: DCDN.help("clearFieldError")  or  DCDN.clearFieldError in the console */
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
  /* docs + examples: DCDN.help("clearAllFieldErrors")  or  DCDN.clearAllFieldErrors in the console */
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
  /* docs + examples: DCDN.help("showFieldError")  or  DCDN.showFieldError in the console */
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
  /* docs + examples: DCDN.help("bindSaveValidation")  or  DCDN.bindSaveValidation in the console */
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
  /* docs + examples: DCDN.help("prependBreadcrumb")  or  DCDN.prependBreadcrumb in the console */
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
  /* docs + examples: DCDN.help("setBreadcrumbs")  or  DCDN.setBreadcrumbs in the console */
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
  /* docs + examples: DCDN.help("stepsHeader")  or  DCDN.stepsHeader in the console */
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
  /* docs + examples: DCDN.help("addListButton")  or  DCDN.addListButton in the console */
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
  /* docs + examples: DCDN.help("hideEarly")  or  DCDN.hideEarly in the console */
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
  /* docs + examples: DCDN.help("hideElements")  or  DCDN.hideElements in the console */
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
  /* docs + examples: DCDN.help("hideFormField")  or  DCDN.hideFormField in the console */
  var key = entityKey || DCDN.getPageInfo().entity;
  return DCDN.hideElements(
    [".container-" + key + "_custom_data-" + fieldKey, ".container-" + key + "-" + fieldKey, '[class*="col-lg-"]:has(> * [id$="--' + fieldKey + '"])'],
    "dcdn-hide-field-" + fieldKey
  );
};

DCDN.replaceAddButton = function replaceAddButton(options) {
  /* docs + examples: DCDN.help("replaceAddButton")  or  DCDN.replaceAddButton in the console */
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
  /* docs + examples: DCDN.help("addSidebarLink")  or  DCDN.addSidebarLink in the console */
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
  /* docs + examples: DCDN.help("formatCurrency")  or  DCDN.formatCurrency in the console */
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
  /* docs + examples: DCDN.help("unwrapEntity")  or  DCDN.unwrapEntity in the console */
  if (response && typeof response === "object" && response.payload && typeof response.payload === "object" &&
      response.payload.data && typeof response.payload.data === "object") {
    return response.payload.data;
  }
  return response;
};

var workflowTypeRequests = {};

DCDN.getWorkflowType = function getWorkflowType(name, options) {
  /* docs + examples: DCDN.help("getWorkflowType")  or  DCDN.getWorkflowType in the console */
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
  /* docs + examples: DCDN.help("getEntityKeyId")  or  DCDN.getEntityKeyId in the console */
  var key = typeof entityKeyOrType === "string" ? entityKeyOrType : entityKeyOrType && entityKeyOrType.entity_key;
  var match = /(\d+)$/.exec(key || "");
  return match ? match[1] : null;
};

DCDN.getFirstRecord = function getFirstRecord(entityKey, options) {
  /* docs + examples: DCDN.help("getFirstRecord")  or  DCDN.getFirstRecord in the console */
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
  /* docs + examples: DCDN.help("updateRecord")  or  DCDN.updateRecord in the console */
  options = options || {};
  var body = Object.assign({}, unwrapEnvelope(fields), { id: id });
  if (options.parentLink) body[options.parentLink.field] = options.parentLink.value;
  return DCDN.request("/v2/api/entity/" + entityKey + "/" + id, { method: "PUT", body: body }).then(function (response) {
    return extractResult(response, {});
  });
};

DCDN.subformKey = function subformKey(entityKey, subformField) {
  /* docs + examples: DCDN.help("subformKey")  or  DCDN.subformKey in the console */
  return entityKey + "_" + entityKey + "_" + subformField;
};

DCDN.upsertSubformRows = function upsertSubformRows(entityKey, recordId, subformField, rows, options) {
  /* docs + examples: DCDN.help("upsertSubformRows")  or  DCDN.upsertSubformRows in the console */
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
  /* docs + examples: DCDN.help("parseMultiValue")  or  DCDN.parseMultiValue in the console */
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
  /* docs + examples: DCDN.help("getPageContext")  or  DCDN.getPageContext in the console */
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
  /* docs + examples: DCDN.help("nowInTimeZone")  or  DCDN.nowInTimeZone in the console */
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
  /* docs + examples: DCDN.help("ageOnDate")  or  DCDN.ageOnDate in the console */
  var birth = parseDateParts(dateOfBirth);
  var on = parseDateParts(onDate || new Date());
  if (!birth || !on) return null;
  var age = on.y - birth.y;
  if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) age -= 1;
  return age >= 0 ? age : null;
};

var cachedRequests = {};

DCDN.cached = function cached(key, work, options) {
  /* docs + examples: DCDN.help("cached")  or  DCDN.cached in the console */
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
  /* docs + examples: DCDN.help("setReturnUrl")  or  DCDN.setReturnUrl in the console */
  try {
    localStorage.setItem(key, url || location.href);
    return true;
  } catch (e) {
    return false;
  }
};

DCDN.handleReturnRedirect = function handleReturnRedirect(options) {
  /* docs + examples: DCDN.help("handleReturnRedirect")  or  DCDN.handleReturnRedirect in the console */
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


/* ---- 09-language-pack.js ---- */
/* ==========================================================================
 * 09-language-pack.js
 * ----------------------------------------------------------------------------
 * DCDN.languagePack(options): the "Language Pack" translation engine, configurable.
 * Translates text, attributes, the tab title, dropdown placeholders, Daftra
 * dynamic-dropdown display inputs, same-origin iframes and content added later.
 * Whole middleware SENTENCES (with {slots}) can be swapped as one piece.
 * ======================================================================== */

var DYNAMIC_DROPDOWN_ATTRIBUTE = "data-izam1-forms1-dynamic-drop-down";
var languagePacks = []; // every pack created on the page (DCDN.translateLanguagePack runs them all)

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn a sentence definition into a rule:
 *   { en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }       (template with {slots})
 *   { pattern: "Sent (?<count>\\d+) journals", ar: "...", length: 18 }  (ready regex, from build-sentences)
 */
function buildSentenceRule(sentence, toArabic) {
  if (sentence.pattern) {
    return { regex: new RegExp(sentence.pattern, "g"), to: sentence.ar, length: sentence.length || sentence.pattern.length };
  }
  var from = toArabic ? sentence.en : sentence.ar;
  var to = toArabic ? sentence.ar : sentence.en;
  var source = escapeRegExp(from).replace(/\\\{(\w+)\\\}/g, function (all, name) {
    return "(?<" + name + ">.+?)";
  });
  return { regex: new RegExp(source, "g"), to: to, length: from.length };
}

DCDN.languagePack = function languagePack(options) {
  /* docs + examples: DCDN.help("languagePack")  or  DCDN.languagePack in the console */
  options = options || {};
  var phrases = [];
  var sentences = [];
  var wordRules = [];
  var sentenceRules = [];
  var sentenceNodes = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  var skipSelector = options.skipSelector || "script, style, noscript, textarea, input, select, option, iframe, .dcdn-no-translate";
  var attributes = options.attributes || ["placeholder", "title", "aria-label", "data-float-label"];
  var observer = null;
  var stopped = false;

  function toArabic() {
    if (options.direction === "toArabic") return true;
    if (options.direction === "toEnglish") return false;
    return DCDN.isRTL();
  }

  function isActive() {
    return !stopped && (!options.arabicPagesOnly || DCDN.isRTL());
  }

  function rebuildRules() {
    var arabic = toArabic();
    wordRules = phrases
      .map(function (pair) {
        var from = arabic ? pair.en : pair.ar;
        var to = arabic ? pair.ar : pair.en;
        if (!from || to == null || from === to) return null;
        var source = escapeRegExp(from);
        if (options.wholeWords) source = "(?<![\\w-])" + source + "(?![\\w-])";
        return { regex: new RegExp(source, "g"), to: to, length: from.length };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.length - a.length;
      });
    sentenceRules = sentences
      .map(function (sentence) {
        return buildSentenceRule(sentence, arabic);
      })
      .sort(function (a, b) {
        return b.length - a.length;
      });
  }

  function normalizePairs(list) {
    return (unwrapEnvelope(list) || []).map(function (pair) {
      return Array.isArray(pair) ? { en: pair[0], ar: pair[1] } : pair;
    });
  }

  function applyWords(text) {
    return wordRules.reduce(function (updated, rule) {
      return updated.replace(rule.regex, rule.to);
    }, text);
  }

  function applySentences(text) {
    return sentenceRules.reduce(function (updated, rule) {
      return updated.replace(rule.regex, function () {
        var groups = arguments[arguments.length - 1];
        if (!groups || typeof groups !== "object") return rule.to;
        return rule.to.replace(/\{(\w+)\}/g, function (slot, name) {
          return groups[name] != null ? groups[name] : slot;
        });
      });
    }, text);
  }

  function isSkipped(element) {
    return !element || (element.closest && !!element.closest(skipSelector));
  }

  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return isSkipped(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    var current;
    while ((current = walker.nextNode())) nodes.push(current);
    nodes.forEach(function (node) {
      if (sentenceNodes && sentenceNodes.has(node)) return;
      var sentenceText = applySentences(node.nodeValue);
      if (sentenceText !== node.nodeValue) {
        node.nodeValue = sentenceText;
        if (sentenceNodes) sentenceNodes.add(node);
        return;
      }
      var updated = applyWords(node.nodeValue);
      if (updated !== node.nodeValue) node.nodeValue = updated;
    });
  }

  function translateAttributes(root) {
    var elements = [root].concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll("*") : []));
    elements.forEach(function (element) {
      if (!element.getAttribute) return;
      // labels on inputs/selects are translated even though their VALUES are skipped
      var isControl = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
      if (!isControl && isSkipped(element)) return;
      attributes.forEach(function (name) {
        var value = element.getAttribute(name);
        if (!value || !value.trim()) return;
        var updated = applyWords(value);
        if (updated !== value) element.setAttribute(name, updated);
      });
    });
  }

  function looksLikeLabel(text) {
    text = String(text || "").trim();
    return !!text && phrases.some(function (pair) {
      return text.indexOf(pair.en) > -1 || text.indexOf(pair.ar) > -1;
    });
  }

  function translateDropdowns(root) {
    getElements("option", root).forEach(function (option) {
      var value = String(option.value || "").trim();
      var text = String(option.textContent || "").trim();
      var isPlaceholder = !value || value === "0" || !text || phrases.some(function (pair) {
        return text === pair.en || text === pair.ar;
      });
      if (!isPlaceholder) return;
      var updated = applyWords(option.textContent);
      if (updated !== option.textContent) option.textContent = updated;
    });
    getElements("select[" + DYNAMIC_DROPDOWN_ATTRIBUTE + "]", root).forEach(function (select) {
      var scope = select.closest(".form-group, .mb-3, .row, td, th, .col, .field-group") || select.parentNode;
      getElements("input", scope).forEach(function (input) {
        if (input.type === "hidden" || input.type === "search" || !input.value || !input.value.trim()) return;
        var isDisplay = input.hasAttribute("readonly") || input.disabled || looksLikeLabel(input.value);
        if (!isDisplay) return;
        var updated = applyWords(input.value);
        if (updated !== input.value) input.value = updated;
      });
    });
  }

  function iframeDocument(frame) {
    try {
      return frame.contentDocument || (frame.contentWindow && frame.contentWindow.document) || null;
    } catch (e) {
      return null; // cross-origin
    }
  }

  function translateDocument(targetDocument) {
    if (!targetDocument || !targetDocument.body) return;
    if (options.title !== false && targetDocument.title) {
      var title = applyWords(targetDocument.title);
      if (title !== targetDocument.title) targetDocument.title = title;
    }
    translateRoot(targetDocument.body);
  }

  function translateIframes(root) {
    if (options.iframes === false || !root.querySelectorAll) return;
    getElements("iframe", root).forEach(function (frame) {
      if (!frame.__dcdnPackBound) {
        frame.__dcdnPackBound = true;
        frame.addEventListener("load", function () {
          if (isActive()) translateDocument(iframeDocument(frame));
        });
      }
      var frameDocument = iframeDocument(frame);
      if (frameDocument) {
        translateDocument(frameDocument);
        translateIframes(frameDocument);
      }
    });
  }

  function translateRoot(root) {
    translateTextNodes(root);
    translateAttributes(root);
    if (options.dropdowns !== false) translateDropdowns(root);
  }

  /* ---------------- controller ---------------- */

  var pack = {
    phrases: phrases,

    translate: function (rootOrSelector) {
      if (!isActive()) return;
      var root = unwrapEnvelope(rootOrSelector);
      root = root ? getElement(root) : document.body;
      if (!root) return;
      if (root.nodeType === 9) {
        translateDocument(root);
        translateIframes(root);
        return;
      }
      if (root === document.body && options.title !== false && document.title) {
        var title = applyWords(document.title);
        if (title !== document.title) document.title = title;
      }
      translateRoot(root);
      translateIframes(root);
    },

    translateText: function (text) {
      var value = String(text == null ? "" : text);
      var sentence = applySentences(value);
      return sentence !== value ? sentence : applyWords(value);
    },

    translateSentence: function (text) {
      return applySentences(String(text == null ? "" : text));
    },

    addPhrases: function (list) {
      normalizePairs(list).forEach(function (pair) {
        phrases.push(pair);
      });
      rebuildRules();
      pack.translate();
    },

    addSentences: function (list) {
      (unwrapEnvelope(list) || []).forEach(function (sentence) {
        sentences.push(sentence);
      });
      rebuildRules();
      pack.translate();
    },

    stop: function () {
      stopped = true;
      if (observer) observer.disconnect();
      languagePacks = languagePacks.filter(function (item) {
        return item !== pack;
      });
    },
  };

  normalizePairs(options.phrases).forEach(function (pair) {
    phrases.push(pair);
  });
  (options.sentences || []).forEach(function (sentence) {
    sentences.push(sentence);
  });
  rebuildRules();
  languagePacks.push(pack);

  if (options.autoStart !== false) {
    DCDN.onReady(function () {
      if (!isActive()) return;
      pack.translate();
      if (options.observe !== false && window.MutationObserver && document.body) {
        var schedule = DCDN.debounce(function () {
          pack.translate();
        }, 120);
        observer = new MutationObserver(function (mutations) {
          var hasNewElements = mutations.some(function (mutation) {
            return Array.prototype.some.call(mutation.addedNodes || [], function (node) {
              return node && node.nodeType === 1;
            });
          });
          if (hasNewElements) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      // Daftra injects dynamic-dropdown panels when they open
      document.addEventListener("focusin", function (event) {
        if (event.target && event.target.matches && event.target.matches("select[" + DYNAMIC_DROPDOWN_ATTRIBUTE + "]")) setTimeout(pack.translate, 0);
      });
      document.addEventListener("click", function (event) {
        if (event.target && event.target.closest && event.target.closest("select[" + DYNAMIC_DROPDOWN_ATTRIBUTE + "]")) setTimeout(pack.translate, 0);
      });
    });
    window.addEventListener("load", function () {
      pack.translate();
    });
  }
  return pack;
};

DCDN.translateLanguagePack = function translateLanguagePack(rootOrSelector) {
  /* docs + examples: DCDN.help("translateLanguagePack")  or  DCDN.translateLanguagePack in the console */
  languagePacks.forEach(function (pack) {
    pack.translate(rootOrSelector);
  });
  return languagePacks.length;
};


/* ---- 98-public.js ---- */
/* ==========================================================================
 * 98-public.js
 * ----------------------------------------------------------------------------
 * The PUBLIC API: every DCDN.xxx() you call returns JSON.
 *
 *   success  ->  { success: true }                          (nothing to return)
 *                { success: true, data: <result> }
 *                { success: true, data: [rows], meta: { total, pages, page } }   (lists)
 *   failure  ->  { success: false, error: { name, message, status, data } }
 *
 * - Async functions resolve the envelope (they NEVER reject / throw).
 * - Sync functions return the envelope directly.
 * - Page elements are never inside the JSON:
 *     a returned element  -> data: "<input#id.class>"  + res.element (the real node, hidden from JSON)
 *     UI controllers (tab, popup, progress bar, dropdown...) keep their methods,
 *     their element properties are hidden from JSON.
 *
 * The real implementation (plain values, readable code) is in  DCDN.raw.
 *   DCDN.raw.isRTL()  -> true        DCDN.isRTL()  -> { success: true, data: true }
 * ======================================================================== */

function isDomNode(value) {
  return !!(value && typeof value === "object" && typeof value.nodeType === "number" && typeof value.nodeName === "string");
}

function isNodeCollection(value) {
  if (!value || typeof value !== "object") return false;
  if (value.jquery) return true;
  if (typeof NodeList !== "undefined" && value instanceof NodeList) return true;
  return Array.isArray(value) && value.length > 0 && value.every(isDomNode);
}

/** Hide element properties of controllers so JSON.stringify(result) stays clean. */
function hideElementProperties(object) {
  if (!object || typeof object !== "object" || isDomNode(object)) return;
  Object.keys(object).forEach(function (key) {
    var value = object[key];
    if (isDomNode(value) || (value && value.jquery)) {
      Object.defineProperty(object, key, { value: value, enumerable: false, writable: true, configurable: true });
    }
  });
}

/** Turn any error into plain JSON. */
function errorToJson(error) {
  if (!error) return { name: "Error", message: "Unknown error" };
  if (typeof error === "string") return { name: "Error", message: error };
  var json = { name: error.name || "Error", message: error.message || String(error) };
  if (error.status != null) json.status = error.status;
  if (error.data !== undefined) json.data = toPlainValue(error.data);
  return json;
}

/** Wrap a plain result into the success envelope. */
/** Hidden marker so DCDN can recognise its own JSON (not part of JSON.stringify). */
function markEnvelope(envelope) {
  Object.defineProperty(envelope, "__dcdn", { value: true, enumerable: false });
  return envelope;
}

function successEnvelope(value) {
  var envelope = markEnvelope({ success: true });
  if (value === undefined) return envelope;

  if (isDomNode(value)) {
    envelope.data = toPlainValue(value);
    Object.defineProperty(envelope, "element", { value: value, enumerable: false });
    return envelope;
  }

  if (isNodeCollection(value)) {
    var nodes = Array.prototype.slice.call(value);
    envelope.data = nodes.map(function (node) {
      return toPlainValue(node);
    });
    Object.defineProperty(envelope, "elements", { value: nodes, enumerable: false });
    return envelope;
  }

  if (Array.isArray(value)) {
    value.forEach(hideElementProperties);
    envelope.data = value;
    if (value.meta) {
      envelope.meta = {};
      ["total", "pages", "page", "fetchedPages"].forEach(function (key) {
        if (value.meta[key] != null) envelope.meta[key] = value.meta[key];
      });
    }
    return envelope;
  }

  hideElementProperties(value);
  envelope.data = value;
  return envelope;
}

function failureEnvelope(error, fallbackData) {
  var envelope = markEnvelope({ success: false, error: errorToJson(error) });
  if (fallbackData !== undefined && fallbackData !== null) envelope.data = fallbackData;
  return envelope;
}

/** Read DCDN.a.b.c from a path string. */
function resolvePath(path) {
  return path.split(".").reduce(function (object, key) {
    return object == null ? object : object[key];
  }, DCDN);
}

/**
 * Call the real function and return the JSON envelope
 * (or a Promise of it for async functions).
 */
function callPublic(path, thisArg, args) {
  var realFunction = typeof path === "function" ? path : resolvePath(path);
  if (typeof realFunction !== "function") {
    return failureEnvelope({ name: "TypeError", message: "DCDN." + path + " is not a function" });
  }

  var result;
  try {
    result = realFunction.apply(DCDN, args);
  } catch (error) {
    debugLog("error", { function: String(path), error: error });
    return failureEnvelope(error);
  }

  if (result && typeof result.then === "function") {
    var handled = handledFailures && handledFailures.get(result);
    return Promise.resolve(result).then(
      function (value) {
        if (handled && handled.error) return failureEnvelope(handled.error, value);
        return successEnvelope(value);
      },
      function (error) {
        debugLog("error", { function: String(path), error: error });
        return failureEnvelope(error);
      }
    );
  }
  if (path === "entity" && result && typeof result === "object") {
    // DCDN.entity("x").data.get / list / all / create... return JSON too
    var jsonMethods = {};
    Object.keys(result).forEach(function (method) {
      jsonMethods[method] = genericWrapper(result[method], "entity." + method);
    });
    return successEnvelope(jsonMethods);
  }
  return successEnvelope(result);
}

/* ---------------------------- building PUBLIC ---------------------------- */

var PUBLIC_FUNCTIONS = {}; // "storage.set" -> public wrapper (filled by the generated block below)

/** Register one generated public wrapper. */
function definePublic(path, wrapper) {
  PUBLIC_FUNCTIONS[path] = wrapper;
}

/** Generic wrapper for functions without a generated one (aliases, appendtab_xxx, toast.success...). */
var genericWrappers = typeof WeakMap !== "undefined" ? new WeakMap() : null;
function genericWrapper(realFunction, name) {
  if (genericWrappers && genericWrappers.has(realFunction)) return genericWrappers.get(realFunction);
  var wrapper = function () {
    return callPublic(realFunction, this, arguments);
  };
  try {
    Object.defineProperty(wrapper, "name", { value: name });
  } catch (e) {}
  wrapper.toString = function () {
    return Function.prototype.toString.call(realFunction);
  };
  if (genericWrappers) genericWrappers.set(realFunction, wrapper);
  return wrapper;
}

/** Find the public wrapper for a raw function (aliases point to the same function). */
function publicFor(rawObject, key, pathPrefix) {
  var value = rawObject[key];
  var path = pathPrefix + key;
  if (PUBLIC_FUNCTIONS[path]) return PUBLIC_FUNCTIONS[path];
  // alias, e.g. DCDN.get === DCDN.fetch
  for (var known in PUBLIC_FUNCTIONS) {
    if (resolvePath(known) === value) return PUBLIC_FUNCTIONS[known];
  }
  return genericWrapper(value, key);
}

/** Objects that hold functions and must be wrapped too (DCDN.storage, DCDN.table). */
var NAMESPACES = { storage: true, table: true };

function createPublicNamespace(rawObject, pathPrefix) {
  return new Proxy(rawObject, {
    get: function (target, key) {
      if (typeof key !== "string") return target[key];
      var value = target[key];
      if (typeof value === "function") {
        var wrapper = publicFor(target, key, pathPrefix);
        // functions with sub-functions: DCDN.toast.success ...
        Object.keys(value).forEach(function (subKey) {
          if (typeof value[subKey] === "function" && !wrapper[subKey]) {
            wrapper[subKey] = genericWrapper(value[subKey], key + "." + subKey);
          }
        });
        return wrapper;
      }
      if (pathPrefix === "" && NAMESPACES[key] && value && typeof value === "object") {
        return createPublicNamespace(value, key + ".");
      }
      return value; // version, config, currencies...
    },
    set: function (target, key, value) {
      target[key] = value; // writes go to the real object
      return true;
    },
  });
}

/** Called at the very end of the bundle: the object exposed as window.DCDN. */
function createPublicApi() {
  DCDN.raw = DCDN; // plain-value implementation, readable source
  return createPublicNamespace(DCDN, "");
}


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
  /* docs + examples: DCDN.help("exposeGlobals")  or  DCDN.exposeGlobals in the console */
  var oldNames = {
    toggleLoadingSpinner: DCDN.toggleLoadingSpinner,
    getSiteInfo: DCDN.getSiteInfo,
    addThousandSeparator: DCDN.addThousandSeparator,
    exportTableToExcel: DCDN.exportTableToExcel,
    swap: DCDN.swap,
    showPopup: DCDN.showPopup,
    closePopup: DCDN.closePopup,
    // names used by the Language Pack page codes
    showToastifyAlert: DCDN.nativeAlert,
    isRtlLanguage: DCDN.isRTL,
    formatCurrencyHtml: DCDN.formatCurrency,
    unwrapSingleEntityResponse: DCDN.unwrapEntity,
    fetchWorkflowTypeByName: DCDN.getWorkflowType,
    getWorkflowTypeRecordId: DCDN.getEntityKeyId,
    translateLanguagePack: DCDN.translateLanguagePack,
  };
  Object.keys(oldNames).forEach(function (name) {
    if (typeof window[name] === "undefined") window[name] = oldNames[name];
  });
};

debugLog("loaded", { version: VERSION, docs: "DCDN.help()" });


/* ---- generated: public JSON API (129 functions) ---- */
definePublic("configure", function configure(newOptions) {
  /**
   * Change the global configuration (merges with the current values).
   *
   * @param {Object} newOptions                    any key of DCDN.config:
   * @param {string|null} [newOptions.apiKey]      API key (only outside Daftra)
   * @param {string} [newOptions.baseUrl]          prepended to relative urls (only outside Daftra)
   * @param {number} [newOptions.retries=3]        retries for network / 5xx / 429
   * @param {number} [newOptions.retryDelay=600]   ms before the first retry (doubles each time)
   * @param {number} [newOptions.perPage=100]      default page size for fetchAll
   * @param {number} [newOptions.concurrency=4]    parallel requests for fetchAll / bulkPost
   * @param {"ar"|"en"|null} [newOptions.lang]     force the language
   * @param {string} [newOptions.siteInfoKey="site_info"]   localStorage key of the site info
   * @param {boolean} [newOptions.autoResetSiteInfo=true]   clear site info when settings are saved
   * @param {number} [newOptions.zIndex=1000000]   z-index of loader / popup / toast
   * @param {string} [newOptions.primaryColor="#1877f2"]    progress bars / primary buttons
   * @param {boolean} [newOptions.debug=false]     JSON logs of every request
   * @returns {Object}                             the whole config after the change
   *
   * Examples:
   *   DCDN.configure({ debug: true })               // log every request
   *   DCDN.configure({ lang: "en" })                // force English UI texts
   *   DCDN.configure({ retries: 5, perPage: 200 })
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.configure(...)
   */
  return callPublic("configure", this, arguments);
});

definePublic("help", function help(functionName) {
  /**
   * Print documentation in the console as JSON (and return it).
   *
   * @param {string} [functionName]   e.g. "fetch", "storage.set" (empty = list every function)
   * @returns {{functions:Array<{function:string, description:string}>}|{function:string, docs:string[]}}
   *
   * Examples:
   *   DCDN.help()                  // { functions: [{ function, description }, ...] }
   *   DCDN.help("bulkFetch")       // { function: "DCDN.bulkFetch", docs: [lines...] }
   *   DCDN.help("storage.set")     // nested functions work too
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.help(...)
   */
  return callPublic("help", this, arguments);
});

definePublic("sleep", function sleep(milliseconds) {
  /**
   * Wait for some milliseconds (use with await).
   *
   * @param {number} milliseconds
   * @returns {Promise<void>}
   *
   * Example:
   *   await DCDN.sleep(500);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.sleep(...)
   */
  return callPublic("sleep", this, arguments);
});

definePublic("debounce", function debounce(callback, waitMs) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.debounce(...)
   */
  return callPublic("debounce", this, arguments);
});

definePublic("throttle", function throttle(callback, waitMs) {
  /**
   * Return a function that runs `callback` at most once every `waitMs`.
   *
   * @param {Function} callback
   * @param {number} [waitMs=250]
   * @returns {Function}   the throttled function
   *
   * Example:
   *   window.addEventListener("scroll", DCDN.throttle(onScroll, 200));
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.throttle(...)
   */
  return callPublic("throttle", this, arguments);
});

definePublic("chunk", function chunk(array, size) {
  /**
   * Split an array into groups of `size`.
   *
   * @param {Array} array
   * @param {number} size          items per group
   * @returns {Array<Array>}
   *
   * Example:
   *   DCDN.chunk([1, 2, 3, 4, 5], 2)   // [[1, 2], [3, 4], [5]]
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.chunk(...)
   */
  return callPublic("chunk", this, arguments);
});

definePublic("uid", function uid(prefix) {
  /**
   * Random unique id string.
   *
   * @param {string} [prefix="dcdn"]
   * @returns {string}
   *
   * Example:
   *   DCDN.uid("tab")   // "tab_k3j9x2a"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.uid(...)
   */
  return callPublic("uid", this, arguments);
});

definePublic("escapeHtml", function escapeHtml(text) {
  /**
   * Escape text before putting it inside HTML (prevents broken markup / XSS).
   *
   * @param {*} text
   * @returns {string}
   *
   * Example:
   *   $("#box").html("<b>" + DCDN.escapeHtml(client.name) + "</b>");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.escapeHtml(...)
   */
  return callPublic("escapeHtml", this, arguments);
});

definePublic("toEnDigits", function toEnDigits(text) {
  /**
   * Convert Arabic-Indic (٠١٢) and Persian (۰۱۲) digits to 0-9.
   *
   * @param {*} text
   * @returns {string}
   *
   * Example:
   *   DCDN.toEnDigits("١٢٣٫٥")   // "123.5"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.toEnDigits(...)
   */
  return callPublic("toEnDigits", this, arguments);
});

definePublic("parseNumber", function parseNumber(value) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.parseNumber(...)
   */
  return callPublic("parseNumber", this, arguments);
});

definePublic("round", function round(number, decimals) {
  /**
   * Correct rounding (fixes 1.005 -> 1.01).
   *
   * @param {number|string} number
   * @param {number} [decimals=2]
   * @returns {number}
   *
   * Example:
   *   DCDN.round(1.005, 2)   // 1.01
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.round(...)
   */
  return callPublic("round", this, arguments);
});

definePublic("formatNumber", function formatNumber(value, decimals, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.formatNumber(...)
   */
  return callPublic("formatNumber", this, arguments);
});

definePublic("addThousandSeparator", function addThousandSeparator(value) {
  /**
   * Old name kept for compatibility. Same as DCDN.formatNumber(value).
   *
   * @param {number|string} value
   * @returns {string}
   *
   * Example:
   *   DCDN.addThousandSeparator(1234567.5)   // "1,234,567.5"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.addThousandSeparator(...)
   */
  return callPublic("addThousandSeparator", this, arguments);
});

definePublic("formatDate", function formatDate(date, format) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.formatDate(...)
   */
  return callPublic("formatDate", this, arguments);
});

definePublic("today", function today(format) {
  /**
   * Today's date as text.
   *
   * @param {string} [format="YYYY-MM-DD"]
   * @returns {string}
   *
   * Examples:
   *   DCDN.today()                  // "2026-10-18"
   *   DCDN.today("DD/MM/YYYY")      // "18/10/2026"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.today(...)
   */
  return callPublic("today", this, arguments);
});

definePublic("addDays", function addDays(date, days, format) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.addDays(...)
   */
  return callPublic("addDays", this, arguments);
});

definePublic("getUrlParam", function getUrlParam(name, url) {
  /**
   * Read a query-string parameter.
   *
   * @param {string} name
   * @param {string} [url=current page]
   * @returns {string|null}
   *
   * Example (url ...?client_id=5):
   *   DCDN.getUrlParam("client_id")   // "5"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getUrlParam(...)
   */
  return callPublic("getUrlParam", this, arguments);
});

definePublic("getRecordId", function getRecordId(url) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getRecordId(...)
   */
  return callPublic("getRecordId", this, arguments);
});

definePublic("getPageInfo", function getPageInfo(url) {
  /**
   * Describe the current Daftra page from its URL.
   *
   * @param {string} [url=current page]
   * @returns {{path:string, isV2:boolean, id:(number|null), entity?:string, workflow?:boolean, controller?:string, action:string}}
   *
   * Examples:
   *   /v2/owner/entity/le_x/15/show  -> { isV2: true,  entity: "le_x", action: "show", id: 15 }
   *   /owner/invoices/view/123       -> { isV2: false, controller: "invoices", action: "view", id: 123 }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getPageInfo(...)
   */
  return callPublic("getPageInfo", this, arguments);
});

definePublic("onReady", function onReady(callback) {
  /**
   * Run `callback` when the DOM is ready (runs immediately if already ready).
   *
   * @param {Function} callback
   * @returns {void}
   *
   * Example:
   *   DCDN.onReady(function () { DCDN.toast("ready"); });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.onReady(...)
   */
  return callPublic("onReady", this, arguments);
});

definePublic("waitForElement", function waitForElement(selector, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.waitForElement(...)
   */
  return callPublic("waitForElement", this, arguments);
});

definePublic("waitFor", function waitFor(condition, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.waitFor(...)
   */
  return callPublic("waitFor", this, arguments);
});

definePublic("onElement", function onElement(selector, callback, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.onElement(...)
   */
  return callPublic("onElement", this, arguments);
});

definePublic("loadScript", function loadScript(src, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.loadScript(...)
   */
  return callPublic("loadScript", this, arguments);
});

definePublic("loadStyle", function loadStyle(href) {
  /**
   * Load an external stylesheet once.
   *
   * @param {string} href
   * @returns {Promise<void>}
   *
   * Example:
   *   DCDN.loadStyle("https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.loadStyle(...)
   */
  return callPublic("loadStyle", this, arguments);
});

definePublic("injectCSS", function injectCSS(cssText, id) {
  /**
   * Add a <style> tag. With an id it is added only once.
   *
   * @param {string} cssText
   * @param {string} [id]          added once per id
   * @returns {HTMLStyleElement}
   *
   * Example:
   *   DCDN.injectCSS(".invoice-actions .btn { border-radius: 8px }", "my-app-css");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.injectCSS(...)
   */
  return callPublic("injectCSS", this, arguments);
});

definePublic("copyToClipboard", function copyToClipboard(text) {
  /**
   * Copy text to the clipboard. Returns a Promise.
   *
   * @param {string} text
   * @returns {Promise<void>}
   *
   * Example:
   *   DCDN.copyToClipboard(invoiceLink).then(() => DCDN.toast("Copied"));
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.copyToClipboard(...)
   */
  return callPublic("copyToClipboard", this, arguments);
});

definePublic("triggerEnter", function triggerEnter(target) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.triggerEnter(...)
   */
  return callPublic("triggerEnter", this, arguments);
});

definePublic("getUser", function getUser() {
  /**
   * The logged-in user object Daftra puts on the page (window.USER).
   *
   * @returns {{staff_id?:(number|string), branch_id?:(number|string), is_owner?:(number|boolean), role_id?:(number|string)}}  window.USER
   *
   * Example:
   *   DCDN.getUser().data.staff_id     // 0 = owner
   *   DCDN.getUser().data.branch_id
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getUser(...)
   */
  return callPublic("getUser", this, arguments);
});

definePublic("isOwner", function isOwner() {
  /**
   * true when the logged-in user is the account owner.
   *
   * @returns {boolean}
   *
   * Example:
   *   if (!DCDN.isOwner().data) $(".delete-btn").hide();
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.isOwner(...)
   */
  return callPublic("isOwner", this, arguments);
});

definePublic("getCsrfToken", function getCsrfToken() {
  /**
   * CSRF token of the page (sent automatically by DCDN.post / put / del).
   *
   * @returns {string}   "" when the page has none
   *
   * Example:
   *   $.ajaxSetup({ headers: { "X-CSRF-Token": DCDN.getCsrfToken() } });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getCsrfToken(...)
   */
  return callPublic("getCsrfToken", this, arguments);
});

definePublic("field", function field(key, root) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.field(...)
   */
  return callPublic("field", this, arguments);
});

definePublic("fields", function fields(key, root) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.fields(...)
   */
  return callPublic("fields", this, arguments);
});

definePublic("getFieldValue", function getFieldValue(target) {
  /**
   * Read a field value. Works with selectize, select2, checkbox and normal inputs.
   *
   * @param {string|Element} target     field key, selector or element
   * @returns {string|string[]|boolean|null}   selectize value / checkbox state / input value
   *
   * Examples:
   *   DCDN.getFieldValue("qty")              // by field key
   *   DCDN.getFieldValue("#ClientCity")      // by selector
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getFieldValue(...)
   */
  return callPublic("getFieldValue", this, arguments);
});

definePublic("setFieldValue", function setFieldValue(target, value, text) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.setFieldValue(...)
   */
  return callPublic("setFieldValue", this, arguments);
});

definePublic("addMenuItem", function addMenuItem(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.addMenuItem(...)
   */
  return callPublic("addMenuItem", this, arguments);
});

definePublic("buildQuery", function buildQuery(params) {
  /**
   * Turn a nested object into Daftra's bracket query string.
   * null values become a key without value (needed for is_null filters).
   *
   * @param {Object} params        nested object (null value = key without value)
   * @returns {string}
   *
   * Examples:
   *   DCDN.buildQuery({ filter: { client_id: 5 } })
   *     // "filter[client_id]=5"
   *   DCDN.buildQuery({ filter: { name: { like: "abc" }, branch_id: { in: [1, 2] } } })
   *     // "filter[name][like]=abc&filter[branch_id][in][]=1&filter[branch_id][in][]=2"
   *   DCDN.buildQuery({ filter: { follow_up_status: { is_null: null } } })
   *     // "filter[follow_up_status][is_null]"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.buildQuery(...)
   */
  return callPublic("buildQuery", this, arguments);
});

definePublic("buildUrl", function buildUrl(url, options) {
  /**
   * Build the final request url from url + options.
   * Used by every request function — you rarely need it directly.
   *
   * @param {string} url
   * @param {Object} [options]
   * @param {Object} [options.filters]        -> filter[...]  e.g. { id: { in: [1,2] }, name: { like: "a" } }
   * @param {Object} [options.sort]           -> sort[...]    e.g. { id: "desc" }
   * @param {Object} [options.params]         extra raw query parameters
   * @param {number} [options.page]           page number
   * @param {number} [options.perPage]        rows per page (per_page for v2, limit for api2)
   * @returns {string}
   *
   * Example:
   *   DCDN.buildUrl("/v2/api/entity/invoice/list/1", { filters: { client_id: 5 }, perPage: 50 })
   *   // "/v2/api/entity/invoice/list/1?filter[client_id]=5&per_page=50"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.buildUrl(...)
   */
  return callPublic("buildUrl", this, arguments);
});

definePublic("request", function request(url, options) {
  /**
   * The core request used by fetch / post / put / del. Retries automatically.
   *
   * @param {string} url
   * @param {Object} [options]
   * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [options.method="GET"]
   * @param {Object|FormData|string} [options.body]
   * @param {Object} [options.filters]        -> filter[...]  e.g. { id: { in: [1,2] }, name: { like: "a" } }
   * @param {Object} [options.sort]           -> sort[...]    e.g. { id: "desc" }
   * @param {Object} [options.params]         extra raw query parameters
   * @param {number} [options.page]           page number
   * @param {number} [options.perPage]        rows per page (per_page for v2, limit for api2)
   * @param {Object} [options.headers]          extra headers
   * @param {number} [options.retries]          override DCDN.config.retries
   * @param {boolean} [options.raw=false]       true = the browser Response
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Object|Response>}        the raw Daftra JSON (rejects with DaftraError {message, status, data})
   *
   * - JSON body is stringified and Content-Type is set for you.
   * - X-CSRF-Token is added to POST / PUT / PATCH / DELETE.
   * - Retries network errors, 5xx and 429 (DCDN.config.retries times, delay doubles).
   * - Throws a DaftraError when HTTP fails OR the response has result: "failed".
   *
   * Example:
   *   DCDN.request("/v2/api/entity/le_x/5", { method: "PATCH", body: { status: 1 } })
   *     .then(res => console.log(res))
   *     .catch(err => console.log(err.status, err.data));
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.request(...)
   */
  return callPublic("request", this, arguments);
});

definePublic("fetch", function fetch(url, options) {
  /**
   * GET one endpoint and return the RESULT directly (no res.data digging):
   *   list url    -> array of rows       (rows.meta = { total, pages, page, response })
   *   record url  -> the record object
   *   full: true  -> the raw response
   * Add  all: true  to get EVERY page (same as DCDN.fetchAll).
   *
   * @param {string} url
   * @param {Object} [options]
   * @param {Object} [options.filters]        -> filter[...]  e.g. { id: { in: [1,2] }, name: { like: "a" } }
   * @param {Object} [options.sort]           -> sort[...]    e.g. { id: "desc" }
   * @param {Object} [options.params]         extra raw query parameters
   * @param {number} [options.page]           page number
   * @param {number} [options.perPage]        rows per page (per_page for v2, limit for api2)
   * @param {boolean} [options.all=false]       true = every page (same as fetchAll)
   * @param {boolean} [options.full=false]      true = the raw Daftra response
   * @param {string|boolean} [options.unwrap=true]   api2 model name ("Invoice"), true = auto, false = keep
   * @param {boolean|string|{ar:string,en:string}} [options.loader]   full-screen loader while it runs (true = default text)
   * @param {string|{ar:string,en:string}} [options.successMessage]       success toast
   * @param {boolean|string|{ar:string,en:string}} [options.errorMessage] true = toast the error, or your own text
   * @param {function(*):void} [options.onSuccess]      callback with the plain result
   * @param {function(Error):void} [options.onError]    callback with the error (the call then reports success:false + fallback)
   * @param {function():void} [options.onComplete]      always runs at the end
   * @param {boolean} [options.silent=false]            handle errors without throwing (JSON: success:false + fallback)
   * @param {*} [options.fallback=null]                 data returned on error in silent / onError mode
   * @param {Object} [options.headers]          extra headers
   * @param {number} [options.retries]          override DCDN.config.retries
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Array|Object>}           list -> rows (+ meta {total, pages, page}), record -> object
   *
   * Examples:
   *   // await style -> { success, data, meta }
   *   const res = await DCDN.fetch("/v2/api/entity/client/list/1", { filters: { category: "VIP" } });
   *   if (res.success) {
   *     res.data.length       // rows of page 1
   *     res.meta.total        // total rows on the server
   *   } else {
   *     res.error.message     // res.error.status
   *   }
   *
   *   const all = await DCDN.fetch("/v2/api/entity/client/list/1", { all: true, loader: true });
   *   all.data                // every row
   *
   *   const inv = await DCDN.fetch("/v2/api/entity/invoice/" + DCDN.raw.getRecordId() + "/1");
   *   inv.data.no
   *
   *   const invoices = await DCDN.fetch("/api2/invoices", { unwrap: "Invoice", perPage: 20 });
   *   invoices.data[0].id     // instead of res.data[0].Invoice.id
   *
   *   const site = await DCDN.fetch("/api2/site_info");   // site.data.currency_code (Site auto-unwrapped)
   *
   *   // callback style (no await)
   *   DCDN.fetch("/v2/api/entity/staff/list/1", {
   *     loader: "جاري التحميل...",
   *     errorMessage: true,
   *     onSuccess: function (staff) { console.log(staff); },
   *   });
   *
   *   // on error: { success: false, error, data: [] }
   *   const res = await DCDN.fetch(url, { silent: true, fallback: [] });
   *
   *   // raw Daftra response inside data
   *   const raw = await DCDN.fetch("/api2/invoices", { full: true });
   *   raw.data.pagination.total_results
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.fetch(...)
   */
  return callPublic("fetch", this, arguments);
});

definePublic("post", function post(url, body, options) {
  /**
   * POST a JSON body and return the RESULT directly
   * (the created record, or what the server returns).
   *
   * @param {string} url
   * @param {Object|FormData} body
   * @param {Object} [options]
   * @param {string} [options.method="POST"]    override the method
   * @param {boolean} [options.full=false]               true = raw Daftra response
   * @param {string|boolean} [options.unwrap=true]      api2 model name to unwrap ("Invoice"), true = auto, false = keep
   * @param {Object} [options.headers]                  extra request headers
   * @param {number} [options.retries]                  override DCDN.config.retries
   * @param {boolean|string|{ar:string,en:string}} [options.loader]   full-screen loader while it runs (true = default text)
   * @param {string|{ar:string,en:string}} [options.successMessage]       success toast
   * @param {boolean|string|{ar:string,en:string}} [options.errorMessage] true = toast the error, or your own text
   * @param {function(*):void} [options.onSuccess]      callback with the plain result
   * @param {function(Error):void} [options.onError]    callback with the error (the call then reports success:false + fallback)
   * @param {function():void} [options.onComplete]      always runs at the end
   * @param {boolean} [options.silent=false]            handle errors without throwing (JSON: success:false + fallback)
   * @param {*} [options.fallback=null]                 data returned on error in silent / onError mode
   * @returns {Promise<Object>}                 the saved record / server result
   *
   * Examples:
   *   const res = await DCDN.post("/v2/api/entity/le_invoice-items",
   *     { invoice_id: 15, item_status: "Not Assigned" },
   *     { loader: true, successMessage: "تم الحفظ", errorMessage: true });
   *   res.success   // true / false
   *   res.data.id   // created record id
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
   *   const res = await DCDN.post("/api2/invoices", { Invoice: {...}, InvoiceItem: [...] }, { unwrap: "Invoice" });
   *   res.data.id
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.post(...)
   */
  return callPublic("post", this, arguments);
});

definePublic("put", function put(url, body, options) {
  /**
   * PUT a JSON body (full update). Returns the result. Same options as DCDN.post.
   *
   * @param {string} url
   * @param {Object} body
   * @param {Object} [options]                  same as DCDN.post
   * @returns {Promise<Object>}
   *
   * Example:
   *   await DCDN.put("/v2/api/entity/app_367_package/3", { name: "Gold" }, { successMessage: "تم التعديل" });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.put(...)
   */
  return callPublic("put", this, arguments);
});

definePublic("patch", function patch(url, body, options) {
  /**
   * PATCH a JSON body (partial update). Returns the result. Same options as DCDN.post.
   *
   * @param {string} url
   * @param {Object} body
   * @param {Object} [options]                  same as DCDN.post
   * @returns {Promise<Object>}
   *
   * Example:
   *   await DCDN.patch("/v2/api/entity/le_x/3", { status: 1 });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.patch(...)
   */
  return callPublic("patch", this, arguments);
});

definePublic("del", function del(url, options) {
  /**
   * DELETE a record. Returns the result. Same options as DCDN.post.
   *
   * @param {string} url
   * @param {Object} [options]                  same as DCDN.post
   * @returns {Promise<Object>}
   *
   * Example:
   *   if ((await DCDN.confirm("Delete?", { danger: true })).data) {
   *     await DCDN.del("/v2/api/entity/le_x/3", { successMessage: "تم الحذف", errorMessage: true });
   *   }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.del(...)
   */
  return callPublic("del", this, arguments);
});

definePublic("bulkFetch", function bulkFetch(url, options) {
  /**
   * Fetch MANY things in one call and return the RESULTS directly. Three ways:
   *
   * @param {string|string[]} url                list url, url template with {id}, or a list of urls
   * @param {Object} [options]
   * @param {Object} [options.filters]          same as DCDN.fetch
   * @param {Object} [options.sort]
   * @param {Object} [options.params]
   * @param {number} [options.perPage=100]
   * @param {Array<number|string>} [options.ids]   ids for the {id} template
   * @param {number} [options.maxPages]         stop after N pages
   * @param {number} [options.concurrency=4]    parallel requests
   * @param {string|boolean} [options.unwrap=true]   api2 model name, true = auto, false = keep
   * @param {boolean|string|{ar:string,en:string}} [options.progress]   progress bar (true or a title)
   * @param {function(number, number):void} [options.onProgress]        (done, total)
   * @param {boolean} [options.stopOnError=false]   ids / urls modes: stop at the first failure
   * @param {boolean|string|{ar:string,en:string}} [options.loader]   full-screen loader while it runs (true = default text)
   * @param {string|{ar:string,en:string}} [options.successMessage]       success toast
   * @param {boolean|string|{ar:string,en:string}} [options.errorMessage] true = toast the error, or your own text
   * @param {function(*):void} [options.onSuccess]      callback with the plain result
   * @param {function(Error):void} [options.onError]    callback with the error (the call then reports success:false + fallback)
   * @param {function():void} [options.onComplete]      always runs at the end
   * @param {boolean} [options.silent=false]            handle errors without throwing (JSON: success:false + fallback)
   * @param {*} [options.fallback=null]                 data returned on error in silent / onError mode
   * @returns {Promise<Array>}                  rows (+ meta {total, pages, page, fetchedPages}) / one result per url
   *
   * 1) ALL pages of a list (pages are requested in parallel, then merged):
   *      const res = await DCDN.fetchAll("/v2/api/entity/product/list/1", {
   *        filters: { "category.name": "extras" },
   *        perPage: 100,
   *        progress: true,              // shows a progress bar
   *      });
   *      res.data.length                // every row of every page
   *      res.meta.total                 // total reported by the server
   *
   *    api2 rows are wrapped by model name -> `unwrap`:
   *      const res = await DCDN.fetchAll("/api2/invoices", { unwrap: "Invoice" });
   *      // res.data = [{ id, no, ... }]  instead of [{ Invoice: {...}, InvoiceItem: [...] }]
   *
   * 2) Many records by id (url template with {id}) -> array of records:
   *      const res = await DCDN.fetchAll("/v2/api/entity/invoice/{id}/1", { ids: [10, 11, 12] });
   *      res.data   // [record, record, record]
   *
   * 3) A list of urls -> array of results (same order):
   *      const res = await DCDN.fetchAll(["/api2/site_info", "/v2/api/entity/staff/list/1"]);
   *      const [site, staff] = res.data;
   *      site.currency_code;   staff.length
   *
   * Callback style:
   *   DCDN.fetchAll("/v2/api/entity/client/list/1", {
   *     progress: "تحميل العملاء",
   *     onSuccess: function (clients) { DCDN.toast(clients.length + " clients"); },   // callbacks get the plain data
   *     errorMessage: true,
   *   });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.bulkFetch(...)
   */
  return callPublic("bulkFetch", this, arguments);
});

definePublic("bulkPost", function bulkPost(url, items, options) {
  /**
   * Send MANY records (POST by default) with limited parallel requests.
   * One failure does not stop the others (unless stopOnError: true).
   *
   * @param {string|function(*, number):string} url   one url, or (item, index) => url
   * @param {Array} items                       bodies (or anything + transform)
   * @param {Object} [options]
   * @param {"POST"|"PUT"|"PATCH"|"DELETE"} [options.method="POST"]
   * @param {number} [options.concurrency=3]
   * @param {number} [options.delay=0]          ms after each request
   * @param {function(*, number):Object} [options.transform]   (item, index) => body
   * @param {boolean} [options.stopOnError=false]
   * @param {boolean|string|{ar:string,en:string}} [options.progress]
   * @param {function(number, number, Object):void} [options.onProgress]   (done, total, result)
   * @param {boolean|string|{ar:string,en:string}} [options.loader]   full-screen loader while it runs (true = default text)
   * @param {string|{ar:string,en:string}} [options.successMessage]       success toast
   * @param {boolean|string|{ar:string,en:string}} [options.errorMessage] true = toast the error, or your own text
   * @param {function(*):void} [options.onSuccess]      callback with the plain result
   * @param {function(Error):void} [options.onError]    callback with the error (the call then reports success:false + fallback)
   * @param {function():void} [options.onComplete]      always runs at the end
   * @param {boolean} [options.silent=false]            handle errors without throwing (JSON: success:false + fallback)
   * @param {*} [options.fallback=null]                 data returned on error in silent / onError mode
   * @returns {Promise<{results:Array<{item:*, ok:boolean, data?:*, error?:Error}>, success:Array, failed:Array}>}
   *
   * Examples:
   *   const res = await DCDN.bulkPost("/v2/api/entity/le_invoice-items", items, { progress: true });
   *   res.data.success.length   // saved
   *   res.data.failed.length    // failed
   *
   *   // update many invoice items, one url per item
   *   await DCDN.bulkPost(
   *     row => "/v2/api/entity/invoice_item/" + row.id + "/fields",
   *     rows,
   *     { transform: row => ({ status: 1 }), concurrency: 2, delay: 100 }
   *   );
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.bulkPost(...)
   */
  return callPublic("bulkPost", this, arguments);
});

definePublic("uploadFile", function uploadFile(entity, fieldKey, file, filename) {
  /**
   * Upload a file / image to a v2 entity file field.
   * Returns the upload response (use its id when saving the record).
   *
   * @param {string} entity              e.g. "le_client_m"
   * @param {string} fieldKey            e.g. "le_client_m.file"
   * @param {Blob|File} file
   * @param {string} [filename]
   * @returns {Promise<Object>}          upload result (use its id when saving)
   *
   * Example:
   *   const input = document.querySelector("#photo");
   *   const res = await DCDN.uploadFile("le_client_m", "le_client_m.file", input.files[0]);
   *   res.data.id
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.uploadFile(...)
   */
  return callPublic("uploadFile", this, arguments);
});

definePublic("entity", function entity(entityKey) {
  /**
   * Shortcut object for one v2 entity (custom forms, invoices, products...).
   *
   * @param {string} entityKey
   * @returns {{get:function((number|string), number=):Promise<Object>, list:function(Object=):Promise<Array>, all:function(Object=):Promise<Array>,
   *            create:function(Object):Promise<Object>, update:function((number|string), Object):Promise<Object>,
   *            updateFields:function((number|string), Object):Promise<Object>, remove:function((number|string)):Promise<Object>}}
   *
   * Example:
   *   const Items = DCDN.entity("le_invoice-items").data;   // methods return { success, data } too
   *   await Items.get(5);                               // GET    /v2/api/entity/le_invoice-items/5/1
   *   await Items.list({ filters: { invoice_id: 9 } }); // first page
   *   await Items.all({ filters: { invoice_id: 9 } });  // ALL pages (bulkFetch)
   *   await Items.create({ invoice_id: 9 });            // POST   /v2/api/entity/le_invoice-items
   *   await Items.update(5, { status: 1 });             // PUT    /v2/api/entity/le_invoice-items/5
   *   await Items.updateFields(5, { status: 1 });       // POST   /v2/api/entity/le_invoice-items/5/fields
   *   await Items.remove(5);                            // DELETE /v2/api/entity/le_invoice-items/5
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.entity(...)
   */
  return callPublic("entity", this, arguments);
});

definePublic("storage.key", function key(appId, name) {
  /**
   * The real localStorage key used for an app value: "app_{appId}_{name}"
   * (same format already used by old apps, e.g. "app_397_workflow").
   *
   * @param {number|string} appId
   * @param {string} name
   * @returns {string}
   *
   * Example:
   *   DCDN.storage.key(397, "workflow")   // "app_397_workflow"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.key(...)
   */
  return callPublic("storage.key", this, arguments);
});

definePublic("storage.set", function set(appId, name, value, options) {
  /**
   * Save a value for one app.
   * Strings are saved as-is, other values as JSON.
   *
   * @param {number|string} appId
   * @param {string} name
   * @param {*} value                     anything JSON-able
   * @param {Object} [options]
   * @param {number} [options.ttl]        seconds until it expires
   * @returns {boolean}                   false when localStorage is blocked
   *
   * Examples:
   *   DCDN.storage.set(397, "workflow", "12");                 // key: app_397_workflow
   *   DCDN.storage.set(397, "settings", { auto: true });
   *   DCDN.storage.set(397, "cache", rows, { ttl: 600 });      // expires after 10 minutes
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.set(...)
   */
  return callPublic("storage.set", this, arguments);
});

definePublic("storage.get", function get(appId, name, defaultValue) {
  /**
   * Read a value saved with DCDN.storage.set (JSON is parsed for you).
   * Returns defaultValue (or null) when missing or expired.
   *
   * @param {number|string} appId
   * @param {string} name
   * @param {*} [defaultValue=null]       returned when missing / expired
   * @returns {*}
   *
   * Examples:
   *   DCDN.storage.get(397, "workflow")              // "12"
   *   DCDN.storage.get(397, "settings", {})          // { auto: true }  or {}
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.get(...)
   */
  return callPublic("storage.get", this, arguments);
});

definePublic("storage.has", function has(appId, name) {
  /**
   * true when a (non expired) value exists.
   *
   * @param {number|string} appId
   * @param {string} name
   * @returns {boolean}
   *
   * Example:
   *   if (!DCDN.storage.has(82, "settings").data) loadSettings();
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.has(...)
   */
  return callPublic("storage.has", this, arguments);
});

definePublic("storage.remove", function remove(appId, name) {
  /**
   * Delete one value.
   *
   * @param {number|string} appId
   * @param {string} name
   * @returns {void}
   *
   * Example:
   *   DCDN.storage.remove(397, "workflow");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.remove(...)
   */
  return callPublic("storage.remove", this, arguments);
});

definePublic("storage.clear", function clear(appId) {
  /**
   * Delete every value of one app (all keys starting with "app_{appId}_").
   *
   * @param {number|string} appId
   * @returns {void}
   *
   * Example:
   *   DCDN.storage.clear(397);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.storage.clear(...)
   */
  return callPublic("storage.clear", this, arguments);
});

definePublic("getSiteInfo", function getSiteInfo(options) {
  /**
   * Site info shared by ALL apps on the account.
   *
   * @param {Object} [options]
   * @param {boolean} [options.force=false]   ignore the cache
   * @returns {Promise<{Site:Object}>}
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
   * Examples:
   *   const res = await DCDN.getSiteInfo();
   *   res.data.Site.currency_code      // "SAR"
   *
   *   DCDN.getSiteInfo().then(res => res.data.Site.language_code);   // 7 = ar, 41 = en
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.getSiteInfo(...)
   */
  return callPublic("getSiteInfo", this, arguments);
});

definePublic("getSite", function getSite(options) {
  /**
   * Shortcut for (await DCDN.getSiteInfo()).Site
   *
   * @param {Object} [options]
   * @param {boolean} [options.force=false]
   * @returns {Promise<{language_code:number, currency_code:string, country_code:string}>}   info.Site
   *
   * Example:
   *   const res = await DCDN.getSite();
   *   res.data.currency_code   // "SAR"
   *   res.data.country_code    // "SA"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.getSite(...)
   */
  return callPublic("getSite", this, arguments);
});

definePublic("getSiteInfoSync", function getSiteInfoSync() {
  /**
   * Cached site info WITHOUT a request (null if no app cached it yet).
   *
   * @returns {{Site:Object}|null}
   *
   * Example:
   *   const res = DCDN.getSiteInfoSync();
   *   if (res.data) res.data.Site.currency_code;
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getSiteInfoSync(...)
   */
  return callPublic("getSiteInfoSync", this, arguments);
});

definePublic("clearSiteInfo", function clearSiteInfo() {
  /**
   * Remove the cached site info (next getSiteInfo() fetches again).
   * Done automatically when the settings form is saved.
   *
   * @returns {void}
   *
   * Example:
   *   DCDN.clearSiteInfo();
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.clearSiteInfo(...)
   */
  return callPublic("clearSiteInfo", this, arguments);
});

definePublic("getAppSettings", function getAppSettings(entityKey, options) {
  /**
   * Read an app's settings record once and cache it in localStorage
   * (like the old setAppInfo / getAppGeneralSettings).
   *
   * @param {string} entityKey               settings entity
   * @param {Object} [options]
   * @param {number|string} [options.appId=entityKey]   storage id -> "app_{appId}_settings"
   * @param {number} [options.id=1]          record id
   * @param {number} [options.depth=1]
   * @param {number} [options.ttl]           cache seconds
   * @param {boolean} [options.force=false]
   * @returns {Promise<Object>}
   *
   * Example:
   *   const res = await DCDN.getAppSettings("le_pos_general_Settings", { appId: 82, ttl: 3600 });
   *   if (res.success && res.data.activate_beauty_app == "2") { ... }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.getAppSettings(...)
   */
  return callPublic("getAppSettings", this, arguments);
});

definePublic("detectLang", function detectLang() {
  /**
   * Detect the page language. Returns "ar" or "en".
   *
   * @returns {"ar"|"en"}
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
   *   DCDN.detectLang()                               // { success: true, data: "ar" }
   *   if (DCDN.detectLang().data === "en") { ... }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.detectLang(...)
   */
  return callPublic("detectLang", this, arguments);
});

definePublic("isRTL", function isRTL() {
  /**
   * true on Arabic (right-to-left) pages.
   *
   * @returns {boolean}
   *
   * Example:
   *   $box.css("text-align", DCDN.isRTL().data ? "right" : "left");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.isRTL(...)
   */
  return callPublic("isRTL", this, arguments);
});

definePublic("isEn", function isEn() {
  /**
   * true on English pages.
   *
   * @returns {boolean}
   *
   * Example:
   *   const label = DCDN.isEn().data ? "Save" : "حفظ";
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.isEn(...)
   */
  return callPublic("isEn", this, arguments);
});

definePublic("t", function t(arabicText, englishText) {
  /**
   * Pick the text for the page language.
   *
   * @param {string|{ar:string,en:string}|string[]} arabicText   Arabic text, or one { ar, en } / [ar, en]
   * @param {string} [englishText]
   * @returns {string}
   *
   * Examples:
   *   DCDN.t("حفظ", "Save").data            // "حفظ" on Arabic pages, "Save" on English pages
   *   DCDN.t({ ar: "حفظ", en: "Save" }).data  // same, object form
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.t(...)
   */
  return callPublic("t", this, arguments);
});

definePublic("translate", function translate(words, options) {
  /**
   * Translate texts on the page in the right direction:
   *   page is English -> Arabic words are replaced by English
   *   page is Arabic  -> English words are replaced by Arabic
   * Replaces text nodes + placeholder / title / aria-label attributes + button values.
   *
   * @param {Array<string[]|{ar:string,en:string}>} words   [[ar, en]] or [{ ar, en }]
   * @param {Object} [options]
   * @param {string|Element} [options.root=document.body]
   * @param {boolean} [options.exact=false]       whole-text matches only
   * @param {boolean} [options.observe=false]     keep translating new content
   * @param {string[]} [options.attributes]       default placeholder, title, aria-label, data-original-title
   * @param {"ar"|"en"} [options.lang]            force the target language
   * @returns {number}                            replacements made
   *
   * Examples:
   *   DCDN.translate([
   *     ["العميل", "Client"],
   *     ["الخدمات", "Services"],
   *     { ar: "العمولة (%)", en: "Commission (%)" },
   *   ]);
   *
   *   DCDN.translate([["حفظ", "Save"]], { root: "#myForm", observe: true });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.translate(...)
   */
  return callPublic("translate", this, arguments);
});

definePublic("translateText", function translateText(text, words, lang) {
  /**
   * Translate ONE string with the same word list format (no DOM).
   *
   * @param {string} text
   * @param {Array<string[]|{ar:string,en:string}>} words
   * @param {"ar"|"en"} [lang=page language]     target language
   * @returns {string}
   *
   * Example:
   *   DCDN.translateText("سجل الطلبات", [["سجل الطلبات", "Services Log"]])   // "Services Log" on English pages
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.translateText(...)
   */
  return callPublic("translateText", this, arguments);
});

definePublic("applyBodyClasses", function applyBodyClasses() {
  /**
   * Add the body classes the old apps use:
   *   "custom_app ar_app|en_app {country_code} {currency_code}"
   * Also done automatically with  <script ... data-body-classes="true">.
   *
   * @returns {Promise<Object>}   info.Site
   *
   * Example:
   *   DCDN.applyBodyClasses().then(res => res.data.currency_code);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.applyBodyClasses(...)
   */
  return callPublic("applyBodyClasses", this, arguments);
});

definePublic("showLoader", function showLoader(text) {
  /**
   * Show a full-screen loader (spinner + optional text).
   * Safe for nested calls: every showLoader() needs one hideLoader().
   *
   * @param {string|{ar:string,en:string}} [text]
   * @returns {HTMLElement}   the loader
   *
   * Examples:
   *   DCDN.showLoader();
   *   DCDN.showLoader({ ar: "جاري الحفظ...", en: "Saving..." });
   *   ...
   *   DCDN.hideLoader();
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.showLoader(...)
   */
  return callPublic("showLoader", this, arguments);
});

definePublic("hideLoader", function hideLoader(force) {
  /**
   * Hide the loader. It really hides when every showLoader() got its hideLoader().
   *
   * @param {boolean} [force=false]   hide now, ignoring nested showLoader calls
   * @returns {void}
   *
   * Examples:
   *   DCDN.hideLoader();
   *   DCDN.hideLoader(true);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.hideLoader(...)
   */
  return callPublic("hideLoader", this, arguments);
});

definePublic("toggleLoadingSpinner", function toggleLoadingSpinner(show, text) {
  /**
   * Old name kept for compatibility with existing page codes.
   *
   * @param {boolean} show
   * @param {string|{ar:string,en:string}} [text]
   * @returns {HTMLElement|void}
   *
   * Examples:
   *   DCDN.toggleLoadingSpinner(true);
   *   DCDN.toggleLoadingSpinner(false);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.toggleLoadingSpinner(...)
   */
  return callPublic("toggleLoadingSpinner", this, arguments);
});

definePublic("withLoader", function withLoader(work, text) {
  /**
   * Show the loader while a promise / async function runs, then hide it
   * (even when it fails). Returns the work result.
   *
   * @param {Promise|Function} work                     a Promise or an (async) function
   * @param {string|{ar:string,en:string}} [text]
   * @returns {Promise<*>}                               what the work returned
   *
   * Examples:
   *   const res = await DCDN.withLoader(DCDN.post(url, body), "جاري الحفظ...");
   *   res.data   // what the work returned (here: the post JSON)
   *
   *   await DCDN.withLoader(async () => {
   *     await step1();
   *     await step2();
   *   }, { ar: "جاري المعالجة", en: "Processing" });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.withLoader(...)
   */
  return callPublic("withLoader", this, arguments);
});

definePublic("toast", function toast(message, type, options) {
  /**
   * Show a small notification that disappears by itself.
   *
   * @param {string|{ar:string,en:string}} message
   * @param {"success"|"error"|"warning"|"info"} [type="success"]
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {number} [options.timeout]            ms (default 3500, errors 6000, 0 = stay)
   * @param {"top-right"|"top-left"|"top-center"|"bottom-right"|"bottom-left"|"bottom-center"} [options.position]
   * @param {boolean} [options.html=false]        message is HTML (trusted content only)
   * @returns {{el:HTMLElement, close:Function}}
   *
   * Examples:
   *   DCDN.toast("تم الحفظ");
   *   DCDN.toast({ ar: "تم", en: "Done" }, "info");
   *   DCDN.toast("حدث خطأ", "error", { title: "خطأ", timeout: 0 });
   *   DCDN.toast.success("Saved");    DCDN.toast.error("Failed");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.toast(...)
   */
  return callPublic("toast", this, arguments);
});

definePublic("progressBar", function progressBar(options) {
  /**
   * Show a progress bar (floating at the bottom, or inside a container).
   *
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {number} [options.total=0]            number of steps
   * @param {string|Element} [options.target]     render inside (default floating)
   * @param {number|boolean} [options.autoClose=1500]   ms after done() (false = keep)
   * @returns {{el:HTMLElement, update:function(number, number=):Object, increment:function(number=):Object,
   *            setText:Function, setTitle:Function, done:function(*=, number=):Object, error:Function, remove:Function}}
   *
   * Examples:
   *   const bar = DCDN.progressBar({ title: "ترحيل البنود", total: items.length }).data;
   *   for (const item of items) {
   *     await DCDN.post(url, item);
   *     bar.increment();
   *   }
   *   bar.done("تم");
   *
   *   // inside a popup / div
   *   const bar2 = DCDN.progressBar({ title: "Import", total: 100, target: "#import-box" }).data;
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.progressBar(...)
   */
  return callPublic("progressBar", this, arguments);
});

definePublic("showPopup", function showPopup(content, options) {
  /**
   * Open a modal popup with any HTML content.
   *
   * @param {string|Element|{ar:string,en:string}} content    HTML, element, jQuery or { ar, en }
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}|boolean} [options.title]   false = no header
   * @param {number|string} [options.width="560px"]
   * @param {Array<{text:(string|{ar:string,en:string}), class?:string, onClick?:function(Object, HTMLElement):void}>} [options.buttons]
   * @param {function(Object):void} [options.onOpen]
   * @param {function(*, Object):void} [options.onClose]
   * @param {boolean} [options.closeOnBackdrop=true]
   * @param {boolean} [options.closeOnEsc=true]
   * @param {string} [options.id]                 fixed id (same id replaces)
   * @param {string} [options.className]
   * @param {"rtl"|"ltr"} [options.dir]
   * @returns {{id:string, el:HTMLElement, box:HTMLElement, body:HTMLElement, setContent:Function, close:function(*=):void}}
   *
   * Examples:
   *   DCDN.showPopup("<p>مرحبا</p>", { title: "رسالة" });
   *
   *   const popup = DCDN.showPopup('<input id="note" class="form-control">', {   // popup.data.close()
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.showPopup(...)
   */
  return callPublic("showPopup", this, arguments);
});

definePublic("closePopup", function closePopup(popupId) {
  /**
   * Close the top popup, or the popup with this id.
   *
   * @param {string} [popupId]    none = the top popup
   * @returns {void}
   *
   * Examples:
   *   DCDN.closePopup();
   *   DCDN.closePopup("my-popup");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.closePopup(...)
   */
  return callPublic("closePopup", this, arguments);
});

definePublic("confirm", function confirm(message, options) {
  /**
   * Yes / no popup. Resolves true (OK) or false (Cancel / closed).
   *
   * @param {string|{ar:string,en:string}} message
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {string|{ar:string,en:string}} [options.okText]
   * @param {string|{ar:string,en:string}} [options.cancelText]
   * @param {boolean} [options.danger=false]      red OK button
   * @param {number} [options.width=420]
   * @returns {Promise<boolean>}                  true = OK
   *
   * Examples:
   *   const answer = await DCDN.confirm("هل تريد الحذف؟", { danger: true });
   *   if (answer.data) {      // true = OK, false = Cancel
   *     await DCDN.del(url);
   *   }
   *
   *   DCDN.confirm({ ar: "متأكد؟", en: "Sure?" }).then(res => { if (res.data) save(); });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.confirm(...)
   */
  return callPublic("confirm", this, arguments);
});

definePublic("alert", function alert(message, options) {
  /**
   * Message popup with one OK button. Resolves when closed.
   * (Nicer replacement for window.alert, does not block the page.)
   *
   * @param {string|{ar:string,en:string}} message
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {string|{ar:string,en:string}} [options.okText]
   * @param {number} [options.width=420]
   * @returns {Promise<void>}
   *
   * Example:
   *   await DCDN.alert("تم إنشاء 5 مدفوعات");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.alert(...)
   */
  return callPublic("alert", this, arguments);
});

definePublic("registerTabPage", function registerTabPage(pageName, pageConfig) {
  /**
   * Register a page name and create  DCDN.appendtab_<pageName>(options).
   * The name after "appendtab_" is free — use any page you need.
   *
   * @param {string} pageName                       -> DCDN.appendtab_<pageName>
   * @param {Object} [pageConfig]
   * @param {"auto"|"classic"|"v2"} [pageConfig.layout="auto"]
   * @param {RegExp} [pageConfig.match]             url pattern (debug note only)
   * @param {string} [pageConfig.nav]               custom tabs <ul> selector
   * @param {string} [pageConfig.content]           custom panes container selector
   * @returns {Function}                            the new appendtab_ function
   *
   * Examples:
   *   DCDN.registerTabPage("school_contract");
   *   DCDN.appendtab_school_contract({ id: "marks", title: "الدرجات", content: "..." });
   *
   *   DCDN.registerTabPage("my_screen", { nav: "#myTabs", content: "#myTabsContent" });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.registerTabPage(...)
   */
  return callPublic("registerTabPage", this, arguments);
});

definePublic("appendTab", function appendTab(pageName, options) {
  /**
   * Add a custom tab to the current view / show page.
   * Usually called through a page alias:  DCDN.appendtab_invoice(options),
   * DCDN.appendtab_client(options), DCDN.appendtab_entity(options) ...
   * Works on classic and v2 layouts and on the mobile accordion.
   *
   * @param {string} pageName                       registered page name or "auto"
   * @param {Object} options
   * @param {string} options.id                     unique id (pane id)
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {string|Element|function(HTMLElement, Object):(string|Promise<string>)} [options.content]
   * @param {string} [options.url]                  page to load into the tab
   * @param {string} [options.selector=".list-table, table, .panel"]   part of `url` to keep
   * @param {boolean} [options.lazy=true]           load on first open
   * @param {boolean} [options.reload=false]        reload on every open
   * @param {boolean} [options.active=false]        open right away
   * @param {number} [options.position]             insert index
   * @param {number|string} [options.badge]
   * @param {function(HTMLElement, Object):void} [options.onOpen]
   * @param {number} [options.timeout=15000]        ms to wait for the tabs
   * @returns {Promise<{id:string, link:HTMLElement, li:HTMLElement, pane:HTMLElement, layout:string,
   *                    open:Function, setContent:Function, setBadge:Function, reload:Function, remove:Function}>}
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
   *       const res = await DCDN.bulkFetch("/v2/api/entity/le_x/list/1", { filters: { ref: DCDN.raw.getRecordId() } });
   *       return "<ul>" + res.data.map(r => "<li>" + r.id + "</li>").join("") + "</ul>";
   *     },
   *   }).then(res => res.data.setBadge(3));      // res.data = the tab controller
   *
   *   // 3) any page name
   *   DCDN.appendTab("client", { id: "notes", title: "Notes", onOpen: pane => console.log(pane) });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.appendTab(...)
   */
  return callPublic("appendTab", this, arguments);
});

definePublic("addDropdown", function addDropdown(target, settings) {
  /**
   * Replace a field with a dropdown whose options YOU choose.
   * The original field stays in the form (hidden) and receives the chosen value,
   * so Daftra saves it normally.
   *
   * @param {string|Element} target                         field(s) to replace
   * @param {Object} settings
   * @param {Array|function():Array|Promise<Array>} [settings.options]   "text", { value, text } or raw objects
   * @param {Object} [settings.source]                     load options from the API
   * @param {string} settings.source.url
   * @param {Object} [settings.source.filters]
   * @param {Object} [settings.source.sort]
   * @param {number} [settings.source.perPage]
   * @param {string} [settings.source.valueKey="id"]
   * @param {string} [settings.source.textKey="name"]
   * @param {boolean} [settings.source.all=true]           false = first page only
   * @param {string|function(Object):*} [settings.valueKey="value"]   key, "dot.path" or function
   * @param {string|function(Object):*} [settings.textKey="text"]
   * @param {"value"|"text"} [settings.saveAs="value"]     written into the original field
   * @param {string|{ar:string,en:string}} [settings.placeholder]
   * @param {boolean} [settings.hideOriginal=true]
   * @param {boolean} [settings.searchable=false]          select2 when loaded
   * @param {string} [settings.className]
   * @param {boolean} [settings.live=false]                also fields added later
   * @param {function({value:string, text:string, data:*}, Object):void} [settings.onSelect]
   * @returns {Promise<Object|Object[]>}                   controller(s): { select, original, options, getSelected(), setValue(v), setOptions(list), destroy() }
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
   * Example with onSelect (fill other fields from the selected row):
   *   DCDN.addDropdown('[id$="--product_name"]', {
   *     source: { url: "/v2/api/entity/product/list/1", textKey: "name" },
   *     saveAs: "text",
   *     onSelect: function (option) {
   *       DCDN.setFieldValue("unit_price", option.data.unit_price);
   *     },
   *   });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.addDropdown(...)
   */
  return callPublic("addDropdown", this, arguments);
});

definePublic("calculatePercent", function calculatePercent(target, settings) {
  /**
   * Add a "%" input BEFORE a value input.
   *   - typing a percent fills the value:   value = base × percent / 100
   *   - typing a value updates the percent: percent = value / base × 100
   *   - when the base input changes, the value is recalculated
   * The target input keeps 70% of its width, the % input takes the rest.
   *
   * @param {string|Element} target                        value input(s)
   * @param {Object} settings
   * @param {string|Element|number|function(HTMLElement):number} settings.base   what to take the percent of
   * @param {string} [settings.baseScope]                  find `base` inside target.closest(baseScope)
   * @param {number} [settings.decimals=2]
   * @param {number} [settings.ratio=0.7]                  width kept for the target
   * @param {number} [settings.max=100]
   * @param {boolean} [settings.sync=true]                 value -> percent too
   * @param {string|{ar:string,en:string}} [settings.placeholder="%"]
   * @param {boolean} [settings.live=false]
   * @param {function({percent:number, value:number, base:number, target:HTMLElement}):void} [settings.onChange]
   * @returns {Object|Object[]}                            controller(s): { percentInput, target, getPercent(), setPercent(p), recalc(), destroy() }
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
   *   const ctrl = DCDN.calculatePercent("#amount", { base: 1000 }).data;
   *   ctrl.setPercent(15);   // #amount = 150.00
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.calculatePercent(...)
   */
  return callPublic("calculatePercent", this, arguments);
});

definePublic("table.addSerials", function addSerials(table, options) {
  /**
   * Add a serial-number column at the start of a table (was addserials).
   * Runs only once per table.
   *
   * @param {string|Element} [table="#listing_table"]
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.header]
   * @returns {void}
   *
   * Examples:
   *   DCDN.table.addSerials();                                    // #listing_table
   *   DCDN.table.addSerials("#my-table", { header: { ar: "م", en: "#" } });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.table.addSerials(...)
   */
  return callPublic("table.addSerials", this, arguments);
});

definePublic("table.swapColumns", function swapColumns(firstIndex, secondIndex, table) {
  /**
   * Swap two columns in every row: content + id + class.
   * Same as the standard  swap(in1, in2, "listing_table")  used in templates.
   *
   * @param {number} firstIndex                 0-based
   * @param {number} secondIndex
   * @param {string|Element} table              table id ("listing_table"), selector or element
   * @returns {void}
   *
   * Examples:
   *   DCDN.swap(3, 6, "listing_table");
   *   DCDN.table.swapColumns(0, 1, "#my-table");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.table.swapColumns(...)
   */
  return callPublic("table.swapColumns", this, arguments);
});

definePublic("table.hideColumn", function hideColumn(table, columnIndex) {
  /**
   * Hide one column (0-based) in every row.
   *
   * @param {string|Element} table
   * @param {number} columnIndex                0-based
   * @returns {void}
   *
   * Example:
   *   DCDN.table.hideColumn("#listing_table", 4);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.table.hideColumn(...)
   */
  return callPublic("table.hideColumn", this, arguments);
});

definePublic("table.toJSON", function toJSON(table) {
  /**
   * Read a table into an array of objects (first row = keys).
   *
   * @param {string|Element} table
   * @returns {Object[]}                        first row = keys
   *
   * Example:
   *   DCDN.table.toJSON("#report")
   *   // [{ "Name": "Ahmed", "Total": "1,200" }, ...]
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.table.toJSON(...)
   */
  return callPublic("table.toJSON", this, arguments);
});

definePublic("table.exportToExcel", function exportToExcel(table, filename) {
  /**
   * Download a table as an .xls file that Excel opens (RTL sheet on Arabic pages).
   *
   * @param {string|Element} table
   * @param {string} [filename="export"]        without extension
   * @returns {void}
   *
   * Examples:
   *   DCDN.exportTableToExcel("#report", "sales-report");
   *   DCDN.table.exportToExcel(document.querySelector(".list-table"));
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.table.exportToExcel(...)
   */
  return callPublic("table.exportToExcel", this, arguments);
});

definePublic("exportCSV", function exportCSV(rows, filename) {
  /**
   * Download rows (array of objects) or a table as a CSV file (UTF-8, Excel friendly).
   *
   * @param {Object[]|string|Element} rows      rows, or a table
   * @param {string} [filename="export"]
   * @returns {void}
   *
   * Examples:
   *   const res = await DCDN.bulkFetch("/v2/api/entity/client/list/1");
   *   DCDN.exportCSV(res.data, "clients");
   *
   *   DCDN.exportCSV("#report", "report");     // from a table
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.exportCSV(...)
   */
  return callPublic("exportCSV", this, arguments);
});

definePublic("downloadBlob", function downloadBlob(blob, filename) {
  /**
   * Download any Blob as a file.
   *
   * @param {Blob} blob
   * @param {string} filename
   * @returns {void}
   *
   * Example:
   *   DCDN.downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "data.json");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.downloadBlob(...)
   */
  return callPublic("downloadBlob", this, arguments);
});

definePublic("formatCells", function formatCells(selector, options) {
  /**
   * Re-format the amounts inside elements (was removeCurr).
   *
   * @param {string} selector
   * @param {Object} [options]
   * @param {number} [options.decimals=2]
   * @param {string} [options.prefix]
   * @param {string} [options.suffix]
   * @param {string} [options.suffixHtml]       HTML after the number (overrides suffix)
   * @returns {void}
   *
   * Examples:
   *   DCDN.formatCells(".removeCurr");                                  // "1234.5" -> "1,234.50"
   *   DCDN.formatCells(".removeCurr", { suffix: " ر.س" });
   *   DCDN.formatCells(".amount", { suffixHtml: '<span class="sar_symbol">&nbsp;元</span>' });
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.formatCells(...)
   */
  return callPublic("formatCells", this, arguments);
});

definePublic("numberToArabicWords", function numberToArabicWords(number) {
  /**
   * Whole number -> Arabic words (no currency).
   *
   * @param {number|string} number             whole part is used
   * @returns {string}
   *
   * Examples:
   *   DCDN.numberToArabicWords(21)        // "واحد وعشرون"
   *   DCDN.numberToArabicWords(1250)      // "ألف ومائتان وخمسون"
   *   DCDN.numberToArabicWords(2000000)   // "مليونان"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.numberToArabicWords(...)
   */
  return callPublic("numberToArabicWords", this, arguments);
});

definePublic("numberToEnglishWords", function numberToEnglishWords(number) {
  /**
   * Whole number -> English words (no currency).
   *
   * @param {number|string} number
   * @returns {string}
   *
   * Example:
   *   DCDN.numberToEnglishWords(1250)   // "One Thousand Two Hundred Fifty"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.numberToEnglishWords(...)
   */
  return callPublic("numberToEnglishWords", this, arguments);
});

definePublic("numberToWords", function numberToWords(amount, options) {
  /**
   * Amount -> words with currency (tafqeet / convertFN).
   *
   * @param {number|string} amount
   * @param {Object} [options]
   * @param {"ar"|"en"} [options.lang]          default page language
   * @param {string|Object} [options.currency]  SAR EGP AED KWD BHD OMR QAR JOD IQD USD, or a DCDN.currencies-style object
   * @param {string|boolean} [options.prefix]   default "فقط " / "Only " (false = none)
   * @param {string|boolean} [options.suffix]   default " لا غير" / "" (false = none)
   * @returns {string}
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
   *   $("#total-words").text(DCDN.numberToWords($("#invoice-total").text(), { currency: "SAR" }).data);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.numberToWords(...)
   */
  return callPublic("numberToWords", this, arguments);
});

definePublic("nativeLoader", function nativeLoader(show, text) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.nativeLoader(...)
   */
  return callPublic("nativeLoader", this, arguments);
});

definePublic("initPage", function initPage(work, text) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.initPage(...)
   */
  return callPublic("initPage", this, arguments);
});

definePublic("nativeAlert", function nativeAlert(text, type, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.nativeAlert(...)
   */
  return callPublic("nativeAlert", this, arguments);
});

definePublic("flashToast", function flashToast(text, type, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.flashToast(...)
   */
  return callPublic("flashToast", this, arguments);
});

definePublic("noticeAfterReload", function noticeAfterReload(text, type, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.noticeAfterReload(...)
   */
  return callPublic("noticeAfterReload", this, arguments);
});

definePublic("showPendingNotice", function showPendingNotice() {
  /**
   * Show (once) the message saved by DCDN.noticeAfterReload. Runs automatically on page load.
   *
   * @returns {Object|null}  the notice { text, type, style } that was shown, or null
   *
   * Example:
   *   DCDN.showPendingNotice();
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.showPendingNotice(...)
   */
  return callPublic("showPendingNotice", this, arguments);
});

definePublic("getFieldColumn", function getFieldColumn(field) {
  /**
   * The column (label + input) of a form field: its nearest [class*="col-lg-"] ancestor,
   * or the .form-group inside it (subform rows), which is what Daftra's red-border CSS targets.
   *
   * @param {string|Element} field   field id ("data-le_x--qty"), field key ("qty"), selector or element
   * @returns {Element|null}
   *
   * Example:
   *   DCDN.getFieldColumn("data-le_x--qty");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getFieldColumn(...)
   */
  return callPublic("getFieldColumn", this, arguments);
});

definePublic("clearFieldError", function clearFieldError(field) {
  /**
   * Remove the message + red border DCDN.showFieldError added to one field.
   *
   * @param {string|Element} field   field id, field key, selector or element
   * @returns {void}
   *
   * Example:
   *   DCDN.clearFieldError("qty");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.clearFieldError(...)
   */
  return callPublic("clearFieldError", this, arguments);
});

definePublic("clearAllFieldErrors", function clearAllFieldErrors(form) {
  /**
   * Remove every message DCDN.showFieldError added inside a form.
   *
   * @param {string|Element} [form=document]   form selector / element
   * @returns {void}
   *
   * Example:
   *   DCDN.clearAllFieldErrors("form");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.clearAllFieldErrors(...)
   */
  return callPublic("clearAllFieldErrors", this, arguments);
});

definePublic("showFieldError", function showFieldError(field, message) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.showFieldError(...)
   */
  return callPublic("showFieldError", this, arguments);
});

definePublic("bindSaveValidation", function bindSaveValidation(form, collectErrors, beforeValidate) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.bindSaveValidation(...)
   */
  return callPublic("bindSaveValidation", this, arguments);
});

definePublic("prependBreadcrumb", function prependBreadcrumb(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.prependBreadcrumb(...)
   */
  return callPublic("prependBreadcrumb", this, arguments);
});

definePublic("setBreadcrumbs", function setBreadcrumbs(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.setBreadcrumbs(...)
   */
  return callPublic("setBreadcrumbs", this, arguments);
});

definePublic("stepsHeader", function stepsHeader(steps, currentStep, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.stepsHeader(...)
   */
  return callPublic("stepsHeader", this, arguments);
});

definePublic("addListButton", function addListButton(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.addListButton(...)
   */
  return callPublic("addListButton", this, arguments);
});

definePublic("hideEarly", function hideEarly(selector, id) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.hideEarly(...)
   */
  return callPublic("hideEarly", this, arguments);
});

definePublic("hideElements", function hideElements(selectors, id) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.hideElements(...)
   */
  return callPublic("hideElements", this, arguments);
});

definePublic("hideFormField", function hideFormField(fieldKey, entityKey) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.hideFormField(...)
   */
  return callPublic("hideFormField", this, arguments);
});

definePublic("replaceAddButton", function replaceAddButton(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.replaceAddButton(...)
   */
  return callPublic("replaceAddButton", this, arguments);
});

definePublic("addSidebarLink", function addSidebarLink(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.addSidebarLink(...)
   */
  return callPublic("addSidebarLink", this, arguments);
});

definePublic("formatCurrency", function formatCurrency(amount, currencyCode, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.formatCurrency(...)
   */
  return callPublic("formatCurrency", this, arguments);
});

definePublic("unwrapEntity", function unwrapEntity(response) {
  /**
   * Normalize a single-record v2 response: { payload: { data: {...} } } -> {...}
   * (any other shape is returned as is). DCDN.fetch already does this for you.
   *
   * @param {Object} response    raw response JSON
   * @returns {Object}           the record
   *
   * Example:
   *   DCDN.unwrapEntity({ payload: { data: { id: 5 } } })   // { id: 5 }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.unwrapEntity(...)
   */
  return callPublic("unwrapEntity", this, arguments);
});

definePublic("getWorkflowType", function getWorkflowType(name, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.getWorkflowType(...)
   */
  return callPublic("getWorkflowType", this, arguments);
});

definePublic("getEntityKeyId", function getEntityKeyId(entityKeyOrType) {
  /**
   * The record id at the end of an entity key ("le_workflow-type-entity-36" -> "36"),
   * used by /workflow_type/{id}/show and /permissions URLs.
   *
   * @param {string|{entity_key:string}} entityKeyOrType   entity key or a workflow_type record
   * @returns {string|null}
   *
   * Example:
   *   DCDN.getEntityKeyId("le_workflow-type-entity-36")   // "36"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getEntityKeyId(...)
   */
  return callPublic("getEntityKeyId", this, arguments);
});

definePublic("getFirstRecord", function getFirstRecord(entityKey, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.getFirstRecord(...)
   */
  return callPublic("getFirstRecord", this, arguments);
});

definePublic("updateRecord", function updateRecord(entityKey, id, fields, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.updateRecord(...)
   */
  return callPublic("updateRecord", this, arguments);
});

definePublic("subformKey", function subformKey(entityKey, subformField) {
  /**
   * The real (double-prefixed) key a SubForm is read/written under.
   *
   * @param {string} entityKey         e.g. "app_897_tariff"
   * @param {string} subformField      e.g. "price_condition"
   * @returns {string}                 "app_897_tariff_app_897_tariff_price_condition"
   *
   * Example:
   *   record[DCDN.raw.subformKey("app_897_tariff", "price_condition")]
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.subformKey(...)
   */
  return callPublic("subformKey", this, arguments);
});

definePublic("upsertSubformRows", function upsertSubformRows(entityKey, recordId, subformField, rows, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.upsertSubformRows(...)
   */
  return callPublic("upsertSubformRows", this, arguments);
});

definePublic("parseMultiValue", function parseMultiValue(value) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.parseMultiValue(...)
   */
  return callPublic("parseMultiValue", this, arguments);
});

definePublic("getPageContext", function getPageContext() {
  /**
   * Who and where: site id, subdomain, domain and user, read from what Daftra puts on every page.
   *
   * @returns {{siteId:(string|null), subdomain:(string|null), domain:string, isDaftraDomain:boolean,
   *            userName:string, isOwner:boolean, staffId:(number|null), branchId:(number|null), roleId:(number|null)}}
   *
   * Example:
   *   DCDN.getPageContext().data.siteId     // "4245753"
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.getPageContext(...)
   */
  return callPublic("getPageContext", this, arguments);
});

definePublic("nowInTimeZone", function nowInTimeZone(timeZone, date) {
  /**
   * Date and time in another time zone (e.g. to stamp records in Riyadh time).
   *
   * @param {string} [timeZone="Asia/Riyadh"]   IANA zone, e.g. "Africa/Cairo"
   * @param {Date|number|string} [date=now]
   * @returns {{date:string, time:string, dateTime:string}}   "YYYY-MM-DD", "HH:mm", "YYYY-MM-DD HH:mm:ss"
   *
   * Example:
   *   DCDN.nowInTimeZone("Asia/Riyadh").data   // { date: "2026-10-22", time: "14:05", dateTime: "2026-10-22 14:05:09" }
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.nowInTimeZone(...)
   */
  return callPublic("nowInTimeZone", this, arguments);
});

definePublic("ageOnDate", function ageOnDate(dateOfBirth, onDate) {
  /**
   * Whole years between a birth date and another date (age on that day).
   *
   * @param {string|Date} dateOfBirth             "YYYY-MM-DD" or Date
   * @param {string|Date} [onDate=today]          "YYYY-MM-DD" or Date
   * @returns {number|null}                       null when a date is missing / invalid
   *
   * Example:
   *   DCDN.ageOnDate("2015-06-01", "2026-05-31")   // 10
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.ageOnDate(...)
   */
  return callPublic("ageOnDate", this, arguments);
});

definePublic("cached", function cached(key, work, options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   *                (async: a Promise of that JSON, never rejects)
   * Plain value without the JSON wrapper:  DCDN.raw.cached(...)
   */
  return callPublic("cached", this, arguments);
});

definePublic("setReturnUrl", function setReturnUrl(key, url) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.setReturnUrl(...)
   */
  return callPublic("setReturnUrl", this, arguments);
});

definePublic("handleReturnRedirect", function handleReturnRedirect(options) {
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
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.handleReturnRedirect(...)
   */
  return callPublic("handleReturnRedirect", this, arguments);
});

definePublic("languagePack", function languagePack(options) {
  /**
   * Create a page translator from a phrase dictionary (the "Language Pack").
   *
   * @param {Object} options
   * @param {Array<{en:string, ar:string}|string[]>} options.phrases   word / phrase pairs (case-sensitive, longest applied first)
   * @param {Array<{en:string, ar:string}|{pattern:string, ar:string, length:number}>} [options.sentences]
   *        whole sentences swapped as one piece; use {name} slots, e.g. { en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }
   * @param {"auto"|"toArabic"|"toEnglish"} [options.direction="auto"]   auto = to Arabic on RTL pages, to English on LTR pages
   * @param {boolean} [options.arabicPagesOnly=false]   only translate on RTL pages (English pages untouched)
   * @param {boolean} [options.wholeWords=false]        only match whole words ("Test" never changes "Testing")
   * @param {string}  [options.skipSelector]            elements never translated (default: script, style, noscript, textarea, input, select, option, iframe, .dcdn-no-translate)
   * @param {string[]} [options.attributes]             attributes translated too (default: placeholder, title, aria-label, data-float-label)
   * @param {boolean} [options.dropdowns=true]          placeholder <option>s + Daftra dynamic-dropdown display inputs
   * @param {boolean} [options.iframes=true]            same-origin iframes (now and when they load)
   * @param {boolean} [options.title=true]              browser tab title on full-page runs
   * @param {boolean} [options.observe=true]            translate content added later (debounced)
   * @param {boolean} [options.autoStart=true]          run on DOM ready + window load + dynamic-dropdown open
   * @returns {{
   *   translate: function((string|Element)=): void,
   *   translateText: function(string): string,
   *   translateSentence: function(string): string,
   *   addPhrases: function(Array): void,
   *   addSentences: function(Array): void,
   *   stop: function(): void,
   *   phrases: Array
   * }}  the pack controller (in `data`)
   *
   * Examples:
   *   const pack = DCDN.languagePack({
   *     phrases: [
   *       { en: "Delivery Orders", ar: "أوامر التوصيل" },
   *       { en: "Driver", ar: "سائق" },
   *       ["Vehicles", "المركبات"],
   *     ],
   *     sentences: [{ en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }],
   *     wholeWords: true,
   *   }).data;
   *
   *   pack.translate("#myModal");                 // after adding HTML
   *   pack.translateSentence("Sent 5 journals");  // "تم إرسال 5 قيود" on Arabic pages
   *   pack.addPhrases([{ en: "Plate Number", ar: "رقم اللوحة" }]);
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.languagePack(...)
   */
  return callPublic("languagePack", this, arguments);
});

definePublic("translateLanguagePack", function translateLanguagePack(rootOrSelector) {
  /**
   * Run EVERY language pack created on the page again (after adding HTML: modals, AJAX…).
   *
   * @param {string|Element} [rootOrSelector=document.body]   container to translate
   * @returns {number}                                         how many packs ran
   *
   * Example:
   *   $("#modal").html(html);
   *   DCDN.translateLanguagePack("#modal");
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.translateLanguagePack(...)
   */
  return callPublic("translateLanguagePack", this, arguments);
});

definePublic("exposeGlobals", function exposeGlobals() {
  /**
   * Define the OLD global function names some page codes still call,
   * only when they are not defined already:
   *   toggleLoadingSpinner, getSiteInfo, addThousandSeparator,
   *   exportTableToExcel, swap, showPopup, closePopup,
   *   showToastifyAlert, isRtlLanguage, formatCurrencyHtml,
   *   unwrapSingleEntityResponse, fetchWorkflowTypeByName, getWorkflowTypeRecordId
   * (these old globals return PLAIN values, like the original page codes)
   *
   * @returns {void}
   *
   * Example:
   *   DCDN.exposeGlobals();
   *   toggleLoadingSpinner(true);   // old code keeps working
   *
   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }
   * Plain value without the JSON wrapper:  DCDN.raw.exposeGlobals(...)
   */
  return callPublic("exposeGlobals", this, arguments);
});

  return createPublicApi();
});
