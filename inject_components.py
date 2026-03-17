"""
inject_components.py — 批量將 HTML 的 <header> 替換為 <div id="app-header"> placeholder，
                        並確保所有 HTML 正確引入 js/components.js
=============================================================================

執行：
    python -X utf8 inject_components.py           # 預覽
    python -X utf8 inject_components.py --apply    # 正式執行
"""
import glob, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
DRY_RUN = "--apply" not in sys.argv

html_files = sorted(glob.glob(os.path.join(BASE, '*.html')))

# ── Header 替換規則 ───────────────────────────────────────────
# 每條規則：(檔案名, 正則 pattern 匹配整段 <header>...</header>, 替換 placeholder)
HEADER_RULES = {
    # 首頁：品牌型 header
    'index.html': {
        'variant': 'brand',
        'title': '考試神器',
        'extra': ' data-admin-btn="true"',
        'pattern': r'<header\s+class="flex-none bg-surface.*?</header>',
    },
    # 返回型：金色背景
    'admin.html': {
        'variant': 'back',
        'title': '權限管理',
        'back_href': 'profile.html',
        'pattern': r'<header class="bg-primary pt-12 pb-6 px-6 border-b-4 border-black">\s*<div class="flex items-center gap-4">\s*<button onclick="window\.location\.href=\'profile\.html\'".*?</header>',
    },
    'create.html': {
        'variant': 'back',
        'title': '建立考卷',
        'back_href': 'index.html',
        'pattern': r'<header class="bg-primary pt-12 pb-6 px-6 border-b-4 border-black">\s*<div class="flex items-center gap-4">\s*<button onclick="window\.location\.href=\'index\.html\'".*?</header>',
    },
    'import.html': {
        'variant': 'back',
        'title': '匯入題目',
        'back_href': 'profile.html',
        'pattern': r'<header class="bg-primary pt-12 pb-6 px-6 border-b-4 border-black">\s*<div class="flex items-center gap-4">\s*<button onclick="window\.location\.href=\'profile\.html\'".*?</header>',
    },
}


def build_placeholder(rule):
    """建立 <div id="app-header"> placeholder"""
    variant = rule['variant']
    title = rule['title']

    if variant == 'brand':
        extra = rule.get('extra', '')
        return f'<div id="app-header" data-variant="brand" data-title="{title}"{extra}></div>'
    else:
        back_href = rule.get('back_href', 'index.html')
        return f'<!-- Header -->\n        <div id="app-header" data-variant="back" data-title="{title}" data-back-href="{back_href}"></div>'


def inject_components_script(src, filename):
    """確保檔案有引入 js/components.js，並移除獨立的 bottom-nav.js 引用"""
    logs = []

    # 1. 移除舊的 bottom-nav.js 引用（已整合到 components.js）
    # 注意：我們不刪除 bottom-nav.js 引用，因為 components.js 只處理 header
    # bottom-nav.js 仍然獨立運作

    # 2. 確保有 components.js 引用
    if 'js/components.js' not in src:
        # 在 </head> 前插入，或在 theme-config.js 後插入
        if 'js/theme-config.js' in src:
            src = src.replace(
                '<script src="js/theme-config.js"></script>',
                '<script src="js/theme-config.js"></script>\n    <script src="js/components.js"></script>'
            )
            logs.append('  [+] 注入 <script src="js/components.js">')
        elif '</head>' in src:
            src = src.replace(
                '</head>',
                '    <script src="js/components.js"></script>\n</head>'
            )
            logs.append('  [+] 注入 <script src="js/components.js"> (before </head>)')

    return src, logs


def process_file(filepath):
    filename = os.path.basename(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        src = f.read()

    original = src
    logs = []

    # 1. 替換 Header（如果有規則）
    if filename in HEADER_RULES:
        rule = HEADER_RULES[filename]
        pattern = rule['pattern']
        placeholder = build_placeholder(rule)

        new_src = re.sub(pattern, placeholder, src, flags=re.DOTALL)
        if new_src != src:
            logs.append(f'  [✓] Header → <div id="app-header" data-variant="{rule["variant"]}">')
            src = new_src
        else:
            logs.append(f'  [!] Header pattern 未匹配')

    # 2. 注入 components.js script
    src, script_logs = inject_components_script(src, filename)
    logs.extend(script_logs)

    changed = src != original

    if not DRY_RUN and changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(src)

    return logs, changed


def main():
    mode = "🔍 [預覽]" if DRY_RUN else "✅ [執行]"
    print(f"{mode} Header 組件注入 + components.js 引入")
    print("=" * 55)

    total_changed = 0
    for fp in html_files:
        fname = os.path.basename(fp)
        logs, changed = process_file(fp)
        if logs:
            total_changed += 1 if changed else 0
            status = "（已修改）" if (not DRY_RUN and changed) else ("（待修改）" if changed else "（無變更）")
            print(f"\n📄 {fname} {status}")
            for l in logs:
                print(l)

    print(f"\n{'='*55}")
    print(f"📊 共 {total_changed} / {len(html_files)} 個檔案{'已修改' if not DRY_RUN else '待修改'}")
    if DRY_RUN:
        print("💡 確認後執行：python -X utf8 inject_components.py --apply")


if __name__ == '__main__':
    main()
