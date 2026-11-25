/*!
 * mape SDK v0.1.0 — mape_link 경로 수집용 판매처(자사몰) SDK
 *
 * 브라우저:  <script src="https://<mape 주소>/sdk/mape.js"></script>
 *            <script> mape.init(); </script>
 *            구매 완료 시  mape.purchase({ orderId: "A-1001", amount: 31000 });
 *
 * 번들러:    import mape from "mape";   mape.init({ endpoint: "https://<mape 주소>/collect" });
 *
 * Node(서버 포스트백):
 *            const mape = require("mape");
 *            mape.init({ endpoint: "http://localhost:4000/api/collect" });
 *            await mape.purchase({ cid: req.cookies.mape_cid, orderId, amount });
 *
 * 하는 일 3가지
 *   1. 잡기   : mape_link를 거쳐 들어온 손님의 클릭 ID(mape_cid)를 주소창에서 꺼내 30일간 보관
 *   2. 방문   : 페이지를 볼 때마다 어떤 페이지를 봤는지 전송 (자사몰 행동 수집)
 *   3. 구매   : 주문이 생기면 클릭 ID와 함께 금액을 전송 (포스트백) → 서버가 클릭과 주문을 하나의 경로로 잇는다
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.mape = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var KEY = "mape_cid";
  var TTL_DAYS = 30;
  var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  var cfg = { endpoint: null, debug: false, autoPageview: true };
  var scriptOrigin = null;

  // <script src=".../sdk/mape.js">로 불렀으면 그 주소 기준으로 전송 위치를 정한다
  if (isBrowser && document.currentScript && document.currentScript.src) {
    try { scriptOrigin = new URL(document.currentScript.src).origin; } catch (e) {}
  }

  function log() {
    if (cfg.debug && typeof console !== "undefined") console.log.apply(console, ["[mape]"].concat([].slice.call(arguments)));
  }

  // ── 1. 잡기 ──
  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function capture() {
    if (!isBrowser) return null;
    var fromUrl = null;
    try { fromUrl = new URL(window.location.href).searchParams.get(KEY); } catch (e) {}
    if (fromUrl) {
      var exp = Date.now() + TTL_DAYS * 864e5;
      try { localStorage.setItem(KEY, JSON.stringify({ cid: fromUrl, exp: exp })); } catch (e) {}
      document.cookie = KEY + "=" + encodeURIComponent(fromUrl) + "; path=/; max-age=" + TTL_DAYS * 86400 + "; SameSite=Lax";
      log("클릭 ID 저장", fromUrl);
      return fromUrl;
    }
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.exp > Date.now()) return saved.cid;
    } catch (e) {}
    return readCookie(KEY);
  }

  function getClickId() {
    return capture();
  }

  // ── 전송 ──
  function send(payload) {
    if (!cfg.endpoint) return Promise.resolve({ ok: false, reason: "mape.init()을 먼저 호출하세요" });
    payload.sdk = VERSION;
    log("전송", payload);
    if (typeof fetch === "function") {
      return fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true, // 결제 완료 후 페이지가 바로 넘어가도 전송이 끊기지 않게
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .catch(function (e) { log("전송 실패", e); return { ok: false, error: String(e) }; });
    }
    return Promise.resolve({ ok: false, reason: "fetch 없음" });
  }

  // ── 공개 API ──
  function init(options) {
    options = options || {};
    cfg.debug = !!options.debug;
    if (options.autoPageview === false) cfg.autoPageview = false;
    cfg.endpoint = options.endpoint || (scriptOrigin ? scriptOrigin + "/collect" : null);
    var cid = capture();
    log("초기화", { endpoint: cfg.endpoint, cid: cid });
    if (isBrowser && cfg.autoPageview && cid) page();
    return api;
  }

  // 2. 방문
  function page(name) {
    var cid = getClickId();
    if (!cid) return Promise.resolve({ attributed: false });
    return send({ type: "view", cid: cid, page: name || (isBrowser ? document.title || location.pathname : "") });
  }

  // 3. 구매 (포스트백)
  function purchase(order) {
    order = order || {};
    var cid = order.cid || getClickId();
    if (!cid) {
      log("mape_link로 들어온 손님이 아님 → 전송 안 함");
      return Promise.resolve({ attributed: false });
    }
    return send({ type: "purchase", cid: cid, orderId: order.orderId || null, amount: Number(order.amount) || 0 });
  }

  var api = { init: init, page: page, purchase: purchase, getClickId: getClickId, version: VERSION };
  api.default = api;
  return api;
});
