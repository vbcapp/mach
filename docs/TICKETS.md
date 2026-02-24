# 開發待辦事項 (Development Tickets)

> [!NOTE]
> 此文件記錄系統開發的待辦事項與執行進度。

---

## 🔥 Phase 1: 遊戲化驅動力系統 - 資料庫建置

### T001 - 執行遊戲化資料庫 SQL 腳本
**優先級：** 🔴 極高
**狀態：** ✅ 已完成
**負責人：** 開發者 + DBA

**任務描述：**
在 Supabase SQL Editor 執行遊戲化系統所需的資料庫變更。

**執行步驟：**
1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 複製 `database.md` 中的「遊戲化驅動力系統 - 資料庫變更」SQL 腳本
4. 執行腳本（建議先在測試環境執行）
5. 驗證資料表建立成功

**SQL 內容包含：**
- 建立 `user_badges` 表（徽章系統）
- 建立 `user_records` 表（個人紀錄）
- 擴充 `users` 表（新增 `exam_date`, `daily_goal`）
- 設定 RLS 政策
- 為現有用戶初始化 `user_records`

**驗證方式：**
```sql
-- 檢查資料表是否建立成功
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_badges', 'user_records');

-- 檢查 users 表新欄位
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('exam_date', 'daily_goal');

-- 檢查現有用戶是否有 user_records
SELECT COUNT(*) FROM user_records;
```

**相依性：** 無
**預計時間：** 30 分鐘
**參考文件：** `database.md` (第 9-11 節)

---

## 🚀 Phase 2: API 函式開發

### T002 - 實作今日新增熟練題數 API
**優先級：** 🔴 極高
**狀態：** ✅ 已完成
**負責人：** 後端開發
**相依性：** 無（使用現有資料）

**任務描述：**
新增 API 函式計算「今日新增熟練題數」，用於弱點分析頁顯示。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getTodayMasteredCount(userId)
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    todayMastered: 5,        // 今日新增熟練題數
    weekMastered: 23,         // 本週累積
    consecutiveDays: 3,       // 連續天數
    yesterdayMastered: 4      // 昨日新增（用於比較）
  }
}
```

**實作邏輯：**
1. 查詢 `user_question_progress` 中 `times_correct >= 3` 且 `updated_at` 為今日的題目
2. 比對「昨日已熟練數」算出「今日新增」
3. 計算本週累積（近 7 天）
4. 檢查連續天數（每日都有新增熟練）

**測試案例：**
- [x] 今日首次答題達到熟練
- [x] 今日多題達到熟練
- [x] 今日無新增熟練（回傳 0）
- [x] 新用戶（無歷史資料）

**預計時間：** 2 小時
**參考文件：** `database.md` - `user_question_progress` 表

---

### T003 - 實作本次 vs 歷史正確率 API
**優先級：** 🔴 極高
**狀態：** ✅ 已完成
**負責人：** 後端開發
**相依性：** 無（使用現有資料）

**任務描述：**
新增 API 函式計算「本次答題正確率 vs 歷史平均」。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getRecentVsHistoricalAccuracy(userId, recentCount = 10)
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    recentAccuracy: 85,      // 最近 10 題正確率
    historicalAccuracy: 72,   // 歷史平均
    improvement: +13,         // 進步幅度
    recentCount: 10,          // 最近題數
    historicalCount: 150,     // 歷史題數
    isBestPerformance: true   // 是否為最佳表現
  }
}
```

**實作邏輯：**
1. 查詢 `answer_records` 最近 N 題（依 `created_at` 排序）
2. 計算最近 N 題正確率
3. 查詢歷史所有記錄計算平均正確率
4. 比較並標記是否為最佳表現

**測試案例：**
- [x] 最近表現優於歷史
- [x] 最近表現劣於歷史
- [x] 最近表現持平
- [x] 新用戶（歷史不足 10 題）

**預計時間：** 2 小時
**參考文件：** `database.md` - `answer_records` 表

---

### T004 - 實作錯誤選項分析 API
**優先級：** 🔴 極高
**狀態：** ✅ 已完成
**負責人：** 後端開發
**相依性：** 無（使用現有資料）

**任務描述：**
新增 API 函式分析「學員最常選的錯誤選項」。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getWrongAnswerPatterns(userId, limit = 5)
```

**回傳格式：**
```javascript
{
  success: true,
  data: [
    {
      questionId: 'uuid',
      question: '勞基法第 39 條...',
      subject: '勞動基準法',
      chapter: '工資與工時',
      timesWrong: 5,
      mostCommonWrongAnswer: 'B',
      wrongAnswerCounts: { 'B': 3, 'D': 2 },
      correctAnswer: 'A',
      options: ['選項A', '選項B', '選項C', '選項D']
    }
  ]
}
```

**實作邏輯：**
1. 查詢 `answer_records` 中 `is_correct = false` 的記錄
2. 依 `question_id` 分組統計錯誤次數
3. 統計每題的 `user_answer` 分布
4. 找出最常被選的錯誤選項
5. Join `questions` 表取得題目詳情

**測試案例：**
- [x] 有多個錯誤選項的題目
- [x] 只錯一次的題目
- [x] 無錯誤記錄

**預計時間：** 3 小時
**參考文件：** `database.md` - `answer_records`, `questions` 表

---

### T005 - 實作答題時段效率分析 API
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** 無（使用現有資料）

**任務描述：**
新增 API 函式分析「學員在不同時段的答題效率」。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getHourlyEfficiency(userId)
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    hourlyStats: [
      { hour: 7, correct: 15, total: 18, accuracy: 83 },
      { hour: 8, correct: 20, total: 22, accuracy: 91 },
      // ... 每小時統計
    ],
    bestHour: 8,               // 最佳時段
    worstHour: 23,             // 最差時段
    bestAccuracy: 91,          // 最高正確率
    recommendation: '建議在早上 8-9 點答題'
  }
}
```

**實作邏輯：**
1. 查詢 `answer_records` 全部記錄
2. 從 `created_at` 提取小時（0-23）
3. 按小時分組統計正確率
4. 找出正確率最高/最低時段
5. 生成建議文字

**測試案例：**
- [ ] 有充足數據（每個時段 > 10 題）
- [ ] 數據稀少（某些時段無答題）
- [ ] 新用戶

**預計時間：** 2 小時
**參考文件：** `database.md` - `answer_records` 表

---

### T006 - 實作錯題二刷正確率 API
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** 無（使用現有資料）

**任務描述：**
新增 API 函式計算「上週錯題在本週重做的正確率」。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getRetryAccuracy(userId)
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    lastWeekWrongQuestions: 12,    // 上週錯題總數
    retriedThisWeek: 8,             // 本週重做題數
    retriedCorrect: 5,              // 重做答對數
    retryAccuracy: 63,              // 二刷正確率 (5/8)
    stillWrong: 3,                  // 仍需加強
    notRetried: 4,                  // 尚未重做
    wrongQuestionIds: ['uuid1', 'uuid2', ...]  // 仍錯誤的題目 ID
  }
}
```

**實作邏輯：**
1. 查詢上週（7 天前 ~ 今日開始）答錯的 `question_id`
2. 查詢這些題目在本週（今日開始 ~ 現在）的答題記錄
3. 計算重做正確率
4. 找出仍需加強的題目

**測試案例：**
- [ ] 上週有錯題，本週全部重做
- [ ] 上週有錯題，本週部分重做
- [ ] 上週無錯題
- [ ] 本週無重做

**預計時間：** 3 小時
**參考文件：** `database.md` - `answer_records` 表

---

### T007 - 實作徽章檢查與解鎖 API
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** T001（需 `user_badges` 表）

**任務描述：**
新增 API 函式檢查徽章解鎖條件，並自動解鎖。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async checkAndUnlockBadges(userId)
async getUserBadges(userId)
async getAvailableBadges(userId)  // 取得「即將解鎖」的徽章
```

**回傳格式：**
```javascript
// checkAndUnlockBadges
{
  success: true,
  data: {
    newlyUnlocked: [
      {
        badgeKey: 'hundred_correct',
        badgeName: '百題斬',
        badgeIcon: 'emoji_events',
        unlockedAt: '2026-02-24T10:30:00Z'
      }
    ]
  }
}

// getAvailableBadges（即將解鎖）
{
  success: true,
  data: [
    {
      badgeKey: 'fivehundred_correct',
      badgeName: '五百壯士',
      progress: 87,  // 完成度 (435/500)
      current: 435,
      target: 500,
      remaining: 65
    }
  ]
}
```

**實作邏輯：**
1. 定義所有徽章條件（可寫在前端或獨立 config 文件）
2. 查詢用戶當前統計數據
3. 逐一檢查每個徽章條件
4. 未解鎖且達成 → INSERT INTO `user_badges`
5. 回傳新解鎖的徽章列表

**徽章條件參考：** `database.md` - 徽章類型設計

**測試案例：**
- [ ] 首次達成條件（新解鎖）
- [ ] 已解鎖（不重複新增）
- [ ] 同時達成多個徽章
- [ ] 無新解鎖

**預計時間：** 4 小時
**參考文件：** `database.md` - `user_badges` 表

---

### T008 - 實作個人紀錄追蹤 API
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** T001（需 `user_records` 表）

**任務描述：**
新增 API 函式追蹤與更新個人最佳紀錄。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async updateUserRecords(userId)  // 每次答題後呼叫
async getUserRecords(userId)      // 取得所有紀錄
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    bestDailyAccuracy: 92,
    bestDailyAccuracyDate: '2026-02-20',
    longestCorrectStreak: 18,
    longestCorrectStreakDate: '2026-02-15',
    currentDailyStreak: 5,
    brokenRecords: ['bestDailyAccuracy']  // 本次打破的紀錄
  }
}
```

**實作邏輯：**
1. 計算今日統計（正確率、答對數、連續答對等）
2. 查詢 `user_records` 現有紀錄
3. 比較並更新所有「最佳紀錄」欄位
4. 檢查連續天數（比對 `last_answer_date`）
5. 回傳打破的紀錄列表

**測試案例：**
- [ ] 打破單日最高正確率
- [ ] 打破最長連續答對
- [ ] 連續天數+1
- [ ] 連續天數中斷

**預計時間：** 3 小時
**參考文件：** `database.md` - `user_records` 表

---

### T009 - 實作考試倒數與進度條 API
**優先級：** 🔴 極高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** T001（需 `users.exam_date`, `daily_goal`）

**任務描述：**
新增 API 函式計算考試倒數天數與完成進度。

**實作位置：** `js/api-service.js`

**函式簽名：**
```javascript
async getExamCountdown(userId)
async setExamDate(userId, examDate)
async setDailyGoal(userId, dailyGoal)
```

**回傳格式：**
```javascript
{
  success: true,
  data: {
    examDate: '2026-04-10',
    daysRemaining: 45,
    dailyGoal: 20,
    totalQuestions: 500,
    masteredCount: 340,
    remainingQuestions: 160,
    progressPercent: 68,
    estimatedDays: 20,           // 預估完成天數
    bufferDays: 25,              // 距考試緩衝天數
    onTrack: true,               // 是否跟上進度
    recommendedDailyGoal: 12     // 建議每日題數
  }
}
```

**實作邏輯：**
1. 查詢 `users.exam_date`, `daily_goal`
2. 計算剩餘天數
3. 查詢熟練題數 / 題庫總數 → 進度百分比
4. 計算預估完成天數（剩餘題數 / 每日目標）
5. 比較預估天數 vs 考試天數 → 判斷是否跟上
6. 計算建議每日目標

**測試案例：**
- [ ] 已設定考試日期
- [ ] 未設定考試日期
- [ ] 進度超前（已完成 > 預期）
- [ ] 進度落後

**預計時間：** 2 小時
**參考文件：** `database.md` - `users` 表

---

## 🎨 Phase 3: 前端整合

### T010 - 重新設計弱點分析頁面（weakness.html）
**優先級：** 🔴 極高
**狀態：** ⏳ 待開始
**負責人：** 前端開發
**相依性：** T002, T003, T004, T009

**任務描述：**
根據新的驅動力設計重構弱點分析頁面。

**設計參考：** `docs/PRD.md` - 弱點分析頁面

**實作內容：**
1. **即時成就感區塊**
   - 今日新增熟練題數（含連勝天數）
   - 本次 vs 歷史正確率
   - 錯題二刷正確率

2. **進度條與倒數計時**
   - 考試倒數天數
   - 熟練度進度條
   - 每日目標調整器

3. **錯誤選項分析卡片**
   - 最常選錯的選項
   - 相似題目比對

4. **答題時段效率圖表**
   - 24 小時熱圖
   - 最佳/最差時段標示

5. **個人紀錄展示**
   - 單日最高正確率
   - 最長連續答對
   - 打破紀錄提示

**UI 要求：**
- 使用 Neo-Brutalism 設計風格
- 響應式設計（適配手機）
- 動畫效果（進度條、新解鎖徽章）
- 骨架屏載入效果

**測試案例：**
- [ ] 新用戶（無歷史數據）
- [ ] 老用戶（完整數據）
- [ ] 打破紀錄時的動畫
- [ ] 無網路時的錯誤處理

**預計時間：** 8 小時
**參考文件：** `docs/PRD.md`, `weakness.html`

---

### T011 - 實作徽章系統前端顯示
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 前端開發
**相依性：** T007

**任務描述：**
在個人頁面或弱點分析頁面顯示徽章牆。

**實作內容：**
1. 徽章牆（已解鎖 + 未解鎖）
2. 新解鎖動畫（煙火效果）
3. 即將解鎖提示（進度環）
4. 徽章詳情 Modal

**UI 參考：**
- 已解鎖：彩色圖示 + 解鎖日期
- 未解鎖：灰色圖示 + 解鎖條件
- 即將解鎖（>80%）：閃爍效果

**預計時間：** 6 小時

---

### T012 - 整合答題後觸發徽章/紀錄檢查
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** 後端開發
**相依性：** T007, T008

**任務描述：**
在 `submitAnswer()` 函式中新增徽章與紀錄檢查邏輯。

**實作位置：** `js/api-service.js` - `submitAnswer()`

**修改邏輯：**
```javascript
async submitAnswer(userId, questionId, userAnswer, isCorrect, responseTimeMs) {
    // ... 原有邏輯 ...

    // 新增：檢查徽章解鎖
    const badgeResult = await this.checkAndUnlockBadges(userId);

    // 新增：更新個人紀錄
    const recordResult = await this.updateUserRecords(userId);

    return {
        success: true,
        data: {
            // ... 原有回傳 ...
            newBadges: badgeResult.data.newlyUnlocked,
            brokenRecords: recordResult.data.brokenRecords
        }
    };
}
```

**前端顯示：**
- 新解鎖徽章 → 全螢幕動畫
- 打破紀錄 → Toast 提示

**預計時間：** 2 小時

---

## 📝 Phase 4: 文件更新

### T013 - 更新 PRD.md（弱點分析頁面設計）
**優先級：** 🟡 高
**狀態：** ⏳ 待開始
**負責人：** PM / 技術文件編寫者
**相依性：** 無

**任務描述：**
重新撰寫弱點分析頁面的 PRD 設計文件。

**實作位置：** `docs/PRD.md`

**內容包含：**
1. 頁面目標與使用者價值
2. 功能模組詳細設計
3. UI/UX 規格
4. 數據計算邏輯
5. 互動流程圖

**預計時間：** 2 小時
**參考文件：** 本次對話中的「驅動力數據設計」

---

## 📊 進度追蹤

| Phase | 完成度 | 預計完成日期 |
|-------|--------|-------------|
| Phase 1: 資料庫建置 | ✅ 100% | 2026-02-24 |
| Phase 2: API 開發 | 38% (3/8) | 進行中 |
| Phase 3: 前端整合 | 0% | 待定 |
| Phase 4: 文件更新 | 0% | 待定 |

---

## 🎯 Sprint 建議

### Sprint 1（優先）
- T001: 執行 SQL 腳本
- T002: 今日新增熟練題數 API
- T003: 本次 vs 歷史正確率 API
- T009: 考試倒數 API
- T010: 重新設計弱點分析頁面

### Sprint 2
- T004: 錯誤選項分析 API
- T005: 答題時段效率 API
- T007: 徽章系統 API
- T011: 徽章牆前端
- T012: 答題後觸發檢查

### Sprint 3
- T006: 錯題二刷正確率 API
- T008: 個人紀錄追蹤 API
- T013: 更新 PRD 文件
- 測試與優化

---

## ✅ 驗收標準

所有功能開發完成後，需滿足以下條件：

1. **資料庫**
   - [x] 所有新資料表建立成功
   - [x] RLS 政策正確運作
   - [x] 現有用戶資料無遺失

2. **API 函式**
   - [ ] 所有 API 函式通過單元測試
   - [ ] 錯誤處理完善
   - [ ] 回傳格式符合規格

3. **前端顯示**
   - [ ] 所有數據正確顯示
   - [ ] 動畫效果流暢
   - [ ] 響應式設計正常

4. **效能**
   - [ ] API 回應時間 < 500ms
   - [ ] 頁面載入時間 < 2s
   - [ ] 無記憶體洩漏

5. **文件**
   - [ ] PRD 文件完整
   - [ ] API 文件更新
   - [ ] 資料庫架構圖更新
