/* Smoke tests in jsdom:  npm test */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const assert = require("assert");

const FILE = process.argv[2] || process.env.DCDN_FILE || "daftra-cdn.js";
const code = fs.readFileSync(path.join(__dirname, "../dist/" + FILE), "utf8");

function makeDom(html, url) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: url || "https://test.daftra.com/owner/invoices/view/123",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const calls = [];
  w.__routes = {};
  w.fetch = async (url, opts) => {
    calls.push({ url, opts });
    const u = new URL(url, w.location.origin);
    const key = Object.keys(w.__routes).find((k) => u.pathname + u.search === k || u.pathname === k);
    let body = key ? w.__routes[key] : { result: "successful", data: [] };
    if (typeof body === "function") body = body(u, opts);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    };
  };
  w.__calls = calls;
  w.scrollTo = () => {};
  w.eval(code);
  return w;
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ✔", name);
  } catch (e) {
    console.error("  ✘", name, "\n", e);
    process.exitCode = 1;
  }
}

(async () => {
  console.log("Daftra CDN tests — dist/" + FILE);

  await test("loads once & exposes DCDN", () => {
    const w = makeDom("");
    assert.ok(w.DCDN && w.DaftraCDN === w.DCDN);
    const v = w.DCDN;
    w.eval(code); // same version: second load ignored
    assert.strictEqual(w.DCDN, v);
    w.DCDN.version = "1.0.1"; // pretend an OLD copy was loaded first
    w.console.info = () => {};
    w.eval(code); // newer file must replace it
    assert.notStrictEqual(w.DCDN, v);
    assert.notStrictEqual(w.DCDN.version, "1.0.1");
  });

  await test("buildQuery nested filters", () => {
    const w = makeDom("");
    const q = w.DCDN.raw.buildQuery({ filter: { name: { like: "a b" }, branch_id: { in: [1, 2] }, x: { is_null: null } }, per_page: 10 });
    assert.strictEqual(q, "filter[name][like]=a%20b&filter[branch_id][in][]=1&filter[branch_id][in][]=2&filter[x][is_null]&per_page=10");
  });

  await test("fetch adds filters/perPage (v2 per_page, api2 limit)", async () => {
    const w = makeDom("");
    await w.DCDN.raw.fetch("/v2/api/entity/invoice/list/1", { filters: { client_id: 5 }, perPage: 50 });
    await w.DCDN.raw.fetch("/api2/invoices", { perPage: 50, page: 2 });
    assert.ok(w.__calls[0].url.endsWith("/v2/api/entity/invoice/list/1?filter[client_id]=5&per_page=50"));
    assert.ok(w.__calls[1].url.endsWith("/api2/invoices?page=2&limit=50"));
  });

  await test("fetch returns results directly (rows + meta, record, unwrap, full)", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/client/list/1"] = { data: [{ id: 1 }, { id: 2 }], total: 40, last_page: 20, current_page: 1 };
    w.__routes["/v2/api/entity/invoice/5/1"] = { id: 5, no: "INV-5" };
    w.__routes["/api2/clients"] = { data: [{ Client: { id: 9 } }], pagination: { page_count: 1, total_results: 1 } };
    w.__routes["/api2/invoices/3"] = { data: { Invoice: { id: 3 }, InvoiceItem: [] } };
    const rows = await w.DCDN.raw.fetch("/v2/api/entity/client/list/1");
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows.meta.total, 40);
    assert.strictEqual(rows.meta.pages, 20);
    assert.strictEqual(Object.keys(rows).join(), "0,1", "meta is not enumerable");
    const inv = await w.DCDN.raw.fetch("/v2/api/entity/invoice/5/1");
    assert.strictEqual(inv.no, "INV-5");
    const clients = await w.DCDN.raw.fetch("/api2/clients");
    assert.strictEqual(clients[0].id, 9, "auto unwrap single model key");
    const one = await w.DCDN.raw.fetch("/api2/invoices/3", { unwrap: "Invoice" });
    assert.strictEqual(one.id, 3);
    const raw = await w.DCDN.raw.fetch("/api2/clients", { full: true });
    assert.strictEqual(raw.pagination.total_results, 1);
    assert.strictEqual(w.__calls[0].opts.headers["X-Requested-With"], "XMLHttpRequest");
  });

  await test("fetch all:true, callbacks, silent, loader, error toast", async () => {
    const w = makeDom("");
    w.DCDN.raw.configure({ retryDelay: 1, retries: 0 });
    w.__routes["/v2/api/entity/p/list/1"] = (u) => ({ data: [{ id: +u.searchParams.get("page") }], last_page: 3, total: 3 });
    const all = await w.DCDN.raw.fetch("/v2/api/entity/p/list/1", { all: true });
    assert.strictEqual(all.map((r) => r.id).join(), "1,2,3");
    assert.strictEqual(all.meta.total, 3);

    let got = null, completed = false;
    await w.DCDN.raw.fetch("/v2/api/entity/p/list/1", { onSuccess: (r) => (got = r), onComplete: () => (completed = true), loader: true });
    assert.strictEqual(got.length, 1);
    assert.ok(completed);
    assert.strictEqual(w.document.getElementById("dcdn-loader").style.display, "none", "loader hidden after");

    w.__routes["/api2/bad"] = { result: "failed", message: "nope" };
    const fallback = await w.DCDN.raw.fetch("/api2/bad", { silent: true, fallback: [] });
    assert.strictEqual(fallback.length, 0);
    let errMsg = null;
    const r = await w.DCDN.raw.fetch("/api2/bad", { onError: (e) => (errMsg = e.message), errorMessage: true });
    assert.strictEqual(r, null);
    assert.strictEqual(errMsg, "nope");
    assert.ok(w.document.querySelector(".dcdn-toast.error"));
    await assert.rejects(w.DCDN.raw.fetch("/api2/bad"), /nope/);
  });

  await test("post returns created record + success toast", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/le_y"] = { data: { id: 77 } };
    const rec = await w.DCDN.raw.post("/v2/api/entity/le_y", { a: 1 }, { successMessage: "تم" });
    assert.strictEqual(rec.id, 77);
    assert.ok(w.document.querySelector(".dcdn-toast.success"));
  });

  await test("bulkFetch v2 (last_page) merges all pages", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/product/list/1"] = (u) => {
      const p = +u.searchParams.get("page");
      return { data: [{ id: p * 10 + 1 }, { id: p * 10 + 2 }], last_page: 3 };
    };
    const rows = await w.DCDN.raw.bulkFetch("/v2/api/entity/product/list/1", { perPage: 2 });
    assert.strictEqual(rows.map((r) => r.id).join(), "11,12,21,22,31,32");
  });

  await test("bulkFetch api2 (pagination.page_count) + unwrap", async () => {
    const w = makeDom("");
    w.__routes["/api2/invoices"] = (u) => {
      const p = +u.searchParams.get("page");
      return { data: [{ Invoice: { id: p } }], pagination: { page_count: 2, total_results: 2 } };
    };
    const rows = await w.DCDN.raw.bulkFetch("/api2/invoices", { unwrap: "Invoice" });
    assert.strictEqual(JSON.stringify(rows), '[{"id":1},{"id":2}]');
  });

  await test("bulkFetch ids template", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/invoice/7/1"] = { id: 7 };
    w.__routes["/v2/api/entity/invoice/8/1"] = { id: 8 };
    const r = await w.DCDN.raw.bulkFetch("/v2/api/entity/invoice/{id}/1", { ids: [7, 8] });
    assert.strictEqual(r.map((x) => x.id).join(), "7,8");
  });

  await test("post + bulkPost", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/le_x"] = (u, o) => ({ id: JSON.parse(o.body).n });
    const one = await w.DCDN.raw.post("/v2/api/entity/le_x", { n: 1 });
    assert.strictEqual(one.id, 1);
    const res = await w.DCDN.raw.bulkPost("/v2/api/entity/le_x", [{ n: 1 }, { n: 2 }, { n: 3 }], { progress: true });
    assert.strictEqual(res.success.length, 3);
    assert.strictEqual(w.__calls[1].opts.method, "POST");
    assert.strictEqual(w.__calls[1].opts.headers["Content-Type"], "application/json");
  });

  await test("request retries then throws on failed result", async () => {
    const w = makeDom("");
    w.DCDN.raw.configure({ retryDelay: 1 });
    w.__routes["/api2/bad"] = { result: "failed", message: "nope" };
    await assert.rejects(w.DCDN.raw.fetch("/api2/bad"), /nope/);
  });

  await test("getSiteInfo uses cache, never overwrites", async () => {
    const w = makeDom("");
    w.__routes["/api2/site_info"] = { data: { Site: { language_code: 41, currency_code: "SAR" } } };
    const a = await w.DCDN.raw.getSiteInfo();
    assert.strictEqual(a.Site.currency_code, "SAR");
    assert.strictEqual(w.__calls.length, 1);
    await w.DCDN.raw.getSiteInfo();
    assert.strictEqual(w.__calls.length, 1, "second call must use localStorage");
    w.localStorage.setItem("site_info", JSON.stringify({ Site: { currency_code: "EGP" } }));
    const b = await w.DCDN.raw.getSite();
    assert.strictEqual(b.currency_code, "EGP");
  });

  await test("detectLang + translate both directions", () => {
    const w = makeDom('<div id="r"><label>العميل</label><input placeholder="الخدمات"><span>Save</span></div>');
    w.document.body.classList.add("en_app");
    assert.strictEqual(w.DCDN.raw.detectLang(), "en");
    const n = w.DCDN.raw.translate([["العميل", "Client"], { ar: "الخدمات", en: "Services" }], { root: "#r", mode: "translate" });
    assert.ok(n.replacements >= 2);
    assert.strictEqual(w.document.querySelector("label").textContent, "Client");
    assert.strictEqual(w.document.querySelector("input").placeholder, "Services");
    w.document.body.classList.remove("en_app");
    w.document.documentElement.setAttribute("dir", "rtl");
    assert.strictEqual(w.DCDN.raw.detectLang(), "ar");
    w.DCDN.raw.translate([["حفظ", "Save"]], { root: "#r", mode: "translate" });
    assert.strictEqual(w.document.querySelector("span").textContent, "حفظ");
    assert.strictEqual(w.DCDN.raw.t("نعم", "Yes"), "نعم");
    n.stop();
  });

  await test("translate {ar,en} objects + ignoreCase + observer", async () => {
    const w = makeDom('<div id="o"><h3>Settings</h3><button>save</button><span>My Settings page</span></div>');
    w.document.documentElement.setAttribute("dir", "rtl");
    const c = w.DCDN.raw.translate([{ ar: "الاعدادات", en: "settings" }, { ar: "حفظ", en: "Save" }], { root: "#o", debounce: 10 });
    assert.strictEqual(w.document.querySelector("h3").textContent, "الاعدادات");
    assert.strictEqual(w.document.querySelector("button").textContent, "حفظ");
    assert.strictEqual(w.document.querySelector("span").textContent, "My الاعدادات page");
    const div = w.document.createElement("div");
    div.innerHTML = '<a title="Settings">Settings</a>';
    w.document.getElementById("o").appendChild(div);
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(div.querySelector("a").textContent, "الاعدادات", "observer translated new DOM");
    assert.strictEqual(div.querySelector("a").title, "الاعدادات");
    w.document.querySelector("h3").textContent = "Settings";
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(w.document.querySelector("h3").textContent, "الاعدادات", "observer translated changed text");
    c.stop();
    w.document.querySelector("h3").textContent = "Settings";
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(w.document.querySelector("h3").textContent, "Settings", "stopped");
    const pub = w.DCDN.translate([{ ar: "نعم", en: "Yes" }], { root: "#o", observe: false });
    assert.ok(pub.success && typeof pub.data.stop === "function");
  });

  await test("translate: Arabic variants, spaces, swap, hint", () => {
    const w = makeDom('<div id="v"><a>الإعدادات</a><b>العميل&nbsp; الجديد</b><i>Settings</i><u>Save</u></div>');
    w.document.body.classList.add("en_app");
    const c = w.DCDN.raw.translate([{ ar: "الاعدادات", en: "settings" }, { ar: "العميل الجديد", en: "New Client" }], { root: "#v", observe: false, mode: "translate" });
    assert.strictEqual(w.document.querySelector("a").textContent, "settings");
    assert.strictEqual(w.document.querySelector("b").textContent, "New Client");
    const w2 = makeDom('<div id="v"><a>الإعدادات</a><i>Settings</i><u>Save now</u></div>');
    w2.document.documentElement.setAttribute("dir", "rtl");
    w2.DCDN.raw.translate([{ ar: "الاعدادات", en: "settings" }, { ar: "حفظ", en: "Save" }], { root: "#v", observe: false, mode: "swap" });
    assert.strictEqual(w2.document.querySelector("a").textContent, "settings");
    assert.strictEqual(w2.document.querySelector("i").textContent, "الاعدادات");
    assert.strictEqual(w2.document.querySelector("u").textContent, "حفظ now");
    const none = w2.DCDN.raw.translate([{ ar: "لا يوجد", en: "Nothing here" }], { root: "#v", observe: false, mode: "translate" });
    assert.strictEqual(none.replacements, 0);
    assert.ok(/both ways/.test(none.hint));
    assert.ok(c.words === 2);
  });

  await test("translate default = both ways, observer never flips its own output", async () => {
    const w = makeDom('<div id="d" title="x"><a>الإعدادات</a><i>Save</i></div>');
    w.document.documentElement.setAttribute("dir", "rtl");
    const c = w.DCDN.raw.translate([{ ar: "الاعدادات", en: "settings" }, { ar: "حفظ", en: "Save" }], { root: "#d", debounce: 10, mode: "swap" });
    assert.strictEqual(c.lang, "swap");
    assert.strictEqual(w.document.querySelector("a").textContent, "settings");
    assert.strictEqual(w.document.querySelector("i").textContent, "حفظ");
    w.document.getElementById("d").setAttribute("title", "y"); // re-scan of the whole div
    w.document.getElementById("d").appendChild(w.document.createElement("span")).textContent = "العميل";
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(w.document.querySelector("a").textContent, "settings", "not flipped back");
    assert.strictEqual(w.document.querySelector("i").textContent, "حفظ", "not flipped back");
    c.stop();
  });

  await test("translate mode vs swap mode called twice", async () => {
    const W = [{ ar: "الاعدادات", en: "settings" }, { ar: "حفظ", en: "Save" }];
    const w = makeDom('<div id="m"><a>الإعدادات</a><i>Save</i></div>');
    w.document.documentElement.setAttribute("dir", "rtl");
    const a = w.DCDN.raw.translate(W, { root: "#m", debounce: 10 });
    assert.strictEqual(a.mode, "translate");
    const b = w.DCDN.raw.translate(W, { root: "#m", debounce: 10 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(w.document.querySelector("a").textContent, "الإعدادات", "Arabic stays on Arabic page");
    assert.strictEqual(w.document.querySelector("i").textContent, "حفظ");
    assert.strictEqual(b.replacements, 0, "second translate call changes nothing");
    a.stop(); b.stop();
    const s1 = w.DCDN.raw.translate(W, { root: "#m", mode: "swap", debounce: 10 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(w.document.querySelector("a").textContent, "settings");
    assert.strictEqual(w.document.querySelector("i").textContent, "Save");
    const s2 = w.DCDN.raw.translate(W, { root: "#m", mode: "swap", debounce: 10 });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(w.document.querySelector("a").textContent, "الاعدادات", "second swap swaps back, no ping-pong");
    assert.strictEqual(w.document.querySelector("i").textContent, "حفظ");
    w.document.getElementById("m").appendChild(w.document.createElement("b")).textContent = "Save";
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(w.document.querySelector("b").textContent, "حفظ", "new node swapped once");
    assert.strictEqual(w.document.querySelector("a").textContent, "الاعدادات");
    s1.stop(); s2.stop();
  });

  await test("storage app scoped + ttl", () => {
    const w = makeDom("");
    w.DCDN.raw.setLocalStorage(397, "workflow", "12");
    assert.strictEqual(w.localStorage.getItem("app_397_workflow"), "12");
    w.DCDN.raw.storage.set(397, "obj", { a: 1 });
    assert.strictEqual(JSON.stringify(w.DCDN.raw.storage.get(397, "obj")), '{"a":1}');
    w.DCDN.raw.storage.set(397, "tmp", 5, { ttl: -1 });
    assert.strictEqual(w.DCDN.raw.storage.get(397, "tmp", "def"), "def");
    w.DCDN.raw.storage.clear(397);
    assert.strictEqual(w.localStorage.getItem("app_397_workflow"), null);
  });

  await test("loader counter, toast, progress, popup, confirm", async () => {
    const w = makeDom("");
    w.DCDN.raw.showLoader("x");
    w.DCDN.raw.showLoader();
    w.DCDN.raw.hideLoader();
    assert.strictEqual(w.document.getElementById("dcdn-loader").style.display, "flex");
    w.DCDN.raw.hideLoader();
    assert.strictEqual(w.document.getElementById("dcdn-loader").style.display, "none");
    const t = w.DCDN.raw.toast("ok", "error", { timeout: 0 });
    assert.ok(w.document.querySelector(".dcdn-toast.error"));
    t.close();
    const bar = w.DCDN.raw.progressBar({ total: 4 });
    bar.update(1);
    assert.strictEqual(bar.el.querySelector(".dcdn-progress-pct").textContent, "25%");
    const p = w.DCDN.raw.showPopup("<b id='in'>hi</b>", { title: "T", buttons: [{ text: "OK", class: "primary" }] });
    assert.ok(w.document.getElementById("in"));
    p.close();
    assert.ok(!w.document.getElementById("in"));
    const c = w.DCDN.raw.confirm("sure?");
    w.document.querySelector(".dcdn-btn.primary").click();
    assert.strictEqual(await c, true);
  });

  await test("appendtab_invoice (classic layout)", async () => {
    const w = makeDom(`<ul class="nav nav-tabs responsive"><li class="active"><a href="#details" data-toggle="tab">Details</a></li></ul>
      <div class="tab-content"><div class="tab-pane active" id="details">d</div></div>`);
    const tab = await w.DCDN.raw.appendtab_invoice({ id: "log", title: { ar: "سجل", en: "Log" }, content: "<p id='c'>content</p>" });
    assert.ok(w.document.querySelector('ul.nav-tabs a[href="#log"]'));
    assert.ok(!w.document.getElementById("c"), "lazy by default");
    tab.link.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(w.document.getElementById("c"));
    assert.ok(w.document.getElementById("log").classList.contains("active"));
    assert.ok(!w.document.getElementById("details").classList.contains("active"));
    const again = await w.DCDN.raw.appendtab_invoice({ id: "log" });
    assert.strictEqual(again, tab, "no duplicates");
  });

  await test("appendtab_entity (v2 layout) + url loader", async () => {
    const w = makeDom(`<ul id="item-nav-tabs-responsive"><li class="nav-item"><a class="nav-link active" href="#details">D</a></li></ul>
      <div id="item-nav-tabs-content-responsive"><div class="tab-pane active show" id="details"></div></div>`, "https://t.daftra.com/v2/owner/entity/le_x/5/show");
    w.fetch = async () => ({ text: async () => "<html><body><table class='list-table'><tr><td>row</td></tr></table></body></html>" });
    const tab = await w.DCDN.raw.appendtab_entity({ id: "items", title: "Items", url: "/v2/owner/entity/le_y/list", active: true });
    assert.ok(tab.link.classList.contains("nav-link"));
    assert.ok(w.document.querySelector("#items table.list-table"));
    assert.strictEqual(w.DCDN.raw.getRecordId(), 5);
  });

  await test("registerTabPage creates new appendtab_ alias", () => {
    const w = makeDom("");
    w.DCDN.raw.registerTabPage("my_page");
    assert.strictEqual(typeof w.DCDN.raw.appendtab_my_page, "function");
  });

  await test("addDropdown on single line field (saveAs text)", async () => {
    const w = makeDom('<input id="data-x--single_line_field" class="form-control" value="B">');
    let picked;
    const c = await w.DCDN.raw.addDropdown('[id$="--single_line_field"]', { options: ["A", "B", { value: 3, text: "Three" }], saveAs: "text", onSelect: (o) => (picked = o) });
    assert.strictEqual(c.select.value, "B", "preselects existing value");
    c.setValue("3");
    assert.strictEqual(w.document.getElementById("data-x--single_line_field").value, "Three");
    assert.strictEqual(picked.value, "3");
  });

  await test("addDropdown on dynamic dropdown select appends & selects option", async () => {
    const w = makeDom('<select id="dd"><option value="">-</option></select>');
    w.__routes["/v2/api/entity/le_cities/list/1"] = { data: [{ id: 9, city: "Riyadh" }], last_page: 1 };
    const c = await w.DCDN.raw.addDropdown("#dd", { source: { url: "/v2/api/entity/le_cities/list/1", textKey: "city" } });
    c.setValue("9");
    const orig = w.document.getElementById("dd");
    assert.strictEqual(orig.value, "9");
    assert.strictEqual(orig.options[orig.selectedIndex].text, "Riyadh");
  });

  await test("addDropdown with selectize instance", async () => {
    const w = makeDom('<select id="sz"></select><div class="selectize-control"></div>');
    const el = w.document.getElementById("sz");
    const s = { options: {}, value: "", $wrapper: [w.document.querySelector(".selectize-control")],
      addOption(o) { this.options[o.value] = o; }, refreshOptions() {}, setValue(v) { this.value = v; }, getValue() { return this.value; } };
    el.selectize = s;
    const c = await w.DCDN.raw.addDropdown(el, { options: [{ value: "x", text: "X" }] });
    c.setValue("x");
    assert.strictEqual(s.value, "x");
    assert.ok(s.options.x);
    assert.strictEqual(w.document.querySelector(".selectize-control").style.display, "none");
  });

  await test("calculatePercent", () => {
    const w = makeDom('<span id="total">1,000.00 ر.س</span><input id="disc" value="">');
    const c = w.DCDN.raw.calculatePercent("#disc", { base: "#total" });
    assert.ok(c.percentInput.nextElementSibling.id === "disc", "percent input inserted before target");
    c.setPercent(15);
    assert.strictEqual(w.document.getElementById("disc").value, "150.00");
    const inp = w.document.getElementById("disc");
    inp.value = "250";
    inp.dispatchEvent(new w.Event("input", { bubbles: true }));
    assert.strictEqual(c.percentInput.value, "25");
  });

  await test("calculatePercent with baseScope rows", () => {
    const w = makeDom('<table><tr><td><input class="b" value="200"></td><td><input class="v"></td></tr><tr><td><input class="b" value="50"></td><td><input class="v"></td></tr></table>');
    const cs = w.DCDN.raw.calculatePercent(".v", { base: ".b", baseScope: "tr" });
    cs[0].setPercent(10);
    cs[1].setPercent(10);
    const v = w.document.querySelectorAll(".v");
    assert.strictEqual(v[0].value, "20.00");
    assert.strictEqual(v[1].value, "5.00");
  });

  await test("numberToWords ar / en", () => {
    const w = makeDom("");
    assert.strictEqual(w.DCDN.raw.numberToWords(1250.5, { lang: "ar", currency: "SAR" }), "فقط ألف ومائتان وخمسون ريالاً وخمسون هللة لا غير");
    assert.strictEqual(w.DCDN.raw.numberToWords(3000, { lang: "ar", currency: "EGP" }), "فقط ثلاثة آلاف جنيه لا غير");
    assert.strictEqual(w.DCDN.raw.numberToArabicWords(21), "واحد وعشرون");
    assert.strictEqual(w.DCDN.raw.numberToArabicWords(2000000), "مليونان");
    assert.strictEqual(w.DCDN.raw.numberToWords(1250.5, { lang: "en", currency: "SAR" }), "Only One Thousand Two Hundred Fifty Riyals and Fifty Halalas");
  });

  await test("table swap + serials + format", () => {
    const w = makeDom('<table id="listing_table"><tr><th>a</th><th>b</th></tr><tr><td id="i1">1</td><td>2</td></tr></table><span class="m">1234.5</span>');
    w.DCDN.raw.swap(0, 1, "listing_table");
    assert.strictEqual(w.document.querySelector("tr:nth-child(2) td").textContent, "2");
    w.DCDN.raw.table.addSerials("#listing_table", { header: "#" });
    assert.strictEqual(w.document.querySelector("tr:nth-child(2) td").textContent, "1");
    w.DCDN.raw.formatCells(".m", { decimals: 2 });
    assert.strictEqual(w.document.querySelector(".m").textContent, "1,234.50");
    assert.strictEqual(w.DCDN.raw.parseNumber("١٬٢٣٤٫٥ ر.س"), 1234.5);
  });

  await test("field helpers + menu item", () => {
    const w = makeDom('<input id="data-le_x--qty" value="3"><ul><li class="mn_inventory"><ul><li><a href="/a">A</a></li></ul></li></ul>');
    assert.strictEqual(w.DCDN.raw.getFieldValue("qty"), "3");
    w.DCDN.raw.setFieldValue("qty", 9);
    assert.strictEqual(w.DCDN.raw.field("qty").value, "9");
    w.DCDN.raw.addMenuItem({ parent: ".mn_inventory", url: "/b", title: "B", after: 0 });
    assert.ok(w.document.querySelector('a[href="/b"]'));
  });

  await test("help() reads docs from inside the function (readable build)", () => {
    const w = makeDom("");
    if (FILE.includes(".min.")) return; // comments are stripped in the min file
    const src = w.DCDN.addDropdown.toString();
    assert.ok(src.includes("Single-line text field"));
    let printed = "";
    w.console.log = (...a) => (printed += a.join(" ") + "\n");
    const docs = w.DCDN.raw.help("addDropdown");
    assert.ok(docs.docs.join("\n").includes("saveAs"));
    assert.ok(JSON.parse(printed).function === "DCDN.addDropdown", "printed JSON");
    printed = "";
    const list = w.DCDN.raw.help();
    assert.ok(list.functions.length > 60 && list.functions.some((r) => r.function === "DCDN.addDropdown" && r.description));
    JSON.parse(printed); // help() prints valid JSON
  });

  await test("debug logs are JSON lines (no styles, no DOM)", async () => {
    const w = makeDom('<input id="x" class="a b">');
    const lines = [];
    w.console.log = (...a) => lines.push(a);
    w.console.warn = (...a) => lines.push(a);
    w.DCDN.raw.configure({ debug: true });
    await w.DCDN.raw.fetch("/api2/site_info");
    w.DCDN.raw.calculatePercent("#missing", { base: 1 });
    lines.forEach((args) => {
      assert.strictEqual(args.length, 1, "single string argument");
      assert.ok(!String(args[0]).includes("%c"));
      JSON.parse(String(args[0]).replace(/^\[DCDN\] /, ""));
    });
    assert.ok(lines.length >= 2);
    assert.strictEqual(w.DCDN.raw._internal.toPlainValue(w.document.getElementById("x")), "<input#x.a.b>");
  });

  await test("PUBLIC: sync functions return { success, data }", () => {
    const w = makeDom('<input id="data-le_x--qty" value="3" class="form-control">');
    assert.strictEqual(JSON.stringify(w.DCDN.parseNumber("1,250.5")), '{"success":true,"data":1250.5}');
    assert.strictEqual(JSON.stringify(w.DCDN.isRTL()), '{"success":true,"data":true}');
    assert.strictEqual(JSON.stringify(w.DCDN.storage.set(1, "a", { q: 1 })), '{"success":true,"data":true}');
    assert.strictEqual(JSON.stringify(w.DCDN.storage.get(1, "a")), '{"success":true,"data":{"q":1}}');
    const field = w.DCDN.field("qty");
    assert.strictEqual(JSON.stringify(field), '{"success":true,"data":"<input#data-le_x--qty.form-control>"}');
    assert.strictEqual(field.element.value, "3", "real element is still reachable");
    assert.strictEqual(JSON.stringify(w.DCDN.injectCSS("a{}", "t1").success), "true");
    assert.strictEqual(JSON.stringify(w.DCDN.toast.success("ok")), '{"success":true,"data":{}}');
    assert.strictEqual(w.DCDN.raw.parseNumber("5"), 5, "raw keeps plain values");
  });

  await test("PUBLIC: sync error -> { success:false, error }", () => {
    const w = makeDom("");
    const res = w.DCDN.calculatePercent(); // no target
    assert.strictEqual(res.success, true); // returns null data (warns), not an exception
    const bad = w.DCDN.storage.get; // still callable after extraction
    assert.strictEqual(bad(9, "none").success, true);
    const thrown = w.DCDN.getPageInfo("http://[bad");
    assert.strictEqual(thrown.success, false);
    assert.ok(thrown.error.message);
  });

  await test("PUBLIC: async -> { success, data, meta } and never rejects", async () => {
    const w = makeDom("");
    w.DCDN.raw.configure({ retries: 0, retryDelay: 1 });
    w.__routes["/v2/api/entity/client/list/1"] = { data: [{ id: 1 }, { id: 2 }], total: 2, last_page: 1 };
    w.__routes["/api2/bad"] = { result: "failed", message: "nope" };
    const ok = await w.DCDN.fetch("/v2/api/entity/client/list/1");
    assert.strictEqual(JSON.stringify(ok), '{"success":true,"data":[{"id":1},{"id":2}],"meta":{"total":2,"pages":1,"page":1}}');
    const bad = await w.DCDN.fetch("/api2/bad");
    assert.strictEqual(bad.success, false);
    assert.strictEqual(bad.error.message, "nope");
    const silent = await w.DCDN.fetch("/api2/bad", { silent: true, fallback: [] });
    assert.strictEqual(JSON.stringify(silent), '{"success":false,"error":{"name":"DaftraError","message":"nope","status":200,"data":{"result":"failed","message":"nope"}},"data":[]}');
    const posted = await w.DCDN.post("/v2/api/entity/client/list/1", { a: 1 });
    assert.strictEqual(posted.success, true);
    const all = await w.DCDN.fetchAll("/v2/api/entity/client/list/1");
    assert.strictEqual(all.meta.total, 2);
    const ids = await w.DCDN.get("/v2/api/entity/client/list/1");
    assert.strictEqual(ids.success, true, "alias get works");
  });

  await test("PUBLIC: controllers keep methods, elements hidden from JSON", async () => {
    const w = makeDom("");
    const bar = w.DCDN.progressBar({ total: 2 });
    assert.ok(bar.success && typeof bar.data.update === "function");
    bar.data.update(1);
    assert.ok(!JSON.stringify(bar).includes("<div"), JSON.stringify(bar));
    assert.ok(bar.data.el.nodeType === 1, "element still reachable");
    const popup = w.DCDN.showPopup("<b>x</b>", { title: w.DCDN.t("أ", "A") });
    assert.ok(popup.success && popup.data.id);
    popup.data.close();
    const confirmP = w.DCDN.confirm("ok?");
    w.document.querySelector(".dcdn-btn.primary").click();
    assert.strictEqual(JSON.stringify(await confirmP), '{"success":true,"data":true}');
    const unknown = w.DCDN.registerTabPage("my_page");
    assert.strictEqual(unknown.success, true);
    assert.strictEqual(typeof w.DCDN.appendtab_my_page, "function", "dynamic alias is public too");
  });

  await test("PUBLIC: entity() methods return JSON", async () => {
    const w = makeDom("");
    w.__routes["/v2/api/entity/client/7/1"] = { id: 7 };
    const E = w.DCDN.entity("client").data;
    const res = await E.get(7);
    assert.strictEqual(JSON.stringify(res), '{"success":true,"data":{"id":7}}');
  });

  await test("PUBLIC: envelopes can be passed back into DCDN", () => {
    const w = makeDom('<span id="t">200</span><input id="v">');
    const c = w.DCDN.calculatePercent("#v", { base: () => w.DCDN.parseNumber(w.document.getElementById("t").textContent) });
    c.data.setPercent(10);
    assert.strictEqual(w.document.getElementById("v").value, "20.00");
    w.DCDN.toast(w.DCDN.t("نص", "text"));
    assert.ok(w.document.querySelector(".dcdn-toast").textContent.includes("نص"));
  });

  await test("NEW: nativeAlert picks Daftra's own style", () => {
    const w = makeDom('<div class="flash-wrapper"></div>');
    w.DCDN.raw.nativeAlert("ok");
    assert.ok(w.document.querySelector(".flash-wrapper #flashMessage.Sucmessage"));
    w.DCDN.raw.nativeAlert("bad", "error");
    assert.ok(w.document.querySelector(".flash-wrapper #CustomErrorMessage.Errormessage li").textContent === "bad");
    assert.strictEqual(w.document.querySelectorAll(".dcdn-native-flash").length, 1, "one banner at a time");
    const w2 = makeDom('<div class="main-area"><div class="container"></div></div>');
    w2.DCDN.raw.nativeAlert({ ar: "تحذير", en: "Warn" }, "warning");
    assert.ok(w2.document.querySelector(".main-area > .container .ui-flash-message--info"));
    const w3 = makeDom("");
    let called = null;
    w3.jQuery = { toast: (m, k) => (called = [m, k]) };
    w3.DCDN.raw.nativeAlert("x", "error");
    assert.deepStrictEqual(called, ["x", "danger"]);
    const res = w3.DCDN.flashToast("hi", "warning", { timeout: 0 });
    assert.ok(res.success && w3.document.querySelector(".dcdn-flash-toast--warning"));
  });

  await test("NEW: nativeLoader + initPage", async () => {
    const w = makeDom("");
    w.DCDN.raw.nativeLoader(true, "Loading");
    assert.strictEqual(w.document.querySelector(".page-loader .loading-spinner-text").textContent, "Loading");
    const res = await w.DCDN.initPage(() => 5);
    assert.strictEqual(JSON.stringify(res), '{"success":true,"data":5}');
  });

  await test("NEW: formatCurrency", () => {
    const w = makeDom("");
    const R = w.DCDN.raw;
    assert.strictEqual(R.formatCurrency(1250.5, "EGP", { lang: "ar" }), "1,250.50 ج.م");
    assert.strictEqual(R.formatCurrency(1250.5, "EGP", { lang: "en" }), "1,250.50 L.E");
    assert.strictEqual(R.formatCurrency("99", "USD"), "$99.00");
    assert.ok(R.formatCurrency(10, "SAR").includes("sar_symbol"));
    assert.strictEqual(R.formatCurrency(10, "SAR", { html: false }), "SAR 10.00");
    assert.strictEqual(R.formatCurrency(3, "XYZ"), "3.00 XYZ");
    assert.ok(Object.keys(R.currencyFormats).length > 140);
  });

  await test("NEW: entity helpers", async () => {
    const w = makeDom("");
    const R = w.DCDN.raw;
    w.__routes["/v2/api/entity/le_r/5/1"] = { payload: { data: { id: 5, name: "x" } } };
    assert.strictEqual((await R.fetch("/v2/api/entity/le_r/5/1")).name, "x", "payload.data unwrapped");
    assert.strictEqual(R.unwrapEntity({ payload: { data: { id: 1 } } }).id, 1);
    w.__routes["/v2/api/entity/workflow_type/list"] = (u) => ({ data: [{ id: 36, entity_key: "le_workflow-type-entity-36", name: u.searchParams.get("filter[name]") }] });
    const wt = await R.getWorkflowType("Customer Deliveries");
    assert.strictEqual(wt.name, "Customer Deliveries");
    await R.getWorkflowType("Customer Deliveries");
    assert.strictEqual(w.__calls.filter((c) => c.url.includes("workflow_type")).length, 1, "cached per name");
    assert.strictEqual(R.getEntityKeyId(wt), "36");
    w.__routes["/v2/api/entity/app_s/list/1"] = { data: [{ id: 1, child_pricing: 1 }], last_page: 1 };
    assert.strictEqual((await R.getFirstRecord("app_s")).child_pricing, 1);
    let sent;
    w.__routes["/v2/api/entity/app_p/12"] = (u, o) => ((sent = JSON.parse(o.body)), { id: 12 });
    await R.updateRecord("app_p", 12, { status: "Playing" }, { parentLink: { field: "reference_id", value: 5 } });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(sent)), { status: "Playing", id: 12, reference_id: 5 });
    w.__routes["/v2/api/entity/app_v/7/1"] = { id: 7, app_v_app_v_rows: [{ id: 1, a: 1 }, { id: 2, a: 2 }], app_v_app_v_other: [{ id: 9 }] };
    let put;
    w.__routes["/v2/api/entity/app_v/7"] = (u, o) => ((put = JSON.parse(o.body)), { id: 7 });
    await R.upsertSubformRows("app_v", 7, "rows", [{ id: 2, a: 22 }, { a: 3 }]);
    assert.strictEqual(JSON.stringify(put.app_v_app_v_rows), '[{"id":1,"a":1},{"id":2,"a":22},{"a":3}]');
    assert.strictEqual(put.app_v_app_v_other.length, 1, "other subforms kept");
    assert.strictEqual(R.subformKey("a", "b"), "a_a_b");
    assert.strictEqual(R.parseMultiValue("1, 2,3").join(), "1,2,3");
  });

  await test("NEW: page / time helpers", async () => {
    const w = makeDom("", "https://shop1.daftra.com/v2/owner/future-entity/workflow/le_workflow-type-entity-36/list");
    const R = w.DCDN.raw;
    const info = R.getPageInfo();
    assert.strictEqual(info.entity, "le_workflow-type-entity-36");
    assert.strictEqual(info.workflow, true);
    w.USER = { staff_id: 0, is_owner: 1, role_id: 3 };
    w.dataLayer = [{ site_id: 4245753 }];
    const ctx = R.getPageContext();
    assert.strictEqual(ctx.siteId, "4245753");
    assert.strictEqual(ctx.subdomain, "shop1");
    assert.strictEqual(ctx.isOwner, true);
    const now = R.nowInTimeZone("Asia/Riyadh", "2026-01-01T00:30:00Z");
    assert.strictEqual(now.date + " " + now.time, "2026-01-01 03:30");
    assert.strictEqual(R.ageOnDate("2015-06-01", "2026-05-31"), 10);
    assert.strictEqual(R.ageOnDate("2015-06-01", "2026-06-01"), 11);
    let runs = 0;
    const work = () => new Promise((r) => setTimeout(() => r(++runs), 5));
    const [a, b] = await Promise.all([R.cached("k", work), R.cached("k", work)]);
    assert.strictEqual(a + b + runs, 3, "shared one run");
    await R.cached("t", () => 42, { ttl: 60000 });
    assert.strictEqual(await R.cached("t", () => 0, { ttl: 60000 }), 42, "ttl cache");
  });

  await test("NEW: field errors + save validation", () => {
    const w = makeDom('<form id="f"><div class="col-lg-6"><input id="data-x--qty"></div><button type="submit">Save</button></form>');
    const R = w.DCDN.raw;
    assert.ok(R.showFieldError("qty", { ar: "أدخل الكمية", en: "Enter qty" }));
    const col = w.document.querySelector(".col-lg-6");
    assert.ok(col.classList.contains("is-invalid"));
    assert.strictEqual(col.querySelector(".form-validation p.error").textContent, "أدخل الكمية");
    w.document.getElementById("data-x--qty").dispatchEvent(new w.Event("input"));
    assert.ok(!col.classList.contains("is-invalid"), "clears on input");
    let submitted = false;
    w.document.getElementById("f").addEventListener("submit", (e) => { e.preventDefault(); submitted = true; });
    R.bindSaveValidation("#f", () => (w.document.getElementById("data-x--qty").value ? [] : [{ field: "qty", message: "Required" }]));
    w.document.querySelector("button").click();
    assert.ok(!submitted && col.querySelector(".error"), "blocked + message");
    w.document.getElementById("data-x--qty").value = "3";
    w.document.querySelector("button").click();
    assert.ok(submitted, "allowed when valid");
  });

  await test("NEW: breadcrumbs, steps, list button, hide, add button, sidebar", async () => {
    const w = makeDom(`<ol id="header-breadcrumb"><li class="breadcrumb-item"><a href="/a">A</a></li><li class="breadcrumb-item"><a href="/b">B</a></li><li class="breadcrumb-item active">C</li></ol>
      <div class="pages-head-btns"><a class="add-new-btn" href="/x"><i></i> Add</a></div>
      <ul><li class="mn_dashboard"><ul class="sub-menu"><li><a href="/d1"><span>D1</span></a></li></ul></li></ul>
      <ul><li class="sidebar-list-item" data-app-sidebar-list-item="1"><ul><li class="sidebar-list-item-sublist-item"><a href="/v1"><span>V1</span></a></li></ul></li></ul>`);
    const R = w.DCDN.raw;
    R.prependBreadcrumb({ label: { ar: "الرئيسية", en: "Home" }, url: "/home" });
    R.prependBreadcrumb({ label: "again", url: "/home" });
    assert.strictEqual(w.document.querySelectorAll("#header-breadcrumb li").length, 4, "added once");
    R.setBreadcrumbs({ first: { label: "First", url: "/f" }, hideMiddle: true, active: "Now", title: true });
    assert.strictEqual(w.document.querySelector("#header-breadcrumb li:last-child").textContent, "Now");
    assert.strictEqual(w.document.title, "Now");
    const steps = R.stepsHeader([{ number: 1, title: "A" }, { number: 2, title: "B" }, { number: 4, title: "C" }], 2);
    assert.ok(steps.querySelector(".is-done") && steps.querySelector(".is-current .dcdn-step-title").textContent === "B");
    let clicked = false;
    R.addListButton({ id: "b1", label: "Run", icon: "mdi-refresh", onClick: () => (clicked = true) });
    R.addListButton({ id: "b1", label: "Run" });
    assert.strictEqual(w.document.querySelectorAll('[data-dcdn-button="b1"]').length, 1);
    w.document.querySelector('[data-dcdn-button="b1"]').click();
    assert.ok(clicked);
    const hidden = R.hideEarly(".add-new-btn");
    assert.ok(w.document.getElementById(hidden.style.id));
    assert.strictEqual(R.replaceAddButton({ href: "/new", label: "Add Delivery" }), 1);
    assert.ok(!w.document.getElementById(hidden.style.id), "revealed");
    assert.strictEqual(w.document.querySelector(".add-new-btn").getAttribute("href"), "/new");
    assert.strictEqual(w.document.querySelector(".add-new-btn span").textContent, "Add Delivery");
    assert.ok(await R.addSidebarLink({ id: "ntmp", label: "NTMP", url: "/ntmp" }));
    assert.strictEqual(w.document.querySelectorAll('[data-dcdn-sidebar="ntmp"]').length, 2, "both layouts");
    await R.addSidebarLink({ id: "ntmp", label: "NTMP 2", url: "/ntmp2" });
    assert.strictEqual(w.document.querySelectorAll('[data-dcdn-sidebar="ntmp"]').length, 2, "replaced");
    R.hideFormField("status", "le_x");
    assert.ok(w.document.head.innerHTML.includes(".container-le_x_custom_data-status"));
  });

  await test("NEW: notice after reload", () => {
    const w = makeDom('<div class="flash-wrapper"></div>');
    assert.ok(w.DCDN.raw.noticeAfterReload("Saved"));
    const shown = w.DCDN.raw.showPendingNotice();
    assert.strictEqual(shown.text, "Saved");
    assert.ok(w.document.querySelector("#flashMessage"));
    assert.strictEqual(w.DCDN.raw.showPendingNotice(), null, "only once");
  });

  await test("NEW: languagePack", async () => {
    const w = makeDom(`<h1>Delivery Orders</h1><p>Testing Test</p><input placeholder="Driver"><select><option value="">Driver</option><option value="5">Driver Ahmed</option></select>
      <div class="form-group"><select data-izam1-forms1-dynamic-drop-down></select><input readonly value="Vehicle"></div>
      <span class="dcdn-no-translate">Driver</span><span id="s">Sent 5 journals</span>`);
    w.document.documentElement.setAttribute("dir", "rtl");
    const R = w.DCDN.raw;
    const pack = R.languagePack({
      phrases: [{ en: "Delivery Orders", ar: "أوامر التوصيل" }, { en: "Driver", ar: "سائق" }, ["Test", "تجريبي"], ["Vehicle", "مركبة"], ["journals", "قيود"]],
      sentences: [{ en: "Sent {count} journals", ar: "تم إرسال {count} قيود" }],
      wholeWords: true,
      autoStart: false,
    });
    pack.translate();
    const d = w.document;
    assert.strictEqual(d.querySelector("h1").textContent, "أوامر التوصيل");
    assert.strictEqual(d.querySelector("p").textContent, "Testing تجريبي", "whole words only");
    assert.strictEqual(d.querySelector("input").placeholder, "سائق");
    assert.strictEqual(d.querySelector('option[value=""]').textContent, "سائق", "placeholder option");
    assert.strictEqual(d.querySelector('option[value="5"]').textContent, "Driver Ahmed", "data option untouched");
    assert.strictEqual(d.querySelector("input[readonly]").value, "مركبة", "dynamic dropdown display");
    assert.strictEqual(d.querySelector(".dcdn-no-translate").textContent, "Driver", "skipped");
    assert.strictEqual(d.getElementById("s").textContent, "تم إرسال 5 قيود", "sentence with slot");
    assert.strictEqual(pack.translateSentence("Sent 12 journals"), "تم إرسال 12 قيود");
    d.body.insertAdjacentHTML("beforeend", '<div id="late">Driver</div>');
    assert.strictEqual(R.translateLanguagePack("#late"), 1);
    assert.strictEqual(d.getElementById("late").textContent, "سائق");
    const en = makeDom("<b>Driver</b>");
    en.document.documentElement.setAttribute("dir", "ltr");
    en.DCDN.raw.languagePack({ phrases: [["Driver", "سائق"]], arabicPagesOnly: true, autoStart: false }).translate();
    assert.strictEqual(en.document.querySelector("b").textContent, "Driver", "english page untouched");
    const res = en.DCDN.languagePack({ phrases: [["Driver", "سائق"]], autoStart: false });
    assert.ok(res.success && typeof res.data.translate === "function");
  });

  await test("NEW: help lists new functions with typed docs", () => {
    if (FILE.includes(".min.")) return;
    const w = makeDom("");
    w.console.log = () => {};
    const docs = w.DCDN.raw.help("formatCurrency").docs.join("\n");
    assert.ok(docs.includes("@param {string} currencyCode"));
    const fetchDocs = w.DCDN.raw.help("fetch").docs.join("\n");
    assert.ok(fetchDocs.includes("@param {Object} [options.filters]") && fetchDocs.includes("RETURNS JSON"));
  });

  await test("waitForElement", async () => {
    const w = makeDom("");
    setTimeout(() => w.document.body.insertAdjacentHTML("beforeend", "<i class='late'></i>"), 20);
    const el = await w.DCDN.raw.waitForElement(".late", { timeout: 1000 });
    assert.ok(el);
  });

  console.log(`\n${passed} passed`);
})();
