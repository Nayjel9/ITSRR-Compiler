const STORAGE_KEY = "itsrr-compiler-reports-v1";
const ARCHIVE_KEY = "itsrr-compiler-archives-v1";
const fields = ["itsrrNumber", "department", "terminalUser", "reportedAt", "reportedBy", "problem", "resolvedAt", "cause", "solution", "status"];
const form = document.querySelector("#reportForm");
const editId = document.querySelector("#editId");
const body = document.querySelector("#recordsBody");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const pasteInput = document.querySelector("#pasteInput");
const pasteMessage = document.querySelector("#pasteMessage");
let reports = loadReports();
let archives = loadArchives();

const labelMap = {
  "itsrr number": "itsrrNumber",
  "department": "department",
  "terminal user": "terminalUser",
  "date and time reported": "reportedAt",
  "reported by": "reportedBy",
  "problem": "problem",
  "date and time resolved": "resolvedAt",
  "cause": "cause",
  "solution": "solution",
  "status": "status"
};

function loadReports() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function loadArchives() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; }
  catch { return []; }
}

function isPendingStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["resolved", "closed", "working", "completed", "complete", "done"].includes(normalized);
}

function updateStatusFilter() {
  const selected = statusFilter.value;
  const statusMap = new Map();
  reports.forEach(report => {
    const display = String(report.status || "").trim();
    const normalized = display.toLowerCase();
    if (display && !statusMap.has(normalized)) statusMap.set(normalized, display);
  });
  const statuses = [...statusMap.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }));
  statusFilter.replaceChildren(new Option("All statuses", "all"), new Option(`Pending tickets (${reports.filter(report => isPendingStatus(report.status)).length})`, "pending"));
  statuses.forEach(([normalized, display]) => statusFilter.add(new Option(display, `status:${normalized}`)));
  statusFilter.value = [...statusFilter.options].some(option => option.value === selected) ? selected : "all";
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));
}

function isExplicitlyPending(status) {
  return String(status || "").trim().toLowerCase() === "pending";
}

function archiveLabel(items) {
  const keys = items.map(item => monthKey(item.reportedAt)).filter(Boolean).sort();
  if (!keys.length) return "Undated tickets";
  const [year, month] = keys.at(-1).split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function renderArchives() {
  const list = document.querySelector("#archiveList");
  document.querySelector("#archiveCount").textContent = archives.length;
  document.querySelector("#archiveEmpty").hidden = archives.length > 0;
  list.hidden = archives.length === 0;
  list.innerHTML = archives.map(archive => `
    <div class="archive-item">
      <div>
        <h3>${escapeHtml(archive.label)}</h3>
        <p>${archive.reports.length} ticket${archive.reports.length === 1 ? "" : "s"} · Archived ${escapeHtml(displayDate(archive.archivedAt))}</p>
      </div>
      <button class="button button-secondary" data-restore-archive="${archive.id}" type="button">Restore to active</button>
    </div>`).join("");
}

function archiveFinishedReports() {
  const finished = reports.filter(report => !isExplicitlyPending(report.status));
  const pending = reports.filter(report => isExplicitlyPending(report.status));
  if (!finished.length) {
    notify("No finished tickets to archive");
    return;
  }
  const label = archiveLabel(finished);
  const message = `Archive ${finished.length} ticket${finished.length === 1 ? "" : "s"} as ${label}? ${pending.length} Pending ticket${pending.length === 1 ? "" : "s"} will remain active.`;
  if (!confirm(message)) return;
  archives.unshift({ id: crypto.randomUUID(), label, archivedAt: new Date().toISOString(), reports: finished });
  reports = pending;
  persist();
  resetForm();
  render();
  notify(`${finished.length} tickets archived`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function excelDate(value) {
  return value ? new Date(value) : "";
}

const DEPARTMENTS = {
  CCOEX: "Cavite CoEx", CSPQA: "Cavite SPQA", JPE: "Jobin PE", MPRD: "Main Production",
  DWHS: "Daichi Warehouse", S: "Sales", E: "Exodus", JQM: "Jobin QM", HR: "HR", HRX: "HR",
  CWH: "Cavite Warehouse", HLT: "Health", SO: "Safety Officer", CPE: "Cavite PE",
  GRC: "Grace Office", JSPA: "Jobin Spa", JF: "Jobin Facilities", JPLN: "Jobin Planner", MKT: "Makati"
};

function departmentFor(report) {
  if (report.department?.trim()) return report.department.trim();
  const prefix = report.itsrrNumber.trim().split("-")[0].replace(/\s+\d+$/, "").toUpperCase();
  return DEPARTMENTS[prefix] || "";
}

function reportText(report) {
  return `${report.problem || ""} ${report.cause || ""} ${report.solution || ""}`.toLowerCase();
}

function isPrinter(report) {
  return /\b(print|printer|printing|xerox|epson|zebra|toner|ink cartridge|printhead|print head|spooler|paper jam)\b/.test(reportText(report));
}

function isShopfloor(report) {
  return /\bshop\s*floor\b/.test(reportText(report));
}

function broadIssueCategory(report) {
  const text = reportText(report);
  if (!text.trim()) return "Incomplete / no issue stated";
  if (/\bshop\s*floor\b/.test(text)) return "Shopfloor application / printing";
  if (/\b(crosschex|timepro|biometric)\b/.test(text)) return "CrossChex / TimePro / biometric";
  if (/\b(seamonkey|e-?mail|address book)\b/.test(text)) return "SeaMonkey / email";
  if (/\b(excel|ms office|microsoft office|office 365)\b/.test(text)) return "Excel / MS Office";
  if (/\b(transfer|copy files|data movement|external drive|flash drive|usb storage)\b/.test(text)) return "File transfer / data movement";
  if (/\b(shared file|file sharing|shared folder|access files)\b/.test(text)) return "File sharing / access";
  if (/\b(layout|formatting|fit to paper|paper size)\b/.test(text) && isPrinter(report)) return "Print layout / formatting";
  if (/\b(old printer|toner|ink|cartridge|printhead|print head|paper jam|not powering|maintenance|dirty print)\b/.test(text)) return "Printer hardware / maintenance";
  if (isPrinter(report)) return "Printer connectivity / driver / host";
  if (/\b(internet|wi-?fi|lan|network|terminal|connectivity|no connection|cannot connect|can't connect)\b/.test(text)) return "Network / internet / terminal connectivity";
  if (/\b(telephone|phone cord)\b/.test(text)) return "Telephone";
  if (/\bdirec\w*\b/.test(text)) return "Direc exception (unspecified)";
  if (/\b(sap|terminal application)\b/.test(text)) return "SAP / terminal application";
  if (/\b(clean|cleaning|dust|dirty workstation)\b/.test(text)) return "Workstation cleaning";
  if (/\b(charger|power adapter|extension cord)\b/.test(text)) return "Laptop power accessory";
  return "Other / general support";
}

function classificationFlags(report) {
  const text = reportText(report);
  return {
    physical: /\b(cable|cabling|disconnect|disconnected|reconnect|reconnected|unplug|replug|plugged|connector|cord|wire|wiring|loose|physical connection|hardware connection)\b/.test(text),
    configuration: /\b(config|configuration|configure|configured|setting|setup|driver|install|installation|mapping|permission|account|ip address|network setting|layout|format|password|credential|activate|deactivate|resetter)\b/.test(text),
    direc: /\bdirec\w*\b/.test(text)
  };
}

function rankedGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item).trim() || "Not specified";
    const normalized = key.toLowerCase();
    if (!groups.has(normalized)) groups.set(normalized, { label: key, items: [] });
    groups.get(normalized).items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
}

function uniqueList(values) {
  return [...new Set(values.map(value => String(value || "Not specified").trim()).filter(Boolean))].join(", ");
}

const COLORS = { navy: "17365D", blue: "D9EAF7", gold: "F4B183", pale: "FFF2CC", white: "FFFFFF", line: "A6A6A6" };
const border = { top: { style: "thin", color: { rgb: COLORS.line } }, bottom: { style: "thin", color: { rgb: COLORS.line } }, left: { style: "thin", color: { rgb: COLORS.line } }, right: { style: "thin", color: { rgb: COLORS.line } } };

function applyCellStyle(sheet, range, style) {
  for (let row = range.s.r; row <= range.e.r; row += 1) for (let col = range.s.c; col <= range.e.c; col += 1) {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    if (!sheet[address]) sheet[address] = { t: "s", v: "" };
    sheet[address].s = style;
  }
}

function formatAnalysisSheet(sheet, titleEndCol, headerRows = []) {
  applyCellStyle(sheet, { s: { r: 0, c: 0 }, e: { r: 0, c: titleEndCol } }, { fill: { fgColor: { rgb: COLORS.navy } }, font: { color: { rgb: COLORS.white }, bold: true, sz: 16 }, alignment: { horizontal: "center", vertical: "center" } });
  headerRows.forEach(row => applyCellStyle(sheet, { s: { r: row, c: 0 }, e: { r: row, c: titleEndCol } }, { fill: { fgColor: { rgb: COLORS.blue } }, font: { bold: true, color: { rgb: COLORS.navy } }, alignment: { vertical: "center", wrapText: true }, border }));
  sheet["!rows"] = [{ hpt: 27 }];
}

function monthKey(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateTime(value) {
  if (!value) return "";
  const cleaned = value.trim().replace(/\s*[-,]\s*(?=\d{1,2}:)/, " ");
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return "";
  let [, month, day, year, hour, minute, meridiem] = match;
  year = year.length === 2 ? `20${year}` : year;
  hour = Number(hour);
  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;
  const parts = [year, month.padStart(2, "0"), day.padStart(2, "0")];
  const normalized = `${parts.join("-")}T${String(hour).padStart(2, "0")}:${minute}`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : normalized;
}

function parseReportText(text) {
  const record = Object.fromEntries(fields.map(field => [field, ""]));
  let activeField = "";
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const match = line.match(/^\s*([^:]+):\s*(.*)$/);
    const key = match ? labelMap[match[1].trim().toLowerCase()] : "";
    if (key) {
      activeField = key;
      record[key] = match[2].trim();
    } else if (activeField && line.trim()) {
      record[activeField] += `${record[activeField] ? "\n" : ""}${line.trim()}`;
    }
  }
  const rawReportedAt = record.reportedAt;
  const rawResolvedAt = record.resolvedAt;
  record.reportedAt = parseDateTime(rawReportedAt);
  record.resolvedAt = parseDateTime(rawResolvedAt);
  return { record, rawReportedAt, rawResolvedAt };
}

function validateParsed(parsed) {
  if (parsed.rawReportedAt && !parsed.record.reportedAt) return "The reported date/time format was not recognized.";
  if (parsed.rawResolvedAt && !parsed.record.resolvedAt) return "The resolved date/time format was not recognized.";
  if (parsed.record.reportedAt && parsed.record.resolvedAt && new Date(parsed.record.resolvedAt) < new Date(parsed.record.reportedAt)) return "Resolved time cannot be earlier than reported time.";
  return "";
}

function ensureStatusOption(status) {
  const select = document.querySelector("#status");
  if (![...select.options].some(option => option.value.toLowerCase() === status.toLowerCase())) {
    select.add(new Option(status, status));
  }
}

function compilePastedText() {
  pasteMessage.classList.remove("paste-success");
  if (!pasteInput.value.trim()) {
    pasteMessage.textContent = "Paste an ITSRR report first.";
    return false;
  }
  const parsed = parseReportText(pasteInput.value);
  const error = validateParsed(parsed);
  if (error) {
    pasteMessage.textContent = `${error} You can review it in the form.`;
    return false;
  }
  const duplicate = parsed.record.itsrrNumber && reports.some(item => item.itsrrNumber.toLowerCase() === parsed.record.itsrrNumber.toLowerCase());
  if (duplicate) {
    pasteMessage.textContent = `ITSRR ${parsed.record.itsrrNumber} already exists.`;
    return false;
  }
  parsed.record.department = departmentFor(parsed.record);
  reports.unshift({ id: crypto.randomUUID(), ...parsed.record });
  persist();
  render();
  pasteInput.value = "";
  pasteMessage.textContent = `${parsed.record.itsrrNumber || "Report"} compiled successfully.`;
  pasteMessage.classList.add("paste-success");
  notify("Pasted report compiled");
  return true;
}

function loadPasteIntoForm() {
  const parsed = parseReportText(pasteInput.value);
  if (!pasteInput.value.trim()) {
    pasteMessage.textContent = "Paste an ITSRR report first.";
    return;
  }
  if (parsed.record.status) ensureStatusOption(parsed.record.status);
  fields.forEach(field => document.querySelector(`#${field}`).value = parsed.record[field] ?? "");
  pasteMessage.textContent = "Pasted values loaded below for review.";
  pasteMessage.classList.add("paste-success");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  updateStatusFilter();
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const shown = reports.filter(report => {
    const matchesSearch = fields.some(field => String(report[field] ?? "").toLowerCase().includes(query));
    const matchesStatus = selectedStatus === "all"
      || (selectedStatus === "pending" && isPendingStatus(report.status))
      || (selectedStatus.startsWith("status:") && String(report.status || "").trim().toLowerCase() === selectedStatus.slice(7));
    return matchesSearch && matchesStatus;
  });
  document.querySelector("#recordCount").textContent = reports.length;
  const pendingCount = reports.filter(report => isPendingStatus(report.status)).length;
  document.querySelector("#filterSummary").textContent = selectedStatus === "pending"
    ? `Showing ${shown.length} pending ticket${shown.length === 1 ? "" : "s"}`
    : selectedStatus.startsWith("status:")
      ? `Showing ${shown.length} ticket${shown.length === 1 ? "" : "s"} with status “${statusFilter.selectedOptions[0]?.text || selectedStatus.slice(7)}”`
      : `Showing all tickets · ${pendingCount} pending`;
  document.querySelector("#emptyState").hidden = reports.length > 0;
  document.querySelector("#tableWrap").hidden = reports.length === 0;
  body.innerHTML = shown.map(report => `
    <tr>
      <td><strong>${escapeHtml(report.itsrrNumber)}</strong></td>
      <td>${escapeHtml(report.terminalUser)}</td>
      <td>${escapeHtml(displayDate(report.reportedAt))}</td>
      <td class="truncate" title="${escapeHtml(report.problem)}">${escapeHtml(report.problem)}</td>
      <td><span class="badge badge-${escapeHtml(report.status.toLowerCase().replaceAll(" ", "-"))}">${escapeHtml(report.status)}</span></td>
      <td>
        <button class="row-action" data-action="edit" data-id="${report.id}">Edit</button>
        <button class="row-action delete" data-action="delete" data-id="${report.id}">Delete</button>
      </td>
    </tr>`).join("");
  if (reports.length && !shown.length) body.innerHTML = '<tr><td colspan="6">No records match your search.</td></tr>';
  renderArchives();
}

function resetForm() {
  form.reset();
  editId.value = "";
  document.querySelector("#status").value = "";
  document.querySelector("#formTitle").textContent = "Report details";
  document.querySelector("#saveBtn").textContent = "Add report";
  document.querySelector("#formMessage").textContent = "";
}

function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const record = Object.fromEntries(fields.map(field => [field, document.querySelector(`#${field}`).value.trim()]));
  record.department = departmentFor(record);
  if (record.reportedAt && record.resolvedAt && new Date(record.resolvedAt) < new Date(record.reportedAt)) {
    document.querySelector("#formMessage").textContent = "Resolved time cannot be earlier than reported time.";
    return;
  }
  if (editId.value) {
    reports = reports.map(item => item.id === editId.value ? { ...item, ...record } : item);
    notify("Report updated");
  } else {
    reports.unshift({ id: crypto.randomUUID(), ...record });
    notify("Report added");
  }
  persist();
  resetForm();
  render();
});

body.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const report = reports.find(item => item.id === button.dataset.id);
  if (button.dataset.action === "edit" && report) {
    fields.forEach(field => document.querySelector(`#${field}`).value = report[field] ?? "");
    editId.value = report.id;
    document.querySelector("#formTitle").textContent = "Edit report";
    document.querySelector("#saveBtn").textContent = "Save changes";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (button.dataset.action === "delete" && report && confirm(`Delete ${report.itsrrNumber}?`)) {
    reports = reports.filter(item => item.id !== report.id);
    persist();
    render();
    notify("Report deleted");
  }
});

document.querySelector("#clearBtn").addEventListener("click", resetForm);
document.querySelector("#archiveBtn").addEventListener("click", archiveFinishedReports);
document.querySelector("#archiveList").addEventListener("click", event => {
  const button = event.target.closest("button[data-restore-archive]");
  if (!button) return;
  const archive = archives.find(item => item.id === button.dataset.restoreArchive);
  if (!archive || !confirm(`Restore all ${archive.reports.length} tickets from ${archive.label} to the active list?`)) return;
  const activeIds = new Set(reports.map(report => report.id));
  reports = [...archive.reports.filter(report => !activeIds.has(report.id)), ...reports];
  archives = archives.filter(item => item.id !== archive.id);
  persist();
  render();
  notify(`${archive.label} restored`);
});
searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
document.querySelector("#compilePasteBtn").addEventListener("click", compilePastedText);
document.querySelector("#loadFormBtn").addEventListener("click", loadPasteIntoForm);
pasteInput.addEventListener("paste", () => {
  pasteMessage.textContent = "Reading pasted report...";
  setTimeout(compilePastedText, 0);
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  if (!reports.length) {
    notify("Add at least one report before exporting");
    return;
  }
  if (typeof XLSX === "undefined") {
    notify("Excel library is missing. Run npm install first.");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const now = new Date();
  const currentKey = monthKey(now);
  const availableKeys = reports.map(report => monthKey(report.reportedAt)).filter(Boolean).sort();
  const selectedKey = availableKeys.includes(currentKey) ? currentKey : (availableKeys.at(-1) || currentKey);
  const analyzed = reports.filter(report => !monthKey(report.reportedAt) || monthKey(report.reportedAt) === selectedKey);
  const datedInPeriod = analyzed.filter(report => monthKey(report.reportedAt) === selectedKey);
  const [year, month] = selectedKey.split("-").map(Number);
  const periodDate = new Date(year, month - 1, 1);
  const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(periodDate);

  const source = [
    ["Licton Industrial Corp."],
    ["DAILY IT SERVICE REQUEST AND RECORD"],
    [], [],
    ["No.", "Department", "ITSRR #", "User Number", "Reported By", "Date and Time Reported", "Date and Time Resolved", "Problem", "Cause", "Solution", "Status"],
    ...analyzed.map((report, index) => [index + 1, departmentFor(report), report.itsrrNumber, report.terminalUser, report.reportedBy, excelDate(report.reportedAt), excelDate(report.resolvedAt), report.problem, report.cause, report.solution, report.status])
  ];
  const sourceSheet = XLSX.utils.aoa_to_sheet(source, { cellDates: true });
  sourceSheet["!merges"] = [XLSX.utils.decode_range("A1:K1"), XLSX.utils.decode_range("A2:K2")];
  sourceSheet["!cols"] = [{ wch: 7 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 42 }, { wch: 42 }, { wch: 48 }, { wch: 14 }];
  sourceSheet["!autofilter"] = { ref: `A5:K${Math.max(5, source.length)}` };
  sourceSheet["!rows"] = [{ hpt: 25 }, { hpt: 25 }, {}, {}, { hpt: 34 }];
  applyCellStyle(sourceSheet, XLSX.utils.decode_range("A1:K1"), { font: { bold: true, sz: 15, color: { rgb: COLORS.navy } }, alignment: { horizontal: "center" } });
  applyCellStyle(sourceSheet, XLSX.utils.decode_range("A2:K2"), { fill: { fgColor: { rgb: COLORS.navy } }, font: { bold: true, sz: 16, color: { rgb: COLORS.white } }, alignment: { horizontal: "center" } });
  applyCellStyle(sourceSheet, XLSX.utils.decode_range("A5:K5"), { fill: { fgColor: { rgb: COLORS.blue } }, font: { bold: true, color: { rgb: COLORS.navy } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border });
  if (source.length > 5) applyCellStyle(sourceSheet, XLSX.utils.decode_range(`A6:K${source.length}`), { alignment: { vertical: "top", wrapText: true }, border });
  XLSX.utils.book_append_sheet(workbook, sourceSheet, "Sheet1");

  const users = rankedGroups(analyzed, report => report.reportedBy);
  const issues = rankedGroups(analyzed, report => broadIssueCategory(report));
  const ticketGroups = rankedGroups(analyzed.filter(report => report.itsrrNumber.trim()), report => report.itsrrNumber);
  const duplicates = ticketGroups.filter(group => group.items.length > 1);
  const physicalCount = analyzed.filter(report => classificationFlags(report).physical).length;
  const configurationCount = analyzed.filter(report => classificationFlags(report).configuration).length;
  const direcCount = analyzed.filter(report => classificationFlags(report).direc).length;
  const summary = [
    [`${monthName} ITSRR Analysis`], [],
    ["Metric", "Count", "", "Data-quality note", "Value", "Details"],
    ["Logged ITSRR entries", datedInPeriod.length, "", "Month analyzed", monthName, `${analyzed.length - datedInPeriod.length} undated record(s) are retained and included in rankings.`],
    ["Unique normalized ITSRR numbers", ticketGroups.length, "", "Blank issue descriptions", analyzed.filter(report => !report.problem.trim() && !report.cause.trim()).length, "Problem and Cause are both blank."],
    ["Duplicate/reused ITSRR numbers", duplicates.length, "", "Duplicate/reused IDs", duplicates.length, duplicates.map(group => group.label).join(", ") || "None"],
    ["Physical connection issues", physicalCount],
    ["Configuration issues (strict)", configurationCount],
    ["Direc-support entries", direcCount], [],
    ["Requester", "User/Workstation ID(s)", "Requests", "", "Issue category", "Count"],
    ...Array.from({ length: Math.max(10, Math.min(users.length, issues.length)) }, (_, index) => [
      users[index]?.label || "", users[index] ? uniqueList(users[index].items.map(report => report.terminalUser)) : "", users[index]?.items.length || "", "",
      issues[index]?.label || "", issues[index]?.items.length || ""
    ]), [], [],
    ["Methodology: Requester names and IDs are consolidated case-insensitively. Printer incidents use explicit printer/print/xerox/Epson/Zebra/toner/ink/spooler wording. Shopfloor counts use only entries explicitly mentioning Shopfloor. Departments are entered manually or inferred from known ITSRR prefixes."]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!merges"] = [XLSX.utils.decode_range("A1:H1"), XLSX.utils.decode_range(`A${summary.length}:H${summary.length}`)];
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 27 }, { wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 24 }, { wch: 18 }, { wch: 18 }];
  formatAnalysisSheet(summarySheet, 7, [2, 10]);
  applyCellStyle(summarySheet, XLSX.utils.decode_range(`A${summary.length}:H${summary.length}`), { fill: { fgColor: { rgb: COLORS.pale } }, font: { italic: true }, alignment: { wrapText: true, vertical: "top" }, border });
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Analysis Summary");

  const userData = [["Requester Frequency Ranking"], [], ["Rank", "Requester", "User/Workstation ID(s)", "Number of Requests"], ...users.map((group, index) => [index + 1, group.label, uniqueList(group.items.map(report => report.terminalUser)), group.items.length])];
  const userSheet = XLSX.utils.aoa_to_sheet(userData);
  userSheet["!merges"] = [XLSX.utils.decode_range("A1:D1")];
  userSheet["!cols"] = [{ wch: 8 }, { wch: 27 }, { wch: 30 }, { wch: 19 }];
  userSheet["!autofilter"] = { ref: `A3:D${Math.max(3, userData.length)}` };
  formatAnalysisSheet(userSheet, 3, [2]);
  XLSX.utils.book_append_sheet(workbook, userSheet, "User Ranking");

  const generalGroups = rankedGroups(analyzed.filter(report => !isPrinter(report) && !isShopfloor(report)), report => report.terminalUser);
  const printerGroups = rankedGroups(analyzed.filter(isPrinter), report => departmentFor(report));
  const shopfloorAssets = [];
  analyzed.filter(isShopfloor).forEach(report => {
    const ids = uniqueList((`${report.terminalUser} ${reportText(report)}`.match(/\bLIC\d+\b/gi) || [report.terminalUser])).split(", ");
    ids.forEach(id => shopfloorAssets.push({ ...report, assetId: id }));
  });
  const shopfloorGroups = rankedGroups(shopfloorAssets, report => report.assetId);
  const assetData = [["Asset Support Frequency Ranking"], [], ["General Workstations (printer/shopfloor tickets excluded)"], ["Rank", "Workstation ID", "Requests", "Associated User(s)", "Department(s)"],
    ...generalGroups.map((group, index) => [index + 1, group.label, group.items.length, uniqueList(group.items.map(report => report.reportedBy)), uniqueList(group.items.map(departmentFor))]),
    [], [], ["Printers — ranked by department/location"], ["Rank", "Location/Department", "Printer Incidents", "Associated LIC ID(s)", "Issue descriptions"],
    ...printerGroups.map((group, index) => [index + 1, group.label, group.items.length, uniqueList(group.items.map(report => report.terminalUser)), group.items.map(report => report.problem || report.cause).filter(Boolean).join("; ")]),
    [], [], ["Shopfloor PCs — explicit Shopfloor entries only"], ["Rank", "Workstation ID", "Incidents", "Location/User", "Notes"],
    ...shopfloorGroups.map((group, index) => [index + 1, group.label, group.items.length, uniqueList(group.items.map(report => `${departmentFor(report)} / ${report.reportedBy}`)), group.items.map(report => report.problem || report.cause).filter(Boolean).join("; ")])
  ];
  const assetSheet = XLSX.utils.aoa_to_sheet(assetData);
  const sectionRows = assetData.map((row, index) => row.length === 1 && index > 0 ? index : -1).filter(index => index >= 0);
  assetSheet["!merges"] = [XLSX.utils.decode_range("A1:E1"), ...sectionRows.map(row => ({ s: { r: row, c: 0 }, e: { r: row, c: 4 } }))];
  assetSheet["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 32 }, { wch: 70 }];
  formatAnalysisSheet(assetSheet, 4, [3, generalGroups.length + 7, generalGroups.length + printerGroups.length + 11]);
  sectionRows.forEach(row => applyCellStyle(assetSheet, { s: { r: row, c: 0 }, e: { r: row, c: 4 } }, { fill: { fgColor: { rgb: COLORS.pale } }, font: { bold: true, color: { rgb: COLORS.navy } }, alignment: { horizontal: "left" }, border }));
  XLSX.utils.book_append_sheet(workbook, assetSheet, "Asset Ranking");

  const issueData = [["Issue Frequency Summary"], [], ["Rank", "Normalized Issue Category", "Frequency", "Examples from the Log"], ...issues.map((group, index) => [index + 1, group.label, group.items.length, group.items.slice(0, 3).map(report => report.problem || report.cause || "(blank)").join(" | ")]), [], ["These categories are normalized from the free-text Problem, Cause, and Solution fields."]];
  const issueSheet = XLSX.utils.aoa_to_sheet(issueData);
  issueSheet["!merges"] = [XLSX.utils.decode_range("A1:D1"), XLSX.utils.decode_range(`A${issueData.length}:D${issueData.length}`)];
  issueSheet["!cols"] = [{ wch: 8 }, { wch: 44 }, { wch: 12 }, { wch: 85 }];
  formatAnalysisSheet(issueSheet, 3, [2]);
  XLSX.utils.book_append_sheet(workbook, issueSheet, "Issue Summary");

  const classificationData = [["Row-Level Classification and Audit Trail"], [], ["Source Row", "ITSRR #", "Department", "User ID", "Reported By", "Problem", "Cause", "Solution", "Broad Issue Category", "Physical Connection", "Configuration", "Direc Support"], ...analyzed.map((report, index) => {
    const flags = classificationFlags(report);
    return [index + 6, report.itsrrNumber, departmentFor(report), report.terminalUser, report.reportedBy, report.problem, report.cause, report.solution, broadIssueCategory(report), flags.physical ? "Yes" : "No", flags.configuration ? "Yes" : "No", flags.direc ? "Yes" : "No"];
  })];
  const classificationSheet = XLSX.utils.aoa_to_sheet(classificationData);
  classificationSheet["!merges"] = [XLSX.utils.decode_range("A1:L1")];
  classificationSheet["!cols"] = [{ wch: 11 }, { wch: 18 }, { wch: 23 }, { wch: 18 }, { wch: 23 }, { wch: 45 }, { wch: 45 }, { wch: 50 }, { wch: 39 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
  classificationSheet["!autofilter"] = { ref: `A3:L${Math.max(3, classificationData.length)}` };
  formatAnalysisSheet(classificationSheet, 11, [2]);
  XLSX.utils.book_append_sheet(workbook, classificationSheet, "Classification");

  const safeMonth = new Intl.DateTimeFormat("en", { month: "long" }).format(periodDate);
  XLSX.writeFile(workbook, `ITSRR_${safeMonth}_${year}_Analysis.xlsx`, { compression: true, cellStyles: true });
  notify("Excel workbook exported");
});

render();
