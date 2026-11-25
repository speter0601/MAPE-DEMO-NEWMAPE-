// mape_duo: 모든 앱 화면 오른쪽 아래 코파일럿 (화면 안내 · 근거 번호 답변 · 보고서 초안)
(function (M) {
  let open = false;
  const log = [];
  const SCREEN = [
    [/^\/app\/home$/, "오늘의 판매 흐름"], [/^\/app\/my$/, "마이페이지"], [/my\/goal/, "목표 · 광고비"], [/my\/apply/, "mape_link 적용 현황"], [/my\/sdk/, "SDK 설치"], [/connect/, "연결 관리"], [/link/, "링크"], [/collect/, "수집"], [/analysis/, "분석"],
    [/proposal/, "제안"], [/debate/, "세 관점 토론"], [/budget/, "예산 배분"], [/monitor/, "모니터링"], [/verify/, "검증"],
    [/insight/, "인사이트"], [/track/, "추적"],
  ];
  const screen = () => { const p = M.current.path; const f = SCREEN.find(([r]) => r.test(p)); return f ? f[1] : "홈"; };
  const ref = (n) => `<span class="ev">[${n}]</span>`;

  function answer(q) {
    const s = M.state, t = s.totals, E = M.engine(s);
    if (/토론|관점|페르소나/.test(q)) { setTimeout(() => M.go("#/app/home/debate"), 700); return { t: "세 관점 토론 화면을 엽니다. 성과·브랜드·실험 관점이 같은 데이터로 토론하고, 배분 보드가 대화에 맞춰 바뀝니다." }; }
    if (/링크.*만들|새 링크/.test(q)) { setTimeout(() => M.newLink(), 400); return { t: "새 mape_link 만들기 창을 엽니다. 상품 주소만 넣으면 됩니다." }; }
    if (/주문.*줄|왜.*줄|막혔|이탈/.test(q)) {
      const F = M.funnel(s);
      return { t: `가장 큰 원인은 장바구니 → 결제 시작이 ${((F[3][1] / F[2][1]) * 100).toFixed(1)}%로 막혀 있는 거예요 ${ref(1)}. 경로가 확인된 주문 ${M.num(t.orders)}건 중 대부분이 검색광고에서 왔고 ${ref(2)}, 결제 페이지에서 빠지는 비율이 가장 큽니다.`, src: "[1] 분석 · 구매 흐름  [2] 수집 · 이어진 경로", go: "#/app/analysis", report: true };
    }
    if (/주문당|광고비|비싸|올랐/.test(q)) {
      if (!E) return { t: "광고 계정을 연결하고 mape_link를 적용하면 답할 수 있어요." };
      return { t: `주문당 광고비는 ${t.orders ? M.won(t.spend / t.orders) : "-"}입니다 ${ref(1)}. ${E.top.channel}은 효율이 가장 좋지만 클릭당 비용이 최근 7일 12% 올랐습니다 ${ref(2)}. 세 관점 토론에서 이 부분이 쟁점으로 다뤄집니다.`, src: "[1] 홈 · KPI  [2] 모니터링 · 광고 위치", go: "#/app/monitor", report: true };
    }
    if (/뭐부터|오늘|요약/.test(q)) {
      return { t: `경로가 확인된 주문 ${M.num(t.orders)}건, 매출 ${M.won(t.revenue)}입니다 ${ref(1)}. ${s.lastPath ? `가장 최근 경로는 ${s.lastPath.channel} → ${s.lastPath.store} ${M.won(s.lastPath.amount)}이에요 ${ref(2)}.` : ""} 4주 데이터가 쌓였으니 제안을 열어 보세요.`, src: "[1] 홈 · KPI  [2] 홈 · 경로 잇기", go: "#/app/home/proposal", report: true };
    }
    if (/보고서|리포트/.test(q)) return { report: true, t: "이번 주 보고서 초안을 만들었어요." , draft: true };
    return { t: "화면 안내, 숫자 근거 찾기, 보고서 초안을 도와드려요. 숫자는 분석 엔진이 계산한 값만 인용합니다." };
  }

  function draft() {
    const s = M.state, t = s.totals, F = M.funnel(s), E = M.engine(s);
    return `<div class="duo-rep"><b>이번 주 보고서 초안 · ${M.esc((s.account.user || {}).shop || "")}</b><br>
      1. 경로가 확인된 주문 ${M.num(t.orders)}건 · 매출 ${M.won(t.revenue)} · 주문당 광고비 ${t.orders ? M.won(t.spend / t.orders) : "-"}<br>
      2. 막힌 곳: 장바구니 → 결제 시작 ${((F[3][1] / F[2][1]) * 100).toFixed(1)}% ${ref(1)}<br>
      3. ${E ? `예산 판정: 합의 ${M.man(E.consensus)}, 쟁점 ${E.issues.length}개 → 목표 ${s.account.goal.conv}/${s.account.goal.brand}/${s.account.goal.explore}로 판정` : "예산 판정 대기"}<br>
      4. 다음 할 일: 제안 1안 검토</div>`;
  }

  function draw() {
    const el = M.$("duo");
    const inApp = M.current && M.current.path.startsWith("/app");
    if (!inApp) { el.innerHTML = ""; return; }
    el.innerHTML = `<button class="duo-btn" id="duoBtn"><i></i>mape_duo</button>
      <div class="duo-panel ${open ? "on" : ""}">
        <div class="duo-h"><b>mape_duo</b><span class="muted" style="margin-left:8px;flex:1">지금 화면: ${screen()}</span><button id="duoX">×</button></div>
        <div class="duo-log" id="duoLog">${log.map((m) => m.u ? `<div class="u">${M.esc(m.t)}</div>`
          : `<div class="a">${m.t}${m.src ? `<div class="muted" style="margin-top:6px">숫자는 분석 엔진 계산값이에요 · ${M.esc(m.src)}</div>` : ""}
             ${m.report || m.go ? `<div style="display:flex;gap:6px;margin-top:8px">${m.go ? `<a class="btn sm" href="${m.go}">근거 보기</a>` : ""}${m.report ? `<button class="btn sm pri" data-rep>보고서 초안 만들기</button>` : ""}</div>` : ""}
             ${m.draft ? draft() : ""}</div>`).join("") ||
          `<div class="a">안녕하세요. 지금 보고 계신 <b>${screen()}</b> 화면 기준으로 도와드릴게요.</div>`}</div>
        <div class="duo-chips">${["이번 주 왜 주문이 줄었어?", "주문당 광고비 왜 올랐어?", "세 관점 토론 열어줘", "오늘 뭐부터 볼까?"].map((c) => `<button>${c}</button>`).join("")}</div>
        <form class="duo-in" id="duoF"><input placeholder="무엇이든 물어보세요" autocomplete="off"><button>보내기</button></form>
      </div>`;
    el.querySelector("#duoBtn").onclick = () => { open = !open; draw(); };
    el.querySelector("#duoX").onclick = () => { open = false; draw(); };
    const ask = (q) => { log.push({ u: 1, t: q }); log.push(answer(q)); draw(); };
    el.querySelectorAll(".duo-chips button").forEach((b) => (b.onclick = () => ask(b.textContent)));
    el.querySelectorAll("[data-rep]").forEach((b) => (b.onclick = () => { log.push({ t: "보고서 초안을 만들었어요. 인사이트 탭에 저장됩니다.", draft: true }); draw(); }));
    el.querySelector("#duoF").onsubmit = (e) => {
      e.preventDefault();
      const v = e.target.querySelector("input").value.trim();
      if (v) ask(v);
    };
    const lg = el.querySelector("#duoLog");
    lg.scrollTop = lg.scrollHeight;
  }

  // 인사이트 카드의 "mape_duo에게 묻기"
  M.askDuo = (q) => {
    open = true;
    log.push({ u: 1, t: q });
    const a = answer(q);
    log.push(a.t.startsWith("화면 안내") ? { t: `'${M.esc(q)}' 카드의 숫자는 분석 엔진이 계산한 값입니다. 카드 아래 계산 기준을 근거로 볼 수 있고, 이 질문을 제안의 근거로 보낼 수 있어요.`, go: "#/app/home/proposal", report: true } : a);
    draw();
  };

  M.onRoute = draw;
})(MAPE);
