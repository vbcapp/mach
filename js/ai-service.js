/**
 * VibeCoding Flashcard - OpenAI API Service
 * 處理與 OpenAI ChatGPT API 的交互
 */

class AIService {
    constructor() {
        // OpenAI API Key - 從 localStorage 或設定中讀取
        this.apiKey = localStorage.getItem('openai_api_key') || '';
        this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    }


    /**
     * 生成弱點分析的 Prompt
     * @param {object} stats - 用戶統計數據
     * @returns {string} - 完整的 prompt
     */
    generateWeaknessAnalysisPrompt(stats) {
        const {
            wrongQuestionCount,
            correctQuestionCount,
            totalAnswered,
            overallAccuracy,
            masteryRate,
            masteredCount,
            remainingQuestions,
            totalQuestionsInBank,
            improvement,
            weakSubjects,
            topWeakQuestions
        } = stats;

        // 格式化弱點科目
        const weakSubjectsText = weakSubjects && weakSubjects.length > 0
            ? weakSubjects.map(s => `- ${s.subject}: 錯誤率 ${Math.round(s.errorRate * 100)}%`).join('\n')
            : '- 暫無明顯弱點科目';

        // 格式化錯題
        const topWeakQuestionsText = topWeakQuestions && topWeakQuestions.length > 0
            ? topWeakQuestions.slice(0, 5).map((q, i) =>
                `${i + 1}. 「${q.question?.substring(0, 30)}...」- 錯 ${q.timesIncorrect} 次`
            ).join('\n')
            : '- 暫無錯題記錄';

        return `你是一位可愛又專業的學習秘書 🎀，請根據以下學員數據，用**可愛秘書風格**（帶有 emoji）給出個人化的學習分析與建議。

**重要格式要求：**
1. 不要開頭打招呼，直接從「## 📊 整體表現」開始
2. 使用 Markdown 格式
3. 語氣要可愛、親切、鼓勵性質，但內容要專業有深度
4. 適當使用 emoji 增加親和力

**必須包含的段落：**
1. ## 📊 整體表現 - 用數據說明目前學習狀態
2. ## 💡 學習建議 - 2-3 個具體可行的建議
3. ## 🔍 詳細分析 - 深入分析弱點、學習模式、進步空間

---

**學員數據：**

📈 答題統計
- 總答題數：${totalAnswered} 題
- 答對：${correctQuestionCount} 題
- 答錯：${wrongQuestionCount} 題
- 整體正確率：${overallAccuracy}%

🎯 熟練度
- 已熟練題目：${masteredCount} 題
- 熟練率：${masteryRate}%
- 待熟練題目：${remainingQuestions} 題
- 題庫總題數：${totalQuestionsInBank} 題

📊 近 7 天進步
- 正確率變化：${improvement?.accuracyChange > 0 ? '+' : ''}${improvement?.accuracyChange || 0}%

⚠️ 弱點科目（依錯誤率排序）
${weakSubjectsText}

❌ 最常答錯的題目
${topWeakQuestionsText}

---

請根據以上數據，給出約 300-500 字的個人化分析。記得用可愛秘書的語氣喔～`;
    }

    /**
     * 調用 AI 生成弱點分析
     * @param {object} stats - 用戶統計數據
     * @returns {Promise<object>} - AI 生成的分析結果
     */
    async generateWeaknessAnalysis(stats) {
        try {
            console.log('開始生成 AI 弱點分析...');

            const prompt = this.generateWeaknessAnalysisPrompt(stats);

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.8,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('OpenAI API 錯誤:', errorData);
                throw new Error(`API 請求失敗: ${response.status} - ${errorData.error?.message || '未知錯誤'}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            console.log('AI 弱點分析生成完成');

            return {
                success: true,
                data: content,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('生成弱點分析失敗:', error);
            return {
                success: false,
                error: {
                    message: error.message || '生成分析時發生錯誤',
                    details: error
                }
            };
        }
    }
}

// 建立全域實例
const aiService = new AIService();
