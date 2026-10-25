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
   */
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
  /**
   * Run EVERY language pack created on the page again (after adding HTML: modals, AJAX…).
   *
   * @param {string|Element} [rootOrSelector=document.body]   container to translate
   * @returns {number}                                         how many packs ran
   *
   * Example:
   *   $("#modal").html(html);
   *   DCDN.translateLanguagePack("#modal");
   */
  languagePacks.forEach(function (pack) {
    pack.translate(rootOrSelector);
  });
  return languagePacks.length;
};
