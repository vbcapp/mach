/**
 * 應用初始化腳本
 * 在頁面載入時自動初始化 Supabase 並檢查認證狀態
 */

let currentUser = null;
let allCards = []; // 儲存所有卡片用於篩選
let currentFilter = 'all'; // 目前篩選條件 ('all', 'unfamiliar', 'lv1'...)

// [Security Check] 管理員 UID
const ADMIN_UID = "3a5bb55c-4ffc-4373-a9b5-f211b4b4d63b";

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

            // [Silent Sync] 檢查並初始化母版卡片
            // 為了讓新用戶不僅擁有卡片，還能馬上看到，這裡使用 await (雖會稍微增加首次讀取時間)
            try {
                const initResult = await apiService.copyMasterCardsToUser(currentUser.id, ADMIN_UID);
                if (initResult && initResult.count > 0) {
                    console.log(`已為新用戶初始化 ${initResult.count} 張母版卡片`);
                }
            } catch (err) {
                console.error('初始化母版卡片失敗 (非致命錯誤):', err);
            }

            await loadUserData();
            await loadUserCards();
        } else {
            console.log('使用者未登入，請先登入');
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
            xpTextEl.textContent = `MAX (Need Perfect Card)`;
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
        perfectCardReqEl.textContent = `升級資格：滿分卡 ${currentPerfectCards} / ${requiredPerfectCards}`;
    }

    // 更新下一等級需要的 XP (保留原本 DOM，雖然後面邏輯可能不直接用它)
    const nextLevelXpEl = document.getElementById('user-next-level-xp');
    if (nextLevelXpEl) {
        nextLevelXpEl.textContent = levelState.xpForNextLevel;
    }

    // 更新卡片數量
    updateCardCountUI(userData.total_cards || 0);

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
        const result = await apiService.getCards({ userId: currentUser.id, limit: 1000 });

        if (result.success) {
            allCards = result.data.cards || [];

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

    // [Admin Logic] 綁定長按事件
    if (currentUser && currentUser.id === ADMIN_UID) {
        bindAdminLongPress();
    }

    // 愛心按鈕
    document.querySelectorAll('[data-action="heart"]').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const cardId = this.getAttribute('data-card-id');
            const isHearted = this.getAttribute('data-hearted') === 'true';
            // Clicked Heart (Red) -> Toggle OFF -> Level 1 (or other default)
            // Clicked Empty -> Toggle ON -> Level 0
            const newMasteryLevel = isHearted ? 1 : 0;

            // 樂觀 UI 更新 (Optimistic UI Update)
            const card = cards?.find(c => c.id === cardId);
            const originalProgress = card.progress ? { ...(card.progress) } : null;

            if (card) {
                if (!card.progress) card.progress = { mastery_level: 1 }; // init if null
                card.progress.mastery_level = newMasteryLevel;

                // 注意：這裡只更新了記憶體中的 allCards，需要重新渲染或手動切換 class
                // 為了簡單起見，我們重新渲染當前視圖
                applyFilter(currentFilter);
            }

            // 發送 API 請求
            if (!currentUser) {
                console.error('無法獲取用戶 ID: currentUser 為 null');
                return;
            }
            const userId = currentUser.id;

            console.log(`正在更新卡片 ${cardId} mastery_level 為 ${newMasteryLevel}...`);
            const result = await apiService.updateCardProgress(cardId, userId, { mastery_level: newMasteryLevel });

            if (!result.success) {
                console.error('更新愛心狀態失敗:', result.error);
                //還原狀態
                if (card) {
                    if (originalProgress) {
                        card.progress = originalProgress;
                    } else {
                        // If it was null default to 1 (un-hearted)
                        card.progress.mastery_level = isHearted ? 0 : 1;
                    }
                    applyFilter(currentFilter);
                }
                alert('更新失敗: ' + (result.error.message || '未知錯誤'));
            } else {
                console.log('更新成功');
            }
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
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            const cardId = this.getAttribute('data-card-id');

            if (!confirm('確定要刪除這張卡片嗎？')) return;

            const result = await apiService.deleteCard(cardId, currentUser.id);
            if (result.success) {
                sessionStorage.removeItem(`card_${cardId}`);
                delete cardsCache[cardId];
                adjustCardCount(-1); // 即時更新卡片數量

                // 從 allCards 移除
                const idx = allCards.findIndex(c => c.id === cardId);
                if (idx !== -1) allCards.splice(idx, 1);

                applyFilter(currentFilter); // 重新渲染
            } else {
                alert('刪除失敗: ' + result.error.message);
            }
        });
    });
}


/**
 * [Admin] 綁定長按事件
 */
function bindAdminLongPress() {
    const cards = document.querySelectorAll('.admin-card-item');
    let pressTimer;

    cards.forEach(card => {
        // 只針對 daily_cards 且是 private 狀態的 (其實 published 也可以改回 private，但先做單向)
        // Admin 可以長按任何卡片進行發布
        // const sourceType = card.getAttribute('data-source-type');
        // if (sourceType !== 'daily_card') return; // 移除此限制

        const startPress = (e) => {
            // 避免與點擊衝突，如果是按鈕就不觸發
            if (e.target.closest('button') || e.target.closest('[data-action]')) return;

            pressTimer = setTimeout(() => {
                showAdminActionMenu(card);
            }, 600); // 0.6s 長按
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        // Touch events
        card.addEventListener('touchstart', startPress, { passive: true });
        card.addEventListener('touchend', cancelPress);
        card.addEventListener('touchmove', cancelPress);

        // Mouse events (for desktop testing)
        card.addEventListener('mousedown', startPress);
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('mouseleave', cancelPress);
    });
}

function showAdminActionMenu(cardEl) {
    // 觸覺回饋
    if (navigator.vibrate) navigator.vibrate(50);

    const cardId = cardEl.getAttribute('data-card-id');
    const isPublished = cardEl.getAttribute('data-is-published') === 'true';

    if (isPublished) {
        alert('此卡片已是公開狀態 (Published)');
        return;
    }

    // 建立臨時 Modal UI
    const today = new Date().toISOString().split('T')[0];

    // 為了符合要求："精美小選單"，我們動態插入一個
    const menuHtml = `
        <div id="admin-menu-overlay" class="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center animate-fade-in">
            <div class="bg-white border-4 border-black p-6 w-[85%] max-w-sm relative neo-shadow">
                <h3 class="text-xl font-black uppercase mb-4">Publish to Daily</h3>
                <p class="mb-2 font-bold text-gray-500 text-xs">TARGET: PUBLIC CALENDAR</p>
                
                <div class="mb-4">
                    <label class="block text-xs font-bold mb-1">PUBLISH DATE</label>
                    <input type="date" id="publish-date-input" value="${today}" 
                           class="w-full h-10 border-2 border-black px-2 font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD600]">
                    <p id="date-warning" class="text-[10px] font-bold text-red-500 mt-1 hidden">⚠️ DATE OCCUPIED</p>
                </div>

                <div class="space-y-3 mt-6">
                    <button id="btn-publish" class="w-full py-3 bg-[#FFD600] border-3 border-black font-black text-lg neo-shadow active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        🚀 PUBLISH NOW
                    </button>
                    <button id="btn-cancel" class="w-full py-3 bg-white border-3 border-black font-bold neo-shadow active:translate-y-1 active:shadow-none transition-all">
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHtml);

    const overlay = document.getElementById('admin-menu-overlay');
    const btnPublish = document.getElementById('btn-publish');
    const btnCancel = document.getElementById('btn-cancel');
    const dateInput = document.getElementById('publish-date-input');
    const dateWarning = document.getElementById('date-warning');

    // 檢查日期可用性函數
    const checkDate = async () => {
        const date = dateInput.value;
        if (!date) return;

        // 雖然理論上要防抖 (debounce)，但這裡簡單處理
        btnPublish.disabled = true;
        btnPublish.textContent = 'CHECKING...';

        const result = await apiService.checkDateAvailability(date);

        if (result.success && !result.isAvailable) {
            // 被佔用
            dateWarning.classList.remove('hidden');
            dateWarning.textContent = `⚠️ ${date} 已有已發布卡片`;
            btnPublish.disabled = true;
            btnPublish.textContent = '⛔ DATE OCCUPIED';
            dateInput.classList.add('bg-red-50', 'text-red-500');
        } else {
            // 可用
            dateWarning.classList.add('hidden');
            btnPublish.disabled = false;
            btnPublish.textContent = '🚀 PUBLISH NOW';
            dateInput.classList.remove('bg-red-50', 'text-red-500');
        }
    };

    // 初始檢查
    checkDate();

    // 綁定日期變更
    dateInput.addEventListener('change', checkDate);

    btnCancel.onclick = () => overlay.remove();

    btnPublish.onclick = async () => {
        const selectedDate = dateInput.value;
        if (!selectedDate) {
            alert('請選擇日期');
            return;
        }

        btnPublish.innerHTML = 'PUBLISHING...';
        btnPublish.disabled = true;

        const result = await apiService.publishFlashcardToDaily(cardId, selectedDate);
        if (result.success) {
            // Success Effect
            overlay.remove();

            // Confetti or Flash
            cardEl.style.transition = 'all 0.5s';
            cardEl.style.backgroundColor = '#FFD600'; // Flash gold
            setTimeout(() => {
                cardEl.style.backgroundColor = 'white';
                // 更新 UI: 加上 PUBLISHED 標籤
                cardEl.setAttribute('data-is-published', 'true');

                // 移除舊標籤 (防重複)
                const oldTag = cardEl.querySelector('.published-tag');
                if (oldTag) oldTag.remove();

                const categoryTag = cardEl.querySelector('span.neo-border');
                if (categoryTag) {
                    categoryTag.insertAdjacentHTML('afterend', `
                        <span class="published-tag bg-primary text-black border border-black px-1 text-[8px] font-bold uppercase ml-1 box-shadow-sm">✅ ${selectedDate}</span>
                    `);
                }

                // 觸發震動
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }, 500);

        } else {
            alert('Error: ' + result.error.message);
            btnPublish.disabled = false;
            btnPublish.textContent = '🚀 PUBLISH NOW';
        }
    };
}

/**
 * 顯示錯誤訊息
 */
function showError(message) {
    console.error(message);
    alert(message);
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
    alert(`🎉 恭喜！升級到 Lv.${newLevel}！`);
    console.log('🎉 Level Up!', newLevel);
}

// 頁面載入時自動初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});
