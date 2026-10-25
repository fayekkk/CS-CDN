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
