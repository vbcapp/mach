/**
 * components.js — 全域 Header 與 Bottom Nav 自動注入
 *
 * 使用方式：
 * 1. 在 HTML <head> 末尾加入 <script src="js/components.js"></script>
 * 2. 在 body 最前面放 placeholder：
 *      <div id="app-header" data-variant="brand" data-title="工商安全衛生協會-新竹職訓中心"></div>
 *    或
 *      <div id="app-header" data-variant="back" data-title="權限管理" data-back-href="profile.html"></div>
 *
 * 3. Bottom Nav 維持原本的用法：
 *      <div id="bottom-nav" data-active-page="index"></div>
 *
 * Header Variants:
 *   - "brand"  ：品牌 Logo + 標題 + admin 按鈕（首頁）
 *   - "back"   ：返回箭頭 + 標題（子頁面，金色背景）
 *   - "back-white" ：返回箭頭 + 標題（白色背景，如 rule.html）
 */

const AppHeader = {
    /**
     * 初始化 Header
     */
    init() {
        const container = document.getElementById('app-header');
        if (!container) return;

        const variant = container.getAttribute('data-variant') || 'brand';
        const title = container.getAttribute('data-title') || '';
        const backHref = container.getAttribute('data-back-href') || 'index.html';
        const adminBtn = container.getAttribute('data-admin-btn') === 'true';

        container.innerHTML = this.render(variant, title, backHref, adminBtn);
    },

    /**
     * 渲染 Header HTML
     */
    render(variant, title, backHref, adminBtn) {
        switch (variant) {
            case 'brand':
                return this.renderBrand(title, adminBtn);
            case 'back':
                return this.renderBack(title, backHref, 'primary');
            case 'back-white':
                return this.renderBack(title, backHref, 'white');
            default:
                return this.renderBrand(title, adminBtn);
        }
    },

    /**
     * 品牌型 Header（首頁）
     */
    renderBrand(title, showAdminBtn) {
        const adminBtnHtml = showAdminBtn
            ? `<button id="admin-create-btn" onclick="window.location.href='create.html'" class="vibe-icon-btn hidden">
                <span class="material-symbols-outlined text-black font-bold">add</span>
               </button>`
            : '';

        return `
            <header class="flex-none bg-surface dark:bg-background-dark border-b-2 border-border-main px-4 py-4 flex items-center justify-between z-10">
                <div class="flex items-center gap-2">
                    <div class="bg-primary neo-border p-1 flex items-center justify-center">
                        <span class="material-symbols-outlined text-black font-bold">terminal</span>
                    </div>
                    <h1 class="text-xl font-black tracking-tighter">${title}</h1>
                </div>
                ${adminBtnHtml}
            </header>
        `;
    },

    /**
     * 返回型 Header（子頁面：admin, create, import 等）
     */
    renderBack(title, backHref, bgColor) {
        const bgClass = bgColor === 'white'
            ? 'bg-white border-b-8 border-black'
            : 'bg-primary border-b-4 border-black';

        return `
            <header class="${bgClass} pt-12 pb-6 px-6 sticky top-0 z-40">
                <div class="flex items-center gap-4">
                    <button onclick="window.location.href='${backHref}'"
                        class="vibe-icon-btn bg-white" style="width:auto;height:auto;border-width:4px">
                        <span class="material-symbols-outlined text-black block">arrow_back</span>
                    </button>
                    <h1 class="text-2xl font-black italic tracking-tight">${title}</h1>
                </div>
            </header>
        `;
    }
};

// ── 自動初始化 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    AppHeader.init();
});
