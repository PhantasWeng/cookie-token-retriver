"use strict";

const STORAGE_KEY = "targetCookieNames";

const groupsEl = document.getElementById("groups");
const statusEl = document.getElementById("status");
const statusIoEl = document.getElementById("status-io");
const importFileEl = document.getElementById("import-file");
const langEl = document.getElementById("lang");

// 垃圾桶 icon（吃 currentColor）。
const TRASH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

init();

async function init() {
  await loadUiLang();
  applyStatic(document);
  langEl.value = CURRENT_LANG;

  chrome.storage.sync.get({ [STORAGE_KEY]: {} }, (res) => {
    renderGroups(normalizeGroups(res[STORAGE_KEY]));
  });

  // 切換語言：存起來、套用靜態文字、重繪動態卡片。
  langEl.addEventListener("change", () => {
    const lang = langEl.value;
    chrome.storage.sync.set({ [UI_LANG_KEY]: lang });
    setCurrentLang(lang);
    applyStatic(document);
    renderGroups(collectGroups());
  });
}

// 驗證並正規化成 { 網域: [{ name, cookie }] }；無效項目略過，同 cookie 去重。
function normalizeGroups(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [domain, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) continue;
    const byCookie = new Map(); // key = cookie 小寫
    for (const e of entries) {
      if (!e || typeof e !== "object" || typeof e.cookie !== "string") continue;
      const cookie = e.cookie.trim();
      if (!cookie) continue;
      const name = typeof e.name === "string" ? e.name.trim() : "";
      const loginUrl = typeof e.loginUrl === "string" ? e.loginUrl.trim() : "";
      const key = cookie.toLowerCase();
      if (!byCookie.has(key)) byCookie.set(key, { name, cookie, loginUrl });
      else {
        const cur = byCookie.get(key);
        if (!cur.name && name) cur.name = name;
        if (!cur.loginUrl && loginUrl) cur.loginUrl = loginUrl;
      }
    }
    if (byCookie.size) out[domain] = [...byCookie.values()];
  }
  return out;
}

// 網域正規化：保留 "*"，其餘去掉 scheme / path / port 並轉小寫。
function normalizeDomain(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (!s || s === "*") return s;
  return s
    .replace(/^https?:\/\//, "")
    .replace(/^\/+/, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
}

// 合併兩份規則陣列：同 cookie 聯集，若一邊沒名稱另一邊有則補上。
function mergeRules(a, b) {
  const byCookie = new Map();
  for (const r of [...a, ...b]) {
    const key = r.cookie.toLowerCase();
    if (!byCookie.has(key)) {
      byCookie.set(key, { name: r.name || "", cookie: r.cookie, loginUrl: r.loginUrl || "" });
    } else {
      const cur = byCookie.get(key);
      if (!cur.name && r.name) cur.name = r.name;
      if (!cur.loginUrl && r.loginUrl) cur.loginUrl = r.loginUrl;
    }
  }
  return [...byCookie.values()];
}

function mergeGroups(a, b) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = mergeRules(a[key] || [], b[key] || []);
  }
  return out;
}

function flashStatus(el, msg, isError) {
  el.textContent = msg;
  el.style.color = isError ? "#dc2626" : "#16a34a";
  setTimeout(() => (el.textContent = ""), isError ? 3500 : 2000);
}

// 一筆規則：三個帶常駐標籤的欄位（Cookie 名稱、顯示名稱、登入網址）。
function makeRuleRow(name, cookie, loginUrl) {
  const row = document.createElement("div");
  row.className = "rule";
  row.innerHTML =
    '<div class="rule-top">' +
    '<div class="field field-cookie"><label></label><input class="rule-cookie" /></div>' +
    '<div class="field field-name"><label></label><input class="rule-name" /></div>' +
    '<button class="rule-del"></button>' +
    "</div>" +
    '<div class="field field-login"><label></label><input class="rule-login" /></div>';

  row.querySelector(".field-cookie label").textContent = t("opt_field_cookie");
  row.querySelector(".field-name label").textContent = t("opt_field_name");
  row.querySelector(".field-login label").textContent = t("opt_field_login");

  const cookieEl = row.querySelector(".rule-cookie");
  const nameEl = row.querySelector(".rule-name");
  const loginEl = row.querySelector(".rule-login");
  const delEl = row.querySelector(".rule-del");
  delEl.innerHTML = TRASH_ICON;
  cookieEl.placeholder = t("opt_cookie_ph");
  nameEl.placeholder = t("opt_name_ph");
  loginEl.placeholder = t("opt_login_ph");
  delEl.title = t("opt_del_row");
  cookieEl.value = cookie || "";
  nameEl.value = name || "";
  loginEl.value = loginUrl || "";
  delEl.addEventListener("click", () => row.remove());
  return row;
}

function makeGroupCard(domain, rules) {
  const card = document.createElement("div");
  card.className = "group";
  card.innerHTML =
    '<div class="group-header">' +
    '<div class="field field-domain"><label></label><input class="group-domain" /></div>' +
    '<button class="group-del"></button>' +
    "</div>" +
    '<div class="group-body">' +
    '<div class="rules"></div>' +
    '<button class="rule-add secondary"></button>' +
    "</div>";

  card.querySelector(".field-domain label").textContent = t("opt_field_domain");
  const domainEl = card.querySelector(".group-domain");
  domainEl.placeholder = t("opt_domain_ph");
  domainEl.value = domain;
  const groupDel = card.querySelector(".group-del");
  groupDel.innerHTML = TRASH_ICON;
  groupDel.title = t("opt_del_group");
  const addBtn = card.querySelector(".rule-add");
  addBtn.textContent = t("opt_add_row");

  const rulesEl = card.querySelector(".rules");
  const list = rules && rules.length ? rules : [{ name: "", cookie: "", loginUrl: "" }];
  for (const r of list) rulesEl.appendChild(makeRuleRow(r.name, r.cookie, r.loginUrl));

  groupDel.addEventListener("click", () => card.remove());
  addBtn.addEventListener("click", () => rulesEl.appendChild(makeRuleRow("", "", "")));
  return card;
}

function renderGroups(groups) {
  groupsEl.innerHTML = "";
  const entries = Object.entries(groups);
  if (entries.length === 0) {
    groupsEl.appendChild(makeGroupCard("", [])); // 至少給一張空白卡起步
    return;
  }
  for (const [domain, rules] of entries) {
    groupsEl.appendChild(makeGroupCard(domain, rules || []));
  }
}

// 從畫面收集成 { 網域: [{ name, cookie }] }，合併同網域、去除空白列、同 cookie 去重。
function collectGroups() {
  const out = {};
  for (const card of groupsEl.querySelectorAll(".group")) {
    const domain = normalizeDomain(card.querySelector(".group-domain").value);
    if (!domain) continue;
    const rules = [];
    for (const row of card.querySelectorAll(".rule")) {
      const cookie = row.querySelector(".rule-cookie").value.trim();
      if (!cookie) continue; // cookie 名稱是必填，名稱與登入網址可留空
      rules.push({
        name: row.querySelector(".rule-name").value.trim(),
        cookie,
        loginUrl: row.querySelector(".rule-login").value.trim(),
      });
    }
    if (!rules.length) continue;
    out[domain] = out[domain] ? mergeRules(out[domain], rules) : mergeRules(rules, []);
  }
  return out;
}

function countRules(groups) {
  return Object.values(groups).reduce((n, arr) => n + arr.length, 0);
}

document.getElementById("add-group").addEventListener("click", () => {
  groupsEl.appendChild(makeGroupCard("", []));
});

document.getElementById("save").addEventListener("click", () => {
  const groups = collectGroups();
  chrome.storage.sync.set({ [STORAGE_KEY]: groups }, () => {
    renderGroups(groups); // 重繪：正規化、合併同網域、清掉空列/空卡
    flashStatus(
      statusEl,
      t("opt_saved", { domains: Object.keys(groups).length, rules: countRules(groups) })
    );
  });
});

// ---- 匯出 / 匯入 ----

// 把 JSON 文字解析成規則物件；接受有包裝的格式或裸物件。
function parseRules(text) {
  const data = JSON.parse(text);
  const raw =
    data && typeof data === "object" && !Array.isArray(data) && "rules" in data
      ? data.rules
      : data;
  const normalized = normalizeGroups(raw); // { 網域: [{name,cookie}] }
  const out = {};
  for (const [domainRaw, rules] of Object.entries(normalized)) {
    const domain = normalizeDomain(domainRaw);
    if (!domain) continue;
    out[domain] = out[domain] ? mergeRules(out[domain], rules) : rules;
  }
  if (!Object.keys(out).length) throw new Error("no valid rules");
  return out;
}

// 本地時間戳記，格式 YYYYMMDD-HHmmss，用於檔名。
function fileTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

document.getElementById("export-rules").addEventListener("click", () => {
  const groups = collectGroups(); // 匯出目前編輯區內容（所見即所得）
  const payload = { type: "cookie-token-retriever-rules", version: 3, rules: groups };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cookie-token-rules-${fileTimestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flashStatus(statusIoEl, t("opt_exported", { domains: Object.keys(groups).length }));
});

document.getElementById("import-rules").addEventListener("click", () => importFileEl.click());

importFileEl.addEventListener("change", async () => {
  const file = importFileEl.files && importFileEl.files[0];
  if (!file) return;
  try {
    const imported = parseRules(await file.text());
    const merged = mergeGroups(collectGroups(), imported); // 合併進目前編輯區
    renderGroups(merged);
    flashStatus(statusIoEl, t("opt_imported", { domains: Object.keys(imported).length }));
  } catch (e) {
    flashStatus(statusIoEl, t("opt_import_err"), true);
  } finally {
    importFileEl.value = ""; // 清空以便可重複選同一檔案
  }
});
