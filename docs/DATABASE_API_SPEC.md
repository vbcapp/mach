# 📚 sandys-exam-card-system - 資料庫架構與 API 規格文檔

> **Supabase 專案：** `sandys-exam-card-system` (Ref: `mwwvrapnjekxwxpyolcm`)
> **URL：** `https://mwwvrapnjekxwxpyolcm.supabase.co`

## 📋 目錄
- [資料庫架構設計](#資料庫架構設計)
- [頁面功能對應表](#頁面功能對應表)
- [API 端點與資料結構](#api-端點與資料結構)

---

## 🗄️ 資料庫架構設計

### 關聯圖

```
┌─────────────┐
│   users     │
│  (使用者)    │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────┴─────────────────┐
│                        │
│                        │
┌─────────────┐    ┌─────────────┐
│ flashcards  │    │user_card_   │
│  (題目卡)    │N───┤progress     │
│             │    │ (學習進度)   │
└──────┬──────┘    └──────┬──────┘
       │ N                │
       │                  │
       │            ┌─────┴──────┐
       │            │            │
       │      ┌─────────────┐   │
       └──────┤test_records │───┘
              │ (測驗記錄)   │
              └─────────────┘
```

---

## 📊 Table 詳細規格

### 1️⃣ `users` - 使用者資料表

儲存使用者基本資料、等級與經驗值。

| 欄位名稱 | 資料類型 | 約束條件 | 說明 |
|---------|---------|---------|------|
| `id` | UUID | PRIMARY KEY | 使用者唯一識別碼 |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | 使用者名稱 |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | 電子郵件 |
| `avatar_url` | TEXT | NULLABLE | 頭像 URL |
| `current_level` | INTEGER | NOT NULL, DEFAULT 1 | 當前等級 (1-99) |
| `current_xp` | INTEGER | NOT NULL, DEFAULT 0 | 當前經驗值 |
| `next_level_xp` | INTEGER | NOT NULL, DEFAULT 100 | 升級所需 XP |
| `total_cards` | INTEGER | NOT NULL, DEFAULT 0 | 使用者建立的卡片總數 (用於成就統計) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 建立時間 |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新時間 |

**索引:**
- `idx_users_email` ON `email`
- `idx_users_username` ON `username`

**範例資料:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "琳的",
  "email": "ling@example.com",
  "avatar_url": "https://lh3.googleusercontent.com/...",
  "current_level": 12,
  "current_xp": 95,
  "next_level_xp": 100,
  "total_cards": 110,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-26T10:00:00Z"
}
```

---

### 2️⃣ `flashcards` - 題目卡片表

儲存所有題目卡的內容資料。

| 欄位名稱 | 資料類型 | 約束條件 | 說明 |
|---------|---------|---------|------|
| `id` | UUID | PRIMARY KEY | 卡片唯一識別碼 |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL | 建立者 ID |
| `category` | VARCHAR(50) | NOT NULL | 分類標籤 (Backend, Frontend, JS, Lib) |
| `english_term` | VARCHAR(255) | NOT NULL | 英文原文 |
| `chinese_translation` | VARCHAR(255) | NOT NULL | 中文翻譯 |
| `abbreviation` | VARCHAR(50) | NULLABLE | 代號或縮寫 |
| `description` | TEXT | NOT NULL | 內容說明 |
| `analogy` | TEXT | NULLABLE | 生活化比喻 |
| `is_public` | BOOLEAN | NOT NULL, DEFAULT false | 是否公開 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 建立時間 |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新時間 |

**索引:**
- `idx_flashcards_user_id` ON `user_id`
- `idx_flashcards_category` ON `category`
- `idx_flashcards_english_term` ON `english_term`

**範例資料:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "Backend",
  "english_term": "Application Programming Interface",
  "chinese_translation": "應用程式介面",
  "abbreviation": "API",
  "description": "API 是軟體與軟體之間溝通的橋樑，讓不同程式可以互相交換資料或使用彼此的功能，而不需要知道對方的內部程式碼怎麼寫。",
  "analogy": "API 就像是餐廳的服務生，你（用戶端）看菜單點餐，服務生將你的需求傳達給廚房（伺服器），最後再把做好的菜送到你桌上。你不需要知道廚房怎麼開火，只需要透過服務生就能得到食物。",
  "is_public": false,
  "created_at": "2026-01-15T08:30:00Z",
  "updated_at": "2026-01-20T14:22:00Z"
}
```

---

### 3️⃣ `user_card_progress` - 學習進度表

記錄每個使用者對特定卡片的學習進度與熟悉度。

| 欄位名稱 | 資料類型 | 約束條件 | 說明 |
|---------|---------|---------|------|
| `id` | UUID | PRIMARY KEY | 進度記錄 ID |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL | 使用者 ID |
| `card_id` | UUID | FOREIGN KEY (flashcards.id), NOT NULL | 卡片 ID |
| `mastery_level` | INTEGER | NOT NULL, DEFAULT 0 | 熟悉度 (0=不熟悉, 1-5=等級) |
| `times_reviewed` | INTEGER | NOT NULL, DEFAULT 0 | 總複習次數 |
| `times_correct` | INTEGER | NOT NULL, DEFAULT 0 | 答對次數 |
| `times_incorrect` | INTEGER | NOT NULL, DEFAULT 0 | 答錯次數 |
| `last_reviewed_at` | TIMESTAMP | NULLABLE | 最後複習時間 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 首次學習時間 |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新時間 |

**約束:**
- `UNIQUE (user_id, card_id)` - 每個使用者對每張卡片只有一筆進度記錄

**索引:**
- `idx_progress_user_card` ON `(user_id, card_id)` UNIQUE
- `idx_progress_mastery` ON `mastery_level`

**範例資料:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "card_id": "660e8400-e29b-41d4-a716-446655440001",
  "mastery_level": 3,
  "times_reviewed": 15,
  "times_correct": 12,
  "times_incorrect": 3,
  "last_reviewed_at": "2026-01-26T09:30:00Z",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-26T09:30:00Z"
}
```

---

### 4️⃣ `test_records` - 測驗記錄表

記錄每次測驗的詳細資料，用於統計分析與排行榜。

| 欄位名稱 | 資料類型 | 約束條件 | 說明 |
|---------|---------|---------|------|
| `id` | UUID | PRIMARY KEY | 測驗記錄 ID |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL | 使用者 ID |
| `card_id` | UUID | FOREIGN KEY (flashcards.id), NOT NULL | 卡片 ID |
| `is_correct` | BOOLEAN | NOT NULL | 是否答對 |
| `response_time_ms` | INTEGER | NULLABLE | 回答時間 (毫秒) |
| `test_type` | VARCHAR(20) | NOT NULL | 測驗類型 (reveal, quiz, practice) |
| `xp_earned` | INTEGER | NOT NULL, DEFAULT 0 | 獲得的 XP |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 測驗時間 |

**索引:**
- `idx_test_user_id` ON `user_id`
- `idx_test_card_id` ON `card_id`
- `idx_test_created_at` ON `created_at`

**範例資料:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "card_id": "660e8400-e29b-41d4-a716-446655440001",
  "is_correct": true,
  "response_time_ms": 3500,
  "test_type": "quiz",
  "xp_earned": 10,
  "created_at": "2026-01-26T09:30:00Z"
}
```

---

### 5️⃣ `categories` - 分類表 (可選)

如果要讓分類更有彈性，可以建立此表。

| 欄位名稱 | 資料類型 | 約束條件 | 說明 |
|---------|---------|---------|------|
| `id` | UUID | PRIMARY KEY | 分類 ID |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE | 分類名稱 |
| `color` | VARCHAR(7) | NOT NULL, DEFAULT '#FFD600' | 顯示顏色 (HEX) |
| `icon` | VARCHAR(50) | NULLABLE | Material Icon 名稱 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 建立時間 |

**範例資料:**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "name": "Backend",
  "color": "#FFD600",
  "icon": "storage",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

## 📄 頁面功能對應表

### 功能矩陣

| 頁面 | Create | Read | Update | Delete | 主要功能 |
|------|--------|------|--------|--------|---------|
| [index.html](#indexhtml) | ❌ | ✅ | ❌ | ✅ | 瀏覽卡片列表、搜尋、篩選 |
| [build.html](#buildhtml) | ✅ | ❌ | ❌ | ❌ | 建立新卡片 |
| [card.html](#cardhtml) | ❌ | ✅ | ❌ | ❌ | 查看卡片詳情 |
| [edit.html](#edithtml) | ❌ | ✅ | ✅ | ✅ | 編輯、刪除卡片 |
| [test.html](#testhtml) | ✅ | ✅ | ✅ | ❌ | 進行測驗、更新進度 |
| [profile.html](#profilehtml) | ❌ | ✅ | ❌ | ❌ | 查看個人資料、統計 |
| [rank.html](#rankhtml) | ❌ | ✅ | ❌ | ❌ | 查看排行榜 |

---

## 🔌 API 端點與資料結構

### 基礎 URL
```
https://api.vibecoding.com/v1
```

---

## 📍 API 端點詳細規格

### 🏠 index.html

#### 1. 取得使用者卡片列表

**端點:** `GET /flashcards`

**查詢參數:**
```typescript
{
  user_id: string;           // 使用者 ID
  category?: string;         // 篩選分類 (可選)
  mastery_level?: number;    // 篩選熟悉度 0-5 (可選)
  search?: string;           // 搜尋關鍵字 (可選)
  page?: number;             // 頁碼，預設 1
  limit?: number;            // 每頁數量，預設 20
}
```

**請求範例:**
```
GET /flashcards?user_id=550e8400-e29b-41d4-a716-446655440000&category=Backend&mastery_level=0&page=1&limit=20
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "category": "Backend",
        "english_term": "Application Programming Interface",
        "abbreviation": "API",
        "chinese_translation": "應用程式介面",
        "description": "應用程式介面。定義不同組件互動規範。",
        "progress": {
          "mastery_level": 0,
          "times_reviewed": 0,
          "last_reviewed_at": null
        },
        "created_at": "2026-01-15T08:30:00Z"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440002",
        "category": "Frontend",
        "english_term": "Document Object Model",
        "abbreviation": "DOM",
        "chinese_translation": "文件物件模型",
        "description": "HTML 文件的結構化表示。",
        "progress": {
          "mastery_level": 2,
          "times_reviewed": 5,
          "last_reviewed_at": "2026-01-25T14:20:00Z"
        },
        "created_at": "2026-01-16T10:15:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_items": 24,
      "items_per_page": 20
    }
  }
}
```

#### 2. 刪除卡片

**端點:** `DELETE /flashcards/:card_id`

**請求範例:**
```
DELETE /flashcards/660e8400-e29b-41d4-a716-446655440001
```

**請求 Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "卡片已成功刪除",
  "data": {
    "deleted_card_id": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

#### 3. 取得使用者資料 (Header 顯示)

**端點:** `GET /users/:user_id`

**請求範例:**
```
GET /users/550e8400-e29b-41d4-a716-446655440000
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "琳的",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "current_level": 12,
    "current_xp": 95,
    "next_level_xp": 100,
    "total_cards": 24,
    "level_progress_percentage": 95
  }
}
```

---

### 🏗️ build.html

#### 1. 建立新卡片

**端點:** `POST /flashcards`

**請求 Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "term": "API"  // AI 會自動生成完整卡片內容
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "卡片已成功建立",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "Backend",
    "english_term": "Application Programming Interface",
    "chinese_translation": "應用程式介面",
    "abbreviation": "API",
    "description": "API 是軟體與軟體之間溝通的橋樑，讓不同程式可以互相交換資料或使用彼此的功能。",
    "analogy": "API 就像是餐廳的服務生，你（用戶端）看菜單點餐，服務生將你的需求傳達給廚房（伺服器），最後再把做好的菜送到你桌上。",
    "is_public": false,
    "created_at": "2026-01-26T10:45:00Z",
    "xp_earned": 5
  }
}
```

---

### 🎴 card.html

#### 1. 取得單張卡片詳細資訊

**端點:** `GET /flashcards/:card_id`

**查詢參數:**
```typescript
{
  user_id: string;  // 使用者 ID，用於取得該使用者對此卡片的進度
}
```

**請求範例:**
```
GET /flashcards/660e8400-e29b-41d4-a716-446655440001?user_id=550e8400-e29b-41d4-a716-446655440000
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "card": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "category": "Backend",
      "english_term": "Application Programming Interface",
      "chinese_translation": "應用程式介面",
      "abbreviation": "API",
      "description": "API 是軟體與軟體之間溝通的橋樑。",
      "analogy": "API 就像是餐廳的服務生...",
      "created_at": "2026-01-15T08:30:00Z"
    },
    "progress": {
      "mastery_level": 3,
      "times_reviewed": 15,
      "times_correct": 12,
      "times_incorrect": 3,
      "accuracy_rate": 80.0,
      "last_reviewed_at": "2026-01-26T09:30:00Z"
    },
    "user": {
      "current_level": 12,
      "current_xp": 95,
      "next_level_xp": 100,
      "xp_progress_percentage": 95
    }
  }
}
```

---

### ✏️ edit.html

#### 1. 取得卡片資料 (供編輯)

**端點:** `GET /flashcards/:card_id/edit`

**請求範例:**
```
GET /flashcards/660e8400-e29b-41d4-a716-446655440001/edit
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "Backend",
    "english_term": "Application Programming Interface",
    "chinese_translation": "應用程式介面",
    "abbreviation": "API",
    "description": "API 是軟體與軟體之間溝通的橋樑，讓不同程式可以互相交換資料或使用彼此的功能，而不需要知道對方的內部程式碼怎麼寫。",
    "analogy": "API 就像是餐廳的服務生，你（用戶端）看菜單點餐，服務生將你的需求傳達給廚房（伺服器），最後再把做好的菜送到你桌上。你不需要知道廚房怎麼開火，只需要透過服務生就能得到食物。",
    "is_public": false,
    "created_at": "2026-01-15T08:30:00Z",
    "updated_at": "2026-01-20T14:22:00Z"
  }
}
```

#### 2. 更新卡片資料

**端點:** `PUT /flashcards/:card_id`

**請求 Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "Web Development",
  "english_term": "Application Programming Interface",
  "chinese_translation": "應用程式介面",
  "abbreviation": "API",
  "description": "API 是軟體與軟體之間溝通的橋樑，讓不同程式可以互相交換資料或使用彼此的功能，而不需要知道對方的內部程式碼怎麼寫。",
  "analogy": "API 就像是餐廳的服務生，你（用戶端）看菜單點餐，服務生將你的需求傳達給廚房（伺服器），最後再把做好的菜送到你桌上。"
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "卡片已成功更新",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "updated_at": "2026-01-26T10:50:00Z"
  }
}
```

#### 3. 刪除卡片

**端點:** `DELETE /flashcards/:card_id`

(同 index.html 的刪除功能)

---

### 🧪 test.html

#### 1. 提交測驗結果

**端點:** `POST /test-records`

**請求 Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "card_id": "660e8400-e29b-41d4-a716-446655440001",
  "is_correct": true,
  "response_time_ms": 3500,
  "test_type": "quiz"
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "測驗結果已記錄",
  "data": {
    "test_record_id": "880e8400-e29b-41d4-a716-446655440003",
    "xp_earned": 10,
    "user_progress": {
      "current_level": 12,
      "current_xp": 105,
      "next_level_xp": 200,
      "level_up": true,
      "new_level": 13
    },
    "card_progress": {
      "mastery_level": 3,
      "times_reviewed": 16,
      "times_correct": 13,
      "accuracy_rate": 81.25
    }
  }
}
```

#### 2. 更新卡片熟悉度

**端點:** `PATCH /user-card-progress`

**請求 Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "card_id": "660e8400-e29b-41d4-a716-446655440001",
  "mastery_level": 4
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "熟悉度已更新",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "mastery_level": 4,
    "updated_at": "2026-01-26T10:55:00Z"
  }
}
```

---

### 👤 profile.html

#### 1. 取得使用者完整資料

**端點:** `GET /users/:user_id/profile`

**請求範例:**
```
GET /users/550e8400-e29b-41d4-a716-446655440000/profile
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "琳的",
      "email": "ling@example.com",
      "avatar_url": "https://lh3.googleusercontent.com/...",
      "current_level": 7,
      "current_xp": 12450,
      "next_level_xp": 15000,
      "total_cards": 110
    },
    "statistics": {
      "total_reviews": 450,
      "total_correct": 380,
      "total_incorrect": 70,
      "overall_accuracy": 84.4,
      "streak_days": 7,
      "mastery_distribution": {
        "unfamiliar": 15,
        "level_1": 20,
        "level_2": 25,
        "level_3": 30,
        "level_4": 15,
        "level_5": 5
      }
    }
  }
}
```

#### 2. 匯出卡片資料 (JSON)

**端點:** `GET /users/:user_id/export`

**請求範例:**
```
GET /users/550e8400-e29b-41d4-a716-446655440000/export
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "export_date": "2026-01-26T11:00:00Z",
    "user": {
      "username": "琳的",
      "current_level": 7,
      "current_xp": 12450
    },
    "flashcards": [
      {
        "category": "Backend",
        "english_term": "Application Programming Interface",
        "chinese_translation": "應用程式介面",
        "abbreviation": "API",
        "description": "...",
        "analogy": "...",
        "progress": {
          "mastery_level": 3,
          "times_reviewed": 15
        }
      }
      // ... 所有卡片
    ]
  }
}
```

#### 3. 匯入卡片資料 (JSON)

**端點:** `POST /users/:user_id/import`

**請求 Body:**
```json
{
  "flashcards": [
    {
      "category": "Backend",
      "english_term": "RESTful API",
      "chinese_translation": "表現層狀態轉換 API",
      "abbreviation": "REST",
      "description": "...",
      "analogy": "..."
    }
  ]
}
```

**回應格式:**
```json
{
  "success": true,
  "message": "已成功匯入 5 張卡片",
  "data": {
    "imported_count": 5,
    "skipped_count": 2,
    "failed_count": 0
  }
}
```

---

### 🏆 rank.html

#### 1. 取得等級排行榜

**端點:** `GET /rankings/level`

**查詢參數:**
```typescript
{
  page?: number;    // 頁碼，預設 1
  limit?: number;   // 每頁數量，預設 50
}
```

**請求範例:**
```
GET /rankings/level?page=1&limit=50
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "rankings": [
      {
        "rank": 1,
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "CodeMaster",
        "avatar_url": "https://...",
        "current_level": 25,
        "current_xp": 45000,
        "total_cards": 350
      },
      {
        "rank": 2,
        "user_id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "琳的",
        "avatar_url": "https://...",
        "current_level": 12,
        "current_xp": 12450,
        "total_cards": 110
      }
      // ... 更多使用者
    ],
    "current_user_rank": {
      "rank": 2,
      "username": "琳的",
      "current_level": 12
    },
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_users": 250
    }
  }
}
```

#### 2. 取得卡片數量排行榜

**端點:** `GET /rankings/cards`

**查詢參數:**
```typescript
{
  page?: number;    // 頁碼，預設 1
  limit?: number;   // 每頁數量，預設 50
}
```

**請求範例:**
```
GET /rankings/cards?page=1&limit=50
```

**回應格式:**
```json
{
  "success": true,
  "data": {
    "rankings": [
      {
        "rank": 1,
        "user_id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "FlashcardKing",
        "avatar_url": "https://...",
        "total_cards": 500,
        "current_level": 18
      },
      {
        "rank": 2,
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "CodeMaster",
        "avatar_url": "https://...",
        "total_cards": 350,
        "current_level": 25
      }
      // ... 更多使用者
    ],
    "current_user_rank": {
      "rank": 15,
      "username": "琳的",
      "total_cards": 110
    },
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_users": 250
    }
  }
}
```

---

## 🔐 錯誤處理

所有 API 在發生錯誤時，都會回傳統一格式:

```json
{
  "success": false,
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "找不到指定的卡片",
    "details": {
      "card_id": "660e8400-e29b-41d4-a716-446655440001"
    }
  }
}
```

### 常見錯誤代碼

| 錯誤代碼 | HTTP 狀態 | 說明 |
|---------|----------|------|
| `UNAUTHORIZED` | 401 | 未授權，需要登入 |
| `FORBIDDEN` | 403 | 無權限執行此操作 |
| `CARD_NOT_FOUND` | 404 | 卡片不存在 |
| `USER_NOT_FOUND` | 404 | 使用者不存在 |
| `VALIDATION_ERROR` | 422 | 資料驗證失敗 |
| `DUPLICATE_CARD` | 409 | 卡片已存在 |
| `RATE_LIMIT_EXCEEDED` | 429 | 請求過於頻繁 |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤 |

---

## 📝 資料驗證規則

### Flashcard 驗證

```typescript
{
  category: {
    type: "string",
    minLength: 1,
    maxLength: 50,
    required: true
  },
  english_term: {
    type: "string",
    minLength: 1,
    maxLength: 255,
    required: true
  },
  chinese_translation: {
    type: "string",
    minLength: 1,
    maxLength: 255,
    required: true
  },
  abbreviation: {
    type: "string",
    maxLength: 50,
    required: false
  },
  description: {
    type: "string",
    minLength: 10,
    maxLength: 2000,
    required: true
  },
  analogy: {
    type: "string",
    maxLength: 2000,
    required: false
  }
}
```

---

## 🎯 XP 與等級系統

### XP 計算規則

| 動作 | 獲得 XP | 說明 |
|------|---------|-----|
| 建立新卡片 | +50 XP | 包含新增每日一卡 |
| 測驗答對 (1題) | +70 XP | 答對 1/3 題 |
| 測驗答對 (2題) | +85 XP | 答對 2/3 題 |
| 測驗答對 (3題) | +100 XP | 答對 3/3 題 (完美通關) |
| 開拓者獎勵 | +50 XP | 首次滿分通關 |
| 大師勛章 | +15 XP | 解鎖大師勛章 (5題全對) |
| 每日登入 | +50 XP | 每日首次登入 |

### 等級升級公式

```
next_level_xp = 100 * current_level * 1.5
```

範例:
- Lv. 1 → Lv. 2: 需要 150 XP
- Lv. 2 → Lv. 3: 需要 225 XP
- Lv. 12 → Lv. 13: 需要 1800 XP

---

## 🔄 資料同步策略

### 樂觀更新 (Optimistic Updates)

前端在執行操作時，先立即更新 UI，再發送 API 請求。如果請求失敗，則回滾 UI 狀態。

**適用場景:**
- 按讚/收藏卡片
- 更新卡片熟悉度
- 篩選/排序

### 悲觀更新 (Pessimistic Updates)

前端等待 API 回應成功後，才更新 UI。

**適用場景:**
- 建立新卡片
- 刪除卡片
- 提交測驗結果

---

## 📊 效能優化建議

1. **分頁載入**: 卡片列表使用分頁，每頁 20 筆
2. **快取策略**: 使用者資料快取 5 分鐘
3. **索引優化**: 在 `user_id`, `category`, `mastery_level` 建立索引
4. **資料預載**: 首頁載入時預先取得使用者常用分類的卡片
5. **圖片 CDN**: 頭像使用 CDN 加速

---

## 🔒 安全性考量

1. **認證**: 所有 API 需要 JWT Token
2. **授權**: 使用者只能編輯/刪除自己的卡片
3. **SQL 注入防護**: 使用參數化查詢
4. **XSS 防護**: 對使用者輸入進行 HTML 轉義
5. **Rate Limiting**: 每個使用者每分鐘最多 60 個請求

---

## 📌 附註

- 所有時間格式使用 ISO 8601 標準 (`YYYY-MM-DDTHH:mm:ssZ`)
- 所有 ID 使用 UUID v4 格式
- API 回應統一使用 UTF-8 編碼
- 建議使用 HTTPS 加密傳輸

---

**文檔版本:** 1.0.0  
**最後更新:** 2026-01-26
