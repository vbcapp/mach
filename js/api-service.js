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
                // 注意：Supabase 安全性設定有時會隱藏此錯誤，但我們嘗試登入即可
                console.log('註冊回應錯誤:', signUpResult.error); // Log full error object

                // 嘗試登入
                console.log('嘗試登入...');
                const signInResult = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInResult.error) throw signInResult.error;

                // 登入成功，更新當前使用者
                this.currentUser = signInResult.data.user;
                // Ensure profile exists (fix for zombie users)
                await this._createUserProfile(this.currentUser.id, nickname, email);
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
                    // Double check if profile exists, if not create it (recover from zombie state)
                    await this._createUserProfile(this.currentUser.id, nickname, email);
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
     * 使用 Email/密碼 登入
     */
    async loginWithEmailPassword(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.currentUser = data.user;

            // 取得使用者個人資料以獲得暱稱
            let nickname = 'User';
            const profile = await this.getUserProfile(this.currentUser.id);
            if (profile.success && profile.data.username) {
                nickname = profile.data.username;
            }

            return { success: true, user: this.currentUser, nickname };
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
     * @param {string} userId - 用戶 ID
     * @param {string} username - 用戶名稱
     * @param {string} email - 電子郵件
     * @param {string} [avatarUrl] - 頭像 URL (Google OAuth 會提供)
     */
    async _createUserProfile(userId, username, email, avatarUrl = null) {
        const profileData = {
            id: userId,
            username: username,
            email: email,
            current_level: 1,
            current_xp: 0,
        };

        // 如果有頭像 URL，添加到資料中
        if (avatarUrl) {
            profileData.avatar_url = avatarUrl;
        }

        const { error } = await this.supabase
            .from('users')
            .upsert(profileData, { onConflict: 'id' }); // 使用 upsert 以支援更新現有資料

        if (error) {
            // 如果是用戶名重複錯誤，嘗試生成一個唯一的用戶名
            if (error.code === '23505' && error.message.includes('username')) {
                const uniqueUsername = `${username}_${Date.now().toString(36)}`;
                profileData.username = uniqueUsername;
                const { error: retryError } = await this.supabase
                    .from('users')
                    .upsert(profileData, { onConflict: 'id' });
                if (retryError) {
                    console.warn('_createUserProfile retry error:', retryError);
                }
                return;
            }
            // 其他重複錯誤 (如 ID 已存在) 可以忽略
            if (error.code === '23505') return;
            console.warn('_createUserProfile error:', error);
        }
    }

    /**
     * 登出
     */
    async logout() {
        try {
            // 嘗試登出 Supabase (即使失敗也繼續清除本地資料)
            const { error } = await this.supabase.auth.signOut();
            if (error) console.warn('Supabase sign out warning:', error);

            return { success: true };
        } catch (error) {
            console.warn('Logout execution error:', error);
            // 即使發生錯誤，也要確保前端登出
            return { success: true };
        } finally {
            // [CRITICAL] 強制清除所有本地狀態，確保不會自動登入回舊帳號
            this.currentUser = null;

            // 清除應用相關資料
            localStorage.removeItem('userNickname');
            localStorage.removeItem('userConsent');
            localStorage.removeItem('loginTime');
            localStorage.removeItem('user_device_id');

            // 清除 Supabase Auth Token (防止 SDK 自動恢復 Session)
            // Supabase 預設使用 key: sb-<project-ref>-auth-token
            // 我們不僅清除變數，也清除任何可能的 Supabase key
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            });

            sessionStorage.clear();
            console.log('Local session cleared.');
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
                    total_cards: user.total_cards || 0 // 對應前端需要的欄位
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
            // 注意：這裡假設 users 表有 total_cards 欄位。如果不準確，可能需要 join flashcards count，但那樣效能較差。
            // 我們先信任 users.total_cards (由 createCard/deleteCard 維護)
            const { data: users, error, count } = await this.supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('total_cards', { ascending: false })
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
                    total_cards: user.total_cards || 0
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
                            total_cards: myProfile.data.total_cards || 0
                        };

                        // 計算排名
                        const { count: higherCount, error: rankError } = await this.supabase
                            .from('users')
                            .select('*', { count: 'exact', head: true })
                            .gt('total_cards', currentUserData.total_cards);

                        if (!rankError) {
                            currentUserRank = higherCount + 1;
                        }
                    }
                }

                // 4. 計算今日新增題目數量（改為 questions 資料表）
                const today = new Date().toISOString().split('T')[0];
                const { count: todayCount, error: todayError } = await this.supabase
                    .from('questions')
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

            // 計算使用者的題目數量 (因為原本有卡片數，此處可以查詢 users.total_questions)
            // PRD 中指出 users 表有新增 total_questions 欄位，這可以直接從 data 返回，不一定要再 query Count
            // 不過為了與先前的邏輯一致（或是若資料不一致時防禦），可以直接讀取 user 表現有欄位
            return {
                success: true,
                data: {
                    ...data,
                    total_questions: data.total_questions || 0,
                    correct_answer_count: data.correct_answer_count || 0
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

    // ==================== 題目相關 ====================
    // ==================== 卡片相關 ====================

    /**
     * 取得題目列表（支援分頁與篩選）
     */
    async getQuestions(options = {}) {
        try {
            const {
                subject = null,
                chapter = null,
                isCorrect = null, // 用於篩選錯題
                searchQuery = null,
                page = 1,
                limit = 20
            } = options;

            // 注意：這裡是取得所有人的共用題庫，如果有分租戶才需要 userId
            let query = this.supabase
                .from('questions')
                .select('*, user_question_progress!left(*)', { count: 'exact' })
                .order('subject_no', { ascending: true })
                .order('chapter_no', { ascending: true })
                .order('question_no', { ascending: true });

            // 如果要過濾當前用戶的進度，Supabase JS SDK 沒辦法在 outer join 的 on 條件輕易加上 userId，
            // 通常在 !inner 或透過 RPC 會更好。
            // 不過既然這個系統預設單人登入/企業共用題庫，我們先把所有題目都撈出來，
            // 如果這用戶有作答紀錄自然會關聯進來。為了保險起見過濾 user_id：
            if (options.userId) {
                // 若有關聯的 progress，且該 progress 的 user_id 是當前用戶（處理 inner 會濾除沒作答題目的問題，所以保持 left）
                // 這裡在前端處理過濾，或者如果有設 RLS，只會撈出自己的 user_question_progress
            }

            if (subject) {
                query = query.in('subject', Array.isArray(subject) ? subject : [subject]);
            }
            if (chapter) {
                query = query.in('chapter', Array.isArray(chapter) ? chapter : [chapter]);
            }

            // 搜尋
            if (searchQuery) {
                query = query.or(`question.ilike.%${searchQuery}%,explanation.ilike.%${searchQuery}%`);
            }

            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            // 在前端對 user_question_progress 進行過濾 (確保只看當前用戶的 progress，如果 RLS 沒設定好的話)
            const questions = data.map(q => {
                let progress = null;
                if (q.user_question_progress && q.user_question_progress.length > 0) {
                    // 如果有傳 userId，找出該 user_id 的進度，如果沒有傳就拿第一個
                    if (options.userId) {
                        progress = q.user_question_progress.find(p => p.user_id === options.userId) || null;
                    } else {
                        progress = q.user_question_progress[0];
                    }
                }

                return {
                    ...q,
                    progress: progress
                };
            });

            // 針對錯題狀態或正確狀態進一步過濾 (因為無法直接在 left join 進行 Supabase 端的複雜查詢)
            let filteredQuestions = questions;
            if (isCorrect !== null) {
                filteredQuestions = questions.filter(q => {
                    const p = q.progress;
                    if (isCorrect === true) return p && p.is_correct === true;
                    if (isCorrect === false) return p && p.is_correct === false;
                    if (isCorrect === 'unanswered') return !p || p.is_correct === null;
                    return true;
                });
            }

            return {
                success: true,
                data: {
                    questions: filteredQuestions,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(count / limit),
                        totalItems: count, // 注意：如果上面有 filteredQuestions 過濾，這裡的 count 會有誤差，對於簡單分頁先以此為主
                        itemsPerPage: limit
                    }
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 上傳並更新使用者頭像
     * @param {string} userId
     * @param {File | Blob} file
     * @returns {Promise<object>} { success: true, avatarUrl: string }
     */
    async uploadAvatar(userId, file) {
        try {
            // 1. Upload file to Supabase Storage
            // Path format: {userId}/avatar.png (always overwrite)
            // Use timestamp to prevent browser caching issues
            const timestamp = new Date().getTime();
            const fileName = `${userId}/avatar_${timestamp}.png`;

            // If using standard supabase storage:
            const { data, error: uploadError } = await this.supabase
                .storage
                .from('avatars')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = this.supabase
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            // 3. Update User Profile
            const { error: updateError } = await this.supabase
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            return { success: true, avatarUrl: publicUrl };

        } catch (error) {
            console.error('Avatar Upload Error:', error);
            return this._handleError(error);
        }
    }

    /**
     * 取得所有不重複的大科目列表
     */
    async getUniqueSubjects() {
        try {
            const { data, error } = await this.supabase
                .from('questions')
                .select('subject');

            if (error) throw error;

            const uniqueSubjects = [...new Set(data.map(item => item.subject).filter(Boolean))];

            // PRD 規定：大科目中文注音排序
            const collator = new Intl.Collator('zh-TW', { numeric: true });
            uniqueSubjects.sort(collator.compare);

            return { success: true, data: uniqueSubjects };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得所有不重複的類別（用於首頁篩選 Modal）
     * 這是 getUniqueSubjects 的別名，供 index.html 的篩選 Modal 使用
     */
    async getUniqueCategories(userId) {
        return this.getUniqueSubjects();
    }

    /**
     * 取得所有不重複的章節列表（用於首頁篩選按鈕）
     */
    async getUniqueChapters() {
        try {
            const { data, error } = await this.supabase
                .from('questions')
                .select('chapter');

            if (error) throw error;

            const uniqueChapters = [...new Set(data.map(item => item.chapter).filter(Boolean))];

            // 自然排序（數字優先）
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
            uniqueChapters.sort(collator.compare);

            return { success: true, data: uniqueChapters };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 根據大科目，取得不重複的章節列表
     */
    async getUniqueChaptersBySubject(subject) {
        try {
            let query = this.supabase
                .from('questions')
                .select('chapter');

            if (subject) {
                query = query.eq('subject', subject);
            }

            const { data, error } = await query;

            if (error) throw error;

            const uniqueChapters = [...new Set(data.map(item => item.chapter).filter(Boolean))];

            // PRD 規定：自然排序
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
            uniqueChapters.sort(collator.compare);

            return { success: true, data: uniqueChapters };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 複製母版題庫給新用戶
     * 從 MASTER_ADMIN_ID 那邊將 questions 複製給新登入的用戶
     */
    async copyMasterCardsToUser(userId, adminUuid) {
        try {
            // 0. Ensure user profile exists before copying cards
            const userMeta = this.currentUser?.user_metadata || {};
            const fallbackEmail = `${userId}@placeholder.com`;
            const fallbackName = 'Learning User';

            const username = userMeta.full_name || userMeta.name || userMeta.username || fallbackName;
            const email = this.currentUser?.email || userMeta.email || fallbackEmail;
            const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

            await this._createUserProfile(userId, username, email, avatarUrl);

            // 1. 檢查用戶是否已有作答進度 (在此系統，我們不複製 questions 表，
            // 因為 PRD：「母版題庫複製: 管理員(MASTER_ADMIN_ID)的題目作為共用題庫」
            // 系統將直接讓學員存取共用題庫。所以「複製題庫」這一步在新的架構下是不必要的。
            // 學員不需要在 questions 表擁有自己的副本，只要操作 user_question_progress 即可。)

            // 為了向下相容，或者只是為了表示初始化成功，我們可以直接回傳成功。
            console.log('User joined. Using shared master question bank.');
            return { success: true, message: 'User initialized. Shared question bank is ready.' };

        } catch (error) {
            console.error('Initialization Error:', error);
            return { success: false, error };
        }
    }

    /**
     * 取得單筆題目詳細資訊（含作答進度）
     */
    async getQuestionWithProgress(questionId, userId) {
        try {
            let { data: question, error: questionError } = await this.supabase
                .from('questions')
                .select('*')
                .eq('id', questionId)
                .single();

            if (questionError) throw questionError;

            const { data: progress, error: progressError } = await this.supabase
                .from('user_question_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('question_id', questionId)
                .maybeSingle();

            if (progressError && progressError.code !== 'PGRST116') {
                console.warn('取得進度失敗:', progressError);
            }

            return {
                success: true,
                data: {
                    question,
                    progress: progress || null
                }
            };
        } catch (error) {
            return this._handleError(error, ERROR_CODES.CARD_NOT_FOUND);
        }
    }

    /**
     * [僅管理員] 手動建立單一題目
     */
    async createQuestion(questionData) {
        try {
            const now = new Date().toISOString();
            const newQuestion = {
                ...questionData,
                created_at: now,
                updated_at: now
            };

            const { data, error } = await this.supabase
                .from('questions')
                .insert(newQuestion)
                .select()
                .single();

            if (error) throw error;
            await this._syncUserCardCount(); // 更新總題數

            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * [僅管理員] 批量建立題目 (匯入 JSON)
     */
    async createQuestions(questionsData) {
        try {
            const now = new Date().toISOString();
            const newQuestions = questionsData.map(q => ({
                ...q,
                created_at: now,
                updated_at: now
            }));

            const { data, error } = await this.supabase
                .from('questions')
                .insert(newQuestions)
                .select();

            if (error) throw error;
            await this._syncUserCardCount();

            return { success: true, data, count: data.length };
        } catch (error) {
            return this._handleError(error);
        }
    }


    /**
     * 更新題目（僅管理員）
     */
    async updateQuestion(questionId, updates) {
        try {
            updates.updated_at = new Date().toISOString();
            const { data, error } = await this.supabase
                .from('questions')
                .update(updates)
                .eq('id', questionId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error, ERROR_CODES.CARD_NOT_FOUND);
        }
    }

    /**
     * 刪除題目（僅管理員可用）。注意有 FK cascade
     */
    async deleteQuestion(questionId) {
        try {
            const { error } = await this.supabase
                .from('questions')
                .delete()
                .eq('id', questionId);

            if (error) throw error;

            await this._syncUserCardCount();

            return { success: true };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 內部函數：同步系統題目總數
     * 在上傳或刪除題目後，計算總題數，更新給特定管理員，
     * 因為我們現在已經移除了每個使用者自己的 flashcards 總量邏輯，可以統一更新 (如果需要的話)。
     * 或這部可以簡化，直接在前端每次讀取 count
     */
    async _syncUserCardCount() {
        try {
            const { count, error } = await this.supabase
                .from('questions')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            // 如果要同步給所有用戶，可以不需要這裡做（因為會很耗能）。
            // 新架構可以改為在取得個人資料時，動態查詢題目總數即可。
            console.log("Current total questions count in DB:", count);

        } catch (error) {
            console.error('同步卡片數量失敗:', error);
        }
    }


    // ==================== 進度與測驗相關 ====================

    /**
     * 提交答題結果（單題制，完整流程）
     * @param {Object} answerData - 答題資料
     * @param {string} answerData.userId - 用戶 ID
     * @param {string} answerData.questionId - 題目 ID
     * @param {string|Array} answerData.userAnswer - 用戶答案 (單選: "C", 複選: ["A", "C"])
     * @param {boolean} answerData.isCorrect - 是否答對
     * @param {number} [answerData.responseTimeMs] - 作答時間(毫秒)
     */
    async submitAnswer(answerData) {
        try {
            const { userId, questionId, userAnswer, isCorrect, responseTimeMs = null } = answerData;
            const now = new Date().toISOString();

            // 1. 檢查是否為首次答對該題
            const { data: existingProgress } = await this.supabase
                .from('user_question_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('question_id', questionId)
                .maybeSingle();

            const isFirstTime = !existingProgress;
            const wasCorrectBefore = existingProgress?.is_correct === true;

            // 2. 計算 XP 獎勵
            let xpToAdd = 0;
            const bonuses = [];

            if (isCorrect) {
                // 答對: +100 XP
                xpToAdd += XP_REWARDS.CORRECT;
                bonuses.push({ name: '答對題目', xp: XP_REWARDS.CORRECT });

                // 首次答對該題: 額外 +50 XP (開拓者獎勵)
                if (!wasCorrectBefore) {
                    xpToAdd += XP_REWARDS.PIONEER;
                    bonuses.push({ name: '開拓者獎勵', xp: XP_REWARDS.PIONEER });
                }
            } else {
                // 答錯: +0 XP
                xpToAdd = XP_REWARDS.INCORRECT;
            }

            // 3. 更新或建立 user_question_progress
            const newTimesReviewed = (existingProgress?.times_reviewed || 0) + 1;
            const newTimesCorrect = (existingProgress?.times_correct || 0) + (isCorrect ? 1 : 0);
            const newTimesIncorrect = (existingProgress?.times_incorrect || 0) + (isCorrect ? 0 : 1);

            const progressData = {
                user_id: userId,
                question_id: questionId,
                is_correct: isCorrect,
                times_reviewed: newTimesReviewed,
                times_correct: newTimesCorrect,
                times_incorrect: newTimesIncorrect,
                last_reviewed_at: now,
                updated_at: now
            };

            if (isFirstTime) {
                progressData.created_at = now;
            }

            const { error: progressError } = await this.supabase
                .from('user_question_progress')
                .upsert(progressData, { onConflict: 'user_id,question_id' });

            if (progressError) {
                console.error('更新進度失敗:', progressError);
                throw progressError;
            }

            // 4. 寫入 answer_records
            const { error: recordError } = await this.supabase
                .from('answer_records')
                .insert({
                    user_id: userId,
                    question_id: questionId,
                    user_answer: userAnswer,
                    is_correct: isCorrect,
                    response_time_ms: responseTimeMs,
                    xp_earned: xpToAdd,
                    created_at: now
                });

            if (recordError) {
                console.warn('寫入答題記錄失敗:', recordError);
            }

            // 5. 取得當前用戶資料（記錄升級前等級）
            const userProfileResult = await this.getUserProfile(userId);
            const oldLevel = userProfileResult.success ? userProfileResult.data.current_level : 1;

            // 6. 更新用戶 XP 與等級
            const userUpdateResult = await this.updateUserProgress(userId, {
                xpToAdd: xpToAdd
            });

            if (!userUpdateResult.success) {
                console.error('更新用戶 XP 失敗:', userUpdateResult.error);
                throw userUpdateResult.error;
            }

            // 7. 如果是首次答對，更新 correct_answer_count
            if (isCorrect && !wasCorrectBefore) {
                const currentCount = userProfileResult.data.correct_answer_count || 0;
                await this.updateUser(userId, {
                    correct_answer_count: currentCount + 1
                });
            }

            return {
                success: true,
                xpEarned: xpToAdd,
                bonuses: bonuses,
                isFirstTimeCorrect: isCorrect && !wasCorrectBefore,
                newUserData: userUpdateResult.data.user,
                leveledUp: userUpdateResult.data.leveledUp,
                newLevel: userUpdateResult.data.levelState ? userUpdateResult.data.levelState.actualLevel : null,
                oldLevel: oldLevel
            };

        } catch (error) {
            return this._handleError(error);
        }
    }



    // ==================== 管理員儀表板相關 ====================

    /**
     * 取得每日註冊趨勢（最近 30 天）
     */
    async getAdminDailyRegistrations(days = 30) {
        try {
            // 計算起始日期
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const startDateStr = startDate.toISOString().split('T')[0];

            const { data, error } = await this.supabase
                .from('users')
                .select('created_at')
                .gte('created_at', startDateStr)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // 處理數據：按日期分組統計
            const dailyStats = {};
            data.forEach(user => {
                const date = user.created_at.split('T')[0];
                dailyStats[date] = (dailyStats[date] || 0) + 1;
            });

            // 填充缺失的日期（確保連續）
            const result = [];
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (days - 1 - i));
                const dateStr = date.toISOString().split('T')[0];
                result.push({
                    date: dateStr,
                    count: dailyStats[dateStr] || 0
                });
            }

            return { success: true, data: result };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得錯誤次數最多的前 N 張卡片 (改版：取得錯誤率最高的題目)
     */
    async getAdminTopIncorrectCards(limit = 5) {
        try {
            // 使用 user_question_progress 進行錯題統計
            const { data, error } = await this.supabase
                .from('user_question_progress')
                .select('question_id, times_incorrect, questions!inner(question)')
                .order('times_incorrect', { ascending: false })
                .limit(100);

            if (error) throw error;

            // 手動聚合
            const questionStats = {};
            data.forEach(progress => {
                const qId = progress.question_id;
                if (!questionStats[qId]) {
                    questionStats[qId] = {
                        question_id: qId,
                        question_text: progress.questions?.question || 'Unknown',
                        total_incorrect: 0
                    };
                }
                questionStats[qId].total_incorrect += progress.times_incorrect || 0;
            });

            // 轉換為陣列並排序
            const sortedQuestions = Object.values(questionStats)
                .sort((a, b) => b.total_incorrect - a.total_incorrect)
                .slice(0, limit);

            return { success: true, data: sortedQuestions };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 新增：隨機出題配置與儲存紀錄 (寫入 random_test_sessions)
     * @param {string} userId
     * @param {string} sessionName 自訂名稱
     * @param {string} subject 單一大科目
     * @param {string[]} chapters 選擇的章節 Array
     * @param {number} count 出題數
     */
    async generateRandomTest(userId, sessionName, subject, chapters, count) {
        try {
            // 1. 撈出符合條件的庫存題目
            let query = this.supabase
                .from('questions')
                .select('id')
                .eq('subject', subject);

            if (chapters && chapters.length > 0) {
                // 有選特定的 chapter，否則就是 whole subject
                query = query.in('chapter', chapters);
            }

            const { data: availableQuestions, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            if (!availableQuestions || availableQuestions.length === 0) {
                return { success: false, message: '找不到符合條件的題目' };
            }

            // 2. 使用 Fisher-Yates 洗牌演算法隨機抽選 count 題
            const shuffled = [...availableQuestions];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const selected = shuffled.slice(0, count).map(q => q.id);

            // 3. 儲存 Session 紀錄
            const now = new Date().toISOString();
            const { data: sessionData, error: insertError } = await this.supabase
                .from('random_test_sessions')
                .insert({
                    user_id: userId,
                    session_name: sessionName || '隨機測驗',
                    subject: subject,
                    chapters: chapters || [],
                    question_ids: selected,
                    total_questions: selected.length,
                    created_at: now
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 4. 回傳抽到的資料，前端可依此 ids 再去查詢真正的 questions
            return {
                success: true,
                data: sessionData
            };
        } catch (error) {
            return this._handleError(error);
        }
    }
    // ==================== 錯誤處理 ====================

    async _createUserProfile(userId, nickname, email) {
        try {
            console.log('Creating user profile for:', userId);

            const attemptInsert = async (name) => {
                return await this.supabase
                    .from('users')
                    .insert({
                        id: userId,
                        username: name,
                        email: email,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
            };

            let { error } = await attemptInsert(nickname);

            // Retry on username collision
            if (error && error.code === '23505' && error.message.includes('users_username_key')) {
                console.log('Username collision, retrying with random suffix...');
                // Try up to 3 times
                for (let i = 0; i < 3; i++) {
                    const suffix = Math.floor(Math.random() * 10000);
                    const newName = `${nickname}_${suffix}`;
                    const retry = await attemptInsert(newName);
                    error = retry.error;
                    if (!error) break; // Success
                    if (error.code !== '23505' || !error.message.includes('users_username_key')) break; // Other error
                }
            }

            if (error) {
                // Ignore PK duplication (means user already exists, which is good)
                if (error.code === '23505' && !error.message.includes('users_username_key')) {
                    return { success: true };
                }
                throw error;
            }
            return { success: true };
        } catch (error) {
            console.error('Create profile failed:', error);
            return { success: false, error };
        }
    }

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
window.apiService = apiService;
