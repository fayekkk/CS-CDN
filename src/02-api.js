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
   */
  return sendWithMethod((options && options.method) || "POST", url, body, options);
};

DCDN.put = function put(url, body, options) {
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
   */
  return sendWithMethod("PUT", url, body, options);
};

DCDN.patch = function patch(url, body, options) {
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
   */
  return sendWithMethod("PATCH", url, body, options);
};

DCDN.del = function del(url, options) {
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
   */
  var formData = new FormData();
  formData.append("file", file, filename || file.name || "file-" + Date.now());
  return DCDN.request("/v2/api/entity/upload_file/" + entity + "/" + fieldKey, { method: "POST", body: formData });
};

DCDN.entity = function entity(entityKey) {
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
