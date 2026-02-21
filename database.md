# 資料庫架構 (Database Schema)

> [!NOTE]
> 本系統採用 **Supabase** 作為後端資料庫 (PostgreSQL)。此文件記錄目前的資料庫架構設計。

## 關聯結構 (Relations)

- `users` 為核心使用者資料表。
- `questions` 儲存所有的題庫。
- 每個 `user` 對應每個 `question` 會有特定的存取進度 (`user_question_progress`)。
- 每次答題都會紀錄一筆 `answer_records`。
- 隨機抽題後的清單，會儲存於 `random_test_sessions` 以供後續查找覆盤。

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
| `next_level_xp` | `integer` | DEFAULT 100 | 下一等級所需經驗總值 |
| `correct_answer_count` | `integer` | DEFAULT 0 | 答對題目總數 |
| `total_questions` | `integer` | DEFAULT 0 | 已作答的題目總數 |
| `created_at` | `timestamptz` | DEFAULT now() | 帳號建立時間 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最後更新時間 |

## 2. 題庫: `questions`
儲存所有的測驗題目。

| 欄位名稱 (Column) | 資料型別 (Type) | 屬性與預設值 (Attributes & Default) | 說明 (Description) |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 題目唯一識別碼 |
| `user_id` | `uuid` | FK (`users.id`), NULLABLE | 建立此題目的管理員或使用者 |
| `subject` | `varchar` | | 大科目 (例如：勞動基準法) |
| `chapter` | `varchar` | | 章節或主題 |
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
