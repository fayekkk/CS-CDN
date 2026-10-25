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
   * @param {number|string} appId
   * @param {string} name
   * @returns {string}
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
   * @param {number|string} appId
   * @param {string} name
   * @param {*} [defaultValue=null]       returned when missing / expired
   * @returns {*}
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
   * @param {number|string} appId
   * @param {string} name
   * @returns {boolean}
   *
   * Example:
   *   if (!DCDN.storage.has(82, "settings").data) loadSettings();
   */
  return DCDN.storage.get(appId, name) !== null;
};

DCDN.storage.remove = function remove(appId, name) {
  /**
   * Delete one value.
   *
   * @param {number|string} appId
   * @param {string} name
   * @returns {void}
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
   * @param {number|string} appId
   * @returns {void}
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
   * @param {Object} [options]
   * @param {boolean} [options.force=false]
   * @returns {Promise<{language_code:number, currency_code:string, country_code:string}>}   info.Site
   *
   * Example:
   *   const res = await DCDN.getSite();
   *   res.data.currency_code   // "SAR"
   *   res.data.country_code    // "SA"
   */
  return DCDN.getSiteInfo(options).then(function (info) {
    return (info && info.Site) || info || {};
  });
};

DCDN.getSiteInfoSync = function getSiteInfoSync() {
  /**
   * Cached site info WITHOUT a request (null if no app cached it yet).
   *
   * @returns {{Site:Object}|null}
   *
   * Example:
   *   const res = DCDN.getSiteInfoSync();
   *   if (res.data) res.data.Site.currency_code;
   */
  return readCachedSiteInfo();
};

DCDN.clearSiteInfo = function clearSiteInfo() {
  /**
   * Remove the cached site info (next getSiteInfo() fetches again).
   * Done automatically when the settings form is saved.
   *
   * @returns {void}
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
   * @returns {boolean}
   *
   * Example:
   *   $box.css("text-align", DCDN.isRTL().data ? "right" : "left");
   */
  return DCDN.detectLang() === "ar";
};

DCDN.isEn = function isEn() {
  /**
   * true on English pages.
   *
   * @returns {boolean}
   *
   * Example:
   *   const label = DCDN.isEn().data ? "Save" : "حفظ";
   */
  return DCDN.detectLang() === "en";
};

DCDN.t = function t(arabicText, englishText) {
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
   */
  if (englishText === undefined) return pickText(arabicText);
  return DCDN.detectLang() === "en" ? englishText : arabicText;
};

/**
 * Build a tolerant regex source for one word:
 *   - Arabic letter variants match each other: ا أ إ آ ٱ | ي ى ئ | ه ة | و ؤ
 *   - tashkeel (diacritics) and tatweel (ـ) between letters are ignored
 *   - any run of spaces / &nbsp; / new lines matches one space
 *   "الاعدادات" matches "الإعدادات", "الإعـدادات" and "الإِعدادات".
 */
var ARABIC_VARIANTS = { "ا": "اأإآٱ", "أ": "اأإآٱ", "إ": "اأإآٱ", "آ": "اأإآٱ", "ٱ": "اأإآٱ", "ي": "يىئ", "ى": "يىئ", "ه": "هة", "ة": "هة", "و": "وؤ" };
var ARABIC_MARKS = "[\\u064B-\\u065F\\u0670\\u0640]*";
function textToPattern(text) {
  var out = "";
  var chars = Array.from ? Array.from(text) : String(text).split("");
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (/[\u064B-\u065F\u0670\u0640]/.test(ch)) continue; // drop marks from the search word itself
    if (/\s/.test(ch)) {
      if (!/\[\\s\\u00A0\]\+$/.test(out)) out += "[\\s\\u00A0]+";
      continue;
    }
    if (ARABIC_VARIANTS[ch]) out += "[" + ARABIC_VARIANTS[ch] + "]";
    else out += escapeRegExp(ch);
    if (/[\u0600-\u06FF]/.test(ch)) out += ARABIC_MARKS;
  }
  return out;
}

var translatorWritten = typeof WeakMap === "function" ? new WeakMap() : null;
var activeTranslators = []; // translate() observers, so a new one on the same root can replace them

DCDN.translate = function translate(words, options) {
  /**
   * Replace words on the page from a list of { ar, en } pairs, and KEEP replacing (observer). Two modes:
   *   mode "translate" (default): detect the page language and put every matched word in it
   *       Arabic page  -> "settings" becomes "الاعدادات"   (Arabic words stay)
   *       English page -> "الإعدادات" becomes "settings"   (English words stay)
   *       Calling it twice is safe: the second call finds nothing left to change.
   *   mode "swap": ignore the language, every Arabic word becomes English and every English word Arabic.
   *       Calling it twice swaps everything back.
   * Covers text nodes (labels, buttons, menus, table cells, dropdown options), the attributes below,
   * and button values. A MutationObserver translates anything Daftra or your code adds later
   * (modals, AJAX lists, subform rows, dropdown panels). Form VALUES typed by users are never changed.
   * Every text on the page is checked; a text that CONTAINS a word gets that part replaced.
   * Arabic matching is tolerant: "الاعدادات" also matches "الإعدادات" / "الإعـدادات" / tashkeel, ى = ي, ة = ه,
   * and any spaces / &nbsp; / new lines between words match.
   *
   * @param {Array<{ar:string, en:string}|string[]>|{ar:string, en:string}} words
   *        [{ ar: "الإعدادات", en: "Settings" }, ...]  ([ar, en] arrays and one single object work too)
   * @param {Object} [options]
   * @param {string|Element} [options.root=document.body]   where to translate / watch
   * @param {boolean} [options.observe=true]                keep translating new / changed content
   * @param {boolean} [options.ignoreCase=true]             "settings", "Settings" and "SETTINGS" all match
   * @param {boolean} [options.wholeWords=false]            only whole words ("Test" never changes "Testing")
   * @param {boolean} [options.exact=false]                 only when a whole text equals the word
   * @param {string[]} [options.attributes]                 default placeholder, title, aria-label, data-original-title, data-float-label
   * @param {string} [options.skipSelector]                 never touched (default: script, style, noscript, textarea, code, pre, .dcdn-no-translate)
   * @param {"translate"|"swap"} [options.mode="translate"]  see above
   * @param {"ar"|"en"} [options.lang]                      mode "translate" only: force the target language (default page language)
   * @param {number} [options.debounce=80]                  ms to wait for DOM changes to settle before re-translating
   * @returns {{mode:string, replacements:number, words:number, lang:string, hint:(string|undefined), translate:function((string|Element)=):number, addWords:function(Array):number, stop:function():void}}
   *          replacements = how many texts changed in the first pass; translate() runs again; stop() ends the observer
   *
   * Examples:
   *   DCDN.translate([
   *     { ar: "الإعدادات", en: "Settings" },
   *     { ar: "العميل", en: "Client" },
   *     { ar: "حفظ", en: "Save" },
   *   ]);
   *
   *   // one form only, whole words, stop watching later
   *   const tr = DCDN.translate([{ ar: "الخدمات", en: "Services" }], { root: "#myForm", wholeWords: true }).data;
   *   tr.addWords([{ ar: "العمولة", en: "Commission" }]);
   *   tr.stop();
   *
   *   // swap both ways whatever the page language (call again to swap back)
   *   DCDN.translate([{ ar: "الاعدادات", en: "settings" }], { mode: "swap" });
   */
  options = options || {};
  words = unwrapEnvelope(words);
  if (words && !Array.isArray(words)) words = [words];
  var pageLang = DCDN.detectLang();
  // mode "translate" (default): put every matched word in the page language (or options.lang "ar" / "en").
  //      calling it again changes nothing, the text is already in that language.
  // mode "swap": ignore the language, Arabic word -> English and English word -> Arabic.
  //      calling it again swaps them back.
  var mode = options.mode || (options.lang === "swap" ? "swap" : "translate");
  if (mode !== "swap") mode = "translate";
  var lang = mode === "swap" ? "swap" : options.lang === "ar" || options.lang === "en" ? options.lang : pageLang;
  // what translators wrote last per node / attribute (shared by every call), so observers never
  // flip text that a translate() call just wrote (no ping-pong between two calls)
  var written = translatorWritten;
  function wroteThis(node, key, value) {
    var record = written && written.get(node);
    return !!record && record[key] === value;
  }
  function remember(node, key, value) {
    if (!written) return;
    var record = written.get(node) || {};
    record[key] = value;
    written.set(node, record);
  }
  var ignoreCase = options.ignoreCase !== false;
  var attributes = options.attributes || ["placeholder", "title", "aria-label", "data-original-title", "data-float-label"];
  var skipSelector = options.skipSelector || "script, style, noscript, textarea, code, pre, .dcdn-no-translate";
  var root = getElement(options.root) || document.body || document.documentElement;
  var rules = []; // { source: regex source, to: text, length }
  var combined = null; // one regex for all rules -> one pass, no ping-pong in "swap" mode

  function addRule(from, to) {
    from = from == null ? "" : String(from).trim();
    if (!from || to == null || from === String(to).trim()) return;
    rules.push({ source: textToPattern(from), to: String(to), length: from.length });
  }

  function addRules(list) {
    (list || []).forEach(function (word) {
      word = unwrapEnvelope(word);
      if (!word) return;
      var arabic = Array.isArray(word) ? word[0] : word.ar;
      var english = Array.isArray(word) ? word[1] : word.en;
      if (lang === "en" || lang === "swap") addRule(arabic, english); // Arabic text -> English
      if (lang === "ar" || lang === "swap") addRule(english, arabic); // English text -> Arabic
    });
    rules.sort(function (x, y) {
      return y.length - x.length; // longest first, so "Delivery Orders" wins over "Delivery"
    });
    var body = rules
      .map(function (rule) {
        return "(" + rule.source + ")";
      })
      .join("|");
    if (!body) {
      combined = null;
      return;
    }
    if (options.exact) body = "^([\\s\\u00A0]*)(?:" + body + ")([\\s\\u00A0]*)$";
    else if (options.wholeWords) body = "(^|[^\\w\\u0600-\\u06FF])(?:" + body + ")(?=$|[^\\w\\u0600-\\u06FF])";
    combined = new RegExp(body, ignoreCase ? "gi" : "g");
  }

  function translateString(text) {
    if (!combined || !text || !text.trim()) return text;
    var hasPrefix = !!(options.exact || options.wholeWords);
    combined.lastIndex = 0;
    return text.replace(combined, function () {
      var groups = Array.prototype.slice.call(arguments, 1, -2);
      var offset = hasPrefix ? 1 : 0;
      for (var i = 0; i < rules.length; i++) {
        if (groups[i + offset] !== undefined) {
          var before = hasPrefix ? groups[0] || "" : "";
          var after = options.exact ? groups[rules.length + 1] || "" : "";
          return before + rules[i].to + after;
        }
      }
      return arguments[0];
    });
  }

  function isSkipped(element) {
    return !element || (element.closest && !!element.closest(skipSelector));
  }

  function translateTree(node, fromObserver) {
    if (!node) return 0;
    var changed = 0;
    if (node.nodeType === 3) node = node.parentNode; // a changed text node: re-check its element
    if (!node || isSkipped(node.nodeType === 1 ? node : node.parentElement)) return 0;

    // 1) text nodes (labels, buttons, menus, cells, <option> text...)
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function (textNode) {
        if (!textNode.nodeValue || !textNode.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return isSkipped(textNode.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    var textNodes = [];
    var current;
    while ((current = walker.nextNode())) textNodes.push(current);
    textNodes.forEach(function (textNode) {
      if (fromObserver && wroteThis(textNode, "text", textNode.nodeValue)) return;
      var translated = translateString(textNode.nodeValue);
      if (translated !== textNode.nodeValue) {
        textNode.nodeValue = translated;
        remember(textNode, "text", translated);
        changed++;
      }
    });

    // 2) attributes + button values (never the values users type)
    var elements = node.nodeType === 1 ? [node].concat(Array.prototype.slice.call(node.querySelectorAll("*"))) : [];
    elements.forEach(function (element) {
      if (isSkipped(element)) return;
      attributes.forEach(function (attributeName) {
        var value = element.getAttribute(attributeName);
        if (!value) return;
        if (fromObserver && wroteThis(element, attributeName, value)) return;
        var translated = translateString(value);
        if (translated !== value) {
          element.setAttribute(attributeName, translated);
          remember(element, attributeName, translated);
          changed++;
        }
      });
      if (element.tagName === "INPUT" && /^(button|submit|reset)$/i.test(element.type) && element.value) {
        if (fromObserver && wroteThis(element, "value", element.value)) return;
        var buttonText = translateString(element.value);
        if (buttonText !== element.value) {
          element.value = buttonText;
          remember(element, "value", buttonText);
          changed++;
        }
      }
    });
    return changed;
  }

  addRules(words);

  var observer = null;
  var controller = {
    mode: mode,
    lang: lang,
    replacements: 0,

    translate: function (rootOrSelector) {
      var target = rootOrSelector ? getElement(unwrapEnvelope(rootOrSelector)) : root;
      var count = translateTree(target);
      if (observer) observer.takeRecords(); // ignore the mutations we just made ourselves
      return count;
    },

    addWords: function (list) {
      list = unwrapEnvelope(list);
      addRules(Array.isArray(list) ? list : [list]);
      return controller.translate();
    },

    stop: function () {
      if (observer) observer.disconnect();
      observer = null;
      activeTranslators = activeTranslators.filter(function (item) {
        return item !== controller;
      });
    },
  };

  controller.replacements = controller.translate();
  controller.words = rules.length;
  if (!controller.replacements) {
    controller.hint =
      lang === "swap"
        ? "nothing matched yet; the observer keeps watching"
        : "mode \"translate\" to \"" + lang + "\": only " + (lang === "ar" ? "English" : "Arabic") +
          " texts are replaced (the rest is already in that language). Nothing matched yet; the observer keeps watching. Use { mode: \"swap\" } to swap both ways.";
  }

  if (options.observe !== false && window.MutationObserver && root) {
    // a new translator on the same root in the OTHER direction replaces the old one (no ping-pong)
    activeTranslators
      .filter(function (item) {
        return item._root === root && item.lang !== lang;
      })
      .forEach(function (item) {
        item.stop();
      });

    var pendingNodes = [];
    var flush = DCDN.debounce(function () {
      var nodes = pendingNodes;
      pendingNodes = [];
      nodes.forEach(function (changedNode) {
        if (changedNode.isConnected === false) return;
        translateTree(changedNode, true);
      });
      if (observer) observer.takeRecords();
    }, options.debounce == null ? 80 : options.debounce);

    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          Array.prototype.forEach.call(mutation.addedNodes, function (added) {
            if (added.nodeType === 1 || added.nodeType === 3) pendingNodes.push(added);
          });
        } else {
          pendingNodes.push(mutation.target); // characterData / attributes
        }
      });
      if (pendingNodes.length) flush();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
    controller._root = root;
    activeTranslators.push(controller);
  }
  return controller;
};

DCDN.translateText = function translateText(text, words, lang) {
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
   * @returns {Promise<Object>}   info.Site
   *
   * Example:
   *   DCDN.applyBodyClasses().then(res => res.data.currency_code);
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
