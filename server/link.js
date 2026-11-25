// [터미널 2] mape_link 서버 (터널로 외부에 공개되는 쪽)
//   /l/<링크>    클릭 기록 → 판매처 상품 페이지로 이동 (실제로 동작)
//   /shop/       mape SDK를 심은 시연용 가상 자사몰
//   /sdk/mape.js mape SDK 배포 파일
//   /collect     SDK가 보내는 방문·구매를 API로 전달
const http = require("http");
const fs = require("fs");
const path = require("path");
const { ROOT, LINK_PORT, API_URL, loadLinks, rid, api, postEvent, stamp } = require("./common");

const SDK_FILE = path.join(ROOT, "packages", "mape", "index.js");
const SHOP_DIR = path.join(ROOT, "web", "shop");

// 화면에서 새로 만든 링크는 API에만 있으므로 API에 먼저 묻고, API가 꺼져 있으면 파일에서 찾는다
async function resolveLink(slug) {
  try { return await api(`/api/links/${encodeURIComponent(slug)}`); }
  catch (e) { return loadLinks().find((l) => l.slug === slug) || null; }
}

function withTracking(link, clickId) {
  const relative = link.target.startsWith("/");
  const u = new URL(link.target, "http://same-host");
  u.searchParams.set("mape_cid", clickId);
  if (link.storeKey === "smartstore") {
    // 스마트스토어 NT 꼬리표
    u.searchParams.set("nt_source", "mape");
    u.searchParams.set("nt_medium", link.channel);
    u.searchParams.set("nt_detail", link.slug);
  } else {
    // 자사몰 UTM
    u.searchParams.set("utm_source", "mape");
    u.searchParams.set("utm_medium", link.channel);
    u.searchParams.set("utm_campaign", link.slug);
  }
  if (relative && link.price) u.searchParams.set("price", link.price);
  return relative ? u.pathname + u.search : u.toString();
}

function sendFile(res, file, type) {
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": type, "cache-control": "no-store", "access-control-allow-origin": "*" });
  fs.createReadStream(file).pipe(res);
}

// 이 서버가 맡는 주소인지 (배포 모드에서 API 서버와 한 포트를 나눠 쓸 때 사용)
function owns(p) {
  return /^\/l\/[\w-]+\/?$/.test(p) || p === "/sdk/mape.js" || p === "/shop" || p.startsWith("/shop/") || p === "/collect";
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  const m = p.match(/^\/l\/([\w-]+)\/?$/);

  if (m) {
    const link = await resolveLink(m[1]);
    if (!link) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("없는 mape_link 입니다");
    }
    const clickId = rid("c");
    // 기록이 실패해도 손님 이동은 절대 막지 않는다
    postEvent({ type: "click", slug: link.slug, clickId, source: "live" })
      .then(() => console.log(`${stamp()}  [실제 클릭] ${link.name}  (${clickId})`))
      .catch((e) => console.log(`${stamp()}  클릭 기록 실패, 이동은 진행: ${e.message}`));
    res.writeHead(302, { location: withTracking(link, clickId), "cache-control": "no-store" });
    return res.end();
  }

  if (p === "/sdk/mape.js") return sendFile(res, SDK_FILE, "text/javascript; charset=utf-8");
  if (p === "/shop" ) { res.writeHead(301, { location: "/shop/" + url.search }); return res.end(); }
  if (p === "/shop/") return sendFile(res, path.join(SHOP_DIR, "index.html"), "text/html; charset=utf-8");
  // 상점 이미지 (/shop/img/...)
  if (p.startsWith("/shop/img/")) {
    const full = path.join(SHOP_DIR, path.normalize(decodeURIComponent(p.slice("/shop/".length))));
    const type = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" }[path.extname(full).toLowerCase()];
    if (full.startsWith(SHOP_DIR) && type) return sendFile(res, full, type);
  }

  if (p === "/collect") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,OPTIONS", "access-control-allow-headers": "content-type" });
      return res.end();
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const r = await fetch(`${API_URL}/api/collect`, { method: "POST", headers: { "content-type": "application/json" }, body });
        res.writeHead(r.status, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(await r.text());
      } catch (e) {
        res.writeHead(502, { "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "API 연결 실패" }));
      }
    });
    return;
  }

  if (p === "/") {
    res.writeHead(302, { location: "/shop/" });
    return res.end();
  }
  res.writeHead(404);
  res.end();
}

module.exports = { handle, owns };

if (require.main === module) http.createServer(handle).listen(LINK_PORT, () => {
  console.log(`mape_link 서버 실행 중   예) http://localhost:${LINK_PORT}/l/demo`);
  console.log(`시연용 자사몰 http://localhost:${LINK_PORT}/shop/   SDK http://localhost:${LINK_PORT}/sdk/mape.js`);
});
