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
   */
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
