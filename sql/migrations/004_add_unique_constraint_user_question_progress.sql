-- Migration: 004_add_unique_constraint_user_question_progress
-- 為 user_question_progress 加上 (user_id, question_id) 的 unique constraint
-- 解決 upsert 時 "there is no unique or exclusion constraint matching the ON CONFLICT specification" 錯誤

ALTER TABLE public.user_question_progress
ADD CONSTRAINT user_question_progress_user_id_question_id_key UNIQUE (user_id, question_id);
