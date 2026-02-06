// ==================== Supabase 配置 ====================
// ✅ 已自動配置為你的 Supabase 專案
const SUPABASE_CONFIG = {
    url: 'https://izkduljyuscydklvagxm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6a2R1bGp5dXNjeWRrbHZhZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzM0NzYsImV4cCI6MjA4NDY0OTQ3Nn0.LsFTCFriM6Ro4HhQ0bwfPT472RP3Ml5eiQx5IUmdrrg'
};

// ==================== XP 系統常數 ====================
const XP_REWARDS = {
    CREATE_CARD: 5,
    CORRECT_FIRST: 10,
    CORRECT_REVIEW: 5,
    INCORRECT: 0,
    STREAK_BONUS: 50,
    MASTERY_MAX_BONUS: 25
};

// ==================== 錯誤代碼 ====================
const ERROR_CODES = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    CARD_NOT_FOUND: 'CARD_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DUPLICATE_CARD: 'DUPLICATE_CARD',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// ==================== 管理員配置 ====================
// 管理員 UUID - 請替換為實際的管理員 UUID
const ADMIN_UUID = '17da7d22-17ad-4d40-a5d2-9c2ce9216cf0'; // 請修改為實際的管理員 UUID

// ==================== 等級計算公式 ====================
// 計算下一等級所需 XP
function calculateNextLevelXp(currentLevel) {
    return Math.floor(100 * currentLevel * 1.5);
}
