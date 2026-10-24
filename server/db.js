const { createClient } = require("@libsql/client");

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Задайте TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в .env");
  }
  return createClient({ url, authToken });
}

async function ensureSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      project_type TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'form',
      quiz_json TEXT,
      status TEXT NOT NULL DEFAULT 'new'
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC)
  `);
}

function rowToLead(row) {
  let quiz = null;
  if (row.quiz_json) {
    try {
      quiz = JSON.parse(row.quiz_json);
    } catch {
      quiz = null;
    }
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    contact: row.contact,
    message: row.message || "",
    projectType: row.project_type || "",
    source: row.source || "form",
    quiz,
    status: row.status || "new",
  };
}

async function listLeads(db) {
  const result = await db.execute(
    "SELECT * FROM leads ORDER BY created_at DESC"
  );
  return result.rows.map(rowToLead);
}

async function getLead(db, id) {
  const result = await db.execute({
    sql: "SELECT * FROM leads WHERE id = ?",
    args: [id],
  });
  if (!result.rows.length) return null;
  return rowToLead(result.rows[0]);
}

async function insertLead(db, lead) {
  await db.execute({
    sql: `INSERT INTO leads
      (id, created_at, name, contact, message, project_type, source, quiz_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      lead.id,
      lead.createdAt,
      lead.name,
      lead.contact,
      lead.message,
      lead.projectType,
      lead.source,
      lead.quiz ? JSON.stringify(lead.quiz) : null,
      lead.status,
    ],
  });
}

async function updateLeadStatus(db, id, status) {
  const result = await db.execute({
    sql: "UPDATE leads SET status = ? WHERE id = ?",
    args: [status, id],
  });
  return Number(result.rowsAffected || 0) > 0;
}

module.exports = {
  getDb,
  ensureSchema,
  listLeads,
  getLead,
  insertLead,
  updateLeadStatus,
};
