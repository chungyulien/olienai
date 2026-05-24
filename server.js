const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "content.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function readData() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  data.updatedAt = new Date().toISOString();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readStats() {
  try {
    const raw = await fs.readFile(STATS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      totalViews: 0,
      uniqueVisitors: 0,
      daily: {},
      updatedAt: null
    };
  }
}

async function writeStats(stats) {
  stats.updatedAt = new Date().toISOString();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload, headers = {}) {
  send(res, status, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
}

function redirect(res, location) {
  send(res, 302, "", { Location: location });
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAuthenticated(req) {
  const token = parseCookies(req).prompt_hub_session;
  return Boolean(token && sessions.has(token));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function validateData(data) {
  if (!data || typeof data !== "object") return "資料格式不正確。";
  if (!Array.isArray(data.categories)) return "分類資料必須是陣列。";
  if (!Array.isArray(data.items)) return "內容資料必須是陣列。";

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!category.id || !category.name) return "每個分類都需要名稱。";
    categoryIds.add(category.id);
  }

  for (const item of data.items) {
    if (!item.id || !item.title || !item.url || !item.categoryId) {
      return "每筆內容都需要標題、網址與分類。";
    }
    if (!categoryIds.has(item.categoryId)) return `「${item.title}」的分類不存在。`;
    try {
      new URL(item.url);
    } catch {
      return `「${item.title}」的網址格式不正確。`;
    }
  }
  return "";
}

async function serveStatic(req, res, pathname) {
  const routeMap = {
    "/": "/index.html",
    "/admin": "/admin.html",
    "/admin/": "/admin.html"
  };
  const requested = routeMap[pathname] || pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    send(res, 200, content, { "Content-Type": type });
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    send(res, 200, fallback, { "Content-Type": mimeTypes[".html"] });
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/content") {
    sendJson(res, 200, await readData());
    return;
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    sendJson(res, 200, await readStats());
    return;
  }

  if (req.method === "POST" && pathname === "/api/stats/visit") {
    const cookies = parseCookies(req);
    const hasVisitorId = Boolean(cookies.olienai_visitor);
    const visitorId = hasVisitorId ? cookies.olienai_visitor : crypto.randomBytes(16).toString("hex");
    const stats = await readStats();
    const day = todayKey();

    stats.totalViews += 1;
    if (!hasVisitorId) stats.uniqueVisitors += 1;
    stats.daily[day] = stats.daily[day] || { views: 0, uniqueVisitors: 0 };
    stats.daily[day].views += 1;
    if (!hasVisitorId) stats.daily[day].uniqueVisitors += 1;

    await writeStats(stats);
    sendJson(res, 200, stats, {
      "Set-Cookie": `olienai_visitor=${visitorId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/session") {
    sendJson(res, 200, { authenticated: isAuthenticated(req) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "密碼不正確。" });
      return;
    }
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, Date.now());
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": `prompt_hub_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    const token = parseCookies(req).prompt_hub_session;
    if (token) sessions.delete(token);
    send(res, 204, "", {
      "Set-Cookie": "prompt_hub_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    return;
  }

  if (pathname.startsWith("/api/admin/")) {
    if (!isAuthenticated(req)) {
      sendJson(res, 401, { error: "請先登入後台。" });
      return;
    }

    if (req.method === "PUT" && pathname === "/api/admin/content") {
      const data = await readBody(req);
      const error = validateData(data);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }
      await writeData(data);
      sendJson(res, 200, await readData());
      return;
    }
  }

  sendJson(res, 404, { error: "找不到這個 API。" });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && ["/olienAI", "/olienAI/"].includes(pathname)) {
      redirect(res, "/");
      return;
    }

    if (req.method === "GET" && ["/admin.html", "/olienAI/admin", "/olienAI/admin/", "/olienAI/admin.html"].includes(pathname)) {
      redirect(res, "/admin");
      return;
    }

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "伺服器發生錯誤。" });
  }
});

server.listen(PORT, () => {
  console.log(`olienAI is running at http://localhost:${PORT}`);
});
