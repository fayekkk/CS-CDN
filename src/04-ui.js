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
   * @param {boolean} [force=false]   hide now, ignoring nested showLoader calls
   * @returns {void}
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
   * @param {boolean} show
   * @param {string|{ar:string,en:string}} [text]
   * @returns {HTMLElement|void}
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
  /**
   * Close the top popup, or the popup with this id.
   *
   * @param {string} [popupId]    none = the top popup
   * @returns {void}
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
   * @param {string|{ar:string,en:string}} message
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.title]
   * @param {string|{ar:string,en:string}} [options.okText]
   * @param {number} [options.width=420]
   * @returns {Promise<void>}
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
