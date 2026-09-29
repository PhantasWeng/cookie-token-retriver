// 把擴充功能打包成可上架 / 分享的 zip（manifest.json 位於壓縮檔根目錄）。
// 不依賴任何 npm 套件，使用系統的 `zip`。檔名自動帶上 manifest 的版本號。
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root); // 以專案根目錄為基準，zip 內路徑才會正確

// 明確列出要打包的檔案，避免夾帶 README / package.json / node_modules 等非擴充內容。
const FILES = [
  "manifest.json",
  "i18n.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.js",
  "icons",
];

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const OUT_DIR = "releases";
const out = join(OUT_DIR, `cookie-token-retriever-${version}.zip`);

mkdirSync(OUT_DIR, { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-qr", out, ...FILES, "-x", "*.DS_Store"], { stdio: "inherit" });

console.log(`✔ 已打包 → ${out}`);
