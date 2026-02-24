# 資料庫架構 (Database Schema)

> [!NOTE]
> 本系統採用 **Supabase** 作為後端資料庫 (PostgreSQL)。此文件記錄目前的資料庫架構設計。

## 關聯結構 (Relations)

- `users` 為核心使用者資料表。
- `questions` 儲存所有的題庫。
- 每個 `user` 對應每個 `question` 會有特定的存取進度 (`user_question_progress`)。
- 每次答題都會紀錄一筆 `answer_records`。
- 隨機抽題後的清單，會儲存於 `random_test_sessions` 以供後續查找覆盤。
- `chapter_access` 控制哪些標籤的學員可以存取哪些章節。
- `tags` 管理所有可用的標籤（梯次、付費等級等）。

## 1. 使用者: `users`
儲存使用者的基本資訊與目前的綜合等級數據。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK (Primary Key) | 使用者唯一識別碼 (對應 Supabase Auth) |
| `username` | `varchar` | UNIQUE | 系統暱稱 |
| `email` | `varchar` | UNIQUE | 用戶信箱 |
| `avatar_url` | `text` | NULLABLE | 大頭貼 URL |
| `current_level` | `integer` | DEFAULT 1 | 當前等級 |
| `current_xp` | `integer` | DEFAULT 0 | 目前累積經驗值 |
| `current_level_xp` | `integer` | DEFAULT 0 | 當前等級內已累積的經驗值 |
| `next_level_xp` | `integer` | DEFAULT 100 | 下一等級所需經驗總值 |
| `perfect_card_count` | `integer` | DEFAULT 0 | 已棄用，改用 correct_answer_count |
| `correct_answer_count` | `integer` | DEFAULT 0 | 答對題目總數 |
| `total_questions` | `integer` | DEFAULT 0 | 已作答的題目總數 |
| `created_at` | `timestamptz` | DEFAULT now() | 帳號建立時間 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最後更新時間 |
| `tags` | `jsonb` | DEFAULT '[]' | 學員標籤，如 `["第1梯", "VIP"]` |

## 2. 題庫: `questions`
儲存所有的測驗題目。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 題目唯一識別碼 |
| `user_id` | `uuid` | FK (`users.id`), NULLABLE | 建立此題目的管理員或使用者 |
| `subject_no` | `integer` | | 排序用：大科目編號 |
| `subject` | `varchar` | | 大科目 (例如：勞動基準法) |
| `chapter_no` | `integer` | | 排序用：章節標號 |
| `chapter` | `varchar` | | 章節或主題 |
| `question_no` | `integer` | | 排序用：題目編號 |
| `question` | `text` | | 題目敘述內容 |
| `options` | `jsonb` | | 選項 (陣列格式，如 `["選項A", "選項B"]`) |
| `correct_answer` | `jsonb` | | 正確答案 |
| `question_type` | `varchar` | | 題型 (單選/複選) |
| `explanation` | `text` | | 答案的詳細解析 |
| `created_at` | `timestamptz` | DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` | DEFAULT now() | 更新時間 |

## 3. 答題進度: `user_question_progress`
追蹤學員對於每一題的作答狀況，用於計算熟練度與升級需求。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 進度記錄唯一識別碼 |
| `user_id` | `uuid` | FK (`users.id`), NULLABLE | 對應使用者 |
| `question_id` | `uuid` | FK (`questions.id`), NULLABLE | 對應題目 |
| `is_correct` | `boolean` | NULLABLE | 最近一次答題結果 |
| `times_reviewed` | `integer` | DEFAULT 0 | 作答/複習次數 |
| `times_correct` | `integer` | DEFAULT 0 | 累計答對次數 |
| `times_incorrect` | `integer` | DEFAULT 0 | 累計答錯次數 |
| `last_reviewed_at` | `timestamptz` | NULLABLE | 最後一次作答時間 |
| `created_at` | `timestamptz` | DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` | DEFAULT now() | 更新時間 |
| `is_favorite` | `boolean` | DEFAULT false | 用戶收藏標記 |

## 4. 答題紀錄: `answer_records`
每次答題都會建立的歷史詳細日誌。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 答題紀錄唯一識別碼 |
| `user_id` | `uuid` | FK (`users.id`), NULLABLE | 答題者 |
| `question_id` | `uuid` | FK (`questions.id`), NULLABLE | 目標題目 |
| `user_answer` | `jsonb` | | 用戶提交的答案 |
| `is_correct` | `boolean` | | 是否答對 |
| `response_time_ms` | `integer` | NULLABLE | 作答耗時(毫秒) |
| `xp_earned` | `integer` | DEFAULT 0 | 該題獲得的經驗值 (XP) |
| `created_at` | `timestamptz` | DEFAULT now() | 紀錄時間 |

## 5. 隨機測驗設定: `random_test_sessions`
儲存由使用者建立的隨機測驗 Session 設定與抽出的題目。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 測驗唯一識別碼 |
| `user_id` | `uuid` | FK (`users.id`), NULLABLE | 對應建立者 |
| `session_name` | `varchar` | | 測驗名稱 |
| `subject` | `varchar` | | 目標大科目 |
| `chapters` | `jsonb` | | 設定的章節清單 |
| `question_ids` | `jsonb` | | 所包含的題目清單 (ID Array) |
| `total_questions` | `integer` | | 總題數 |
| `created_at` | `timestamptz` | DEFAULT now() | 建立時間 |

---

# 權限管理系統

> [!NOTE]
> 此功能用於實現「標籤制章節權限控制」。
>
> **功能說明：**
> - 管理者按章節匯入題目後，可透過勾選控制哪些學員可以存取
> - 學員透過 `tags` 標籤（如梯次、付費等級）來決定可存取的章節
> - 支援多標籤組合（一個學員可有多個標籤，一個章節可開放給多個標籤）

## 實作進度

| 項目 | 狀態 | 說明 |
|------|------|------|
| 資料庫結構 | ✅ 已完成 | SQL 腳本已執行，`users.tags`、`chapter_access`、`tags` 表已建立 |
| API 函式 | ✅ 已完成 | `api-service.js` 已新增所有權限管理相關函式 |
| 管理介面 - 章節權限 | ✅ 已完成 | `admin.html` - 按科目分組顯示章節，可設定公開/標籤權限 |
| 管理介面 - 學員標籤 | ✅ 已完成 | `admin.html` - 學員列表、搜尋、單獨編輯、批量新增/移除標籤 |
| 管理介面 - 標籤管理 | ✅ 已完成 | `admin.html` - 新增/編輯/刪除標籤（含顏色選擇） |

## 6. 章節權限控制: `chapter_access`

控制哪些標籤的學員可以存取哪些章節的題目。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 唯一識別碼 |
| `subject` | `varchar` | NOT NULL | 大科目（對應 questions.subject） |
| `chapter` | `varchar` | NOT NULL | 章節（對應 questions.chapter） |
| `allowed_tags` | `jsonb` | DEFAULT '[]' | 可存取此章節的標籤，如 `["第1梯", "VIP"]` |
| `is_public` | `boolean` | DEFAULT false | 是否公開給所有學員（不論標籤） |
| `created_at` | `timestamptz` | DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` | DEFAULT now() | 更新時間 |

**約束條件：**
- `UNIQUE(subject, chapter)` - 每個科目+章節組合只能有一筆設定

## 7. 標籤管理: `tags`

管理所有可用的標籤，方便 UI 選擇並避免打字錯誤。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 唯一識別碼 |
| `name` | `varchar` | UNIQUE, NOT NULL | 標籤名稱（如「第1梯」「VIP」） |
| `color` | `varchar` | DEFAULT '#FFD600' | 標籤顯示顏色（UI 用） |
| `created_at` | `timestamptz` | DEFAULT now() | 建立時間 |

---

## 📋 執行 SQL 腳本

在 Supabase SQL Editor 中執行以下腳本：

```sql
-- =============================================
-- 權限管理系統 - 資料庫變更
-- 執行前請先備份資料庫
-- =============================================

-- 1. users 表新增 tags 欄位
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- 2. 建立 chapter_access 表
CREATE TABLE IF NOT EXISTS chapter_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject varchar NOT NULL,
    chapter varchar NOT NULL,
    allowed_tags jsonb DEFAULT '[]'::jsonb,
    is_public boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(subject, chapter)
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_chapter_access_subject ON chapter_access(subject);
CREATE INDEX IF NOT EXISTS idx_chapter_access_public ON chapter_access(is_public);

-- 3. 建立 tags 管理表
CREATE TABLE IF NOT EXISTS tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar UNIQUE NOT NULL,
    color varchar DEFAULT '#FFD600',
    created_at timestamptz DEFAULT now()
);

-- 4. 預設標籤（可依需求修改）
INSERT INTO tags (name, color) VALUES
    ('第1梯', '#FFD600'),
    ('第2梯', '#4CAF50'),
    ('第3梯', '#2196F3'),
    ('VIP', '#9C27B0'),
    ('試用', '#9E9E9E')
ON CONFLICT (name) DO NOTHING;

-- 5. 將現有的所有 subject + chapter 組合加入 chapter_access（預設不公開）
INSERT INTO chapter_access (subject, chapter, is_public)
SELECT DISTINCT subject, chapter, false
FROM questions
WHERE subject IS NOT NULL AND chapter IS NOT NULL
ON CONFLICT (subject, chapter) DO NOTHING;
```

---

## 🔄 權限查詢邏輯（供 API 實作參考）

學員查詢可存取的題目時，邏輯如下：

```sql
-- 取得學員可存取的所有章節
SELECT ca.subject, ca.chapter
FROM chapter_access ca
WHERE
    ca.is_public = true  -- 公開章節
    OR ca.allowed_tags ?| (  -- 或學員的 tags 與 allowed_tags 有交集
        SELECT tags FROM users WHERE id = '學員UUID'
    )::text[];

-- 然後用這些 subject + chapter 去篩選 questions
```

**JavaScript 實作參考：**
```javascript
async getAccessibleQuestions(userId) {
    // 1. 取得學員的 tags
    const { data: user } = await supabase
        .from('users')
        .select('tags')
        .eq('id', userId)
        .single();

    const userTags = user.tags || [];

    // 2. 取得可存取的章節
    const { data: accessibleChapters } = await supabase
        .from('chapter_access')
        .select('subject, chapter')
        .or(`is_public.eq.true,allowed_tags.ov.${JSON.stringify(userTags)}`);

    // 3. 用這些章節篩選題目...
}
```

---

## 📊 關聯結構圖

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   users     │       │  chapter_access  │       │    tags     │
├─────────────┤       ├──────────────────┤       ├─────────────┤
│ id          │       │ id               │       │ id          │
│ username    │       │ subject ─────────┼───┐   │ name        │
│ tags[]  ◄───┼───────┼─► allowed_tags[] │   │   │ color       │
│ ...         │       │ is_public        │   │   └─────────────┘
└─────────────┘       └──────────────────┘   │
                                             │
                      ┌──────────────────────┘
                      ▼
              ┌─────────────────┐
              │    questions    │
              ├─────────────────┤
              │ subject         │
              │ chapter         │
              │ question        │
              │ ...             │
              └─────────────────┘
```

---

# ✅ 已完成：管理介面 (UI)

> [!NOTE]
> 管理介面已建立於獨立的 `admin.html` 頁面，可從 `profile.html` 管理員儀表板進入。

## 入口位置

- **profile.html** → 管理員儀表板 → 「權限管理」按鈕 → **admin.html**

## 1. 標籤管理介面

**功能：**
- 顯示所有標籤列表（顏色圓點 + 名稱）
- 新增標籤（名稱 + 6 種預設顏色 + 自訂顏色選擇器）
- 編輯標籤（修改名稱/顏色）
- 刪除標籤（含確認對話框）

**使用的 API：**
- `getAllTags()` - 取得所有標籤
- `createTag(name, color)` - 建立新標籤
- `updateTag(tagId, updates)` - 更新標籤
- `deleteTag(tagId)` - 刪除標籤

## 2. 章節權限管理介面

**功能：**
- 按科目分組顯示（可折疊展開）
- 每個章節顯示：題目數量、開放狀態（公開/特定標籤/未開放）
- 編輯章節權限（公開開關 + 標籤多選）
- 同步按鈕（將新匯入的章節加入權限設定）

**使用的 API：**
- `getAllChapterAccess()` - 取得所有章節權限設定
- `updateChapterAccess(accessId, updates)` - 更新章節權限
- `syncChapterAccess()` - 同步新章節
- `getAllTags()` - 取得所有可用標籤

## 3. 學員標籤管理介面

**功能：**
- 顯示所有學員列表（頭像、名稱、Email、目前標籤）
- 搜尋學員（名稱或 Email）
- 單獨編輯學員標籤
- 批量選取 + 全選功能
- 批量新增/移除標籤

**使用的 API：**
- `getAllUsers()` - 取得所有學員列表
- `setUserTags(userId, tags)` - 設定單一學員的標籤
- `addTagsToUsers(userIds, tagsToAdd)` - 批量新增標籤
- `removeTagsFromUsers(userIds, tagsToRemove)` - 批量移除標籤

---

# AI 分析歷史記錄系統

> [!NOTE]
> 此功能用於儲存學員的 AI 學習分析記錄，保留歷史軌跡以追蹤學習進步。
>
> **功能說明：**
> - 學員在「精準弱點打擊」頁面可點擊生成 AI 分析
> - 每天只能生成一次分析
> - 生成時會同時儲存：當時的統計數據快照 + AI 產出的分析內容
> - 可查看歷史分析記錄（追蹤學習進步軌跡）

## 實作進度

| 項目 | 狀態 | 說明 |
|------|------|------|
| 資料庫結構 | ⏳ 待執行 | SQL 腳本已準備，需在 Supabase 執行 |
| API 函式 | ⏳ 待實作 | `api-service.js` 需新增相關函式 |
| 前端整合 | ⏳ 待實作 | `weakness.html` 需整合儲存邏輯 |

## 8. AI 分析歷史: `user_ai_analyses`

儲存學員的 AI 學習分析記錄，包含生成時的數據快照。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 分析記錄唯一識別碼 |
| `user_id` | `uuid` | FK (`auth.users.id`), NOT NULL | 對應使用者 |
| `analysis_content` | `text` | NOT NULL | AI 生成的 Markdown 分析內容 |
| `stats_snapshot` | `jsonb` | NOT NULL | 生成時的統計數據快照 |
| `generated_at` | `timestamptz` | DEFAULT now() | 生成時間 |

### `stats_snapshot` JSONB 欄位內容範例

```json
{
  "totalAnswered": 150,
  "correctQuestionCount": 120,
  "wrongQuestionCount": 30,
  "overallAccuracy": 80,
  "masteryRate": 45,
  "masteredCount": 68,
  "remainingQuestions": 82,
  "totalQuestionsInBank": 150,
  "improvement": { "accuracyChange": 5 },
  "weakSubjects": [
    { "subject": "勞動基準法", "errorRate": 0.35 },
    { "subject": "勞工保險條例", "errorRate": 0.28 }
  ],
  "topWeakQuestions": [
    { "question": "勞基法第84-1條規定...", "timesIncorrect": 5 },
    { "question": "加班費計算方式...", "timesIncorrect": 4 }
  ]
}
```

---

## 📋 執行 SQL 腳本

在 Supabase SQL Editor 中執行以下腳本：

```sql
-- =============================================
-- AI 分析歷史記錄系統 - 資料庫變更
-- 執行前請先備份資料庫
-- =============================================

-- 1. 建立 user_ai_analyses 表
CREATE TABLE IF NOT EXISTS user_ai_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_content text NOT NULL,
    stats_snapshot jsonb NOT NULL,
    generated_at timestamptz DEFAULT now()
);

-- 2. 建立索引加速查詢（用戶 + 生成時間）
CREATE INDEX IF NOT EXISTS idx_user_ai_analyses_user_date
ON user_ai_analyses(user_id, generated_at DESC);

-- 3. 啟用 RLS (Row Level Security)
ALTER TABLE user_ai_analyses ENABLE ROW LEVEL SECURITY;

-- 4. RLS 政策：用戶只能讀取自己的分析記錄
CREATE POLICY "Users can view own analyses"
ON user_ai_analyses FOR SELECT
USING (auth.uid() = user_id);

-- 5. RLS 政策：用戶只能新增自己的分析記錄
CREATE POLICY "Users can insert own analyses"
ON user_ai_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 6. RLS 政策：用戶可以刪除自己的分析記錄（選用）
CREATE POLICY "Users can delete own analyses"
ON user_ai_analyses FOR DELETE
USING (auth.uid() = user_id);
```

---

## 🔄 API 函式（供實作參考）

### 1. 檢查今天是否已生成分析

```javascript
async checkTodayAnalysisExists(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('user_ai_analyses')
        .select('id, analysis_content, stats_snapshot, generated_at')
        .eq('user_id', userId)
        .gte('generated_at', today.toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

    return { exists: !!data, data };
}
```

### 2. 儲存 AI 分析結果

```javascript
async saveAIAnalysis(userId, analysisContent, statsSnapshot) {
    const { data, error } = await supabase
        .from('user_ai_analyses')
        .insert({
            user_id: userId,
            analysis_content: analysisContent,
            stats_snapshot: statsSnapshot
        })
        .select()
        .single();

    return { success: !error, data, error };
}
```

### 3. 取得用戶歷史分析記錄

```javascript
async getUserAnalysisHistory(userId, limit = 10) {
    const { data, error } = await supabase
        .from('user_ai_analyses')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(limit);

    return { success: !error, data, error };
}
```

---

## 📊 前端整合邏輯

### 頁面載入時
1. 呼叫 `checkTodayAnalysisExists(userId)`
2. **已有今日分析** → 直接顯示已儲存的內容，按鈕改為「查看今日分析」
3. **尚無今日分析** → 顯示「生成 AI 分析」按鈕

### 點擊生成按鈕時
1. 再次檢查今天是否已生成（雙重檢查，防止重複）
2. 撈取用戶統計數據 → `statsSnapshot`
3. 呼叫 AI 生成分析 → `analysisContent`
4. 同時儲存到資料庫：`saveAIAnalysis(userId, analysisContent, statsSnapshot)`
5. 顯示分析結果
# 遊戲化驅動力系統 - 資料庫設計

> [!NOTE]
> 此系統設計用於驅動學員持續答題的動力，包含徽章成就、個人紀錄追蹤等功能。
>
> **設計原則：**
> - 即時成就感：今日新增熟練、本次 vs 歷史正確率
> - 遊戲化機制：徽章解鎖、里程碑、連勝記錄
> - 個人化洞察：答題時段效率、錯誤選項分析
> - 自我競爭：打破個人紀錄、超越昨天的自己

## 實作進度

| 項目 | 狀態 | 說明 |
|------|------|------|
| 資料庫結構 | ✅ 已完成 | 已在 Supabase 執行 SQL 腳本 |
| API 函式 | ⏳ 待實作 | `api-service.js` 需新增相關函式 |
| 前端整合 | ⏳ 待實作 | `weakness.html` 需整合新數據顯示 |

---

## 9. 徽章系統: `user_badges`

儲存學員解鎖的徽章記錄，用於成就展示與遊戲化激勵。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 解鎖記錄唯一識別碼 |
| `user_id` | `uuid` | FK (`auth.users.id`), NOT NULL | 對應使用者 |
| `badge_key` | `varchar` | NOT NULL | 徽章識別碼（如 `hundred_correct`, `week_streak_7`） |
| `badge_name` | `varchar` | NOT NULL | 徽章顯示名稱（如「百題斬」） |
| `badge_description` | `text` | | 徽章說明 |
| `badge_icon` | `varchar` | | 徽章圖示（Material Icon 名稱或 emoji） |
| `unlocked_at` | `timestamptz` | DEFAULT now() | 解鎖時間 |

**約束條件：**
- `UNIQUE(user_id, badge_key)` - 每個徽章每人只能解鎖一次

**關聯性：**
- `user_id` → `auth.users.id`（一對多：一個用戶可解鎖多個徽章）
- 每次答題後自動檢查解鎖條件，達成時寫入此表

---

### 徽章類型設計（前端定義）

| 徽章類型 | badge_key | 解鎖條件 | 圖示 |
|---------|-----------|---------|------|
| **數量成就** | | | |
| 首題達陣 | `first_correct` | 答對第 1 題 | `flag` |
| 十全十美 | `ten_correct` | 累積答對 10 題 | `stars` |
| 百題斬 | `hundred_correct` | 累積答對 100 題 | `emoji_events` |
| 五百壯士 | `fivehundred_correct` | 累積答對 500 題 | `military_tech` |
| **連勝成就** | | | |
| 連勝起步 | `streak_3` | 連續答對 3 題 | `local_fire_department` |
| 連勝達人 | `streak_10` | 連續答對 10 題 | `whatshot` |
| 無敵連勝 | `streak_20` | 連續答對 20 題 | `bolt` |
| **連續天數** | | | |
| 三日修行 | `daily_streak_3` | 連續 3 天答題 | `calendar_today` |
| 一週達人 | `daily_streak_7` | 連續 7 天答題 | `date_range` |
| 月度戰士 | `daily_streak_30` | 連續 30 天答題 | `workspace_premium` |
| **熟練成就** | | | |
| 初窺門徑 | `mastery_10` | 熟練 10 題 | `school` |
| 小有所成 | `mastery_50` | 熟練 50 題 | `auto_awesome` |
| 融會貫通 | `mastery_100` | 熟練 100 題 | `psychology` |
| **弱點克服** | | | |
| 弱點終結者 | `weakness_killer` | 將 10 題錯題全部熟練 | `verified` |
| 完美逆襲 | `perfect_comeback` | 錯題二刷 10 題全對 | `trending_up` |
| **科目成就** | | | |
| 單科精通 | `subject_master` | 某科目熟練度達 80% | `book` |
| 全科通達 | `all_subjects_master` | 所有科目熟練度達 60% | `library_books` |

---

## 10. 個人紀錄: `user_records`

儲存學員的個人最佳紀錄，用於「超越自己」的激勵機制。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `user_id` | `uuid` | PK, FK (`auth.users.id`) | 對應使用者（主鍵） |
| `best_daily_accuracy` | `float` | DEFAULT 0 | 單日最高正確率（百分比） |
| `best_daily_accuracy_date` | `date` | NULLABLE | 達成日期 |
| `best_daily_correct_count` | `integer` | DEFAULT 0 | 單日最多答對題數 |
| `best_daily_correct_date` | `date` | NULLABLE | 達成日期 |
| `longest_correct_streak` | `integer` | DEFAULT 0 | 最長連續答對題數 |
| `longest_correct_streak_date` | `date` | NULLABLE | 達成日期 |
| `longest_daily_streak` | `integer` | DEFAULT 0 | 最長連續天數 |
| `longest_daily_streak_end_date` | `date` | NULLABLE | 結束日期 |
| `fastest_avg_response_ms` | `integer` | NULLABLE | 最快平均答題速度（毫秒） |
| `fastest_avg_response_date` | `date` | NULLABLE | 達成日期 |
| `current_daily_streak` | `integer` | DEFAULT 0 | 當前連續天數 |
| `last_answer_date` | `date` | NULLABLE | 最後答題日期（用於計算連勝） |
| `updated_at` | `timestamptz` | DEFAULT now() | 最後更新時間 |

**設計說明：**
- 每個用戶只有一筆紀錄（`user_id` 為主鍵）
- 每次答題後檢查是否打破紀錄，自動更新
- `current_daily_streak` 用於追蹤連續天數，需每日檢查
- 所有「最佳紀錄」都記錄達成日期，讓學員知道「何時創下紀錄」

**關聯性：**
- `user_id` → `auth.users.id`（一對一：每個用戶一筆紀錄）
- 每次答題後透過 `answer_records` 計算統計，更新此表

---

## 11. 考試倒數設定: `users` 表擴充

為了支援「進度條與倒數計時」功能，需擴充 users 表。

```sql
-- 在 users 表新增考試日期欄位
ALTER TABLE users
ADD COLUMN IF NOT EXISTS exam_date date;

-- 新增每日目標題數（預設 20）
ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_goal integer DEFAULT 20;
```

**新增欄位說明：**

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `exam_date` | `date` | NULLABLE | 學員設定的考試日期 |
| `daily_goal` | `integer` | DEFAULT 20 | 每日答題目標（可調整） |

**使用說明：**
- `exam_date`：學員設定的考試日期，用於計算倒數天數
- `daily_goal`：學員設定的每日答題目標（可調整）
- 這兩個欄位會影響「預估完成天數」的計算

---

## 📋 執行 SQL 腳本

在 Supabase SQL Editor 中執行以下腳本：

```sql
-- =============================================
-- 遊戲化驅動力系統 - 資料庫變更
-- 執行前請先備份資料庫
-- =============================================

-- 1. 建立 user_badges 徽章解鎖記錄表
CREATE TABLE IF NOT EXISTS user_badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_key varchar NOT NULL,
    badge_name varchar NOT NULL,
    badge_description text,
    badge_icon varchar,
    unlocked_at timestamptz DEFAULT now(),
    UNIQUE(user_id, badge_key)
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_unlocked_at ON user_badges(unlocked_at DESC);

-- 啟用 RLS
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS 政策：用戶只能讀取自己的徽章
CREATE POLICY "Users can view own badges"
ON user_badges FOR SELECT
USING (auth.uid() = user_id);

-- RLS 政策：系統可新增徽章（透過 service_role）
CREATE POLICY "System can insert badges"
ON user_badges FOR INSERT
WITH CHECK (true);

-- 2. 建立 user_records 個人紀錄表
CREATE TABLE IF NOT EXISTS user_records (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    best_daily_accuracy float DEFAULT 0,
    best_daily_accuracy_date date,
    best_daily_correct_count integer DEFAULT 0,
    best_daily_correct_date date,
    longest_correct_streak integer DEFAULT 0,
    longest_correct_streak_date date,
    longest_daily_streak integer DEFAULT 0,
    longest_daily_streak_end_date date,
    fastest_avg_response_ms integer,
    fastest_avg_response_date date,
    current_daily_streak integer DEFAULT 0,
    last_answer_date date,
    updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE user_records ENABLE ROW LEVEL SECURITY;

-- RLS 政策：用戶只能讀取自己的紀錄
CREATE POLICY "Users can view own records"
ON user_records FOR SELECT
USING (auth.uid() = user_id);

-- RLS 政策：用戶可更新自己的紀錄
CREATE POLICY "Users can update own records"
ON user_records FOR UPDATE
USING (auth.uid() = user_id);

-- RLS 政策：用戶可新增自己的紀錄
CREATE POLICY "Users can insert own records"
ON user_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. 擴充 users 表（考試日期 + 每日目標）
ALTER TABLE users
ADD COLUMN IF NOT EXISTS exam_date date;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_goal integer DEFAULT 20;

-- 4. 為現有用戶初始化 user_records（避免查詢時找不到記錄）
INSERT INTO user_records (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

---

## 🔄 資料關聯與使用情境

### 徽章系統流程
```
每次答題後 → 檢查徽章解鎖條件
    ├─ 累積答對 100 題？ → 解鎖「百題斬」
    ├─ 連續答對 10 題？ → 解鎖「連勝達人」
    ├─ 連續 7 天答題？ → 解鎖「一週達人」
    └─ 新解鎖 → INSERT INTO user_badges
```

### 個人紀錄追蹤流程
```
每次答題後 → 計算當日統計
    ├─ 今日正確率 > best_daily_accuracy？ → 更新紀錄
    ├─ 當前連續答對 > longest_correct_streak？ → 更新紀錄
    ├─ 今日 vs 昨日日期 → 更新 current_daily_streak
    └─ UPDATE user_records SET ...
```

### 進度條與倒數計時
```
查詢 users.exam_date → 計算剩餘天數
查詢 users.daily_goal → 計算每日應答題數
查詢熟練題數 / 總題數 → 計算進度百分比
    └─ 顯示：「以目前速度，X 天後完成（距考試還有 Y 天）」
```

---

## 📊 資料表關聯圖

```
┌─────────────────────┐
│       users         │
├─────────────────────┤
│ id                  │
│ exam_date          │───┐ 考試倒數
│ daily_goal         │   │
└─────────────────────┘   │
         │                │
         │                │
    ┌────┴────────┬───────┴─────┐
    ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│user_badges│ │user_records│ │user_question_│
├──────────┤  ├──────────┤  │  progress    │
│user_id   │  │user_id(PK)│  ├──────────────┤
│badge_key │  │best_daily_│  │times_correct │──┐
│unlocked_at│ │ accuracy  │  │times_incorrect│ │
└──────────┘  │longest_   │  └──────────────┘  │
              │ streak    │                     │
              └──────────┘                      │
                                                │
                    ┌───────────────────────────┘
                    ▼
            ┌──────────────┐
            │answer_records│
            ├──────────────┤
            │user_answer   │──► 錯誤選項分析
            │created_at    │──► 答題時段分析
            │is_correct    │──► 本次 vs 歷史正確率
            │response_time │──► 答題速度分析
            └──────────────┘
```

---

## 💡 現有資料支援度分析

### ✅ 完全支援（不需新增資料）

| 功能 | 使用資料表 | 資料欄位 |
|------|-----------|---------|
| 今日新增熟練題數 | `user_question_progress` | `times_correct`, `updated_at` |
| 本次 vs 歷史正確率 | `answer_records` | `is_correct`, `created_at` |
| 答題時段效率分析 | `answer_records` | `created_at`, `is_correct` |
| 錯誤選項分析 | `answer_records` | `user_answer`, `is_correct` |
| 錯題二刷正確率 | `answer_records` | `question_id`, `is_correct`, `created_at` |

### ⚠️ 需新增資料表

| 功能 | 需新增表 | 理由 |
|------|---------|------|
| 徽章與里程碑系統 | `user_badges` | 需記錄解鎖狀態與時間 |
| 超越自己的數據 | `user_records` | 需儲存個人最佳紀錄 |
| 進度條與倒數計時 | `users` 擴充 | 需 `exam_date`, `daily_goal` |

---

## 🎯 實作優先級建議

### Phase 1: 無需新增資料（立即可實作）
1. ✅ 今日新增熟練題數
2. ✅ 本次 vs 歷史正確率
3. ✅ 錯誤選項分析
4. ✅ 答題時段效率分析

### Phase 2: 執行 SQL 後可實作
1. ✅ 進度條與倒數計時（需擴充 `users` 表）
2. ✅ 徽章與里程碑系統（需 `user_badges` 表）
3. ✅ 超越自己的數據（需 `user_records` 表）

### Phase 3: 複雜邏輯（後續優化）
1. 🔄 錯題二刷正確率（需時間序列分析）
