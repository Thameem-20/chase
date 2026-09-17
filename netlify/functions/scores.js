const { getStore } = require("@netlify/blobs");

function formatTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    const store = getStore("chandana-chase-scores");
    const scores = (await store.get("all", { type: "json" })) || [];

    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(scores) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const seconds = Number(body.seconds);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 36000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid score" }) };
      }
      const message = String(body.message || "").trim().slice(0, 280);
      scores.unshift({
        seconds,
        time: formatTime(seconds),
        at: new Date().toISOString(),
        message,
      });
      const trimmed = scores.slice(0, 200);
      await store.setJSON("all", trimmed);
      return { statusCode: 200, headers, body: JSON.stringify(trimmed) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Could not read or write scores" }),
    };
  }
};
