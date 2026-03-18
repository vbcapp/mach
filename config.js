// ==================== SaaS 企業設定 ====================
// 部署給不同企業時，只需修改這 2 個值（指向該企業的 Supabase 專案）
// 企業名稱、Logo 等品牌資訊全部從資料庫 organization_settings 表讀取
const SUPABASE_CONFIG = {
    url: 'https://vryyyyivmbbqahlaafdn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXl5eWl2bWJicWFobGFhZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTU4MzMsImV4cCI6MjA4NzE5MTgzM30.CuBBkWyFSh9vpIYX5CdgZ01qH3YkTIdl-ewOQcmVa3U'
};

// ==================== 租戶工具（從 SUPABASE_CONFIG 衍生） ====================
const TenantResolver = {
    getProjectRef() {
        const match = SUPABASE_CONFIG.url.match(/https:\/\/([^.]+)\.supabase\.co/);
        return match ? match[1] : '';
    },
    getAuthTokenKey() {
        return `sb-${this.getProjectRef()}-auth-token`;
    }
};

// ==================== 組織品牌 ====================
// 所有品牌資訊從資料庫 organization_settings 表讀取
// 切換 Supabase 專案 = 自動切換企業名稱、Logo 等
const OrgBranding = {
    orgName: '',
    shortName: '',
    description: '',
    footerText: '',
    appVersion: '',
    primaryColor: '#FFD600',
    logoUrl: '',
    socialLinks: [], // 社群連結陣列 [{platform, url}, ...]

    // 計分設定（從 DB 讀取，預設值與原本硬編碼一致）
    baseScore: 100,
    incorrectScore: 0,
    dailyLoginScore: 50,
    criticalHitEnabled: true,
    criticalHitMultipliers: [2, 3, 4, 5, 10],
    levelRequirements: null,

    _loaded: false,
    _fetchPromise: null,

    // 從資料庫讀取品牌資料（不需要登入，用 anon key 即可讀取）
    async fetch(supabaseClient) {
        // 避免重複發請求
        if (this._loaded) {
            this.applyToDOM();
            return;
        }
        if (this._fetchPromise) return this._fetchPromise;

        this._fetchPromise = (async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('organization_settings')
                    .select('*')
                    .single();

                if (data && !error) {
                    this.orgName = data.org_name || '';
                    this.shortName = data.short_name || '';
                    this.description = data.description || '';
                    this.appVersion = data.app_version || '';
                    this.footerText = data.footer_text || '';
                    this.primaryColor = data.primary_color || this.primaryColor;
                    this.logoUrl = data.logo_url || '';

                    // 計分設定（注意：0 和 false 是合法值，不能用 || fallback）
                    this.baseScore = (data.base_score != null) ? data.base_score : 100;
                    this.incorrectScore = (data.incorrect_score != null) ? data.incorrect_score : 0;
                    this.dailyLoginScore = (data.daily_login_score != null) ? data.daily_login_score : 50;
                    this.criticalHitEnabled = (data.critical_hit_enabled != null) ? data.critical_hit_enabled : true;
                    this.criticalHitMultipliers = Array.isArray(data.critical_hit_multipliers) ? data.critical_hit_multipliers : [2, 3, 4, 5, 10];
                    this.levelRequirements = data.level_requirements || null;
                    this.socialLinks = Array.isArray(data.social_links) ? data.social_links : [];

                    this._loaded = true;
                }
            } catch (e) {
                console.warn('從資料庫載入組織設定失敗:', e);
            }

            this.applyToDOM();
            this._updateManifest();
        })();

        return this._fetchPromise;
    },

    // 將品牌資訊套用到 DOM
    applyToDOM() {
        if (!this.orgName) return; // 尚未載入，跳過

        document.querySelectorAll('[data-brand="org-name"]').forEach(el => {
            el.textContent = this.orgName;
        });

        document.querySelectorAll('[data-brand="short-name"]').forEach(el => {
            el.textContent = this.shortName;
        });

        document.querySelectorAll('[data-brand="footer"]').forEach(el => {
            el.textContent = this.footerText;
        });

        document.querySelectorAll('[data-brand="description"]').forEach(el => {
            el.textContent = this.description;
        });

        // Logo
        document.querySelectorAll('[data-brand="logo"]').forEach(el => {
            if (this.logoUrl && el.tagName === 'IMG') {
                el.src = this.logoUrl;
            }
        });

        // 頁面標題（<title> tag）
        const titleSuffix = document.title.replace(/^[^-–—]*[-–—]\s*/, '');
        if (titleSuffix && titleSuffix !== document.title) {
            document.title = `${this.orgName} - ${titleSuffix}`;
        } else {
            document.title = this.orgName;
        }

        // Apple meta tag
        const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (appleMeta) {
            appleMeta.setAttribute('content', this.shortName);
        }

        // OG / Twitter meta tags（覆蓋靜態預設值，讓分享預覽顯示企業品牌）
        const metaUpdates = {
            'meta[property="og:title"]': this.orgName,
            'meta[property="og:description"]': this.description || '智慧考試練習平台，隨時隨地刷題備考',
            'meta[name="twitter:title"]': this.orgName,
            'meta[name="twitter:description"]': this.description || '智慧考試練習平台，隨時隨地刷題備考',
            'meta[name="description"]': this.description || '智慧考試練習平台，隨時隨地刷題備考',
        };
        for (const [selector, value] of Object.entries(metaUpdates)) {
            const el = document.querySelector(selector);
            if (el) el.setAttribute('content', value);
        }

        // 社群連結
        this.renderSocialLinks();

        // 重新渲染 Header（因為 AppHeader.init() 可能在品牌載入前就執行了）
        if (typeof AppHeader !== 'undefined') {
            AppHeader.init();
        }
    },

    // 社群連結 platform 對應的 icon 與顏色
    SOCIAL_PLATFORM_MAP: {
        threads:   { bg: '#000000', icon: '<span class="text-white font-black text-xl">@</span>' },
        facebook:  { bg: '#1877F2', icon: '<span class="text-white font-black text-xl">f</span>' },
        linkedin:  { bg: '#0077B5', icon: '<span class="text-white font-black text-xl">in</span>' },
        line:      { bg: '#06C755', icon: '<span class="material-symbols-outlined text-white">chat_bubble</span>' },
        instagram: { bg: '#E4405F', icon: '<span class="material-symbols-outlined text-white">photo_camera</span>' },
        website:   { bg: '#333333', icon: '<span class="material-symbols-outlined text-white">language</span>' },
    },

    renderSocialLinks() {
        const container = document.getElementById('social-links-section');
        if (!container) return;

        const links = [...this.socialLinks]
            .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99))
            .slice(0, 4); // 最多 4 個
        if (links.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        const grid = container.querySelector('#social-links-grid');
        if (!grid) return;

        // 動態調整 grid 欄數
        grid.className = `grid grid-cols-${links.length} gap-3`;
        grid.innerHTML = '';

        links.forEach(item => {
            const config = this.SOCIAL_PLATFORM_MAP[item.type || item.platform];
            if (!config || !item.url) return;

            const a = document.createElement('a');
            a.href = item.url;
            a.target = '_blank';
            a.className = 'aspect-square border-4 border-black flex items-center justify-center neo-brutalism-button shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
            a.style.backgroundColor = config.bg;
            a.innerHTML = config.icon;
            grid.appendChild(a);
        });
    },

    // 動態產生 PWA Manifest
    _updateManifest() {
        const manifest = {
            name: this.orgName || '考試系統',
            short_name: this.shortName || '考試',
            description: this.description || '企業證照考試練習平台',
            start_url: '/index.html',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#ffffff',
            theme_color: '#000000',
            icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        };

        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const manifestUrl = URL.createObjectURL(blob);

        const existing = document.querySelector('link[rel="manifest"]');
        if (existing) existing.remove();

        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);
    }
};

// ==================== 共享 Supabase Client ====================
// 全域共享單一 client，避免產生多個 GoTrueClient 實例
window._sharedSupabaseClient = null;

function getSharedSupabaseClient() {
    if (!window._sharedSupabaseClient && typeof supabase !== 'undefined') {
        window._sharedSupabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                storageKey: TenantResolver.getAuthTokenKey(),
                storage: window.localStorage
            }
        });
    }
    return window._sharedSupabaseClient;
}

// ==================== 頁面載入時自動讀取品牌 ====================
document.addEventListener('DOMContentLoaded', async () => {
    const client = getSharedSupabaseClient();
    if (client) {
        await OrgBranding.fetch(client);
    }
});

// ==================== XP 系統（從資料庫動態讀取） ====================
// 透過 getter 自動從 OrgBranding 取值，OrgBranding 載入前使用預設值
const XP_REWARDS = {
    get CORRECT() { return OrgBranding.baseScore; },       // 單題答對
    get INCORRECT() { return OrgBranding.incorrectScore; }, // 單題答錯
    get DAILY_LOGIN() { return OrgBranding.dailyLoginScore; } // 每日登入
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

        // 超時輔助函數
        const withTimeout = (promise, ms, fallback) => {
            return Promise.race([
                promise,
                new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
            ]);
        };

        try {
            // 查詢當前用戶角色（5秒超時）
            const roleResult = await withTimeout(
                supabaseClient.rpc('get_my_role'),
                5000,
                { data: null, error: 'timeout' }
            );
            if (roleResult.data) {
                this.role = roleResult.data;
            }

            // 查詢母版管理者 ID（5秒超時）
            const masterIdResult = await withTimeout(
                supabaseClient.rpc('get_master_admin_id'),
                5000,
                { data: null, error: 'timeout' }
            );
            if (masterIdResult.data) {
                this.masterAdminId = masterIdResult.data;
            }

            this._initialized = true;
            console.log('RoleManager 已初始化, role:', this.role);
        } catch (err) {
            console.error('RoleManager 初始化失敗:', err);
            this._initialized = true; // 即使失敗也標記為已初始化，避免重複嘗試
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
// 實際等級計算由 js/level-system.js 的 LevelSystem.getLevelRequirement() 負責
// 未來可透過 organization_settings.level_requirements 自訂等級門檻
