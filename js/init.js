/**
 * 應用初始化腳本
 * 在頁面載入時自動初始化 Supabase 並檢查認證狀態
 */

let currentUser = null;
let allCards = []; // 儲存所有卡片用於篩選
let currentFilter = 'all'; // 目前篩選條件 ('all', 'unfamiliar', 'lv1'...)

// [Security Check] 管理員 UID
// [Security Check] 管理員組態已移至 config.js (MASTER_ADMIN_ID, ADMIN_UUIDS)

/**
 * 初始化應用
 */
async function initializeApp() {
    try {
        console.log('正在初始化應用...');

        // 先從快取載入 UI（如果有的話）
        loadUserUIFromCache();

        await apiService.initialize();

        if (apiService.currentUser) {
            currentUser = apiService.currentUser;
            console.log('使用者已登入:', currentUser.email, 'ID:', currentUser.id);

            // [Security Check] 白名單檢查 (針對 Google 登入等無法事前攔截的情況)
            if (typeof STUDENT_EMAILS !== 'undefined' && Array.isArray(STUDENT_EMAILS)) {
                // 檢查是否為 Email 登入的用戶 (包含 Google SSO)
                const userEmail = currentUser.email;
                if (userEmail && !STUDENT_EMAILS.includes(userEmail)) {
                    console.warn(`非白名單用戶 (${userEmail}) 嘗試登入，強制登出`);
                    await apiService.supabase.auth.signOut();

                    // 清除本地暫存
                    localStorage.removeItem('userNickname');
                    localStorage.removeItem('userConsent');
                    localStorage.removeItem('sb-vryyyyivmbbqahlaafdn-auth-token');

                    // 導向登入頁並帶上參數以顯示錯誤訊息
                    window.location.href = 'login.html?error=unauthorized';
                    return { success: false };
                }
            }

            // [Silent Sync] 檢查並初始化母版卡片
            // 為了讓新用戶不僅擁有卡片，還能馬上看到，這裡使用 await (雖會稍微增加首次讀取時間)
            try {
                const initResult = await apiService.copyMasterCardsToUser(currentUser.id, MASTER_ADMIN_ID);
                if (initResult && initResult.count > 0) {
                    console.log(`已為新用戶初始化 ${initResult.count} 張母版卡片`);
                    localStorage.setItem('show_onboarding', 'true'); // 標記為需要顯示新手導覽
                }
            } catch (err) {
                console.error('初始化母版卡片失敗 (非致命錯誤):', err);
            }

            await loadUserData();
            await loadUserCards();
        } else {
            // 如果不在登入頁面，才導向登入頁
            if (!window.location.pathname.endsWith('login.html')) {
                console.log('使用者未登入，請先登入');
                window.location.href = 'login.html';
            }
        }

        return { success: true };
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('應用初始化失敗，請重新整理頁面');
    }
}

/**
 * 載入使用者資料
 */
async function loadUserData() {
    if (!currentUser) {
        console.log('loadUserData: currentUser 是 null，跳過');
        return;
    }

    console.log('loadUserData: 開始載入使用者資料，ID:', currentUser.id);

    try {
        const result = await apiService.getUserProfile(currentUser.id);
        console.log('loadUserData: API 回傳結果:', result);

        if (result.success) {
            console.log('loadUserData: 成功取得資料:', result.data);
            updateUserUI(result.data);
        } else {
            console.error('載入使用者資料失敗:', result.error);
        }
    } catch (error) {
        console.error('載入使用者資料錯誤:', error);
    }
}

/**
 * 更新使用者 UI (等級、XP 等)
 */
/**
 * 更新使用者 UI (等級、XP 等)
 */
function updateUserUI(userData) {
    // 快取使用者資料到 sessionStorage
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // 使用 LevelSystem 計算顯示狀態
    // 注意：後端回傳的是資料庫存儲值，這裡再計算一次以確保 UI 與邏輯一致
    // 也能即時處理「卡等級」的視覺效果
    let levelState;
    if (typeof LevelSystem !== 'undefined') {
        const currentXP = userData.current_xp || 0;
        const perfectCards = userData.perfect_card_count || 0;
        levelState = LevelSystem.calculateState(currentXP, perfectCards);
    } else {
        console.warn('LevelSystem not loaded, falling back to simple display');
        // Fallback
        levelState = {
            actualLevel: userData.current_level || 1,
            progressInLevel: 0,
            xpForNextLevel: 100,
            isCapped: false,
            displayProgress: 0
        };
    }

    // 更新等級
    const levelEl = document.getElementById('user-level');
    if (levelEl) {
        levelEl.textContent = `Lv. ${levelState.actualLevel}`;
    }

    // 更新 XP 文字: 顯示 "當前等級進度 / 升級所需"
    const xpTextEl = document.getElementById('user-xp-text');
    if (xpTextEl) {
        if (levelState.isCapped) {
            const nextLevel = levelState.actualLevel + 1;
            xpTextEl.textContent = ` ➔   Lv. ${nextLevel} [ 尚未解鎖 🔒 ]`;
        } else {
            xpTextEl.textContent = `${levelState.progressInLevel}/${levelState.xpForNextLevel}`;
        }
    }

    // 更新 XP 進度條
    const xpBarEl = document.getElementById('user-xp-bar');
    if (xpBarEl) {
        // 設定寬度
        xpBarEl.style.width = `${Math.min(levelState.displayProgress, 100)}%`;

        // 處理金色閃爍 (Capped State)
        if (levelState.isCapped) {
            xpBarEl.classList.add('capped-gold-shimmer');
            xpBarEl.classList.remove('bg-primary'); // 移除原本顏色，改用金光
        } else {
            xpBarEl.classList.remove('capped-gold-shimmer');
            xpBarEl.classList.add('bg-primary'); // 恢復原本顏色
        }
    }

    // 更新升級資格：滿分卡顯示
    const perfectCardReqEl = document.getElementById('perfect-card-requirement');
    if (perfectCardReqEl) {
        const currentPerfectCards = userData.perfect_card_count || 0;
        const requiredPerfectCards = levelState.actualLevel; // 當前等級 = 需要的滿分卡數量
        const remaining = requiredPerfectCards - currentPerfectCards;
        perfectCardReqEl.textContent = `滿分卡片進度：${currentPerfectCards} / ${requiredPerfectCards} (還差 ${remaining} 張！)`;
    }

    // 更新下一等級需要的 XP (保留原本 DOM，雖然後面邏輯可能不直接用它)
    const nextLevelXpEl = document.getElementById('user-next-level-xp');
    if (nextLevelXpEl) {
        nextLevelXpEl.textContent = levelState.xpForNextLevel;
    }

    // 更新卡片數量
    updateCardCountUI(userData.total_cards || 0);

    // [NEW] 處理等級卡片點擊事件：當 XP 滿但滿分卡不足時，點擊跳轉到 rule.html
    const levelCardEl = document.getElementById('level-card');
    if (levelCardEl) {
        if (levelState.isCapped) {
            // XP 已滿，顯示為可點擊狀態
            levelCardEl.style.cursor = 'pointer';
            levelCardEl.classList.add('capped-glow'); // 添加閃爍效果

            // 移除舊的事件監聽器（避免重複綁定）
            levelCardEl.replaceWith(levelCardEl.cloneNode(true));
            const newLevelCardEl = document.getElementById('level-card');

            newLevelCardEl.addEventListener('click', () => {
                window.location.href = 'rule.html';
            });
        } else {
            // XP 未滿，移除點擊效果
            levelCardEl.style.cursor = 'default';
            levelCardEl.classList.remove('capped-glow');
        }
    }

    console.log('使用者 UI 已更新:', levelState);
}

/**
 * 更新卡片數量 UI（包含 CARD/CARDS 單複數）
 */
function updateCardCountUI(count) {
    const cardCountEl = document.getElementById('user-card-count');
    if (cardCountEl) {
        cardCountEl.textContent = count;
    }

    const cardLabelEl = document.getElementById('card-label');
    if (cardLabelEl) {
        cardLabelEl.textContent = count <= 1 ? 'CARD' : 'CARDS';
    }
}

/**
 * 調整卡片數量（用於刪除後即時更新）
 */
function adjustCardCount(delta) {
    const cached = sessionStorage.getItem('userData');
    if (cached) {
        const userData = JSON.parse(cached);
        userData.total_cards = Math.max(0, (userData.total_cards || 0) + delta);
        sessionStorage.setItem('userData', JSON.stringify(userData));
        updateCardCountUI(userData.total_cards);
    }
}

/**
 * 從快取載入使用者 UI (立即顯示)
 */
function loadUserUIFromCache() {
    const cached = sessionStorage.getItem('userData');
    if (cached) {
        const userData = JSON.parse(cached);
        updateUserUI(userData);
        return true;
    }
    return false;
}

/**
 * 載入使用者的卡片
 */
async function loadUserCards() {
    if (!currentUser) return;

    const container = document.getElementById('cards-container');
    if (!container) {
        console.log('卡片容器不存在，跳過載入');
        return;
    }

    try {
        const result = await apiService.getQuestions({ userId: currentUser.id, limit: 1000 });

        if (result.success) {
            allCards = result.data.questions || [];

            // [Admin Logic] (Deprecated) 不再需要額外載入私密 Daily Cards，直接用 Flashcards
            // if (currentUser.id === ADMIN_UID) { ... }

            initFilterButtons();
            applyFilter(currentFilter);
        } else {
            console.error('載入卡片失敗:', result.error);
        }
    } catch (error) {
        console.error('載入卡片錯誤:', error);
    }
}

/**
 * 初始化篩選按鈕事件
 */
function initFilterButtons() {
    const filterContainer = document.getElementById('filter-buttons');
    if (!filterContainer) return;

    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const filter = this.getAttribute('data-filter');
            applyFilter(filter);

            // 更新按鈕樣式
            filterContainer.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-primary', 'font-black', 'active');
                b.classList.add('bg-white', 'dark:bg-zinc-800', 'font-bold');
            });
            this.classList.remove('bg-white', 'dark:bg-zinc-800', 'font-bold');
            this.classList.add('bg-primary', 'font-black', 'active');
        });
    });
}

/**
 * 套用篩選條件
 */
function applyFilter(filter) {
    currentFilter = filter;
    const container = document.getElementById('cards-container');
    if (!container) return;

    let filteredCards = allCards;

    if (filter === 'unfamiliar') {
        filteredCards = allCards.filter(card => card.progress && card.progress.mastery_level === 0);
    } else if (filter === 'lv1') {
        filteredCards = allCards.filter(card => card.level === 1);
    } else if (filter === 'lv2') {
        filteredCards = allCards.filter(card => card.level === 2);
    } else if (filter === 'lv3') {
        filteredCards = allCards.filter(card => card.level === 3);
    } else if (filter === 'lv4') {
        filteredCards = allCards.filter(card => card.level === 4);
    } else if (filter === 'lv5') {
        filteredCards = allCards.filter(card => card.level === 5);
    }

    renderCards(filteredCards, container);
}

// 卡片快取存儲 (key: card ID, value: card data)
let cardsCache = {};

/**
 * 儲存卡片到 sessionStorage
 */
function cacheCard(card) {
    sessionStorage.setItem(`card_${card.id}`, JSON.stringify(card));
    cardsCache[card.id] = card;
}

/**
 * 從 sessionStorage 讀取卡片
 */
function getCachedCard(cardId) {
    // 先檢查記憶體快取
    if (cardsCache[cardId]) return cardsCache[cardId];

    // 再檢查 sessionStorage
    const cached = sessionStorage.getItem(`card_${cardId}`);
    if (cached) {
        const card = JSON.parse(cached);
        cardsCache[cardId] = card;
        return card;
    }
    return null;
}

/**
 * 渲染卡片列表
 */
function renderCards(cards, container) {
    if (!cards || cards.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-8 text-gray-500">
                <p class="text-sm">尚無卡片</p>
                <p class="text-xs mt-2">從每日一卡收藏，或自己建立新卡片吧！</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cards.map(card => renderCardItem(card)).join('');

    // [Navigation] 儲存當前顯示的卡片 ID 列表，供詳情頁滑動切換使用
    sessionStorage.setItem('currentCardIds', JSON.stringify(cards.map(c => c.id)));

    // 快取所有卡片
    cards.forEach(card => cacheCard(card));

    // 重新綁定編輯和刪除按鈕事件
    bindCardActions(cards);
}

/**
 * 渲染單張卡片
 */
function renderCardItem(card) {
    const description = card.description
        ? card.description.substring(0, 40) + (card.description.length > 40 ? '...' : '')
        : '';

    const isHearted = card.progress && card.progress.mastery_level === 0;
    const heartFill = isHearted ? '#EF4444' : '#F5F5F5'; // #EF4444 is Red

    // 計算 Quiz 進度徽章 - 基於歷史最高分
    const bestScore = card.progress?.best_quiz_score;
    let badgeClass = '';
    let badgeEmoji = '';
    let badgeBg = '';

    if (bestScore === 0 || bestScore === 1) {
        badgeClass = 'quiz-badge-novice';
        badgeEmoji = '📝';
        badgeBg = '#F97316'; // Orange
    } else if (bestScore === 2) {
        badgeClass = 'quiz-badge-intermediate';
        badgeEmoji = '✓';
        badgeBg = '#3B82F6'; // Blue
    } else if (bestScore >= 3) {
        badgeClass = 'quiz-badge-perfect';
        badgeEmoji = '⭐';
        badgeBg = '#FACC15'; // Gold (永遠顯示星星)
    }

    // 決定是否顯示徽章（只有做過測驗才顯示）
    const showBadge = bestScore !== null && bestScore !== undefined && bestScore > 0;

    // [Admin Logic] 已發布標記
    const isPublished = card.is_published;
    const publishedTag = isPublished ? `<span class="bg-primary text-black border border-black px-1 text-[8px] font-bold uppercase ml-1">PUBLISHED</span>` : '';

    return `
        <a href="card.html?id=${card.id}"
           data-card-id="${card.id}"
           data-source-type="${card.sourceType || 'user_card'}"
           data-is-published="${isPublished}"
            class="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col h-[180px] relative transition-transform active:scale-[0.98] admin-card-item">
            ${showBadge ? `
                <div class="absolute -top-2 -right-2 w-10 h-10 rounded-full neo-border-thick flex items-center justify-center z-20 shadow-lg"
                     style="background-color: ${badgeBg};">
                    <span class="text-lg">${badgeEmoji}</span>
                </div>
            ` : ''}
            <div class="mb-2 flex items-center">
                <span class="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">${card.category || 'General'}</span>
                ${publishedTag}
            </div>
            <div class="flex-1">
                <h3 class="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1 break-words hyphens-none ${(!card.abbreviation && card.english_term.length > 15) ? 'text-small' : ''}" style="word-break: break-word; -webkit-hyphens: none;">${card.abbreviation || card.english_term}</h3>
                <p class="text-[10px] leading-tight opacity-70 line-clamp-2">${card.chinese_translation}。${description}</p>
            </div>
            <div class="flex justify-between items-end gap-2 mt-2">
                <button data-card-id="${card.id}" data-action="heart" data-hearted="${isHearted}" 
                    class="heart-btn hover:scale-110 active:scale-95 transition-transform z-10 p-1 -ml-1 flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl ${isHearted ? 'text-[#EF4444]' : 'text-black'}" 
                          style="font-variation-settings: 'FILL' ${isHearted ? 1 : 0}, 'wght' 700;">
                        favorite
                    </span>
                </button>
                <div class="flex gap-2">
                    <span data-card-id="${card.id}" data-action="edit"
                        class="material-symbols-outlined text-base cursor-pointer hover:text-primary z-10">edit_square</span>
                    <span data-card-id="${card.id}" data-action="delete"
                        class="material-symbols-outlined text-base cursor-pointer text-red-500 z-10">delete</span>
                </div>
            </div>
        </a>
    `;
}

/**
 * 綁定卡片操作事件
 */
function bindCardActions(cards) {
    // 卡片連結 - 點擊時快取資料
    document.querySelectorAll('#cards-container a[href^="card.html"]').forEach(link => {
        link.addEventListener('click', function (e) {
            // 如果點擊的是按鈕，不跳轉
            if (e.target.closest('button') || e.target.closest('[data-action]')) {
                e.preventDefault();
                return;
            }

            const href = this.getAttribute('href');
            // 處理 # (私密卡片不可點擊跳轉)
            if (href === '#') {
                e.preventDefault();
                return;
            }

            const cardId = new URLSearchParams(href.split('?')[1]).get('id');
            const card = cards?.find(c => c.id === cardId);
            if (card) cacheCard(card);
        });
    });

    // [Admin Logic] 綁定長按事件 (支援多管理員)
    if (currentUser && typeof ADMIN_UUIDS !== 'undefined' && ADMIN_UUIDS.includes(currentUser.id)) {
        bindAdminLongPress();
    }

    // 愛心按鈕 (Heart Button) - Deprecated as mastery_level is removed. 
    // This could optionally toggle a favorite flag if added back to PRD.
    document.querySelectorAll('[data-action="heart"]').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            alert('此功能已停用，請使用測驗功能來更新熟悉度。');
        });
    });

    // 編輯按鈕
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const cardId = this.getAttribute('data-card-id');
            const card = cards?.find(c => c.id === cardId);
            if (card) cacheCard(card);
            window.location.href = `edit.html?id=${cardId}`;
        });
    });

    // 刪除按鈕
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const cardId = this.getAttribute('data-card-id');

            ModalSystem.confirm(
                '確認刪除',
                '確定要刪除這張卡片嗎？此動作無法復原。',
                async () => {
                    const result = await apiService.deleteQuestion(cardId);
                    if (result.success) {
                        sessionStorage.removeItem(`card_${cardId}`);
                        delete cardsCache[cardId];
                        adjustCardCount(-1); // 即時更新卡片數量

                        // 從 allCards 移除
                        const idx = allCards.findIndex(c => c.id === cardId);
                        if (idx !== -1) allCards.splice(idx, 1);

                        applyFilter(currentFilter); // 重新渲染

                        ModalSystem.toast('卡片已刪除', 'success');
                    } else {
                        ModalSystem.alert('刪除失敗', result.error.message);
                    }
                },
                null,
                { confirmText: '刪除', isDestructive: true }
            );
        });
    });
}


/**
 * [Admin] 綁定長按事件 - 移除 Publish to Daily 功能
 */
function bindAdminLongPress() {
    // 移除發布到每日卡片的功能，因為已經廢棄
    console.log('Admin long press actions disabled');
}

/**
 * 顯示錯誤訊息
 */
function showError(message) {
    console.error(message);
    if (typeof ModalSystem !== 'undefined') {
        ModalSystem.alert('錯誤', message);
    } else {
        alert(message);
    }
}

/**
 * 顯示成功訊息
 */
function showSuccess(message) {
    console.log(message);
}

/**
 * 顯示升級動畫
 */
function showLevelUpAnimation(newLevel) {
    if (typeof ModalSystem !== 'undefined') {
        ModalSystem.alert('恭喜升級！', `🎉 恭喜！升級到 Lv.${newLevel}！繼續保持！`);
    } else {
        alert(`🎉 恭喜！升級到 Lv.${newLevel}！`);
    }
    console.log('🎉 Level Up!', newLevel);
}

// 頁面載入時自動初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});
