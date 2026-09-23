const KEY = "okh-stock-v1";
const empty = () => ({
  names: {},
  warehouseAdds: [],
  jobs: {},
  returns: [],
  pickups: [],
  log: []
});
let db = load();
let dest = "warehouse";
let scanner = null;
let scanning = false;

function load() {
  try { return Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch (e) { return empty(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.style.display = "none", 2200);
}

function now() { return new Date().toISOString(); }
function nice(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}

function onHand(code) {
  let n = 0;
  db.warehouseAdds.forEach(x => { if (x.code === code) n += x.qty; });
  db.pickups.forEach(x => { if (x.code === code) n += x.qty; });
  Object.values(db.jobs).forEach(job => job.items.forEach(x => { if (x.code === code) n -= x.qty; }));
  db.returns.forEach(x => { if (x.code === code) n -= x.qty; });
  return n;
}
function allCodes() {
  const s = new Set();
  db.warehouseAdds.forEach(x => s.add(x.code));
  db.pickups.forEach(x => s.add(x.code));
  db.returns.forEach(x => s.add(x.code));
  Object.values(db.jobs).forEach(j => j.items.forEach(x => s.add(x.code)));
  return Array.from(s);
}
function label(code) { return db.names[code] ? db.names[code] : ""; }

function showPage(name) {
  ["scan","warehouse","jobs","returns","pickups"].forEach(p => {
    document.getElementById("page-" + p).classList.toggle("hidden", p !== name);
  });
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b.dataset.page === name));
  const titles = {
    scan: "Scan a unit sticker, then pick where it goes",
    warehouse: "Everything you currently hold",
    jobs: "Stock used against a named job",
    returns: "Going back to Okh Energy",
    pickups: "Collected from Okh warehouse"
  };
  document.getElementById("headerSub").textContent = titles[name];
  if (name === "warehouse") renderWarehouse();
  if (name === "jobs") renderJobs();
  if (name === "returns") renderReturns();
  if (name === "pickups") renderPickups();
}

document.querySelectorAll(".nav button").forEach(b => b.onclick = () => showPage(b.dataset.page));

document.querySelectorAll(".dest").forEach(b => b.onclick = () => {
  dest = b.dataset.dest;
  document.querySelectorAll(".dest").forEach(x => x.classList.toggle("on", x === b));
  document.getElementById("jobPick").classList.toggle("hidden", dest !== "job");
  if (dest === "job") renderJobChips();
});

document.getElementById("qtyMinus").onclick = () => {
  const i = document.getElementById("hitQty");
  i.value = Math.max(1, (+i.value || 1) - 1);
};
document.getElementById("qtyPlus").onclick = () => {
  const i = document.getElementById("hitQty");
  i.value = (+i.value || 1) + 1;
};

function renderJobChips() {
  const box = document.getElementById("jobChips");
  const names = Object.keys(db.jobs);
  box.innerHTML = names.length ? names.map(n => "<button type=\"button\" class=\"job-chip\">" + esc(n) + "</button>").join("") : "";
  box.querySelectorAll(".job-chip").forEach(ch => ch.onclick = () => {
    document.getElementById("jobName").value = ch.textContent;
    box.querySelectorAll(".job-chip").forEach(x => x.classList.toggle("on", x === ch));
  });
}

function esc(s) {
  return String(s).replace(/[&<>\"']/g, c => ({ "&":"&", "<":"<", ">":">", "\"":""", "'":"&#39;" }[c]));
}

async function startScan() {
  document.getElementById("cameraBox").classList.remove("hidden");
  document.getElementById("hitBox").classList.add("hidden");
  if (scanning) return;
  scanner = new Html5Qrcode("reader");
  const formats = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.DATA_MATRIX
  ];
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: { width: 280, height: 140 }, formatsToSupport: formats, rememberLastUsedCamera: true },
      onScan,
      function () {}
    );
    scanning = true;
  } catch (e) {
    toast("Camera blocked. Use Safari on iPhone, or Use photo instead.");
  }
}

async function stopScan() {
  if (scanner && scanning) {
    try { await scanner.stop(); } catch (e) {}
    try { scanner.clear(); } catch (e) {}
  }
  scanning = false;
}

function onScan(text) {
  if (!text) return;
  stopScan();
  document.getElementById("cameraBox").classList.add("hidden");
  openHit(String(text).trim());
}

function openHit(code) {
  document.getElementById("hitBox").classList.remove("hidden");
  document.getElementById("hitCode").textContent = code;
  document.getElementById("hitName").value = label(code);
  document.getElementById("hitQty").value = 1;
  document.getElementById("hitNote").value = "";
  renderJobChips();
}

document.getElementById("btnStart").onclick = startScan;
document.getElementById("btnStop").onclick = async () => {
  await stopScan();
  document.getElementById("cameraBox").classList.add("hidden");
};
document.getElementById("btnFile").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    if (!scanner) scanner = new Html5Qrcode("reader");
    const text = await scanner.scanFile(f, true);
    onScan(text);
  } catch (err) {
    toast("Could not read a barcode in that photo. Try again closer.");
  }
  e.target.value = "";
};
document.getElementById("btnRescan").onclick = () => {
  document.getElementById("hitBox").classList.add("hidden");
  startScan();
};

document.getElementById("btnSave").onclick = () => {
  const code = document.getElementById("hitCode").textContent.trim();
  if (!code) return;
  const qty = Math.max(1, parseInt(document.getElementById("hitQty").value, 10) || 1);
  const name = document.getElementById("hitName").value.trim();
  const note = document.getElementById("hitNote").value.trim();
  if (name) db.names[code] = name;
  const rec = { id: Date.now() + "-" + Math.random().toString(16).slice(2), code: code, qty: qty, note: note, at: now() };

  if (dest === "warehouse") {
    db.warehouseAdds.push(rec);
    db.log.push(Object.assign({}, rec, { dest: "warehouse" }));
    toast("Added to warehouse");
  } else if (dest === "pickup") {
    db.pickups.unshift(rec);
    db.log.push(Object.assign({}, rec, { dest: "pickup" }));
    toast("Logged pickup from Okh");
  } else if (dest === "return") {
    db.returns.unshift(rec);
    db.log.push(Object.assign({}, rec, { dest: "return" }));
    toast("Logged return to Okh");
  } else {
    const job = document.getElementById("jobName").value.trim();
    if (!job) { toast("Name the job first"); return; }
    if (!db.jobs[job]) db.jobs[job] = { created: now(), items: [] };
    db.jobs[job].items.unshift(rec);
    db.log.push(Object.assign({}, rec, { dest: "job", job: job }));
    toast("Added to job: " + job);
  }
  save();
  document.getElementById("hitBox").classList.add("hidden");
};

document.getElementById("btnAddJob").onclick = () => {
  const n = document.getElementById("newJob").value.trim();
  if (!n) return;
  if (!db.jobs[n]) db.jobs[n] = { created: now(), items: [] };
  document.getElementById("newJob").value = "";
  save(); renderJobs();
};

document.getElementById("btnUndo").onclick = () => {
  const last = db.log.pop();
  if (!last) { toast("Nothing to undo"); return; }
  const drop = (arr) => {
    const i = arr.findIndex(x => x.id === last.id);
    if (i >= 0) arr.splice(i, 1);
  };
  if (last.dest === "warehouse") drop(db.warehouseAdds);
  if (last.dest === "pickup") drop(db.pickups);
  if (last.dest === "return") drop(db.returns);
  if (last.dest === "job" && db.jobs[last.job]) drop(db.jobs[last.job].items);
  save();
  renderWarehouse(); renderJobs(); renderReturns(); renderPickups();
  toast("Undid last scan");
};

function itemLine(x) {
  const nm = label(x.code);
  return "<div class=\"row\"><div><div class=\"code\" style=\"font-size:14px\">" + esc(x.code) +
    "</div><div class=\"tiny\">" + (nm ? esc(nm) + " · " : "") + nice(x.at) +
    (x.note ? " · " + esc(x.note) : "") + "</div></div><div style=\"font-weight:800\">×" + x.qty + "</div></div>";
}

function renderWarehouse() {
  const q = (document.getElementById("whSearch").value || "").toLowerCase();
  const codes = allCodes().filter(c => {
    const blob = (c + " " + label(c)).toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  }).sort((a,b) => (label(a)||a).localeCompare(label(b)||b));
  const box = document.getElementById("whList");
  if (!codes.length) { box.innerHTML = "<p class='muted'>Nothing scanned yet.</p>"; return; }
  box.innerHTML = codes.map(c => {
    const n = onHand(c);
    const cls = n <= 0 ? "zero" : n <= 2 ? "low" : "";
    return "<div class=\"row\"><div><div style=\"font-weight:800\">" + esc(label(c) || c) +
      "</div><div class=\"tiny\">" + (label(c) ? esc(c) : "") +
      "</div></div><span class=\"badge " + cls + "\">" + n + " on hand</span></div>";
  }).join("");
}
document.getElementById("whSearch").oninput = renderWarehouse;

function renderJobs() {
  const box = document.getElementById("jobsList");
  const names = Object.keys(db.jobs);
  if (!names.length) {
    box.innerHTML = "<div class='card'><p class='muted'>No jobs yet. Scan onto a job, or add a name above.</p></div>";
    return;
  }
  box.innerHTML = names.map(n => {
    const job = db.jobs[n];
    const lines = job.items.map(x => itemLine(x)).join("") || "<p class='muted'>No items yet.</p>";
    return "<div class=\"card\"><h2>" + esc(n) + "</h2><div class=\"tiny\">Started " + nice(job.created) + "</div>" + lines + "</div>";
  }).join("");
}
function renderReturns() {
  const box = document.getElementById("retList");
  box.innerHTML = db.returns.length ? db.returns.map(x => itemLine(x)).join("") : "<p class='muted'>No returns logged.</p>";
}
function renderPickups() {
  const box = document.getElementById("pickList");
  box.innerHTML = db.pickups.length ? db.pickups.map(x => itemLine(x)).join("") : "<p class='muted'>No pickups logged.</p>";
}

document.getElementById("btnExport").onclick = () => {
  const rows = [["Tab","Job","Barcode","Name","Qty","Note","When"]];
  db.warehouseAdds.forEach(x => rows.push(["Warehouse","",x.code,label(x.code),x.qty,x.note,x.at]));
  db.pickups.forEach(x => rows.push(["Pickup from Okh","",x.code,label(x.code),x.qty,x.note,x.at]));
  db.returns.forEach(x => rows.push(["Return to Okh","",x.code,label(x.code),x.qty,x.note,x.at]));
  Object.keys(db.jobs).forEach(job => {
    db.jobs[job].items.forEach(x => rows.push(["Job",job,x.code,label(x.code),x.qty,x.note,x.at]));
  });
  const csv = rows.map(r => r.map(v => "\"" + String(v||"").replace(/\"/g,'\"\"') + "\"").join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "okh-stock.csv";
  a.click();
};

showPage("scan");
