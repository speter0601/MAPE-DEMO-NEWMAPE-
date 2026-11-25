// [터미널 3] 목데이터 생성기: 연결된 광고 계정의 mape_link에만 가짜 클릭/주문을 넣는다
// 빈 계정일 때는 조용히 기다리다가, 화면에서 광고 계정을 연결하는 순간부터 숫자가 움직인다
// 실행 옵션: node server/mock.js --speed 2   (2배 빠르게)
const { api, postEvent, stamp } = require("./common");

const speedArg = process.argv.indexOf("--speed");
const SPEED = speedArg > -1 ? Number(process.argv[speedArg + 1]) || 1 : 1;
const pending = [];
let firstClick = true; // 연결 직후 경로 잇기가 바로 보이도록 첫 클릭은 무조건 주문으로 이어짐
let waiting = false;

function pick(rows) {
  const total = rows.reduce((s, r) => s + r.clicks, 0) || rows.length;
  let x = Math.random() * total;
  for (const r of rows) { x -= r.clicks || 1; if (x <= 0) return r; }
  return rows[0];
}

function amountFor(r) {
  const qty = Math.random() < 0.15 ? 2 : 1;
  return r.price * qty + (Math.random() < 0.3 ? 3000 : 0);
}

async function tick() {
  try {
    const state = await api("/api/state");
    const rows = state.rows.filter((r) => r.tracking && !r.isDemo && !r.isRuntime);
    if (!rows.length) {
      if (!waiting) console.log(`${stamp()}  mape_link 적용 대기 중 (화면에서 첫 설정 → 링크 적용을 진행하세요)`);
      waiting = true; firstClick = true;
    } else {
      if (waiting) console.log(`${stamp()}  연결 확인 → 목데이터 생성 시작`);
      waiting = false;
      const r = pick(rows);
      const ev = await postEvent({ type: "click", slug: r.slug, source: "mock" });
      const conv = r.clicks ? r.orders / r.clicks : 0.04;
      if (r.storeConnected && (firstClick || Math.random() < Math.min(0.7, conv * 6))) {
        const delay = firstClick ? 800 : 1500 + Math.random() * 2500;
        firstClick = false;
        pending.push({ due: Date.now() + delay / SPEED, r, clickId: ev.clickId });
      }
    }
  } catch (e) {
    console.log(`${stamp()}  API 연결 대기 중... (${e.cause ? e.cause.code : e.message})`);
  }
  setTimeout(tick, (1500 + Math.random() * 2500) / SPEED);
}

async function flushOrders() {
  const now = Date.now();
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    if (p.due > now) continue;
    pending.splice(i, 1);
    try { await postEvent({ type: "order", slug: p.r.slug, clickId: p.clickId, amount: amountFor(p.r), source: "mock" }); } catch (e) {}
  }
}

function start() {
  console.log(`목데이터 생성기 실행 중 (속도 x${SPEED})  — 멈추려면 Ctrl+C`);
  setInterval(flushOrders, 500);
  setTimeout(tick, 300);
}

module.exports = { start };
if (require.main === module) start();
