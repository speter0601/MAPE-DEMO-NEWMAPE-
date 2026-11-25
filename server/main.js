// 배포용 진입점: API·화면, mape_link, 목데이터를 한 프로세스·한 포트에서 실행한다
// 로컬: npm start → http://localhost:4000   배포(Render 등): 서비스가 정해주는 PORT 사용
const http = require("http");
const PORT = Number(process.env.PORT || 4000);
process.env.API_PORT = String(PORT);       // common.js 가 자기 자신(API)을 이 포트로 부르게
process.env.MAPE_SINGLE = "1";

const api = require("./api");
const link = require("./link");
const mock = require("./mock");

http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (link.owns(p)) return link.handle(req, res);
  return api.handle(req, res);
}).listen(PORT, () => {
  console.log(`MAPE 실행 중 (한 포트 모드)   http://localhost:${PORT}`);
  if (process.env.MOCK !== "0") mock.start();
});
