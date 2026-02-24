-- =============================================
-- T001 修復：為現有用戶初始化 user_records
-- =============================================
-- 這段 SQL 應該在首次執行時就包含在內，現在補上

-- 為現有用戶初始化 user_records（避免查詢時找不到記錄）
INSERT INTO user_records (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 驗證結果
SELECT COUNT(*) as initialized_users FROM user_records;
SELECT COUNT(*) as total_users FROM auth.users;
