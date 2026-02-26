# TICKETS-2.md - 字體大小系統開發任務

> **專案目標**：實作可切換的字體大小系統，讓用戶（特別是 40 歲以上）能自由調整閱讀字體大小
>
> **建立日期**：2026-02-26
>
> **預估總工時**：2 小時
>
> **優先級**：High（用戶體驗關鍵功能）

---

## 📋 任務概覽

### 系統設計
- **技術方案**：CSS 變數 + localStorage + JavaScript 管理模組
- **字體等級**：5 個等級（標準、較大、大、很大、超大）
- **等級對應**：Normal(16px)、+1px(17px)、+2px(18px)、+3px(19px)、+4px(20px)
- **持久化**：使用 localStorage 儲存用戶偏好
- **UI 位置**：`profilei.html`（設定頁）新增字體大小選擇器
- **影響範圍**：所有 20 個 HTML 頁面

---

## 🎯 任務列表

### T-FS-001：建立字體大小管理系統（核心架構）⭐⭐

**狀態**：🟡 待開始
**負責人**：開發者
**預估時間**：15 分鐘
**優先級**：P0（其他任務依賴此項）

#### 任務描述
建立 `js/font-size-system.js` 模組，提供字體大小管理的核心功能。

#### 實作內容
1. **定義字體等級**
   - 建立 5 個等級配置（normal, plus1, plus2, plus3, plus4）
   - 每個等級包含：label（顯示名稱）、offset（px 偏移量）

2. **核心函式**
   - `init()`：從 localStorage 載入並套用用戶設定
   - `apply(level)`：套用指定字體等級，更新 CSS 變數 `--font-size-base`
   - `getCurrentLevel()`：取得當前字體等級

3. **localStorage 整合**
   - 儲存鍵值：`userFontSizeLevel`
   - 預設值：`normal`

#### 檔案位置
- `js/font-size-system.js`（新建）

#### 驗收標準
- [ ] `FontSizeSystem` 物件正確定義
- [ ] `init()` 能從 localStorage 讀取並套用設定
- [ ] `apply(level)` 能正確更新 CSS 變數
- [ ] `getCurrentLevel()` 能返回當前等級
- [ ] localStorage 讀寫正常，無錯誤

#### 程式碼範例
```javascript
// js/font-size-system.js
const FontSizeSystem = {
  levels: {
    normal: { label: '標準', offset: 0 },
    plus1: { label: '較大', offset: 1 },
    plus2: { label: '大', offset: 2 },
    plus3: { label: '很大', offset: 3 },
    plus4: { label: '超大', offset: 4 }
  },

  baseFontSize: 16,

  init() {
    const saved = localStorage.getItem('userFontSizeLevel') || 'normal';
    this.apply(saved);
  },

  apply(level) {
    if (!this.levels[level]) level = 'normal';
    const offset = this.levels[level].offset;
    const newSize = this.baseFontSize + offset;

    document.documentElement.style.setProperty('--font-size-base', `${newSize}px`);
    localStorage.setItem('userFontSizeLevel', level);
  },

  getCurrentLevel() {
    return localStorage.getItem('userFontSizeLevel') || 'normal';
  }
};
```

#### 測試步驟
1. 在瀏覽器 Console 執行 `FontSizeSystem.init()`
2. 檢查 `document.documentElement.style.getPropertyValue('--font-size-base')` 是否為 `16px`
3. 執行 `FontSizeSystem.apply('plus4')`
4. 檢查 CSS 變數是否變為 `20px`
5. 重新整理頁面，確認設定保留

---

### T-FS-002：在設定頁新增字體大小選擇器 ⭐⭐

**狀態**：🟡 待開始
**負責人**：開發者
**預估時間**：20 分鐘
**優先級**：P0
**依賴**：T-FS-001

#### 任務描述
在 `profilei.html`（設定頁）新增字體大小設定卡片，提供 5 個按鈕讓用戶選擇字體大小。

#### 實作內容
1. **HTML 結構**
   - 新增「字體大小」設定卡片
   - 使用 Neo-Brutalism 設計風格（與現有頁面一致）
   - 包含標題、說明文字、5 個等級按鈕

2. **JavaScript 邏輯**
   - `renderFontSizeButtons()`：渲染 5 個按鈕，標記當前選中狀態
   - `changeFontSize(level)`：切換字體大小並重新渲染按鈕
   - 頁面載入時自動渲染按鈕

3. **互動設計**
   - 當前選中的按鈕顯示黃色背景（`bg-primary`）
   - 點擊後立即生效，顯示提示訊息
   - 按鈕使用 Neo-Brutalism 風格（粗邊框 + 陰影）

#### 檔案位置
- `profilei.html`（修改）

#### 驗收標準
- [ ] 設定頁出現「字體大小」卡片
- [ ] 5 個按鈕正確顯示（標準、較大、大、很大、超大）
- [ ] 當前選中的按鈕有黃色背景
- [ ] 點擊按鈕後字體大小立即改變
- [ ] 重新整理頁面，選中狀態正確顯示
- [ ] 設計風格與現有頁面一致

#### HTML 範例
```html
<!-- 加在 profilei.html 的 main 區塊中 -->
<div class="bg-white dark:bg-gray-800 border-4 border-black p-4 space-y-4 neo-brutalism-card">
  <div class="flex items-center gap-3">
    <span class="material-symbols-outlined text-black dark:text-white">text_fields</span>
    <span class="text-xl font-black italic uppercase">字體大小</span>
  </div>
  <p class="text-sm font-bold text-gray-600 dark:text-gray-400">選擇適合您的閱讀字體大小</p>

  <div class="grid grid-cols-5 gap-2" id="font-size-buttons">
    <!-- 按鈕由 JavaScript 動態生成 -->
  </div>
</div>
```

#### JavaScript 範例
```javascript
// 渲染字體大小按鈕
function renderFontSizeButtons() {
  const container = document.getElementById('font-size-buttons');
  if (!container) return;

  const currentLevel = FontSizeSystem.getCurrentLevel();

  container.innerHTML = Object.entries(FontSizeSystem.levels).map(([key, config]) => {
    const isActive = key === currentLevel;
    return `
      <button
        onclick="changeFontSize('${key}')"
        class="py-3 border-4 border-black font-black text-xs neo-brutalism-button shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isActive ? 'bg-primary' : 'bg-white'}"
      >
        ${config.label}
      </button>
    `;
  }).join('');
}

// 切換字體大小
function changeFontSize(level) {
  FontSizeSystem.apply(level);
  renderFontSizeButtons();
  alert('✅ 字體大小已更新！');
}

// 頁面載入時渲染
document.addEventListener('DOMContentLoaded', () => {
  renderFontSizeButtons();
});
```

#### 測試步驟
1. 打開 `profilei.html`
2. 確認「字體大小」卡片出現
3. 點擊「超大」按鈕
4. 確認頁面文字變大
5. 重新整理頁面
6. 確認「超大」按鈕仍為選中狀態（黃色）

---

### T-FS-003：套用字體系統到所有頁面 ⭐

**狀態**：🟡 待開始
**負責人**：開發者
**預估時間**：30 分鐘
**優先級**：P1
**依賴**：T-FS-001

#### 任務描述
在所有 20 個 HTML 頁面引入字體系統，確保全域生效。

#### 實作內容
1. **引入 JavaScript 模組**
   - 在每個 HTML 的 `<head>` 引入 `js/font-size-system.js`

2. **初始化字體大小**
   - 在每個 HTML 的 `<body>` 開頭執行 `FontSizeSystem.init()`
   - 必須在 DOM 載入前執行，避免閃爍

3. **定義 CSS 變數**
   - 在每個 HTML 的 `<style>` 區塊定義 `:root { --font-size-base: 16px; }`
   - 設定 `body { font-size: var(--font-size-base); }`
   - 確保所有文字元素繼承基礎字體大小

#### 影響檔案（共 20 個）
```
index.html
profile.html
profilei.html
test.html
weakness.html
create.html
edit.html
history-analysis.html
import.html
level.html
login.html
rank.html
rank_l.html
rank_n.html
result.html
rule.html
status.html
upgrade.html
admin.html
admin-seed.html
```

#### 驗收標準
- [ ] 所有 20 個頁面都引入 `font-size-system.js`
- [ ] 所有頁面都在 `<body>` 開頭執行 `FontSizeSystem.init()`
- [ ] 所有頁面的 `<style>` 都定義 `--font-size-base`
- [ ] 隨機測試 5 個頁面，字體大小設定都能生效
- [ ] 無 Console 錯誤

#### 批量修改步驟
1. **Step 1：引入 JS 模組**
   - 搜尋每個檔案的 `<head>` 標籤
   - 在 `<head>` 內新增：`<script src="js/font-size-system.js"></script>`

2. **Step 2：初始化字體**
   - 在每個檔案的 `<body>` 標籤後新增：
   ```html
   <script>
     // 立即初始化字體大小（避免閃爍）
     if (typeof FontSizeSystem !== 'undefined') {
       FontSizeSystem.init();
     }
   </script>
   ```

3. **Step 3：定義 CSS 變數**
   - 在每個檔案的 `<style>` 區塊開頭新增：
   ```css
   :root {
     --font-size-base: 16px; /* 預設值 */
   }

   body {
     font-size: var(--font-size-base);
   }
   ```

#### 測試步驟
1. 在 `profilei.html` 設定字體為「超大」
2. 依序打開 `index.html`、`test.html`、`weakness.html`、`profile.html`、`rank.html`
3. 確認所有頁面字體都變大
4. 檢查 Console 無錯誤訊息

---

### T-FS-004：測試主頁完整流程 ⭐⭐

**狀態**：🟡 待開始
**負責人**：開發者
**預估時間**：15 分鐘
**優先級**：P1
**依賴**：T-FS-003

#### 任務描述
在 `index.html`（主頁）進行完整的字體大小測試，確保所有 UI 元件正常顯示。

#### 測試內容
1. **預設狀態測試**
   - 確認預設字體為 16px
   - 檢查所有文字、按鈕、卡片顯示正常

2. **極端字體測試**
   - 切換到「超大」（20px）
   - 檢查所有 UI 元件：
     - 導覽列
     - 搜尋框
     - 篩選按鈕
     - 卡片列表
     - 底部導覽列
   - 確認無跑版、溢出問題

3. **持久化測試**
   - 設定字體為「大」（18px）
   - 重新整理頁面
   - 確認字體大小保留

4. **響應式測試**
   - 測試桌面版（430px 寬度）
   - 測試手機版
   - 確認所有尺寸都能正常顯示

#### 測試頁面
- `index.html`（主頁）

#### 驗收標準
- [ ] 預設字體大小正確（16px）
- [ ] 切換到「超大」後，所有文字都變大
- [ ] 導覽列、搜尋框、按鈕等元件不跑版
- [ ] 卡片列表正常顯示，無溢出
- [ ] 重新整理頁面，設定保留
- [ ] 手機版與桌面版都正常

#### 常見問題處理

**問題 1：某些文字沒變大**
- **原因**：使用了 Tailwind 固定類別（如 `text-sm`、`text-xl`）
- **解決**：改用 `text-base` 或移除固定大小類別

**問題 2：按鈕文字溢出**
- **原因**：按鈕使用固定寬度（如 `w-12`）
- **解決**：改用 `min-w-12` 或使用 `flex` 佈局

**問題 3：導覽列跑版**
- **原因**：Icon 大小固定，文字變大後擠壓
- **解決**：調整 Icon 為相對大小或增加導覽列高度

#### 測試步驟
1. 打開瀏覽器 DevTools，切換到 Mobile 模式（430px）
2. 打開 `index.html`
3. 點擊右上角個人圖示 → 進入設定頁
4. 切換字體為「超大」
5. 返回主頁，檢查所有元件
6. 重新整理頁面，確認設定保留
7. 記錄任何跑版或顯示問題

---

### T-FS-005：全面測試與優化 ⭐⭐⭐

**狀態**：🟡 待開始
**負責人**：開發者
**預估時間**：40 分鐘
**優先級**：P1
**依賴**：T-FS-004

#### 任務描述
對所有 20 個頁面進行完整測試，修正所有跑版問題，確保系統穩定。

#### 測試範圍
**必測頁面**（20 個）：
- [ ] `index.html` - 主頁（卡片列表）
- [ ] `profile.html` - 個人中心（統計圖表、頭像）
- [ ] `profilei.html` - 設定頁（表單、按鈕）
- [ ] `test.html` - 測驗頁（題目、選項）
- [ ] `weakness.html` - 弱點分析（卡片、倒數計時）
- [ ] `create.html` - 新增題目（表單）
- [ ] `edit.html` - 編輯題目（表單）
- [ ] `history-analysis.html` - 歷史分析（圖表）
- [ ] `import.html` - 匯入資料（文件上傳）
- [ ] `level.html` - 等級頁面（進度條）
- [ ] `login.html` - 登入頁（表單）
- [ ] `rank.html` - 排行榜（列表）
- [ ] `rank_l.html` - 等級排行
- [ ] `rank_n.html` - 名次排行
- [ ] `result.html` - 測驗結果（統計卡片）
- [ ] `rule.html` - 規則說明（文字內容）
- [ ] `status.html` - 狀態頁（卡片）
- [ ] `upgrade.html` - 升級頁（動畫、提示）
- [ ] `admin.html` - 管理員頁面（表格、圖表）
- [ ] `admin-seed.html` - 資料種子頁

#### 測試方法
1. **設定字體為「超大」**
   - 在 `profilei.html` 設定字體為 +4px（20px）

2. **逐頁檢查**
   - 依序打開每個頁面
   - 檢查項目：
     - ✅ 文字是否變大
     - ✅ UI 是否跑版
     - ✅ 按鈕、表單等互動元件是否正常
     - ✅ 圖片、Icon 是否對齊
     - ✅ 響應式設計是否正常

3. **記錄問題**
   - 建立問題清單：頁面名稱、問題描述、截圖
   - 分類問題：嚴重（無法使用）、中等（影響體驗）、輕微（可忽略）

4. **修正問題**
   - 優先修正嚴重問題
   - 使用下方「常見問題與解法」

#### 驗收標準
- [ ] 所有 20 個頁面測試完成
- [ ] 嚴重問題數：0
- [ ] 中等問題數：≤ 2
- [ ] 桌面版（430px）與手機版都正常
- [ ] 極端字體大小（+4px）也能正常顯示
- [ ] 無 Console 錯誤
- [ ] 無使用者體驗阻斷

#### 常見問題與解法

| 問題類型 | 原因 | 解決方法 |
|---------|------|----------|
| **某些文字沒變大** | 使用了 Tailwind 固定類別（如 `text-sm`） | 改用 `text-base` 或移除固定大小 |
| **按鈕文字溢出** | 按鈕寬度固定（如 `w-12`） | 改用 `min-w-12` 或 `px-4` |
| **表格錯位** | 表格使用固定寬度 | 改用 `table-layout: auto` 或 `overflow-x-auto` |
| **導覽列跑版** | Icon 與文字大小不平衡 | 調整 Icon 為相對大小或增加容器高度 |
| **卡片內容溢出** | 卡片高度固定 | 改用 `min-h-*` 或移除高度限制 |
| **Modal 按鈕重疊** | Modal 按鈕使用固定間距 | 增加 `gap` 或使用 `flex-wrap` |
| **表單 Label 與 Input 對齊** | Label 使用固定寬度 | 改用 `flex-col` 或相對寬度 |

#### 修正範例

**範例 1：移除固定字體大小**
```html
<!-- Before -->
<p class="text-sm font-bold">文字內容</p>

<!-- After -->
<p class="text-base font-bold">文字內容</p>
```

**範例 2：按鈕寬度自適應**
```html
<!-- Before -->
<button class="w-12 h-12 ...">按鈕</button>

<!-- After -->
<button class="min-w-12 h-12 px-2 ...">按鈕</button>
```

**範例 3：表格溢出處理**
```html
<!-- Before -->
<table class="w-full">...</table>

<!-- After -->
<div class="overflow-x-auto">
  <table class="w-full">...</table>
</div>
```

#### 測試步驟
1. 在 `profilei.html` 設定字體為「超大」
2. 開啟測試表格（Excel 或 Google Sheets），列出 20 個頁面
3. 依序測試每個頁面，勾選「通過」或記錄問題
4. 修正所有嚴重問題
5. 重新測試修正過的頁面
6. 最終驗收：隨機測試 5 個頁面

---

## 🎨 額外優化任務（選做）

### T-FS-006：主頁快速切換按鈕（選做）⭐

**狀態**：🟢 選做
**預估時間**：10 分鐘

#### 任務描述
在主頁導覽列新增「快速字體調整」按鈕，讓用戶無需進入設定頁即可切換字體。

#### 實作內容
```html
<!-- 加在 index.html 的 header 區塊 -->
<button id="quick-font-toggle"
  class="w-10 h-10 neo-border-thick bg-white flex items-center justify-center neo-shadow-sm">
  <span class="material-symbols-outlined">text_increase</span>
</button>

<script>
document.getElementById('quick-font-toggle').addEventListener('click', () => {
  const levels = ['normal', 'plus1', 'plus2', 'plus3', 'plus4'];
  const current = FontSizeSystem.getCurrentLevel();
  const currentIndex = levels.indexOf(current);
  const nextIndex = (currentIndex + 1) % levels.length;
  FontSizeSystem.apply(levels[nextIndex]);
});
</script>
```

---

### T-FS-007：平滑過渡動畫（選做）⭐

**狀態**：🟢 選做
**預估時間**：5 分鐘

#### 任務描述
為字體大小變化加入平滑過渡效果，提升用戶體驗。

#### 實作內容
```css
/* 加在每個頁面的 <style> 區塊 */
body {
  transition: font-size 0.3s ease;
}
```

---

### T-FS-008：鍵盤快捷鍵（選做）⭐⭐

**狀態**：🟢 選做
**預估時間**：15 分鐘

#### 任務描述
支援鍵盤快捷鍵：
- `Ctrl + =` 或 `Cmd + =`：字體變大
- `Ctrl + -` 或 `Cmd + -`：字體變小
- `Ctrl + 0` 或 `Cmd + 0`：重設為標準

#### 實作內容
```javascript
// 加在 font-size-system.js
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '=') {
    e.preventDefault();
    // 字體變大邏輯
  } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    // 字體變小邏輯
  } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    FontSizeSystem.apply('normal');
  }
});
```

---

## 📊 整體進度追蹤

### 任務狀態統計
- 🔴 未開始：5 個
- 🟡 進行中：0 個
- 🟢 已完成：0 個
- 🔵 測試中：0 個

### 完成百分比
- 核心功能：0% (0/5)
- 選做功能：0% (0/3)
- 整體進度：0%

---

## ✅ 最終驗收標準

### 功能完整性
- [ ] 5 個字體大小等級都能正常切換
- [ ] 設定持久化（關閉瀏覽器後仍保留）
- [ ] 所有 20 個頁面都能正確套用設定
- [ ] 設定介面清楚易懂

### UI 穩定性
- [ ] 所有頁面在最大字體（20px）下不跑版
- [ ] 按鈕、表單等元件正常互動
- [ ] 響應式設計不受影響（手機版、桌面版）
- [ ] 無文字溢出或重疊問題

### 用戶體驗
- [ ] 切換字體大小立即生效（無需重新整理）
- [ ] 無閃爍或延遲現象
- [ ] 設定頁按鈕選中狀態清楚
- [ ] 無 Console 錯誤或警告

### 效能
- [ ] 頁面載入時間無明顯增加（< 50ms）
- [ ] localStorage 讀寫正常，無延遲
- [ ] 大量文字頁面（如 `rule.html`）仍流暢

---

## 📝 開發注意事項

### 程式碼規範
1. **CSS 變數命名**：使用 `--font-size-base` 作為全域變數名稱
2. **localStorage 鍵值**：使用 `userFontSizeLevel` 作為儲存鍵
3. **函式命名**：使用 `FontSizeSystem` 作為命名空間，避免全域污染
4. **錯誤處理**：加入 `try-catch` 處理 localStorage 讀寫失敗

### 相容性
- **瀏覽器支援**：Chrome 90+、Safari 14+、Firefox 88+（現代瀏覽器）
- **CSS 變數支援**：IE 11 不支援，但現代瀏覽器都支援
- **localStorage 支援**：所有現代瀏覽器都支援

### 效能優化
1. 在 `<body>` 開頭立即執行 `init()`，避免閃爍
2. 避免在 `apply()` 中執行大量 DOM 操作
3. 使用 CSS 變數而非逐一更新元素樣式

### 測試建議
1. 使用 Chrome DevTools 的 Mobile 模式測試響應式
2. 測試極端情況：最大字體（20px）+ 最長文字
3. 測試不同瀏覽器：Chrome、Safari、Firefox
4. 測試真實裝置：iPhone、Android 手機

---

## 🔗 相關文件

- [PRD.md](./PRD.md) - 產品需求文件
- [TICKETS.md](./TICKETS.md) - 遊戲化系統開發任務
- [database.md](../database.md) - 資料庫架構文件
- [MEMORY.md](~/.claude/projects/-Users-bogi-Vibe-coding-from-Trea---------brotherhsiehlearningcard/memory/MEMORY.md) - 專案記憶文件

---

## 📞 聯絡資訊

- **專案負責人**：開發團隊
- **技術支援**：Claude Code AI
- **問題回報**：GitHub Issues

---

**最後更新**：2026-02-26
**版本**：1.0
**狀態**：待開始
