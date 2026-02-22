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
