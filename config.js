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
// 角色由資料庫 users.role 欄位管理，不再寫死 UUID
// 可在 Supabase Dashboard 直接修改 users 表的 role 欄位
// 角色值: 'master_admin' | 'super_admin' | 'sub_admin' | 'user'

/**
 * 角色管理工具 - 從資料庫查詢角色
 * 使用方式:
 *   await RoleManager.init(supabaseClient)  // 初始化
 *   RoleManager.isAdmin()                   // 是否為任何管理員
 *   RoleManager.isSuperAdmin()              // 是否為高級管理員（可匯入 JSON）
 *   RoleManager.isMasterAdmin()             // 是否為最高管理者
 *   RoleManager.role                        // 取得角色字串
 *   RoleManager.masterAdminId               // 取得母版管理者 ID
 */
const RoleManager = {
    role: 'user',
    masterAdminId: null,
    _initialized: false,

    async init(supabaseClient) {
        if (this._initialized) return;
        try {
            // 查詢當前用戶角色
            const { data: roleData } = await supabaseClient.rpc('get_my_role');
            if (roleData) {
                this.role = roleData;
            }

            // 查詢母版管理者 ID（用於共用題庫）
            const { data: masterIdData } = await supabaseClient.rpc('get_master_admin_id');
            if (masterIdData) {
                this.masterAdminId = masterIdData;
            }

            this._initialized = true;
            console.log('RoleManager 已初始化, role:', this.role);
        } catch (err) {
            console.error('RoleManager 初始化失敗:', err);
        }
    },

    isAdmin() {
        return ['master_admin', 'super_admin', 'sub_admin'].includes(this.role);
    },

    isSuperAdmin() {
        return ['master_admin', 'super_admin'].includes(this.role);
    },

    isMasterAdmin() {
        return this.role === 'master_admin';
    },

    isSubAdmin() {
        return this.role === 'sub_admin';
    }
};

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
