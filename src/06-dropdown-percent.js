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
  if (typeof source === "function") return DCDN.parseNumber(unwrapEnvelope(source(targetInput)));
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
