"use strict";

// 追蹤規則存在 chrome.storage.sync，格式為 { 網域: [cookie 名稱...] }。
const STORAGE_KEY = "targetCookieNames";

const els = {
  host: document.getElementById("host"),
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  optionsBtn: document.getElementById("options-btn"),
  toast: document.getElementById("toast"),
  template: document.getElementById("cookie-item"),
};

// 內嵌 SVG 圖示（吃 currentColor，隨主題/狀態變色）。
const STAR_POINTS = "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";
const ICON_STAR_OUTLINE =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="${STAR_POINTS}"/></svg>`;
const ICON_STAR_FILLED =
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="${STAR_POINTS}"/></svg>`;

let allCookies = [];
// 追蹤清單依網域分組：{ "example.com": ["token", ...], "*": [...全站通用...] }
let targetGroups = {};
let applicableNames = new Set(); // 目前 host 適用的追蹤名稱（小寫），每次 render 前更新
// 監看清單：依規則各自抓到的 cookie，[{ domain, name, cookie|null }]
let watchItems = [];
let currentHost = "";
let usedFallback = false; // 這次結果是否含父網域 cookie
let watchOpen = true; // 「追蹤中」預設展開（主要內容）
let browseOpen = false; // 「全部 cookie」收合列預設收起（次要功能）

init();

async function init() {
  await loadUiLang();
  applyStatic(document);

  els.optionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  els.search.addEventListener("input", render);

  targetGroups = await loadTargets();

  // 追蹤清單（依 options 規則）先載入並顯示，不論目前在哪個分頁。
  await refreshWatchlist();

  // 下方瀏覽區固定＝目前分頁的網址。
  const tabHost = await getActiveTabHost();
  await queryDomain(tabHost);
}

// 常見的多標籤公共後綴，避免降級時查到過廣的網域（例如把 .com.tw 當成可註冊網域）。
const MULTI_LABEL_SUFFIXES = new Set([
  "com.tw", "com.cn", "com.hk", "com.sg", "com.au", "com.br", "com.mx",
  "co.uk", "co.jp", "co.kr", "co.nz", "co.in", "co.za", "org.uk", "gov.uk",
  "ne.jp", "or.jp", "net.tw", "org.tw", "gov.tw",
]);

// 把使用者輸入正規化成主機名（接受純網域或完整網址）。
function parseHost(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  // 容錯：使用者可能貼了 "example.com/path"、"example.com:8080" 或前綴斜線
  return s.replace(/^\/+/, "").split(/[/?#]/)[0].replace(/:\d+$/, "").toLowerCase();
}

function isIpHost(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

// 降級用的候選網域：host 本身 + 各層父網域（至少 2 個標籤），濾掉公共後綴。
// 例：app.example.com → ["app.example.com", "example.com"]
function candidateDomains(host) {
  if (!host || isIpHost(host) || !host.includes(".")) return host ? [host] : [];
  const parts = host.split(".").filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 <= parts.length; i++) {
    const d = parts.slice(i).join(".");
    if (!MULTI_LABEL_SUFFIXES.has(d)) out.push(d);
  }
  return out.length ? out : [host];
}

// 瀏覽器真正的 domain-match 規則：這顆 cookie 是否會被送到 host？
function cookieAppliesToHost(cookie, host) {
  const cd = cookie.domain.replace(/^\./, "").toLowerCase();
  if (cookie.hostOnly) return host === cd; // hostOnly：只有完全相同才算
  return host === cd || host.endsWith("." + cd); // domain cookie：自己與所有子網域
}

function getAllByDomain(domain) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, (cookies) => resolve(cookies || []));
  });
}

// 讀取目前分頁網域的 cookie（raw 為 active tab 的 host）。
async function queryDomain(raw) {
  const host = parseHost(raw);
  currentHost = host;
  if (!host) {
    allCookies = [];
    usedFallback = false;
    render();
    return;
  }
  els.host.title = host;
  const result = await getCookies(host);
  allCookies = result.cookies.sort((a, b) => a.name.localeCompare(b.name));
  usedFallback = result.usedFallback;
  render();
}

// 沿網域往上降級查詢，合併去重，並用 domain-match 過濾成「會送到 host」的 cookie。
async function getCookies(host) {
  const domains = candidateDomains(host);
  const batches = await Promise.all(domains.map(getAllByDomain));

  const seen = new Map(); // key = name\ndomain\npath
  let fallback = false;
  for (const batch of batches) {
    for (const c of batch) {
      if (!cookieAppliesToHost(c, host)) continue;
      const key = `${c.name}\n${c.domain}\n${c.path}`;
      if (seen.has(key)) continue;
      seen.set(key, c);
      if (c.domain.replace(/^\./, "").toLowerCase() !== host) fallback = true;
    }
  }
  return { cookies: [...seen.values()], usedFallback: fallback };
}

function getActiveTabHost() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.url && /^https?:/.test(tab.url)) {
        try {
          resolve(new URL(tab.url).hostname);
          return;
        } catch {
          /* fallthrough */
        }
      }
      resolve("");
    });
  });
}

function loadTargets() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: {} }, (res) => {
      resolve(normalizeGroups(res[STORAGE_KEY]));
    });
  });
}

// 驗證並正規化成 { 網域: [{ name, cookie }] }；無效項目略過，同 cookie 去重。
function normalizeGroups(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [domain, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) continue;
    const byCookie = new Map(); // key = cookie 小寫，同 cookie 只留一筆
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

function saveTargets() {
  chrome.storage.sync.set({ [STORAGE_KEY]: targetGroups });
}

// 追蹤群組的網域是否適用於目前 host：* 一律適用；否則須等於 host 或為其父網域。
function groupMatchesHost(groupDomain, host) {
  if (groupDomain === "*") return true;
  return host === groupDomain || host.endsWith("." + groupDomain);
}

// 依 currentHost 算出適用的追蹤 cookie 名稱（小寫）。
function computeApplicableNames() {
  const set = new Set();
  for (const [domain, rules] of Object.entries(targetGroups)) {
    if (!groupMatchesHost(domain, currentHost)) continue;
    for (const r of rules) set.add(r.cookie.toLowerCase());
  }
  applicableNames = set;
}

function isTarget(cookie) {
  return applicableNames.has(cookie.name.toLowerCase());
}

async function toggleTarget(cookie) {
  const nameLower = cookie.name.toLowerCase();
  if (isTarget(cookie)) {
    // 取消追蹤：從所有「會讓它變 ★」的群組移除，確保點一下就真的消失。
    for (const [domain, rules] of Object.entries(targetGroups)) {
      if (!groupMatchesHost(domain, currentHost)) continue;
      const kept = rules.filter((r) => r.cookie.toLowerCase() !== nameLower);
      if (kept.length) targetGroups[domain] = kept;
      else delete targetGroups[domain];
    }
  } else {
    // 加入追蹤：歸到目前查詢的網域（沒有 host 時退回全站 "*"）。名稱留空，可到設定頁命名。
    const key = currentHost || "*";
    if (!targetGroups[key]) targetGroups[key] = [];
    if (!targetGroups[key].some((r) => r.cookie.toLowerCase() === nameLower)) {
      targetGroups[key].push({ name: "", cookie: cookie.name, loginUrl: "" });
    }
  }
  saveTargets();
  await refreshWatchlist();
}

// 從某條規則移除一個 cookie（追蹤清單上的「移除規則」點擊）。
async function removeRule(domain, cookieName) {
  const rules = targetGroups[domain] || [];
  const kept = rules.filter((r) => r.cookie.toLowerCase() !== cookieName.toLowerCase());
  if (kept.length) targetGroups[domain] = kept;
  else delete targetGroups[domain];
  saveTargets();
  await refreshWatchlist();
}

// 依 options 規則載入監看清單：每個網域各自抓 cookie，對應規則指定的 cookie 名稱。
async function loadWatchlist() {
  const domains = Object.keys(targetGroups).filter((d) => d !== "*");
  const perDomain = await Promise.all(
    domains.map(async (domain) => {
      const { cookies } = await getCookies(domain);
      const byName = new Map();
      for (const c of cookies) {
        const k = c.name.toLowerCase();
        if (!byName.has(k)) byName.set(k, c); // 同名多筆取第一筆
      }
      return targetGroups[domain].map((r) => ({
        domain,
        label: r.name || r.cookie, // 顯示用：優先自訂名稱
        cookieName: r.cookie,
        loginUrl: r.loginUrl || "",
        cookie: byName.get(r.cookie.toLowerCase()) || null,
      }));
    })
  );
  watchItems = perDomain.flat();
}

async function refreshWatchlist() {
  await loadWatchlist();
  render();
}

function matchesQuery(cookie, q) {
  if (!q) return true;
  return (
    cookie.name.toLowerCase().includes(q) ||
    (cookie.value || "").toLowerCase().includes(q)
  );
}

function render() {
  computeApplicableNames();
  const q = els.search.value.trim().toLowerCase();

  // 頂端只顯示目前分頁網域，數量交給下方「全部 cookie」收合列。
  els.host.textContent = currentHost || t("popup_not_webpage");

  els.list.innerHTML = "";
  renderWatchlist(q);
  renderBrowse(q);
}

// 可收折的區塊標題（▸/▾ + 標籤 + 數量），追蹤區與瀏覽區共用。
function makeSectionToggle(open, label, count, onClick, extraClass) {
  const btn = document.createElement("button");
  btn.className = "section-toggle" + (extraClass ? " " + extraClass : "");
  const tw = document.createElement("span");
  tw.className = "tw";
  tw.textContent = open ? "▾" : "▸";
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = label;
  const cnt = document.createElement("span");
  cnt.className = "cnt";
  cnt.textContent = String(count);
  btn.append(tw, lbl, cnt);
  btn.addEventListener("click", onClick);
  return btn;
}

function appendGlobalNote(globals) {
  if (!globals.length) return;
  const note = document.createElement("div");
  note.className = "watch-note";
  note.textContent = t("global_note", {
    names: globals.map((r) => r.name || r.cookie).join(", "),
  });
  els.list.appendChild(note);
}

// 上半：追蹤清單。依 options 規則，各自去所屬網域抓到的 cookie；可收折。
function renderWatchlist(q) {
  const domains = Object.keys(targetGroups).filter((d) => d !== "*");
  const globals = targetGroups["*"] || [];

  // 沒有任何規則：顯示提示（不需收折）。
  if (domains.length === 0) {
    els.list.appendChild(sectionLabel(t("watch_section")));
    const hint = document.createElement("div");
    hint.className = "empty";
    hint.innerHTML = t("watch_empty");
    els.list.appendChild(hint);
    appendGlobalNote(globals);
    return;
  }

  const open = watchOpen || !!q;
  els.list.appendChild(
    makeSectionToggle(open, t("watch_section"), watchItems.length, () => {
      watchOpen = !watchOpen;
      render();
    })
  );
  if (!open) return;

  let shown = 0;
  for (const domain of domains) {
    const items = watchItems
      .filter((it) => it.domain === domain)
      .filter((it) => {
        if (!q) return true;
        const labelHit = it.label.toLowerCase().includes(q);
        const cookieHit = it.cookieName.toLowerCase().includes(q);
        const valHit = it.cookie && (it.cookie.value || "").toLowerCase().includes(q);
        return labelHit || cookieHit || valHit;
      });
    if (!items.length) continue;
    els.list.appendChild(domainLabel(domain));
    items.forEach((it) => els.list.appendChild(renderWatchItem(it)));
    shown += items.length;
  }
  if (shown === 0) {
    const none = document.createElement("div");
    none.className = "empty";
    none.textContent = t("watch_no_match");
    els.list.appendChild(none);
  }
  appendGlobalNote(globals);
}

// 下半：目前分頁的全部 cookie。次要功能——預設收起，有搜尋時自動展開。
function renderBrowse(q) {
  if (!currentHost) {
    const hint = document.createElement("div");
    hint.className = "empty";
    hint.textContent = t("browse_not_webpage");
    els.list.appendChild(hint);
    return;
  }

  const open = browseOpen || !!q;
  els.list.appendChild(
    makeSectionToggle(
      open,
      t("browse_toggle"),
      allCookies.length,
      () => {
        browseOpen = !browseOpen;
        render();
      },
      "sep"
    )
  );
  if (!open) return;

  if (allCookies.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("browse_empty");
    els.list.appendChild(empty);
    return;
  }

  const filtered = allCookies.filter((c) => matchesQuery(c, q));
  filtered.forEach((c) => els.list.appendChild(renderCookie(c)));
  if (!filtered.length) {
    const none = document.createElement("div");
    none.className = "empty";
    none.textContent = t("browse_no_match");
    els.list.appendChild(none);
  }
}

function sectionLabel(text) {
  const div = document.createElement("div");
  div.className = "section-label";
  div.textContent = text;
  return div;
}

function domainLabel(text) {
  const div = document.createElement("div");
  div.className = "domain-label";
  div.textContent = text;
  return div;
}

// 精簡徽章：只留 domain 與到期（Session 代表無到期）；技術旗標（Secure/HttpOnly/path）省略。
function fillMeta(meta, cookie) {
  meta.appendChild(tag(cookie.domain));
  if (cookie.expirationDate) {
    const d = new Date(cookie.expirationDate * 1000);
    meta.appendChild(tag(t("tag_expire", { date: d.toLocaleDateString() })));
  } else {
    meta.appendChild(tag(t("tag_session")));
  }
}

function setRuleBtn(btn, tracked) {
  btn.innerHTML = tracked ? ICON_STAR_FILLED : ICON_STAR_OUTLINE;
  btn.classList.toggle("tracked", tracked);
}

// 依名稱狀態填標題：有自訂名稱→上「自訂名稱」下「cookie 名稱」；沒有→只顯示 cookie 名稱（升為主要）。
function fillTitles(node, customName, cookieName) {
  const labelEl = node.querySelector(".cookie-label");
  const nameEl = node.querySelector(".cookie-name");
  if (customName && customName !== cookieName) {
    labelEl.textContent = customName;
    nameEl.textContent = cookieName;
  } else {
    labelEl.remove();
    nameEl.textContent = cookieName;
    nameEl.classList.add("solo");
  }
}

// 值過長時保留前 8、後 7，中間省略（顯示用；複製仍是完整值）。
function middleTruncate(s, front = 8, back = 7) {
  if (!s || s.length <= front + back + 1) return s;
  return s.slice(0, front) + "…" + s.slice(-back);
}

// 讓整張卡片可點擊複製 value。
function makeCardCopyable(node, value) {
  node.classList.add("copyable");
  node.title = t("click_to_copy");
  node.addEventListener("click", () => {
    copy(value);
    flashCard(node);
  });
}

function flashCard(node) {
  node.classList.add("flash");
  showToast(t("toast_copied"));
  setTimeout(() => node.classList.remove("flash"), 500);
}

// 開啟登入網址（缺 scheme 時補 https://）。
function openLogin(loginUrl) {
  let url = loginUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  chrome.tabs.create({ url });
}

// 追蹤清單項目：點卡片＝複製；星星＝移除規則；找不到 cookie 時顯示提示（可前往登入）。
function renderWatchItem(item) {
  const { domain, label, cookieName, loginUrl, cookie } = item;
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.add("starred");

  fillTitles(node, label, cookieName);
  const valEl = node.querySelector(".cookie-value");
  const meta = node.querySelector(".cookie-meta");
  const starBtn = node.querySelector(".btn-star");

  setRuleBtn(starBtn, true);
  starBtn.title = t("remove_rule_title_domain", { domain });
  starBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 不要觸發卡片複製
    removeRule(domain, cookieName);
  });

  if (cookie) {
    valEl.textContent = middleTruncate(cookie.value) || t("empty_value");
    fillMeta(meta, cookie);
    makeCardCopyable(node, cookie.value);
  } else {
    node.classList.add("missing");
    valEl.textContent = t("not_found");
    meta.appendChild(tag(t("tag_rule_domain", { domain })));
    if (loginUrl) {
      const login = document.createElement("button");
      login.className = "btn-login";
      login.textContent = t("login");
      login.addEventListener("click", (e) => {
        e.stopPropagation();
        openLogin(loginUrl);
      });
      node.appendChild(login); // 絕對定位在卡片右下角
    }
  }

  return node;
}

// 瀏覽區項目：點卡片＝複製；星星＝加入 / 移除規則（歸到目前分頁網域）。
function renderCookie(cookie) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const tracked = isTarget(cookie);
  if (tracked) node.classList.add("starred");

  fillTitles(node, "", cookie.name); // 瀏覽區無自訂名稱
  node.querySelector(".cookie-value").textContent = middleTruncate(cookie.value) || t("empty_value");
  fillMeta(node.querySelector(".cookie-meta"), cookie);

  const starBtn = node.querySelector(".btn-star");
  setRuleBtn(starBtn, tracked);
  starBtn.title = tracked ? t("remove_rule_title") : t("add_rule_title", { host: currentHost });
  starBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 不要觸發卡片複製
    toggleTarget(cookie);
  });

  makeCardCopyable(node, cookie.value);
  return node;
}

function tag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // clipboard API 偶爾在 popup 失效，退回 textarea 方式
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 1600);
}
