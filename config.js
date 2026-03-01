// ==================== Supabase 配置 ====================
// ✅ 已自動配置為你的 Supabase 專案
const SUPABASE_CONFIG = {
    url: 'https://mwwvrapnjekxwxpyolcm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d3ZyYXBuamVreHd4cHlvbGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTM5MjgsImV4cCI6MjA4Nzg2OTkyOH0.kfzTvhZaaV7JPP38fu60b9sCTrBf5XTxYiT78Oov2lw'
};

// ==================== XP 系統常數 ====================
const XP_REWARDS = {
    CORRECT: 100,      // 單題答對
    INCORRECT: 0,      // 單題答錯 (不扣分)
    PIONEER: 50,       // 開拓者獎勵（首次答對該題）
    DAILY_LOGIN: 50    // 每日登入
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
// 管理員 UUID 配置
const MASTER_ADMIN_ID = '96e40a3a-5417-4cd2-bc64-beffab960331'; // 原始管理員 (母版卡片來源) ceceloveye@gmail.com

// 最高管理者 UUID（可匯入 JSON、完整管理權限）
const SUPER_ADMIN_UUIDS = [
    '96e40a3a-5417-4cd2-bc64-beffab960331', // ceceloveye@gmail.com
];

// 次高管理者 UUID（管理儀表板，但不能匯入 JSON）
const SUB_ADMIN_UUIDS = [
    '074640cd-6b42-4115-a7c2-4218e4e0169a', // cecelove_e@hotmail.com
];

// 所有管理員（包含最高+次高，用於向下相容）
const ADMIN_UUIDS = [
    ...SUPER_ADMIN_UUIDS,
    ...SUB_ADMIN_UUIDS,
    '17da7d22-17ad-4d40-a5d2-9c2ce9216cf0', // Original Admin
    '3a5bb55c-4ffc-4373-a9b5-f211b4b4d63b', // New Admin
    '03ff6033-ce0e-41ee-9734-fce32c10b1bb',  // imnivek@gmail.com
];

// ==================== 學員白名單 ====================
// 只有在名單內的 Email 才能註冊或登入
// 請將所有學員 Email 加入此陣列 (記得保留管理員 Email)
// [Security] 學員白名單 (目前暫時關閉: 改名為 STUDENT_EMAILS_OFF 即可)
// 若要開啟白名單功能，請將變數名稱改回: const STUDENT_EMAILS = [ ... ];
const STUDENT_EMAILS_OFF = [
    'ceceloveye@gmail.com',         // Admin 1
    'b1230463@ulive.pccu.edu.tw',   // Admin 2
    'boonling2003212@gmail.com',
    'imnivek@gmail.com',            // Admin 3
    // 在此新增學員 Email，例如: 'student1@example.com',
];

// ==================== 等級計算公式 ====================
// 計算下一等級所需 XP
function calculateNextLevelXp(currentLevel) {
    return Math.floor(100 * currentLevel * 1.5);
}
