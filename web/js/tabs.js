// 인사이트 · 추적 · 모니터링 탭
(function (M) {
  function hbars(list, fmt) {
    if (!list.length) return `<div class="empty" style="min-height:100px">데이터 대기 중</div>`;
    const max = Math.max(...list.map((x) => x.v)) || 1;
    return `<div class="bars">${list.map((x) => `<div class="bar" title="${M.esc(x.l)}: ${fmt(x.v)}"><span class="lb">${M.esc(x.l)}</span>
      <div class="track"><div class="fill" style="width:${(x.v / max) * 100}%"></div></div><span class="n">${fmt(x.v)}</span></div>`).join("")}</div>`;
  }

  // ───── 인사이트: 질문 단위 카드 (계속 갱신되는 정보 공간) ─────
  const F = (M.insightFilter = M.insightFilter || { period: "4w", store: "all" });
  const PERIOD = { "4w": ["지난 4주", 1], "1w": ["지난 7일", 0.27], "1d": ["오늘", 0.042] };
  const extraCards = (M.insightExtra = M.insightExtra || []);
  // 결정적 의사난수 (새로고침해도 같은 모양)
  const rnd = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

  function scoped(state) {
    const k = PERIOD[F.period][1];
    const rows = state.rows.filter((r) => r.clicks && (F.store === "all" || r.storeKey === F.store));
    // 기간 필터: 누적치를 기간 비율로 줄이되, 서버 켠 뒤 실제로 들어온 현장·SDK 주문은 그대로 더한다
    return rows.map((r) => {
      const live = state.recent.filter((e) => e.slug === r.slug && e.source !== "mock");
      const liveOrders = live.filter((e) => e.type === "order");
      const base = (v) => Math.round(v * k);
      return { ...r, clicks: Math.max(base(r.clicks), live.filter((e) => e.type === "click").length), orders: Math.max(base(r.orders), liveOrders.length),
        revenue: Math.max(base(r.revenue), liveOrders.reduce((s, e) => s + e.amount, 0)), spend: base(r.spend) };
    });
  }

  function hbars(list, fmt, opt = {}) {
    if (!list.length) return `<div class="empty" style="min-height:100px">데이터 대기 중</div>`;
    const max = Math.max(...list.map((x) => x.v)) || 1;
    return `<div class="bars">${list.map((x) => `<div class="bar" title="${M.esc(x.l)}: ${fmt(x.v)}"><span class="lb">${M.esc(x.l)}</span>
      <div class="track"><div class="fill" style="width:${(x.v / max) * 100}%;${x.hl ? "background:var(--accent)" : ""}"></div></div><span class="n">${fmt(x.v)}</span></div>`).join("")}</div>`;
  }

  // 4주 주간 매출 (막대 · 크기 고정)
  function weekly(rows, state) {
    const tot = rows.reduce((s, r) => s + r.revenue, 0);
    const w = [0.21, 0.235, 0.26, 0.295].map((f, i) => Math.round(tot * f * (0.97 + rnd(i + 3) * 0.06)));
    w[3] += state.recent.filter((e) => e.type === "order" && e.source !== "mock").reduce((s, e) => s + e.amount, 0);
    const max = Math.max(...w) || 1;
    const labels = ["4주 전", "3주 전", "2주 전", "이번 주"];
    return `<div class="cols">${w.map((v, i) => `<div class="col" title="${labels[i]} 매출 ${M.won(v)}">
        <span class="cv">${M.man(v)}</span>
        <div class="cb ${i === 3 ? "now" : ""}" style="height:${Math.max(4, (v / max) * 100)}%"></div>
        <span class="cl">${labels[i]}</span><span class="cd">${i ? (v >= w[i - 1] ? "▲ " : "▼ ") + Math.abs(Math.round((v / w[i - 1] - 1) * 100)) + "%" : ""}</span></div>`).join("")}</div>`;
  }

  // 요일×시간대 주문 히트맵
  function heat(orders) {
    const days = ["월", "화", "수", "목", "금", "토", "일"], slots = ["0-6시", "6-9시", "9-12시", "12-15시", "15-18시", "18-21시", "21-24시"];
    const shape = [0.2, 0.5, 0.8, 1.0, 0.8, 1.3, 1.6];
    const cells = days.map((d, i) => slots.map((s, j) => shape[j] * (i >= 5 ? (j >= 5 ? 1.25 : 0.9) : 1) * (0.8 + rnd(i * 7 + j) * 0.4)));
    const sum = cells.flat().reduce((a, b) => a + b, 0), max = Math.max(...cells.flat());
    let best = [0, 0];
    cells.forEach((r, i) => r.forEach((v, j) => { if (v > cells[best[0]][best[1]]) best = [i, j]; }));
    const html = `<table class="heat"><tr><th></th>${slots.map((s) => `<th>${s}</th>`).join("")}</tr>
      ${days.map((d, i) => `<tr><th>${d}</th>${cells[i].map((v, j) => { const n = Math.round((v / sum) * orders); const a = v / max;
        return `<td style="background:rgba(19,130,79,${(0.08 + a * 0.85).toFixed(2)});color:${a > 0.55 ? "#fff" : "var(--ink)"}" title="${d} ${slots[j]} 주문 ${n}건">${n}</td>`; }).join("")}</tr>`).join("")}</table>`;
    return { html, best: `${days[best[0]]}요일 ${slots[best[1]]}` };
  }

  // 광고비 효율: 위치별 광고비 · 매출 · ROAS 막대
  function roasTable(list) {
    if (!list.length) return `<div class="empty" style="min-height:100px">광고비 데이터 대기 중</div>`;
    const max = Math.max(...list.map((c) => c.v), 1);
    return `<table class="tbl rtbl"><thead><tr><th>광고 위치</th><th class="r">광고비</th><th class="r">매출</th><th style="width:42%">ROAS</th></tr></thead><tbody>
      ${list.map((c) => `<tr><td class="nm">${M.esc(c.l)}</td><td class="r">${M.man(c.s)}</td><td class="r">${M.man(c.rev)}</td>
        <td><div class="rbar"><div class="rfill ${c.v < 1 ? "bad" : ""}" style="width:${(c.v / max) * 100}%"></div><b>${c.v.toFixed(1)}배</b></div></td></tr>`).join("")}
    </tbody></table>`;
  }

  // 매체 × 판매처 교차표
  function cross(rows) {
    const ch = {}, stores = ["스마트스토어", "자사몰"];
    rows.forEach((r) => { (ch[r.channel] = ch[r.channel] || { 스마트스토어: 0, 자사몰: 0 })[r.store] += r.orders; });
    const max = Math.max(1, ...Object.values(ch).flatMap((o) => stores.map((s) => o[s])));
    return `<table class="heat cross"><tr><th>클릭한 곳 ＼ 산 곳</th>${stores.map((s) => `<th>${s}</th>`).join("")}</tr>
      ${Object.entries(ch).map(([c, o]) => `<tr><th>${M.esc(c)}</th>${stores.map((s) => { const a = o[s] / max;
        return `<td style="background:rgba(19,130,79,${(0.06 + a * 0.85).toFixed(2)});color:${a > 0.55 ? "#fff" : "var(--ink)"}">${o[s] ? M.num(o[s]) + "건" : "—"}</td>`; }).join("")}</tr>`).join("")}</table>`;
  }

  const card = (q, a, body, foot, opt = {}) => `<div class="card qcard ${opt.wide ? "wide" : ""}">
    <div class="q">${q}</div><div class="a">${a}</div>${body}
    <div class="qfoot"><span>${foot}</span><button class="btn sm" onclick="MAPE.askDuo(${M.esc(JSON.stringify(q))})">mape_duo에게 묻기</button></div></div>`;

  const EXTRA = {
    newret: { q: "신규 고객과 재구매 고객, 누가 더 사나?", make: (rows) => {
      const o = rows.reduce((s, r) => s + r.orders, 0), ret = Math.round(o * 0.23);
      return card("신규 고객과 재구매 고객, 누가 더 사나?", `주문의 <b>${M.pct(ret, o, 0)}</b>가 재구매 고객입니다. 재구매 고객 객단가가 1.4배 높습니다.`,
        `<div class="stack"><div style="flex:${o - ret};background:#1D2420">신규 ${M.num(o - ret)}건</div><div style="flex:${ret};background:#23A04A">재구매 ${M.num(ret)}건</div></div>`, "판매처 주문의 구매자 식별값 기준 (개인정보는 저장하지 않음)"); } },
    coupon: { q: "쿠폰을 쓴 주문은 어느 매체에서 왔나?", make: (rows) => {
      const list = rows.filter((r) => r.orders).map((r, i) => ({ l: r.channel, v: Math.round(r.orders * (0.1 + rnd(i + 40) * 0.35)) })).sort((a, b) => b.v - a.v);
      return card("쿠폰을 쓴 주문은 어느 매체에서 왔나?", list[0] ? `<b>${M.esc(list[0].l)}</b>에서 온 주문이 쿠폰을 가장 많이 썼습니다. 할인 의존도가 높은 유입입니다.` : "주문 대기 중",
        hbars(list, (v) => v + "건"), "판매처 주문의 할인 금액 필드 기준"); } },
    aov: { q: "매체별 객단가는 얼마나 다른가?", make: (rows) => {
      const ch = {}; rows.forEach((r) => { const c = (ch[r.channel] = ch[r.channel] || { o: 0, rev: 0 }); c.o += r.orders; c.rev += r.revenue; });
      const list = Object.entries(ch).filter(([, c]) => c.o).map(([l, c]) => ({ l, v: c.rev / c.o })).sort((a, b) => b.v - a.v);
      return card("매체별 객단가는 얼마나 다른가?", list[0] ? `객단가는 <b>${M.esc(list[0].l)}</b>가 ${M.won(list[0].v)}로 가장 높습니다.` : "주문 대기 중", hbars(list, (v) => M.man(v) + "원"), "매출 ÷ 주문 수"); } },
  };

  const BASE_CARDS = [["links", "소재별 주문"], ["trend", "매출 추이"], ["roas", "광고비 효율"], ["time", "주문 시간대"], ["cross", "매체 × 판매처"], ["repurchase", "재구매"], ["sdk", "자사몰 행동"]];
  const EXTRA_LABEL = { newret: "신규 vs 재구매", coupon: "쿠폰 주문", aov: "매체별 객단가" };
  const syncCards = () => (M.INSIGHT_CARDS = [...BASE_CARDS, ...extraCards.map((k) => [k, EXTRA_LABEL[k]])]);
  syncCards();

  const insightDef = {
    live: true,
    render(state, params) {
      const only = params && params.key;
      const rows = scoped(state);
      const orders = rows.reduce((s, r) => s + r.orders, 0), rev = rows.reduce((s, r) => s + r.revenue, 0), spend = rows.reduce((s, r) => s + r.spend, 0), clicks = rows.reduce((s, r) => s + r.clicks, 0);
      const byLink = [...rows].sort((a, b) => b.orders - a.orders);
      const top = byLink[0];
      const ch = {};
      rows.filter((r) => r.spend > 0).forEach((r) => { const c = (ch[r.channel] = ch[r.channel] || { s: 0, rev: 0 }); c.s += r.spend; c.rev += r.revenue; });
      const roas = Object.entries(ch).map(([l, c]) => ({ l, s: c.s, rev: c.rev, v: c.rev / c.s })).sort((a, b) => b.v - a.v);
      const H = heat(orders);
      const sdk = rows.filter((r) => r.storeKey === "cafe24").reduce((s, r) => s + r.views, 0);
      const crossShare = (() => { const ig = rows.filter((r) => /인스타/.test(r.channel)); const o = ig.reduce((s, r) => s + r.orders, 0); const own = ig.filter((r) => r.storeKey === "cafe24").reduce((s, r) => s + r.orders, 0); return o ? Math.round((own / o) * 100) : 0; })();
      const linkTbl = `<table class="tbl"><thead><tr><th>소재 (mape_link)</th><th class="r">클릭률</th><th class="r">클릭</th><th class="r">주문</th><th class="r">전환율</th><th class="r">객단가</th><th>추이</th></tr></thead><tbody>
        ${byLink.slice(0, 7).map((r, i) => { const sp = [0, 1, 2, 3, 4, 5, 6].map((d) => 0.6 + rnd(i * 10 + d) * 0.8 + (r.cvr || 0));
          const mx = Math.max(...sp); const path = sp.map((v, d) => `${d * 12},${20 - (v / mx) * 18}`).join(" ");
          return `<tr><td class="nm">${M.esc(r.name)}</td><td class="r">${r.ctr ? (r.ctr * 100).toFixed(1) + "%" : "-"}</td><td class="r">${M.num(r.clicks)}</td><td class="r">${M.num(r.orders)}</td><td class="r">${M.pct(r.orders, r.clicks)}</td><td class="r">${r.orders ? M.man(r.revenue / r.orders) + "원" : "-"}</td>
            <td><svg viewBox="0 0 72 22" class="spark"><polyline points="${path}"/></svg></td></tr>`; }).join("")}</tbody></table>`;

      const cards = {
        links: card("어느 소재가 주문으로 가장 많이 이어지나?", top ? `<b>${M.esc(top.name)}</b>이(가) 주문 ${M.num(top.orders)}건으로 1위, 전환율 ${M.pct(top.orders, top.clicks)}입니다. 클릭률이 높은 소재와 주문이 많은 소재가 다를 수 있습니다.` : "주문 대기 중", linkTbl, "추이는 최근 7일 일별 주문", { wide: true }),
        trend: card("매출은 늘고 있나?", `이번 주 매출은 4주 전보다 <b>${Math.round((0.295 / 0.21 - 1) * 100)}%</b> 늘었습니다. 현장·SDK 주문은 이번 주에 바로 더해집니다.`, weekly(rows, state), "주간 매출 · 막대 위에 올리면 금액, ▲▼는 전주 대비"),
        roas: card("광고비 1원당 매출이 가장 좋은 곳은?", roas[0] ? `<b>${M.esc(roas[0].l)}</b> ROAS ${roas[0].v.toFixed(1)}배, 가장 낮은 곳은 ${M.esc(roas[roas.length - 1].l)} ${roas[roas.length - 1].v.toFixed(1)}배입니다. 1배 아래면 쓴 돈보다 매출이 적습니다.` : "광고 계정을 연결하면 답합니다.", roasTable(roas), "ROAS = 매출 ÷ 광고비 · 광고비는 플랫폼 원값으로 다시 계산"),
        time: card("언제 주문이 가장 많이 들어오나?", `<b>${H.best}</b>에 주문이 가장 몰립니다. 이 시간대 앞에 광고 노출을 늘리는 것을 검토해 보세요.`, H.html, "주문 시각 기준 · 칸 위에 올리면 건수"),
        cross: card("어디서 클릭하고 어디서 샀나?", `인스타에서 클릭한 손님의 <b>${crossShare}%</b>는 자사몰에서 샀습니다. 판매처 통계만 보면 이 손님들은 '출처 미상'입니다.`, cross(rows), "mape_link 클릭 ID로 이은 주문만 집계"),
        repurchase: card("재구매는 어디서 일어나나?", `재구매 고객 비율은 자사몰 <b>18%</b>, 스마트스토어 <b>9%</b>. 자사몰 첫 구매 고객은 평균 <b>34일</b> 뒤 다시 삽니다.`,
          hbars([{ l: "자사몰", v: 18 }, { l: "스마트스토어", v: 9 }], (v) => v + "%") + `<div class="muted" style="margin:12px 0 6px">재구매까지 걸린 날</div>` +
          hbars([{ l: "~14일", v: 12 }, { l: "15~30일", v: 31 }, { l: "31~60일", v: 38, hl: 1 }, { l: "61일~", v: 19 }], (v) => v + "%"), "최근 90일 · 구매자 식별값 기준"),
        sdk: card("자사몰에 온 손님은 어디까지 보나?", `mape SDK 실제 방문 <b>${M.num(sdk)}</b>건 포함. 상품 페이지에서 평균 <b>48초</b> 머물고, <b>62%</b>가 리뷰 영역까지 스크롤합니다.`,
          hbars([{ l: "상품 페이지", v: 100 }, { l: "리뷰까지 스크롤", v: 62 }, { l: "옵션 선택", v: 41 }, { l: "주문서", v: 19, hl: 1 }, { l: "결제 완료", v: 9 }], (v) => v + "%"), "mape SDK 방문 이벤트 · 자사몰만 해당"),
      };
      extraCards.forEach((k) => (cards[k] = EXTRA[k].make(rows)));
      const shown = only ? [cards[only] ? cards[only].replace('class="card qcard', 'class="card qcard wide') : `<div class="empty">없는 카드입니다</div>`] : Object.values(cards);
      return `<main>
        <div class="pagehead"><div><h1>${only ? M.esc((M.INSIGHT_CARDS.find((c) => c[0] === only) || [, "인사이트"])[1]) : "인사이트"}</h1><p class="sub">결과 보고서가 아니라 계속 갱신되는 질문 카드입니다. 새로운 고민이 생기면 카드를 바로 추가합니다.</p></div></div>
        <div class="filters">
          <div class="seg">${Object.entries(PERIOD).map(([k, [l]]) => `<button data-p="${k}" class="${F.period === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <div class="seg">${[["all", "전체 판매처"], ["smartstore", "스마트스토어"], ["cafe24", "자사몰"]].map(([k, l]) => `<button data-s="${k}" class="${F.store === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <span class="muted" style="margin-left:auto">클릭 ${M.num(clicks)} · 주문 ${M.num(orders)} · 매출 ${M.won(rev)} · 광고비 ${M.won(spend)}</span>
        </div>
        <div class="qcards">${shown.join("")}
          ${only ? "" : `<button class="addq" id="addq">＋ 질문 카드 추가</button>`}</div>
      </main>`;
    },
    mount(el) {
      el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { F.period = b.dataset.p; M.render(); }));
      el.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { F.store = b.dataset.s; M.render(); }));
      const add = el.querySelector("#addq");
      if (add) add.onclick = () => M.openModal(`<h2>질문 카드 추가</h2><p class="sub">마케팅 고민이 생기면 질문 단위로 카드를 붙입니다.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">${Object.entries(EXTRA).map(([k, c]) =>
          `<button class="btn" data-x="${k}" ${extraCards.includes(k) ? "disabled" : ""} style="justify-content:space-between">${c.q}<span>${extraCards.includes(k) ? "추가됨" : "＋"}</span></button>`).join("")}</div>
        <div class="modal-actions"><button class="btn" onclick="MAPE.closeModal()">닫기</button></div>`, (box) => {
        box.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { extraCards.push(b.dataset.x); syncCards(); M.closeModal(); M.render(); }));
      });
    },
  };
  M.route("/app/insight", insightDef);
  M.route("/app/insight/:key", insightDef);

  // ───── 추적: 링크 목록 · 끊긴 링크 · SDK 설치 ─────
  // 시연용 점검 결과: 자사몰 대상 링크 하나는 도착 페이지 응답 지연
  const BROKEN = { "ig-profile": { why: "도착 페이지 응답이 3.2초 걸립니다", detail: "자사몰 상품 페이지가 느리게 열려, 손님 4명 중 1명이 도착 전에 이탈하는 수준입니다.", fix: "상품 페이지 이미지 용량을 줄이거나, 도착 주소를 가벼운 페이지로 바꾸세요." } };
  M.route("/app/track", {
    live: true,
    render(state) {
      const rows = [...state.rows].sort((a, b) => (b.isRuntime - a.isRuntime) || b.clicks - a.clicks);
      const nBroken = rows.filter((r) => BROKEN[r.slug]).length;
      return `<main>
        <div class="pagehead"><div><h1>링크 목록</h1><p class="sub">모든 mape_link의 클릭과 연결 상태를 봅니다.</p></div>
          <a class="btn pri" href="#/app/link">＋ 새 링크 만들기</a></div>
        ${nBroken ? `<div class="warnbox" style="margin-bottom:12px"><b>끊긴 링크 ${nBroken}개</b> · 손님이 상품에 제대로 도착하지 못하는 링크가 있습니다. <a href="#/app/track/broken">확인하기</a></div>` : ""}
        <div class="card">
          <table class="tbl"><thead><tr><th>상태</th><th>mape_link</th><th>짧은 주소</th><th>쓰는 곳</th><th>판매처 · 꼬리표</th><th class="r">클릭</th><th class="r">주문</th><th class="r">전환율</th><th></th></tr></thead>
          <tbody>${rows.map((r) => `<tr class="${r.isRuntime ? "demo" : ""}">
            <td>${r.adSource && !r.tracking ? '<span class="chip grey">적용 대기</span>' : BROKEN[r.slug] ? '<span class="chip bad">점검 필요</span>' : '<span class="chip">정상</span>'}</td>
            <td class="nm">${M.esc(r.name)}${r.isRuntime ? ' <span class="badge live">방금 생성</span>' : ""}</td>
            <td><code style="font-size:12px">${M.esc(M.shortUrl(r.slug).replace(/^https?:\/\//, ""))}</code></td>
            <td>${M.esc(r.channel)}</td><td>${M.esc(r.store)} · ${r.storeKey === "cafe24" ? "UTM" : "NT"}</td>
            <td class="r">${M.num(r.clicks)}</td><td class="r">${M.num(r.orders)}</td><td class="r">${M.pct(r.orders, r.clicks)}</td>
            <td><button class="btn sm" data-qr="${r.slug}">QR</button></td></tr>`).join("") ||
            `<tr><td colspan="9" style="color:var(--muted);padding:24px 6px">아직 mape_link가 없습니다</td></tr>`}</tbody></table>
        </div>
      </main>`;
    },
    mount(el, state) {
      el.querySelectorAll("[data-qr]").forEach((b) => b.addEventListener("click", () => M.showLink(state.rows.find((x) => x.slug === b.dataset.qr))));
    },
  });

  M.route("/app/track/broken", {
    render(state) {
      const list = state.rows.filter((r) => BROKEN[r.slug]);
      const ok = state.rows.filter((r) => !BROKEN[r.slug]).length;
      return `<main>
        <div class="pagehead"><div><h1>끊긴 링크</h1><p class="sub">매일 모든 링크를 열어 보고, 도착 페이지가 열리는지 · 꼬리표가 빠지지 않았는지 · 광고 문구와 상품이 맞는지 확인합니다.</p></div>
          <button class="btn" id="recheck">지금 다시 점검</button></div>
        <div class="grid3"><div class="kpi"><div class="l">정상</div><div class="v" style="color:var(--green)">${ok}</div></div>
          <div class="kpi"><div class="l">점검 필요</div><div class="v" style="color:#E03A3A">${list.length}</div></div>
          <div class="kpi"><div class="l">마지막 점검</div><div class="v" style="font-size:20px" id="lastcheck">오늘 06:00</div></div></div>
        ${list.map((r) => `<div class="card" style="border-left:4px solid #E03A3A;margin-bottom:12px">
          <div class="card-h"><h2>${M.esc(r.name)}</h2><span class="chip bad">점검 필요</span></div>
          <p style="margin:0 0 6px"><b>${BROKEN[r.slug].why}</b> · ${BROKEN[r.slug].detail}</p>
          <p class="muted" style="margin:0 0 10px">해결: ${BROKEN[r.slug].fix}</p>
          <table class="tbl"><tr><td>링크가 열리는지</td><td><span class="chip">통과</span></td><td>꼬리표 빠짐</td><td><span class="chip">통과</span></td><td>도착 속도</td><td><span class="chip bad">3.2초</span></td><td>상품 일치</td><td><span class="chip">통과</span></td></tr></table>
          <div style="display:flex;gap:8px;margin-top:10px"><a class="btn sm" href="${M.esc(M.fullTarget(r.target))}" target="_blank">도착 페이지 열기</a><a class="btn sm" href="#/app/track">링크 목록으로</a></div>
        </div>`).join("") || `<div class="empty">끊긴 링크가 없습니다</div>`}
      </main>`;
    },
    mount(el) {
      el.querySelector("#recheck").onclick = async (e) => {
        e.target.textContent = "점검 중..."; e.target.disabled = true;
        await M.sleep(1200);
        const d = new Date();
        el.querySelector("#lastcheck").textContent = `방금 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        e.target.textContent = "지금 다시 점검"; e.target.disabled = false;
        M.toast("링크 점검 완료", "결과가 같습니다 · 점검 필요 1개");
      };
    },
  });

  M.route("/app/track/sdk", { render: () => (setTimeout(() => M.go("#/app/my/sdk")), "") });
  M.route("/app/my/sdk", {
    live: true,
    render(state) {
      const views = state.rows.reduce((s, r) => s + r.views, 0);
      const sdkOrders = state.recent.filter((e) => e.source === "sdk" && e.type === "order").length;
      return `<main>
        <div class="pagehead"><div><h1>자사몰 mape SDK 설치</h1><p class="sub">자사몰에 코드 두 줄을 넣으면 방문과 구매가 mape_link 경로에 자동으로 붙습니다.</p></div></div>
        <div class="grid3"><div class="kpi"><div class="l">설치 상태</div><div class="v" style="font-size:22px;color:${views ? "var(--green)" : "var(--muted)"}">${views ? "● 수신 중" : "신호 대기"}</div></div>
          <div class="kpi"><div class="l">SDK 방문 (서버 켠 뒤)</div><div class="v">${M.num(views)}</div></div>
          <div class="kpi"><div class="l">SDK 주문 전송</div><div class="v">${M.num(sdkOrders)}</div></div></div>
        <div class="grid2" style="grid-template-columns:1.3fr 1fr">
          <div class="card"><h2>1. 모든 페이지에 넣기</h2>
<pre class="code">&lt;script src="${M.esc(state.linkBase)}/sdk/mape.js"&gt;&lt;/script&gt;
&lt;script&gt;mape.init();&lt;/script&gt;</pre>
            <h2 style="margin-top:16px">2. 구매 완료 페이지에서</h2>
<pre class="code">mape.purchase({ orderId: "주문번호", amount: 결제금액 });</pre>
            <h2 style="margin-top:16px">개발자용 (번들러 · 서버)</h2>
<pre class="code">import mape from "mape";
mape.init({ endpoint: "${M.esc(state.linkBase)}/collect" });

// 서버에서 보내는 경우 (포스트백)
const mape = require("mape");
await mape.purchase({ cid: req.cookies.mape_cid, orderId, amount });</pre></div>
          <div class="card"><h2>SDK가 하는 일</h2>
            <ol style="line-height:1.9;color:var(--ink2);padding-left:18px;margin:10px 0 0">
              <li><b>잡기</b> · mape_link로 들어온 손님의 클릭 ID를 30일 보관</li>
              <li><b>방문</b> · 어떤 페이지를 봤는지 전송 (자사몰 행동 분석)</li>
              <li><b>구매</b> · 클릭 ID와 함께 주문을 전송, 같은 주문번호는 한 번만</li></ol>
            <div class="cf" style="margin-top:14px">시연용 자사몰 <a href="${M.esc(state.linkBase)}/shop/" target="_blank">순우리 스토어</a>에 이미 설치되어 있습니다. mape_link로 들어가서 사면 SDK 주문 전송 숫자가 올라갑니다.</div></div>
        </div>
      </main>`;
    },
  });

  // ───── 모니터링: 광고 위치 목록 → 위치별 현장 점검으로 넘어가기 ─────
  const EYE_OK = { "네이버 파워링크": "powerlink", "네이버 쇼핑검색": "shopping" };
  M.route("/app/monitor", {
    render(state) {
      const paid = state.rows.filter((r) => r.active && r.spend > 0);
      const alerts = { "인스타 릴스": "노출 대비 클릭률 하락 (7일 −18%)", "네이버 파워링크": "클릭당 비용 상승 (7일 +12%)" };
      return `<main>
        <div class="pagehead"><div><h1>모니터링</h1><p class="sub">내 광고가 지금 어디에 걸려 있는지 보고, 위치를 골라(왼쪽 메뉴나 목록의 버튼) 실제 화면에서 점검합니다.</p></div></div>
        <div class="card" style="margin-bottom:12px"><div class="card-h"><h2>광고 위치 목록</h2><span class="muted">연결된 광고 계정 기준</span></div>
          <table class="tbl"><thead><tr><th>위치</th><th>소재 (mape_link)</th><th>상태</th><th class="r">노출(추정)</th><th class="r">클릭률</th><th class="r">광고비</th><th>알림</th><th></th></tr></thead>
          <tbody>${paid.map((r) => `<tr><td class="nm">${M.esc(r.channel)}</td><td>${M.esc(r.name)}<div class="muted" style="font-family:ui-monospace,Menlo,monospace">${M.esc(M.shortUrl(r.slug).replace(/^https?:\/\//, ""))}</div></td><td><span class="chip">게재 중</span></td>
            <td class="r">${M.num(r.impressions)}</td><td class="r">${r.ctr ? (r.ctr * 100).toFixed(1) + "%" : "-"}</td><td class="r">${M.won(r.spend)}</td>
            <td>${alerts[r.channel] ? `<span class="badge warn">${alerts[r.channel]}</span>` : '<span class="muted">-</span>'}</td>
            <td><a class="btn sm ${EYE_OK[r.channel] ? "pri" : ""}" href="#/app/eye/${r.slug}">${EYE_OK[r.channel] ? "현장 점검 →" : "점검 방법 보기"}</a></td></tr>`).join("") ||
            `<tr><td colspan="8" style="color:var(--muted);padding:24px 6px">광고 계정을 연결하면 위치 목록이 나타납니다</td></tr>`}</tbody></table>
        </div>
        <div class="grid2">
          <div class="card"><h2>현장 점검 · mape_eye <span class="badge pro">선택 모듈</span></h2>
            <p class="muted" style="line-height:1.7;margin-top:8px">브라우저 확장으로 동작합니다. 위 목록에서 위치를 고르면 내 광고가 실제로 걸린 화면으로 넘어가고, 그 화면 위에 점검 창이 뜹니다. 화면의 순위·문구·가격·리뷰를 직접 읽어 경쟁 광고와 비교합니다.</p></div>
          <div class="card"><h2>점검할 수 없는 위치</h2>
            <p class="muted" style="line-height:1.7;margin-top:8px">인스타 스토리·릴스, 카카오채널처럼 앱 안에서만 보이는 위치는 창을 띄울 수 없습니다. 이런 위치는 소재 A/B 결과(검증)로 판단합니다.</p></div>
        </div>
      </main>`;
    },
  });

  // 현장 점검 화면 (사이드바 없이 전체 화면으로 넘어감)
  M.route("/app/eye/:slug", {
    render(state, params) {
      const r = state.rows.find((x) => x.slug === params.slug);
      if (!r) return `<main><div class="empty">없는 광고 위치입니다 <a class="btn sm" href="#/app/monitor">돌아가기</a></div></main>`;
      const focus = EYE_OK[r.channel];
      const top = `<div class="eyebar"><a class="btn sm" href="#/app/monitor">← 모니터링</a>
        <div><b>현장 점검 · ${M.esc(r.channel)}</b><span class="muted"> · ${M.esc(r.name)}</span></div>
        <span class="chip" style="margin-left:auto">${focus ? "● mape_eye 실행 중" : "점검 불가 위치"}</span></div>`;
      if (!focus) return `<div class="eyeview">${top}<div class="eye-na">
          <h2>${M.esc(r.channel)}은(는) 현장 점검 창을 띄울 수 없는 위치입니다</h2>
          <p class="sub" style="margin:8px 0 18px">앱 안에서만 보이는 광고라 브라우저 확장이 화면에 접근할 수 없습니다. 대신 같은 위치에 소재 두 개를 걸고 A/B 결과로 판단합니다.</p>
          <div class="grid3" style="max-width:820px">
            <div class="kpi"><div class="l">노출(추정)</div><div class="v">${M.num(r.impressions)}</div></div>
            <div class="kpi"><div class="l">클릭률</div><div class="v">${r.ctr ? (r.ctr * 100).toFixed(1) + "%" : "-"}</div></div>
            <div class="kpi"><div class="l">주문</div><div class="v">${M.num(r.orders)}</div></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:18px"><a class="btn pri" href="#/app/link">A/B 링크 만들기</a><a class="btn" href="#/app/home/verify">검증의 A/B 판정 보기</a></div>
        </div></div>`;
      return `<div class="eyeview">${top}
        <div class="browser"><div class="bchrome"><span class="dots"><i></i><i></i><i></i></span><span>◀ ▶ ⟳</span>
          <div class="burl">search.example/search?query=텀블러</div><span class="ext" title="mape_eye 확장">M</span></div>
          <iframe src="/search/?focus=${focus}" title="현장 점검 화면"></iframe></div></div>`;
    },
  });
})(MAPE);
