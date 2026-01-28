/**
 * 應用初始化腳本
 * 在頁面載入時自動初始化 Supabase 並檢查認證狀態
 */

let currentUser = null;
let allCards = []; // 儲存所有卡片用於篩選
let currentFilter = 'all'; // 目前篩選條件 ('all', 'unfamiliar', 'lv1'...)

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
function updateUserUI(userData) {
    // 快取使用者資料到 sessionStorage
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // 更新等級
    const levelEl = document.getElementById('user-level');
    if (levelEl) {
        levelEl.textContent = `Lv. ${userData.current_level || 1}`;
    }

    // 更新 XP 文字
    const xpTextEl = document.getElementById('user-xp-text');
    if (xpTextEl) {
        xpTextEl.textContent = `${userData.current_xp || 0}/${userData.next_level_xp || 100}`;
    }

    // 更新 XP 進度條
    const xpBarEl = document.getElementById('user-xp-bar');
    if (xpBarEl) {
        const percentage = ((userData.current_xp || 0) / (userData.next_level_xp || 100)) * 100;
        xpBarEl.style.width = `${Math.min(percentage, 100)}%`;
    }

    // 更新下一等級需要的 XP
    const nextLevelXpEl = document.getElementById('user-next-level-xp');
    if (nextLevelXpEl) {
        nextLevelXpEl.textContent = userData.next_level_xp || 100;
    }

    // 更新卡片數量
    updateCardCountUI(userData.total_cards || 0);

    console.log('使用者 UI 已更新:', userData);
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
        const result = await apiService.getCards({ userId: currentUser.id });

        if (result.success) {
            allCards = result.data.cards || [];
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

    return `
        <a href="card.html?id=${card.id}"
            class="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col h-[180px] relative transition-transform active:scale-[0.98]">
            <div class="mb-2">
                <span class="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">${card.category || 'General'}</span>
            </div>
            <div class="flex-1">
                <h3 class="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1">${card.english_term}</h3>
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
            const cardId = new URLSearchParams(href.split('?')[1]).get('id');
            const card = cards?.find(c => c.id === cardId);
            if (card) cacheCard(card);
        });
    });

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
