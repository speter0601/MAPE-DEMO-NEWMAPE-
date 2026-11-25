// [터미널 5] 시연 조작기
// SDK가 심긴 시연용 자사몰(/shop/)에서 사면 주문이 자동으로 들어온다 → Enter 필요 없음
// 스마트스토어 등 SDK를 못 심는 판매처에서 샀을 때만 Enter로 주문을 연결한다
const readline = require("readline");
const { api, postEvent, stamp } = require("./common");

function help() {
  console.log("");
  console.log("──────────── MAPE 시연 조작기 ────────────");
  console.log("  [Enter]  방금 QR 클릭에 '구매 완료' 주문 연결 (SDK 없는 판매처용)");
  console.log("  c        QR 클릭 수동 기록 (폰 접속이 안 될 때 대비책)");
  console.log("  x        시연 기록만 지우기 (만든 링크, QR 클릭·주문)");
  console.log("  R        빈 계정으로 처음부터 (소개 화면부터 다시 리허설)");
  console.log("  q        종료");
  console.log("  화면 숨은 단축키: Shift+D = 첫 설정 건너뛰고 바로 대시보드");
  console.log("──────────────────────────────────────────");
}

async function order() {
  const t = await api("/api/demo-target");
  let { click } = await api(`/api/clicks/latest?slug=${t.slug}`);
  if (!click) {
    console.log(`${stamp()}  '${t.name}' QR 클릭이 없어서 클릭부터 같이 기록합니다`);
    click = await postEvent({ type: "click", slug: t.slug, source: "demo" });
  }
  const ev = await postEvent({ type: "order", slug: t.slug, clickId: click.clickId, amount: t.price, source: "demo" });
  const sec = ev.path ? Math.round((ev.path.orderTs - ev.path.clickTs) / 1000) : "?";
  console.log(`${stamp()}  ✔ 주문 연결 완료  ${t.name}  ${Number(t.price).toLocaleString()}원  (클릭 후 ${sec}초)`);
}

async function handle(key) {
  try {
    if (key === "") return await order();
    if (key === "c") {
      const t = await api("/api/demo-target");
      await postEvent({ type: "click", slug: t.slug, source: "demo" });
      return console.log(`${stamp()}  '${t.name}' QR 클릭 수동 기록`);
    }
    if (key === "x") { await api("/api/reset?mode=demo", { method: "POST" }); return console.log(`${stamp()}  시연 기록 지움`); }
    if (key === "R") { await api("/api/reset?mode=fresh", { method: "POST" }); return console.log(`${stamp()}  빈 계정으로 초기화 → 브라우저가 소개 화면으로 돌아갑니다`); }
    if (key === "q") process.exit(0);
    help();
  } catch (e) {
    console.log(`${stamp()}  실패: API 서버가 켜져 있는지 확인 (${e.cause ? e.cause.code : e.message})`);
  }
}

help();
readline.createInterface({ input: process.stdin }).on("line", (line) => handle(line.trim()));
