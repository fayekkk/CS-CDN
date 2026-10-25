/* Build: concatenates src/*.js into a UMD bundle -> dist/daftra-cdn.js + .min.js */
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");

const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");
fs.mkdirSync(DIST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
const body = files.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(SRC, f), "utf8")).join("\n\n");

/* ---- generate the public JSON wrappers (docs copied from each real function) ---- */
const RESERVED = new Set(["delete", "new", "class", "function", "var", "default"]);
const publicDefs = [];
const fnRegex = /^DCDN\.([A-Za-z_$][\w$.]*) = function [\w$]+\(([^)]*)\) \{\n(\s*\/\*\*[\s\S]*?\*\/)/gm;
let match;
while ((match = fnRegex.exec(body))) {
  const [, fnPath, params, doc] = match;
  if (fnPath === "help" || fnPath === "configure") {
    // still JSON, but keep the docs readable
  }
  const shortName = fnPath.split(".").pop();
  const wrapperName = RESERVED.has(shortName) ? shortName + "_" : shortName;
  const note =
    "\n   * RETURNS JSON:  { success: true, data: <@returns above> }  or  { success: false, error: { name, message, status, data } }" +
    (/(Promise|await|async)/.test(doc) ? "\n   *                (async: a Promise of that JSON, never rejects)" : "") +
    "\n   * Plain value without the JSON wrapper:  DCDN.raw." + fnPath + "(...)\n   *";
  // note goes at the END so the first doc line stays the description (used by DCDN.help())
  const docWithNote = doc.replace(/\s*\*\/$/, "\n   *" + note.replace(/\n   \*$/, "") + "\n   */");
  publicDefs.push(
    `definePublic(${JSON.stringify(fnPath)}, function ${wrapperName}(${params}) {\n${docWithNote}\n  return callPublic(${JSON.stringify(fnPath)}, this, arguments);\n});`
  );
}
// docs live once, on the public wrappers: the raw functions point to DCDN.help()
const bodyWithoutDocs = body.replace(fnRegex, (whole, fnPath, params, doc) =>
  whole.replace(doc, '  /* docs + examples: DCDN.help("' + fnPath + '")  or  DCDN.' + fnPath + ' in the console */')
);
const generated = "/* ---- generated: public JSON API (" + publicDefs.length + " functions) ---- */\n" + publicDefs.join("\n\n");

const banner = `/*!
 * Daftra CDN v${pkg.version} — reusable functions & components for Daftra page codes
 * Global: window.DCDN (alias window.DaftraCDN)
 * Docs in the console: DCDN.help()  or  DCDN.help("addDropdown")
 * Built: ${new Date().toISOString()}
 */`;

const out = `${banner}
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
      console.warn('[DCDN] {"event":"no page document","hint":"In DevTools choose the top context in the console dropdown, then paste again"}');
    return;
  }
  // Several apps may include the CDN on the same page: load once, but a NEWER
  // version always replaces an older one that was loaded first.
  var NEW_VERSION = "${pkg.version}";
  function isNewer(a, b) {
    var x = String(a).split("."), y = String(b).split(".");
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0;
    }
    return false;
  }
  var existing = g.DCDN && g.DCDN.version;
  if (!existing || isNewer(NEW_VERSION, existing)) {
    if (existing && typeof console !== "undefined") console.info('[DCDN] {"event":"replacing older version","from":"' + existing + '","to":"' + NEW_VERSION + '"}');
    g.DCDN = g.DaftraCDN = factory(g);
  }
  if (typeof module === "object" && module && module.exports) module.exports = g.DCDN;
})(function (window) {
  "use strict";
  var document = window.document;
  var VERSION = "${pkg.version}";
  var DCDN = {};

${bodyWithoutDocs}

${generated}

  return createPublicApi();
});
`;

fs.writeFileSync(path.join(DIST, "daftra-cdn.js"), out);
console.log("✔ dist/daftra-cdn.js", (out.length / 1024).toFixed(1) + " KB");

(async () => {
  let terser;
  try { terser = require("terser"); } catch (e) { console.warn("terser not installed – run `npm i` to produce the .min.js"); return; }
  const min = await terser.minify(out, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: /^!/ },
    sourceMap: { filename: "daftra-cdn.min.js", url: "daftra-cdn.min.js.map" },
  });
  fs.writeFileSync(path.join(DIST, "daftra-cdn.min.js"), min.code);
  fs.writeFileSync(path.join(DIST, "daftra-cdn.min.js.map"), min.map);
  // versioned copy so old pages can pin a version
  fs.mkdirSync(path.join(DIST, "v" + pkg.version), { recursive: true });
  fs.writeFileSync(path.join(DIST, "v" + pkg.version, "daftra-cdn.min.js"), min.code.replace(/\n\/\/# sourceMappingURL=.*$/, ""));
  fs.writeFileSync(path.join(DIST, "v" + pkg.version, "daftra-cdn.js"), out);
  console.log("✔ dist/daftra-cdn.min.js", (min.code.length / 1024).toFixed(1) + " KB");
})();
