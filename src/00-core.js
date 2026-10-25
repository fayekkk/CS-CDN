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
