"""
cleanup_index.py — 清理 index.html 硬編碼數值
執行：python cleanup_index.py
"""
import re

path = r'c:\Users\USER\Desktop\text\sandys-exam-card-system\index.html'

with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

changes = []

# ── 1. Tailwind config: 更新 colors 引用 CSS 變數 + 新增語義化顏色 ──
old_colors = '''"primary": "#ffd400",
                        "background-light": "#f7f7f7",
                        "background-dark": "#1a1a1a",'''
new_colors = '''"primary": "var(--color-primary)",
                        "background-light": "var(--color-bg-light)",
                        "background-dark": "var(--color-bg-dark)",
                        "surface": "var(--color-surface)",
                        "text-base": "var(--color-text-base)",
                        "border-main": "var(--color-border-main)",'''
if old_colors in src:
    src = src.replace(old_colors, new_colors, 1)
    changes.append('✅ Tailwind config colors → CSS vars (+ 新增 surface / text-base / border-main)')
else:
    changes.append('⚠️  Tailwind config 未找到（可能已更新）')

# ── 2. body & HTML：text-[#1a1a1a] → text-text-base ──
count = src.count('text-[#1a1a1a]')
if count:
    src = src.replace('text-[#1a1a1a]', 'text-text-base')
    changes.append(f'✅ text-[#1a1a1a] → text-text-base  ({count} 處)')

# ── 3. bg-zinc-100 → bg-surface ──
count = src.count('bg-zinc-100')
if count:
    src = src.replace('bg-zinc-100', 'bg-surface')
    changes.append(f'✅ bg-zinc-100 → bg-surface  ({count} 處)')

# ── 4. Toast 手寫 shadow → neo-shadow-sm ──
old_shadow = 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
count = src.count(old_shadow)
if count:
    src = src.replace(old_shadow, 'neo-shadow-sm')
    changes.append(f'✅ shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] → neo-shadow-sm  ({count} 處)')

# ── 5. border-black → border-border-main ──
# 使用 regex 避免誤改非顏色類別（如 border-b-2、border-l-2 等）
old = r'\bborder-black\b'
new = 'border-border-main'
result, count = re.subn(old, new, src)
if count:
    src = result
    changes.append(f'✅ border-black → border-border-main  ({count} 處)')

# ── 6. dark:border-black → dark:border-border-main ──
old = r'\bdark:border-black\b'
new = 'dark:border-border-main'
result, count = re.subn(old, new, src)
if count:
    src = result
    changes.append(f'✅ dark:border-black → dark:border-border-main  ({count} 處)')

# 寫回
with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print('=== cleanup_index.py 完成 ===')
for c in changes:
    print(c)
