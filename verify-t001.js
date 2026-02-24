#!/usr/bin/env node

/**
 * T001 驗證腳本
 * 檢查遊戲化系統資料庫結構是否完成建立
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vryyyyivmbbqahlaafdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXl5eWl2bWJicWFobGFhZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTU4MzMsImV4cCI6MjA4NzE5MTgzM30.CuBBkWyFSh9vpIYX5CdgZ01qH3YkTIdl-ewOQcmVa3U';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 開始驗證 T001: 遊戲化資料庫結構...\n');

async function verifyT001() {
    const results = {
        passed: [],
        failed: []
    };

    // 1. 檢查 user_badges 表
    console.log('1️⃣ 檢查 user_badges 表...');
    try {
        const { data, error } = await supabase
            .from('user_badges')
            .select('*')
            .limit(0);

        if (error) throw error;
        results.passed.push('✅ user_badges 表存在');
    } catch (err) {
        results.failed.push(`❌ user_badges 表不存在: ${err.message}`);
    }

    // 2. 檢查 user_records 表
    console.log('2️⃣ 檢查 user_records 表...');
    try {
        const { data, error } = await supabase
            .from('user_records')
            .select('*')
            .limit(0);

        if (error) throw error;
        results.passed.push('✅ user_records 表存在');
    } catch (err) {
        results.failed.push(`❌ user_records 表不存在: ${err.message}`);
    }

    // 3. 檢查 users 表新欄位 - exam_date
    console.log('3️⃣ 檢查 users 表新欄位 (exam_date, daily_goal)...');
    try {
        const { data, error } = await supabase
            .from('users')
            .select('exam_date, daily_goal')
            .limit(1);

        if (error) throw error;
        results.passed.push('✅ users 表已擴充 (exam_date, daily_goal)');
    } catch (err) {
        results.failed.push(`❌ users 表新欄位不存在: ${err.message}`);
    }

    // 4. 檢查 user_records 是否有資料（現有用戶應已初始化）
    console.log('4️⃣ 檢查現有用戶是否已初始化 user_records...');
    try {
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id')
            .limit(10);

        if (usersError) throw usersError;

        const { data: recordsData, error: recordsError } = await supabase
            .from('user_records')
            .select('user_id')
            .limit(10);

        if (recordsError) throw recordsError;

        const userCount = usersData?.length || 0;
        const recordCount = recordsData?.length || 0;

        console.log(`   用戶總數: ${userCount}, user_records 總數: ${recordCount}`);

        if (recordCount >= userCount) {
            results.passed.push(`✅ 現有用戶已初始化 user_records (${recordCount}/${userCount})`);
        } else {
            results.failed.push(`⚠️ 部分用戶未初始化 user_records (${recordCount}/${userCount})`);
        }
    } catch (err) {
        results.failed.push(`❌ 無法檢查用戶初始化: ${err.message}`);
    }

    // 5. 檢查 user_badges 的唯一性約束
    console.log('5️⃣ 檢查 user_badges UNIQUE 約束...');
    try {
        // 嘗試查詢表結構（需要 service_role key 才能完整查詢，這裡只做基本測試）
        const { data, error } = await supabase
            .from('user_badges')
            .select('user_id, badge_key')
            .limit(1);

        if (error) throw error;
        results.passed.push('✅ user_badges 表可正常查詢');
    } catch (err) {
        results.failed.push(`❌ user_badges 表查詢失敗: ${err.message}`);
    }

    // 6. 輸出驗證結果
    console.log('\n' + '='.repeat(60));
    console.log('📊 驗證結果總結:');
    console.log('='.repeat(60));

    if (results.passed.length > 0) {
        console.log('\n✅ 通過測試:');
        results.passed.forEach(msg => console.log(`   ${msg}`));
    }

    if (results.failed.length > 0) {
        console.log('\n❌ 失敗測試:');
        results.failed.forEach(msg => console.log(`   ${msg}`));
    }

    const total = results.passed.length + results.failed.length;
    const passRate = ((results.passed.length / total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`總計: ${results.passed.length}/${total} 通過 (${passRate}%)`);
    console.log('='.repeat(60));

    if (results.failed.length === 0) {
        console.log('\n🎉 T001 驗證通過！遊戲化資料庫結構建立完成。');
        return true;
    } else {
        console.log('\n⚠️  T001 驗證失敗！請檢查資料庫結構。');
        console.log('\n💡 請在 Supabase SQL Editor 執行 database.md 中的 SQL 腳本。');
        return false;
    }
}

// 執行驗證
verifyT001()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('\n❌ 驗證過程發生錯誤:', err);
        process.exit(1);
    });
