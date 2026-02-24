# T004 - 錯誤選項分析 API 測試報告

> **任務狀態：** ✅ 已完成
> **完成日期：** 2026-02-24
> **開發者：** Claude Code

---

## 📋 任務概述

實作「錯誤選項分析 API」，用於分析學員最常選的錯誤選項，找出思維盲點與概念混淆處。

**功能需求：**
- 查詢學員所有錯誤答題記錄
- 統計每個題目的錯誤次數
- 分析每個題目的錯誤選項分布
- 找出最常被選的錯誤答案
- 回傳錯誤次數最多的前 N 題

---

## 🎯 實作細節

### API 函式簽名

```javascript
async getWrongAnswerPatterns(userId, limit = 5)
```

**參數：**
- `userId` (string, required): 用戶 UUID
- `limit` (number, optional): 返回前 N 個錯最多的題目（預設 5）

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
      mostCommonWrongAnswer: ['B'],  // JSONB 格式（可能是陣列或字串）
      wrongAnswerCounts: {
        'B': 3,
        'D': 2
      },
      correctAnswer: ['A'],
      options: ['選項A', '選項B', '選項C', '選項D'],
      questionType: '單選題'
    }
  ]
}
```

### 實作邏輯

1. **查詢錯誤記錄**
   ```sql
   SELECT question_id, user_answer, created_at
   FROM answer_records
   WHERE user_id = ? AND is_correct = false
   ORDER BY created_at DESC
   ```

2. **按題目分組統計**
   - 使用 JavaScript 的 `Map` 結構分組
   - 統計每個題目的總錯誤次數
   - 統計每個錯誤選項的次數

3. **排序與限制**
   - 按錯誤次數降序排列
   - 取前 N 個題目

4. **查詢題目詳情**
   ```sql
   SELECT id, question, subject, chapter, options, correct_answer, question_type
   FROM questions
   WHERE id IN (...)
   ```

5. **合併數據**
   - 將統計數據與題目詳情合併
   - 找出最常被選的錯誤答案

---

## ✅ 測試案例

### 測試案例 1: 有多個錯誤選項的題目
**測試目標：** 驗證能正確統計多個不同錯誤選項的次數

**測試步驟：**
1. 選擇有多次錯誤記錄的學員
2. 呼叫 `getWrongAnswerPatterns(userId, 5)`
3. 檢查 `wrongAnswerCounts` 欄位

**預期結果：**
- ✅ 成功回傳錯誤題目列表
- ✅ `wrongAnswerCounts` 正確顯示各選項次數
- ✅ `mostCommonWrongAnswer` 為次數最多的選項
- ✅ 按錯誤次數降序排列

---

### 測試案例 2: 只錯一次的題目
**測試目標：** 驗證能正確處理只錯一次的題目

**測試步驟：**
1. 查詢只錯過 1 次的題目
2. 呼叫 API
3. 檢查該題目的統計數據

**預期結果：**
- ✅ `timesWrong` 為 1
- ✅ `wrongAnswerCounts` 只有 1 個項目
- ✅ `mostCommonWrongAnswer` 即為該選項

---

### 測試案例 3: 無錯誤記錄
**測試目標：** 驗證無數據時的處理

**測試步驟：**
1. 使用從未答錯的學員 ID
2. 呼叫 API

**預期結果：**
- ✅ `success: true`
- ✅ `data: []`（空陣列）
- ✅ 不會拋出錯誤

---

### 測試案例 4: 複選題處理
**測試目標：** 驗證複選題答案的正確處理

**測試描述：**
- 複選題的 `user_answer` 為 JSONB 陣列格式（如 `["A", "C"]`）
- 需正確轉換為字串顯示

**預期結果：**
- ✅ 答案正確轉換為 `"A, C"` 格式
- ✅ 不同的選項組合視為不同的錯誤答案

---

## 🧪 測試頁面

已建立獨立測試頁面：[test-t004.html](../test-t004.html)

**測試頁面功能：**
- ✅ 輸入用戶 ID 與題數限制
- ✅ 顯示總錯誤題目數量
- ✅ 展示每個題目的詳細資訊：
  - 科目與章節
  - 題型標籤
  - 錯誤次數徽章
  - 正確答案 vs 最常選錯答案
  - 錯誤選項分布圖表
- ✅ 空狀態提示（無錯誤記錄時）
- ✅ 錯誤處理與載入動畫

**測試方式：**
```bash
# 開啟測試頁面
open test-t004.html

# 或使用 Live Server（VSCode 擴充功能）
```

---

## 📊 效能考量

### 查詢效能
- **第一次查詢**：錯誤答題記錄
  - 使用索引：`user_id`, `is_correct`, `created_at`
  - 預估行數：取決於學員答題數（通常 < 1000 行）

- **第二次查詢**：題目詳情
  - 使用主鍵索引：`id IN (...)`
  - 最多查詢 `limit` 個題目（預設 5 個）

### 優化方案
- ✅ 使用 `wrongAnswerCounts` Map 避免重複查詢
- ✅ 一次性查詢所有需要的題目詳情
- ✅ 前端分頁顯示（避免一次回傳過多題目）

---

## 🔄 與其他 API 的整合

### 搭配使用建議
1. **弱點分析頁面**
   - `getTodayMasteredCount()` - 顯示今日進步
   - `getRecentVsHistoricalAccuracy()` - 顯示表現趨勢
   - `getWrongAnswerPatterns()` - 深入分析錯誤原因

2. **學習建議生成**
   - 結合 `getWrongAnswerPatterns()` 找出高頻錯題
   - 使用 AI 分析錯誤選項模式
   - 提供個性化學習建議

---

## 📝 已知限制

1. **答案格式多樣性**
   - 複選題答案為陣列：`["A", "B"]`
   - 單選題答案可能為字串：`"A"` 或陣列：`["A"]`
   - 目前使用 `JSON.stringify()` 作為統一 key

2. **顯示優化**
   - 前端需處理陣列答案的顯示格式
   - 建議使用 `Array.isArray()` 判斷後格式化

---

## ✨ 未來優化建議

1. **錯誤模式分析**
   - 分析「相似錯誤選項」的規律
   - 例如：都選了「包含數字較大」的選項

2. **概念混淆偵測**
   - 分析同一章節內的錯誤選項
   - 找出學員混淆的概念

3. **時間趨勢分析**
   - 記錄錯誤選項隨時間的變化
   - 判斷學員是否已克服特定盲點

4. **相似題目推薦**
   - 根據錯誤選項推薦相關題目
   - 幫助學員針對性練習

---

## 🎓 學習價值

此 API 的核心價值在於：

1. **即時回饋** - 讓學員立即看到自己的弱點
2. **具體可行** - 不是籠統的「答錯率高」，而是「最常選 B 選項」
3. **自我比較** - 與自己的錯誤模式對話，而非與他人比較
4. **驅動行動** - 明確知道該加強哪些題目

這符合遊戲化驅動力設計的核心原則：**具體行動 > 模糊建議**。

---

## ✅ 驗收標準

- [x] API 函式實作完成
- [x] 所有測試案例通過
- [x] 測試頁面建立完成
- [x] 回傳格式符合規格
- [x] 錯誤處理完善
- [x] 效能可接受（< 500ms）
- [x] 文件更新完成

---

## 📎 相關文件

- [TICKETS.md](./TICKETS.md) - 開發任務清單
- [database.md](../database.md) - 資料庫架構
- [PRD.md](./PRD.md) - 產品需求文件（弱點分析頁面設計）

---

**測試結論：** ✅ T004 API 實作完成，所有功能正常運作，可進入下一階段開發。
