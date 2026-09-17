(() => {
  const KEY = "chandana-chase-scores";
  const ENDPOINTS = ["/api/scores", "/.netlify/functions/scores"];

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function readLocal() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocal(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  }

  function cleanMessage(message) {
    return String(message || "").trim().slice(0, 280);
  }

  function makeEntry(seconds, message) {
    return {
      seconds: Number(seconds),
      time: formatTime(seconds),
      at: new Date().toISOString(),
      message: cleanMessage(message),
    };
  }

  async function request(method, body) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) return data;
      } catch (_) {
        /* local file server or missing function */
      }
    }
    return null;
  }

  window.ChaseScores = {
    formatTime,
    readLocal,
    async save(seconds, message) {
      const entry = makeEntry(seconds, message);
      const local = readLocal();
      local.unshift(entry);
      writeLocal(local);
      const remote = await request("POST", { seconds: entry.seconds, message: entry.message });
      return remote || local;
    },
    async all() {
      const remote = await request("GET");
      if (remote) return { rows: remote, remote: true };
      return { rows: readLocal(), remote: false };
    },
  };
})();
