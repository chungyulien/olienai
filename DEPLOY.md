# olienAI 部署說明

## 網址設定

網站程式目前支援：

- 前台：`http://olienAI/`
- 後台：`http://olienAI/admin`

重要提醒：`olienAI` 是單字主機名稱，通常不能直接作為公開網際網路的正式網域。若要讓手機、平板、外部電腦都能直接連線，建議使用正式網域，例如：

- `https://olienai.com`
- `https://olienai.tw`
- `https://ai.your-domain.com`

如果一定要使用 `http://olienAI`，需要在同一個區域網路內設定 DNS，或在每台裝置的 hosts 檔中把 `olienAI` 指到伺服器 IP。

## 部署到主機

這個網站是 Node.js 專案，主機需要支援：

- Node.js 18 以上
- 可寫入檔案系統，用來保存 `data/content.json` 和 `data/stats.json`

啟動指令：

```bash
npm start
```

建議設定環境變數：

```bash
ADMIN_PASSWORD=請換成安全密碼
PORT=3000
```

## GitHub + Render 發佈

建議流程：

1. 建立 GitHub repository，將 `prompt-link-hub` 專案推上去。
2. 到 Render 建立新的 Web Service。
3. 連接 GitHub repository。
4. Render 會讀取 `render.yaml`，自動使用 `npm install` 和 `npm start`。
5. 在 Render 的 Environment 設定 `ADMIN_PASSWORD`。
6. 部署完成後，Render 會給你一個公開網址。
7. 若要使用自己的網址，請在網域 DNS 裡把 CNAME 指向 Render 提供的目標。

GitHub Pages 不適合這個版本，因為後台儲存與瀏覽統計需要 Node.js 伺服器。

## 免費但較穩的資料保存方式

Render Free 可以繼續使用，但建議把資料放到免費 PostgreSQL，例如 Supabase 或 Neon。

網站支援 `DATABASE_URL`：

- 沒有設定 `DATABASE_URL`：使用 `data/content.json` 和 `data/stats.json`
- 設定 `DATABASE_URL`：自動建立資料表，後台內容與瀏覽次數會保存到 PostgreSQL

Render 環境變數建議：

```bash
DATABASE_URL=你的 Supabase 或 Neon PostgreSQL 連線字串
ADMIN_PASSWORD=你的後台密碼
```

第一次接上資料庫時，系統會把 GitHub 裡的初始 `data/content.json` 和 `data/stats.json` 匯入資料庫。

## Docker 部署

```bash
docker build -t olienai .
docker run -d --name olienai -p 3000:3000 -e ADMIN_PASSWORD=請換成安全密碼 olienai
```

正式環境建議把 `data` 資料夾掛成持久化磁碟，避免重新部署時內容和瀏覽統計歸零。
