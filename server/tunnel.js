// [터미널 4] 터널: mape_link 서버(4100)를 폰에서 접속할 수 있는 https 주소로 공개
// 주소가 뜨면 API에 자동 등록 → 화면의 링크와 QR이 그 주소로 바뀐다
const { spawn } = require("child_process");
const { LINK_PORT, api, stamp } = require("./common");

const bin = process.env.CLOUDFLARED || "cloudflared";
const child = spawn(bin, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${LINK_PORT}`]);
let registered = false;

child.on("error", () => {
  console.log("cloudflared가 설치되어 있지 않습니다.");
  console.log("  설치: brew install cloudflared");
  console.log("  설치 후 이 터미널에서: node server/tunnel.js");
  console.log("(노트북 안에서만 리허설할 때는 터널 없이도 됩니다)");
});

function scan(buf) {
  const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || registered) return;
  registered = true;
  const url = m[0];
  console.log("");
  console.log(`${stamp()}  공개 주소: ${url}`);
  console.log(`           폰 시연 링크는 화면의 '새 mape_link 만들기'에서 QR로 확인`);
  // 터널이 실제로 열리기까지 몇 초 걸려서 조금 기다렸다 등록
  const tryRegister = (n) =>
    api("/api/config", { body: { publicUrl: url } })
      .then(() => console.log(`${stamp()}  화면에 공개 주소 등록 완료`))
      .catch(() => n > 0 && setTimeout(() => tryRegister(n - 1), 2000));
  setTimeout(() => tryRegister(10), 1500);
}
child.stdout.on("data", scan);
child.stderr.on("data", scan);
child.on("exit", (code) => code && console.log(`터널 종료 (코드 ${code}). 다시 열려면: node server/tunnel.js`));
