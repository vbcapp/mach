/**
 * VibeCoding Flashcard - Supabase API Service
 * 完整的後端 API 封裝，處理所有資料庫操作
 */

class ApiService {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
    }

    /**
     * 初始化 Supabase 客戶端
     */
    async initialize() {
        try {
            if (typeof supabase === 'undefined') {
                console.error('Supabase SDK 未載入');
                return { success: false, error: 'SDK Not Loaded' };
            }

            this.supabase = supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey
            );

            // 取得當前使用者
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUser = user;

            return { success: true, user };
        } catch (error) {
            console.error('初始化失敗:', error);
            return this._handleError(error);
        }
    }

    // ==================== 認證相關 ====================

    /**
     * 使用 Email/密碼 註冊或登入
     */
    async authWithEmailPassword(email, password, nickname) {
        try {
            // 1. 嘗試註冊
            console.log('嘗試註冊...', email);
            const signUpResult = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: nickname
                    }
                }
            });

            if (signUpResult.error) {
                // 如果是 "User already registered" (Supabase 通常回傳 400 或 422)，則嘗試登入
                // 注意：Supabase 安全性設定有時會隱藏此錯誤，但我們嘗試登入即可
                console.log('註冊回應:', signUpResult.error.message);

                // 嘗試登入
                console.log('嘗試登入...');
                const signInResult = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInResult.error) throw signInResult.error;

                // 登入成功，更新當前使用者
                this.currentUser = signInResult.data.user;
                return { success: true, user: this.currentUser, isNewUser: false };
            }

            // 註冊成功
            if (signUpResult.data.user) {
                // 情境 A: 真的註冊成功且有 Session (Auto Confirm off)
                if (signUpResult.data.session) {
                    console.log('註冊成功，建立 Profile...');
                    this.currentUser = signUpResult.data.user;
                    await this._createUserProfile(this.currentUser.id, nickname, email);
                    return { success: true, user: this.currentUser, isNewUser: true };
                }

                // 情境 B: 回傳了 User 但沒有 Session。
                // 這有兩種可能：
                // 1. 需要 Email 驗證 (Confirm Email on)
                // 2. 使用者已存在 (Prevent Email Enumeration on) -> Supabase 會假裝註冊成功但不給 Session

                // 我們嘗試直接登入看看，如果登入成功代表是情境 2
                console.log('註冊回應無 Session，嘗試登入以確認是否為已存在使用者...');
                const signInResult = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInResult.data.session) {
                    console.log('登入成功！(使用者已存在)');
                    this.currentUser = signInResult.data.user;
                    return { success: true, user: this.currentUser, isNewUser: false };
                }

                // 如果登入失敗，那真的很可能是 Email 尚未驗證 (情境 1)
                // 或是密碼錯誤 (但理論上我們要用剛剛註冊的密碼登入，所以不太可能)
                if (signInResult.error && signInResult.error.message.includes('Email not confirmed')) {
                    return { success: false, error: { message: '請前往信箱點擊驗證連結，然後重新登入' } };
                }

                return { success: false, error: { message: '註冊成功，但請檢查您的信箱以完成驗證' } };
            }

            return { success: false, error: { message: '未知錯誤' } };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 快速註冊/登入 (使用暱稱自動產生帳號)
     */
    async quickLogin(nickname) {
        try {
            // 產生一個固定的假 Email，基於暱稱 (實際應用建議用 UUID)
            // 為了避免重複，這裡加個隨機數，但在真實場景中你可能希望使用者能找回帳號
            // 這裡我們先用 localStorage 存儲的 UUID 來保持持久性
            let userUuid = localStorage.getItem('user_device_id');
            if (!userUuid) {
                userUuid = crypto.randomUUID();
                localStorage.setItem('user_device_id', userUuid);
            }

            const email = `${userUuid}@vibecoding.app`;
            const password = `pass_${userUuid}`; // 自動產生密碼

            // 1. 嘗試登入
            let { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            // 2. 如果登入失敗（帳號不存在），則註冊
            if (error && error.message.includes('Invalid login credentials')) {
                console.log('帳號不存在，正在註冊...');
                const signUpResult = await this.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: nickname
                        }
                    }
                });

                if (signUpResult.error) throw signUpResult.error;
                data = signUpResult.data;

                // 註冊成功後，建立 users 資料表的個人檔案
                if (data.user) {
                    await this._createUserProfile(data.user.id, nickname, email);
                }
            } else if (error) {
                throw error;
            }

            this.currentUser = data.user;
            return { success: true, user: data.user };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 建立使用者 Profile (內部使用)
     */
    async _createUserProfile(userId, username, email) {
        const { error } = await this.supabase
            .from('users')
            .insert({
                id: userId,
                username: username,
                email: email,
                current_level: 1,
                current_xp: 0,
                // 其他欄位用預設值
            });

        if (error) {
            // 如果重複鍵錯誤，表示 Profile 已存在，忽略即可
            if (error.code === '23505') return;
            throw error;
        }
    }

    // ==================== 使用者相關 ====================

    /**
     * 取得排行榜資料
     */
    async getLeaderboard(currentUserId) {
        try {
            // 1. 取得所有用戶 (Top 100)
            const { data: users, error, count } = await this.supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('current_xp', { ascending: false })
                .limit(100);

            if (error) throw error;

            // 2. 處理用戶資料
            const processedUsers = users.map(user => {
                let levelState = {
                    actualLevel: user.current_level || 1,
                    isCapped: false
                };

                // 如果全域有 LevelSystem，用它算準確狀態
                if (typeof LevelSystem !== 'undefined') {
                    levelState = LevelSystem.calculateState(user.current_xp || 0, user.perfect_card_count || 0);
                }

                return {
                    ...user,
                    actualLevel: levelState.actualLevel,
                    isCapped: levelState.isCapped,
                    total_cards: user.total_cards_created || 0 // 對應前端需要的欄位
                };
            });

            // 3. 找出當前用戶排名與資料
            let currentUserRank = -1;
            let currentUserData = null;

            if (currentUserId) {
                // 如果當前用戶在列表內
                const index = processedUsers.findIndex(u => u.id === currentUserId);
                if (index !== -1) {
                    currentUserRank = index + 1;
                    currentUserData = processedUsers[index];
                } else {
                    // 如果不在 Top 100，額外查詢
                    const myProfile = await this.getUserProfile(currentUserId);
                    if (myProfile.success) {
                        // 重算 levelState
                        let myLevelState = { actualLevel: myProfile.data.current_level || 1, isCapped: false };
                        if (typeof LevelSystem !== 'undefined') {
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.perfect_card_count || 0);
                        }

                        currentUserData = {
                            ...myProfile.data,
                            actualLevel: myLevelState.actualLevel,
                            isCapped: myLevelState.isCapped
                        };

                        // 計算排名：有多少人 XP 比我高
                        const { count: higherCount, error: rankError } = await this.supabase
                            .from('users')
                            .select('*', { count: 'exact', head: true })
                            .gt('current_xp', currentUserData.current_xp || 0);

                        if (!rankError) {
                            currentUserRank = higherCount + 1;
                        }
                    }
                }
            }

            return {
                success: true,
                data: processedUsers,
                totalUsers: count,
                currentUserRank,
                currentUserData
            };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得卡片數量排行榜資料
     */
    async getCardLeaderboard(currentUserId) {
        try {
            // 1. 取得所有用戶 (Top 100)，依卡片數量排序
            // 注意：這裡假設 users 表有 total_cards_created 欄位。如果不準確，可能需要 join flashcards count，但那樣效能較差。
            // 我們先信任 users.total_cards_created (由 createCard/deleteCard 維護)
            const { data: users, error, count } = await this.supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('total_cards_created', { ascending: false })
                .limit(100);

            if (error) throw error;

            // 2. 處理用戶資料
            const processedUsers = users.map(user => {
                let levelState = {
                    actualLevel: user.current_level || 1
                };

                if (typeof LevelSystem !== 'undefined') {
                    levelState = LevelSystem.calculateState(user.current_xp || 0, user.perfect_card_count || 0);
                }

                return {
                    ...user,
                    actualLevel: levelState.actualLevel,
                    total_cards: user.total_cards_created || 0
                };
            });

            // 3. 找出當前用戶排名與資料
            let currentUserRank = -1;
            let currentUserData = null;
            let todayAddedCards = 0;

            if (currentUserId) {
                const index = processedUsers.findIndex(u => u.id === currentUserId);
                if (index !== -1) {
                    currentUserRank = index + 1;
                    currentUserData = processedUsers[index];
                } else {
                    const myProfile = await this.getUserProfile(currentUserId);
                    if (myProfile.success) {
                        let myLevelState = { actualLevel: myProfile.data.current_level || 1 };
                        if (typeof LevelSystem !== 'undefined') {
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.perfect_card_count || 0);
                        }

                        currentUserData = {
                            ...myProfile.data,
                            actualLevel: myLevelState.actualLevel,
                            total_cards: myProfile.data.total_cards_created || 0
                        };

                        // 計算排名
                        const { count: higherCount, error: rankError } = await this.supabase
                            .from('users')
                            .select('*', { count: 'exact', head: true })
                            .gt('total_cards_created', currentUserData.total_cards);

                        if (!rankError) {
                            currentUserRank = higherCount + 1;
                        }
                    }
                }

                // 4. 計算今日新增卡片數量
                const today = new Date().toISOString().split('T')[0];
                const { count: todayCount, error: todayError } = await this.supabase
                    .from('flashcards')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', currentUserId)
                    .gte('created_at', today);

                if (!todayError) {
                    todayAddedCards = todayCount;
                }
            }

            return {
                success: true,
                data: processedUsers,
                totalUsers: count,
                currentUserRank,
                currentUserData,
                todayAddedCards
            };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得使用者資料
     */
    async getUserProfile(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // 計算使用者的卡片數量
            const { count: cardCount, error: countError } = await this.supabase
                .from('flashcards')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (countError) {
                console.error('計算卡片數量失敗:', countError);
            }

            return {
                success: true,
                data: {
                    ...data,
                    total_cards: cardCount || 0,
                    // levelProgressPercentage is calculated by LevelSystem on client side
                }
            };
        } catch (error) {
            return this._handleError(error, ERROR_CODES.USER_NOT_FOUND);
        }
    }

    /**
     * 更新使用者資料
     */
    async updateUser(userId, updates) {
        try {
            updates.updated_at = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 更新使用者進度 (XP 與 滿分卡)
     * 使用 LevelSystem 計算等級
     */
    async updateUserProgress(userId, { xpToAdd = 0, perfectCardsToAdd = 0 }) {
        try {
            // 1. 取得當前數據
            const userResult = await this.getUserProfile(userId);
            if (!userResult.success) return userResult;

            const user = userResult.data;

            // 2. 計算新數值
            const currentTotalXP = user.current_xp || 0; // 資料庫存的是累積總 XP
            const currentPerfectCards = user.perfect_card_count || 0;

            const newTotalXP = currentTotalXP + xpToAdd;
            const newPerfectCards = currentPerfectCards + perfectCardsToAdd;

            // 3. 使用 LevelSystem 計算等級狀態
            // 注意：LevelSystem.js 必須在 index.html 中被載入
            if (typeof LevelSystem === 'undefined') {
                console.error('LevelSystem is not defined');
                return { success: false, error: 'LevelSystem missing' };
            }

            const levelState = LevelSystem.calculateState(newTotalXP, newPerfectCards);

            // 4. 更新資料庫
            const updates = {
                current_xp: newTotalXP,
                perfect_card_count: newPerfectCards,
                current_level: levelState.actualLevel,
                current_level_xp: levelState.currentLevelXP // 使用修正後的數值 (卡等時會是滿額)
            };

            const updateResult = await this.updateUser(userId, updates);

            if (!updateResult.success) return updateResult;

            return {
                success: true,
                data: {
                    user: updateResult.data,
                    levelState: levelState,
                    leveledUp: levelState.actualLevel > user.current_level
                }
            };

        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 每日一卡相關 ====================

    /**
     * 取得月份的每日一卡列表 (用於日曆)
     */
    async getMonthlyDailyCards(year, month) {
        try {
            // 計算該月份的起始與結束日期
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            // 格式化為 YYYY-MM-DD
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            console.log(`查詢月份卡片: ${startStr} ~ ${endStr}`);

            const { data, error } = await this.supabase
                .from('daily_cards')
                .select('id, publish_date, english_term, status')
                .eq('status', 'published')
                .gte('publish_date', startStr)
                .lte('publish_date', endStr)
                .order('publish_date', { ascending: true });

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 根據 ID 取得每日一卡
     */
    async getDailyCardById(id) {
        try {
            const { data, error } = await this.supabase
                .from('daily_cards')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 根據日期取得每日一卡 (重構：確保舊方法可用)
     */
    async getDailyCardByDate(date) {
        try {
            const { data, error } = await this.supabase
                .from('daily_cards')
                .select('*')
                .eq('publish_date', date)
                .maybeSingle();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得今日的每日一卡
     */
    async getTodayDailyCard() {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            const { data, error } = await this.supabase
                .from('daily_cards')
                .select('*')
                .eq('publish_date', today)
                .maybeSingle();

            if (error) throw error;

            // 如果今天沒有卡片，取最新的一張
            if (!data) {
                const { data: latestCard, error: latestError } = await this.supabase
                    .from('daily_cards')
                    .select('*')
                    .order('publish_date', { ascending: false })
                    .limit(1)
                    .single();

                if (latestError) throw latestError;
                return { success: true, data: latestCard };
            }

            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 將每日一卡添加到使用者收藏
     */
    async addDailyCardToCollection(dailyCardId, userId) {
        try {
            // 1. 取得每日一卡資料
            const { data: dailyCard, error: fetchError } = await this.supabase
                .from('daily_cards')
                .select('*')
                .eq('id', dailyCardId)
                .single();

            if (fetchError) throw fetchError;

            // 2. 複製到使用者的 flashcards
            const now = new Date().toISOString();
            const newCard = {
                user_id: userId,
                source_daily_card_id: dailyCardId,
                category: dailyCard.category,
                english_term: dailyCard.english_term,
                chinese_translation: dailyCard.chinese_translation,
                abbreviation: dailyCard.abbreviation,
                description: dailyCard.description,
                analogy: dailyCard.analogy,
                level: dailyCard.level,
                quiz_questions: dailyCard.quiz_questions,
                is_public: false,
                created_at: now,
                updated_at: now
            };

            const { data: createdCard, error: insertError } = await this.supabase
                .from('flashcards')
                .insert(newCard)
                .select()
                .single();

            if (insertError) throw insertError;

            // 3. 更新 add_count
            const { error: updateError } = await this.supabase
                .from('daily_cards')
                .update({ add_count: dailyCard.add_count + 1 })
                .eq('id', dailyCardId);

            if (updateError) {
                console.warn('更新 add_count 失敗:', updateError);
            }

            // 4. 給使用者 XP
            const progressResult = await this.updateUserProgress(userId, { xpToAdd: XP_REWARDS.CREATE_CARD });

            return {
                success: true,
                data: createdCard,
                xpEarned: XP_REWARDS.CREATE_CARD,
                newUserData: progressResult.success ? progressResult.data.user : null
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 檢查使用者是否已添加某張每日一卡
     */
    async hasUserAddedDailyCard(dailyCardId, userId) {
        try {
            const { data, error } = await this.supabase
                .from('flashcards')
                .select('id')
                .eq('user_id', userId)
                .eq('source_daily_card_id', dailyCardId)
                .maybeSingle();

            if (error) throw error;

            return { success: true, hasAdded: !!data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 卡片相關 ====================

    /**
     * 取得卡片列表（支援分頁與篩選）
     */
    async getCards(options = {}) {
        try {
            const {
                userId,
                category = null,
                masteryLevel = null,
                searchQuery = null,
                page = 1,
                limit = 20
            } = options;

            let query = this.supabase
                .from('flashcards')
                .select('*, user_card_progress(*)', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            if (masteryLevel !== null) {
                query = query.eq('user_card_progress.mastery_level', masteryLevel);
            }

            if (searchQuery) {
                query = query.or(
                    `english_term.ilike.%${searchQuery}%,` +
                    `chinese_translation.ilike.%${searchQuery}%,` +
                    `abbreviation.ilike.%${searchQuery}%`
                );
            }

            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            return {
                success: true,
                data: {
                    cards: data.map(card => ({
                        ...card,
                        progress: card.user_card_progress?.[0] || null
                    })),
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(count / limit),
                        totalItems: count,
                        itemsPerPage: limit
                    }
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得單張卡片詳細資訊（含進度）
     */
    async getCardWithProgress(cardId, userId) {
        try {
            const { data: card, error: cardError } = await this.supabase
                .from('flashcards')
                .select('*')
                .eq('id', cardId)
                .single();

            if (cardError) throw cardError;

            const { data: progress, error: progressError } = await this.supabase
                .from('user_card_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('card_id', cardId)
                .maybeSingle();

            if (progressError && progressError.code !== 'PGRST116') {
                console.warn('取得進度失敗:', progressError);
            }

            return {
                success: true,
                data: {
                    card,
                    progress: progress || null
                }
            };
        } catch (error) {
            return this._handleError(error, ERROR_CODES.CARD_NOT_FOUND);
        }
    }

    /**
     * 建立新卡片
     */
    async createCard(cardData) {
        try {
            const now = new Date().toISOString();
            const newCard = {
                ...cardData,
                created_at: now,
                updated_at: now
            };

            const { data, error } = await this.supabase
                .from('flashcards')
                .insert(newCard)
                .select()
                .single();

            if (error) throw error;

            await this.addUserXp(cardData.user_id, XP_REWARDS.CREATE_CARD);

            const userResult = await this.getUserProfile(cardData.user_id);
            if (userResult.success) {
                await this.updateUser(cardData.user_id, {
                    total_cards_created: userResult.data.total_cards_created + 1
                });
            }

            return {
                success: true,
                data,
                xpEarned: XP_REWARDS.CREATE_CARD
            };
        } catch (error) {
            if (error.code === '23505') {
                return this._handleError(error, ERROR_CODES.DUPLICATE_CARD);
            }
            return this._handleError(error);
        }
    }

    /**
     * 批量建立新卡片
     * @param {array} cardsData - 卡片數據數組
     * @returns {Promise<object>}
     */
    async createCards(cardsData) {
        try {
            const now = new Date().toISOString();
            const newCards = cardsData.map(card => ({
                ...card,
                created_at: now,
                updated_at: now
            }));

            const { data, error } = await this.supabase
                .from('flashcards')
                .insert(newCards)
                .select();

            if (error) throw error;

            // 計算總 XP 並更新使用者進度
            const totalXP = XP_REWARDS.CREATE_CARD * cardsData.length;
            const userId = cardsData[0].user_id;

            const progressResult = await this.updateUserProgress(userId, {
                xpToAdd: totalXP
            });

            // 更新使用者的卡片建立數量
            const userResult = await this.getUserProfile(userId);
            if (userResult.success) {
                await this.updateUser(userId, {
                    total_cards_created: userResult.data.total_cards_created + cardsData.length
                });
            }

            return {
                success: true,
                data: data,
                cardsCreated: data.length,
                xpEarned: totalXP,
                newUserData: progressResult.success ? progressResult.data.user : null
            };
        } catch (error) {
            if (error.code === '23505') {
                return this._handleError(error, ERROR_CODES.DUPLICATE_CARD);
            }
            return this._handleError(error);
        }
    }

    /**
     * 更新卡片
     */
    async updateCard(cardId, updates) {
        try {
            updates.updated_at = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('flashcards')
                .update(updates)
                .eq('id', cardId)
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            return this._handleError(error, ERROR_CODES.CARD_NOT_FOUND);
        }
    }

    /**
     * 提交測驗結果並計算獎勵
     * @param {string} userId 使用者 ID
     * @param {string} cardId 卡片 ID (flashcard ID, not daily_card ID usually, assuming test context)
     * @param {number} correctCount 答對題數 (0-3)
     * @param {number[]} answeredIndices 本次答對的題目索引 (例如 [0, 2, 4])
     * @returns {Promise<object>}
     */
    async submitQuizResult(userId, cardId, correctCount, answeredIndices = []) {
        try {
            console.log('=== API submitQuizResult ===');
            console.log('correctCount received:', correctCount);
            console.log('answeredIndices received:', answeredIndices);

            // 1. 定義基礎 XP
            let xpToAdd = 0;
            if (correctCount === 1) xpToAdd = 20;
            else if (correctCount === 2) xpToAdd = 50;
            else if (correctCount === 3) xpToAdd = 100;

            console.log('Base XP calculated:', xpToAdd);

            // 2. 取得目前進度
            let { data: progress } = await this.supabase
                .from('user_card_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('card_id', cardId)
                .maybeSingle();

            if (!progress) {
                // 如果沒有進度紀錄，創建新的
                const { data: newProgress, error: createError } = await this.supabase
                    .from('user_card_progress')
                    .insert({
                        user_id: userId,
                        card_id: cardId,
                        mastery_level: 0,
                        is_perfect: false,
                        answered_question_indices: []
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                progress = newProgress;
            }

            const bonuses = [];
            let perfectCardsToAdd = 0;

            // 3. 合併答對過的題目索引（用於追蹤大師勛章進度）
            const oldIndices = progress.answered_question_indices || [];
            const cleanNewIndices = answeredIndices.map(Number);
            const mergedIndicesSet = new Set([...oldIndices, ...cleanNewIndices]);
            const mergedIndices = Array.from(mergedIndicesSet);

            // 4. 判斷【開拓者獎勵】- 只有第一次滿分才給 +50XP
            const isPerfectRun = correctCount === 3;
            if (isPerfectRun) {
                // 只有第一次滿分且尚未領取開拓者獎勵時才給
                if (!progress.is_pioneer_claimed) {
                    xpToAdd += 50;
                    bonuses.push({ name: '【開拓者獎勵】', xp: 50 });
                    progress.is_pioneer_claimed = true;
                }

                // 只有第一次全對時才增加 perfect card count
                if (!progress.is_perfect) {
                    perfectCardsToAdd = 1;
                    progress.is_perfect = true;
                }
            }

            // 5. 判斷【大師勛章】- 答對所有題目（5題）後，每次測驗都額外 +15XP
            const totalQuestionCount = 5; // 題庫總題數
            const wasMasterBefore = progress.is_mastered || false;
            const isMasterNow = mergedIndices.length >= totalQuestionCount;

            // 首次達成大師勛章
            if (isMasterNow && !wasMasterBefore) {
                xpToAdd += 15;
                bonuses.push({ name: '【大師勛章】', xp: 15, isNew: true });
                progress.is_mastered = true;
            }
            // 已經是大師，每次測驗都加 15XP
            else if (wasMasterBefore) {
                xpToAdd += 15;
                bonuses.push({ name: '【大師加成】', xp: 15, isNew: false });
            }

            // 6. 更新 USER XP & Perfect Count
            // 使用現有的 updateUserProgress (已包含 LevelSystem 邏輯)
            const userUpdateResult = await this.updateUserProgress(userId, {
                xpToAdd: xpToAdd,
                perfectCardsToAdd: perfectCardsToAdd
            });

            if (!userUpdateResult.success) throw userUpdateResult.error;

            // 7. 更新 Card Progress
            // 計算最高分（只有更高分才更新）
            const currentBest = progress.best_quiz_score || 0;
            const newBestScore = Math.max(currentBest, correctCount);

            const { error: progressUpdateError } = await this.supabase
                .from('user_card_progress')
                .update({
                    is_perfect: progress.is_perfect,
                    is_pioneer_claimed: progress.is_pioneer_claimed,
                    is_mastered: progress.is_mastered,
                    answered_question_indices: mergedIndices,
                    last_quiz_score: correctCount,
                    best_quiz_score: newBestScore,
                    last_reviewed_at: new Date().toISOString(),
                    times_reviewed: (progress.times_reviewed || 0) + 1,
                    times_correct: (progress.times_correct || 0) + correctCount,
                    times_incorrect: (progress.times_incorrect || 0) + (3 - correctCount)
                })
                .eq('id', progress.id);

            if (progressUpdateError) console.error('更新 Card Progress 失敗:', progressUpdateError);

            // 7. 寫入 Test Record
            const { error: recordError } = await this.supabase
                .from('test_records')
                .insert({
                    user_id: userId,
                    card_id: cardId,
                    is_correct: isPerfectRun, // 是否全對
                    score: correctCount, // 答對題數
                    xp_earned: xpToAdd, // 獲得的 XP
                    bonuses: bonuses, // 獎勵 (JSONB)
                    created_at: new Date().toISOString()
                });

            if (recordError) console.warn('寫入 Test Record 失敗:', recordError);

            return {
                success: true,
                xpEarned: xpToAdd,
                bonuses: bonuses,
                newUserData: userUpdateResult.data.user,
                isPerfectFirstTime: isPerfectRun && perfectCardsToAdd > 0,
                isMasterFirstTime: isMasterNow && !isMasterBefore
            };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 刪除卡片
     */
    async deleteCard(cardId, userId) {
        try {
            const { error } = await this.supabase
                .from('flashcards')
                .delete()
                .eq('id', cardId)
                .eq('user_id', userId);

            if (error) throw error;

            const userResult = await this.getUserProfile(userId);
            if (userResult.success && userResult.data.total_cards_created > 0) {
                await this.updateUser(userId, {
                    total_cards_created: userResult.data.total_cards_created - 1
                });
            }

            return { success: true };
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 進度與測驗相關 ====================

    /**
     * 提交測驗結果（完整流程）
     */
    async submitTestResult(testData) {
        try {
            const { userId, cardId, isCorrect, responseTimeMs, testType = 'quiz' } = testData;

            const progressResult = await this._getCardProgress(userId, cardId);
            const isFirstTime = !progressResult.data;

            const xpEarned = isCorrect
                ? (isFirstTime ? XP_REWARDS.CORRECT_FIRST : XP_REWARDS.CORRECT_REVIEW)
                : XP_REWARDS.INCORRECT;

            const { data: testRecord, error: testError } = await this.supabase
                .from('test_records')
                .insert({
                    user_id: userId,
                    card_id: cardId,
                    is_correct: isCorrect,
                    response_time_ms: responseTimeMs,
                    test_type: testType,
                    xp_earned: xpEarned,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (testError) throw testError;

            const updatedProgress = await this._updateProgressAfterTest(userId, cardId, isCorrect);
            const xpResult = await this.addUserXp(userId, xpEarned);

            return {
                success: true,
                data: {
                    testRecord,
                    cardProgress: updatedProgress.data,
                    xpEarned,
                    levelUp: xpResult.data.leveledUp,
                    newLevel: xpResult.data.newLevel,
                    newXp: xpResult.data.newXp
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    async _getCardProgress(userId, cardId) {
        try {
            const { data, error } = await this.supabase
                .from('user_card_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('card_id', cardId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    async _updateProgressAfterTest(userId, cardId, isCorrect) {
        try {
            const progressResult = await this._getCardProgress(userId, cardId);
            const now = new Date().toISOString();

            if (!progressResult.data) {
                const { data, error } = await this.supabase
                    .from('user_card_progress')
                    .insert({
                        user_id: userId,
                        card_id: cardId,
                        mastery_level: isCorrect ? 1 : 0,
                        times_reviewed: 1,
                        times_correct: isCorrect ? 1 : 0,
                        times_incorrect: isCorrect ? 0 : 1,
                        last_reviewed_at: now,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            } else {
                const progress = progressResult.data;
                const newTimesCorrect = progress.times_correct + (isCorrect ? 1 : 0);
                const newTimesIncorrect = progress.times_incorrect + (isCorrect ? 0 : 1);
                const newTimesReviewed = progress.times_reviewed + 1;

                const accuracyRate = newTimesCorrect / newTimesReviewed;
                let newMasteryLevel = progress.mastery_level;

                if (isCorrect && accuracyRate >= 0.9 && progress.mastery_level < 5) {
                    newMasteryLevel = progress.mastery_level + 1;
                } else if (!isCorrect && accuracyRate < 0.5 && progress.mastery_level > 0) {
                    newMasteryLevel = progress.mastery_level - 1;
                }

                const { data, error } = await this.supabase
                    .from('user_card_progress')
                    .update({
                        mastery_level: newMasteryLevel,
                        times_reviewed: newTimesReviewed,
                        times_correct: newTimesCorrect,
                        times_incorrect: newTimesIncorrect,
                        last_reviewed_at: now,
                        updated_at: now
                    })
                    .eq('user_id', userId)
                    .eq('card_id', cardId)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            }
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 直接更新卡片進度（用於手動設定熟悉度，例如愛心功能）
     */
    async updateCardProgress(cardId, userId, updates) {
        try {
            // 先檢查是否已有進度
            const existing = await this._getCardProgress(userId, cardId);
            const now = new Date().toISOString();

            if (!existing.data) {
                // 如果沒有進度，則建立新進度
                const { data, error } = await this.supabase
                    .from('user_card_progress')
                    .insert({
                        user_id: userId,
                        card_id: cardId,
                        ...updates,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            } else {
                // 如果已有進度，則更新
                const { data, error } = await this.supabase
                    .from('user_card_progress')
                    .update({
                        ...updates,
                        updated_at: now
                    })
                    .eq('user_id', userId)
                    .eq('card_id', cardId)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            }
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 錯誤處理 ====================

    _handleError(error, defaultCode = ERROR_CODES.INTERNAL_ERROR) {
        console.error('API Error:', error);

        let errorCode = defaultCode;
        let message = error.message || '發生未知錯誤';

        if (error.code === 'PGRST116') {
            errorCode = ERROR_CODES.CARD_NOT_FOUND;
            message = '找不到指定的資料';
        } else if (error.code === '23505') {
            errorCode = ERROR_CODES.DUPLICATE_CARD;
            message = '此卡片已存在';
        } else if (error.code === '42501') {
            errorCode = ERROR_CODES.FORBIDDEN;
            message = '無權限執行此操作';
        }

        return {
            success: false,
            error: {
                code: errorCode,
                message,
                details: error
            }
        };
    }
}

// 建立全域實例
const apiService = new ApiService();
