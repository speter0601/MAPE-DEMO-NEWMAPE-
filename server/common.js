// 공통 설정과 유틸
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API_PORT = Number(process.env.API_PORT || 4000);
const LINK_PORT = Number(process.env.LINK_PORT || 4100);
const API_URL = process.env.API_URL || `http://localhost:${API_PORT}`;

// links.json은 매번 새로 읽어서, 시연 직전에 주소를 바꿔도 재시작 없이 반영되게 한다
function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "links.json"), "utf8"));
}
function loadLinks() {
  return loadConfig().links;
}

function rid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function api(pathname, opts = {}) {
  const res = await fetch(`${API_URL}${pathname}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

const postEvent = (ev) => api("/api/events", { body: ev });

function stamp() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

module.exports = { ROOT, API_PORT, LINK_PORT, API_URL, loadConfig, loadLinks, rid, api, postEvent, stamp };
