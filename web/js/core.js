// MAPE 프론트 공통: 상태(SSE), 라우터, 헤더, 모달, 토스트, 유틸
window.MAPE = (function () {
  const M = { state: null, routes: [], current: null, lastEv: null };

  // ───── 유틸 ─────
  M.$ = (id) => document.getElementById(id);
  M.won = (n) => Math.round(n || 0).toLocaleString("ko-KR") + "원";
  M.man = (n) => { const v = Math.round((n || 0) / 10000); return v.toLocaleString("ko-KR") + "만"; };
  M.num = (n) => Math.round(n || 0).toLocaleString("ko-KR");
  M.pct = (a, b, d = 1) => (b ? ((a / b) * 100).toFixed(d) + "%" : "-");
  M.hhmmss = (ts) => { const d = new Date(ts); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"); };
  M.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  M.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  M.post = async (path, body) => {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    // 계정 변경은 SSE를 기다리지 않고 바로 반영 (화면 이동 직후 경로 판단이 어긋나지 않게)
    if ((path === "/api/account" || path === "/api/quickstart") && M.state && j && "signedUp" in j) M.state.account = j;
    return j;
  };

  // 링크 주소: /shop/ 처럼 상대 주소면 mape_link 서버 기준으로 펼친다
  M.fullTarget = (t) => (t && t.startsWith("/") ? (M.state ? M.state.linkBase : "") + t : t);
  M.shortUrl = (slug) => `${M.state.linkBase}/l/${slug}`;

  M.qrSvg = (text) => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  };

  // ───── 모달·토스트 ─────
  M.openModal = (html, onMount) => {
    M.$("modalBox").innerHTML = html;
    M.$("modal").classList.add("on");
    if (onMount) onMount(M.$("modalBox"));
  };
  M.closeModal = () => M.$("modal").classList.remove("on");
  let toastTimer;
  M.toast = (title, small) => {
    const el = M.$("toast");
    el.innerHTML = `${M.esc(title)}${small ? `<small>${M.esc(small)}</small>` : ""}`;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("on"), 5000);
  };

  // ───── 라우터 ─────
  // route(pattern, { render(state, params) → html, mount(el, state, params), live, update(state, ev) })
  M.route = (pattern, def) => M.routes.push({ pattern, def });
  M.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

  function match(path) {
    for (const r of M.routes) {
      const keys = [];
      const re = new RegExp("^" + r.pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
      const m = path.match(re);
      if (m) return { def: r.def, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }

  function path() { return (location.hash || "#/").slice(1) || "/"; }

  function guard(p) {
    const a = M.state.account;
    if (p.startsWith("/app") && !a.signedUp) return "#/";
    if (p.startsWith("/setup") && !a.signedUp) return "#/signup";
    return null;
  }

  function render() {
    if (!M.state) return;
    const p = path();
    const redirect = guard(p);
    if (redirect) return M.go(redirect);
    const m = match(p) || match("/");
    M.current = { ...m, path: p };
    renderHeader();
    const view = M.$("view");
    view.innerHTML = M.frame(m.def.render(M.state, m.params));
    if (m.def.mount) m.def.mount(view, M.state, m.params);
    window.scrollTo(0, 0);
    if (M.onRoute) M.onRoute(p);
  }
  M.render = render;

  // ───── 앱 왼쪽 사이드바 (공통 흐름 / 골라 쓰는 기능) ─────
  // 상단 탭(구역)마다 왼쪽 메뉴가 바뀐다
  M.section = (p) => /^\/app\/my/.test(p) ? "my" : /^\/app\/(insight)/.test(p) ? "insight" : /^\/app\/(track|link|collect)/.test(p) ? "track" : /^\/app\/(monitor|eye)/.test(p) ? "monitor" : "home";
  const SIDES = {
    home: () => [
      ["grp", "홈"],
      ["오늘의 판매 흐름", "#/app/home", /^\/app\/home$/],
      ["sep"],
      ["분석", "#/app/analysis", /^\/app\/analysis/],
      ["sep"],
      ["제안", "#/app/home/proposal", /^\/app\/home\/proposal/],
      ["세 관점 토론", "#/app/home/debate", /^\/app\/home\/debate/],
      ["예산 배분", "#/app/home/budget", /^\/app\/home\/budget/],
      ["검증", "#/app/home/verify", /^\/app\/home\/verify/],
    ],
    insight: () => [
      ["grp", "인사이트"],
      ["전체 카드", "#/app/insight", /^\/app\/insight$/],
      ["sep"],
      ...(M.INSIGHT_CARDS || []).map(([k, l]) => [l, `#/app/insight/${k}`, new RegExp(`^/app/insight/${k}$`)]),
    ],
    track: () => [
      ["grp", "추적"],
      ["링크 목록", "#/app/track", /^\/app\/track$/],
      ["새 링크 만들기", "#/app/link", /^\/app\/link/],
      ["수집 · 경로", "#/app/collect", /^\/app\/collect/],
      ["sep"],
      ["끊긴 링크", "#/app/track/broken", /^\/app\/track\/broken/],
    ],
    my: () => [
      ["grp", "마이페이지"],
      ["계정 · 요금제", "#/app/my", /^\/app\/my$/],
      ["sep"],
      ["연결 관리", "#/app/my/connect", /^\/app\/my\/connect/],
      ["목표 · 광고비", "#/app/my/goal", /^\/app\/my\/goal/],
      ["sep"],
      ["mape_link 적용 현황", "#/app/my/apply", /^\/app\/my\/apply/],
      ["SDK 설치", "#/app/my/sdk", /^\/app\/my\/sdk/],
    ],
    monitor: () => [
      ["grp", "모니터링"],
      ["광고 위치 목록", "#/app/monitor", /^\/app\/monitor$/],
      ["sep"],
      ["grp", "현장 점검"],
      ...M.state.rows.filter((r) => r.active && r.spend > 0).map((r) => [r.channel, `#/app/eye/${r.slug}`, new RegExp(`^/app/eye/${r.slug}$`)]),
    ],
  };
  M.frame = (html) => {
    if (!M.current || !M.current.path.startsWith("/app")) return html;
    const p = M.current.path;
    const side = SIDES[M.section(p)]().map((x) => x[0] === "sep" ? `<div class="ssep"></div>` : x[0] === "grp" ? `<div class="sgrp">${x[1]}</div>`
      : `<a href="${x[1]}" class="${x[2].test(p) ? "on" : ""}">${M.esc(x[0])}</a>`).join("");
    return `<div class="appwrap"><aside class="side">${side}</aside><div class="appmain">${html}</div></div>`;
  };

  // ───── 헤더 ─────
  function renderHeader() {
    const p = M.current.path;
    const h = M.$("header");
    if (!p.startsWith("/app")) {
      const inSetup = p.startsWith("/setup") || p === "/signup";
      h.innerHTML = `<div class="hdr site-hdr">
        <a class="logo" href="#/">MAPE</a>
        <nav>${inSetup ? "" : [["features", "제품"], ["f-link", "추적"], ["f-link", "분석"], ["f-persona", "제안"], ["f-eye", "검증·모니터링"], ["pricing", "요금"]].map(([id, l]) => `<a href="javascript:void(0)" onclick="MAPE.scrollTo('${id}')">${l}</a>`).join("")}</nav>
        <div class="right">${inSetup ? `<span>${M.esc((M.state.account.user || {}).shop || "")}</span>` : (M.state.account.onboarded ? `<a class="btn sm pri" href="#/app/home">내 홈으로</a>` : `<a class="btn sm" href="#/signup">로그인</a><a class="btn sm pri" href="#/signup">무료로 시작하기</a>`)}</div>
      </div>`;
      return;
    }
    const tab = M.section(p);
    const tabs = [["home", "홈"], ["insight", "인사이트"], ["track", "추적"], ["monitor", "모니터링"], ["my", "마이페이지"]];
    h.innerHTML = `<div class="hdr">
      <a class="logo" href="#/app/home">MAPE</a>
      <nav>${tabs.map(([k, l]) => `<a href="#/app/${k}" class="${tab === k ? "on" : ""}">${l}</a>`).join("")}</nav>
      <div class="right">
        <span class="sample">예시 데이터</span>
        <span><b>${M.esc((M.state.account.user || {}).shop || "")}</b> · 스마트스토어 + 자사몰</span>
        <button class="btn sm" title="빈 계정으로 돌아가 가입·설정부터 다시 시연" onclick="MAPE.restart()">처음부터</button>
        <button class="help" title="도움말" onclick="MAPE.help()">?</button>
        <div class="conn" id="conn"><i></i><span>연결 중</span></div>
      </div></div>`;
    setConn(M.connected);
  }

  function setConn(ok) {
    M.connected = ok;
    const c = M.$("conn");
    if (!c) return;
    c.className = "conn" + (ok ? " ok" : "");
    c.querySelector("span").textContent = ok ? "실시간 연결됨" : "재연결 중";
  }

  M.scrollTo = (id) => {
    const go = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); };
    if (M.current.path !== "/") { M.go("#/"); setTimeout(go, 60); } else go();
  };

  M.restart = async () => {
    if (!confirm("빈 계정으로 돌아가 소개 화면부터 다시 시작합니다. 계속할까요?")) return;
    await M.post("/api/reset?mode=fresh");
    Object.assign(M.state.account, { signedUp: false, onboarded: false, linksApplied: false, user: null });
    location.hash = "#/";
  };
  M.help = () => M.openModal(`<h2>MAPE 도움말</h2>
    <p class="sub">셀러가 여러 판매처의 클릭과 주문을 mape_link 하나로 모아 보고, 다음 할 일을 근거와 함께 제안받는 서비스입니다.</p>
    <table class="tbl" style="margin-top:14px">
      <tr><td><b>홈</b></td><td>판매 흐름, 연결·목표, 분석, 제안부터 검증까지. 필요한 단계만 골라 쓰면 됩니다</td></tr>
      <tr><td><b>인사이트</b></td><td>질문 단위 분석 카드. 계속 갱신되는 정보 공간</td></tr>
      <tr><td><b>추적</b></td><td>mape_link 목록, 끊긴 링크 점검</td></tr>
      <tr><td><b>모니터링</b></td><td>광고 위치 목록, 현장 점검(mape_eye)</td></tr>
    </table>
    <div class="modal-actions"><button class="btn pri" onclick="MAPE.closeModal()">확인</button></div>`);

  // ───── 실시간 연결 ─────
  function connect() {
    const es = new EventSource("/api/stream");
    es.addEventListener("update", (m) => {
      const { ev, state } = JSON.parse(m.data);
      if (!state.linkBase) state.linkBase = location.origin; // 배포 모드: 지금 접속한 주소가 곧 링크 주소
      const first = !M.state;
      const prev = M.state;
      M.state = state;
      M.lastEv = ev;
      if (first) return render();
      // 리셋 등으로 계정 상태가 바뀌면 경로 다시 판단
      if (prev.account.signedUp !== state.account.signedUp) return render();
      const def = M.current && M.current.def;
      if (def && def.live) {
        const view = M.$("view");
        view.innerHTML = M.frame(def.render(state, M.current.params, ev));
        if (def.mount) def.mount(view, state, M.current.params);
      } else if (def && def.update) {
        def.update(state, ev);
      }
      if (ev && ev.type === "order" && ev.source !== "mock" && M.current.path.startsWith("/app")) {
        M.toast("실시간 주문이 mape_link 분석에 포함됐습니다", `${ev.name} · ${M.won(ev.amount)} · ${ev.source === "sdk" ? "mape SDK가 자동 전송" : "클릭과 주문이 하나의 경로로 연결됨"}`);
      }
      if (M.onState) M.onState(state, ev);
    });
    es.onopen = () => setConn(true);
    es.onerror = () => setConn(false);
  }

  M.start = () => {
    window.addEventListener("hashchange", render);
    M.$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") M.closeModal(); });
    // 숨은 단축키 Shift+D: 첫 설정 건너뛰고 대시보드로
    document.addEventListener("keydown", async (e) => {
      if (!e.shiftKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === "D") { await M.post("/api/quickstart"); M.go("#/app/home"); }
      // Shift+O: 방금 QR 클릭에 주문 연결 (SDK 없는 판매처용) · Shift+C: QR 클릭 수동 기록
      if (e.key === "O") await M.post("/api/demo/order");
      if (e.key === "C") { await M.post("/api/demo/click"); M.toast("QR 클릭을 수동으로 기록했습니다"); }
    });
    connect();
  };

  return M;
})();
