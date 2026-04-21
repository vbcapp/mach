#!/bin/bash
# 雙擊這個檔案即可啟動 Excel → JSON 轉換器
cd "$(dirname "$0")" || exit 1

PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
        PYTHON_CMD="$cmd"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ 找不到 Python。請先安裝 Python 3："
    echo "   https://www.python.org/downloads/"
    read -rp "按 Enter 關閉..."
    exit 1
fi

echo "使用 Python: $($PYTHON_CMD --version)"
echo ""

"$PYTHON_CMD" convert.py
