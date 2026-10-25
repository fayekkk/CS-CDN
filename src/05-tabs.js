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
   */
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
   */
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
