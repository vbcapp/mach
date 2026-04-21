# 啟動伺服器指令

## 方法一：使用 Python（推薦）

```bash
python3 -m http.server 8000
```

然後開啟瀏覽器訪問：http://localhost:8000

---

## 方法二：使用 Node.js (npx)

```bash
npx http-server -p 8000
```

然後開啟瀏覽器訪問：http://localhost:8000

---

## 方法三：使用 PHP

```bash
php -S localhost:8000
```

然後開啟瀏覽器訪問：http://localhost:8000

---

## 停止伺服器

在終端機按 `Ctrl + C` 即可停止伺服器

---

## 注意事項

- 請確保在專案根目錄（brotherhsiehlearningcard）執行指令
- 如果 8000 端口被占用，可以改用其他端口（如 3000、8080 等）
- 首次訪問請先進入登入頁面：http://localhost:8000/login.html
