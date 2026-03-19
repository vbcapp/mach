# 絹的考試系統

## 架構概覽

- **前端**: 靜態 HTML/JS，部署在 GitHub Pages
- **後端**: Supabase (Auth + Postgres + RLS)
- **每個客戶獨立一個 Supabase 專案**，品牌設定從資料庫 `organization_settings` 動態讀取

## 客戶清單

| # | 客戶名稱 | Supabase Project ID | GitHub Repo | Git Remote | Deploy Branch |
|---|---------|-----------|-------------|------------|---------------|
| 1 | 新竹職訓中心 | mwwvrapnjekxwxpyolcm | vbcapp/hsinchu-exam | hsinchu | deploy/hsinchu |
| 2 | 老謝 | vryyyyivmbbqahlaafdn | vbcapp/mach | hsieh | deploy/hsieh |
| 3 | 360d才庫事業群 | sjnaycghlhuaaeeyldco | vbcapp/ipas-training-course | 360d | deploy/360d |

## 分支管理

```
main                → 共用開發分支，所有功能開發在此
deploy/hsinchu      → 新竹職訓中心部署分支
deploy/hsieh        → 老謝部署分支
deploy/360d         → 360d 部署分支
```

- 各 deploy 分支與 main 唯一的差異是 `config.js`（Supabase URL 和 anonKey）
- **絕對不要在 deploy 分支上直接開發功能**

## 部署流程

### 1. 在 main 開發完功能並 commit

### 2. 合併 main 到各 deploy 分支

```bash
git checkout deploy/hsinchu
git merge main --no-edit

git checkout deploy/hsieh
git merge main --no-edit

git checkout deploy/360d
git merge main --no-edit
```

### 3. 推送到各客戶的 GitHub Repo

```bash
git push hsinchu deploy/hsinchu:main
git push hsieh deploy/hsieh:main
git push 360d deploy/360d:main
```

推送後 GitHub Pages 會自動觸發部署。

### 4. 切回 main 繼續開發

```bash
git checkout main
```

## 新增客戶

1. 建立新的 Supabase 專案
2. 執行 `sql/migrations/` 下的所有 migration
3. 在 `organization_settings` 設定品牌資訊
4. 建立新的 GitHub Repo 並加為 remote：`git remote add <name> <repo-url>`
5. 從 main 建立新的 deploy 分支：`git checkout -b deploy/<name> main`
6. 修改該分支的 `config.js` 指向新的 Supabase 專案
7. 推送：`git push <name> deploy/<name>:main`
8. 在 GitHub Repo 設定啟用 GitHub Pages

## 角色系統

`master_admin` > `super_admin` > `sub_admin` > `user`

## Migration 系統

- 版本追蹤表: `schema_migrations`
- Migration 檔案: `sql/migrations/`
- 詳見 [sql/migrations/README.md](../sql/migrations/README.md)
