const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  getDb,
  ensureSchema,
  listLeads,
  getLead,
  insertLead,
  updateLeadStatus,
} = require("./db");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..");
const LEADS_FILE = path.join(ROOT, "data", "leads.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const COOKIE_NAME = "luma_admin";
const SESSION_SECRET = process.env.SESSION_SECRET || "luma-dev-secret";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const IS_VERCEL = Boolean(process.env.VERCEL);

let db;
let dbReady;

const SYSTEM_PROMPT = `Ты — ИИ-помощник веб-студии Luma. Отвечай по-русски, коротко, тепло и по делу.

Luma делает сайты и лендинги со встроенным ИИ, который сам отвечает на вопросы посетителя и мягко приводит к заявке. Заявки приходят в админку и дублируются в Telegram-группу.

Ориентиры по срокам и бюджету (не выдавай за жёсткий прайс, это оценка):
- Лендинг с ИИ-помощником: 10–18 дней, от 90 000 ₽
- Корпоративный сайт: 3–6 недель, от 180 000 ₽
- Интернет-магазин / сервис: от 6 недель, от 320 000 ₽
- Доработка существующего сайта: индивидуально

Правила:
- Отвечай только про услуги студии, сайты, заявки, ИИ на сайте, сроки и процесс работы.
- Если вопрос не по теме — мягко верни разговор к проекту сайта.
- Не выдумывай кейсы с конкретными цифрами выручки, которых нет.
- После 1–2 полезных ответов мягко предложи оставить заявку: имя и телефон или Telegram. Не дави.
- Если клиент готов — попроси контакты и скажи, что менеджер напишет в тот же день.
- Если уже есть ответы квиза, опирайся на них: тип сайта, цель, бюджет, срок.`;

async function readyDb() {
  if (!dbReady) {
    dbReady = (async () => {
      db = getDb();
      await ensureSchema(db);
      if (!IS_VERCEL) {
        await migrateLocalLeads();
      }
      return db;
    })().catch((error) => {
      dbReady = null;
      throw error;
    });
  }
  return dbReady;
}

function signToken(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function isAdmin(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return false;
  return token === signToken(ADMIN_PASSWORD);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: "Нужна авторизация" });
  }
  next();
}

function clean(text, max) {
  return String(text || "")
    .replace(/[\u0000-\u001F<>]/g, "")
    .trim()
    .slice(0, max);
}

function escapeTelegram(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function notifyTelegram(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { sent: false, reason: "Telegram не настроен" };
  }

  const quiz = lead.quiz
    ? Object.entries(lead.quiz)
        .map(([key, value]) => `• ${escapeTelegram(key)}: ${escapeTelegram(value)}`)
        .join("\n")
    : "нет";

  const text = [
    "<b>Новая заявка Luma</b>",
    `Источник: ${escapeTelegram(lead.source)}`,
    `Имя: ${escapeTelegram(lead.name)}`,
    `Контакт: ${escapeTelegram(lead.contact)}`,
    `Тип: ${escapeTelegram(lead.projectType || "не указан")}`,
    `Сообщение: ${escapeTelegram(lead.message || "—")}`,
    `Квиз:\n${quiz}`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram: ${details}`);
  }

  return { sent: true };
}

async function migrateLocalLeads() {
  try {
    const raw = await fs.readFile(LEADS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return;

    const existing = await listLeads(db);
    const known = new Set(existing.map((item) => item.id));
    let imported = 0;

    for (const item of parsed) {
      if (!item?.id || known.has(item.id)) continue;
      await insertLead(db, {
        id: item.id,
        createdAt: item.createdAt || new Date().toISOString(),
        name: item.name || "Без имени",
        contact: item.contact || "",
        message: item.message || "",
        projectType: item.projectType || "",
        source: item.source || "form",
        quiz: item.quiz || null,
        status: item.status || "new",
      });
      imported += 1;
    }

    if (imported) {
      console.log(`Turso: перенесено ${imported} заявок из leads.json`);
    }
  } catch {
    // локального файла может не быть
  }
}

const app = express();

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  try {
    await readyDb();
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "База Turso недоступна. Проверьте TURSO_DATABASE_URL и TURSO_AUTH_TOKEN.",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    vercel: IS_VERCEL,
    env: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      turso: Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN),
      admin: Boolean(process.env.ADMIN_PASSWORD),
    },
  });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/api/admin/session", (req, res) => {
  res.json({ ok: isAdmin(req) });
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  res.cookie(COOKIE_NAME, signToken(ADMIN_PASSWORD), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_VERCEL || process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/leads", requireAdmin, async (_req, res) => {
  try {
    const leads = await listLeads(db);
    res.json({ leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Не удалось прочитать заявки из Turso" });
  }
});

app.patch("/api/leads/:id", requireAdmin, async (req, res) => {
  const allowed = ["new", "in_progress", "closed"];
  const status = String(req.body?.status || "");
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Некорректный статус" });
  }

  try {
    const updated = await updateLeadStatus(db, req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }
    const lead = await getLead(db, req.params.id);
    res.json({ lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Не удалось обновить заявку в Turso" });
  }
});

app.post("/api/leads", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const contact = String(req.body?.contact || "").trim();
  const message = String(req.body?.message || "").trim();
  const projectType = String(req.body?.projectType || "").trim();
  const source = String(req.body?.source || "form").trim();
  const quiz = req.body?.quiz && typeof req.body.quiz === "object" ? req.body.quiz : null;

  if (name.length < 2) {
    return res.status(400).json({ error: "Укажите имя" });
  }
  if (contact.length < 5) {
    return res.status(400).json({ error: "Укажите телефон или Telegram" });
  }

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: clean(name, 80),
    contact: clean(contact, 80),
    message: clean(message, 1000),
    projectType: clean(projectType, 80),
    source: ["form", "quiz", "chat"].includes(source) ? source : "form",
    quiz,
    status: "new",
  };

  try {
    await insertLead(db, lead);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Не удалось сохранить заявку в Turso" });
  }

  let telegram = { sent: false };
  try {
    telegram = await notifyTelegram(lead);
  } catch (error) {
    telegram = { sent: false, reason: error.message };
  }

  res.status(201).json({ ok: true, id: lead.id, telegram });
});

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Не задан GEMINI_API_KEY" });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-16) : [];
  const quiz = req.body?.quiz && typeof req.body.quiz === "object" ? req.body.quiz : null;

  const contents = messages
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.text || "").slice(0, 2000) }],
    }));

  if (!contents.length) {
    return res.status(400).json({ error: "Пустое сообщение" });
  }

  const quizContext = quiz
    ? `\nОтветы квиза клиента:\n${Object.entries(quiz)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n")}`
    : "";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT + quizContext }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            thinkingConfig: { thinkingLevel: "MINIMAL" },
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || "Ошибка Gemini";
      return res.status(502).json({ error: detail });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ||
      "Сейчас не получилось ответить. Оставьте заявку — менеджер напишет сам.";

    res.json({ text });
  } catch (error) {
    res.status(502).json({ error: "Не удалось связаться с ИИ" });
  }
});

async function startLocal() {
  await readyDb();
  app.listen(PORT, () => {
    console.log(`Luma: http://localhost:${PORT}`);
    console.log("Leads store: Turso");
  });
}

if (require.main === module) {
  startLocal().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = app;
