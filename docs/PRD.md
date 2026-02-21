# 📱 企業證照考試系統 PRD

## 產品概述 (Product Overview)

### 產品名稱
**企業證照考試系統 (Enterprise Certification Exam System)**

### 產品定位
一個基於 Supabase 的全端證照考試練習平台，專為企業學員設計。透過遊戲化機制(經驗值、等級系統)、互動式題目測驗、以及完整的進度追蹤，幫助學員有效準備證照考試。

### 核心價值主張
- 📝 **題庫式學習**: 每張卡片對應一個考題，支援單選/複選題型
- 🎯 **章節式管理**: 依大科目、章節、主題分類，系統化組織題庫
- 🎮 **遊戲化學習體驗**: 等級系統、XP 獎勵、答對標記，提升學習動機
- 📊 **進度追蹤與數據分析**: 完整的答題記錄、正確率統計、排行榜系統
- 🎨 **Neo-Brutalism 設計風格**: 獨特的視覺設計，提供差異化的使用體驗
- 🔐 **企業專屬系統**: 單一企業使用，管理員可上傳題目並匯出成績報表

---

## 目標用戶 (Target Users)

### 主要用戶
- **企業學員**: 需要準備證照考試的企業員工
- **年齡層**: 18-60 歲，具備基本資訊素養
- **學習場景**: 碎片化時間學習(通勤、休息時間)、考前集中複習、章節式反覆練習

### 次要用戶
- **管理員**: 需要上傳題目、監控學員學習數據、匯出成績報表的企業管理者

---

## 核心功能模組 (Core Features)

### 1. 👤 用戶系統 (User System)

#### 1.1 身份驗證與授權
- **Google OAuth 登入**: 使用 Supabase Auth 整合 Google 登入
- **白名單機制**:
  - 配置於 `config.js` 的 `STUDENT_EMAILS` 陣列
  - 支援啟用/關閉(透過變數命名切換)
  - 非白名單用戶嘗試登入時顯示錯誤訊息
- **Session 管理**:
  - 使用 `localStorage` 存儲用戶暱稱
  - Supabase token 自動管理
  - 登入狀態檢查與自動導向

#### 1.2 個人資料管理
- **基本資料**:
  - 暱稱(username)
  - Email
  - 頭像(avatar_url)支援上傳與裁切
- **等級系統**:
  - 當前等級(current_level, 1-99)
  - 當前經驗值(current_xp)
  - 下一等級所需 XP(next_level_xp)
  - 升級計算公式: `next_level_xp = 100 * current_level * 1.5`
- **統計數據**:
  - 總卡片數(total_cards)
  - 滿分卡片數(perfect_card_count)
  - 總複習次數、正確率等

#### 1.3 等級升級機制
- **升級條件**: XP 達標 + 滿分卡片數達標
- **Capped 狀態**: XP 滿但滿分卡片不足時,進度條顯示金色閃爍動畫
- **升級資格顯示**: 首頁等級卡片下方顯示「升級資格：滿分卡 X / Y」

---

### 2. 📝 題庫系統 (Question Bank System)

#### 2.1 題目卡片結構
每張卡片代表一個考題，包含以下欄位：
- **基本資訊**:
  - 大科目(subject) - 對應原本的「分類」
  - 章節/主題(chapter) - 對應原本的「等級」，例如：「第1章」、「第2章」、「隨機出題」、「魔王題」、「考古題」
  - 題目內容(question) - 題目敘述
- **選項與答案**:
  - 選項(options) - JSON 陣列，包含 4 個選項（例如：["10人", "20人", "30人", "40人"]）
  - 正確答案(correct_answer) - 單選：字串(例如："C")；複選：陣列(例如：["A", "C"])
  - 題型(question_type) - "single" 或 "multiple" (標示單選/複選)
- **解答說明**:
  - 答案解析(explanation) - 詳細解答說明
- **元數據**:
  - 建立者 ID(user_id)
  - 建立/更新時間

#### 2.2 題目建立與匯入
- **管理員上傳題目**:
  - 支援批量匯入 JSON 格式題庫
  - 手動建立單一題目（後續規劃）
- **母版題庫複製**:
  - 管理員(MASTER_ADMIN_ID)的題目作為共用題庫
  - 新用戶註冊時自動複製全部題庫

#### 2.3 題目管理
- **CRUD 操作**:
  - 查看(Read): `card.html` (改為題目卡片顯示)
  - 編輯(Update): `edit.html` (僅管理員)
  - 刪除(Delete): 僅管理員可刪除
- **搜尋與篩選**:
  - 關鍵字搜尋(題目內容)
  - **大科目篩選**(Modal 彈窗) - 對應原本的「分類篩選」
  - **章節/主題篩選** - 對應原本的「等級篩選」，顯示如「第1章」、「魔王題」等
  - 答對狀態篩選(僅顯示未答對題目)
- **分類排序**:
  - 大科目：中文注音排序(使用 `Intl.Collator`)
  - 章節：自然排序(第1章 → 第2章 → ...)

#### 2.4 隨機出題功能
- **入口**: 首頁右上角 `+` 按鈕（移除原本所有建卡功能）
- **隨機出題頁面**(`random-test.html`):
  1. 選擇大科目
  2. 選擇章節（可複選多個章節）
  3. 設定題數（2-100 題）
  4. 點擊「開始測驗」
- **生成邏輯**:
  - 從選定章節隨機抽取指定題數
  - 自動建立一個新的「主題分類」，命名格式：`2026-02-21 隨選 10 題`
  - 該主題會保存在資料庫，讓用戶可重複測驗

---

### 3. 📚 答題功能 (Exam Features)

#### 3.1 答題模式（簡化）
- **僅測驗模式**: 移除「翻卡模式」，每張卡片就是一個測驗題目
- **答題流程**:
  1. 進入題目卡片，顯示題目內容 + 4 個選項
  2. 用戶選擇答案（單選點選一個，複選可選多個）
  3. 點擊「送出答案」按鈕
  4. 顯示正確答案 + 答案解析
  5. 顯示答對/答錯狀態（答對顯示藍色勾勾✓）
  6. 點擊「繼續測驗」按鈕 → 直接跳到下一張卡片

#### 3.2 答題進度追蹤
每位用戶對每張題目卡片有獨立的進度記錄(`user_card_progress`):
- **答題狀態**:
  - 未作答
  - 答對 ✓（藍色勾勾標記）
  - 答錯 ✗
- **統計數據**:
  - 作答次數(times_reviewed)
  - 答對/答錯次數
  - 正確率：答對 = 100%，答錯 = 0%（因為每張卡片只有一題）
  - 最後作答時間
  - **顯示最近一次結果**：可重複作答，以最新一次為準
- **移除功能**: 不再有「熟練度等級」、「愛心標記」

#### 3.3 XP 獎勵機制（簡化）
| 動作 | XP 獎勵 | 說明 |
|------|---------|------|
| 答對題目 | +100 XP | 單題答對 |
| 答錯題目 | +0 XP | 不扣分 |
| 首次答對 | +50 XP | 開拓者獎勵（首次答對該題） |
| 每日登入 | +50 XP | 首次登入獎勵 |

**移除的獎勵**:
- ~~建立新卡片~~ (管理員功能)
- ~~測驗答對(1/3)、(2/3)~~ (改為單題制)
- ~~解鎖大師勛章~~ (簡化獎勵機制)

---

### 4. 📊 數據分析與排行榜 (Analytics & Leaderboard)

#### 4.1 個人統計(Profile)
- **等級與 XP 進度**
- **卡片總數**
- **學習數據**:
  - 總複習次數
  - 整體正確率
  - 連續學習天數(streak_days)
  - 熟練度分佈圖

#### 4.2 排行榜系統(Rank)
- **等級排行榜**: 依 `current_level` + `current_xp` 排序
- **卡片數量排行榜**: 依 `total_cards` 排序
- **顯示資訊**:
  - 排名、暱稱、等級、XP/卡片數
  - 當前用戶排名高亮顯示

#### 4.3 學習日曆(Calendar)
- **每日學習記錄**:
  - 視覺化顯示學習天數
  - 連續學習獎勵機制
- **學習數據統計**:
  - 本週/本月學習時長
  - 新增卡片數、複習次數

---

### 5. 🔧 管理員功能 (Admin Features)

#### 5.1 權限管理
- **管理員定義**: `config.js` 中的 `ADMIN_UUIDS` 陣列
- **母版管理員**: `MASTER_ADMIN_ID` 的題目作為全體學員共用題庫

#### 5.2 題目上傳功能（後續規劃細節）
- **批量匯入題庫**:
  - JSON 格式上傳
  - 欄位驗證：題目、選項、答案、解析、大科目、章節
  - 自動檢查題型（單選/複選）
- **手動建立題目**: 管理後台表單建立

#### 5.3 數據儀表板(Dashboard)
僅管理員可見，位於 `profile.html`:
- **每日學習趨勢圖**: Line Chart，最近 30 天學員作答數
- **答錯最多題目**: 錯誤次數最多的 Top 10 題目(Bar Chart)
- **章節答對率分析**: Doughnut Chart，顯示各章節整體答對率
- **魔王陷阱題**: 錯誤率最高的 Top 10 題目列表

#### 5.4 成績報表匯出（後續規劃細節）
- **學員成績報表**: CSV/Excel 格式
  - 包含：學員姓名、Email、總答題數、答對率、各章節答對率
- **題目統計報表**: JSON 格式
  - 包含：每個題目的答對率、答錯次數、學員答題記錄
- **系統數據查詢**: 透過 Supabase API 查詢所有數據

---

## 技術架構 (Technical Architecture)

### 前端技術棧
- **框架**: 純 HTML + Vanilla JavaScript(無框架依賴)
- **樣式**:
  - Tailwind CSS(CDN)
  - Neo-Brutalism 設計風格(粗黑框線、陰影、黃色主色調)
- **字體**:
  - Space Grotesk(英文)
  - Noto Sans TC(中文)
  - Material Symbols Outlined(圖示)
- **圖表**: Chart.js 4.4.1
- **圖片處理**: Cropper.js 1.5.13(頭像裁切)

### 後端技術棧
- **BaaS**: Supabase
  - Auth: Google OAuth
  - Database: PostgreSQL
  - Storage: 頭像儲存
- **AI 服務**: 整合 LLM API(用於卡片內容生成)

### 核心 JavaScript 模組
位於 `/js` 目錄:
- **api-service.js**: Supabase API 封裝
- **init.js**: 頁面初始化邏輯
- **level-system.js**: 等級計算與 XP 管理
- **modal-system.js**: 彈窗系統
- **onboarding-system.js**: 新手引導
- ~~**ai-service.js**: AI 內容生成服務~~ (移除，不再需要 AI 生成卡片)

---

## 資料庫架構 (Database Schema)

### 核心資料表

#### 1. `users` (使用者)
```sql
- id (UUID, PK)
- username (VARCHAR(50), NOT NULL, UNIQUE)
- email (VARCHAR(255), NOT NULL, UNIQUE)
- avatar_url (TEXT, NULLABLE)
- current_level (INTEGER, DEFAULT 1)
- current_xp (INTEGER, DEFAULT 0)
- next_level_xp (INTEGER, DEFAULT 100)
- correct_answer_count (INTEGER, DEFAULT 0) // 改名：答對題目總數
- total_questions (INTEGER, DEFAULT 0) // 改名：題目總數
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. `questions` (題目) - 改名自 `flashcards`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id) // 保留用於區分管理員上傳的題目
- subject (VARCHAR(100), NOT NULL) // 大科目（原 category）
- chapter (VARCHAR(100), NOT NULL) // 章節/主題（原 level 概念）
- question (TEXT, NOT NULL) // 題目內容
- options (JSONB, NOT NULL) // 選項陣列，例如：["10人", "20人", "30人", "40人"]
- correct_answer (JSONB, NOT NULL) // 正確答案：單選 "C"，複選 ["A", "C"]
- question_type (VARCHAR(20), NOT NULL) // "single" 或 "multiple"
- explanation (TEXT, NOT NULL) // 答案解析
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**移除欄位**: english_term, chinese_translation, abbreviation, description, analogy, is_public

#### 3. `user_question_progress` (答題進度) - 改名自 `user_card_progress`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- question_id (UUID, FK -> questions.id)
- is_correct (BOOLEAN, NULLABLE) // 最近一次答題結果：NULL(未作答), TRUE(答對), FALSE(答錯)
- times_reviewed (INTEGER, DEFAULT 0) // 作答次數
- times_correct (INTEGER, DEFAULT 0) // 答對次數
- times_incorrect (INTEGER, DEFAULT 0) // 答錯次數
- last_reviewed_at (TIMESTAMP, NULLABLE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE (user_id, question_id)
```

**移除欄位**: mastery_level（不再需要熟練度等級）

#### 4. `answer_records` (答題記錄) - 改名自 `test_records`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- question_id (UUID, FK -> questions.id)
- user_answer (JSONB, NOT NULL) // 用戶選擇的答案：單選 "C"，複選 ["A", "C"]
- is_correct (BOOLEAN, NOT NULL)
- response_time_ms (INTEGER, NULLABLE)
- xp_earned (INTEGER, DEFAULT 0)
- created_at (TIMESTAMP)
```

**移除欄位**: question_index（不再需要，因為每張卡片只有一題）, test_type（簡化）

#### 5. `random_test_sessions` (隨機出題記錄) - 新增
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- session_name (VARCHAR(100), NOT NULL) // 例如："2026-02-21 隨選 10 題"
- subject (VARCHAR(100), NOT NULL) // 大科目
- chapters (JSONB, NOT NULL) // 選擇的章節陣列：["第1章", "第2章"]
- question_ids (JSONB, NOT NULL) // 隨機抽取的題目 ID 陣列
- total_questions (INTEGER, NOT NULL) // 題數
- created_at (TIMESTAMP)
```

### 資料關聯
```
users (1) ──┬─→ (N) questions
            ├─→ (N) user_question_progress
            ├─→ (N) answer_records
            └─→ (N) random_test_sessions

questions (1) ──┬─→ (N) user_question_progress
                └─→ (N) answer_records
```

---

## 頁面結構與功能 (Page Structure)

### 核心頁面

| 頁面 | 路徑 | 主要功能 | CRUD | 改動說明 |
|------|------|---------|------|---------|
| 登入頁 | `login.html` | Google OAuth 登入、白名單驗證 | - | 保留 |
| 首頁 | `index.html` | 題目列表、搜尋篩選（大科目、章節） | R | **大改**：卡片變題目，篩選改為大科目/章節 |
| 題目卡片 | `card.html` | 顯示題目、選項、送出答案、查看解析 | R, U | **大改**：移除翻卡，改為答題介面 |
| 題目編輯 | `edit.html` | 編輯/刪除題目（僅管理員） | R, U, D | **修改**：僅管理員可編輯 |
| ~~建立卡片~~ | ~~`vibe-coding/build.html`~~ | ~~AI 輔助建卡~~ | ~~C~~ | **移除**：改為管理員批量上傳 |
| 隨機出題 | `random-test.html` | 選擇大科目、章節、題數，生成隨機測驗 | C | **新增**：取代右上角 + 按鈕功能 |
| ~~測驗頁~~ | ~~`test.html`~~ | ~~互動式測驗、進度更新~~ | ~~R, U~~ | **移除**：整合到 card.html |
| 個人中心 | `profile.html` | 個人資料、統計、管理員儀表板 | R | **修改**：統計改為答題數據 |
| 排行榜 | `rank.html` | 等級/答對題數排行 | R | **修改**：卡片數改為答對題數 |
| 學習日曆 | `calendar.html` | 答題記錄視覺化 | R | **修改**：學習改為答題 |
| 規則說明 | `rule.html` | 系統使用說明 | - | **需更新**：說明改為證照考試 |
| 設定頁 | `profilei.html` | 個人設定 | U | 保留 |

### 輔助頁面
- `admin-seed.html`: 管理員種子資料工具（需修改為題目上傳）
- `admin-upload.html`: **新增** - 管理員題目批量上傳介面
- `status.html`: 系統狀態檢查
- `upgrade.html`: 升級提示頁
- ~~`result.html`: 測驗結果頁~~ **移除**：不再需要結果頁

---

## 設計系統 (Design System)

### 視覺風格
- **設計理念**: Neo-Brutalism(新粗獷主義)
- **特色元素**:
  - 粗黑邊框(2-4px)
  - 硬陰影(4px 4px 0px rgba(0,0,0,1))
  - 高對比色彩
  - 幾何形狀
  - 扁平化設計

### 配色方案
```css
/* Light Mode */
--primary: #FFD400 (黃色)
--background-light: #F7F7F7
--text-dark: #1A1A1A

/* Dark Mode */
--background-dark: #1A1A1A
--text-light: #FFFFFF
```

### 間距系統
- 基準單位: 4px
- 常用間距: 8px, 16px, 24px, 32px

### 字體層級
```
- H1: 2xl (36px) - 頁面標題
- H2: xl (24px) - 區塊標題
- H3: lg (18px) - 小標題
- Body: base (16px) - 內文
- Small: sm (14px) - 輔助文字
```

---

## 用戶流程 (User Flows)

### 1. 新用戶註冊流程
```
1. 訪問 login.html
2. 點擊「使用 Google 登入」
3. Google OAuth 授權
4. 系統檢查 Email 是否在白名單
   ├─ 是:
   │   ├─ 建立用戶資料
   │   ├─ 複製母版題庫(來自 MASTER_ADMIN_ID)
   │   └─ 導向 index.html
   └─ 否:
       └─ 顯示「非學員」錯誤訊息
```

### 2. 答題流程（大幅簡化）
```
1. 首頁瀏覽題目列表（可依大科目、章節篩選）
2. 點擊題目卡片 → 進入 card.html
3. 顯示題目內容 + 4 個選項
4. 用戶選擇答案（單選/複選）
5. 點擊「送出答案」按鈕
6. 系統檢查答案並顯示：
   ├─ 正確答案標記（綠色）
   ├─ 答案解析
   ├─ 答對 → 顯示藍色勾勾 ✓ + 獲得 100 XP
   └─ 答錯 → 顯示紅色叉叉 ✗ + 0 XP
7. 系統記錄：
   ├─ answer_records: 答題記錄
   ├─ user_question_progress: 更新答題狀態（最近一次結果）
   └─ users: 增加 XP，檢查升級
8. 點擊「繼續測驗」按鈕 → 直接跳到下一張題目卡片
```

### 3. 隨機出題流程（新增）
```
1. 首頁點擊右上角「+」按鈕
2. 進入 random-test.html
3. 選擇：
   ├─ 大科目（例如：職業安全衛生管理）
   ├─ 章節（可複選，例如：第1章、第2章）
   └─ 題數（2-100 題）
4. 點擊「開始測驗」
5. 系統從選定章節隨機抽取指定題數
6. 建立新的「主題分類」：
   ├─ 命名：2026-02-21 隨選 10 題
   ├─ 儲存到 random_test_sessions 資料表
   └─ 可在首頁章節篩選中找到並重複測驗
7. 導向第一張題目卡片 → 開始答題
```

### 4. 管理員上傳題目流程（後續規劃）
```
1. 管理員登入後進入 admin-upload.html
2. 選擇上傳方式：
   ├─ 批量匯入 JSON 檔案
   └─ 手動建立單一題目
3. JSON 格式範例：
   {
     "subject": "職業安全衛生管理",
     "chapter": "第1章",
     "question": "題目內容...",
     "options": ["選項A", "選項B", "選項C", "選項D"],
     "correct_answer": "C",
     "question_type": "single",
     "explanation": "答案解析..."
   }
4. 系統驗證欄位 → 寫入 questions 資料表
5. 顯示上傳成功訊息 + 題目數量
```

---

## 非功能性需求 (Non-Functional Requirements)

### 效能需求
- **首頁載入時間**: < 2 秒(含卡片列表)
- **測驗答題反饋**: < 100ms
- **搜尋/篩選響應**: < 300ms
- **分頁策略**: 每頁載入 100 張卡片

### 相容性需求
- **瀏覽器**: Chrome 90+, Safari 14+, Edge 90+
- **裝置**: 響應式設計,支援桌面與行動裝置
- **最佳體驗寬度**: 320px - 430px(行動優先)

### 安全性需求
- **認證**: Supabase Auth + JWT Token
- **授權**: Row Level Security(RLS)政策
- **白名單**: Email 驗證機制
- **資料加密**: HTTPS 傳輸

### 可用性需求
- **新手引導**: Onboarding System 首次使用教學
- **錯誤提示**: 友善的錯誤訊息與操作指引
- **離線支援**: LocalStorage 快取用戶基本資料

---

## 成功指標 (Success Metrics)

### 學習成效指標
- **日活躍用戶(DAU)**: 目標 > 80% 的註冊學員
- **平均每日答題時長**: > 15 分鐘
- **題目作答次數**: 平均每題 > 3 次
- **整體答對率**: > 70%
- **章節完成率**: 平均每章節答題完成度 > 80%

### 系統使用指標
- **連續學習天數**: 平均 > 7 天
- **隨機出題使用率**: > 40% 用戶使用隨機出題功能
- **排行榜參與率**: > 60% 用戶查看排行榜

**移除指標**: ~~新卡建立數~~（改為管理員功能）

### 技術指標
- **系統可用性**: > 99.5%
- **API 平均響應時間**: < 500ms
- **錯誤率**: < 0.1%

---

## 未來規劃 (Roadmap)

### Phase 2(短期)
- [ ] 管理員題目批量上傳功能
- [ ] 成績報表匯出（CSV/Excel）
- [ ] 答錯題目收藏功能（讓用戶標記弱點題）
- [ ] 模擬考模式（從所有章節隨機抽題，限時作答）
- [ ] 語音朗讀功能（輔助聽覺學習）

### Phase 3(中期)
- [ ] AI 個性化推薦（根據錯誤率推薦複習題目）
- [ ] 成就系統擴充（更多勳章與獎勵）
- [ ] 行動 App（iOS/Android 原生應用）
- [ ] 題目討論區（學員可針對題目提問）

### Phase 4(長期)
- [ ] 多證照支援（擴展到其他證照考試）
- [ ] 多租戶架構（支援多個企業使用）
- [ ] 企業管理後台（更完善的題目管理、學員管理）
- [ ] 付費訂閱模式（進階功能解鎖）

---

## 附錄 (Appendix)

### A. 配置檔案
- **config.js**: Supabase 連線、XP 獎勵、管理員、白名單設定
- **DATABASE_API_SPEC.md**: 完整 API 端點與資料結構文檔
- **資料庫.md**: 資料庫架構圖解與資料流說明

### B. 關鍵依賴
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "tailwindcss": "^3.x (CDN)",
    "chart.js": "^4.4.1",
    "cropperjs": "^1.5.13"
  }
}
```

### C. Git 倉庫資訊
- **當前分支**: main
- **最近提交**:
  - `9b14b5b` - 串好渤浚的supabase
  - `4d6afdf` - 白名單暫時關閉
  - `4125bf4` - 社群鏈接

### D. 專案目錄結構
```
brotherhsiehlearningcard/
├── index.html              # 首頁(題目列表) - **大改**
├── login.html              # 登入頁
├── card.html               # 題目卡片 - **大改**：改為答題介面
├── random-test.html        # 隨機出題頁 - **新增**
├── profile.html            # 個人中心
├── rank.html               # 排行榜
├── calendar.html           # 答題日曆
├── edit.html               # 編輯頁（僅管理員）
├── admin-upload.html       # 管理員題目上傳 - **新增**
├── config.js               # 配置檔
├── js/
│   ├── api-service.js      # API 服務 - **需修改**
│   ├── init.js             # 初始化
│   ├── level-system.js     # 等級系統
│   ├── modal-system.js     # 彈窗系統
│   └── onboarding-system.js # 新手引導
├── docs/
│   ├── PRD.md              # 本文檔
│   ├── DATABASE_API_SPEC.md # API 規格文檔 - **需更新**
│   └── 資料庫.md            # 資料庫說明 - **需更新**
└── [移除檔案]
    ├── test.html           # **移除**：整合到 card.html
    ├── result.html         # **移除**：不再需要
    ├── vibe-coding/build.html # **移除**：改為管理員上傳
    └── js/ai-service.js    # **移除**：不再需要 AI 生成
```

---

## 版本資訊

- **文檔版本**: 2.0.0 - 企業證照考試系統改版
- **建立日期**: 2026-02-21
- **最後更新**: 2026-02-21
- **撰寫者**: Claude Code AI
- **專案狀態**: 🔄 Under Refactoring (從專有名詞學習卡改版為證照考試系統)

---

## 改版摘要 (v1.0 → v2.0)

### 核心改動
1. **卡片概念改變**: 從「一張卡片 = 一個專有名詞 + 5 個題目」→「一張卡片 = 一個考題」
2. **分類架構改變**:
   - 原「分類」→ 改為「大科目」
   - 原「等級」→ 改為「章節/主題」
3. **答題流程簡化**: 移除翻卡模式、測驗結果頁，改為即時顯示答案與解析
4. **隨機出題功能**: 右上角 + 按鈕改為隨機出題功能（移除建卡功能）
5. **管理員功能**: 新增題目批量上傳、成績報表匯出

### 資料庫改動
- `flashcards` → `questions`
- `user_card_progress` → `user_question_progress`
- `test_records` → `answer_records`
- 新增 `random_test_sessions` 資料表

### 移除功能
- AI 生成卡片功能
- 翻卡模式
- 3 題測驗模式
- 熟練度等級系統
- 愛心標記功能

### 新增功能
- 單選/複選題支援
- 隨機出題功能
- 答對藍色勾勾標記
- 答案解析顯示
- 管理員題目上傳（規劃中）
- 成績報表匯出（規劃中）

---

**© 2026 企業證照考試系統 | All Rights Reserved**
