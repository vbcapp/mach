import os

files = [
    'admin.html','create.html','edit.html','history-analysis.html',
    'import.html','index.html','profile.html','profilei.html',
    'rank.html','weakness.html'
]

link_tag = '    <link rel="stylesheet" href="design-tokens.css">\n'
base = r'c:\Users\USER\Desktop\text\sandys-exam-card-system'

for fname in files:
    path = os.path.join(base, fname)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'design-tokens.css' in content:
        print(f'skip  {fname}')
        continue
    new_content = content.replace('<head>', '<head>\n' + link_tag, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'done  {fname}')
