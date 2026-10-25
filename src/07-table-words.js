/* ==========================================================================
 * 07-table-words.js
 * ----------------------------------------------------------------------------
 * - Table helpers: serials, swap columns, hide column, toJSON, Excel / CSV export
 * - formatCells (was removeCurr)
 * - Number to words in Arabic / English with currency (tafqeet / convertFN)
 * ======================================================================== */

DCDN.table = {};

DCDN.table.addSerials = function addSerials(table, options) {
  /**
   * Add a serial-number column at the start of a table (was addserials).
   * Runs only once per table.
   *
   * @param {string|Element} [table="#listing_table"]
   * @param {Object} [options]
   * @param {string|{ar:string,en:string}} [options.header]
   * @returns {void}
   *
   * Examples:
   *   DCDN.table.addSerials();                                    // #listing_table
   *   DCDN.table.addSerials("#my-table", { header: { ar: "م", en: "#" } });
   */
  options = options || {};
  var tableElement = getElement(table || "#listing_table");
  if (!tableElement || tableElement.dataset.dcdnSerials) return;
  tableElement.dataset.dcdnSerials = "1";

  var rowNumber = 0;
  for (var i = 0; i < tableElement.rows.length; i++) {
    var row = tableElement.rows[i];
    var isHeaderRow = row.parentNode.tagName === "THEAD" || (i === 0 && row.cells[0] && row.cells[0].tagName === "TH");
    var cell = document.createElement(isHeaderRow ? "th" : "td");
    cell.className = "dcdn-serial";
    cell.textContent = isHeaderRow ? pickText(options.header || { ar: "م", en: "#" }) : String(++rowNumber);
    row.insertBefore(cell, row.cells[0] || null);
  }
};

DCDN.table.swapColumns = function swapColumns(firstIndex, secondIndex, table) {
  /**
   * Swap two columns in every row: content + id + class.
   * Same as the standard  swap(in1, in2, "listing_table")  used in templates.
   *
   * @param {number} firstIndex                 0-based
   * @param {number} secondIndex
   * @param {string|Element} table              table id ("listing_table"), selector or element
   * @returns {void}
   *
   * Examples:
   *   DCDN.swap(3, 6, "listing_table");
   *   DCDN.table.swapColumns(0, 1, "#my-table");
   */
  var tableElement =
    typeof table === "string" && !/^[#.\[]/.test(table) ? document.getElementById(table) : getElement(table);
  if (!tableElement) return;

  for (var i = 0, row; (row = tableElement.rows[i]); i++) {
    var firstCell = row.cells[firstIndex];
    var secondCell = row.cells[secondIndex];
    if (!firstCell || !secondCell) continue;

    var temp = firstCell.innerHTML;
    firstCell.innerHTML = secondCell.innerHTML;
    secondCell.innerHTML = temp;

    temp = firstCell.id;
    firstCell.id = secondCell.id;
    secondCell.id = temp;

    temp = firstCell.className;
    firstCell.className = secondCell.className;
    secondCell.className = temp;
  }
};
DCDN.swap = DCDN.table.swapColumns;

DCDN.table.hideColumn = function hideColumn(table, columnIndex) {
  /**
   * Hide one column (0-based) in every row.
   *
   * @param {string|Element} table
   * @param {number} columnIndex                0-based
   * @returns {void}
   *
   * Example:
   *   DCDN.table.hideColumn("#listing_table", 4);
   */
  var tableElement = getElement(table);
  if (!tableElement) return;
  for (var i = 0, row; (row = tableElement.rows[i]); i++) {
    if (row.cells[columnIndex]) row.cells[columnIndex].style.display = "none";
  }
};

DCDN.table.toJSON = function toJSON(table) {
  /**
   * Read a table into an array of objects (first row = keys).
   *
   * @param {string|Element} table
   * @returns {Object[]}                        first row = keys
   *
   * Example:
   *   DCDN.table.toJSON("#report")
   *   // [{ "Name": "Ahmed", "Total": "1,200" }, ...]
   */
  var tableElement = getElement(table);
  if (!tableElement || !tableElement.rows.length) return [];

  var headers = Array.prototype.map.call(tableElement.rows[0].cells, function (cell, index) {
    return cell.textContent.trim() || "col" + index;
  });

  var rows = [];
  for (var i = 1; i < tableElement.rows.length; i++) {
    var rowObject = {};
    Array.prototype.forEach.call(tableElement.rows[i].cells, function (cell, index) {
      rowObject[headers[index] || "col" + index] = cell.textContent.trim();
    });
    rows.push(rowObject);
  }
  return rows;
};

DCDN.table.exportToExcel = function exportToExcel(table, filename) {
  /**
   * Download a table as an .xls file that Excel opens (RTL sheet on Arabic pages).
   *
   * @param {string|Element} table
   * @param {string} [filename="export"]        without extension
   * @returns {void}
   *
   * Examples:
   *   DCDN.exportTableToExcel("#report", "sales-report");
   *   DCDN.table.exportToExcel(document.querySelector(".list-table"));
   */
  var tableElement = getElement(table);
  if (!tableElement) return;
  var rightToLeft = DCDN.isRTL();
  var html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="UTF-8">' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
    "<x:Name>Sheet1</x:Name><x:WorksheetOptions>" +
    (rightToLeft ? "<x:DisplayRightToLeft/>" : "") +
    "</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    "</head><body>" +
    tableElement.outerHTML +
    "</body></html>";
  var blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
  DCDN.downloadBlob(blob, (filename || "export") + ".xls");
};
DCDN.exportTableToExcel = DCDN.table.exportToExcel;

DCDN.exportCSV = function exportCSV(rows, filename) {
  /**
   * Download rows (array of objects) or a table as a CSV file (UTF-8, Excel friendly).
   *
   * @param {Object[]|string|Element} rows      rows, or a table
   * @param {string} [filename="export"]
   * @returns {void}
   *
   * Examples:
   *   const res = await DCDN.bulkFetch("/v2/api/entity/client/list/1");
   *   DCDN.exportCSV(res.data, "clients");
   *
   *   DCDN.exportCSV("#report", "report");     // from a table
   */
  if (rows && (rows.nodeType || typeof rows === "string")) rows = DCDN.table.toJSON(rows);
  rows = rows || [];
  var headers = rows.length ? Object.keys(rows[0]) : [];

  function escapeCsv(value) {
    value = value == null ? "" : String(value);
    return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  var lines = [headers.map(escapeCsv).join(",")].concat(
    rows.map(function (row) {
      return headers
        .map(function (header) {
          return escapeCsv(row[header]);
        })
        .join(",");
    })
  );
  var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  DCDN.downloadBlob(blob, (filename || "export") + ".csv");
};

DCDN.downloadBlob = function downloadBlob(blob, filename) {
  /**
   * Download any Blob as a file.
   *
   * @param {Blob} blob
   * @param {string} filename
   * @returns {void}
   *
   * Example:
   *   DCDN.downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "data.json");
   */
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 500);
};

DCDN.formatCells = function formatCells(selector, options) {
  /**
   * Re-format the amounts inside elements (was removeCurr).
   *
   * @param {string} selector
   * @param {Object} [options]
   * @param {number} [options.decimals=2]
   * @param {string} [options.prefix]
   * @param {string} [options.suffix]
   * @param {string} [options.suffixHtml]       HTML after the number (overrides suffix)
   * @returns {void}
   *
   * Examples:
   *   DCDN.formatCells(".removeCurr");                                  // "1234.5" -> "1,234.50"
   *   DCDN.formatCells(".removeCurr", { suffix: " ر.س" });
   *   DCDN.formatCells(".amount", { suffixHtml: '<span class="sar_symbol">&nbsp;元</span>' });
   */
  options = options || {};
  getElements(selector).forEach(function (element) {
    var number = DCDN.parseNumber(element.textContent);
    var formatted = DCDN.formatNumber(number, options.decimals == null ? 2 : options.decimals);
    if (options.suffixHtml) {
      element.innerHTML = DCDN.escapeHtml((options.prefix || "") + formatted) + options.suffixHtml;
    } else {
      element.textContent = (options.prefix || "") + formatted + (options.suffix || "");
    }
  });
};

/* ============================ number to words ============================ */

var ARABIC_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
var ARABIC_TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
var ARABIC_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
var ARABIC_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
// each scale: [singular, dual, plural (3-10), accusative singular (11-99)]
var ARABIC_SCALES = [
  null,
  ["ألف", "ألفان", "آلاف", "ألفاً"],
  ["مليون", "مليونان", "ملايين", "مليوناً"],
  ["مليار", "ملياران", "مليارات", "ملياراً"],
  ["تريليون", "تريليونان", "تريليونات", "تريليوناً"],
];

/** 0-99 in Arabic words. */
function arabicBelow100(number) {
  if (number < 10) return ARABIC_ONES[number];
  if (number < 20) return ARABIC_TEENS[number - 10];
  var ones = number % 10;
  return (ones ? ARABIC_ONES[ones] + " و" : "") + ARABIC_TENS[Math.floor(number / 10)];
}

/** 0-999 in Arabic words. */
function arabicBelow1000(number) {
  var hundreds = Math.floor(number / 100);
  var rest = number % 100;
  var parts = [];
  if (hundreds) parts.push(ARABIC_HUNDREDS[hundreds]);
  if (rest) parts.push(arabicBelow100(rest));
  return parts.join(" و");
}

/** Choose the noun form for a count: [singular, dual, plural, accusative]. */
function arabicCountedNoun(count, forms) {
  var lastTwoDigits = count % 100;
  if (count === 1) return forms[0];
  if (count === 2) return forms[1];
  if (lastTwoDigits >= 3 && lastTwoDigits <= 10) return forms[2];
  if (lastTwoDigits >= 11 && lastTwoDigits <= 99) return forms[3];
  return forms[0];
}

/** A 3-digit group with its scale word, e.g. 3 + thousands -> "ثلاثة آلاف". */
function arabicGroupWithScale(group, forms) {
  if (group === 1) return forms[0];
  if (group === 2) return forms[1];

  var lastTwoDigits = group % 100;
  var hundredsText = group >= 100 ? ARABIC_HUNDREDS[Math.floor(group / 100)] : "";
  var tailText;
  if (lastTwoDigits === 0) tailText = "";
  else if (lastTwoDigits === 1) tailText = forms[0];
  else if (lastTwoDigits === 2) tailText = forms[1];
  else tailText = arabicBelow100(lastTwoDigits);

  if (group < 100) return tailText + " " + arabicCountedNoun(group, forms);
  if (lastTwoDigits === 0) return hundredsText + " " + forms[0];
  if (lastTwoDigits <= 2) return hundredsText + " و" + tailText;
  return hundredsText + " و" + tailText + " " + arabicCountedNoun(lastTwoDigits, forms);
}

DCDN.numberToArabicWords = function numberToArabicWords(number) {
  /**
   * Whole number -> Arabic words (no currency).
   *
   * @param {number|string} number             whole part is used
   * @returns {string}
   *
   * Examples:
   *   DCDN.numberToArabicWords(21)        // "واحد وعشرون"
   *   DCDN.numberToArabicWords(1250)      // "ألف ومائتان وخمسون"
   *   DCDN.numberToArabicWords(2000000)   // "مليونان"
   */
  number = Math.floor(Math.abs(Number(number) || 0));
  if (number === 0) return "صفر";

  var groups = []; // groups of 3 digits, smallest first
  while (number > 0) {
    groups.push(number % 1000);
    number = Math.floor(number / 1000);
  }

  var parts = [];
  for (var i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(i === 0 ? arabicBelow1000(groups[i]) : arabicGroupWithScale(groups[i], ARABIC_SCALES[i]));
  }
  return parts.join(" و");
};

var ENGLISH_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
var ENGLISH_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
var ENGLISH_SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

/** 0-999 in English words. */
function englishBelow1000(number) {
  var parts = [];
  if (number >= 100) {
    parts.push(ENGLISH_ONES[Math.floor(number / 100)] + " Hundred");
    number %= 100;
  }
  if (number >= 20) {
    parts.push(ENGLISH_TENS[Math.floor(number / 10)] + (number % 10 ? "-" + ENGLISH_ONES[number % 10] : ""));
  } else if (number) {
    parts.push(ENGLISH_ONES[number]);
  }
  return parts.join(" ");
}

DCDN.numberToEnglishWords = function numberToEnglishWords(number) {
  /**
   * Whole number -> English words (no currency).
   *
   * @param {number|string} number
   * @returns {string}
   *
   * Example:
   *   DCDN.numberToEnglishWords(1250)   // "One Thousand Two Hundred Fifty"
   */
  number = Math.floor(Math.abs(Number(number) || 0));
  if (number === 0) return "Zero";
  var parts = [];
  var scaleIndex = 0;
  while (number > 0) {
    var group = number % 1000;
    if (group) parts.unshift(englishBelow1000(group) + (ENGLISH_SCALES[scaleIndex] ? " " + ENGLISH_SCALES[scaleIndex] : ""));
    number = Math.floor(number / 1000);
    scaleIndex++;
  }
  return parts.join(" ");
};

/**
 * Currency names used by numberToWords.
 *   ar / arSub: [singular, dual, plural (3-10), accusative (11-99)]
 *   en / enSub: [singular, plural]
 *   sub:        fraction units in one main unit (100 or 1000)
 *   subFem:     fraction unit is feminine in Arabic ("هللة واحدة")
 * Add your own:  DCDN.currencies.LYD = { ... }
 */
DCDN.currencies = {
  SAR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["هللة", "هللتان", "هللات", "هللة"], subFem: true, en: ["Riyal", "Riyals"], enSub: ["Halala", "Halalas"], sub: 100 },
  EGP: { ar: ["جنيه", "جنيهان", "جنيهات", "جنيهاً"], arSub: ["قرش", "قرشان", "قروش", "قرشاً"], en: ["Pound", "Pounds"], enSub: ["Piaster", "Piasters"], sub: 100 },
  AED: { ar: ["درهم", "درهمان", "دراهم", "درهماً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dirham", "Dirhams"], enSub: ["Fils", "Fils"], sub: 100 },
  KWD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  BHD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  OMR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["بيسة", "بيستان", "بيسات", "بيسة"], subFem: true, en: ["Rial", "Rials"], enSub: ["Baisa", "Baisa"], sub: 1000 },
  QAR: { ar: ["ريال", "ريالان", "ريالات", "ريالاً"], arSub: ["درهم", "درهمان", "دراهم", "درهماً"], en: ["Riyal", "Riyals"], enSub: ["Dirham", "Dirhams"], sub: 100 },
  JOD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  IQD: { ar: ["دينار", "ديناران", "دنانير", "ديناراً"], arSub: ["فلس", "فلسان", "فلوس", "فلساً"], en: ["Dinar", "Dinars"], enSub: ["Fils", "Fils"], sub: 1000 },
  USD: { ar: ["دولار", "دولاران", "دولارات", "دولاراً"], arSub: ["سنت", "سنتان", "سنتات", "سنتاً"], en: ["Dollar", "Dollars"], enSub: ["Cent", "Cents"], sub: 100 },
};

DCDN.numberToWords = function numberToWords(amount, options) {
  /**
   * Amount -> words with currency (tafqeet / convertFN).
   *
   * @param {number|string} amount
   * @param {Object} [options]
   * @param {"ar"|"en"} [options.lang]          default page language
   * @param {string|Object} [options.currency]  SAR EGP AED KWD BHD OMR QAR JOD IQD USD, or a DCDN.currencies-style object
   * @param {string|boolean} [options.prefix]   default "فقط " / "Only " (false = none)
   * @param {string|boolean} [options.suffix]   default " لا غير" / "" (false = none)
   * @returns {string}
   *
   * Examples:
   *   DCDN.numberToWords(1250.5, { currency: "SAR", lang: "ar" })
   *   // "فقط ألف ومائتان وخمسون ريالاً وخمسون هللة لا غير"
   *
   *   DCDN.numberToWords(1250.5, { currency: "SAR", lang: "en" })
   *   // "Only One Thousand Two Hundred Fifty Riyals and Fifty Halalas"
   *
   *   DCDN.numberToWords(3000, { currency: "EGP", prefix: false, suffix: false })
   *   // "ثلاثة آلاف جنيه"
   *
   *   // in a page: write the total in words under the invoice total
   *   $("#total-words").text(DCDN.numberToWords($("#invoice-total").text(), { currency: "SAR" }).data);
   */
  options = options || {};
  var lang = options.lang || DCDN.detectLang();
  var currency =
    typeof options.currency === "object" ? options.currency : DCDN.currencies[(options.currency || "").toUpperCase()];

  var number = Math.abs(DCDN.parseNumber(amount));
  var fractionUnits = currency ? currency.sub : 100;
  var fractionDigits = String(fractionUnits).length - 1;
  var mainPart = Math.floor(number);
  var fractionPart = Math.round((number - mainPart) * fractionUnits);
  if (fractionPart >= fractionUnits) {
    // e.g. 0.999 rounds up
    mainPart += 1;
    fractionPart = 0;
  }

  /* ---------- English ---------- */
  if (lang === "en") {
    var englishText = DCDN.numberToEnglishWords(mainPart);
    if (currency) englishText += " " + (mainPart === 1 ? currency.en[0] : currency.en[1]);
    if (fractionPart) {
      englishText +=
        " and " +
        DCDN.numberToEnglishWords(fractionPart) +
        (currency ? " " + (fractionPart === 1 ? currency.enSub[0] : currency.enSub[1]) : "");
    }
    var englishPrefix = options.prefix === false ? "" : options.prefix || "Only ";
    var englishSuffix = options.suffix === false ? "" : options.suffix || "";
    return (englishPrefix + englishText + englishSuffix).trim();
  }

  /* ---------- Arabic ---------- */
  var arabicText;
  if (!currency) arabicText = DCDN.numberToArabicWords(mainPart);
  else if (mainPart === 1) arabicText = currency.ar[0] + " واحد";
  else if (mainPart === 2) arabicText = currency.ar[1];
  else arabicText = DCDN.numberToArabicWords(mainPart) + " " + arabicCountedNoun(mainPart, currency.ar);

  if (fractionPart) {
    var fractionText;
    if (!currency) fractionText = DCDN.numberToArabicWords(fractionPart) + " من " + Math.pow(10, fractionDigits);
    else if (fractionPart === 1) fractionText = currency.arSub[0] + (currency.subFem ? " واحدة" : " واحد");
    else if (fractionPart === 2) fractionText = currency.arSub[1];
    else fractionText = DCDN.numberToArabicWords(fractionPart) + " " + arabicCountedNoun(fractionPart, currency.arSub);
    arabicText += " و" + fractionText;
  }

  var arabicPrefix = options.prefix === false ? "" : options.prefix || "فقط ";
  var arabicSuffix = options.suffix === false ? "" : options.suffix || " لا غير";
  return arabicPrefix + arabicText + arabicSuffix;
};
DCDN.tafqeet = DCDN.numberToWords;
