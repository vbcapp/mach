/**
 * Bottom Navigation Component
 *
 * 使用方式：
 * 1. 在 HTML 中加入 <div id="bottom-nav"></div>
 * 2. 引入此 script: <script src="js/components/bottom-nav.js"></script>
 * 3. 呼叫 BottomNav.init('當前頁面名稱') 或讓它自動偵測
 *
 * 支援的頁面：'index', 'weakness', 'rank', 'profile'
 */

const BottomNav = {
    // 注入獨立樣式，確保跨頁面一致性
    injectStyles() {
        if (document.getElementById('bottom-nav-styles')) return;

        const style = document.createElement('style');
        style.id = 'bottom-nav-styles';
        style.textContent = `
            #bottom-nav nav {
                font-family: 'Inter', 'Noto Sans TC', sans-serif;
            }
            #bottom-nav .nav-icon {
                font-variation-settings: 'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 48;
            }
            #bottom-nav .neo-border {
                border: 2px solid #000000;
            }
            #bottom-nav .neo-border-thick {
                border: 3px solid #000000;
            }
            #bottom-nav .neo-shadow {
                box-shadow: 4px 4px 0px 0px #000000;
            }
            #bottom-nav .neo-shadow-sm {
                box-shadow: 2px 2px 0px 0px #000000;
            }
            #bottom-nav .nav-label {
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * 初始化底部導覽列
     * @param {string} activePage - 當前頁面 ('index' | 'weakness' | 'rank' | 'profile')
     */
    init(activePage) {
        // 注入獨立樣式
        this.injectStyles();

        // 自動偵測當前頁面
        if (!activePage) {
            activePage = this.detectCurrentPage();
        }

        const container = document.getElementById('bottom-nav');
        if (!container) {
            console.warn('BottomNav: #bottom-nav container not found');
            return;
        }

        container.innerHTML = this.render(activePage);
    },

    /**
     * 自動偵測當前頁面
     */
    detectCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop().replace('.html', '');

        // 映射檔案名稱到頁面類型
        const pageMap = {
            'index': 'index',
            '': 'index', // 根目錄
            'weakness': 'weakness',
            'rank': 'rank',
            'rank_l': 'rank',
            'rank_n': 'rank',
            'profile': 'profile',
            'profilei': 'profile'
        };

        return pageMap[filename] || 'index';
    },

    /**
     * 渲染導覽列 HTML
     */
    render(activePage) {
        const navItems = [
            {
                id: 'index',
                href: 'index.html',
                icon: 'style',
                label: '題目卡'
            },
            {
                id: 'weakness',
                href: 'weakness.html',
                icon: 'analytics',
                label: '弱點分析'
            },
            {
                id: 'rank',
                href: 'rank.html',
                icon: 'trophy',
                label: '排行榜'
            },
            {
                id: 'profile',
                href: 'profile.html',
                icon: 'person',
                label: '個人'
            }
        ];

        const navItemsHtml = navItems.map(item => {
            const isActive = item.id === activePage;
            return this.renderNavItem(item, isActive);
        }).join('');

        return `
            <nav class="fixed bottom-0 w-full max-w-[430px] bg-white dark:bg-zinc-900 border-t-thick border-black flex justify-around items-center px-2 py-4 z-50" style="padding-bottom: max(2rem, env(safe-area-inset-bottom))">
                ${navItemsHtml}
            </nav>
        `;
    },

    /**
     * 渲染單一導覽項目
     */
    renderNavItem(item, isActive) {
        if (isActive) {
            // 活動狀態：大按鈕、金色背景
            return `
                <button class="flex flex-col items-center gap-1 group">
                    <div class="size-14 -mt-8 flex items-center justify-center neo-border-thick neo-shadow bg-primary group-active:translate-y-0.5 group-active:translate-x-0.5 group-active:shadow-none">
                        <span class="material-symbols-outlined nav-icon text-3xl">${item.icon}</span>
                    </div>
                    <span class="nav-label font-black uppercase">${item.label}</span>
                </button>
            `;
        } else {
            // 非活動狀態：小按鈕、白色背景、可點擊導航
            return `
                <button onclick="window.location.href='${item.href}'" class="flex flex-col items-center gap-1 group">
                    <div class="size-11 flex items-center justify-center neo-border neo-shadow-sm bg-white group-active:translate-y-0.5 group-active:translate-x-0.5 group-active:shadow-none">
                        <span class="material-symbols-outlined nav-icon text-2xl">${item.icon}</span>
                    </div>
                    <span class="nav-label font-black uppercase">${item.label}</span>
                </button>
            `;
        }
    }
};

// 自動初始化（當 DOM 載入完成時）
document.addEventListener('DOMContentLoaded', () => {
    // 延遲一點點，確保其他 script 已經設定好 data-active-page
    setTimeout(() => {
        const container = document.getElementById('bottom-nav');
        if (container) {
            const activePage = container.getAttribute('data-active-page');
            BottomNav.init(activePage);
        }
    }, 0);
});
