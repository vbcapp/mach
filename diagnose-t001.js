#!/usr/bin/env node

/**
 * T001 診斷腳本 - 深度檢查
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mwwvrapnjekxwxpyolcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXl5eWl2bWJicWFobGFhZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTU4MzMsImV4cCI6MjA4NzE5MTgzM30.CuBBkWyFSh9vpIYX5CdgZ01qH3YkTIdl-ewOQcmVa3U';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 T001 深度診斷中...\n');

async function diagnose() {
    console.log('1️⃣ 檢查 auth.users 表資料...');
    try {
        // 嘗試直接查詢 auth.users（可能需要特殊權限）
        const { data, error } = await supabase.rpc('get_user_count');

        if (error && error.code === '42883') {
            console.log('   ℹ️  無法直接查詢 auth.users（需要建立 RPC 函式）');
            console.log('   建議在 Supabase SQL Editor 執行：');
            console.log(`
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COUNT(*) FROM auth.users;
$$;

CREATE OR REPLACE FUNCTION init_user_records()
RETURNS TABLE(inserted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_records (user_id)
    SELECT id FROM auth.users
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY SELECT COUNT(*) FROM user_records;
END;
$$;
            `);
        } else if (error) {
            console.log(`   ❌ 錯誤: ${error.message}`);
        } else {
            console.log(`   ✅ 用戶總數: ${data}`);
        }
    } catch (err) {
        console.log(`   ⚠️  ${err.message}`);
    }

    console.log('\n2️⃣ 檢查 user_records 表資料...');
    try {
        const { data, error } = await supabase
            .from('user_records')
            .select('*');

        if (error) throw error;
        console.log(`   ✅ user_records 總數: ${data?.length || 0}`);
        if (data && data.length > 0) {
            console.log('   📋 現有記錄:');
            data.forEach((record, idx) => {
                console.log(`      ${idx + 1}. user_id: ${record.user_id}`);
            });
        }
    } catch (err) {
        console.log(`   ❌ 錯誤: ${err.message}`);
    }

    console.log('\n3️⃣ 檢查 users 表資料...');
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, exam_date, daily_goal');

        if (error) throw error;
        console.log(`   ✅ users 表總數: ${data?.length || 0}`);
        if (data && data.length > 0) {
            console.log('   📋 現有用戶:');
            data.forEach((user, idx) => {
                console.log(`      ${idx + 1}. ${user.username || 'N/A'} (${user.id})`);
                console.log(`         exam_date: ${user.exam_date || 'null'}, daily_goal: ${user.daily_goal || 'null'}`);
            });
        }
    } catch (err) {
        console.log(`   ❌ 錯誤: ${err.message}`);
    }

    console.log('\n4️⃣ 嘗試手動初始化一筆 user_records...');
    try {
        // 取得第一個用戶 ID
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .limit(1);

        if (userError) throw userError;

        if (userData && userData.length > 0) {
            const testUserId = userData[0].id;
            console.log(`   嘗試為用戶 ${testUserId} 初始化...`);

            const { data, error } = await supabase
                .from('user_records')
                .insert({ user_id: testUserId })
                .select();

            if (error) {
                if (error.code === '23505') {
                    console.log(`   ℹ️  該用戶已有紀錄（重複鍵值）`);
                } else {
                    console.log(`   ❌ 插入失敗: ${error.message} (code: ${error.code})`);
                }
            } else {
                console.log(`   ✅ 成功插入！`);
            }
        } else {
            console.log(`   ⚠️  users 表中沒有用戶`);
        }
    } catch (err) {
        console.log(`   ❌ 錯誤: ${err.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 診斷建議:');
    console.log('='.repeat(60));
    console.log(`
如果 user_records 仍然是 0，可能原因：

1. **RLS 政策問題**
   - user_records 的 INSERT 政策可能限制了批量插入
   - 建議修改為允許 service_role 插入

2. **auth.users 存取權限**
   - anon key 無法直接讀取 auth.users
   - 需要建立 RPC 函式（SECURITY DEFINER）

3. **建議解決方案**
   在 Supabase SQL Editor 執行：

   -- 方案 A: 建立 RPC 函式自動初始化
   CREATE OR REPLACE FUNCTION init_user_records()
   RETURNS bigint
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
       inserted_count bigint;
   BEGIN
       INSERT INTO user_records (user_id)
       SELECT id FROM auth.users
       ON CONFLICT (user_id) DO NOTHING;

       GET DIAGNOSTICS inserted_count = ROW_COUNT;
       RETURN inserted_count;
   END;
   $$;

   -- 執行初始化
   SELECT init_user_records();

   -- 方案 B: 直接執行 SQL（推薦）
   INSERT INTO user_records (user_id)
   SELECT id FROM auth.users
   ON CONFLICT (user_id) DO NOTHING;
    `);
}

diagnose().catch(err => {
    console.error('\n❌ 診斷過程發生錯誤:', err);
    process.exit(1);
});
