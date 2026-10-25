/*!
 * Daftra CDN v1.0.0 — reusable functions & components for Daftra page codes
 * Global: window.DCDN (alias window.DaftraCDN)
 * Built: 2026-10-18T09:45:34.014Z
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
      console.warn("[DCDN] No page document found. In DevTools choose the top context in the console dropdown, then paste again.");
    return;
  }
  // never load twice (several apps may include the CDN on the same page)
  if (!(g.DCDN && g.DCDN.version)) g.DCDN = g.DaftraCDN = factory(g);
  if (typeof module === "object" && module && module.exports) module.exports = g.DCDN;
})(function (window) {
  "use strict";
  var document = window.document;
  var VERSION = "1.0.0";
  var D = {};

/* ---- 00-core.js ---- */
/* ==========================================================================
 * 00-core.js — namespace, config, internal helpers
 * ======================================================================== */

D.version = VERSION;

/**
 * Global configuration. Change with DCDN.configure({...}).
 */
D.config = {
  apiKey: null, // only needed when calling Daftra from OUTSIDE a Daftra page
  baseUrl: "", // e.g. "https://mysite.daftra.com" when used outside Daftra
  retries: 3, // network / 5xx / 429 retries for every request
  retryDelay: 600, // ms, doubled on each retry
  perPage: 100, // default page size for bulkFetch
  concurrency: 4, // parallel requests for bulkFetch / bulkPost
  lang: null, // force "ar" | "en" (otherwise auto-detected)
  siteInfoKey: "site_info", // shared localStorage key (same key old apps use)
  autoResetSiteInfo: true, // clear cached site_info when /settings is saved
  zIndex: 1000000,
  primaryColor: "#1877f2",
  debug: false,
};

D.configure = function (opts) {
  if (opts) for (var k in opts) if (has(opts, k)) D.config[k] = opts[k];
  return D.config;
};

/* ----------------------------- internals -------------------------------- */

function has(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function log() {
  if (!D.config.debug) return;
  var a = Array.prototype.slice.call(arguments);
  a.unshift("%c[DCDN]", "color:#1877f2;font-weight:bold");
  console.log.apply(console, a);
}

function warn() {
  var a = Array.prototype.slice.call(arguments);
  a.unshift("[DCDN]");
  console.warn.apply(console, a);
}

/** Resolve selector | Element | jQuery object -> first Element (or null). */
function $el(target, root) {
  if (!target) return null;
  if (typeof target === "string") return (root || document).querySelector(target);
  if (target.jquery) return target[0] || null;
  if (target.nodeType) return target;
  if (target.length && target[0] && target[0].nodeType) return target[0];
  return null;
}

/** Resolve selector | Element | NodeList | jQuery -> Array<Element>. */
function $all(target, root) {
  if (!target) return [];
  if (typeof target === "string")
    return Array.prototype.slice.call((root || document).querySelectorAll(target));
  if (target.nodeType) return [target];
  if (target.jquery || typeof target.length === "number")
    return Array.prototype.slice.call(target).filter(function (n) {
      return n && n.nodeType;
    });
  return [];
}

/** Create an element from an HTML string (first element). */
function h(html) {
  var t = document.createElement("template");
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

/** Fire native events (jQuery `.on()` handlers receive them too). */
function fire(el, types) {
  if (!el) return;
  (types || ["input", "change"]).forEach(function (type) {
    var ev;
    try {
      ev = new Event(type, { bubbles: true });
    } catch (e) {
      ev = document.createEvent("Event");
      ev.initEvent(type, true, true);
    }
    el.dispatchEvent(ev);
  });
}

/** Accept "text" | {ar, en} | [ar, en] and return the string for page language. */
function txt(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  var lang = D.detectLang ? D.detectLang() : "ar";
  if (Array.isArray(v)) return lang === "en" ? v[1] : v[0];
  return v[lang] != null ? v[lang] : v.ar != null ? v.ar : v.en || "";
}

/** Run `worker` over `items` with at most `limit` in flight. Keeps order. */
function pool(items, limit, worker) {
  var results = new Array(items.length);
  var i = 0;
  limit = Math.max(1, limit || 1);
  function next() {
    if (i >= items.length) return Promise.resolve();
    var idx = i++;
    return Promise.resolve()
      .then(function () {
        return worker(items[idx], idx);
      })
      .then(function (r) {
        results[idx] = r;
      })
      .then(next);
  }
  var runners = [];
  for (var k = 0; k < Math.min(limit, items.length); k++) runners.push(next());
  return Promise.all(runners).then(function () {
    return results;
  });
}

D._internal = { $el: $el, $all: $all, h: h, fire: fire, txt: txt, pool: pool, log: log };


/* ---- 01-utils.js ---- */
/* ==========================================================================
 * 01-utils.js — generic helpers found repeated across cs-daily code
 * ======================================================================== */

D.sleep = function (ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
};

D.debounce = function (fn, wait) {
  var t;
  return function () {
    var ctx = this,
      args = arguments;
    clearTimeout(t);
    t = setTimeout(function () {
      fn.apply(ctx, args);
    }, wait == null ? 250 : wait);
  };
};

D.throttle = function (fn, wait) {
  var last = 0;
  return function () {
    var now = Date.now();
    if (now - last >= (wait || 250)) {
      last = now;
      return fn.apply(this, arguments);
    }
  };
};

D.chunk = function (arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

D.uid = function (prefix) {
  return (prefix || "dcdn") + "_" + Math.random().toString(36).slice(2, 9);
};

D.escapeHtml = function (s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/* ------------------------------ numbers --------------------------------- */

/** Arabic-Indic / Persian digits -> 0-9 */
D.toEnDigits = function (s) {
  return String(s == null ? "" : s)
    .replace(/[٠-٩]/g, function (d) {
      return d.charCodeAt(0) - 0x0660;
    })
    .replace(/[۰-۹]/g, function (d) {
      return d.charCodeAt(0) - 0x06f0;
    })
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
};

/**
 * Parse any displayed amount: "1,250.50 ر.س", "SR 99", "١٢٣" -> Number.
 * (Same job as the many `removeCurr` / `.replace(/,/g,'')` snippets.)
 */
D.parseNumber = function (v) {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  var s = D.toEnDigits(v).replace(/,/g, "");
  var neg = /^\s*-|\(\s*[\d.]+\s*\)/.test(s);
  var m = s.match(/\d+(\.\d+)?|\.\d+/);
  if (!m) return 0;
  var n = parseFloat(m[0]);
  return neg ? -n : n;
};

D.round = function (n, decimals) {
  var p = Math.pow(10, decimals == null ? 2 : decimals);
  return Math.round((Number(n) + Number.EPSILON) * p) / p;
};

/** addThousandSeparator / formatNumber */
D.formatNumber = function (n, decimals, opts) {
  opts = opts || {};
  var num = D.parseNumber(n);
  var s = decimals == null ? String(num) : D.round(num, decimals).toFixed(decimals);
  var parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, opts.separator == null ? "," : opts.separator);
  return (opts.prefix || "") + parts.join(opts.decimalPoint || ".") + (opts.suffix || "");
};
D.addThousandSeparator = function (n) {
  return D.formatNumber(n);
};

/* -------------------------------- dates --------------------------------- */

function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

/** formatDate(date, "YYYY-MM-DD HH:mm:ss") */
D.formatDate = function (date, format) {
  var d = date instanceof Date ? date : new Date(date || Date.now());
  if (isNaN(d)) return "";
  var map = {
    YYYY: d.getFullYear(),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  };
  return (format || "YYYY-MM-DD").replace(/YYYY|MM|DD|HH|mm|ss/g, function (k) {
    return map[k];
  });
};
D.today = function (format) {
  return D.formatDate(new Date(), format);
};
D.addDays = function (date, days, format) {
  var d = new Date(date || Date.now());
  d.setDate(d.getDate() + Number(days || 0));
  return format ? D.formatDate(d, format) : d;
};

/* --------------------------------- URL ---------------------------------- */

D.getUrlParam = function (name, url) {
  try {
    return new URL(url || location.href).searchParams.get(name);
  } catch (e) {
    return null;
  }
};

/**
 * Parse the current Daftra page URL.
 *  /v2/owner/entity/le_x/15/show -> {isV2:true, entity:"le_x", id:15, action:"show"}
 *  /owner/invoices/view/123      -> {isV2:false, controller:"invoices", action:"view", id:123}
 */
D.getPageInfo = function (url) {
  var u = new URL(url || location.href, location.origin);
  var seg = u.pathname.split("/").filter(Boolean);
  var info = { path: u.pathname, isV2: seg[0] === "v2", id: D.getRecordId(u.href) };
  if (info.isV2) {
    var i = seg.indexOf("entity");
    info.entity = i > -1 ? seg[i + 1] : seg[2];
    info.action = seg[seg.length - 1];
  } else {
    var o = seg.indexOf("owner");
    info.controller = seg[o + 1];
    info.action = seg[o + 2] || "index";
  }
  return info;
};

/** Last numeric segment of the URL path (record id of view/show/edit pages). */
D.getRecordId = function (url) {
  var path = new URL(url || location.href, location.origin).pathname;
  var nums = path.split("/").filter(function (s) {
    return /^\d+$/.test(s);
  });
  return nums.length ? Number(nums[nums.length - 1]) : null;
};

/* -------------------------------- DOM ----------------------------------- */

D.onReady = function (fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
};

/** Resolve when `selector` exists (MutationObserver based). */
D.waitForElement = function (selector, opts) {
  opts = opts || {};
  var root = opts.root || document;
  var timeout = opts.timeout == null ? 15000 : opts.timeout;
  return new Promise(function (resolve, reject) {
    var found = root.querySelector(selector);
    if (found) return resolve(found);
    var timer;
    var obs = new MutationObserver(function () {
      var el = root.querySelector(selector);
      if (el) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    obs.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
    if (timeout)
      timer = setTimeout(function () {
        obs.disconnect();
        reject(new Error("waitForElement timeout: " + selector));
      }, timeout);
  });
};

/** Poll until `condition()` is truthy (replacement for the many setInterval checks). */
D.waitFor = function (condition, opts) {
  opts = opts || {};
  var interval = opts.interval || 100;
  var timeout = opts.timeout == null ? 15000 : opts.timeout;
  var start = Date.now();
  return new Promise(function (resolve, reject) {
    (function tick() {
      var v;
      try {
        v = condition();
      } catch (e) {
        v = false;
      }
      if (v) return resolve(v);
      if (timeout && Date.now() - start > timeout) return reject(new Error("waitFor timeout"));
      setTimeout(tick, interval);
    })();
  });
};

/** Run `fn(el)` once for every element matching selector — now and in the future. */
D.onElement = function (selector, fn, opts) {
  opts = opts || {};
  var mark = "dcdnSeen" + D.uid("").slice(1);
  function scan() {
    $all(selector, opts.root).forEach(function (el) {
      if (el.dataset[mark]) return;
      el.dataset[mark] = "1";
      try {
        fn(el);
      } catch (e) {
        warn("onElement handler error", e);
      }
    });
  }
  scan();
  var obs = new MutationObserver(D.debounce(scan, 50));
  obs.observe(opts.root || document.documentElement, { childList: true, subtree: true });
  return {
    stop: function () {
      obs.disconnect();
    },
  };
};

var loadedScripts = {};
D.loadScript = function (src, opts) {
  opts = opts || {};
  if (loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise(function (res, rej) {
    if (opts.test && opts.test()) return res();
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    if (opts.id) s.id = opts.id;
    s.onload = function () {
      res();
    };
    s.onerror = function () {
      delete loadedScripts[src];
      rej(new Error("failed to load " + src));
    };
    document.head.appendChild(s);
  });
  return loadedScripts[src];
};

D.loadStyle = function (href) {
  if (document.querySelector('link[href="' + href + '"]')) return Promise.resolve();
  return new Promise(function (res, rej) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = function () {
      res();
    };
    l.onerror = rej;
    document.head.appendChild(l);
  });
};

/** Inject a <style> once per id. */
D.injectCSS = function (css, id) {
  if (id && document.getElementById(id)) return document.getElementById(id);
  var s = document.createElement("style");
  if (id) s.id = id;
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
  return s;
};

D.copyToClipboard = function (text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
  return Promise.resolve();
};

/** Simulate Enter on an input (used to trigger Daftra barcode / serial lookups). */
D.triggerEnter = function (target) {
  var el = $el(target);
  if (!el) return;
  ["keydown", "keypress", "keyup"].forEach(function (type) {
    var ev = new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
    el.dispatchEvent(ev);
  });
  if (window.jQuery) {
    window.jQuery(el).trigger(window.jQuery.Event("keydown", { which: 13, keyCode: 13 }));
    window.jQuery(el).trigger(window.jQuery.Event("keyup", { which: 13, keyCode: 13 }));
  }
};

/* ------------------------- Daftra page context -------------------------- */

/** window.USER injected by Daftra ({staff_id, branch_id, is_owner, ...}). */
D.getUser = function () {
  return window.USER || {};
};
D.isOwner = function () {
  var u = D.getUser();
  return !!(Number(u.is_owner) || Number(u.staff_id) === 0);
};

D.getCsrfToken = function () {
  var m = document.querySelector('meta[name="csrf-token"]');
  var i = document.querySelector('input[name="_csrfToken"]') || document.querySelector('input[name="data[_Token][key]"]');
  return (m && m.getAttribute("content")) || (i && i.value) || "";
};

/**
 * Get a v2-form field by its key: DCDN.field("discountvalue")
 * Looks for [id$="--key"], then [name$="[key]"], then #key.
 */
D.field = function (key, root) {
  root = root || document;
  return (
    root.querySelector('[id$="--' + key + '"]') ||
    root.querySelector('[name$="[' + key + ']"]') ||
    root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(key) : key))
  );
};
D.fields = function (key, root) {
  return $all('[id$="--' + key + '"]', root);
};

/** Read a field value (handles selectize / select2 / checkbox). */
D.getFieldValue = function (target) {
  var el = typeof target === "string" ? $el(target) || D.field(target) : $el(target);
  if (!el) return null;
  if (el.selectize) return el.selectize.getValue();
  if (el.type === "checkbox" || el.type === "radio") return el.checked;
  return el.value;
};

/** Set a field value + fire change (handles selectize / select2 / plain). */
D.setFieldValue = function (target, value, text) {
  var el = typeof target === "string" ? $el(target) || D.field(target) : $el(target);
  if (!el) return false;
  if (el.selectize) {
    var s = el.selectize;
    if (!s.options[value]) s.addOption({ value: value, text: text != null ? text : value });
    s.setValue(value);
    return true;
  }
  if (el.tagName === "SELECT" && !Array.prototype.some.call(el.options, function (o) { return o.value == value; })) {
    el.add(new Option(text != null ? text : value, value, true, true));
  }
  if (el.type === "checkbox" || el.type === "radio") el.checked = !!value;
  else el.value = value;
  if (window.jQuery && window.jQuery(el).data("select2")) window.jQuery(el).trigger("change");
  else fire(el);
  return true;
};

/**
 * Add an item to a sidebar sub-menu (from addNewItemInSubMenu).
 * DCDN.addMenuItem({ parent: ".mn_inventory", sidebarId: 36, url: "/v2/...", title: {ar,en}, after: 0 })
 */
D.addMenuItem = function (o) {
  var parent = $el(o.parent) || (o.sidebarId != null && document.querySelector('li[data-app-sidebar-list-item="' + o.sidebarId + '"]'));
  if (!parent) return null;
  var ul = parent.querySelector("ul");
  if (!ul || !ul.children.length) return null;
  var url = o.url;
  var exists = ul.querySelector('a[href="' + url + '"]');
  if (exists) return exists.closest("li");
  var li = ul.children[0].cloneNode(true);
  li.classList.remove("active");
  var a = li.querySelector("a");
  a.setAttribute("href", url);
  (a.querySelector("span") || a).textContent = txt(o.title);
  var ref = ul.children[o.after == null ? ul.children.length - 1 : Math.min(o.after, ul.children.length - 1)];
  ref.parentNode.insertBefore(li, ref.nextSibling);
  return li;
};


/* ---- 02-api.js ---- */
/* ==========================================================================
 * 02-api.js — fetch, bulkFetch, post, bulkPost, put, delete, upload
 *
 * Works with both Daftra APIs:
 *   v2  : /v2/api/entity/{entity}/list/1?filter[x]=..&per_page=..&page=..
 *         -> { data:[...], last_page, total, current_page }
 *   api2: /api2/invoices?limit=..&page=..
 *         -> { data:[...], pagination:{ page_count, total_results } }
 * ======================================================================== */

/**
 * Serialize nested params into Daftra's bracket syntax.
 *   buildQuery({ filter: { name: { like: "a" }, branch_id: { in: [1, 2] }, x: { is_null: null } } })
 *   -> filter[name][like]=a&filter[branch_id][in][]=1&filter[branch_id][in][]=2&filter[x][is_null]
 */
D.buildQuery = function (params) {
  var parts = [];
  function enc(k) {
    // keep brackets readable – Daftra accepts both encoded and raw brackets
    return encodeURIComponent(k).replace(/%5B/g, "[").replace(/%5D/g, "]");
  }
  function walk(prefix, val) {
    if (val === undefined) return;
    if (val === null) return parts.push(enc(prefix));
    if (Array.isArray(val)) {
      val.forEach(function (v) {
        walk(prefix + "[]", v);
      });
    } else if (typeof val === "object" && !(val instanceof Date)) {
      Object.keys(val).forEach(function (k) {
        walk(prefix ? prefix + "[" + k + "]" : k, val[k]);
      });
    } else {
      parts.push(enc(prefix) + "=" + encodeURIComponent(val instanceof Date ? D.formatDate(val) : val));
    }
  }
  walk("", params || {});
  return parts.join("&");
};

function isApi2(url) {
  return /\/api2\//.test(url);
}

/** Build final URL from url + {params, filters, sort, page, perPage}. */
function buildUrl(url, o) {
  o = o || {};
  var q = {};
  if (o.params) for (var k in o.params) q[k] = o.params[k];
  if (o.filters) q.filter = o.filters;
  if (o.sort) q.sort = o.sort;
  if (o.page != null) q.page = o.page;
  if (o.perPage != null) q[isApi2(url) ? "limit" : "per_page"] = o.perPage;
  var qs = D.buildQuery(q);
  var full = /^https?:\/\//.test(url) ? url : (D.config.baseUrl || "") + url;
  return qs ? full + (full.indexOf("?") > -1 ? "&" : "?") + qs : full;
}
D.buildUrl = buildUrl;

function DaftraError(message, status, data) {
  var e = new Error(message);
  e.name = "DaftraError";
  e.status = status;
  e.data = data;
  return e;
}

/**
 * Core request with retries.
 * opts: { method, body, params, filters, sort, page, perPage, headers,
 *         retries, raw (return Response), form (FormData body), signal }
 */
D.request = function (url, opts) {
  opts = opts || {};
  var method = (opts.method || "GET").toUpperCase();
  var retries = opts.retries == null ? D.config.retries : opts.retries;
  var finalUrl = buildUrl(url, opts);
  var headers = { Accept: "application/json" };
  if (D.config.apiKey) headers.apikey = D.config.apiKey;
  var body = opts.body;
  if (body != null && !(body instanceof FormData) && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  } else if (typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET") {
    var csrf = D.getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];

  var attempt = 0;
  function run() {
    attempt++;
    return fetch(finalUrl, {
      method: method,
      headers: headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      credentials: "same-origin",
      signal: opts.signal,
    })
      .then(function (res) {
        if (opts.raw) return res;
        return res.text().then(function (t) {
          var data;
          try {
            data = t ? JSON.parse(t) : null;
          } catch (e) {
            data = t;
          }
          if (!res.ok) {
            var msg = (data && (data.message || data.error)) || "Request failed (" + res.status + ")";
            throw DaftraError(msg, res.status, data);
          }
          if (data && data.result === "failed") throw DaftraError(data.message || "Daftra returned failed", res.status, data);
          return data;
        });
      })
      .catch(function (err) {
        var retryable = !err.status || err.status >= 500 || err.status === 429;
        if (err.name === "AbortError" || !retryable || attempt > retries) throw err;
        log("retry", attempt, finalUrl, err.message);
        return D.sleep(D.config.retryDelay * Math.pow(2, attempt - 1)).then(run);
      });
  }
  log(method, finalUrl);
  return run();
};

/**
 * GET one endpoint.
 *   DCDN.fetch("/v2/api/entity/invoice/list/1", { filters: { client_id: 5 }, perPage: 50 })
 *   DCDN.fetch("/api2/site_info")
 */
D.fetch = function (url, opts) {
  opts = Object.assign({}, opts, { method: "GET" });
  return D.request(url, opts);
};
D.get = D.fetch;

/** POST json body. */
D.post = function (url, body, opts) {
  return D.request(url, Object.assign({}, opts, { method: (opts && opts.method) || "POST", body: body }));
};
D.put = function (url, body, opts) {
  return D.request(url, Object.assign({}, opts, { method: "PUT", body: body }));
};
D.patch = function (url, body, opts) {
  return D.request(url, Object.assign({}, opts, { method: "PATCH", body: body }));
};
D.del = function (url, opts) {
  return D.request(url, Object.assign({}, opts, { method: "DELETE" }));
};
D["delete"] = D.del;

/** Total pages from either API shape. */
function pageCount(res, perPage) {
  if (!res || typeof res !== "object") return 1;
  if (res.last_page) return Number(res.last_page);
  var p = res.pagination || res.meta;
  if (p) {
    if (p.page_count) return Number(p.page_count);
    if (p.last_page) return Number(p.last_page);
    var total = p.total_results || p.total;
    var lim = p.limit || p.per_page || perPage;
    if (total && lim) return Math.ceil(total / lim);
  }
  if (res.total && (res.per_page || perPage)) return Math.ceil(res.total / (res.per_page || perPage));
  return 1;
}

function listOf(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

/**
 * Fetch ALL pages of a list endpoint (or many urls / ids at once).
 *
 *  1) All pages of a list:
 *     DCDN.bulkFetch("/v2/api/entity/product/list/1", { filters:{ "category.name":"extras" }, perPage:100 })
 *  2) Many urls:
 *     DCDN.bulkFetch(["/api2/invoices/1.json", "/api2/invoices/2.json"])
 *  3) Template + ids:
 *     DCDN.bulkFetch("/v2/api/entity/invoice/{id}/1", { ids:[10,11,12] })
 *
 * opts: filters, sort, params, perPage, maxPages, concurrency,
 *       unwrap ("Invoice" -> row.Invoice for api2), onProgress(done,total),
 *       progress (true | "title")  -> shows a DCDN progress bar
 */
D.bulkFetch = function (url, opts) {
  opts = opts || {};
  var conc = opts.concurrency || D.config.concurrency;
  var bar = opts.progress ? D.progressBar({ title: typeof opts.progress === "string" ? opts.progress : txt({ ar: "جاري التحميل...", en: "Loading..." }) }) : null;
  function prog(done, total) {
    if (bar) bar.update(done, total);
    if (opts.onProgress) opts.onProgress(done, total);
  }
  function finish(r) {
    if (bar) bar.done();
    return r;
  }
  function fail(e) {
    if (bar) bar.remove();
    throw e;
  }

  // (2)/(3) many urls
  if (Array.isArray(url) || opts.ids) {
    var urls = Array.isArray(url)
      ? url
      : opts.ids.map(function (id) {
          return url.replace(/\{id\}/g, id);
        });
    var done = 0;
    return pool(urls, conc, function (u) {
      return D.fetch(u, { params: opts.params, filters: opts.filters })
        .catch(function (e) {
          if (opts.stopOnError) throw e;
          return { __error: e };
        })
        .then(function (r) {
          prog(++done, urls.length);
          return r;
        });
    })
      .then(finish)
      .catch(fail);
  }

  // (1) paginated list
  var perPage = opts.perPage || D.config.perPage;
  var base = { filters: opts.filters, sort: opts.sort, params: opts.params, perPage: perPage };
  return D.fetch(url, Object.assign({ page: 1 }, base))
    .then(function (first) {
      var total = pageCount(first, perPage);
      if (opts.maxPages) total = Math.min(total, opts.maxPages);
      prog(1, total);
      var pages = [];
      for (var p = 2; p <= total; p++) pages.push(p);
      var done = 1;
      return pool(pages, conc, function (p) {
        return D.fetch(url, Object.assign({ page: p }, base)).then(function (r) {
          prog(++done, total);
          return listOf(r);
        });
      }).then(function (rest) {
        var all = listOf(first);
        rest.forEach(function (arr) {
          all = all.concat(arr);
        });
        if (opts.unwrap)
          all = all.map(function (row) {
            return row && row[opts.unwrap] ? row[opts.unwrap] : row;
          });
        return all;
      });
    })
    .then(finish)
    .catch(fail);
};
D.fetchAll = D.bulkFetch;

/**
 * POST (or PUT…) many records.
 *   DCDN.bulkPost("/v2/api/entity/le_invoice-items", items, { concurrency:3, progress:true })
 *   DCDN.bulkPost(item => `/v2/api/entity/le_x/${item.id}`, rows, { method:"PUT" })
 *
 * opts: method, concurrency, delay (ms between requests per worker),
 *       stopOnError, transform(item) -> body, onProgress(done,total,result),
 *       progress (true | "title")
 * returns { results:[{item, ok, data|error}], success:[], failed:[] }
 */
D.bulkPost = function (url, items, opts) {
  opts = opts || {};
  items = items || [];
  var conc = opts.concurrency || Math.min(3, D.config.concurrency);
  var method = opts.method || "POST";
  var bar = opts.progress ? D.progressBar({ title: typeof opts.progress === "string" ? opts.progress : txt({ ar: "جاري الحفظ...", en: "Saving..." }), total: items.length }) : null;
  var done = 0;
  var stopped = false;
  return pool(items, conc, function (item, i) {
    if (stopped) return { item: item, ok: false, skipped: true };
    var u = typeof url === "function" ? url(item, i) : url;
    var body = opts.transform ? opts.transform(item, i) : item;
    return D.request(u, { method: method, body: body })
      .then(function (data) {
        return { item: item, ok: true, data: data };
      })
      .catch(function (error) {
        if (opts.stopOnError) stopped = true;
        return { item: item, ok: false, error: error };
      })
      .then(function (r) {
        done++;
        if (bar) bar.update(done, items.length);
        if (opts.onProgress) opts.onProgress(done, items.length, r);
        return opts.delay ? D.sleep(opts.delay).then(function () { return r; }) : r;
      });
  }).then(function (results) {
    var failed = results.filter(function (r) { return !r.ok && !r.skipped; });
    if (bar) bar.done(failed.length ? txt({ ar: "تم مع وجود أخطاء", en: "Done with errors" }) : null);
    return {
      results: results,
      success: results.filter(function (r) { return r.ok; }),
      failed: failed,
    };
  });
};

/**
 * Upload a file to a v2 entity file field.
 *   DCDN.uploadFile("le_client_m", "le_client_m.file", blob, "photo.png")
 */
D.uploadFile = function (entity, fieldKey, file, filename) {
  var fd = new FormData();
  fd.append("file", file, filename || file.name || "file-" + Date.now());
  return D.request("/v2/api/entity/upload_file/" + entity + "/" + fieldKey, { method: "POST", body: fd });
};

/* -------- small entity helpers for the v2 API (most used in cs-daily) -------- */

D.entity = function (entity) {
  var base = "/v2/api/entity/" + entity;
  return {
    get: function (id, depth) {
      return D.fetch(base + "/" + id + "/" + (depth == null ? 1 : depth));
    },
    list: function (opts) {
      return D.fetch(base + "/list/" + ((opts && opts.depth) || 1), opts);
    },
    all: function (opts) {
      return D.bulkFetch(base + "/list/" + ((opts && opts.depth) || 1), opts);
    },
    create: function (body) {
      return D.post(base, body);
    },
    update: function (id, body) {
      return D.put(base + "/" + id, body);
    },
    updateFields: function (id, body) {
      return D.post(base + "/" + id + "/fields", body);
    },
    remove: function (id) {
      return D.del(base + "/" + id);
    },
  };
};


/* ---- 03-site-i18n-storage.js ---- */
/* ==========================================================================
 * 03-site-i18n-storage.js — site info cache, language, translate, storage
 * ======================================================================== */

/* ----------------------------- storage ---------------------------------- */

function lsGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function lsSet(key, val) {
  try {
    window.localStorage.setItem(key, val);
    return true;
  } catch (e) {
    warn("localStorage unavailable", e);
    return false;
  }
}
function lsDel(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {}
}

/**
 * App-scoped localStorage. Key format = "app_{appId}_{name}"
 * (the same format already used, e.g. "app_397_workflow").
 *
 *   DCDN.storage.set(397, "workflow", 12)
 *   DCDN.storage.set(397, "settings", {...}, { ttl: 3600 })   // seconds
 *   DCDN.storage.get(397, "settings", defaultValue)
 */
D.storage = {
  key: function (appId, name) {
    return "app_" + appId + "_" + name;
  },
  set: function (appId, name, value, opts) {
    opts = opts || {};
    var stored;
    if (opts.ttl) stored = JSON.stringify({ __dcdn: 1, v: value, e: Date.now() + opts.ttl * 1000 });
    else stored = typeof value === "string" ? value : JSON.stringify(value);
    return lsSet(D.storage.key(appId, name), stored);
  },
  get: function (appId, name, def) {
    var raw = lsGet(D.storage.key(appId, name));
    if (raw == null) return def === undefined ? null : def;
    var val;
    try {
      val = JSON.parse(raw);
    } catch (e) {
      return raw;
    }
    if (val && val.__dcdn === 1) {
      if (val.e && Date.now() > val.e) {
        lsDel(D.storage.key(appId, name));
        return def === undefined ? null : def;
      }
      return val.v;
    }
    return val;
  },
  has: function (appId, name) {
    return D.storage.get(appId, name) !== null;
  },
  remove: function (appId, name) {
    lsDel(D.storage.key(appId, name));
  },
  /** Remove every key of one app. */
  clear: function (appId) {
    var prefix = "app_" + appId + "_";
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(prefix) === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  },
};
D.setLocalStorage = D.storage.set;
D.getLocalStorage = D.storage.get;
D.removeLocalStorage = D.storage.remove;

/* ----------------------------- site info -------------------------------- */

var siteInfoPromise = null;

function readSiteInfo() {
  var raw = lsGet(D.config.siteInfoKey);
  if (!raw) return null;
  try {
    var v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch (e) {
    return null;
  }
}

/**
 * Site info shared by all apps.
 * 1. If localStorage["site_info"] exists (set by ANY app) -> return it, no request.
 * 2. Otherwise GET /api2/site_info, and store `res.data` ONLY if still empty
 *    (another app may have set it meanwhile – we never overwrite).
 * Shape (same as old apps): { Site: { language_code, currency_code, country_code, ... } }
 *
 *   const info = await DCDN.getSiteInfo();  info.Site.currency_code
 */
D.getSiteInfo = function (opts) {
  opts = opts || {};
  if (!opts.force) {
    var cached = readSiteInfo();
    if (cached) return Promise.resolve(cached);
    if (siteInfoPromise) return siteInfoPromise;
  }
  siteInfoPromise = D.fetch("/api2/site_info")
    .then(function (res) {
      var data = (res && res.data) || res;
      var existing = readSiteInfo();
      if (existing && !opts.force) return existing; // someone else set it first
      lsSet(D.config.siteInfoKey, JSON.stringify(data));
      return data;
    })
    .finally(function () {
      siteInfoPromise = null;
    });
  return siteInfoPromise;
};

/** Shortcut -> info.Site */
D.getSite = function (opts) {
  return D.getSiteInfo(opts).then(function (i) {
    return (i && i.Site) || i || {};
  });
};

/** Synchronous read of the cached site info (null if not cached yet). */
D.getSiteInfoSync = readSiteInfo;

D.clearSiteInfo = function () {
  lsDel(D.config.siteInfoKey);
};

/**
 * Cached app settings record (like setAppInfo / getAppGeneralSettings).
 *   DCDN.getAppSettings("le_pos_general_Settings", { appId: 82, ttl: 3600 })
 */
D.getAppSettings = function (entity, opts) {
  opts = opts || {};
  var appId = opts.appId || entity;
  var id = opts.id || 1;
  if (!opts.force) {
    var c = D.storage.get(appId, "settings");
    if (c) return Promise.resolve(c);
  }
  return D.fetch("/v2/api/entity/" + entity + "/" + id + "/" + (opts.depth == null ? 1 : opts.depth)).then(function (data) {
    D.storage.set(appId, "settings", data, opts.ttl ? { ttl: opts.ttl } : undefined);
    return data;
  });
};

/* ----------------------------- language --------------------------------- */

var LANG_CODES = { 7: "ar", 41: "en" }; // Daftra Site.language_code

/**
 * Detect page language -> "ar" | "en"
 * Order: config.lang -> body.en_app/ar_app -> html/body dir attr ->
 *        computed body direction -> html[lang] -> cached site_info -> "ar"
 */
D.detectLang = function () {
  if (D.config.lang) return D.config.lang;
  var b = document.body;
  if (b) {
    if (b.classList.contains("en_app")) return "en";
    if (b.classList.contains("ar_app")) return "ar";
  }
  var html = document.documentElement;
  var dir = (html.getAttribute("dir") || (b && b.getAttribute("dir")) || "").toLowerCase();
  if (dir === "rtl") return "ar";
  if (dir === "ltr") return "en";
  if (b && window.getComputedStyle) {
    var cd = getComputedStyle(b).direction;
    if (cd === "rtl") return "ar";
  }
  var l = (html.getAttribute("lang") || "").toLowerCase();
  if (l.indexOf("ar") === 0) return "ar";
  var info = readSiteInfo();
  var code = info && info.Site && info.Site.language_code;
  if (code && LANG_CODES[code]) return LANG_CODES[code];
  if (l.indexOf("en") === 0) return "en";
  return "ar";
};
D.isRTL = function () {
  return D.detectLang() === "ar";
};
D.isEn = function () {
  return D.detectLang() === "en";
};

/** Pick the right text: DCDN.t("نص", "Text") or DCDN.t({ar, en}) */
D.t = function (ar, en) {
  if (en === undefined) return txt(ar);
  return D.detectLang() === "en" ? en : ar;
};

/**
 * Translate the page.
 *   DCDN.translate([["العميل", "Client"], ["الخدمات", "Services"]])
 *   DCDN.translate([{ ar: "حفظ", en: "Save" }], { root: "#myForm", observe: true })
 *
 * If page language is en -> replaces Arabic with English, if ar -> English with Arabic.
 * opts: root (default body), attributes (placeholder,title,value,aria-label),
 *       exact (only whole-text matches), observe (keep translating new DOM), lang (force)
 * returns number of replacements.
 */
D.translate = function (words, opts) {
  opts = opts || {};
  var lang = opts.lang || D.detectLang();
  var pairs = (words || [])
    .map(function (w) {
      var ar = Array.isArray(w) ? w[0] : w.ar;
      var en = Array.isArray(w) ? w[1] : w.en;
      return lang === "en" ? [ar, en] : [en, ar];
    })
    .filter(function (p) {
      return p[0] && p[1] != null && p[0] !== p[1];
    })
    .sort(function (a, b) {
      return b[0].length - a[0].length; // longest first
    });
  if (!pairs.length) return 0;
  var attrs = opts.attributes || ["placeholder", "title", "aria-label", "data-original-title"];
  var root = $el(opts.root) || document.body;
  var count = 0;

  function swap(s) {
    if (!s || !s.trim()) return s;
    if (opts.exact) {
      var t = s.trim();
      for (var i = 0; i < pairs.length; i++) if (t === pairs[i][0]) { count++; return s.replace(t, pairs[i][1]); }
      return s;
    }
    var out = s;
    for (var j = 0; j < pairs.length; j++) {
      if (out.indexOf(pairs[j][0]) > -1) {
        out = out.split(pairs[j][0]).join(pairs[j][1]);
        count++;
      }
    }
    return out;
  }

  function run(node) {
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return p === "SCRIPT" || p === "STYLE" || p === "TEXTAREA" || p === "NOSCRIPT" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    var list = [];
    while ((n = walker.nextNode())) list.push(n);
    list.forEach(function (tn) {
      var v = swap(tn.nodeValue);
      if (v !== tn.nodeValue) tn.nodeValue = v;
    });
    var els = node.querySelectorAll ? node.querySelectorAll("*") : [];
    var all = [node].concat(Array.prototype.slice.call(els));
    all.forEach(function (el) {
      if (!el.getAttribute) return;
      attrs.forEach(function (a) {
        var v = el.getAttribute(a);
        if (v) {
          var nv = swap(v);
          if (nv !== v) el.setAttribute(a, nv);
        }
      });
      if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && el.value) el.value = swap(el.value);
      if (el.tagName === "OPTION") {
        /* option text handled by text nodes */
      }
    });
  }
  run(root);

  if (opts.observe) {
    var busy = false;
    var obs = new MutationObserver(
      D.debounce(function (muts) {
        if (busy) return;
        busy = true;
        run(root);
        busy = false;
      }, 80)
    );
    obs.observe(root, { childList: true, subtree: true });
    D.translate._observers = (D.translate._observers || []).concat(obs);
  }
  return count;
};

/** Translate one string with the same dictionary format. */
D.translateText = function (text, words, lang) {
  lang = lang || D.detectLang();
  var out = String(text == null ? "" : text);
  (words || []).forEach(function (w) {
    var ar = Array.isArray(w) ? w[0] : w.ar;
    var en = Array.isArray(w) ? w[1] : w.en;
    var from = lang === "en" ? ar : en;
    var to = lang === "en" ? en : ar;
    if (from) out = out.split(from).join(to);
  });
  return out;
};

/**
 * Add body classes used by old apps: "custom_app en_app|ar_app {country} {currency}".
 * Runs automatically once site info is cached.
 */
D.applyBodyClasses = function () {
  return D.getSite().then(function (site) {
    if (!document.body) return;
    var lang = LANG_CODES[site.language_code] || (D.isRTL() ? "ar" : "en");
    document.body.classList.add("custom_app", lang + "_app");
    if (site.country_code) document.body.classList.add(site.country_code);
    if (site.currency_code) document.body.classList.add(site.currency_code);
    return site;
  });
};

/* Auto clear cached site_info when the settings form is saved. */
function autoResetSiteInfo() {
  if (!D.config.autoResetSiteInfo) return;
  if (!/\/settings/.test(location.pathname)) return;
  document.addEventListener(
    "submit",
    function (e) {
      if (e.target && e.target.id === "SiteChangeSettingsForm") D.clearSiteInfo();
      else if (location.pathname === "/settings" || /\/owner\/sites\/change_settings/.test(location.pathname)) D.clearSiteInfo();
    },
    true
  );
}


/* ---- 04-ui.js ---- */
/* ==========================================================================
 * 04-ui.js — loader, toast, progress bar, popup / confirm
 * All styles are injected once (id="dcdn-styles"), every class is "dcdn-".
 * ======================================================================== */

var CSS_TEXT = [
  ".dcdn-overlay{position:fixed;inset:0;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:var(--dcdn-z,1000000)}",
  ".dcdn-spinner{width:64px;height:64px;border:6px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:dcdn-spin .9s linear infinite}",
  ".dcdn-loader-box{display:flex;flex-direction:column;align-items:center;gap:14px;color:#fff;font:600 15px/1.4 inherit}",
  "@keyframes dcdn-spin{to{transform:rotate(360deg)}}",
  ".dcdn-inline-spinner{display:inline-block;width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:var(--dcdn-primary,#1877f2);border-radius:50%;animation:dcdn-spin .8s linear infinite;vertical-align:middle}",
  /* toast */
  ".dcdn-toasts{position:fixed;z-index:calc(var(--dcdn-z,1000000) + 2);display:flex;flex-direction:column;gap:8px;max-width:380px;width:calc(100% - 32px);pointer-events:none}",
  ".dcdn-toasts.top-right{top:16px;right:16px}.dcdn-toasts.top-left{top:16px;left:16px}.dcdn-toasts.bottom-right{bottom:16px;right:16px}.dcdn-toasts.bottom-left{bottom:16px;left:16px}",
  ".dcdn-toasts.top-center{top:16px;left:50%;transform:translateX(-50%)}.dcdn-toasts.bottom-center{bottom:16px;left:50%;transform:translateX(-50%)}",
  ".dcdn-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:10px;background:#fff;color:#1e293b;border-radius:8px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.15);border-inline-start:4px solid #64748b;font-size:14px;line-height:1.5;animation:dcdn-in .25s ease;transition:opacity .25s,transform .25s}",
  ".dcdn-toast.success{border-color:#16a34a}.dcdn-toast.error{border-color:#dc2626}.dcdn-toast.warning{border-color:#d97706}.dcdn-toast.info{border-color:#2563eb}",
  ".dcdn-toast-icon{flex:0 0 22px;height:22px;border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px}",
  ".dcdn-toast.success .dcdn-toast-icon{background:#16a34a}.dcdn-toast.error .dcdn-toast-icon{background:#dc2626}.dcdn-toast.warning .dcdn-toast-icon{background:#d97706}.dcdn-toast.info .dcdn-toast-icon{background:#2563eb}",
  ".dcdn-toast-body{flex:1;word-break:break-word}.dcdn-toast-title{font-weight:700;margin-bottom:2px}",
  ".dcdn-toast-close{background:none;border:0;font-size:18px;line-height:1;color:#94a3b8;cursor:pointer;padding:0}",
  ".dcdn-toast.hide{opacity:0;transform:translateY(-6px)}",
  "@keyframes dcdn-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}",
  /* progress */
  ".dcdn-progress{background:#fff;border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-size:13px;color:#1e293b}",
  ".dcdn-progress.floating{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:min(420px,calc(100% - 32px));z-index:calc(var(--dcdn-z,1000000) + 1)}",
  ".dcdn-progress-head{display:flex;justify-content:space-between;margin-bottom:8px;font-weight:600;gap:8px}",
  ".dcdn-progress-track{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}",
  ".dcdn-progress-fill{height:100%;width:0;background:var(--dcdn-primary,#1877f2);border-radius:6px;transition:width .25s ease}",
  ".dcdn-progress.done .dcdn-progress-fill{background:#16a34a}.dcdn-progress.error .dcdn-progress-fill{background:#dc2626}",
  ".dcdn-progress-text{margin-top:6px;color:#64748b;font-size:12px}",
  /* popup */
  ".dcdn-popup{background:#fff;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.25);max-width:calc(100% - 32px);max-height:calc(100vh - 40px);display:flex;flex-direction:column;animation:dcdn-in .2s ease;color:#1e293b}",
  ".dcdn-popup-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:16px}",
  ".dcdn-popup-close{background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#64748b}",
  ".dcdn-popup-body{padding:18px;overflow:auto;flex:1}",
  ".dcdn-popup-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #e2e8f0}",
  ".dcdn-btn{border:0;border-radius:6px;padding:8px 16px;font-size:14px;cursor:pointer;background:#e2e8f0;color:#1e293b}",
  ".dcdn-btn.primary{background:var(--dcdn-primary,#1877f2);color:#fff}.dcdn-btn.danger{background:#dc2626;color:#fff}",
  ".dcdn-btn:disabled{opacity:.6;cursor:not-allowed}",
  /* dropdown + percent */
  ".dcdn-dropdown{box-sizing:border-box}",
  ".dcdn-percent-input{box-sizing:border-box;text-align:center}",
  ".dcdn-tab-loading{padding:20px;text-align:center}",
].join("\n");

function ensureStyles() {
  var s = D.injectCSS(CSS_TEXT, "dcdn-styles");
  document.documentElement.style.setProperty("--dcdn-z", D.config.zIndex);
  document.documentElement.style.setProperty("--dcdn-primary", D.config.primaryColor);
  return s;
}
D.ensureStyles = ensureStyles;

/* ------------------------------- loader --------------------------------- */

var loaderCount = 0;

/**
 * Full-screen loader. Nested calls are counted: the loader hides when the
 * last caller calls hideLoader() (or hideLoader(true) to force).
 *   DCDN.showLoader("جاري الحفظ...")
 */
D.showLoader = function (text) {
  ensureStyles();
  loaderCount++;
  var el = document.getElementById("dcdn-loader");
  if (!el) {
    el = h('<div id="dcdn-loader" class="dcdn-overlay" role="status" aria-live="polite"><div class="dcdn-loader-box"><div class="dcdn-spinner"></div><div class="dcdn-loader-text"></div></div></div>');
    document.body.appendChild(el);
  }
  el.querySelector(".dcdn-loader-text").textContent = text ? txt(text) : "";
  el.style.display = "flex";
  return el;
};

D.hideLoader = function (force) {
  loaderCount = force ? 0 : Math.max(0, loaderCount - 1);
  if (loaderCount > 0) return;
  var el = document.getElementById("dcdn-loader");
  if (el) el.style.display = "none";
};

/** Old name kept for drop-in replacement. */
D.toggleLoadingSpinner = function (show, text) {
  return show ? D.showLoader(text) : D.hideLoader(true);
};

/** Show loader while a promise / async fn runs. */
D.withLoader = function (work, text) {
  D.showLoader(text);
  return Promise.resolve()
    .then(function () {
      return typeof work === "function" ? work() : work;
    })
    .finally(function () {
      D.hideLoader();
    });
};

/* -------------------------------- toast --------------------------------- */

var ICONS = { success: "✓", error: "✕", warning: "!", info: "i" };

/**
 * DCDN.toast("تم الحفظ")                         // success
 * DCDN.toast("Error", "error", { timeout: 6000, title: "Oops" })
 * DCDN.toast({ ar: "تم", en: "Done" }, "info")
 * positions: top-right | top-left | top-center | bottom-right | bottom-left | bottom-center
 *            (default: top-left on RTL pages, top-right on LTR)
 */
D.toast = function (message, type, opts) {
  ensureStyles();
  if (type && typeof type === "object") {
    opts = type;
    type = opts.type;
  }
  opts = opts || {};
  type = type || "success";
  var pos = opts.position || (D.isRTL() ? "top-left" : "top-right");
  var box = document.querySelector(".dcdn-toasts." + pos);
  if (!box) {
    box = h('<div class="dcdn-toasts ' + pos + '"></div>');
    document.body.appendChild(box);
  }
  box.setAttribute("dir", D.isRTL() ? "rtl" : "ltr");
  var el = h(
    '<div class="dcdn-toast ' + type + '" role="alert"><span class="dcdn-toast-icon">' + (ICONS[type] || "i") +
      '</span><div class="dcdn-toast-body"></div><button type="button" class="dcdn-toast-close" aria-label="close">×</button></div>'
  );
  var body = el.querySelector(".dcdn-toast-body");
  if (opts.title) {
    var t = document.createElement("div");
    t.className = "dcdn-toast-title";
    t.textContent = txt(opts.title);
    body.appendChild(t);
  }
  var m = document.createElement("div");
  if (opts.html) m.innerHTML = txt(message);
  else m.textContent = txt(message);
  body.appendChild(m);
  if (pos.indexOf("bottom") === 0) box.insertBefore(el, box.firstChild);
  else box.appendChild(el);

  var timer;
  function close() {
    clearTimeout(timer);
    el.classList.add("hide");
    setTimeout(function () {
      el.remove();
    }, 260);
  }
  el.querySelector(".dcdn-toast-close").onclick = close;
  var timeout = opts.timeout == null ? (type === "error" ? 6000 : 3500) : opts.timeout;
  if (timeout) timer = setTimeout(close, timeout);
  return { el: el, close: close };
};
["success", "error", "warning", "info"].forEach(function (t) {
  D.toast[t] = function (msg, opts) {
    return D.toast(msg, t, opts);
  };
});

/* ----------------------------- progress bar ----------------------------- */

/**
 * const bar = DCDN.progressBar({ title: "Uploading", total: 50 })
 * bar.update(10)          // or bar.update(10, 50)
 * bar.increment()
 * bar.setText("custom")
 * bar.done("Finished")    // turns green & auto-removes (autoClose ms, default 1500)
 * bar.error("Failed")
 * bar.remove()
 * opts.target: container selector/element -> renders inline instead of floating
 */
D.progressBar = function (opts) {
  ensureStyles();
  opts = opts || {};
  var total = opts.total || 0;
  var current = 0;
  var target = $el(opts.target);
  var el = h(
    '<div class="dcdn-progress' + (target ? "" : " floating") + '"><div class="dcdn-progress-head"><span class="dcdn-progress-title"></span><span class="dcdn-progress-pct">0%</span></div>' +
      '<div class="dcdn-progress-track"><div class="dcdn-progress-fill"></div></div><div class="dcdn-progress-text"></div></div>'
  );
  el.setAttribute("dir", D.isRTL() ? "rtl" : "ltr");
  el.querySelector(".dcdn-progress-title").textContent = txt(opts.title || { ar: "جاري التنفيذ...", en: "Processing..." });
  (target || document.body).appendChild(el);
  var fill = el.querySelector(".dcdn-progress-fill");
  var pctEl = el.querySelector(".dcdn-progress-pct");
  var textEl = el.querySelector(".dcdn-progress-text");
  var customText = false;

  var api = {
    el: el,
    update: function (cur, tot) {
      current = cur;
      if (tot != null) total = tot;
      var pct = total ? Math.min(100, Math.round((current / total) * 100)) : Math.min(100, current);
      fill.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      if (!customText && total) textEl.textContent = current + " / " + total;
      return api;
    },
    increment: function (n) {
      return api.update(current + (n || 1));
    },
    setText: function (t) {
      customText = true;
      textEl.textContent = txt(t);
      return api;
    },
    setTitle: function (t) {
      el.querySelector(".dcdn-progress-title").textContent = txt(t);
      return api;
    },
    done: function (msg, autoClose) {
      api.update(total || 100, total || 100);
      el.classList.add("done");
      if (msg) api.setText(msg);
      var ms = autoClose == null ? (opts.autoClose == null ? 1500 : opts.autoClose) : autoClose;
      if (ms !== false) setTimeout(api.remove, ms);
      return api;
    },
    error: function (msg) {
      el.classList.add("error");
      if (msg) api.setText(msg);
      return api;
    },
    remove: function () {
      el.remove();
    },
  };
  return api;
};

/* -------------------------------- popup --------------------------------- */

var popupStack = [];

/**
 * Show a modal popup with any HTML.
 *   const p = DCDN.showPopup("<p>Hello</p>", {
 *     title: { ar: "عنوان", en: "Title" }, width: 600,
 *     buttons: [{ text: "Save", class: "primary", onClick: (p) => {...; p.close()} }],
 *     onOpen: (p) => {}, onClose: () => {}, closeOnBackdrop: true, closeOnEsc: true
 *   })
 *   p.body (element), p.close(), p.setContent(html)
 */
D.showPopup = function (html, opts) {
  ensureStyles();
  opts = opts || {};
  var id = opts.id || D.uid("popup");
  var existing = document.getElementById(id);
  if (existing) existing.remove();
  var overlay = h('<div class="dcdn-overlay dcdn-popup-overlay" id="' + id + '"><div class="dcdn-popup" role="dialog" aria-modal="true"></div></div>');
  overlay.style.zIndex = D.config.zIndex + 3 + popupStack.length;
  var box = overlay.firstChild;
  box.setAttribute("dir", opts.dir || (D.isRTL() ? "rtl" : "ltr"));
  box.style.width = typeof opts.width === "number" ? opts.width + "px" : opts.width || "560px";
  if (opts.className) box.className += " " + opts.className;

  if (opts.title !== false) {
    var head = h('<div class="dcdn-popup-head"><span class="dcdn-popup-title"></span><button type="button" class="dcdn-popup-close" aria-label="close">×</button></div>');
    head.querySelector(".dcdn-popup-title").textContent = txt(opts.title || "");
    box.appendChild(head);
  }
  var body = h('<div class="dcdn-popup-body"></div>');
  box.appendChild(body);

  var api = {
    id: id,
    el: overlay,
    box: box,
    body: body,
    setContent: function (c) {
      body.innerHTML = "";
      if (c && c.nodeType) body.appendChild(c);
      else if (c && c.jquery) body.appendChild(c[0]);
      else body.innerHTML = txt(c);
      return api;
    },
    close: function (result) {
      if (!overlay.parentNode) return;
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      popupStack = popupStack.filter(function (p) {
        return p !== api;
      });
      if (opts.onClose) opts.onClose(result, api);
    },
  };
  api.setContent(html);

  if (opts.buttons && opts.buttons.length) {
    var foot = h('<div class="dcdn-popup-foot"></div>');
    opts.buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dcdn-btn " + (b["class"] || b.className || "");
      btn.textContent = txt(b.text);
      btn.onclick = function () {
        if (b.onClick) b.onClick(api, btn);
        else api.close();
      };
      foot.appendChild(btn);
    });
    box.appendChild(foot);
  }

  function onKey(e) {
    if (e.key === "Escape" && popupStack[popupStack.length - 1] === api) api.close();
  }
  if (opts.closeOnEsc !== false) document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay && opts.closeOnBackdrop !== false) api.close();
  });
  var x = box.querySelector(".dcdn-popup-close");
  if (x) x.onclick = function () {
    api.close();
  };

  document.body.appendChild(overlay);
  popupStack.push(api);
  if (opts.onOpen) opts.onOpen(api);
  return api;
};

/** Close the top popup, or a popup by id. */
D.closePopup = function (id) {
  var p = id
    ? popupStack.filter(function (x) {
        return x.id === id;
      })[0]
    : popupStack[popupStack.length - 1];
  if (p) p.close();
};

/** Promise-based confirm. resolves true / false */
D.confirm = function (message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var answered = false;
    D.showPopup('<div style="font-size:15px;line-height:1.7"></div>', {
      title: opts.title || { ar: "تأكيد", en: "Confirm" },
      width: opts.width || 420,
      onOpen: function (p) {
        p.body.firstChild.textContent = txt(message);
      },
      onClose: function () {
        if (!answered) resolve(false);
      },
      buttons: [
        { text: opts.cancelText || { ar: "إلغاء", en: "Cancel" }, onClick: function (p) { answered = true; resolve(false); p.close(); } },
        { text: opts.okText || { ar: "تأكيد", en: "OK" }, "class": opts.danger ? "danger" : "primary", onClick: function (p) { answered = true; resolve(true); p.close(); } },
      ],
    });
  });
};

/** Simple alert popup. resolves when closed. */
D.alert = function (message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    D.showPopup('<div style="font-size:15px;line-height:1.7"></div>', {
      title: opts.title || { ar: "تنبيه", en: "Alert" },
      width: opts.width || 420,
      onOpen: function (p) {
        p.body.firstChild.textContent = txt(message);
      },
      onClose: function () {
        resolve();
      },
      buttons: [{ text: opts.okText || { ar: "حسناً", en: "OK" }, "class": "primary" }],
    });
  });
};


/* ---- 05-tabs.js ---- */
/* ==========================================================================
 * 05-tabs.js — append a custom tab to Daftra view / show pages
 *
 * Two DOM layouts exist in Daftra:
 *  classic (/owner/.../view/ID, Bootstrap 3):
 *     ul.nav.nav-tabs(.responsive) > li > a[data-toggle=tab]   +  div.tab-content > .tab-pane
 *     (+ mobile accordion .responsive.visible-sm .panel)
 *  v2 (/v2/owner/entity/{entity}/{id}/show, Bootstrap 4):
 *     ul#item-nav-tabs-responsive > li.nav-item > a.nav-link   +  #item-nav-tabs-content-responsive > .tab-pane
 *
 * Usage:
 *   DCDN.appendtab_invoice({ id: "services_log", title: { ar: "سجل الطلبات", en: "Services Log" },
 *                            url: "/v2/owner/entity/le_invoice-items/list?filter[invoice_id]=" + DCDN.getRecordId() })
 *   DCDN.appendtab_entity({ id: "payments", title: "المدفوعات", content: html })
 *   DCDN.appendTab("client", { id: "notes", title: "Notes", onOpen: (pane) => {...} })
 *
 * The page name after "appendtab_" is changeable — any registered page works,
 * and DCDN.registerTabPage("my_page") creates DCDN.appendtab_my_page.
 * ======================================================================== */

var TAB_PAGES = {};

/**
 * Register a page type.
 * cfg: { layout: "auto" | "classic" | "v2", match: RegExp (optional – only used for warnings),
 *        nav: selector, content: selector }   (nav/content override auto-detection)
 */
D.registerTabPage = function (name, cfg) {
  TAB_PAGES[name] = Object.assign({ layout: "auto" }, cfg || {});
  D["appendtab_" + name] = function (opts) {
    return D.appendTab(name, opts);
  };
  return D["appendtab_" + name];
};

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
].forEach(function (p) {
  D.registerTabPage(p[0], { match: p[1] });
});

var V2_NAV = "#item-nav-tabs-responsive";
var V2_CONTENT = "#item-nav-tabs-content-responsive";
var CLASSIC_NAV = "ul.nav.nav-tabs.responsive, ul.nav.nav-tabs";

function detectLayout(cfg) {
  if (cfg.nav && cfg.content) return { layout: cfg.layout === "v2" ? "v2" : "classic", nav: $el(cfg.nav), content: $el(cfg.content) };
  if (cfg.layout !== "classic" && document.querySelector(V2_NAV)) {
    return { layout: "v2", nav: document.querySelector(V2_NAV), content: document.querySelector(V2_CONTENT) };
  }
  var nav = document.querySelector(CLASSIC_NAV);
  if (!nav) return null;
  var content =
    (nav.parentNode && nav.parentNode.querySelector(":scope > .tab-content")) ||
    (nav.nextElementSibling && nav.nextElementSibling.classList.contains("tab-content") ? nav.nextElementSibling : null) ||
    document.querySelector("div.tab-content");
  return { layout: "classic", nav: nav, content: content };
}

function deactivateAll(ctx) {
  $all(":scope > li", ctx.nav).forEach(function (li) {
    li.classList.remove("active");
    var a = li.querySelector("a");
    if (a) {
      a.classList.remove("active");
      a.setAttribute("aria-selected", "false");
    }
  });
  $all(":scope > .tab-pane", ctx.content).forEach(function (p) {
    p.classList.remove("active", "show", "in");
  });
}

/** One delegated listener per nav: clicking a native tab hides our custom panes. */
function bindNav(ctx) {
  if (ctx.nav.dataset.dcdnBound) return;
  ctx.nav.dataset.dcdnBound = "1";
  ctx.nav.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a || !ctx.nav.contains(a) || a.dataset.dcdnTab) return;
    $all(".tab-pane[data-dcdn-tab]", ctx.content).forEach(function (p) {
      p.classList.remove("active", "show", "in");
    });
    $all("a[data-dcdn-tab]", ctx.nav).forEach(function (x) {
      x.classList.remove("active");
      x.closest("li").classList.remove("active");
    });
    // if bootstrap's tab plugin is not active on this page, switch manually
    var href = a.getAttribute("href") || "";
    var pane = href.charAt(0) === "#" && href.length > 1 ? ctx.content.querySelector(href) : null;
    if (pane && !window.jQuery) {
      deactivateAll(ctx);
      a.classList.add("active");
      a.closest("li").classList.add("active");
      pane.classList.add("active", "show", "in");
    }
  });
}

/**
 * Generic: DCDN.appendTab(page, opts)
 * opts:
 *   id        (required) unique id -> pane id
 *   title     string | {ar,en}
 *   content   html | Element | (pane, tab) => html|Promise<html>
 *   url       page to load into the tab (e.g. a v2 list page)
 *   selector  part of `url` to keep (default ".list-table, table, .panel")
 *   lazy      load content on first open (default true)
 *   reload    reload content every time the tab opens (default false)
 *   active    open it immediately (default false)
 *   position  index to insert at (default: end)
 *   badge     number/text shown next to title
 *   onOpen(pane, tab)
 *   timeout   wait for the tabs container (ms, default 15000)
 * returns Promise<tab> { link, pane, open(), setContent(html), reload(), setBadge(v), remove() }
 */
D.appendTab = function (page, opts) {
  if (page && typeof page === "object") {
    opts = page;
    page = "auto";
  }
  opts = opts || {};
  var cfg = TAB_PAGES[page] || { layout: "auto" };
  if (cfg.match && !cfg.match.test(location.pathname)) log("appendTab: '" + page + "' pattern does not match this url, continuing anyway");
  if (!opts.id) opts.id = D.uid("tab");
  var paneId = opts.id;

  var waitSel = cfg.nav || V2_NAV + ", " + CLASSIC_NAV;
  return D.waitForElement(waitSel, { timeout: opts.timeout == null ? 15000 : opts.timeout }).then(function () {
    var ctx = detectLayout(cfg);
    if (!ctx || !ctx.content) throw new Error("appendTab: tabs container not found");
    ensureStyles();
    bindNav(ctx);

    var existing = ctx.nav.querySelector('a[data-dcdn-tab="' + paneId + '"]');
    if (existing && existing._dcdnTab) return existing._dcdnTab;

    var li, a;
    var title = txt(opts.title || paneId);
    if (ctx.layout === "v2") {
      li = h('<li class="nav-item"><a class="nav-link" role="tab" data-toggle="tab" aria-selected="false"></a></li>');
      a = li.firstChild;
      a.id = paneId + "-tab";
      a.textContent = title;
    } else {
      var tpl = ctx.nav.querySelector(":scope > li");
      li = tpl ? tpl.cloneNode(false) : document.createElement("li");
      li.classList.remove("active");
      li.setAttribute("role", "presentation");
      a = document.createElement("a");
      a.setAttribute("role", "tab");
      a.setAttribute("data-toggle", "tab");
      a.className = "nav-link";
      a.innerHTML = '<span class="one-line"></span>';
      a.firstChild.textContent = title;
      li.appendChild(a);
    }
    a.setAttribute("href", "#" + paneId);
    a.setAttribute("aria-controls", paneId);
    a.setAttribute("title", title);
    a.dataset.dcdnTab = paneId;
    var badge = document.createElement("span");
    badge.className = "badge dcdn-tab-badge";
    badge.style.cssText = "margin-inline-start:6px;display:none";
    a.appendChild(badge);

    var pane = document.createElement("div");
    pane.className = "tab-pane" + (ctx.layout === "v2" ? " p-3" : "");
    pane.id = paneId;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", a.id || paneId);
    pane.dataset.dcdnTab = paneId;

    var items = ctx.nav.querySelectorAll(":scope > li");
    if (opts.position != null && items[opts.position]) ctx.nav.insertBefore(li, items[opts.position]);
    else ctx.nav.appendChild(li);
    ctx.content.appendChild(pane);

    var loaded = false;
    var tab = {
      id: paneId,
      link: a,
      li: li,
      pane: pane,
      layout: ctx.layout,
      setContent: function (c) {
        pane.innerHTML = "";
        if (c && c.nodeType) pane.appendChild(c);
        else if (c && c.jquery) pane.appendChild(c[0]);
        else if (c != null) pane.innerHTML = c;
        return tab;
      },
      setBadge: function (v) {
        badge.textContent = v == null ? "" : v;
        badge.style.display = v == null || v === "" ? "none" : "";
        return tab;
      },
      reload: function () {
        loaded = false;
        return load();
      },
      open: function () {
        deactivateAll(ctx);
        li.classList.add("active");
        a.classList.add("active");
        a.setAttribute("aria-selected", "true");
        pane.classList.add("active", "show", "in");
        var p = !loaded || opts.reload ? load() : Promise.resolve();
        return p.then(function () {
          if (opts.onOpen) opts.onOpen(pane, tab);
          return tab;
        });
      },
      remove: function () {
        li.remove();
        pane.remove();
      },
    };
    a._dcdnTab = tab;
    if (opts.badge != null) tab.setBadge(opts.badge);

    function load() {
      loaded = true;
      if (opts.content == null && !opts.url) return Promise.resolve();
      pane.innerHTML = '<div class="dcdn-tab-loading"><span class="dcdn-inline-spinner"></span></div>';
      var job;
      if (opts.url) {
        job = fetch(opts.url, { credentials: "same-origin" })
          .then(function (r) {
            return r.text();
          })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            var part = doc.querySelector(opts.selector || ".list-table, table, .panel");
            return part ? part.outerHTML : '<div class="alert alert-info">' + txt({ ar: "لا توجد بيانات", en: "No data" }) + "</div>";
          });
      } else if (typeof opts.content === "function") {
        job = Promise.resolve(opts.content(pane, tab));
      } else {
        job = Promise.resolve(opts.content);
      }
      return job
        .then(function (c) {
          if (c !== undefined) tab.setContent(c);
          else if (pane.querySelector(".dcdn-tab-loading")) pane.innerHTML = "";
        })
        .catch(function (e) {
          warn("tab load error", e);
          pane.innerHTML = '<div class="alert alert-danger">' + D.escapeHtml(e.message) + "</div>";
        });
    }

    a.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      tab.open();
    });

    // classic mobile accordion (visible on small screens)
    if (ctx.layout === "classic") {
      var mobile = document.querySelector(".responsive.visible-sm, .responsive.visible-xs");
      var panelTpl = mobile && mobile.querySelector(".panel");
      if (panelTpl) {
        var mp = panelTpl.cloneNode(false);
        mp.classList.remove("active");
        mp.innerHTML =
          '<div class="panel-heading"><h4 class="panel-title"><a class="accordion-toggle collapsed" data-toggle="collapse" href="#collapse-' + paneId +
          '" aria-expanded="false"><span class="one-line"></span></a></h4></div><div id="collapse-' + paneId + '" class="panel-collapse collapse"><div class="panel-body"></div></div>';
        mp.querySelector(".one-line").textContent = title;
        mobile.appendChild(mp);
        mp.querySelector("a").addEventListener("click", function (e) {
          e.preventDefault();
          var col = mp.querySelector(".panel-collapse");
          var body = mp.querySelector(".panel-body");
          var opening = !col.classList.contains("in");
          col.classList.toggle("in", opening);
          col.style.display = opening ? "block" : "";
          if (opening) {
            (loaded && !opts.reload ? Promise.resolve() : load()).then(function () {
              body.innerHTML = "";
              body.appendChild(pane.cloneNode(true)).classList.add("active", "in", "show");
            });
          }
        });
        tab.mobilePanel = mp;
      }
    }

    if (!opts.lazy && opts.lazy !== undefined) load();
    if (opts.active) return tab.open();
    return tab;
  });
};


/* ---- 06-dropdown-percent.js ---- */
/* ==========================================================================
 * 06-dropdown-percent.js — addDropdown, calculatePercent
 * ======================================================================== */

/** Only copy Bootstrap styling classes (never functional classes that selectors target). */
function styleClasses(el) {
  var keep = (el.className || "").split(/\s+/).filter(function (c) {
    return /^(form-control|form-select|input-(sm|lg)|custom-select)/.test(c);
  });
  return keep.length ? keep.join(" ") : "form-control";
}

/** Normalize options: strings | {value,text} | raw API rows (valueKey/textKey). */
function normalizeOptions(list, o) {
  var vk = o.valueKey || "value";
  var tk = o.textKey || "text";
  return (list || []).map(function (it) {
    if (it == null) return null;
    if (typeof it !== "object") return { value: String(it), text: String(it), data: it };
    var get = function (obj, path) {
      return typeof path === "function"
        ? path(obj)
        : String(path)
            .split(".")
            .reduce(function (a, k) {
              return a == null ? a : a[k];
            }, obj);
    };
    var v = get(it, vk);
    var t = get(it, tk);
    if (v == null) v = it.id != null ? it.id : it.value;
    if (t == null) t = it.name != null ? it.name : it.text != null ? it.text : it.title != null ? it.title : v;
    return { value: String(v), text: txt(t), data: it };
  }).filter(Boolean);
}

function resolveOptions(o) {
  if (o.source) {
    var s = o.source;
    var job = s.all === false ? D.fetch(s.url, s).then(function (r) { return (r && r.data) || r; }) : D.bulkFetch(s.url, s);
    return job.then(function (rows) {
      return normalizeOptions(rows, { valueKey: s.valueKey || o.valueKey || "id", textKey: s.textKey || o.textKey || "name" });
    });
  }
  var opts = typeof o.options === "function" ? o.options() : o.options;
  return Promise.resolve(opts).then(function (list) {
    return normalizeOptions(list, o);
  });
}

/**
 * Replace a field with a dropdown whose options YOU choose.
 *
 * A) Single-line text field  -> the selected value (or text) is written into the input.
 *    DCDN.addDropdown('[id$="--single_line_field"]', {
 *       options: ["A", "B", { value: 3, text: "Three" }],
 *       saveAs: "text"            // "value" (default) | "text"
 *    })
 *
 * B) Dynamic dropdown (<select>, selectize or select2) -> on select, the option is
 *    APPENDED to the original select (if missing) and selected.
 *    DCDN.addDropdown("#data-le_custom_data_client--city", {
 *       source: { url: "/v2/api/entity/le_cities/list/1", valueKey: "id", textKey: "city", filters: {...} }
 *    })
 *
 * opts:
 *   options      array | () => array | Promise<array>
 *   source       { url, filters, sort, valueKey, textKey, all (default true = all pages) }
 *   valueKey / textKey   keys (or dot paths / functions) when options are raw objects
 *   saveAs       "value" | "text"  – what to write into the original field
 *   placeholder  string | {ar,en}  (default "-- اختر --" / "-- Select --")
 *   hideOriginal (default true)
 *   searchable   use select2 when present on the page
 *   onSelect(option, controller)
 *   live         when target is a selector: also enhance fields added later (subform rows)
 * returns controller { select, original, setOptions(list), setValue(v), getSelected(), destroy() }
 *         (array of controllers when several fields match, Promise resolved after options load)
 */
D.addDropdown = function (target, o) {
  o = o || {};
  if (typeof target === "string" && o.live) {
    var ctrls = [];
    D.onElement(target, function (el) {
      addOne(el, o).then(function (c) {
        ctrls.push(c);
      });
    });
    return Promise.resolve(ctrls);
  }
  var els = $all(target);
  if (!els.length) {
    warn("addDropdown: target not found", target);
    return Promise.resolve(null);
  }
  var jobs = els.map(function (el) {
    return addOne(el, o);
  });
  return Promise.all(jobs).then(function (r) {
    return r.length === 1 ? r[0] : r;
  });
};
D.addDropDown = D.addDropdown;

function addOne(original, o) {
  ensureStyles();
  if (original._dcdnDropdown) return Promise.resolve(original._dcdnDropdown);
  var isSelect = original.tagName === "SELECT";
  var saveAs = o.saveAs || "value";
  var sel = document.createElement("select");
  sel.className = "dcdn-dropdown " + styleClasses(original);
  if (o.className) sel.className += " " + o.className;
  sel.id = (original.id || D.uid("dd")) + "_dcdn_select";

  // what to hide
  var hideEl = original;
  if (isSelect && original.selectize) hideEl = original.selectize.$wrapper ? original.selectize.$wrapper[0] : original.nextElementSibling;
  else if (isSelect && original.classList.contains("select2-hidden-accessible")) hideEl = original.nextElementSibling;

  var cs = window.getComputedStyle ? getComputedStyle(hideEl) : null;
  if (cs && hideEl.offsetWidth) sel.style.width = hideEl.offsetWidth + "px";
  else sel.style.width = "100%";
  if (cs && cs.height && cs.height !== "auto" && hideEl.offsetHeight) sel.style.minHeight = cs.height;

  hideEl.parentNode.insertBefore(sel, hideEl.nextSibling);
  if (o.hideOriginal !== false) hideEl.style.display = "none";

  var current = [];
  var ctrl = {
    select: sel,
    original: original,
    options: current,
    getSelected: function () {
      return current.filter(function (x) {
        return x.value === sel.value;
      })[0] || null;
    },
    setOptions: function (list) {
      current = normalizeOptions(list, o);
      ctrl.options = current;
      render();
      return ctrl;
    },
    setValue: function (v) {
      sel.value = v;
      apply();
      return ctrl;
    },
    destroy: function () {
      sel.remove();
      hideEl.style.display = "";
      delete original._dcdnDropdown;
    },
  };
  original._dcdnDropdown = ctrl;

  function originalValue() {
    if (isSelect && original.selectize) return original.selectize.getValue();
    return original.value;
  }

  function render() {
    var keep = originalValue();
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = txt(o.placeholder || { ar: "-- اختر --", en: "-- Select --" });
    sel.appendChild(ph);
    current.forEach(function (it, i) {
      var op = document.createElement("option");
      op.value = it.value;
      op.textContent = it.text;
      op.dataset.index = i;
      sel.appendChild(op);
    });
    // preselect from the original field value
    if (keep) {
      var match = current.filter(function (x) {
        return x.value == keep || x.text == keep;
      })[0];
      if (match) sel.value = match.value;
    }
    if (o.searchable && window.jQuery && window.jQuery.fn.select2) {
      var $s = window.jQuery(sel);
      if ($s.data("select2")) $s.select2("destroy");
      $s.select2({ width: sel.style.width || "100%", dir: D.isRTL() ? "rtl" : "ltr" });
    }
  }

  function apply() {
    var it = ctrl.getSelected();
    var val = it ? (saveAs === "text" ? it.text : it.value) : "";
    if (isSelect) {
      if (original.selectize) {
        var s = original.selectize;
        if (val && !s.options[val]) {
          s.addOption({ value: val, text: it.text });
          s.refreshOptions(false);
        }
        s.setValue(val);
      } else {
        var exists = Array.prototype.some.call(original.options, function (op) {
          return op.value == val;
        });
        if (val && !exists) original.add(new Option(it.text, val, true, true));
        original.value = val;
        if (window.jQuery && window.jQuery(original).data("select2")) window.jQuery(original).trigger("change");
        else fire(original, ["change"]);
      }
    } else {
      original.value = val;
      fire(original);
    }
    if (o.onSelect) o.onSelect(it, ctrl);
  }

  sel.addEventListener("change", apply);
  if (window.jQuery) window.jQuery(sel).on("select2:select", apply);

  return resolveOptions(o).then(function (list) {
    current = list;
    ctrl.options = current;
    render();
    return ctrl;
  });
}

/* --------------------------- calculatePercent ---------------------------- */

function readNumber(src, target) {
  if (src == null) return 0;
  if (typeof src === "number") return src;
  if (typeof src === "function") return D.parseNumber(src(target));
  var el = $el(src);
  if (!el) return 0;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return D.parseNumber(el.value);
  return D.parseNumber(el.textContent);
}

/**
 * Add a "%" input before a value input. Typing a percent fills the value
 * (value = base × percent / 100). The target keeps 70% of its width.
 *
 *   DCDN.calculatePercent('[id$="--discountvalue"]', { base: "#subtotal" })
 *   DCDN.calculatePercent(".value-input", { base: ".row-total", baseScope: "tr", live: true })
 *   DCDN.calculatePercent("#amount", { base: () => invoiceTotal, decimals: 3 })
 *
 * opts:
 *   base        selector | element | number | (targetEl) => number   (the value to take % of)
 *   baseScope   resolve `base` selector inside target.closest(baseScope) (rows / subforms)
 *   decimals    (default 2)
 *   ratio       width ratio kept for target (default 0.7)
 *   max         max percent (default 100)
 *   sync        typing in the value updates the percent back (default true)
 *   placeholder (default "%")
 *   live        apply to matching inputs added later
 *   onChange({ percent, value, base, target })
 * returns controller (or array) { percentInput, target, recalc(), getPercent(), setPercent(p), destroy() }
 */
D.calculatePercent = function (target, o) {
  o = o || {};
  if (typeof target === "string" && o.live) {
    var list = [];
    D.onElement(target, function (el) {
      list.push(percentOne(el, o));
    });
    return list;
  }
  var els = $all(target);
  if (!els.length) {
    warn("calculatePercent: target not found", target);
    return null;
  }
  var r = els.map(function (el) {
    return percentOne(el, o);
  });
  return r.length === 1 ? r[0] : r;
};

function percentOne(input, o) {
  ensureStyles();
  if (input._dcdnPercent) return input._dcdnPercent;
  var decimals = o.decimals == null ? 2 : o.decimals;
  var ratio = o.ratio || 0.7;
  var max = o.max == null ? 100 : o.max;
  var gap = 4;

  function baseValue() {
    var b = o.base;
    if (typeof b === "string" && o.baseScope) {
      var scope = input.closest(o.baseScope);
      b = scope ? scope.querySelector(b) : b;
    }
    return readNumber(b, input);
  }

  var pct = document.createElement("input");
  pct.type = "text";
  pct.inputMode = "decimal";
  pct.className = "dcdn-percent-input " + styleClasses(input);
  pct.placeholder = txt(o.placeholder || "%");
  pct.title = txt({ ar: "النسبة %", en: "Percent %" });
  if (input.id) pct.id = input.id + "_percent";

  var w = input.offsetWidth;
  var origWidth = input.style.width;
  var origDisplay = input.style.display;
  if (w) {
    input.style.width = Math.floor(w * ratio) + "px";
    pct.style.width = Math.floor(w * (1 - ratio)) - gap + "px";
  } else {
    input.style.width = ratio * 100 + "%";
    pct.style.width = "calc(" + (1 - ratio) * 100 + "% - " + gap + "px)";
  }
  input.style.display = "inline-block";
  pct.style.display = "inline-block";
  pct.style.marginInlineEnd = gap + "px";
  input.parentNode.insertBefore(pct, input);

  var lock = false;
  function fromPercent() {
    if (lock) return;
    var raw = pct.value.trim();
    if (raw === "") return;
    var p = D.parseNumber(raw);
    if (p > max) {
      p = max;
      pct.value = max;
    }
    var base = baseValue();
    var val = D.round((base * p) / 100, decimals);
    lock = true;
    input.value = val.toFixed(decimals);
    fire(input);
    lock = false;
    if (o.onChange) o.onChange({ percent: p, value: val, base: base, target: input });
  }
  function fromValue() {
    if (lock || o.sync === false) return;
    var base = baseValue();
    if (!base) return;
    var p = D.round((D.parseNumber(input.value) / base) * 100, decimals);
    lock = true;
    pct.value = input.value === "" ? "" : String(p);
    lock = false;
  }

  pct.addEventListener("input", fromPercent);
  pct.addEventListener("change", fromPercent);
  input.addEventListener("input", fromValue);
  input.addEventListener("change", fromValue);

  // recalc when base changes (if base is an input)
  var baseEl = typeof o.base === "string" ? (o.baseScope && input.closest(o.baseScope) ? input.closest(o.baseScope).querySelector(o.base) : $el(o.base)) : o.base && o.base.nodeType ? o.base : null;
  function onBase() {
    if (pct.value.trim() !== "") fromPercent();
  }
  if (baseEl && /^(INPUT|SELECT|TEXTAREA)$/.test(baseEl.tagName)) {
    baseEl.addEventListener("input", onBase);
    baseEl.addEventListener("change", onBase);
  }
  if (window.jQuery && baseEl) window.jQuery(baseEl).on("change.dcdn", onBase);

  if (input.value) fromValue();

  var ctrl = {
    percentInput: pct,
    target: input,
    recalc: fromPercent,
    getPercent: function () {
      return D.parseNumber(pct.value);
    },
    setPercent: function (p) {
      pct.value = p;
      fromPercent();
      return ctrl;
    },
    destroy: function () {
      pct.remove();
      input.style.width = origWidth;
      input.style.display = origDisplay;
      input.removeEventListener("input", fromValue);
      input.removeEventListener("change", fromValue);
      if (baseEl) {
        baseEl.removeEventListener("input", onBase);
        baseEl.removeEventListener("change", onBase);
      }
      delete input._dcdnPercent;
    },
  };
  input._dcdnPercent = ctrl;
  return ctrl;
}


/* ---- 07-table-words.js ---- */
/* ==========================================================================
 * 07-table-words.js — table helpers (serials, swap, export) + number to words
 * ======================================================================== */

D.table = {};

/** Add a serial column (addserials). */
D.table.addSerials = function (table, opts) {
  opts = opts || {};
  var t = $el(table || "#listing_table");
  if (!t || t.dataset.dcdnSerials) return;
  t.dataset.dcdnSerials = "1";
  var rows = t.rows;
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var isHead = row.parentNode.tagName === "THEAD" || (i === 0 && row.cells[0] && row.cells[0].tagName === "TH");
    var cell = document.createElement(isHead ? "th" : "td");
    cell.className = "dcdn-serial";
    cell.textContent = isHead ? txt(opts.header || { ar: "م", en: "#" }) : String(++n);
    row.insertBefore(cell, row.cells[0] || null);
  }
};

/** Swap two columns (content, id, class) – the standard swap(in1, in2, table_id). */
D.table.swapColumns = function (in1, in2, table) {
  var t = typeof table === "string" && !/^[#.\[]/.test(table) ? document.getElementById(table) : $el(table);
  if (!t) return;
  for (var i = 0, row; (row = t.rows[i]); i++) {
    var c1 = row.cells[in1];
    var c2 = row.cells[in2];
    if (!c1 || !c2) continue;
    var tmp = c1.innerHTML;
    c1.innerHTML = c2.innerHTML;
    c2.innerHTML = tmp;
    tmp = c1.id;
    c1.id = c2.id;
    c2.id = tmp;
    tmp = c1.className;
    c1.className = c2.className;
    c2.className = tmp;
  }
};
D.swap = D.table.swapColumns;

D.table.hideColumn = function (table, index) {
  var t = $el(table);
  if (!t) return;
  for (var i = 0, row; (row = t.rows[i]); i++) if (row.cells[index]) row.cells[index].style.display = "none";
};

/** Table -> array of row objects (header text as keys). */
D.table.toJSON = function (table) {
  var t = $el(table);
  if (!t || !t.rows.length) return [];
  var heads = Array.prototype.map.call(t.rows[0].cells, function (c, i) {
    return c.textContent.trim() || "col" + i;
  });
  var out = [];
  for (var i = 1; i < t.rows.length; i++) {
    var o = {};
    Array.prototype.forEach.call(t.rows[i].cells, function (c, j) {
      o[heads[j] || "col" + j] = c.textContent.trim();
    });
    out.push(o);
  }
  return out;
};

/** Export an HTML table to an .xls file Excel opens (exportTableToExcel). */
D.table.exportToExcel = function (table, filename) {
  var t = $el(table);
  if (!t) return;
  var rtl = D.isRTL();
  var html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions>" +
    (rtl ? "<x:DisplayRightToLeft/>" : "") +
    "</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>" +
    t.outerHTML +
    "</body></html>";
  var blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
  D.downloadBlob(blob, (filename || "export") + ".xls");
};
D.exportTableToExcel = D.table.exportToExcel;

/** Export array of objects (or table) to CSV. */
D.exportCSV = function (rows, filename) {
  if (rows && (rows.nodeType || typeof rows === "string")) rows = D.table.toJSON(rows);
  rows = rows || [];
  var heads = rows.length ? Object.keys(rows[0]) : [];
  var esc = function (v) {
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  var csv = [heads.map(esc).join(",")]
    .concat(
      rows.map(function (r) {
        return heads.map(function (k) {
          return esc(r[k]);
        }).join(",");
      })
    )
    .join("\n");
  D.downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), (filename || "export") + ".csv");
};

D.downloadBlob = function (blob, filename) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
};

/**
 * Re-format amounts inside elements (removeCurr):
 *   DCDN.formatCells(".removeCurr", { decimals: 2, suffix: " ر.س" })
 */
D.formatCells = function (selector, opts) {
  opts = opts || {};
  $all(selector).forEach(function (el) {
    var n = D.parseNumber(el.textContent);
    var s = D.formatNumber(n, opts.decimals == null ? 2 : opts.decimals);
    if (opts.suffixHtml) el.innerHTML = D.escapeHtml((opts.prefix || "") + s) + opts.suffixHtml;
    else el.textContent = (opts.prefix || "") + s + (opts.suffix || "");
  });
};

/* ------------------------------ number to words ------------------------- */

var AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
var AR_TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
var AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
var AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
// [singular, dual, plural (3-10), accusative singular (11-99)]
var AR_SCALES = [null, ["ألف", "ألفان", "آلاف", "ألفاً"], ["مليون", "مليونان", "ملايين", "مليوناً"], ["مليار", "ملياران", "مليارات", "ملياراً"], ["تريليون", "تريليونان", "تريليونات", "تريليوناً"]];

function arBelow100(n) {
  if (n < 10) return AR_ONES[n];
  if (n < 20) return AR_TEENS[n - 10];
  var o = n % 10;
  return (o ? AR_ONES[o] + " و" : "") + AR_TENS[Math.floor(n / 10)];
}
function arBelow1000(n) {
  var hnd = Math.floor(n / 100);
  var rest = n % 100;
  var parts = [];
  if (hnd) parts.push(AR_HUNDREDS[hnd]);
  if (rest) parts.push(arBelow100(rest));
  return parts.join(" و");
}
/** Counted noun form: [sing, dual, plural, acc] chosen by number. */
function arNoun(n, forms) {
  var r = n % 100;
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  if (r >= 3 && r <= 10) return forms[2];
  if (r >= 11 && r <= 99) return forms[3];
  return forms[0];
}
function arGroupWithScale(g, forms) {
  if (g === 1) return forms[0];
  if (g === 2) return forms[1];
  var r = g % 100;
  var hundreds = g >= 100 ? AR_HUNDREDS[Math.floor(g / 100)] : "";
  var tail;
  if (r === 0) tail = "";
  else if (r === 1) tail = forms[0];
  else if (r === 2) tail = forms[1];
  else tail = arBelow100(r);
  if (g < 100) return tail + " " + arNoun(g, forms);
  if (r === 0) return hundreds + " " + forms[0];
  if (r <= 2) return hundreds + " و" + tail;
  return hundreds + " و" + tail + " " + arNoun(r, forms);
}

D.numberToArabicWords = function (num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return "صفر";
  var groups = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }
  var parts = [];
  for (var i = groups.length - 1; i >= 0; i--) {
    var g = groups[i];
    if (!g) continue;
    parts.push(i === 0 ? arBelow1000(g) : arGroupWithScale(g, AR_SCALES[i]));
  }
  return parts.join(" و");
};

var EN_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
var EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
var EN_SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function enBelow1000(n) {
  var out = [];
  if (n >= 100) {
    out.push(EN_ONES[Math.floor(n / 100)] + " Hundred");
    n %= 100;
  }
  if (n >= 20) {
    out.push(EN_TENS[Math.floor(n / 10)] + (n % 10 ? "-" + EN_ONES[n % 10] : ""));
  } else if (n) out.push(EN_ONES[n]);
  return out.join(" ");
}
D.numberToEnglishWords = function (num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return "Zero";
  var parts = [];
  var i = 0;
  while (num > 0) {
    var g = num % 1000;
    if (g) parts.unshift(enBelow1000(g) + (EN_SCALES[i] ? " " + EN_SCALES[i] : ""));
    num = Math.floor(num / 1000);
    i++;
  }
  return parts.join(" ");
};

/* currency forms: ar [sing, dual, plural, acc], en [sing, plural], fraction units per main */
D.currencies = {
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

/**
 * Number -> words with currency (tafqeet / convertFN).
 *   DCDN.numberToWords(1250.5, { currency: "SAR" })           // page language
 *   DCDN.numberToWords(1250.5, { lang: "en", currency: "SAR" })
 *   -> "فقط ألف ومائتان وخمسون ريالاً و50 هللة لا غير" style output
 * opts: lang, currency (code | custom object), prefix/suffix (false to remove "فقط / لا غير")
 */
D.numberToWords = function (amount, opts) {
  opts = opts || {};
  var lang = opts.lang || D.detectLang();
  var cur = typeof opts.currency === "object" ? opts.currency : D.currencies[(opts.currency || "").toUpperCase()];
  var n = Math.abs(D.parseNumber(amount));
  var subUnits = cur ? cur.sub : 100;
  var digits = String(subUnits).length - 1;
  var main = Math.floor(n);
  var frac = Math.round((n - main) * subUnits);
  if (frac >= subUnits) {
    main += 1;
    frac = 0;
  }
  var out;
  if (lang === "en") {
    out = D.numberToEnglishWords(main);
    if (cur) out += " " + (main === 1 ? cur.en[0] : cur.en[1]);
    if (frac) out += " and " + D.numberToEnglishWords(frac) + (cur ? " " + (frac === 1 ? cur.enSub[0] : cur.enSub[1]) : "");
    var pre = opts.prefix === false ? "" : opts.prefix || "Only ";
    var suf = opts.suffix === false ? "" : opts.suffix || "";
    return (pre + out + suf).trim();
  }
  if (cur) {
    if (main === 1) out = cur.ar[0] + " واحد";
    else if (main === 2) out = cur.ar[1];
    else out = D.numberToArabicWords(main) + " " + arNoun(main, cur.ar);
  } else out = D.numberToArabicWords(main);
  if (frac) {
    var fw;
    if (!cur) fw = D.numberToArabicWords(frac) + " من " + Math.pow(10, digits);
    else if (frac === 1) fw = cur.arSub[0] + (cur.subFem ? " واحدة" : " واحد");
    else if (frac === 2) fw = cur.arSub[1];
    else fw = D.numberToArabicWords(frac) + " " + arNoun(frac, cur.arSub);
    out += " و" + fw;
  }
  var p = opts.prefix === false ? "" : opts.prefix || "فقط ";
  var s = opts.suffix === false ? "" : opts.suffix || " لا غير";
  return p + out + s;
};
D.tafqeet = D.numberToWords;


/* ---- 99-init.js ---- */
/* ==========================================================================
 * 99-init.js — auto init
 * ======================================================================== */

/* Read config from the <script> tag: <script src=".../daftra-cdn.min.js" data-debug="true" data-lang="en"> */
(function readScriptConfig() {
  var s = document && document.currentScript;
  if (!s || !s.dataset) return;
  var d = s.dataset;
  if (d.debug) D.config.debug = d.debug === "true";
  if (d.lang) D.config.lang = d.lang;
  if (d.primaryColor) D.config.primaryColor = d.primaryColor;
  if (d.siteInfo === "true") D.onReady(function () { D.getSiteInfo().catch(function () {}); });
  if (d.bodyClasses === "true") D.onReady(function () { D.applyBodyClasses().catch(function () {}); });
})();

D.onReady(autoResetSiteInfo);

/* Old-style globals some existing page codes call. Only defined if free. */
D.exposeGlobals = function () {
  var map = {
    toggleLoadingSpinner: D.toggleLoadingSpinner,
    getSiteInfo: D.getSiteInfo,
    addThousandSeparator: D.addThousandSeparator,
    exportTableToExcel: D.exportTableToExcel,
    swap: D.swap,
    showPopup: D.showPopup,
    closePopup: D.closePopup,
  };
  Object.keys(map).forEach(function (k) {
    if (typeof window[k] === "undefined") window[k] = map[k];
  });
};

log("loaded v" + VERSION);


  return D;
});
