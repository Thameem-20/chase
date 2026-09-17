import { getDatabase } from "@netlify/database";

function formatTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function cleanMessage(message) {
  return String(message || "").trim().slice(0, 280);
}

function toEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    seconds: Number(row.seconds),
    time: row.time,
    message: row.message || "",
    at: row.at instanceof Date ? row.at.toISOString() : row.at,
  };
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
};

async function ensureTable(db) {
  await db.sql`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      seconds DOUBLE PRECISION NOT NULL,
      time TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function allScores(db) {
  const rows = await db.sql`SELECT * FROM scores ORDER BY at DESC LIMIT 200`;
  return rows.map(toEntry);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    const db = getDatabase();
    await ensureTable(db);

    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(await allScores(db)) };
    }

    const body = JSON.parse(event.body || "{}");

    if (event.httpMethod === "POST") {
      const seconds = Number(body.seconds);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 36000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid score" }) };
      }
      const time = formatTime(seconds);
      const message = cleanMessage(body.message);
      const inserted = await db.sql`
        INSERT INTO scores (seconds, time, message)
        VALUES (${seconds}, ${time}, ${message})
        RETURNING *
      `;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ entry: toEntry(inserted[0]), rows: await allScores(db) }),
      };
    }

    if (event.httpMethod === "PATCH") {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid id" }) };
      }
      const message = cleanMessage(body.message);
      const updated = await db.sql`
        UPDATE scores SET message = ${message} WHERE id = ${id} RETURNING *
      `;
      if (!updated[0]) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "not found" }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ entry: toEntry(updated[0]), rows: await allScores(db) }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Could not read or write scores" }),
    };
  }
}
