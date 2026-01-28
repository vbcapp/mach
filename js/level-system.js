/**
 * LevelSystem
 * 處理等級計算與經驗值邏輯
 */
const LevelSystem = {
    /**
     * 取得特定等級升級所需經驗值
     * @param {number} level 
     */
    getLevelRequirement(level) {
        if (level < 10) {
            return level * 100;
        } else {
            return 1000;
        }
    },

    /**
     * 計算理論等級與進度
     * @param {number} totalXP 累積總經驗值
     * @returns {object} { level, xpForNextLevel, progressInLevel, currentLevelStartXP }
     */
    calculateTheoreticalLevel(totalXP) {
        let level = 1;
        let xp = totalXP;

        // 模擬升級過程扣除 XP 來找出當前等級
        while (true) {
            const nextReq = this.getLevelRequirement(level);

            if (xp < nextReq) {
                // 不足以升級，停在當前等級
                return {
                    level: level,
                    xpForNextLevel: nextReq,
                    progressInLevel: xp, // 當前等級已獲得的 XP (用於進度條)
                    currentLevelStartXP: totalXP - xp // 當前等級的起始 XP (累計值)
                };
            }

            // 升級，扣除所需 XP
            xp -= nextReq;
            level++;
        }
    },

    /**
     * 計算實際等級 (考慮突破門檻)
     * @param {number} totalXP 累積總經驗值
     * @param {number} perfectCardCount 滿分卡數量
     * @returns {object} 包含完整等級資訊
     */
    calculateState(totalXP, perfectCardCount) {
        const theoretical = this.calculateTheoreticalLevel(totalXP);

        // 實際等級受限於滿分卡數量
        // Rule: Actual Level <= Perfect Cards + 1
        const maxLevel = perfectCardCount + 1;
        const actualLevel = Math.min(theoretical.level, maxLevel);
        const isCapped = theoretical.level > maxLevel;

        // 如果被卡住，current_level_xp 應該顯示該等級的滿額數值
        // 沒有被卡住，則顯示理論進度
        const actualLevelRequirement = this.getLevelRequirement(actualLevel);
        const currentLevelXP = isCapped ? actualLevelRequirement : theoretical.progressInLevel;

        return {
            ...theoretical,
            actualLevel: actualLevel,
            maxLevel: maxLevel,
            isCapped: isCapped,
            // 新增：修正後的當前等級 XP (用於資料庫存檔)
            currentLevelXP: currentLevelXP,
            // 如果被卡住，顯示滿條；否則顯示實際進度比例
            displayProgress: isCapped ? 100 : (theoretical.progressInLevel / theoretical.xpForNextLevel) * 100
        };
    }
};
