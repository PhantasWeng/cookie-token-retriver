"use strict";

// 極簡自訂 i18n：預設英文，語言選擇存 chrome.storage.sync（跨裝置同步）。
// 由 popup.js / options.js 共用（以 <script> 先於它們載入，共享全域作用域）。
const UI_LANG_KEY = "uiLang";
const DEFAULT_LANG = "en";
let CURRENT_LANG = DEFAULT_LANG;

const MESSAGES = {
  en: {
    // 共用
    loading: "Loading…",
    copy: "Copy",
    copy_title: "Copy this cookie's value",
    click_to_copy: "Click to copy value",
    add_rule: "Add rule",
    remove_rule: "Remove rule",
    rule_btn_title: "Add or remove tracking rule",
    copied: "Copied",
    toast_copied: "Cookie value copied",
    empty_value: "(empty)",
    not_found: "(not found — you may need to log in)",
    login: "Log in ↗",
    tag_secure: "Secure",
    tag_httponly: "HttpOnly",
    tag_session: "Session",
    tag_expire: "Expires {date}",
    tag_cookie: "cookie: {name}",
    tag_rule_domain: "Rule domain: {domain}",

    // popup
    popup_current_tab: "Current tab",
    popup_options_title: "Configure tracking rules",
    popup_search_ph: "Filter cookie name, value or domain…",
    popup_not_webpage: "(current tab is not a web page)",
    popup_cookie_count: "{host} · {n} cookies{suffix}",
    suffix_parent: " (incl. parent domain)",
    watch_section: "★ Tracking (by rule)",
    watch_empty:
      "No tracking rules yet. Add them via ⚙, or from “All cookies” below.",
    watch_no_match: "No tracked items match the filter.",
    global_note: "Global rules (*): {names}",
    browse_not_webpage: "Current tab has no readable cookies.",
    browse_toggle: "All cookies",
    browse_empty: "No readable cookies here.",
    browse_no_match: "No cookies match the filter.",
    remove_rule_title_domain: "Remove from rule “{domain}”",
    remove_rule_title: "Remove from tracking rules",
    add_rule_title: "Add rule (under {host})",

    // options
    options_title: "Cookie Token Retriever Settings",
    opt_lang_h1: "Language",
    opt_rules_h1: "Tracking rules",
    opt_rules_desc:
      "Group cookies by domain. <strong>Cookie name</strong> is matched exactly; " +
      "<strong>Name</strong> is an optional label. A domain also covers its subdomains; " +
      "<code>*</code> means all sites.",
    opt_add_group: "+ Add domain",
    save: "Save",
    opt_field_domain: "Domain (* = all sites)",
    opt_field_cookie: "Cookie name (required)",
    opt_field_name: "Display name (optional)",
    opt_field_login: "Login URL (optional)",
    opt_io_h1: "Backup",
    opt_io_desc:
      "Export the current rules as JSON, or import a file — merged into the editor, click Save to apply.",
    opt_export: "Export",
    opt_import: "Import",
    opt_name_ph: "e.g. Login token",
    opt_cookie_ph: "e.g. access_token",
    opt_login_ph: "e.g. https://example.com/login",
    opt_del_row: "Delete this cookie",
    opt_domain_ph: "e.g. example.com",
    opt_del_group: "Delete this domain",
    opt_add_row: "+ Add cookie",
    opt_saved: "Saved {domains} domain(s), {rules} rule(s) total",
    opt_exported: "Exported {domains} domain(s)",
    opt_imported: "Loaded {domains} domain(s) — review, then click Save",
    opt_import_err: "Import failed: not a valid rules JSON",
  },

  zh: {
    // 共用
    loading: "讀取中…",
    copy: "複製",
    copy_title: "複製這個 cookie 的值",
    click_to_copy: "點一下複製值",
    add_rule: "加入規則",
    remove_rule: "移除規則",
    rule_btn_title: "加入或移除追蹤規則",
    copied: "已複製",
    toast_copied: "已複製 cookie 值",
    empty_value: "（空值）",
    not_found: "（找不到，可能需要登入）",
    login: "前往登入 ↗",
    tag_secure: "Secure",
    tag_httponly: "HttpOnly",
    tag_session: "Session",
    tag_expire: "到期 {date}",
    tag_cookie: "cookie：{name}",
    tag_rule_domain: "規則網域：{domain}",

    // popup
    popup_current_tab: "目前分頁",
    popup_options_title: "設定追蹤規則",
    popup_search_ph: "篩選 cookie 名稱、值或網域…",
    popup_not_webpage: "（目前分頁非網頁）",
    popup_cookie_count: "{host} · {n} 個 cookie{suffix}",
    suffix_parent: "（含父網域）",
    watch_section: "追蹤中",
    watch_empty:
      "尚未設定追蹤規則。點 ⚙ 新增，或從下方「全部 cookie」加入。",
    watch_no_match: "追蹤清單沒有符合搜尋的項目。",
    global_note: "全站規則（*）：{names}",
    browse_not_webpage: "目前分頁沒有可讀取的 cookie。",
    browse_toggle: "全部 cookie",
    browse_empty: "此分頁沒有可讀取的 cookie。",
    browse_no_match: "沒有符合搜尋條件的 cookie。",
    remove_rule_title_domain: "從規則「{domain}」移除",
    remove_rule_title: "從追蹤規則移除",
    add_rule_title: "加入規則（歸到 {host}）",

    // options
    options_title: "Cookie Token Retriever 設定",
    opt_lang_h1: "語言 / Language",
    opt_rules_h1: "追蹤規則",
    opt_rules_desc:
      "依網域分組。<strong>Cookie 名稱</strong>完全比對；<strong>名稱</strong>是可留空的標籤。" +
      "設定某網域也會涵蓋其子網域；<code>*</code> 代表全站。",
    opt_add_group: "＋ 新增網域",
    save: "儲存",
    opt_field_domain: "網域（* = 全站）",
    opt_field_cookie: "Cookie 名稱（必填）",
    opt_field_name: "顯示名稱（選填）",
    opt_field_login: "登入網址（選填）",
    opt_io_h1: "備份",
    opt_io_desc:
      "把目前規則匯出成 JSON，或匯入 JSON（會合併進編輯區，按儲存才生效）。",
    opt_export: "匯出",
    opt_import: "匯入",
    opt_name_ph: "例如 登入權杖",
    opt_cookie_ph: "例如 access_token",
    opt_login_ph: "例如 https://example.com/login",
    opt_del_row: "刪除這筆",
    opt_domain_ph: "例如 example.com",
    opt_del_group: "刪除此網域",
    opt_add_row: "＋ 新增 cookie",
    opt_saved: "已儲存 {domains} 個網域、共 {rules} 條規則",
    opt_exported: "已匯出 {domains} 個網域",
    opt_imported: "已載入 {domains} 個網域，請確認後按「儲存」",
    opt_import_err: "匯入失敗：檔案不是有效的規則 JSON",
  },
};

// 取字串；params 會把 {key} 代換掉。找不到時退回英文、再退回 key 本身。
function t(key, params) {
  const table = MESSAGES[CURRENT_LANG] || MESSAGES[DEFAULT_LANG];
  let s = (table && table[key]) || MESSAGES[DEFAULT_LANG][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(v);
    }
  }
  return s;
}

function setCurrentLang(lang) {
  CURRENT_LANG = MESSAGES[lang] ? lang : DEFAULT_LANG;
  document.documentElement.lang = CURRENT_LANG === "zh" ? "zh-Hant" : "en";
}

// 從 storage 載入語言設定並套用。
function loadUiLang() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [UI_LANG_KEY]: DEFAULT_LANG }, (res) => {
      setCurrentLang(res[UI_LANG_KEY] || DEFAULT_LANG);
      resolve(CURRENT_LANG);
    });
  });
}

// 套用靜態 HTML 文字：data-i18n（textContent）、data-i18n-html（innerHTML）、
// data-i18n-ph（placeholder）、data-i18n-title（title）。
function applyStatic(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}
