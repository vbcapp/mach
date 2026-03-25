/**
 * VibeCoding Flashcard - Supabase API Service
 * 完整的後端 API 封裝，處理所有資料庫操作
 */

class ApiService {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this._initPromise = null; // 防止並行初始化造成 auth lock 競爭
    }

    /**
     * 初始化 Supabase 客戶端
     */
    async initialize() {
        // 如果已經在初始化中，直接返回同一個 Promise，避免多個 getUser() 競爭 auth lock
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = this._doInitialize();
        return this._initPromise;
    }

    async _doInitialize() {
        try {
            if (typeof supabase === 'undefined') {
                console.error('Supabase SDK 未載入');
                return { success: false, error: 'SDK Not Loaded' };
            }

            // 使用共享 client，避免產生多個 GoTrueClient 實例
            if (!this.supabase) {
                this.supabase = (typeof getSharedSupabaseClient === 'function')
                    ? getSharedSupabaseClient()
                    : supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            }

            // 取得當前使用者
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUser = user;

            // 初始化角色管理器（從資料庫讀取角色）
            if (user && typeof RoleManager !== 'undefined') {
                await RoleManager.init(this.supabase);
            }

            // 從資料庫載入組織品牌設定（覆蓋 config.js 的預設值）
            if (typeof OrgBranding !== 'undefined') {
                await OrgBranding.fetch(this.supabase);
            }

            return { success: true, user };
        } catch (error) {
            console.error('初始化失敗:', error);
            // 初始化失敗時重置，允許下次重試
            this._initPromise = null;
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
                    },
                    emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html')
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
     * 純註冊（不嘗試登入）
     */
    async registerWithEmailPassword(email, password, nickname) {
        try {
            console.log('純註冊模式...', email);
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: nickname
                    },
                    emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html')
                }
            });

            if (error) {
                throw error;
            }

            if (data.user && data.session) {
                // 註冊成功且自動登入
                console.log('註冊成功，建立 Profile...');
                this.currentUser = data.user;
                await this._createUserProfile(this.currentUser.id, nickname, email);
                return { success: true, user: this.currentUser, isNewUser: true };
            }

            if (data.user && !data.session) {
                // 可能需要 Email 驗證，或使用者已存在（Prevent Email Enumeration 開啟時）
                // 不嘗試登入，直接提示用戶
                return { success: false, error: { message: '此 Email 可能已經註冊過了，請直接到登入頁面登入。若是新帳號，請檢查信箱完成驗證。' } };
            }

            return { success: false, error: { message: '註冊失敗，請稍後再試' } };

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
                        },
                        emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html')
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
        try {
            // 先檢查用戶是否存在，避免觸發 409 Conflict
            const { data: existingUser, error: checkError } = await this.supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            // 如果用戶已存在，不再重複建立，保留既有的 current_xp 等進度資料
            if (existingUser) {
                return { success: true };
            }

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

            const { error: insertError } = await this.supabase
                .from('users')
                .insert(profileData);

            if (insertError) {
                // 如果是用戶名重複錯誤，嘗試生成一個唯一的用戶名
                if (insertError.code === '23505' && insertError.message.includes('username')) {
                    const uniqueUsername = `${username}_${Date.now().toString(36)}`;
                    profileData.username = uniqueUsername;
                    const { error: retryError } = await this.supabase
                        .from('users')
                        .insert(profileData);
                    if (retryError) {
                        console.warn('_createUserProfile retry error:', retryError);
                    }
                    return { success: true };
                }

                // 取消打印重複 PK，因為這代表用戶以某種方式已被建立
                if (insertError.code === '23505') return { success: true };
                console.warn('_createUserProfile error:', insertError);
            }
            return { success: true };
        } catch (err) {
            console.error('_createUserProfile catch error:', err);
            return { success: false, error: err };
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
                    levelState = LevelSystem.calculateState(user.current_xp || 0, user.correct_answer_count || 0);
                }

                return {
                    ...user,
                    actualLevel: levelState.actualLevel,
                    isCapped: levelState.isCapped,
                    total_questions: user.total_questions || 0 // 對應前端需要的欄位
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
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.correct_answer_count || 0);
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
            // 注意：這裡假設 users 表有 total_questions 欄位。如果不準確，可能需要 join flashcards count，但那樣效能較差。
            // 我們先信任 users.total_questions (由 createCard/deleteCard 維護)
            const { data: users, error, count } = await this.supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('total_questions', { ascending: false })
                .limit(100);

            if (error) throw error;

            // 2. 處理用戶資料
            const processedUsers = users.map(user => {
                let levelState = {
                    actualLevel: user.current_level || 1
                };

                if (typeof LevelSystem !== 'undefined') {
                    levelState = LevelSystem.calculateState(user.current_xp || 0, user.correct_answer_count || 0);
                }

                return {
                    ...user,
                    actualLevel: levelState.actualLevel,
                    total_questions: user.total_questions || 0
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
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.correct_answer_count || 0);
                        }

                        currentUserData = {
                            ...myProfile.data,
                            actualLevel: myLevelState.actualLevel,
                            total_questions: myProfile.data.total_questions || 0
                        };

                        // 計算排名
                        const { count: higherCount, error: rankError } = await this.supabase
                            .from('users')
                            .select('*', { count: 'exact', head: true })
                            .gt('total_questions', currentUserData.total_questions);

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
     * 取得答題次數排行榜資料
     * @param {string} currentUserId - 當前用戶 ID
     * @param {string} period - 時間區間 ('daily' | 'weekly')
     */
    async getAnswerCountLeaderboard(currentUserId, period = 'daily') {
        try {
            // 計算時間範圍
            const now = new Date();
            let startDate;

            if (period === 'daily') {
                // 今天 00:00:00
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else {
                // 本週一 00:00:00
                const dayOfWeek = now.getDay();
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 週日為 0，需要回推 6 天
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
            }

            const startDateISO = startDate.toISOString();

            // 1. 透過後端 RPC 取得所有使用者的答題次數排行 (繞過 RLS 並提升效能)
            const { data: answerData, error: answerError } = await this.supabase
                .rpc('get_leaderboard_answer_counts', { start_date: startDateISO });

            if (answerError) throw answerError;

            // 2. 建立對應字典供後續快速尋找當前使用者資料
            const userAnswerCount = {};
            answerData.forEach(record => {
                if (record.user_id) {
                    userAnswerCount[record.user_id] = Number(record.answer_count);
                }
            });

            // 3. 取前 100 名
            const sortedUsers = answerData.slice(0, 100).map(u => ({
                user_id: u.user_id,
                answer_count: Number(u.answer_count)
            }));

            // 4. 取得用戶詳細資料
            const userIds = sortedUsers.map(u => u.user_id);
            let usersMap = {};

            if (userIds.length > 0) {
                const { data: usersData, error: usersError } = await this.supabase
                    .from('users')
                    .select('id, username, avatar_url, current_xp, correct_answer_count, current_level')
                    .in('id', userIds);

                if (usersError) throw usersError;

                usersData.forEach(user => {
                    usersMap[user.id] = user;
                });
            }

            // 5. 組合結果
            const processedUsers = sortedUsers.map(item => {
                const user = usersMap[item.user_id] || {};
                let levelState = { actualLevel: user.current_level || 1 };

                if (typeof LevelSystem !== 'undefined') {
                    levelState = LevelSystem.calculateState(user.current_xp || 0, user.correct_answer_count || 0);
                }

                return {
                    id: item.user_id,
                    username: user.username || '未知用戶',
                    avatar_url: user.avatar_url,
                    answer_count: item.answer_count,
                    actualLevel: levelState.actualLevel
                };
            });

            // 6. 找出當前用戶排名
            let currentUserRank = -1;
            let currentUserData = null;
            let currentUserAnswerCount = 0;

            if (currentUserId) {
                currentUserAnswerCount = userAnswerCount[currentUserId] || 0;

                const index = processedUsers.findIndex(u => u.id === currentUserId);
                if (index !== -1) {
                    currentUserRank = index + 1;
                    currentUserData = processedUsers[index];
                } else if (currentUserAnswerCount > 0) {
                    // 不在前 100 名但有答題記錄
                    const myProfile = await this.getUserProfile(currentUserId);
                    if (myProfile.success) {
                        let myLevelState = { actualLevel: myProfile.data.current_level || 1 };
                        if (typeof LevelSystem !== 'undefined') {
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.correct_answer_count || 0);
                        }

                        currentUserData = {
                            id: currentUserId,
                            username: myProfile.data.username,
                            avatar_url: myProfile.data.avatar_url,
                            answer_count: currentUserAnswerCount,
                            actualLevel: myLevelState.actualLevel
                        };

                        // 計算排名：有多少人答題次數比我多
                        currentUserRank = Object.values(userAnswerCount).filter(c => c > currentUserAnswerCount).length + 1;
                    }
                } else {
                    // 沒有答題記錄
                    const myProfile = await this.getUserProfile(currentUserId);
                    if (myProfile.success) {
                        let myLevelState = { actualLevel: myProfile.data.current_level || 1 };
                        if (typeof LevelSystem !== 'undefined') {
                            myLevelState = LevelSystem.calculateState(myProfile.data.current_xp || 0, myProfile.data.correct_answer_count || 0);
                        }

                        currentUserData = {
                            id: currentUserId,
                            username: myProfile.data.username,
                            avatar_url: myProfile.data.avatar_url,
                            answer_count: 0,
                            actualLevel: myLevelState.actualLevel
                        };
                        currentUserRank = Object.keys(userAnswerCount).length + 1;
                    }
                }
            }

            return {
                success: true,
                data: processedUsers,
                totalParticipants: Object.keys(userAnswerCount).length,
                currentUserRank,
                currentUserData,
                period,
                periodLabel: period === 'daily' ? '今日' : '本週'
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

            // 取得該用戶可存取的題目總數
            let totalQuestions = 0;
            const accessResult = await this._getUserAccessibleChapters(userId);
            if (accessResult.success && accessResult.data.length > 0) {
                const orConditions = accessResult.data.map(
                    ch => `and(subject.eq."${ch.subject}",chapter.eq."${ch.chapter}")`
                ).join(',');

                const { count, error: accessCountError } = await this.supabase
                    .from('questions')
                    .select('*', { count: 'exact', head: true })
                    .or(orConditions);

                if (!accessCountError) {
                    totalQuestions = count || 0;
                }
            }

            // 取得該用戶已作答的題目數（user_question_progress 中有記錄的）
            const { count: answeredQuestions, error: answeredError } = await this.supabase
                .from('user_question_progress')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            return {
                success: true,
                data: {
                    ...data,
                    accessible_questions: totalQuestions || 0,
                    answered_questions: answeredQuestions || 0,
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
            // 1. 使用資料庫端原子遞增，避免競態條件 (Race Condition)
            const { data: rpcResult, error: rpcError } = await this.supabase
                .rpc('update_user_xp', {
                    p_user_id: userId,
                    p_xp_to_add: xpToAdd,
                    p_perfect_cards_to_add: perfectCardsToAdd
                });

            if (rpcError) throw rpcError;

            if (!rpcResult || rpcResult.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const newTotalXP = rpcResult[0].new_current_xp;
            const newPerfectCards = rpcResult[0].new_correct_answer_count;

            // 2. 使用 LevelSystem 計算等級狀態
            if (typeof LevelSystem === 'undefined') {
                console.error('LevelSystem is not defined');
                return { success: false, error: 'LevelSystem missing' };
            }

            const levelState = LevelSystem.calculateState(newTotalXP, newPerfectCards);

            // 3. 更新等級相關欄位（這些不需要原子操作，因為只依賴剛算出的值）
            const oldLevel = (await this.supabase
                .from('users').select('current_level').eq('id', userId).single()
            ).data?.current_level || 1;

            await this.updateUser(userId, {
                current_level: levelState.actualLevel,
                next_level_xp: levelState.xpForNextLevel
            });

            return {
                success: true,
                data: {
                    user: { current_xp: newTotalXP, correct_answer_count: newPerfectCards, current_level: levelState.actualLevel },
                    levelState: levelState,
                    leveledUp: levelState.actualLevel > oldLevel
                }
            };

        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 題目相關 ====================
    // ==================== 卡片相關 ====================
    /**
     * 取得學員可存取的章節資訊 (內部防護)
     * @param {string} userId
     * @returns {Promise<{success: boolean, data?: Array<{subject: string, chapter: string}>, error?: any}>}
     */
    async _getUserAccessibleChapters(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 取得學員的 tags
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('tags')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            const userTags = user.tags || [];

            // 2. 取得可存取的章節
            let fetchAccessQuery = this.supabase
                .from('chapter_access')
                .select('subject, chapter');

            if (userTags.length > 0) {
                // Supabase SDK 的 or 語法，如果對 jsonb array 用 ov 會報錯 jsonb && unknown
                // 因此改為對每一個 tag 產生一組 cs (contains) 的條件
                const tagConditions = userTags.map(tag => `allowed_tags.cs.[${JSON.stringify(tag)}]`).join(',');
                fetchAccessQuery = fetchAccessQuery.or(`is_public.eq.true,${tagConditions}`);
            } else {
                fetchAccessQuery = fetchAccessQuery.eq('is_public', true);
            }

            const { data: accessibleChapters, error: accessError } = await fetchAccessQuery;

            if (accessError) throw accessError;

            return { success: true, data: accessibleChapters || [] };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得學員可存取的章節清單，並回傳對應的題目
     * 支援透過使用者身上的 tags 與 chapter_access 設定比對權限
     */
    async getAccessibleQuestions(userId, options = {}) {
        try {
            // 1 & 2. 取得可存取的章節
            const accessResult = await this._getUserAccessibleChapters(userId);
            if (!accessResult.success) return accessResult;

            let accessibleChapters = accessResult.data;

            // 如果沒有任何可用的章節，直接回傳空陣列
            if (accessibleChapters.length === 0) {
                return {
                    success: true,
                    data: {
                        cards: [],
                        pagination: {
                            currentPage: options.page || 1,
                            totalPages: 0,
                            totalItems: 0,
                            itemsPerPage: options.limit || 20
                        }
                    }
                };
            }

            const {
                searchQuery = null,
                page = 1,
                limit = 20,
                subject = null,
                chapter = null,
                subjectChapterPairs = null
            } = options;

            // 精確的 subject+chapter 組合篩選（優先使用）
            if (subjectChapterPairs) {
                accessibleChapters = accessibleChapters.filter(ch =>
                    subjectChapterPairs.some(p => p.subject === ch.subject && p.chapter === ch.chapter)
                );
            } else {
                // 向下相容：分別用 subject / chapter 篩選
                if (subject) {
                    const subjectFilters = Array.isArray(subject) ? subject : [subject];
                    accessibleChapters = accessibleChapters.filter(ch => subjectFilters.includes(ch.subject));
                }
                if (chapter) {
                    const chapterFilters = Array.isArray(chapter) ? chapter : [chapter];
                    accessibleChapters = accessibleChapters.filter(ch => chapterFilters.includes(ch.chapter));
                }
            }

            // 如果過濾後沒有章節了，一樣回傳空陣列
            if (accessibleChapters.length === 0) {
                return {
                    success: true,
                    data: {
                        cards: [],
                        pagination: {
                            currentPage: page,
                            totalPages: 0,
                            totalItems: 0,
                            itemsPerPage: limit
                        }
                    }
                };
            }

            // 4. 用這些章節與科目篩選題目
            // 建立一個 or 字串來過濾特定的 subject + chapter 組合
            // 格式：and(subject.eq.科目A,chapter.eq.章節A),and(subject.eq.科目B,chapter.eq.章節B)
            const orConditions = accessibleChapters.map(
                ch => `and(subject.eq."${ch.subject}",chapter.eq."${ch.chapter}")`
            ).join(',');

            let query = this.supabase
                .from('questions')
                .select('*, user_question_progress!left(*)', { count: 'exact' })
                .or(orConditions) // 加上權限過濾！
                .order('subject_no', { ascending: true })
                .order('chapter_no', { ascending: true })
                .order('question_no', { ascending: true });


            // 搜尋過濾
            if (searchQuery) {
                query = query.or(`question.ilike.%${searchQuery}%,explanation.ilike.%${searchQuery}%`);
            }

            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);

            const { data: questionsData, error: queryError, count } = await query;

            if (queryError) throw queryError;

            // 整理加上 progress，並確保留下這名使用者的進度 (其餘忽略)
            const questions = questionsData.map(q => {
                let progress = null;
                if (q.user_question_progress && q.user_question_progress.length > 0) {
                    progress = q.user_question_progress.find(p => p.user_id === userId) || null;
                }
                return {
                    ...q,
                    progress: progress
                };
            });

            return {
                success: true,
                data: {
                    cards: questions,
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
     * 取得使用者的精準弱點打擊清單
     * 條件：times_incorrect > 0
     * 排序：error_rate (times_incorrect / times_reviewed) 降冪, times_incorrect 降冪
     * @param {string} userId - 用戶 ID
     * @param {number} limit - 取前幾名 (預設 20)
     */
    async getWeaknessList(userId, limit = 20) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 取得該用戶所有有答錯紀錄的進度
            const { data: progressData, error: progressError } = await this.supabase
                .from('user_question_progress')
                .select('question_id, times_reviewed, times_correct, times_incorrect')
                .eq('user_id', userId)
                .gt('times_incorrect', 0); // 只抓有錯過的

            if (progressError) throw progressError;

            if (!progressData || progressData.length === 0) {
                return { success: true, data: [] };
            }

            // 2. 為了取得題目內容，我們需要把這些 question_ids 拿去撈 questions 表
            const questionIds = progressData.map(p => p.question_id);

            // 如果超過一定數量 (例如 1000)，Supabase 的 .in() 可能會報錯或效能不佳。
            // 但因為是弱點列表，通常錯題數量還在可接受範圍。為了保險，我們可以在這裡處理或者假設不超過。
            // 由於 Supabase 沒有好用的 inner join RPC (如果不寫 stored procedure 的話)，
            // 在前端先計算 error_rate 並排序，取前 Limit 名的 ID，再去撈 Questions 會更有效率。

            // 3. 在前端計算錯率並排序
            const calculatedProgress = progressData.map(p => {
                // times_reviewed 有可能為 0 (理論上不可能，但防禦性設計)
                const reviewed = p.times_reviewed > 0 ? p.times_reviewed : 1;
                const errorRate = p.times_incorrect / reviewed;
                return {
                    ...p,
                    error_rate: errorRate
                };
            });

            // 排序邏輯：優先依錯率降冪，次要依錯次降冪
            calculatedProgress.sort((a, b) => {
                if (b.error_rate !== a.error_rate) {
                    return b.error_rate - a.error_rate; // 錯率高的在前
                }
                return b.times_incorrect - a.times_incorrect; // 錯率一樣時，錯次多的在前 (分母大)
            });

            // 取 Top N
            const topWeakness = calculatedProgress.slice(0, limit);
            const topQuestionIds = topWeakness.map(p => p.question_id);

            // 4. 撈取對應的題目詳細資料
            const { data: questionsData, error: questionsError } = await this.supabase
                .from('questions')
                .select('id, question, subject, chapter')
                .in('id', topQuestionIds);

            if (questionsError) throw questionsError;

            // 5. 合併資料
            const result = topWeakness.map(progress => {
                const q = questionsData.find(qd => qd.id === progress.question_id);
                return {
                    ...progress,
                    question_data: q || null
                };
            }).filter(item => item.question_data !== null); // 過濾掉找不到題目的髒資料

            return { success: true, data: result };

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
     * 改為根據用戶權限取得
     */
    async getUniqueCategories(userId) {
        if (!userId) return { success: false, error: 'User ID is required' };
        try {
            const result = await this._getUserAccessibleChapters(userId);
            if (!result.success) return result;

            // 提取不重複的 subject
            const uniqueSubjects = [...new Set(result.data.map(ch => ch.subject).filter(Boolean))];

            // 排序
            const collator = new Intl.Collator('zh-TW', { numeric: true });
            uniqueSubjects.sort(collator.compare);

            return { success: true, data: uniqueSubjects };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得分組的大分類→次分類資料（用於首頁篩選 Modal 的階層式篩選）
     * 回傳格式：[{ subject, chapters: [chapter1, chapter2, ...] }, ...]
     * 依 subject_no、chapter_no 排序
     */
    async getGroupedCategories(userId) {
        if (!userId) return { success: false, error: 'User ID is required' };
        try {
            const accessResult = await this._getUserAccessibleChapters(userId);
            if (!accessResult.success) return accessResult;

            // 取得排序資訊
            const chapterNames = [...new Set(accessResult.data.map(ch => ch.chapter).filter(Boolean))];
            let chapterOrderMap = new Map();
            let subjectOrderMap = new Map();

            if (chapterNames.length > 0) {
                const { data: orderData, error } = await this.supabase
                    .from('questions')
                    .select('subject, chapter, subject_no, chapter_no')
                    .in('chapter', chapterNames);
                if (!error && orderData) {
                    orderData.forEach(item => {
                        if (item.chapter && !chapterOrderMap.has(item.chapter)) {
                            chapterOrderMap.set(item.chapter, item.chapter_no || 999);
                        }
                        if (item.subject && !subjectOrderMap.has(item.subject)) {
                            subjectOrderMap.set(item.subject, item.subject_no || 999);
                        }
                    });
                }
            }

            // 以 subject 分組
            const groupMap = new Map();
            accessResult.data.forEach(ch => {
                if (!ch.subject || !ch.chapter) return;
                if (!groupMap.has(ch.subject)) {
                    groupMap.set(ch.subject, new Set());
                }
                groupMap.get(ch.subject).add(ch.chapter);
            });

            // 轉成陣列並排序
            const grouped = [...groupMap.entries()]
                .map(([subject, chaptersSet]) => ({
                    subject,
                    subjectOrder: subjectOrderMap.get(subject) || 999,
                    chapters: [...chaptersSet].sort((a, b) =>
                        (chapterOrderMap.get(a) || 999) - (chapterOrderMap.get(b) || 999)
                    )
                }))
                .sort((a, b) => a.subjectOrder - b.subjectOrder);

            return { success: true, data: grouped };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得所有不重複的章節列表（用於首頁篩選按鈕）
     * 依照 chapter_no 排序
     */
    async getUniqueChapters() {
        try {
            const { data, error } = await this.supabase
                .from('questions')
                .select('chapter, chapter_no');

            if (error) throw error;

            // 建立 chapter -> chapter_no 的對照表（取每個 chapter 的第一個 chapter_no）
            const chapterMap = new Map();
            data.forEach(item => {
                if (item.chapter && !chapterMap.has(item.chapter)) {
                    chapterMap.set(item.chapter, item.chapter_no || 999);
                }
            });

            // 取得唯一章節並依 chapter_no 排序
            const uniqueChapters = [...chapterMap.keys()].sort((a, b) => {
                return (chapterMap.get(a) || 999) - (chapterMap.get(b) || 999);
            });

            return { success: true, data: uniqueChapters };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得學員可存取的章節清單 (純章節名稱陣列，供首頁篩選按鈕使用)
     * 會先抓取有權限的章節，再與原本的 chapter_no 排序邏輯結合
     */
    async getAccessibleChaptersList(userId) {
        if (!userId) return { success: false, error: 'User ID is required' };

        try {
            // 1. 取得該用戶有權限的章節資料
            const accessResult = await this._getUserAccessibleChapters(userId);
            if (!accessResult.success) return accessResult;

            // 提取有權限的章節名稱 (去重)
            const allowedChapterNames = [...new Set(accessResult.data.map(ch => ch.chapter).filter(Boolean))];

            if (allowedChapterNames.length === 0) {
                return { success: true, data: [] };
            }

            // 2. 獲取排序資訊，只過濾在 allowedChapterNames 裡面的
            const { data, error } = await this.supabase
                .from('questions')
                .select('chapter, chapter_no')
                .in('chapter', allowedChapterNames);

            if (error) throw error;

            // 建立 chapter -> chapter_no 的對照表
            const chapterMap = new Map();
            data.forEach(item => {
                if (item.chapter && !chapterMap.has(item.chapter)) {
                    chapterMap.set(item.chapter, item.chapter_no || 999);
                }
            });

            // 如果有些章節在題庫中沒有對應的題目 (例如被手動新增章節權限但不含任何題目)，防呆處理
            allowedChapterNames.forEach(ch => {
                if (!chapterMap.has(ch)) {
                    chapterMap.set(ch, 999);
                }
            });

            // 取得唯一章節並依 chapter_no 排序
            const uniqueChapters = [...chapterMap.keys()].sort((a, b) => {
                return (chapterMap.get(a) || 999) - (chapterMap.get(b) || 999);
            });

            return { success: true, data: uniqueChapters };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 根據大科目，取得不重複的章節列表
     * 依照 chapter_no 排序
     */
    async getUniqueChaptersBySubject(subject) {
        try {
            let query = this.supabase
                .from('questions')
                .select('chapter, chapter_no');

            if (subject) {
                query = query.eq('subject', subject);
            }

            const { data, error } = await query;

            if (error) throw error;

            // 建立 chapter -> chapter_no 的對照表
            const chapterMap = new Map();
            data.forEach(item => {
                if (item.chapter && !chapterMap.has(item.chapter)) {
                    chapterMap.set(item.chapter, item.chapter_no || 999);
                }
            });

            // 取得唯一章節並依 chapter_no 排序
            const uniqueChapters = [...chapterMap.keys()].sort((a, b) => {
                return (chapterMap.get(a) || 999) - (chapterMap.get(b) || 999);
            });

            return { success: true, data: uniqueChapters };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 複製母版題庫給新用戶
     * 從母版管理者那邊將 questions 複製給新登入的用戶
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
            // 因為 PRD：「母版題庫複製: 母版管理者的題目作為共用題庫」
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
     * 切換題目的收藏狀態
     * @param {string} userId - 用戶 ID
     * @param {string} questionId - 題目 ID
     * @returns {Object} { success, data: { is_favorite } }
     */
    async toggleFavorite(userId, questionId) {
        try {
            const now = new Date().toISOString();

            // 1. 檢查是否已有進度記錄
            const { data: existingProgress, error: fetchError } = await this.supabase
                .from('user_question_progress')
                .select('id, is_favorite')
                .eq('user_id', userId)
                .eq('question_id', questionId)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            let newFavoriteState;

            if (existingProgress) {
                // 已有記錄，切換狀態
                newFavoriteState = !existingProgress.is_favorite;
                const { error: updateError } = await this.supabase
                    .from('user_question_progress')
                    .update({ is_favorite: newFavoriteState, updated_at: now })
                    .eq('id', existingProgress.id);

                if (updateError) throw updateError;
            } else {
                // 尚無記錄，建立新記錄並設為收藏
                newFavoriteState = true;
                const { error: insertError } = await this.supabase
                    .from('user_question_progress')
                    .insert({
                        user_id: userId,
                        question_id: questionId,
                        is_favorite: true,
                        is_correct: null,
                        times_reviewed: 0,
                        times_correct: 0,
                        times_incorrect: 0,
                        created_at: now,
                        updated_at: now
                    });

                if (insertError) throw insertError;
            }

            return { success: true, data: { is_favorite: newFavoriteState } };
        } catch (error) {
            console.error('切換收藏失敗:', error);
            return this._handleError(error);
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
     * 匯入後會自動同步 chapter_access 表
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

            // 自動同步 chapter_access 表（將新章節加入權限控制）
            await this.syncChapterAccess();

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
     * 批量刪除題目（僅管理員可用）
     * @param {string[]} questionIds - 要刪除的題目 ID 陣列
     * @returns {Promise<{success: boolean, deletedCount: number}>}
     */
    async deleteQuestions(questionIds) {
        try {
            if (!questionIds || questionIds.length === 0) {
                return { success: false, error: { message: '請選擇要刪除的題目' } };
            }

            const { error } = await this.supabase
                .from('questions')
                .delete()
                .in('id', questionIds);

            if (error) throw error;

            await this._syncUserCardCount();

            return { success: true, deletedCount: questionIds.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得所有題目（管理員用，不受權限限制）
     * 支援科目、章節篩選和搜尋
     */
    async getAdminQuestions(options = {}) {
        try {
            const {
                subject = null,
                chapter = null,
                searchQuery = null
            } = options;

            let query = this.supabase
                .from('questions')
                .select('id, subject, subject_no, chapter, chapter_no, question_no, question, question_type, option_a, option_b, option_c, option_d, correct_answer')
                .order('subject_no', { ascending: true })
                .order('chapter_no', { ascending: true })
                .order('question_no', { ascending: true });

            if (subject) {
                query = query.eq('subject', subject);
            }
            if (chapter) {
                query = query.eq('chapter', chapter);
            }
            if (searchQuery) {
                query = query.or(`question.ilike.%${searchQuery}%,explanation.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data: data || [] };
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
            const { userId, questionId, userAnswer, isCorrect, responseTimeMs = null, bonusXP } = answerData;
            const now = new Date().toISOString();

            // 1. 檢查是否為首次答對該題
            const { data: existingProgress } = await this.supabase
                .from('user_question_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('question_id', questionId)
                .maybeSingle();

            const isFirstTime = !existingProgress;
            const wasCorrectBefore = (existingProgress?.times_correct > 0);

            // 2. 計算 XP 獎勵（優先使用前端傳入的 bonusXP，含爆擊加成）
            let xpToAdd = 0;

            if (bonusXP !== undefined && bonusXP !== null) {
                xpToAdd = bonusXP;
            } else if (isCorrect) {
                xpToAdd = XP_REWARDS.CORRECT;
            } else {
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

            // 4.5 若為複製題，同步回寫原始題目的 progress
            try {
                const { data: questionData } = await this.supabase
                    .from('questions')
                    .select('source_question_id')
                    .eq('id', questionId)
                    .maybeSingle();

                if (questionData?.source_question_id) {
                    const sourceId = questionData.source_question_id;

                    // 取得原始題目的現有 progress
                    const { data: sourceProgress } = await this.supabase
                        .from('user_question_progress')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('question_id', sourceId)
                        .maybeSingle();

                    const srcReviewed = (sourceProgress?.times_reviewed || 0) + 1;
                    const srcCorrect = (sourceProgress?.times_correct || 0) + (isCorrect ? 1 : 0);
                    const srcIncorrect = (sourceProgress?.times_incorrect || 0) + (isCorrect ? 0 : 1);

                    const sourceProgressData = {
                        user_id: userId,
                        question_id: sourceId,
                        is_correct: isCorrect,
                        times_reviewed: srcReviewed,
                        times_correct: srcCorrect,
                        times_incorrect: srcIncorrect,
                        last_reviewed_at: now,
                        updated_at: now
                    };

                    if (!sourceProgress) {
                        sourceProgressData.created_at = now;
                    }

                    await this.supabase
                        .from('user_question_progress')
                        .upsert(sourceProgressData, { onConflict: 'user_id,question_id' });
                }
            } catch (syncError) {
                console.warn('同步原始題目進度失敗（不影響主流程）:', syncError);
            }

            // 5. 取得當前用戶資料（記錄升級前等級）
            const userProfileResult = await this.getUserProfile(userId);
            const oldLevel = userProfileResult.success ? userProfileResult.data.current_level : 1;

            // 6. 更新用戶 XP、等級與滿分卡片數
            const perfectCardsToAdd = (isCorrect && !wasCorrectBefore) ? 1 : 0;
            const userUpdateResult = await this.updateUserProgress(userId, {
                xpToAdd: xpToAdd,
                perfectCardsToAdd: perfectCardsToAdd
            });

            if (!userUpdateResult.success) {
                console.error('更新用戶 XP 失敗:', userUpdateResult.error);
                throw userUpdateResult.error;
            }

            return {
                success: true,
                xpEarned: xpToAdd,
                newUserData: userUpdateResult.data.user,
                leveledUp: userUpdateResult.data.leveledUp,
                newLevel: userUpdateResult.data.levelState ? userUpdateResult.data.levelState.actualLevel : null,
                oldLevel: oldLevel
            };

        } catch (error) {
            return this._handleError(error);
        }
    }



    // ==================== AI 分析歷史相關 ====================

    /**
     * 檢查今天是否已生成分析
     * @param {string} userId
     * @returns {Promise<{exists: boolean, data?: object, success: boolean, error?: any}>}
     */
    async checkTodayAnalysisExists(userId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await this.supabase
                .from('user_ai_analyses')
                .select('id, analysis_content, stats_snapshot, generated_at')
                .eq('user_id', userId)
                .gte('generated_at', today.toISOString())
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return { exists: !!data, data, success: true };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 儲存 AI 分析結果
     * @param {string} userId
     * @param {string} analysisContent
     * @param {object} statsSnapshot
     * @returns {Promise<{success: boolean, data?: object, error?: any}>}
     */
    async saveAIAnalysis(userId, analysisContent, statsSnapshot) {
        try {
            const { data, error } = await this.supabase
                .from('user_ai_analyses')
                .insert({
                    user_id: userId,
                    analysis_content: analysisContent,
                    stats_snapshot: statsSnapshot
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得用戶歷史分析記錄
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<{success: boolean, data?: array, error?: any}>}
     */
    async getUserAnalysisHistory(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('user_ai_analyses')
                .select('*')
                .eq('user_id', userId)
                .order('generated_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 權限管理相關 ====================

    /**
     * 取得所有標籤
     */
    async getAllTags() {
        try {
            const { data, error } = await this.supabase
                .from('tags')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 建立新標籤
     * @param {string} name - 標籤名稱
     * @param {string} color - 標籤顏色 (hex)
     */
    async createTag(name, color = '#FFD600') {
        try {
            const { data, error } = await this.supabase
                .from('tags')
                .insert({ name, color })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 更新標籤
     * @param {string} tagId - 標籤 ID
     * @param {object} updates - 更新內容 { name?, color? }
     */
    async updateTag(tagId, updates) {
        try {
            const { data, error } = await this.supabase
                .from('tags')
                .update(updates)
                .eq('id', tagId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 刪除標籤
     * @param {string} tagId - 標籤 ID
     */
    async deleteTag(tagId) {
        try {
            const { error } = await this.supabase
                .from('tags')
                .delete()
                .eq('id', tagId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得所有章節權限設定（含題目數量統計）
     */
    async getAllChapterAccess() {
        try {
            // 1. 取得所有 chapter_access 設定
            const { data: accessData, error: accessError } = await this.supabase
                .from('chapter_access')
                .select('*')
                .order('subject', { ascending: true })
                .order('chapter', { ascending: true });

            if (accessError) throw accessError;

            // 2. 取得每個 subject + chapter 的題目數量
            const { data: questionCounts, error: countError } = await this.supabase
                .from('questions')
                .select('subject, chapter');

            if (countError) throw countError;

            // 3. 計算每個組合的題目數
            const countMap = {};
            questionCounts.forEach(q => {
                const key = `${q.subject}||${q.chapter}`;
                countMap[key] = (countMap[key] || 0) + 1;
            });

            // 4. 合併資料
            const result = accessData.map(access => ({
                ...access,
                question_count: countMap[`${access.subject}||${access.chapter}`] || 0
            }));

            return { success: true, data: result };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 更新章節權限設定
     * @param {string} accessId - chapter_access ID
     * @param {object} updates - 更新內容 { allowed_tags?, is_public? }
     */
    async updateChapterAccess(accessId, updates) {
        try {
            updates.updated_at = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('chapter_access')
                .update(updates)
                .eq('id', accessId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 批量更新多個章節的權限設定
     * @param {string[]} accessIds - 章節權限 ID 陣列
     * @param {Object} updates - 更新內容 { is_public, allowed_tags }
     */
    async batchUpdateChapterAccess(accessIds, updates) {
        try {
            const { error } = await this.supabase
                .from('chapter_access')
                .update({
                    is_public: updates.is_public,
                    allowed_tags: updates.allowed_tags,
                    updated_at: new Date().toISOString()
                })
                .in('id', accessIds);

            if (error) throw error;
            return { success: true, updatedCount: accessIds.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 批量新增標籤到多個章節的 allowed_tags
     * @param {string[]} accessIds - 章節權限 ID 陣列
     * @param {string[]} tagsToAdd - 要新增的標籤
     */
    async addTagsToChapters(accessIds, tagsToAdd) {
        try {
            const { data: chapters, error: fetchError } = await this.supabase
                .from('chapter_access')
                .select('id, allowed_tags')
                .in('id', accessIds);

            if (fetchError) throw fetchError;

            const updates = chapters.map(chapter => {
                const currentTags = chapter.allowed_tags || [];
                const mergedTags = [...new Set([...currentTags, ...tagsToAdd])];
                return {
                    id: chapter.id,
                    allowed_tags: mergedTags,
                    updated_at: new Date().toISOString()
                };
            });

            for (const u of updates) {
                const { error: updateError } = await this.supabase
                    .from('chapter_access')
                    .update({ allowed_tags: u.allowed_tags, updated_at: u.updated_at })
                    .eq('id', u.id);
                if (updateError) throw updateError;
            }
            return { success: true, updatedCount: updates.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 批量移除多個章節的特定標籤
     * @param {string[]} accessIds - 章節權限 ID 陣列
     * @param {string[]} tagsToRemove - 要移除的標籤
     */
    async removeTagsFromChapters(accessIds, tagsToRemove) {
        try {
            const { data: chapters, error: fetchError } = await this.supabase
                .from('chapter_access')
                .select('id, allowed_tags')
                .in('id', accessIds);

            if (fetchError) throw fetchError;

            const updates = chapters.map(chapter => {
                const currentTags = chapter.allowed_tags || [];
                const filteredTags = currentTags.filter(t => !tagsToRemove.includes(t));
                return {
                    id: chapter.id,
                    allowed_tags: filteredTags,
                    updated_at: new Date().toISOString()
                };
            });

            for (const u of updates) {
                const { error: updateError } = await this.supabase
                    .from('chapter_access')
                    .update({ allowed_tags: u.allowed_tags, updated_at: u.updated_at })
                    .eq('id', u.id);
                if (updateError) throw updateError;
            }
            return { success: true, updatedCount: updates.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 批量更新章節的 allowed_tags
     * @param {string} subject - 大科目
     * @param {string} chapter - 章節
     * @param {string[]} allowedTags - 允許的標籤陣列
     */
    async setChapterAllowedTags(subject, chapter, allowedTags) {
        try {
            const { data, error } = await this.supabase
                .from('chapter_access')
                .update({
                    allowed_tags: allowedTags,
                    updated_at: new Date().toISOString()
                })
                .eq('subject', subject)
                .eq('chapter', chapter)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 設定章節為公開/非公開
     * @param {string} subject - 大科目
     * @param {string} chapter - 章節
     * @param {boolean} isPublic - 是否公開
     */
    async setChapterPublic(subject, chapter, isPublic) {
        try {
            const { data, error } = await this.supabase
                .from('chapter_access')
                .update({
                    is_public: isPublic,
                    updated_at: new Date().toISOString()
                })
                .eq('subject', subject)
                .eq('chapter', chapter)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 同步 chapter_access 表（將 questions 中的新章節加入）
     * 管理員匯入新題目後呼叫此函式
     */
    async syncChapterAccess() {
        try {
            // 1. 取得 questions 中所有不重複的 subject + chapter 組合
            const { data: chapters, error: fetchError } = await this.supabase
                .from('questions')
                .select('subject, chapter');

            if (fetchError) throw fetchError;

            // 2. 取得目前 chapter_access 中已有的組合
            const { data: existingAccess, error: existingError } = await this.supabase
                .from('chapter_access')
                .select('subject, chapter');

            if (existingError) throw existingError;

            // 3. 找出需要新增的組合
            const existingSet = new Set(
                existingAccess.map(a => `${a.subject}||${a.chapter}`)
            );

            const uniqueChapters = [...new Set(
                chapters
                    .filter(c => c.subject && c.chapter)
                    .map(c => `${c.subject}||${c.chapter}`)
            )];

            const newChapters = uniqueChapters
                .filter(key => !existingSet.has(key))
                .map(key => {
                    const [subject, chapter] = key.split('||');
                    return { subject, chapter, is_public: false, allowed_tags: [] };
                });

            // 4. 批量插入新章節
            if (newChapters.length > 0) {
                const { error: insertError } = await this.supabase
                    .from('chapter_access')
                    .insert(newChapters);

                if (insertError) throw insertError;
            }

            return {
                success: true,
                message: `同步完成，新增 ${newChapters.length} 個章節權限設定`,
                newChapters: newChapters
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得所有學員列表（含標籤）
     */
    async getAllUsers() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('id, username, email, avatar_url, tags, current_level, current_xp, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 更新學員的標籤
     * @param {string} userId - 學員 ID
     * @param {string[]} tags - 標籤陣列
     */
    async setUserTags(userId, tags) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .update({
                    tags: tags,
                    updated_at: new Date().toISOString()
                })
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
     * 批量更新多個學員的標籤（新增標籤到現有標籤）
     * @param {string[]} userIds - 學員 ID 陣列
     * @param {string[]} tagsToAdd - 要新增的標籤
     */
    async addTagsToUsers(userIds, tagsToAdd) {
        try {
            // 1. 取得這些用戶現有的 tags
            const { data: users, error: fetchError } = await this.supabase
                .from('users')
                .select('id, tags')
                .in('id', userIds);

            if (fetchError) throw fetchError;

            // 2. 為每個用戶合併標籤並更新
            const updates = users.map(user => {
                const currentTags = user.tags || [];
                const mergedTags = [...new Set([...currentTags, ...tagsToAdd])];
                return {
                    id: user.id,
                    tags: mergedTags,
                    updated_at: new Date().toISOString()
                };
            });

            // 3. 批量更新（使用 upsert）
            const { error: updateError } = await this.supabase
                .from('users')
                .upsert(updates, { onConflict: 'id' });

            if (updateError) throw updateError;

            return { success: true, updatedCount: updates.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 批量移除多個學員的特定標籤
     * @param {string[]} userIds - 學員 ID 陣列
     * @param {string[]} tagsToRemove - 要移除的標籤
     */
    async removeTagsFromUsers(userIds, tagsToRemove) {
        try {
            // 1. 取得這些用戶現有的 tags
            const { data: users, error: fetchError } = await this.supabase
                .from('users')
                .select('id, tags')
                .in('id', userIds);

            if (fetchError) throw fetchError;

            // 2. 為每個用戶移除標籤並更新
            const updates = users.map(user => {
                const currentTags = user.tags || [];
                const filteredTags = currentTags.filter(t => !tagsToRemove.includes(t));
                return {
                    id: user.id,
                    tags: filteredTags,
                    updated_at: new Date().toISOString()
                };
            });

            // 3. 批量更新
            const { error: updateError } = await this.supabase
                .from('users')
                .upsert(updates, { onConflict: 'id' });

            if (updateError) throw updateError;

            return { success: true, updatedCount: updates.length };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得學員可存取的章節清單（不含題目，僅用於顯示）
     * @param {string} userId - 學員 ID
     */
    async getUserAccessibleChapters(userId) {
        try {
            // 1. 取得學員的 tags
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('tags')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            const userTags = user.tags || [];

            // 2. 取得可存取的章節
            let query = this.supabase
                .from('chapter_access')
                .select('subject, chapter, is_public, allowed_tags');

            if (userTags.length > 0) {
                query = query.or(`is_public.eq.true,allowed_tags.ov.${JSON.stringify(userTags)}`);
            } else {
                query = query.eq('is_public', true);
            }

            const { data, error } = await query
                .order('subject', { ascending: true })
                .order('chapter', { ascending: true });

            if (error) throw error;

            return { success: true, data, userTags };
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
     * 取得答錯次數最多的前 N 張卡片 (改版：取得全站錯誤率最高的 Top N 魔王題)
     */
    async getAdminTopIncorrectCards(limit = 10) {
        try {
            // 使用 SECURITY DEFINER RPC 函式，繞過 RLS 取得全站數據
            const { data, error } = await this.supabase.rpc('get_admin_top_incorrect_cards', { top_n: limit });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得每日答題總次數
     */
    async getAdminDailyAnswers(days = 30) {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_daily_answers', { days_limit: days });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得每日活躍用戶數
     */
    async getAdminDailyActiveUsers(days = 30) {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_daily_active_users', { days_limit: days });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得學習趨勢 (週/月)
     */
    async getAdminLearningTrends(period = 'week') {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_learning_trends', { period_type: period });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得答題時段分佈
     */
    async getAdminAnswerTimeDistribution(days = 30) {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_answer_time_distribution', { days_limit: days });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 新增：取得學員熟練度 (等級) 分佈
     * 回傳長度 5 的陣列，對應：未熟悉、初學、進階、熟練、精通
     */
    async getAdminMasteryDistribution() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('current_level');

            if (error) throw error;

            // 初始化 5 個區間
            const distribution = [0, 0, 0, 0, 0];

            data.forEach(user => {
                const level = user.current_level || 1;
                if (level <= 2) {
                    distribution[0]++; // 未熟悉 (Lv. 1-2)
                } else if (level <= 5) {
                    distribution[1]++; // 初學 (Lv. 3-5)
                } else if (level <= 10) {
                    distribution[2]++; // 進階 (Lv. 6-10)
                } else if (level <= 19) {
                    distribution[3]++; // 熟練 (Lv. 11-19)
                } else {
                    distribution[4]++; // 精通 (Lv. 20+)
                }
            });

            return { success: true, data: distribution };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得整體正確率趨勢 (week/month)
     */
    async getAdminOverallAccuracyTrend(period = 'week') {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_overall_accuracy_trend', { period_type: period });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * [Admin] 章節正確率趨勢 (折線圖)
     * @param {string} chapter - 章節名稱
     * @param {string} period - 'week' (12週) 或 'month' (12個月)
     */
    async getAdminChapterAccuracyTrend(chapter, period = 'week') {
        try {
            const { data, error } = await this.supabase
                .rpc('get_admin_chapter_accuracy_trend', { p_chapter: chapter, period_type: period });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得首次 vs 複習正確率
     */
    async getAdminFirstVsReviewAccuracy() {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_first_vs_review_accuracy');
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * [Admin] 取得全體用戶的第1~5次作答正確率
     * @param {string|null} tag - Optional user tag to filter by
     * @returns {Promise<Object>} { success: true, data: {round, accuracy, total}[] }
     */
    async getAdminAttemptAccuracyByRound(tag = null) {
        try {
            const params = tag ? { p_tag: tag } : {};
            const { data, error } = await this.supabase.rpc('get_admin_attempt_accuracy_by_round', params);
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching admin attempt accuracy by round:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 取得平均達到精熟的複習次數
     */
    async getAdminAverageReviewsToMastery() {
        try {
            const { data, error } = await this.supabase.rpc('get_admin_average_reviews_to_mastery');
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得章節儀表板統計數據（按原始大分類/章節分組）
     * 用於弱點診斷儀表板，顯示每個章節的精通數/正確數/總題數
     * @param {string} userId - 用戶 ID
     * @returns {Promise<{success: boolean, data?: Array}>}
     */
    async getChapterDashboardStats(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 取得所有題目的 original_subject, original_chapter（用原始分類統計）
            const { data: questionsData, error: qError } = await this.supabase
                .from('questions')
                .select('id, subject, chapter, original_subject, original_chapter, subject_no, chapter_no');

            if (qError) throw qError;

            // 2. 取得該用戶所有作答進度
            const { data: progressData, error: pError } = await this.supabase
                .from('user_question_progress')
                .select('question_id, times_correct, times_incorrect, times_reviewed, is_correct')
                .eq('user_id', userId);

            if (pError) throw pError;

            // 建立 question_id -> progress 的查找表
            const progressMap = new Map();
            progressData?.forEach(p => progressMap.set(p.question_id, p));

            // 3. 按 original_subject + original_chapter 分組統計
            const chapterMap = new Map();

            questionsData?.forEach(q => {
                // 使用原始分類（fallback 到當前分類）
                const subject = q.original_subject || q.subject || '未分類';
                const chapter = q.original_chapter || q.chapter || '未分類';
                const key = `${subject}|||${chapter}`;

                if (!chapterMap.has(key)) {
                    chapterMap.set(key, {
                        subject,
                        chapter,
                        subject_no: q.subject_no || 999,
                        chapter_no: q.chapter_no || 999,
                        totalQuestions: 0,
                        answeredCount: 0,
                        correctCount: 0,    // 至少答對一次的題數
                        masteredCount: 0,    // times_correct >= 3
                        wrongCount: 0,       // 有答錯過的題數
                    });
                }

                const stats = chapterMap.get(key);
                stats.totalQuestions++;

                const progress = progressMap.get(q.id);
                if (progress) {
                    stats.answeredCount++;
                    if (progress.times_correct > 0) stats.correctCount++;
                    if (progress.times_correct >= 3) stats.masteredCount++;
                    if (progress.times_incorrect > 0) stats.wrongCount++;
                }
            });

            // 4. 轉為陣列並排序（按 subject_no, chapter_no）
            const result = [...chapterMap.values()]
                .map(ch => ({
                    ...ch,
                    correctRate: ch.totalQuestions > 0
                        ? Math.round((ch.correctCount / ch.totalQuestions) * 100)
                        : 0,
                    masteryRate: ch.totalQuestions > 0
                        ? Math.round((ch.masteredCount / ch.totalQuestions) * 100)
                        : 0,
                }))
                .sort((a, b) => {
                    if (a.subject_no !== b.subject_no) return a.subject_no - b.subject_no;
                    return a.chapter_no - b.chapter_no;
                });

            return { success: true, data: result };

        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得個人弱點統計儀表板數據
     * @param {string} userId - 用戶 ID
     * @returns 總錯題數、已作答題數、正確率、熟練度、趨勢數據等
     */
    async getWeaknessStats(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 取得該用戶所有的作答進度
            const { data: progressData, error: progressError } = await this.supabase
                .from('user_question_progress')
                .select('question_id, times_reviewed, times_correct, times_incorrect, is_correct')
                .eq('user_id', userId);

            if (progressError) throw progressError;

            // 2. 計算基礎統計
            const totalAnswered = progressData ? progressData.length : 0;
            let totalCorrect = 0;
            let totalIncorrect = 0;
            let totalReviewed = 0;
            let masteredCount = 0; // 熟練題數 (times_correct >= 3)

            progressData?.forEach(p => {
                totalCorrect += p.times_correct || 0;
                totalIncorrect += p.times_incorrect || 0;
                totalReviewed += p.times_reviewed || 0;
                // 熟練定義：該題答對次數 >= 3
                if (p.times_correct >= 3) {
                    masteredCount++;
                }
            });

            // 總錯題數（有答錯過的題目數量）
            const wrongQuestionCount = progressData?.filter(p => p.times_incorrect > 0).length || 0;

            // 正確題數（至少答對過一次的題目）
            const correctQuestionCount = progressData?.filter(p => p.times_correct > 0).length || 0;

            // 整體正確率 (以作答次數計算)
            const overallAccuracy = totalReviewed > 0
                ? Math.round((totalCorrect / totalReviewed) * 100)
                : 0;

            // 已答題之熟練度 (已熟練題數 / 已作答題數)
            const masteryRate = totalAnswered > 0
                ? Math.round((masteredCount / totalAnswered) * 100)
                : 0;

            // 取得題庫總題數（用於預估計算）
            const { count: totalQuestionsInBank, error: countError } = await this.supabase
                .from('questions')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            // 待熟練題數
            const remainingQuestions = (totalQuestionsInBank || 0) - masteredCount;

            // 3. 取得最近 30 天的答題紀錄（用於趨勢分析）
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

            const { data: recentRecords, error: recordsError } = await this.supabase
                .from('answer_records')
                .select('is_correct, created_at')
                .eq('user_id', userId)
                .gte('created_at', thirtyDaysAgoStr)
                .order('created_at', { ascending: true });

            if (recordsError) throw recordsError;

            // 4. 計算每日統計（錯題數、正確率）
            const dailyStats = {};

            // 將日期轉為本地日期字串（YYYY-MM-DD）
            // 注意：Supabase 回傳格式為 "2026-02-28 12:21:55.227+08"（空格分隔），
            // 部分瀏覽器無法正確解析，需先轉為 ISO 格式（T 分隔）
            function toLocalDateStr(date) {
                if (!date) return '';
                // 將 Supabase 的空格格式轉為標準 ISO 格式
                const normalized = typeof date === 'string' ? date.replace(' ', 'T') : date;
                const d = new Date(normalized);
                if (isNaN(d.getTime())) return '';
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            // 初始化最近 30 天的日期（使用本地時間）
            for (let i = 0; i < 30; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (29 - i));
                const dateStr = toLocalDateStr(date);
                dailyStats[dateStr] = { correct: 0, incorrect: 0, total: 0 };
            }

            // 填入實際數據（將 UTC 時間轉為本地日期）
            recentRecords?.forEach(record => {
                const dateStr = toLocalDateStr(record.created_at);
                if (dailyStats[dateStr]) {
                    dailyStats[dateStr].total++;
                    if (record.is_correct) {
                        dailyStats[dateStr].correct++;
                    } else {
                        dailyStats[dateStr].incorrect++;
                    }
                }
            });

            // 轉換為陣列格式，並確保按日期排序
            const trendData = Object.entries(dailyStats)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, stats]) => ({
                    date,
                    incorrect: stats.incorrect,
                    correct: stats.correct,
                    total: stats.total,
                    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
                }));

            // 5. 今日正確率 (精確定位「今天」)
            const todayStr = toLocalDateStr(new Date());
            const todayData = dailyStats[todayStr];

            const todayAccuracy = todayData && todayData.total > 0
                ? Math.round((todayData.correct / todayData.total) * 100)
                : null; // null 代表今日尚未作答
            const todayTotal = todayData ? todayData.total : 0;
            const todayCorrect = todayData ? todayData.correct : 0;

            // 6. 多時段進步指標（1天、3天、7天）
            function calcImprovement(days) {
                const recent = trendData.slice(-days);
                const previous = trendData.slice(-days * 2, -days);
                const recentTotal = recent.reduce((s, d) => s + d.total, 0);
                const recentCorrect = recent.reduce((s, d) => s + d.correct, 0);
                const prevTotal = previous.reduce((s, d) => s + d.total, 0);
                const prevCorrect = previous.reduce((s, d) => s + d.correct, 0);
                const recentAcc = recentTotal > 0 ? (recentCorrect / recentTotal) * 100 : 0;
                const prevAcc = prevTotal > 0 ? (prevCorrect / prevTotal) * 100 : 0;

                // 如果最近有作答，但前一週期沒數據，我們將其視為進步
                // 否則如果兩邊都沒數據，才顯示「資料不足」
                const hasData = recentTotal > 0;
                return {
                    change: hasData ? Math.round((recentAcc - prevAcc) * 10) / 10 : null,
                    recentTotal,
                    hasData: hasData
                };
            }

            const improvement1d = calcImprovement(1);
            const improvement3d = calcImprovement(3);
            const improvement7d = calcImprovement(7);

            // 相容舊欄位
            const last7Days = trendData.slice(-7);
            const last7Incorrect = last7Days.reduce((sum, d) => sum + d.incorrect, 0);
            const last7Total = last7Days.reduce((sum, d) => sum + d.total, 0);
            const last7Correct = last7Days.reduce((sum, d) => sum + d.correct, 0);
            const last7Accuracy = last7Total > 0 ? (last7Correct / last7Total) * 100 : 0;

            return {
                success: true,
                data: {
                    // 基礎統計
                    totalAnswered,          // 已作答題數
                    wrongQuestionCount,     // 總錯題數
                    correctQuestionCount,   // 正確題數（至少答對過一次）
                    overallAccuracy,        // 整體正確率 %
                    masteryRate,            // 已答題之熟練度 %
                    masteredCount,          // 已熟練題數

                    // 今日統計
                    todayAccuracy,          // 今日正確率 % (null=尚未作答)
                    todayTotal,             // 今日作答次數
                    todayCorrect,           // 今日答對次數

                    // 預估計算用
                    totalQuestionsInBank: totalQuestionsInBank || 0,  // 題庫總題數
                    remainingQuestions,     // 待熟練題數

                    // 趨勢數據
                    trendData,              // 30 天每日數據

                    // 7 天統計
                    last7Days: {
                        incorrect: last7Incorrect,
                        total: last7Total,
                        accuracy: Math.round(last7Accuracy)
                    },

                    // 多時段進步指標
                    improvementByPeriod: {
                        '1': improvement1d,
                        '3': improvement3d,
                        '7': improvement7d
                    },

                    // 相容舊欄位
                    improvement: {
                        accuracyChange: improvement7d.change || 0,
                        incorrectChange: 0,
                        isImproving: (improvement7d.change || 0) > 0
                    }
                }
            };

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

    // ==================== 遊戲化驅動力系統 API ====================

    /**
     * T002 - 取得今日新增熟練題數
     * @param {string} userId - 用戶 ID
     * @returns {Promise<{success: boolean, data: {todayMastered, weekMastered, consecutiveDays, yesterdayMastered}}>}
     */
    /**
     * 取得今日答題數（作答次數）
     * @param {string} userId - 用戶 ID
     * @returns {Promise<{success: boolean, data?: {todayAnswered: number}, error?: object}>}
     */
    async getTodayAnsweredCount(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 定義今日時間範圍
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // 查詢今日答題記錄數
            const { count, error } = await this.supabase
                .from('answer_records')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', todayStart.toISOString());

            if (error) throw error;

            return {
                success: true,
                data: {
                    todayAnswered: count || 0
                }
            };

        } catch (error) {
            console.error('Error getting today answered count:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    async getTodayMasteredCount(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 定義時間範圍
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);
            const weekAgoStart = new Date(todayStart);
            weekAgoStart.setDate(weekAgoStart.getDate() - 7);

            // 1. 查詢所有熟練題目 (times_correct >= 3)
            const { data: allMastered, error: allError } = await this.supabase
                .from('user_question_progress')
                .select('question_id, times_correct, updated_at')
                .eq('user_id', userId)
                .gte('times_correct', 3);

            if (allError) throw allError;

            if (!allMastered || allMastered.length === 0) {
                return {
                    success: true,
                    data: {
                        todayMastered: 0,
                        weekMastered: 0,
                        consecutiveDays: 0,
                        yesterdayMastered: 0
                    }
                };
            }

            // 2. 一次性查詢所有答對記錄（優化效能）
            const masteredQuestionIds = allMastered.map(q => q.question_id);
            const { data: allCorrectRecords, error: recordsError } = await this.supabase
                .from('answer_records')
                .select('question_id, created_at')
                .eq('user_id', userId)
                .in('question_id', masteredQuestionIds)
                .eq('is_correct', true)
                .order('created_at', { ascending: true });

            if (recordsError) throw recordsError;

            // 3. 按題目分組答對記錄
            const recordsByQuestion = {};
            allCorrectRecords?.forEach(record => {
                if (!recordsByQuestion[record.question_id]) {
                    recordsByQuestion[record.question_id] = [];
                }
                recordsByQuestion[record.question_id].push(new Date(record.created_at));
            });

            // 4. 計算每個題目達到熟練（第 3 次答對）的時間
            const masteryTimes = [];
            for (const questionId of masteredQuestionIds) {
                const correctTimes = recordsByQuestion[questionId];
                if (correctTimes && correctTimes.length >= 3) {
                    masteryTimes.push({
                        questionId: questionId,
                        masteredAt: correctTimes[2] // 第 3 次答對的時間
                    });
                }
            }

            // 5. 統計今日、昨日、本週新增熟練數
            let todayMastered = 0;
            let yesterdayMastered = 0;
            let weekMastered = 0;

            masteryTimes.forEach(({ masteredAt }) => {
                if (masteredAt >= todayStart) {
                    todayMastered++;
                    weekMastered++;
                } else if (masteredAt >= yesterdayStart) {
                    yesterdayMastered++;
                    weekMastered++;
                } else if (masteredAt >= weekAgoStart) {
                    weekMastered++;
                }
            });

            // 6. 計算連續天數（從今天往回檢查）
            // 將達到熟練的日期按天分組
            const masteryByDate = {};
            masteryTimes.forEach(({ masteredAt }) => {
                const dateKey = masteredAt.toISOString().split('T')[0]; // YYYY-MM-DD
                if (!masteryByDate[dateKey]) {
                    masteryByDate[dateKey] = 0;
                }
                masteryByDate[dateKey]++;
            });

            let consecutiveDays = 0;
            let checkDate = new Date(todayStart);

            for (let i = 0; i < 365; i++) { // 最多檢查 365 天
                const dateKey = checkDate.toISOString().split('T')[0];

                if (masteryByDate[dateKey] && masteryByDate[dateKey] > 0) {
                    consecutiveDays++;
                    checkDate.setDate(checkDate.getDate() - 1); // 往前一天
                } else {
                    break; // 中斷連續
                }
            }

            return {
                success: true,
                data: {
                    todayMastered: todayMastered,
                    weekMastered: weekMastered,
                    consecutiveDays: consecutiveDays,
                    yesterdayMastered: yesterdayMastered
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T003 - 取得本次 vs 歷史正確率
     * @param {string} userId - 用戶 ID
     * @param {number} recentCount - 最近幾題（預設 10）
     * @returns {Promise<{success: boolean, data: {recentAccuracy, historicalAccuracy, improvement, recentCount, historicalCount, isBestPerformance}}>}
     */
    async getRecentVsHistoricalAccuracy(userId, recentCount = 10) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 查詢所有答題記錄（按時間排序，最新的在前）
            const { data: allRecords, error: allError } = await this.supabase
                .from('answer_records')
                .select('is_correct, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (allError) throw allError;

            // 2. 處理無記錄或記錄不足的情況
            if (!allRecords || allRecords.length === 0) {
                return {
                    success: true,
                    data: {
                        recentAccuracy: 0,
                        historicalAccuracy: 0,
                        improvement: 0,
                        recentCount: 0,
                        historicalCount: 0,
                        isBestPerformance: false
                    }
                };
            }

            const totalCount = allRecords.length;

            // 3. 取得最近 N 題
            const actualRecentCount = Math.min(recentCount, totalCount);
            const recentRecords = allRecords.slice(0, actualRecentCount);

            // 4. 計算最近 N 題正確率
            const recentCorrect = recentRecords.filter(r => r.is_correct).length;
            const recentAccuracy = actualRecentCount > 0
                ? Math.round((recentCorrect / actualRecentCount) * 100)
                : 0;

            // 5. 計算歷史平均正確率
            const historicalCorrect = allRecords.filter(r => r.is_correct).length;
            const historicalAccuracy = totalCount > 0
                ? Math.round((historicalCorrect / totalCount) * 100)
                : 0;

            // 6. 計算進步幅度
            const improvement = recentAccuracy - historicalAccuracy;

            // 7. 判斷是否為最佳表現
            // 策略：檢查是否有任何連續 N 題的正確率超過當前最近 N 題
            let isBestPerformance = true;

            if (totalCount >= recentCount) {
                // 滑動窗口檢查所有連續 N 題的正確率
                for (let i = 0; i <= totalCount - recentCount; i++) {
                    const windowRecords = allRecords.slice(i, i + recentCount);
                    const windowCorrect = windowRecords.filter(r => r.is_correct).length;
                    const windowAccuracy = Math.round((windowCorrect / recentCount) * 100);

                    // 如果有任何窗口的正確率高於當前最近 N 題（且不是同一個窗口），則不是最佳表現
                    if (i !== 0 && windowAccuracy > recentAccuracy) {
                        isBestPerformance = false;
                        break;
                    }
                }
            }

            return {
                success: true,
                data: {
                    recentAccuracy: recentAccuracy,
                    historicalAccuracy: historicalAccuracy,
                    improvement: improvement,
                    recentCount: actualRecentCount,
                    historicalCount: totalCount,
                    isBestPerformance: isBestPerformance
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * 取得每輪刷題正確率（第1次~第6次）
     * 將每題的答題紀錄按時間排序，計算第N次作答的平均正確率
     * @param {string} userId - 用戶 ID
     * @returns {Array} [{ round: 1, accuracy: 45.2, total: 120 }, ...]
     */
    async getAttemptAccuracyByRound(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            const { data: records, error } = await this.supabase
                .from('answer_records')
                .select('question_id, is_correct, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!records || records.length === 0) {
                return { success: true, data: [] };
            }

            // 按 question_id 分組
            const byQuestion = {};
            records.forEach(r => {
                if (!byQuestion[r.question_id]) {
                    byQuestion[r.question_id] = [];
                }
                byQuestion[r.question_id].push(r.is_correct);
            });

            // 統計第1~6次的正確數與總數
            const maxRound = 6;
            const roundStats = Array.from({ length: maxRound }, () => ({ correct: 0, total: 0 }));

            Object.values(byQuestion).forEach(attempts => {
                const limit = Math.min(attempts.length, maxRound);
                for (let i = 0; i < limit; i++) {
                    roundStats[i].total++;
                    if (attempts[i]) roundStats[i].correct++;
                }
            });

            const result = roundStats
                .map((s, i) => ({
                    round: i + 1,
                    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : null,
                    total: s.total
                }))
                .filter(s => s.total > 0);

            return { success: true, data: result };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T004 - 取得錯誤選項分析
     * 分析學員最常選的錯誤選項，找出思維盲點
     * @param {string} userId - 用戶 ID
     * @param {number} limit - 返回前 N 個錯最多的題目（預設 5）
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    async getWrongAnswerPatterns(userId, limit = 5) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 查詢所有錯誤答題記錄（含用戶答案）
            const { data: wrongRecords, error: wrongError } = await this.supabase
                .from('answer_records')
                .select('question_id, user_answer, created_at')
                .eq('user_id', userId)
                .eq('is_correct', false)
                .order('created_at', { ascending: false });

            if (wrongError) throw wrongError;

            // 2. 處理無錯誤記錄的情況
            if (!wrongRecords || wrongRecords.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            // 3. 按 question_id 分組統計答錯次數與錯誤答案分布
            const questionStats = {};
            wrongRecords.forEach(record => {
                const qid = record.question_id;

                if (!questionStats[qid]) {
                    questionStats[qid] = {
                        questionId: qid,
                        timesWrong: 0,
                        wrongAnswerCounts: {}
                    };
                }

                questionStats[qid].timesWrong++;

                // 統計各錯誤選項的次數
                const userAnswer = record.user_answer;
                let answerKey = JSON.stringify(userAnswer); // 將答案轉為字串作為 key

                if (!questionStats[qid].wrongAnswerCounts[answerKey]) {
                    questionStats[qid].wrongAnswerCounts[answerKey] = {
                        count: 0,
                        answer: userAnswer
                    };
                }
                questionStats[qid].wrongAnswerCounts[answerKey].count++;
            });

            // 4. 過濾掉已精通的題目（答對 3 次以上 = 金色皮膚卡）
            const allQuestionIds = Object.keys(questionStats);
            let masteredQuestionIds = new Set();

            if (allQuestionIds.length > 0) {
                const { data: masteredProgress, error: masteredError } = await this.supabase
                    .from('user_question_progress')
                    .select('question_id')
                    .eq('user_id', userId)
                    .in('question_id', allQuestionIds)
                    .gte('times_correct', 3);

                if (!masteredError && masteredProgress) {
                    masteredQuestionIds = new Set(masteredProgress.map(p => p.question_id));
                }
            }

            // 5. 排序：答錯次數最多的題目（排除已精通）
            const sortedQuestions = Object.values(questionStats)
                .filter(q => !masteredQuestionIds.has(q.questionId))
                .sort((a, b) => b.timesWrong - a.timesWrong)
                .slice(0, limit);

            // 6. 查詢這些題目的詳細資訊
            const questionIds = sortedQuestions.map(q => q.questionId);

            if (questionIds.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            const { data: questions, error: questionsError } = await this.supabase
                .from('questions')
                .select('id, question, subject, chapter, option_a, option_b, option_c, option_d, correct_answer, question_type')
                .in('id', questionIds);

            if (questionsError) throw questionsError;

            // 7. 合併統計數據與題目詳情
            const result = sortedQuestions.map(stat => {
                const questionData = questions.find(q => q.id === stat.questionId);

                if (!questionData) return null;

                // 找出最常選的錯誤答案
                const wrongAnswersArray = Object.values(stat.wrongAnswerCounts)
                    .sort((a, b) => b.count - a.count);

                const mostCommonWrongAnswer = wrongAnswersArray.length > 0
                    ? wrongAnswersArray[0].answer
                    : null;

                // 轉換 wrongAnswerCounts 為更易讀的格式
                const wrongAnswerDistribution = {};
                wrongAnswersArray.forEach(item => {
                    const answerStr = Array.isArray(item.answer)
                        ? item.answer.join(', ')
                        : String(item.answer);
                    wrongAnswerDistribution[answerStr] = item.count;
                });

                return {
                    questionId: stat.questionId,
                    question: questionData.question,
                    subject: questionData.subject,
                    chapter: questionData.chapter,
                    timesWrong: stat.timesWrong,
                    mostCommonWrongAnswer: mostCommonWrongAnswer,
                    wrongAnswerCounts: wrongAnswerDistribution,
                    correctAnswer: questionData.correct_answer,
                    option_a: questionData.option_a,
                    option_b: questionData.option_b,
                    option_c: questionData.option_c,
                    option_d: questionData.option_d,
                    questionType: questionData.question_type
                };
            }).filter(item => item !== null);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T005 - 實作答題時段效率分析 API
     * 分析學員在不同時段（0-23 時）的答題效率
     * @param {string} userId - 用戶 ID
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    async getHourlyEfficiency(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 1. 查詢所有答題記錄（含時間戳記）
            const { data: records, error: recordsError } = await this.supabase
                .from('answer_records')
                .select('is_correct, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (recordsError) throw recordsError;

            // 2. 處理無答題記錄的情況
            if (!records || records.length === 0) {
                return {
                    success: true,
                    data: {
                        hourlyStats: [],
                        bestHour: null,
                        worstHour: null,
                        bestAccuracy: 0,
                        worstAccuracy: 0,
                        recommendation: '目前尚無答題記錄，開始答題後即可查看時段效率分析'
                    }
                };
            }

            // 3. 按小時分組統計（0-23 時）
            const hourlyData = {};
            for (let h = 0; h < 24; h++) {
                hourlyData[h] = { hour: h, correct: 0, total: 0, accuracy: 0 };
            }

            records.forEach(record => {
                // 從 ISO 時間字串提取小時（使用 UTC+8 台灣時區）
                const date = new Date(record.created_at);
                const hour = date.getHours(); // 本地時區

                hourlyData[hour].total++;
                if (record.is_correct) {
                    hourlyData[hour].correct++;
                }
            });

            // 4. 計算各時段正確率並過濾出有數據的時段
            const hourlyStats = Object.values(hourlyData)
                .filter(stat => stat.total > 0)
                .map(stat => ({
                    hour: stat.hour,
                    correct: stat.correct,
                    total: stat.total,
                    accuracy: Math.round((stat.correct / stat.total) * 100)
                }))
                .sort((a, b) => a.hour - b.hour);

            // 5. 找出最佳與最差時段
            let bestHour = null;
            let worstHour = null;
            let bestAccuracy = 0;
            let worstAccuracy = 100;

            // 只考慮至少答過 5 題的時段（避免單一題目的偏差）
            const significantHours = hourlyStats.filter(stat => stat.total >= 5);

            if (significantHours.length > 0) {
                // 找出最高正確率
                const best = significantHours.reduce((max, stat) =>
                    stat.accuracy > max.accuracy ? stat : max
                );
                bestHour = best.hour;
                bestAccuracy = best.accuracy;

                // 找出最低正確率
                const worst = significantHours.reduce((min, stat) =>
                    stat.accuracy < min.accuracy ? stat : min
                );
                worstHour = worst.hour;
                worstAccuracy = worst.accuracy;
            }

            // 6. 生成建議文字
            let recommendation = '';
            if (bestHour !== null) {
                const timeRange = `${bestHour}:00-${(bestHour + 1) % 24}:00`;
                const avgAccuracy = Math.round(
                    hourlyStats.reduce((sum, s) => sum + s.accuracy, 0) / hourlyStats.length
                );

                if (bestAccuracy > avgAccuracy + 10) {
                    recommendation = `建議在 ${timeRange} 答題，該時段正確率達 ${bestAccuracy}%，表現最佳`;
                } else {
                    recommendation = `各時段表現穩定，平均正確率 ${avgAccuracy}%`;
                }

                if (worstHour !== null && worstAccuracy < avgAccuracy - 15) {
                    const worstTimeRange = `${worstHour}:00-${(worstHour + 1) % 24}:00`;
                    recommendation += `；建議避免在 ${worstTimeRange} 答題（正確率僅 ${worstAccuracy}%）`;
                }
            } else {
                recommendation = '建議每個時段至少答 5 題以上，才能提供準確的時段效率分析';
            }

            return {
                success: true,
                data: {
                    hourlyStats: hourlyStats,
                    bestHour: bestHour,
                    worstHour: worstHour,
                    bestAccuracy: bestAccuracy,
                    worstAccuracy: worstAccuracy,
                    recommendation: recommendation
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T006 - 取得錯題二刷正確率
     * 計算「上週錯題在本週重做的正確率」，用於驗證學習成效
     * @param {string} userId - 用戶 ID
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    async getRetryAccuracy(userId) {
        try {
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            // 計算時間區間
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今日 00:00
            const lastWeekStart = new Date(todayStart);
            lastWeekStart.setDate(lastWeekStart.getDate() - 7); // 7 天前 00:00

            // 1. 查詢上週（7 天前 ~ 今日開始）答錯的題目
            const { data: lastWeekWrong, error: lastWeekError } = await this.supabase
                .from('answer_records')
                .select('question_id')
                .eq('user_id', userId)
                .eq('is_correct', false)
                .gte('created_at', lastWeekStart.toISOString())
                .lt('created_at', todayStart.toISOString());

            if (lastWeekError) throw lastWeekError;

            // 2. 處理無上週錯題的情況
            if (!lastWeekWrong || lastWeekWrong.length === 0) {
                return {
                    success: true,
                    data: {
                        lastWeekWrongQuestions: 0,
                        retriedThisWeek: 0,
                        retriedCorrect: 0,
                        retryAccuracy: 0,
                        stillWrong: 0,
                        notRetried: 0,
                        wrongQuestionIds: [],
                        message: '上週無錯題記錄，太棒了！'
                    }
                };
            }

            // 3. 取得上週錯題的不重複 question_id 列表
            const uniqueWrongQuestionIds = [...new Set(lastWeekWrong.map(r => r.question_id))];

            // 4. 查詢這些題目在本週（今日開始 ~ 現在）的所有答題記錄
            const { data: thisWeekRetry, error: thisWeekError } = await this.supabase
                .from('answer_records')
                .select('question_id, is_correct, created_at')
                .eq('user_id', userId)
                .in('question_id', uniqueWrongQuestionIds)
                .gte('created_at', todayStart.toISOString())
                .order('created_at', { ascending: false });

            if (thisWeekError) throw thisWeekError;

            // 5. 處理無本週重做記錄的情況
            if (!thisWeekRetry || thisWeekRetry.length === 0) {
                return {
                    success: true,
                    data: {
                        lastWeekWrongQuestions: uniqueWrongQuestionIds.length,
                        retriedThisWeek: 0,
                        retriedCorrect: 0,
                        retryAccuracy: 0,
                        stillWrong: 0,
                        notRetried: uniqueWrongQuestionIds.length,
                        wrongQuestionIds: uniqueWrongQuestionIds,
                        message: `上週有 ${uniqueWrongQuestionIds.length} 題錯題尚未重做，建議複習！`
                    }
                };
            }

            // 6. 分析每個題目的最新重做結果（取每題最近一次答題）
            const questionRetryMap = {}; // { questionId: { isCorrect: boolean, retried: boolean } }

            uniqueWrongQuestionIds.forEach(qid => {
                questionRetryMap[qid] = { retried: false, isCorrect: false };
            });

            // 為每個題目找到本週最新的答題記錄
            thisWeekRetry.forEach(record => {
                const qid = record.question_id;
                if (!questionRetryMap[qid].retried) {
                    // 第一次遇到此題目的記錄（因為已按時間倒序，所以是最新的）
                    questionRetryMap[qid] = {
                        retried: true,
                        isCorrect: record.is_correct
                    };
                }
            });

            // 7. 統計結果
            let retriedThisWeek = 0;
            let retriedCorrect = 0;
            const stillWrongQuestionIds = [];

            Object.entries(questionRetryMap).forEach(([qid, result]) => {
                if (result.retried) {
                    retriedThisWeek++;
                    if (result.isCorrect) {
                        retriedCorrect++;
                    } else {
                        stillWrongQuestionIds.push(qid);
                    }
                }
            });

            const notRetried = uniqueWrongQuestionIds.length - retriedThisWeek;
            const retryAccuracy = retriedThisWeek > 0
                ? Math.round((retriedCorrect / retriedThisWeek) * 100)
                : 0;

            // 8. 生成訊息
            let message = '';
            if (retriedThisWeek === 0) {
                message = `上週有 ${uniqueWrongQuestionIds.length} 題錯題尚未重做，建議複習！`;
            } else if (retryAccuracy >= 80) {
                message = `太棒了！二刷正確率達 ${retryAccuracy}%，學習成效顯著！`;
            } else if (retryAccuracy >= 60) {
                message = `不錯！二刷正確率 ${retryAccuracy}%，繼續保持！`;
            } else {
                message = `二刷正確率 ${retryAccuracy}%，建議加強複習這些題目`;
            }

            return {
                success: true,
                data: {
                    lastWeekWrongQuestions: uniqueWrongQuestionIds.length,
                    retriedThisWeek: retriedThisWeek,
                    retriedCorrect: retriedCorrect,
                    retryAccuracy: retryAccuracy,
                    stillWrong: stillWrongQuestionIds.length,
                    notRetried: notRetried,
                    wrongQuestionIds: stillWrongQuestionIds,
                    message: message
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T007 - 徽章系統：取得所有徽章定義
     * 定義所有可解鎖的徽章條件（前端配置）
     * @returns {Array<Object>} 徽章定義列表
     */
    _getBadgeDefinitions() {
        return [
            // 數量成就
            {
                badgeKey: 'first_correct',
                badgeName: '首題達陣',
                badgeDescription: '答對第 1 題',
                badgeIcon: 'flag',
                category: '數量成就',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('is_correct', true)
                        .limit(1);
                    return data && data.length >= 1;
                }
            },
            {
                badgeKey: 'ten_correct',
                badgeName: '十全十美',
                badgeDescription: '累積答對 10 題',
                badgeIcon: 'stars',
                category: '數量成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('answer_records')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('is_correct', true);
                    return count >= 10;
                }
            },
            {
                badgeKey: 'hundred_correct',
                badgeName: '百題斬',
                badgeDescription: '累積答對 100 題',
                badgeIcon: 'emoji_events',
                category: '數量成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('answer_records')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('is_correct', true);
                    return count >= 100;
                }
            },
            {
                badgeKey: 'fivehundred_correct',
                badgeName: '五百壯士',
                badgeDescription: '累積答對 500 題',
                badgeIcon: 'military_tech',
                category: '數量成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('answer_records')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('is_correct', true);
                    return count >= 500;
                }
            },
            // 連勝成就
            {
                badgeKey: 'streak_3',
                badgeName: '連勝起步',
                badgeDescription: '連續答對 3 題',
                badgeIcon: 'local_fire_department',
                category: '連勝成就',
                condition: async (userId) => {
                    // 取得最近的答題記錄
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('is_correct')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(100);

                    if (!data) return false;

                    // 計算最長連勝
                    let maxStreak = 0;
                    let currentStreak = 0;
                    for (const record of data) {
                        if (record.is_correct) {
                            currentStreak++;
                            maxStreak = Math.max(maxStreak, currentStreak);
                        } else {
                            currentStreak = 0;
                        }
                    }
                    return maxStreak >= 3;
                }
            },
            {
                badgeKey: 'streak_10',
                badgeName: '連勝達人',
                badgeDescription: '連續答對 10 題',
                badgeIcon: 'whatshot',
                category: '連勝成就',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('is_correct')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(100);

                    if (!data) return false;

                    let maxStreak = 0;
                    let currentStreak = 0;
                    for (const record of data) {
                        if (record.is_correct) {
                            currentStreak++;
                            maxStreak = Math.max(maxStreak, currentStreak);
                        } else {
                            currentStreak = 0;
                        }
                    }
                    return maxStreak >= 10;
                }
            },
            {
                badgeKey: 'streak_20',
                badgeName: '無敵連勝',
                badgeDescription: '連續答對 20 題',
                badgeIcon: 'bolt',
                category: '連勝成就',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('is_correct')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(100);

                    if (!data) return false;

                    let maxStreak = 0;
                    let currentStreak = 0;
                    for (const record of data) {
                        if (record.is_correct) {
                            currentStreak++;
                            maxStreak = Math.max(maxStreak, currentStreak);
                        } else {
                            currentStreak = 0;
                        }
                    }
                    return maxStreak >= 20;
                }
            },
            // 連續天數成就
            {
                badgeKey: 'daily_streak_3',
                badgeName: '三日修行',
                badgeDescription: '連續 3 天答題',
                badgeIcon: 'calendar_today',
                category: '連續天數',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .rpc('get_user_daily_streak', { p_user_id: userId });
                    return data && data >= 3;
                }
            },
            {
                badgeKey: 'daily_streak_7',
                badgeName: '一週達人',
                badgeDescription: '連續 7 天答題',
                badgeIcon: 'event_available',
                category: '連續天數',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .rpc('get_user_daily_streak', { p_user_id: userId });
                    return data && data >= 7;
                }
            },
            {
                badgeKey: 'daily_streak_30',
                badgeName: '不屈之志',
                badgeDescription: '連續 30 天答題',
                badgeIcon: 'verified',
                category: '連續天數',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .rpc('get_user_daily_streak', { p_user_id: userId });
                    return data && data >= 30;
                }
            },
            // 熟練度成就
            {
                badgeKey: 'mastery_10',
                badgeName: '熟能生巧',
                badgeDescription: '累積 10 題達到熟練',
                badgeIcon: 'school',
                category: '熟練度成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('user_question_progress')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('times_correct', 3);
                    return count >= 10;
                }
            },
            {
                badgeKey: 'mastery_50',
                badgeName: '爐火純青',
                badgeDescription: '累積 50 題達到熟練',
                badgeIcon: 'workspace_premium',
                category: '熟練度成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('user_question_progress')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('times_correct', 3);
                    return count >= 50;
                }
            },
            {
                badgeKey: 'mastery_100',
                badgeName: '登峰造極',
                badgeDescription: '累積 100 題達到熟練',
                badgeIcon: 'emoji_events',
                category: '熟練度成就',
                condition: async (userId) => {
                    const { count } = await this.supabase
                        .from('user_question_progress')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('times_correct', 3);
                    return count >= 100;
                }
            },
            // 特殊成就
            {
                badgeKey: 'perfect_day',
                badgeName: '完美一天',
                badgeDescription: '單日答題正確率達 100%（至少 10 題）',
                badgeIcon: 'star',
                category: '特殊成就',
                condition: async (userId) => {
                    // 檢查是否有任何一天達到 100% 正確率（至少 10 題）
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('is_correct, created_at')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1000); // 查詢最近的記錄

                    if (!data || data.length === 0) return false;

                    // 按日期分組統計
                    const dailyStats = {};
                    data.forEach(record => {
                        const date = new Date(record.created_at).toISOString().split('T')[0];
                        if (!dailyStats[date]) {
                            dailyStats[date] = { correct: 0, total: 0 };
                        }
                        dailyStats[date].total++;
                        if (record.is_correct) dailyStats[date].correct++;
                    });

                    // 檢查是否有完美的一天
                    return Object.values(dailyStats).some(stat =>
                        stat.total >= 10 && stat.correct === stat.total
                    );
                }
            },
            {
                badgeKey: 'fast_learner',
                badgeName: '快速學習者',
                badgeDescription: '平均答題速度 < 15 秒（至少 50 題）',
                badgeIcon: 'speed',
                category: '特殊成就',
                condition: async (userId) => {
                    const { data } = await this.supabase
                        .from('answer_records')
                        .select('response_time_ms')
                        .eq('user_id', userId)
                        .not('response_time_ms', 'is', null);

                    if (!data || data.length < 50) return false;

                    const avgTime = data.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / data.length;
                    return avgTime < 15000; // 15 秒
                }
            }
        ];
    }

    /**
     * T007 - 徽章系統：檢查並解鎖徽章
     * 檢查用戶是否達成新徽章條件，並自動解鎖
     * @param {string} userId - 使用者 ID
     * @returns {Promise<{success: boolean, data: {newlyUnlocked: Array}}>}
     */
    async checkAndUnlockBadges(userId) {
        try {
            // 1. 取得所有徽章定義
            const allBadges = this._getBadgeDefinitions();

            // 2. 取得用戶已解鎖的徽章
            const { data: unlockedBadges, error: fetchError } = await this.supabase
                .from('user_badges')
                .select('badge_key')
                .eq('user_id', userId);

            if (fetchError) throw fetchError;

            const unlockedKeys = new Set((unlockedBadges || []).map(b => b.badge_key));

            // 3. 檢查每個未解鎖的徽章
            const newlyUnlocked = [];

            for (const badge of allBadges) {
                // 跳過已解鎖的徽章
                if (unlockedKeys.has(badge.badgeKey)) continue;

                try {
                    // 檢查解鎖條件
                    const isUnlocked = await badge.condition(userId);

                    if (isUnlocked) {
                        // 解鎖徽章：寫入資料庫
                        const { data: newBadge, error: insertError } = await this.supabase
                            .from('user_badges')
                            .insert({
                                user_id: userId,
                                badge_key: badge.badgeKey,
                                badge_name: badge.badgeName,
                                badge_description: badge.badgeDescription,
                                badge_icon: badge.badgeIcon
                            })
                            .select()
                            .single();

                        if (insertError) {
                            // 如果是重複鍵錯誤（已存在），忽略
                            if (insertError.code === '23505') continue;
                            throw insertError;
                        }

                        newlyUnlocked.push({
                            badgeKey: badge.badgeKey,
                            badgeName: badge.badgeName,
                            badgeDescription: badge.badgeDescription,
                            badgeIcon: badge.badgeIcon,
                            unlockedAt: newBadge.unlocked_at
                        });
                    }
                } catch (conditionError) {
                    console.error(`檢查徽章 ${badge.badgeKey} 條件時出錯:`, conditionError);
                    // 繼續檢查其他徽章
                }
            }

            return {
                success: true,
                data: {
                    newlyUnlocked: newlyUnlocked,
                    totalChecked: allBadges.length,
                    totalUnlocked: unlockedKeys.size + newlyUnlocked.length
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T007 - 徽章系統：取得用戶已解鎖的徽章
     * @param {string} userId - 使用者 ID
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    async getUserBadges(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_badges')
                .select('*')
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false });

            if (error) throw error;

            return {
                success: true,
                data: data || [],
                total: data ? data.length : 0
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T007 - 徽章系統：取得即將解鎖的徽章（進度追蹤）
     * @param {string} userId - 使用者 ID
     * @param {number} minProgress - 最小進度百分比（預設 50）
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    async getAvailableBadges(userId, minProgress = 50) {
        try {
            // 1. 取得所有徽章定義
            const allBadges = this._getBadgeDefinitions();

            // 2. 取得用戶已解鎖的徽章
            const { data: unlockedBadges } = await this.supabase
                .from('user_badges')
                .select('badge_key')
                .eq('user_id', userId);

            const unlockedKeys = new Set((unlockedBadges || []).map(b => b.badge_key));

            // 3. 計算未解鎖徽章的進度
            const availableBadges = [];

            // 取得用戶統計數據（一次查詢，避免重複）
            const { count: totalCorrect } = await this.supabase
                .from('answer_records')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_correct', true);

            const { count: masteredCount } = await this.supabase
                .from('user_question_progress')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('times_correct', 3);

            // 計算連勝
            const { data: recentAnswers } = await this.supabase
                .from('answer_records')
                .select('is_correct')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);

            let maxStreak = 0;
            let currentStreak = 0;
            if (recentAnswers) {
                for (const record of recentAnswers) {
                    if (record.is_correct) {
                        currentStreak++;
                        maxStreak = Math.max(maxStreak, currentStreak);
                    } else {
                        currentStreak = 0;
                    }
                }
            }

            // 簡化版進度計算（針對主要徽章類型）
            for (const badge of allBadges) {
                if (unlockedKeys.has(badge.badgeKey)) continue;

                let current = 0;
                let target = 0;
                let progress = 0;

                // 根據徽章類型計算進度
                if (badge.badgeKey.includes('_correct')) {
                    // 累積答對題數徽章
                    current = totalCorrect || 0;
                    if (badge.badgeKey === 'first_correct') target = 1;
                    else if (badge.badgeKey === 'ten_correct') target = 10;
                    else if (badge.badgeKey === 'hundred_correct') target = 100;
                    else if (badge.badgeKey === 'fivehundred_correct') target = 500;

                    progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                } else if (badge.badgeKey.includes('streak_')) {
                    // 連勝徽章
                    current = maxStreak || 0;
                    if (badge.badgeKey === 'streak_3') target = 3;
                    else if (badge.badgeKey === 'streak_10') target = 10;
                    else if (badge.badgeKey === 'streak_20') target = 20;

                    progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                } else if (badge.badgeKey.includes('mastery_')) {
                    // 熟練度徽章
                    current = masteredCount || 0;
                    if (badge.badgeKey === 'mastery_10') target = 10;
                    else if (badge.badgeKey === 'mastery_50') target = 50;
                    else if (badge.badgeKey === 'mastery_100') target = 100;

                    progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                }

                // 只包含進度 >= minProgress 的徽章
                if (progress >= minProgress && target > 0) {
                    availableBadges.push({
                        badgeKey: badge.badgeKey,
                        badgeName: badge.badgeName,
                        badgeDescription: badge.badgeDescription,
                        badgeIcon: badge.badgeIcon,
                        category: badge.category,
                        progress: progress,
                        current: current,
                        target: target,
                        remaining: target - current
                    });
                }
            }

            // 按進度降序排序（即將解鎖的排在前面）
            availableBadges.sort((a, b) => b.progress - a.progress);

            return {
                success: true,
                data: availableBadges
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== T008 - 個人紀錄追蹤 ====================

    /**
     * T008 - 更新個人紀錄（每次答題後呼叫）
     * @param {string} userId - 使用者 ID
     * @returns {Promise<{success: boolean, data: {brokenRecords: Array<string>, currentRecords: Object}}>}
     */
    async updateUserRecords(userId) {
        try {
            // 1. 確保用戶有 user_records 記錄（沒有就建立）
            let { data: userRecord, error: fetchError } = await this.supabase
                .from('user_records')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (fetchError && fetchError.code === 'PGRST116') {
                // 記錄不存在，建立新記錄
                const { data: newRecord, error: insertError } = await this.supabase
                    .from('user_records')
                    .insert({
                        user_id: userId,
                        last_answer_date: new Date().toISOString().split('T')[0]
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                userRecord = newRecord;
            } else if (fetchError) {
                throw fetchError;
            }

            // 2. 計算今日統計
            const today = new Date().toISOString().split('T')[0];
            const todayStart = new Date(today + 'T00:00:00Z');
            const todayEnd = new Date(today + 'T23:59:59Z');

            // 今日答題記錄
            const { data: todayAnswers, error: todayError } = await this.supabase
                .from('answer_records')
                .select('is_correct, response_time_ms')
                .eq('user_id', userId)
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString());

            if (todayError) throw todayError;

            // 3. 計算今日正確率與答對數
            const todayTotal = todayAnswers?.length || 0;
            const todayCorrect = todayAnswers?.filter(a => a.is_correct).length || 0;
            const todayAccuracy = todayTotal > 0 ? (todayCorrect / todayTotal) * 100 : 0;
            const todayAvgResponseMs = todayAnswers?.length > 0
                ? Math.round(todayAnswers.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / todayAnswers.length)
                : null;

            // 4. 計算當前連續答對數（最近答題）
            const { data: recentAnswers, error: recentError } = await this.supabase
                .from('answer_records')
                .select('is_correct')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (recentError) throw recentError;

            let currentStreak = 0;
            let longestStreak = 0;
            let tempStreak = 0;

            if (recentAnswers && recentAnswers.length > 0) {
                // 計算當前連勝（從最新開始往回數）
                for (const answer of recentAnswers) {
                    if (answer.is_correct) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }

                // 計算最長連勝
                for (const answer of recentAnswers) {
                    if (answer.is_correct) {
                        tempStreak++;
                        longestStreak = Math.max(longestStreak, tempStreak);
                    } else {
                        tempStreak = 0;
                    }
                }
            }

            // 5. 計算連續答題天數
            const lastAnswerDate = userRecord.last_answer_date;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            let newDailyStreak = userRecord.current_daily_streak || 0;

            if (lastAnswerDate === yesterdayStr) {
                // 昨天也有答題，連續天數+1
                newDailyStreak++;
            } else if (lastAnswerDate !== today) {
                // 中斷了（超過一天沒答題），重新計數
                newDailyStreak = 1;
            }
            // 如果 lastAnswerDate === today，保持現有天數不變（今天已經計數過了）

            // 6. 準備更新資料與打破紀錄列表
            const brokenRecords = [];
            const updateData = {
                last_answer_date: today,
                current_daily_streak: newDailyStreak,
                updated_at: new Date().toISOString()
            };

            // 檢查各項紀錄是否打破
            if (todayTotal > 0 && todayAccuracy > (userRecord.best_daily_accuracy || 0)) {
                updateData.best_daily_accuracy = todayAccuracy;
                updateData.best_daily_accuracy_date = today;
                brokenRecords.push('bestDailyAccuracy');
            }

            if (todayCorrect > (userRecord.best_daily_correct_count || 0)) {
                updateData.best_daily_correct_count = todayCorrect;
                updateData.best_daily_correct_date = today;
                brokenRecords.push('bestDailyCorrectCount');
            }

            if (longestStreak > (userRecord.longest_correct_streak || 0)) {
                updateData.longest_correct_streak = longestStreak;
                updateData.longest_correct_streak_date = today;
                brokenRecords.push('longestCorrectStreak');
            }

            if (newDailyStreak > (userRecord.longest_daily_streak || 0)) {
                updateData.longest_daily_streak = newDailyStreak;
                updateData.longest_daily_streak_end_date = today;
                brokenRecords.push('longestDailyStreak');
            }

            if (todayAvgResponseMs && (
                !userRecord.fastest_avg_response_ms ||
                todayAvgResponseMs < userRecord.fastest_avg_response_ms
            )) {
                updateData.fastest_avg_response_ms = todayAvgResponseMs;
                updateData.fastest_avg_response_date = today;
                brokenRecords.push('fastestAvgResponse');
            }

            // 7. 更新資料庫
            const { data: updatedRecord, error: updateError } = await this.supabase
                .from('user_records')
                .update(updateData)
                .eq('user_id', userId)
                .select()
                .single();

            if (updateError) throw updateError;

            // 8. 回傳結果
            return {
                success: true,
                data: {
                    brokenRecords: brokenRecords,
                    currentRecords: {
                        bestDailyAccuracy: updatedRecord.best_daily_accuracy,
                        bestDailyAccuracyDate: updatedRecord.best_daily_accuracy_date,
                        bestDailyCorrectCount: updatedRecord.best_daily_correct_count,
                        bestDailyCorrectDate: updatedRecord.best_daily_correct_date,
                        longestCorrectStreak: updatedRecord.longest_correct_streak,
                        longestCorrectStreakDate: updatedRecord.longest_correct_streak_date,
                        longestDailyStreak: updatedRecord.longest_daily_streak,
                        longestDailyStreakEndDate: updatedRecord.longest_daily_streak_end_date,
                        currentDailyStreak: updatedRecord.current_daily_streak,
                        fastestAvgResponseMs: updatedRecord.fastest_avg_response_ms,
                        fastestAvgResponseDate: updatedRecord.fastest_avg_response_date,
                        todayStats: {
                            accuracy: todayAccuracy,
                            correctCount: todayCorrect,
                            totalCount: todayTotal,
                            avgResponseMs: todayAvgResponseMs,
                            currentStreak: currentStreak
                        }
                    }
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * T008 - 取得用戶的所有個人紀錄
     * @param {string} userId - 使用者 ID
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    async getUserRecords(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_records')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // 記錄不存在，回傳空白紀錄
                return {
                    success: true,
                    data: {
                        bestDailyAccuracy: 0,
                        bestDailyAccuracyDate: null,
                        bestDailyCorrectCount: 0,
                        bestDailyCorrectDate: null,
                        longestCorrectStreak: 0,
                        longestCorrectStreakDate: null,
                        longestDailyStreak: 0,
                        longestDailyStreakEndDate: null,
                        currentDailyStreak: 0,
                        fastestAvgResponseMs: null,
                        fastestAvgResponseDate: null,
                        lastAnswerDate: null
                    }
                };
            }

            if (error) throw error;

            return {
                success: true,
                data: {
                    bestDailyAccuracy: data.best_daily_accuracy,
                    bestDailyAccuracyDate: data.best_daily_accuracy_date,
                    bestDailyCorrectCount: data.best_daily_correct_count,
                    bestDailyCorrectDate: data.best_daily_correct_date,
                    longestCorrectStreak: data.longest_correct_streak,
                    longestCorrectStreakDate: data.longest_correct_streak_date,
                    longestDailyStreak: data.longest_daily_streak,
                    longestDailyStreakEndDate: data.longest_daily_streak_end_date,
                    currentDailyStreak: data.current_daily_streak,
                    fastestAvgResponseMs: data.fastest_avg_response_ms,
                    fastestAvgResponseDate: data.fastest_avg_response_date,
                    lastAnswerDate: data.last_answer_date
                }
            };
        } catch (error) {
            return this._handleError(error);
        }
    }

    // ==================== 考卷建立相關 ====================

    /**
     * [管理員] 取得所有類別與章節的題目數量統計
     * 用於建立考卷時選擇來源
     * @returns {Promise<{success: boolean, data: Array<{subject, chapter, question_count}>}>}
     */
    async getSubjectChapterStats() {
        try {
            // 取得所有題目的 subject 和 chapter
            const { data, error } = await this.supabase
                .from('questions')
                .select('subject, chapter');

            if (error) throw error;

            // 按 subject -> chapter 分組統計
            const statsMap = {};
            data.forEach(q => {
                const subject = q.subject || '未分類';
                const chapter = q.chapter || '通用';
                const key = `${subject}||${chapter}`;

                if (!statsMap[key]) {
                    statsMap[key] = { subject, chapter, question_count: 0 };
                }
                statsMap[key].question_count++;
            });

            // 轉換為陣列並依 subject, chapter 排序
            const result = Object.values(statsMap).sort((a, b) => {
                if (a.subject !== b.subject) {
                    return a.subject.localeCompare(b.subject, 'zh-TW');
                }
                return a.chapter.localeCompare(b.chapter, 'zh-TW');
            });

            return { success: true, data: result };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * [管理員] 從指定的類別/章節隨機抽取題目
     * @param {Array<{subject: string, chapter: string}>} sources - 來源陣列
     * @param {number} count - 抽取題數
     * @returns {Promise<{success: boolean, data: Array<QuestionObject>}>}
     */
    async getRandomQuestions(sources, count) {
        try {
            if (!sources || sources.length === 0) {
                return { success: false, error: { message: '請選擇至少一個來源' } };
            }

            // 建立 OR 條件
            const orConditions = sources.map(
                src => `and(subject.eq."${src.subject}",chapter.eq."${src.chapter}")`
            ).join(',');

            // 取得所有符合條件的題目
            const { data, error } = await this.supabase
                .from('questions')
                .select('*')
                .or(orConditions);

            if (error) throw error;

            if (!data || data.length === 0) {
                return { success: false, error: { message: '選定的來源中沒有題目' } };
            }

            // 使用 Fisher-Yates 洗牌演算法隨機打亂
            const shuffled = [...data];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            // 取出指定數量
            const selected = shuffled.slice(0, Math.min(count, shuffled.length));

            return { success: true, data: selected, totalAvailable: data.length, allQuestions: data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * [管理員] 複製題目到新的類別/章節
     * @param {Array<Object>} questions - 原始題目陣列
     * @param {string} newSubject - 新類別名稱
     * @param {string} newChapter - 新章節名稱
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async copyQuestionsToNewExam(questions, newSubject, newChapter) {
        try {
            if (!questions || questions.length === 0) {
                return { success: false, error: { message: '沒有題目可複製' } };
            }

            if (!newSubject || !newChapter) {
                return { success: false, error: { message: '請填寫新類別和章節名稱' } };
            }

            const now = new Date().toISOString();

            // 準備新題目資料（移除 id，更換 subject/chapter，保留原始分類與來源 ID）
            const newQuestions = questions.map((q, index) => {
                // 解構移除不需要的欄位
                const { id, user_id, created_at, updated_at, ...questionData } = q;

                return {
                    ...questionData,
                    subject: newSubject,
                    chapter: newChapter,
                    // 保留原始分類：若已有 original 則沿用，否則用當前值
                    original_subject: q.original_subject || q.subject,
                    original_chapter: q.original_chapter || q.chapter,
                    // 追溯原始題目 ID：若已是複製題則沿用其 source，否則用自身 ID
                    source_question_id: q.source_question_id || id,
                    question_no: index + 1,
                    subject_no: 999,  // 自訂考卷排序靠後
                    chapter_no: 999,
                    created_at: now,
                    updated_at: now
                };
            });

            // 批量插入
            const { data, error } = await this.supabase
                .from('questions')
                .insert(newQuestions)
                .select();

            if (error) throw error;

            // 同步 chapter_access 表
            await this.syncChapterAccess();

            return { success: true, data, count: data.length };
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
window.apiService = apiService;
