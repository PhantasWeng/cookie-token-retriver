# Cookie Token Retriever

一個 Chrome 外掛：進入任何網站時，自動列出該站的 cookie，並讓你一鍵複製指定的
cookie / token（例如登入用的 `access_token`、`session`）。因為是用擴充功能的
`chrome.cookies` API，所以連 JavaScript 讀不到的 **HttpOnly** cookie 也拿得到。

popup 分成兩區：

- **上半｜追蹤清單（監看清單）— 永遠顯示**：依設定頁的規則
  （例如 `example.com` → 名稱「登入權杖」對應 cookie `token`）**各自去所屬網域抓 cookie 並列出**，
  用你自訂的名稱顯示，不論你當下在哪個分頁都看得到，一鍵複製。抓不到的（未登入等）會標示「找不到」。
- **下半｜目前分頁的全部 cookie（預設收起）**：以「全部 cookie（N）」收合列呈現，
  點開才展開（搜尋時自動展開）。每列的星星按鈕可把它加進追蹤規則（歸到目前分頁網域）。

其他：

- 因為用 `chrome.cookies` API，連 JavaScript 讀不到的 **HttpOnly** cookie 也拿得到。
- **自動降級（父網域）**：抓 `app.example.com` 時會沿網域往上找（`example.com`），
  把註冊在 `.example.com` 這類父網域、實際會送到該站的 cookie 一起列出（標示「含父網域」）；
  但別的兄弟子網域（如 `api.example.com` 專屬的 cookie）不會混進來。
- **規則＝網域 →（名稱 + Cookie 名稱 + 登入網址）**：每條規則可幫 cookie 取好記的顯示名稱
  （例如把 `token` 命名為「登入權杖」，可留空）；也可填「登入網址」——當該 cookie
  抓不到時，追蹤卡片會顯示「找不到，可能需要登入」並附上「前往登入」按鈕，一鍵開該網址登入。
- **規則依網域分組**：設定 `example.com` 也會在子網域 `app.example.com` 生效；
  網域填 `*` 代表全站通用（僅在下半瀏覽區作為標記）。
- **規則可匯出 / 匯入**：設定頁可把規則匯出成 JSON 檔備份或分享，匯入時會
  合併進編輯區（非破壞性，確認後按「儲存」才生效）。
- 頂端搜尋框：單純篩選上下兩份清單（比對名稱與值）。
- **多語言**：介面預設為英文，可在設定頁最上方的語言下拉切換成中文（選擇會同步儲存，
  popup 與設定頁一起套用）。
- 支援深色模式。

## 安裝（載入未封裝的擴充功能）

1. 開啟 Chrome，網址列輸入 `chrome://extensions`。
2. 右上角打開「開發人員模式 / Developer mode」。
3. 點「載入未封裝項目 / Load unpacked」。
4. 選擇這個資料夾（`cookie-token-retriver`）。
5. 完成後在工具列會出現餅乾圖示，建議按 📌 釘選。

## 使用

1. 點工具列的外掛圖示。
2. 上半的「追蹤清單」會直接顯示你設定的規則對應的 cookie（不論在哪個分頁都看得到），
   下半顯示目前分頁網址的全部 cookie。每列「複製」複製值、「加入規則」加入追蹤。
3. 想固定追蹤某些 cookie：可直接在下半清單點該 cookie 的「加入規則」（自動歸到目前分頁網域），
   或點右上角 ⚙ 進設定頁，用「＋ 新增網域」建立分組、在該網域下每行填一個名稱後儲存
   （網域填 `*` = 全站通用）。

## 檔案結構

| 檔案 | 用途 |
| --- | --- |
| `manifest.json` | 外掛設定（Manifest V3） |
| `i18n.js` | 介面多語言字典與工具（en / zh），popup 與設定頁共用 |
| `popup.html` / `popup.css` / `popup.js` | 點圖示跳出的主視窗 |
| `options.html` / `options.js` | 追蹤規則（依網域分組）的設定頁 |
| `icons/` | 外掛圖示 |
| `package.json` / `scripts/build.mjs` | `yarn package` 打包腳本 |

## 權限說明

- `cookies` + `host_permissions: <all_urls>`：讀取任一網域的 cookie（含 HttpOnly）；
  追蹤清單就是靠這個到各規則網域抓 cookie，不需開啟該分頁。
- `tabs`：取得目前分頁網址，作為下半瀏覽區的目標。
- `storage`：儲存追蹤規則（`storage.sync`，會跟著 Chrome 帳號同步）。

所有讀到的 cookie 只顯示在本機的外掛視窗，不會上傳到任何伺服器。
