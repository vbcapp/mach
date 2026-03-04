#!/usr/bin/env python3
"""
replace_tokens.py — Sandy's Exam Card System
將 HTML 檔案中的硬編碼設計數值，批量替換為 design-tokens.css 的 CSS 變數。

使用方法：
    python replace_tokens.py              # 預覽（Dry Run，不修改檔案）
    python replace_tokens.py --apply      # 正式執行替換

注意：腳本會在同目錄下找所有 .html 檔案進行處理。
"""

import os
import re
import sys
import glob
import shutil

# ──────────────────────────────────────────────────────────
# 替換規則表（順序從最具體到最通用，避免誤替換）
# 格式：(原始字串或 Regex, 替換目標, 說明, is_regex)
# ──────────────────────────────────────────────────────────

REPLACEMENTS = [
    # ── inline box-shadow（Regex，優先處理） ──
    (r'box-shadow:\s*4px 4px 0px 0px #000000',
     'box-shadow: var(--card-shadow)',
     "inline card-shadow", True),

    (r'box-shadow:\s*2px 2px 0px 0px #000000',
     'box-shadow: var(--card-shadow-sm)',
     "inline card-shadow-sm", True),

    (r'box-shadow:\s*8px 8px 0px 0px rgba\(0,\s*0,\s*0,\s*1\)',
     'box-shadow: var(--card-shadow-lg)',
     "inline card-shadow-lg", True),

    # ── 主色系（普通字串，在 HTML 屬性值中替換） ──
    ("#ffd400",  "var(--color-primary)",        "主色 yellow",           False),
    ("#FFD600",  "var(--color-primary)",        "主色 yellow 大寫",       False),
    ("#ffd600",  "var(--color-primary)",        "主色 yellow 小寫2",      False),
    ("#FFD400",  "var(--color-primary)",        "主色 yellow 大寫2",      False),
    ("#f9f506",  "var(--color-primary)",        "login 主色",            False),
    ("#b8860b",  "var(--color-primary-dark)",   "主色深色",              False),
    ("#B8860B",  "var(--color-primary-dark)",   "主色深色大寫",           False),

    # ── 背景色 ──
    ("#f7f7f7",  "var(--color-bg-light)",       "淺色背景",              False),
    ("#f8f8f5",  "var(--color-bg-login-light)", "登入頁淺色背景",         False),
    ("#23220f",  "var(--color-bg-login-dark)",  "登入頁深色背景",         False),

    # ── 功能色 ──
    ("#FF3B30",  "var(--color-danger)",         "danger 紅",             False),
    ("#ff3b30",  "var(--color-danger)",         "danger 紅小寫",          False),
    ("#16a34a",  "var(--color-success-dark)",   "success 深綠",           False),
    ("#22c55e",  "var(--color-success)",        "success 綠",            False),
    ("#3b82f6",  "var(--color-info)",           "info 藍",               False),
    ("#a855f7",  "var(--color-purple)",         "特殊紫色",              False),
    ("#f59e0b",  "var(--color-warning)",        "warning 橘",            False),

    # ── rgba 常見透明色 ──
    ("rgba(255, 212, 0, 0.8)", "var(--color-primary-glow)", "primary glow 0.8", False),
    ("rgba(255, 214, 0, 0.6)", "var(--color-primary-glow)", "primary glow 0.6", False),
    ("rgba(255, 214, 0, 0.9)", "var(--color-primary-glow)", "primary glow 0.9", False),
]

# HTML 屬性值的正規表示式（用來找 class="..." style="..." 等）
ATTR_PATTERN = re.compile(r'((?:class|style|fill|stroke)\s*=\s*")(.*?)(")', re.DOTALL)


def replace_in_attrs(content: str, plain: str, replacement: str) -> tuple[str, int]:
    """只在 HTML 屬性值（class/style/fill/stroke）內替換普通字串"""
    count = 0

    def replacer(m):
        nonlocal count
        opening, value, closing = m.group(1), m.group(2), m.group(3)
        new_value = value.replace(plain, replacement)
        c = value.count(plain)
        count += c
        return opening + new_value + closing

    new_content = ATTR_PATTERN.sub(replacer, content)
    return new_content, count


def process_file(filepath: str, dry_run: bool = True) -> list[str]:
    """處理單一 HTML 檔案，回傳變更摘要清單"""
    with open(filepath, "r", encoding="utf-8") as f:
        original = f.read()

    content = original
    changes = []

    for rule in REPLACEMENTS:
        pattern, replacement, desc, is_regex = rule

        if is_regex:
            new_content, count = re.subn(pattern, replacement, content)
        else:
            new_content, count = replace_in_attrs(content, pattern, replacement)

        if count > 0:
            changes.append(f"  [{count}次] {desc}: {pattern!r} → {replacement!r}")
            content = new_content

    if not dry_run and content != original:
        backup_path = filepath + ".bak"
        shutil.copy2(filepath, backup_path)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

    return changes


def main():
    dry_run = "--apply" not in sys.argv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_files = glob.glob(os.path.join(script_dir, "*.html"))

    if not html_files:
        print("⚠️  找不到任何 .html 檔案！")
        return

    mode_label = "🔍 [預覽模式] 以下是將要進行的替換（不會修改檔案）" if dry_run \
        else "✅ [正式執行] 開始替換..."
    print(mode_label)
    print(f"找到 {len(html_files)} 個 HTML 檔案\n")
    print("=" * 60)

    total_files_changed = 0

    for filepath in sorted(html_files):
        filename = os.path.basename(filepath)
        changes = process_file(filepath, dry_run=dry_run)

        if changes:
            total_files_changed += 1
            status = "（已備份 .bak 並修改）" if not dry_run else "（待修改）"
            print(f"\n📄 {filename} {status}")
            for line in changes:
                print(line)
        else:
            print(f"\n📄 {filename} — 無需替換")

    print("\n" + "=" * 60)
    print(f"\n📊 共 {total_files_changed} / {len(html_files)} 個檔案需要修改")

    if dry_run:
        print("\n💡 確認無誤後，執行以下指令正式套用：")
        print("   python replace_tokens.py --apply")
    else:
        print("\n🎉 替換完成！原始檔案已備份為 *.bak")
        print("   如需還原，將 .bak 檔案重新命名即可。")


if __name__ == "__main__":
    main()
