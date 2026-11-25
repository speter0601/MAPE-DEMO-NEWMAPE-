// [터미널 1] API 서버: 계정·연결 상태, 클릭/주문 저장, SSE 실시간 전송, 웹 화면 제공
const http = require("http");
const fs = require("fs");
const path = require("path");
const { ROOT, API_PORT, LINK_PORT, loadConfig, rid, stamp } = require("./common");

const WEB = path.join(ROOT, "web");
const SINGLE = process.env.MAPE_SINGLE === "1"; // server/main.js 로 한 포트에서 다 돌릴 때
const PUBLIC_BASE = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};
const STORE_LABEL = { smartstore: "스마트스토어", cafe24: "자사몰" };
const SOURCES = {
  smartstore: { kind: "store", label: "네이버 스마트스토어" },
  cafe24: { kind: "store", label: "자사몰 (카페24)" },
  meta: { kind: "ad", label: "메타 광고 (인스타그램)" },
  naver: { kind: "ad", label: "네이버 검색광고" },
  kakao: { kind: "ad", label: "카카오채널" },
};

// ───── 상태 ─────
function freshAccount() {
  return {
    signedUp: false, onboarded: false, user: null, situation: null,
    linksApplied: false, // 셀러가 광고 도착 주소를 mape_link로 바꿨는지 (바꾼 뒤 4주가 지난 시점으로 시연)
    connections: { smartstore: false, cafe24: false, meta: false, naver: false, kakao: false },
    goal: { conv: 60, brand: 30, explore: 10 }, budget: 3000000,
  };
}
let account = freshAccount();
let events = [];          // 서버가 켜진 뒤 들어온 이벤트 (mock / live / demo)
let runtimeLinks = [];    // 화면에서 새로 만든 mape_link
let publicUrl = "";       // 터널이 자동 등록
const clients = new Set();

function allLinks() {
  return [...loadConfig().links, ...runtimeLinks];
}
function findLink(slug) {
  return allLinks().find((l) => l.slug === slug);
}

// 서버 시작 전 30일간 쌓였다고 가정하는 누적치
function baseline(l) {
  if (l.isDemo || l.isRuntime) return { clicks: 0, orders: 0, revenue: 0 };
  const clicks = (l.weight || 1) * 173;
  const orders = Math.round(clicks * (l.conv || 0.03));
  return { clicks, orders, revenue: orders * l.price };
}

function rowFor(l) {
  const c = account.connections;
  const adOn = l.adSource ? !!c[l.adSource] : false;
  const storeOn = !!c[l.storeKey];
  // 링크를 광고에 적용해야 클릭이 mape_link를 거친다 → 그 전에는 경로 데이터 0
  const tracking = adOn && account.linksApplied;
  const b = baseline(l);
  const mine = events.filter((e) => e.slug === l.slug);
  const clickEvs = mine.filter((e) => e.type === "click");
  const orderEvs = mine.filter((e) => e.type === "order");
  const views = mine.filter((e) => e.type === "view").length;
  const clicks = (tracking ? b.clicks : 0) + clickEvs.length;
  const orders = (tracking && storeOn ? b.orders : 0) + orderEvs.length;
  const revenue = (tracking && storeOn ? b.revenue : 0) + orderEvs.reduce((s, e) => s + (e.amount || 0), 0);
  const visible = l.isRuntime || (l.isDemo && clickEvs.length > 0) || adOn;
  return {
    slug: l.slug, name: l.name, channel: l.channel, target: l.target, price: l.price,
    store: STORE_LABEL[l.storeKey] || l.storeKey, storeKey: l.storeKey, adSource: l.adSource || null,
    isDemo: !!l.isDemo, isRuntime: !!l.isRuntime, createdAt: l.createdAt || null,
    active: adOn, tracking, storeConnected: storeOn, visible,
    spend: adOn ? l.spend || 0 : 0, clicks, orders, revenue,
    impressions: l.ctr ? Math.round(clicks / l.ctr) : null, ctr: l.ctr || null, brand: l.brand || 1,
    views,
    liveClicks: clickEvs.filter((e) => e.source !== "mock").length,
  };
}

// 연결 화면에 보여줄 "불러온 데이터" 요약
function importSummary(key) {
  const links = loadConfig().links.filter((l) => !l.isDemo);
  if (SOURCES[key].kind === "store") {
    const mine = links.filter((l) => l.storeKey === key);
    const orders = mine.reduce((s, l) => s + baseline(l).orders, 0) + (key === "smartstore" ? 412 : 187);
    return { orders, text: `지난 30일 주문 ${orders.toLocaleString()}건` };
  }
  const mine = links.filter((l) => l.adSource === key);
  const spend = mine.reduce((s, l) => s + (l.spend || 0), 0);
  return { creatives: mine.length, spend, text: `광고 소재 ${mine.length}개 · 광고비 ${spend.toLocaleString()}원 → mape_link ${mine.length}개 생성 (적용 대기)` };
}

function buildState() {
  const rows = allLinks().map(rowFor);
  const shown = rows.filter((r) => r.visible);
  const totals = shown.reduce(
    (t, r) => ({ clicks: t.clicks + r.clicks, orders: t.orders + r.orders, revenue: t.revenue + r.revenue, spend: t.spend + r.spend }),
    { clicks: 0, orders: 0, revenue: 0, spend: 0 }
  );
  // 판매처에서 불러온 전체 주문 (경로 확인 여부와 무관)
  const storeOrders = Object.keys(SOURCES).filter((k) => SOURCES[k].kind === "store" && account.connections[k])
    .reduce((s, k) => s + importSummary(k).orders, 0) + events.filter((e) => e.type === "order").length;
  const withPath = [...events].reverse().filter((e) => e.type === "order" && e.path);
  const lastPathEv = withPath.find((e) => e.source !== "mock") || withPath[0];
  const cfg = loadConfig();
  return {
    account, rows: shown, totals, storeOrders,
    recent: events.slice(-40).reverse(),
    paths: withPath.slice(0, 30).map((e) => e.path),
    lastPath: lastPathEv ? lastPathEv.path : null,
    // 배포(한 프로세스) 모드에서는 비워 두면 화면이 자기 주소(location.origin)를 쓴다
    linkBase: (PUBLIC_BASE || cfg.publicUrl || publicUrl || (SINGLE ? "" : `http://localhost:${LINK_PORT}`)).replace(/\/$/, ""),
    tunnel: !!(PUBLIC_BASE || cfg.publicUrl || publicUrl || SINGLE),
    demoProduct: cfg.demoProduct,
    sources: Object.fromEntries(Object.keys(SOURCES).map((k) => [k, { ...SOURCES[k], summary: importSummary(k) }])),
  };
}

function broadcast(ev) {
  const payload = `event: update\ndata: ${JSON.stringify({ ev, state: buildState() })}\n\n`;
  for (const res of clients) res.write(payload);
}

function addEvent(body) {
  const link = findLink(body.slug);
  if (!link) throw new Error(`없는 링크: ${body.slug}`);
  if (!["click", "order", "view"].includes(body.type)) throw new Error(`잘못된 type: ${body.type}`);
  const ev = {
    id: rid(body.type === "click" ? "evc" : "evo"), type: body.type,
    slug: link.slug, name: link.name, channel: link.channel, store: STORE_LABEL[link.storeKey] || link.storeKey,
    source: body.source || "mock", ts: Date.now(), clickId: body.clickId || null,
  };
  if (body.orderId) ev.orderId = String(body.orderId).slice(0, 60);
  if (body.page) ev.page = String(body.page).slice(0, 120);
  if (ev.type === "click" && !ev.clickId) ev.clickId = rid("c");
  if (ev.type === "order") {
    ev.amount = Number(body.amount || link.price);
    // 잇기: 주문에 클릭 ID가 붙어 오면, 그 클릭과 하나의 경로로 묶는다
    const click = ev.clickId && events.find((e) => e.type === "click" && e.clickId === ev.clickId);
    if (click) {
      ev.path = {
        clickId: click.clickId, slug: link.slug, name: link.name, channel: link.channel, store: ev.store,
        clickTs: click.ts, orderTs: ev.ts, amount: ev.amount, source: ev.source,
      };
    }
  }
  events.push(ev);
  if (events.length > 5000) events = events.slice(-5000);
  return ev;
}

function createLink(body) {
  const name = String(body.name || "").trim() || "새_mape_link";
  let target;
  const raw = String(body.target || "").trim();
  if (raw.startsWith("/")) target = raw; // 같은 서버의 시연용 자사몰(/shop/)
  else { try { target = new URL(raw).toString(); } catch (e) { throw new Error("상품 주소가 올바르지 않습니다"); } }
  const storeKey = body.storeKey === "cafe24" ? "cafe24" : "smartstore";
  const n = runtimeLinks.length + 1;
  const slug = "m" + Math.random().toString(36).slice(2, 6);
  const link = {
    slug, name, channel: body.channel || "QR 코드", adSource: null, storeKey, target,
    price: Number(body.price) || 0, spend: 0, isRuntime: true, createdAt: Date.now(), order: n,
  };
  runtimeLinks.push(link);
  return link;
}

// ───── HTTP ─────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
}
const TAG = { mock: "목업", live: "실제", demo: "시연", sdk: "SDK" };

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" });
    return res.end();
  }
  try {
    if (req.method === "GET" && p === "/api/stream") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
      res.write(`event: update\ndata: ${JSON.stringify({ ev: null, state: buildState() })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "GET" && p === "/api/state") return json(res, 200, buildState());

    if (req.method === "GET" && p.startsWith("/api/links/")) {
      const link = findLink(decodeURIComponent(p.slice("/api/links/".length)));
      return link ? json(res, 200, link) : json(res, 404, { error: "없는 링크" });
    }
    if (req.method === "POST" && p === "/api/links") {
      const link = createLink(await readBody(req));
      console.log(`${stamp()}  [링크 생성] ${link.name}  /l/${link.slug}`);
      broadcast(null);
      return json(res, 201, link);
    }
    // 시연 조작기가 주문을 붙일 링크: 화면에서 가장 최근에 만든 링크, 없으면 links.json의 demo
    if (req.method === "GET" && p === "/api/demo-target") {
      const l = runtimeLinks[runtimeLinks.length - 1] || findLink("demo");
      return json(res, 200, { slug: l.slug, name: l.name, price: l.price });
    }
    if (req.method === "GET" && p === "/api/clicks/latest") {
      const slug = url.searchParams.get("slug");
      const ev = [...events].reverse().find((e) => e.type === "click" && e.slug === slug && e.source !== "mock");
      return json(res, 200, { click: ev || null });
    }
    if (req.method === "POST" && p === "/api/events") {
      const ev = addEvent(await readBody(req));
      console.log(`${stamp()}  [${TAG[ev.source] || ev.source}] ${ev.type === "click" ? "클릭" : "주문"}  ${ev.name}${ev.amount ? "  " + ev.amount.toLocaleString() + "원" : ""}${ev.path ? "  ← 클릭과 연결됨" : ""}`);
      broadcast(ev);
      return json(res, 201, ev);
    }
    // mape SDK 수집 엔드포인트: 자사몰에 심은 mape.js가 방문·구매를 보낸다
    if (req.method === "POST" && p === "/api/collect") {
      const b = await readBody(req);
      const click = b.cid && events.find((e) => e.type === "click" && e.clickId === b.cid);
      if (!click) return json(res, 202, { attributed: false, reason: "mape_link 클릭 ID 없음" });
      if (b.type === "purchase") {
        if (b.orderId && events.some((e) => e.type === "order" && e.orderId === String(b.orderId))) return json(res, 200, { attributed: true, duplicate: true });
        const ev = addEvent({ type: "order", slug: click.slug, clickId: click.clickId, amount: b.amount, orderId: b.orderId, source: "sdk" });
        console.log(`${stamp()}  [SDK] 주문 수신  ${ev.name}  ${ev.amount.toLocaleString()}원  ← 클릭과 연결됨`);
        broadcast(ev);
        return json(res, 201, { attributed: true, event: ev });
      }
      const ev = addEvent({ type: "view", slug: click.slug, clickId: click.clickId, page: b.page, source: "sdk" });
      console.log(`${stamp()}  [SDK] 방문  ${ev.name}  ${ev.page || ""}`);
      broadcast(ev);
      return json(res, 201, { attributed: true });
    }
    // 시연 조작 (터미널 시연 조작기와 같은 동작을 화면 버튼·단축키에서도 쓰도록)
    if (req.method === "POST" && (p === "/api/demo/order" || p === "/api/demo/click")) {
      const l = runtimeLinks[runtimeLinks.length - 1] || findLink("demo");
      if (p === "/api/demo/click") {
        const ev = addEvent({ type: "click", slug: l.slug, source: "demo" });
        broadcast(ev);
        return json(res, 201, ev);
      }
      let click = [...events].reverse().find((e) => e.type === "click" && e.slug === l.slug && e.source !== "mock");
      if (!click) { click = addEvent({ type: "click", slug: l.slug, source: "demo" }); broadcast(click); }
      const ev = addEvent({ type: "order", slug: l.slug, clickId: click.clickId, amount: l.price, source: "demo" });
      console.log(`${stamp()}  [시연] 주문 연결  ${ev.name}  ${ev.amount.toLocaleString()}원`);
      broadcast(ev);
      return json(res, 201, ev);
    }
    if (req.method === "POST" && p === "/api/account") {
      const b = await readBody(req);
      for (const k of ["signedUp", "onboarded", "user", "situation", "budget", "linksApplied"]) if (k in b) account[k] = b[k];
      if (b.goal) account.goal = { ...account.goal, ...b.goal };
      broadcast(null);
      return json(res, 200, account);
    }
    if (req.method === "POST" && p === "/api/connect") {
      const { key, on = true } = await readBody(req);
      if (!SOURCES[key]) throw new Error(`없는 연결: ${key}`);
      account.connections[key] = !!on;
      console.log(`${stamp()}  [연결] ${SOURCES[key].label} ${on ? "연결됨" : "해제"}`);
      broadcast(null);
      return json(res, 200, { key, summary: importSummary(key) });
    }
    // 숨은 단축키: 온보딩 건너뛰고 모든 연결 완료 상태로
    if (req.method === "POST" && p === "/api/quickstart") {
      account.signedUp = true; account.onboarded = true; account.linksApplied = true;
      account.user = account.user || { email: "seller@mape.kr", shop: "순우리 스토어" };
      account.situation = account.situation || "multi";
      Object.keys(account.connections).forEach((k) => (account.connections[k] = true));
      console.log(`${stamp()}  [바로 시작] 모든 연결 완료 상태로 전환`);
      broadcast(null);
      return json(res, 200, account);
    }
    if (req.method === "POST" && p === "/api/config") {
      const b = await readBody(req);
      if (typeof b.publicUrl === "string") publicUrl = b.publicUrl;
      console.log(`${stamp()}  [터널] 공개 주소 등록: ${publicUrl}`);
      broadcast(null);
      return json(res, 200, { publicUrl });
    }
    if (req.method === "POST" && p === "/api/reset") {
      const mode = url.searchParams.get("mode") || "all";
      if (mode === "demo") {
        const demoSlugs = new Set(["demo", ...runtimeLinks.map((l) => l.slug)]);
        events = events.filter((e) => !demoSlugs.has(e.slug));
        runtimeLinks = [];
      } else if (mode === "fresh") {
        events = []; runtimeLinks = []; account = freshAccount();
      } else {
        events = [];
      }
      console.log(`${stamp()}  초기화 (${{ demo: "시연 기록만", fresh: "빈 계정으로", all: "이벤트 전체" }[mode]})`);
      broadcast(null);
      return json(res, 200, { ok: true, mode });
    }
    // 정적 파일
    if (req.method === "GET") {
      const file = p === "/" ? "index.html" : p.endsWith("/") ? p.slice(1) + "index.html" : p.slice(1);
      const full = path.join(WEB, path.normalize(file));
      if (full.startsWith(WEB) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { "content-type": MIME[path.extname(full)] || "application/octet-stream", "cache-control": "no-store" });
        return fs.createReadStream(full).pipe(res);
      }
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 400, { error: e.message });
  }
}

setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 15000);

module.exports = { handle };

if (require.main === module) {
  http.createServer(handle).listen(API_PORT, () => {
    console.log(`MAPE API 실행 중   화면 → http://localhost:${API_PORT}`);
    console.log(`빈 계정 상태로 시작합니다 (소개 화면 → 가입 → 첫 설정)`);
  });
}
