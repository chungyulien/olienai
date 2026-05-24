# Prompt Link Hub

這是一個用來整理「提示詞」與「外部連結」的小網站。

## 已有功能

- 前台公開頁：使用者可以搜尋、依分類篩選、開啟外部連結、複製提示詞。
- 後台管理頁：可以新增、修改、刪除分類與內容。
- 資料保存：內容存放在 `data/content.json`，儲存後前台立即更新。
- 簡易登入：預設後台密碼是 `admin123`。

## 開啟網站

目前網站已啟動在：

```text
http://localhost:3000
```

之後要重新啟動，可以在這個資料夾執行：

```powershell
.\start-site.ps1
```

## 修改後台密碼

可以用環境變數設定管理密碼後再啟動：

```powershell
$env:ADMIN_PASSWORD="你的新密碼"
.\start-site.ps1
```

## 主要頁面

- 前台：`http://localhost:3000`
- 後台：`http://localhost:3000/admin`

## 主要檔案

- `server.js`：網站伺服器與 API。
- `public/index.html`：前台頁面。
- `public/admin.html`：後台頁面。
- `public/styles.css`：整體樣式。
- `public/app.js`：前台互動。
- `public/admin.js`：後台互動。
- `data/content.json`：分類、提示詞與連結資料。
