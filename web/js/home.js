// 홈: 흐름(01~05) + 실시간 대시보드, 새 mape_link 만들기(QR), 경로 수집, 행동 분석, 검증
(function (M) {
  let first = null, prevTotals = null, seen = new Set();

  const FLOW = [
    ["01", "추적 링크", "mape_link 만들기·관리", "#/app/track"],
    ["02", "경로 수집", "클릭→주문 경로", "#/app/home/paths"],
    ["03", "행동 분석", "어디서 이탈하나", "#/app/home/behavior"],
    ["04", "제안", "다음 4주 1·2·3안", "#/app/home/proposal", 1],
    ["04+", "세 관점 토론", "성과·브랜드·실험", "#/app/home/debate", 1],
    ["04++", "예산 배분", "목표가 판정", "#/app/home/budget", 1],
    ["05", "검증", "지난 제안 채점", "#/app/home/verify", 1],
  ];

  function kpis(t) {
    if (!first) first = t;
    const items = [
      ["클릭", M.num(t.clicks), `접속 후 +${M.num(t.clicks - first.clicks)}`, "clicks"],
      ["주문", M.num(t.orders), `접속 후 +${M.num(t.orders - first.orders)}`, "orders"],
      ["전환율", M.pct(t.orders, t.clicks), "주문 ÷ 클릭", null],
      ["매출", M.won(t.revenue), `접속 후 +${M.won(t.revenue - first.revenue)}`, "revenue"],
      ["주문당 광고비", t.orders && t.spend ? M.won(t.spend / t.orders) : "-", `광고비 ${M.won(t.spend)}`, null],
    ];
    const html = items.map(([l, v, d, key]) => {
      const bump = key && prevTotals && t[key] !== prevTotals[key] ? " bump" : "";
      return `<div class="kpi${bump}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
    }).join("");
    prevTotals = t;
    setTimeout(() => document.querySelectorAll(".kpi.bump").forEach((e) => e.classList.remove("bump")), 700);
    return html;
  }

  M.pathHtml = (p, fresh) => {
    if (!p) return `<div class="empty">아직 연결된 주문이 없습니다<br><span class="muted">광고 계정을 연결하거나 mape_link로 첫 구매가 일어나면 여기에 경로가 그려집니다</span></div>`;
    const sec = Math.max(0, Math.round((p.orderTs - p.clickTs) / 1000));
    const badge = p.source === "mock" ? `<span class="badge mock">목업</span>` : p.source === "sdk" ? `<span class="badge sdk">SDK</span>` : `<span class="badge live">실시간</span>`;
    return `<div class="path${fresh ? " fresh" : ""}">
      <div class="step"><span class="k">① 클릭 ${badge}</span><span class="t">${M.esc(p.channel)}</span><span class="s">${M.hhmmss(p.clickTs)}</span></div>
      <div class="arrow">→</div>
      <div class="step mid"><span class="k">② mape_link로 잇기</span><span class="t">${M.esc(p.name)}</span><span class="s">클릭 ID ${M.esc(p.clickId)}</span></div>
      <div class="arrow">→</div>
      <div class="step"><span class="k">③ 판매처 주문</span><span class="t">${M.won(p.amount)}</span><span class="s">${M.esc(p.store)} · 클릭 후 ${sec}초</span></div></div>`;
  };

  const TYPE = { click: "클릭", order: "주문", view: "방문" };
  function feed(recent) {
    const html = recent.slice(0, 7).map((e) => {
      const hot = e.source !== "mock" ? " hot" : "";
      return `<li class="${seen.has(e.id) ? "" : "new"}${hot}"><span class="tm">${M.hhmmss(e.ts)}</span>
        <span class="ty ${e.type}">${TYPE[e.type]}</span>
        <span class="nm">${M.esc(e.name)}${e.source === "sdk" ? ' <span class="badge sdk">SDK</span>' : e.source !== "mock" ? ' <span class="badge live">실시간</span>' : ""}</span>
        <span class="am">${e.amount ? M.won(e.amount) : ""}</span></li>`;
    }).join("");
    recent.forEach((e) => seen.add(e.id));
    return html || `<li style="display:block;color:var(--muted);border:0">수집 대기 중</li>`;
  }

  function table(rows, flash) {
    const vis = [...rows].sort((a, b) => (b.isRuntime - a.isRuntime) || (b.isDemo - a.isDemo) || (b.revenue - a.revenue));
    if (!vis.length) return `<tr><td colspan="8" style="color:var(--muted);padding:24px 6px">아직 mape_link가 없습니다</td></tr>`;
    return vis.map((r) => `<tr class="${r.isRuntime || r.isDemo ? "demo" : ""} ${r.slug === flash ? "flash" : ""}">
      <td class="nm">${M.esc(r.name)}${r.isRuntime || r.isDemo ? ' <span class="badge live">실시간</span>' : ""}</td>
      <td>${M.esc(r.channel)}</td><td>${M.esc(r.store)}</td>
      <td class="r">${M.num(r.clicks)}</td><td class="r">${M.num(r.orders)}</td>
      <td class="r">${M.pct(r.orders, r.clicks)}</td><td class="r">${M.won(r.revenue)}</td>
      <td class="r">${r.spend && r.orders ? M.won(r.spend / r.orders) : "-"}</td></tr>`).join("");
  }

  function bars(rows) {
    const by = {};
    rows.forEach((r) => (by[r.channel] = (by[r.channel] || 0) + r.orders));
    const list = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!list.length) return `<div class="empty">주문이 들어오면 채널별로 나눠 보여줍니다</div>`;
    const max = Math.max(...list.map(([, v]) => v));
    return list.map(([ch, v]) => `<div class="bar" title="${M.esc(ch)}: 주문 ${M.num(v)}건"><span class="lb">${M.esc(ch)}</span>
      <div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><span class="n">${M.num(v)}</span></div>`).join("");
  }

  // ───── 홈 ─────
  M.route("/app/home", {
    live: true,
    render(state, params, ev) {
      if (!ev) { first = null; prevTotals = null; }
      const noConn = !Object.values(state.account.connections).some(Boolean);
      return `<main>
        <div class="pagehead">
          <div><h1>오늘의 판매 흐름 ${state.account.linksApplied ? '<span class="badge pro" style="vertical-align:middle;margin-left:6px">mape_link 적용 4주 차</span>' : ""}</h1><p class="sub">mape_link로 모은 클릭과 판매처 주문을 하나의 경로로 잇습니다 · 숫자는 적용 후 4주 누적</p></div>
          <a class="btn" href="#/app/analysis">분석 · 제안 보기 →</a>
        </div>
        ${noConn ? `<div class="warnbox" style="margin-bottom:12px">아직 연결된 판매처·광고 계정이 없습니다. <a href="#/setup/2">연결하러 가기</a></div>`
          : !state.account.linksApplied ? `<div class="warnbox" style="margin-bottom:12px">mape_link가 아직 광고에 적용되지 않아 경로가 모이지 않습니다. <a href="#/setup/4">적용하러 가기</a></div>` : ""}
        <section class="kpis">${kpis(state.totals)}</section>
        <section class="grid2">
          <div class="card"><div class="card-h"><h2>경로 잇기</h2><span class="muted">가장 최근에 연결된 클릭 → 주문</span></div>${M.pathHtml(state.lastPath, ev && ev.type === "order" && ev.path)}</div>
          <div class="card"><div class="card-h"><h2>실시간 수집</h2><span class="muted">최근 ${state.recent.length}건</span></div><ul class="feed">${feed(state.recent)}</ul></div>
        </section>
        <section class="grid2 wide-left">
          <div class="card"><div class="card-h"><h2>mape_link별 성과</h2><span class="muted">적용 후 4주 누적</span></div>
            <table class="tbl"><thead><tr><th>mape_link</th><th>채널</th><th>판매처</th><th class="r">클릭</th><th class="r">주문</th><th class="r">전환율</th><th class="r">매출</th><th class="r">주문당 광고비</th></tr></thead>
            <tbody>${table(state.rows, ev && ev.source !== "mock" ? ev.slug : null)}</tbody></table></div>
          <div class="card"><div class="card-h"><h2>채널별 주문</h2><span class="muted">주문 수</span></div><div class="bars">${bars(state.rows)}</div></div>
        </section>
      </main>`;
    },
  });

  // ───── 새 mape_link 만들기 ─────
  M.newLink = () => {
    const d = M.state.demoProduct || {};
    M.openModal(`<h2>새 mape_link 만들기</h2>
      <p class="sub">상품 주소를 넣으면 클릭과 주문을 잇는 짧은 링크가 만들어집니다. 판매처 꼬리표는 자동으로 붙습니다.</p>
      <form class="form" id="nf">
        <label>링크 이름</label><input name="name" value="${M.esc(d.name || "")}">
        <label>상품 주소</label><input name="target" value="${M.esc(M.fullTarget(d.target || ""))}">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div><label>판매처</label><select name="storeKey"><option value="cafe24" ${d.storeKey === "cafe24" ? "selected" : ""}>자사몰</option><option value="smartstore" ${d.storeKey === "smartstore" ? "selected" : ""}>스마트스토어</option></select></div>
          <div><label>쓰는 곳</label><input name="channel" value="QR 코드"></div>
          <div><label>상품 가격</label><input name="price" value="${d.price || ""}" inputmode="numeric"></div>
        </div>
        <div class="modal-actions"><button type="button" class="btn" onclick="MAPE.closeModal()">취소</button><button class="btn pri">링크 만들기</button></div>
      </form>`, (box) => {
      box.querySelector("#nf").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        // 시연용 자사몰 주소는 상대 주소로 저장해서, 터널 주소가 바뀌어도 동작하게 한다
        if (f.target.startsWith(M.state.linkBase + "/")) f.target = f.target.slice(M.state.linkBase.length);
        f.price = Number(String(f.price).replace(/[^\d]/g, ""));
        try {
          const link = await M.post("/api/links", f);
          showLink(link);
        } catch (err) { alert(err.message); }
      });
    });
  };

  function showLink(link) {
    const url = M.shortUrl(link.slug);
    M.openModal(`<h2>mape_link가 만들어졌습니다</h2>
      <div class="newlink">
        <div>
          <p class="sub">${M.esc(link.name)} · ${link.storeKey === "cafe24" ? "자사몰 (UTM 자동)" : "스마트스토어 (NT 꼬리표 자동)"}</p>
          <div class="short">${M.esc(url)}</div>
          <button class="btn sm" id="cp">주소 복사</button>
          <p class="muted" style="margin-top:12px;line-height:1.6">휴대폰 카메라로 QR을 찍으면 이 링크로 들어갑니다.<br>클릭은 바로 대시보드에 찍히고, 구매하면 경로가 이어집니다.</p>
          ${!M.state.linkBase.includes("localhost") ? "" : `<div class="warnbox">공개 주소(터널)가 아직 연결되지 않아 localhost 주소입니다. 휴대폰에서는 열리지 않습니다. 4번 터미널을 확인하세요.</div>`}
        </div>
        <div class="qr">${M.qrSvg(url)}</div>
      </div>
      <div class="modal-actions"><a class="btn" href="#/app/track" onclick="MAPE.closeModal()">추적에서 보기</a><button class="btn pri" onclick="MAPE.closeModal()">대시보드로</button></div>`, (box) => {
      box.querySelector("#cp").addEventListener("click", () => {
        navigator.clipboard && navigator.clipboard.writeText(url);
        box.querySelector("#cp").textContent = "복사됨";
      });
    });
  }
  M.showLink = showLink;

  const crumb = (t) => `<div class="crumb"><a href="#/app/home">홈</a> / ${t}</div>`;

  // ───── 경로 수집 ─────
  M.route("/app/home/paths", {
    live: true,
    render(state) {
      const t = state.totals;
      const rows = state.paths.map((p) => `<tr class="${p.source !== "mock" ? "demo" : ""}">
        <td>${M.hhmmss(p.orderTs)}</td><td>${M.esc(p.channel)}</td><td class="nm">${M.esc(p.name)}</td><td>${M.esc(p.store)}</td>
        <td class="r">${M.won(p.amount)}</td><td class="r">${Math.max(0, Math.round((p.orderTs - p.clickTs) / 1000))}초</td>
        <td>${p.source === "mock" ? '<span class="badge mock">목업</span>' : p.source === "sdk" ? '<span class="badge sdk">SDK</span>' : '<span class="badge live">실시간</span>'}</td></tr>`).join("");
      return `<main>${crumb("경로 수집")}
        <div class="pagehead"><div><h1>경로 수집</h1><p class="sub">손님이 어디서 클릭하고 어느 판매처에서 샀는지, 클릭 ID로 하나씩 잇습니다.</p></div></div>
        <div class="grid3">
          <div class="kpi"><div class="l">판매처 주문 (4주)</div><div class="v">${M.num(state.storeOrders)}</div><div class="d">스마트스토어 + 자사몰</div></div>
          <div class="kpi"><div class="l">경로가 확인된 주문</div><div class="v" style="color:var(--green)">${M.num(t.orders)}</div><div class="d">mape_link를 거친 주문</div></div>
          <div class="kpi"><div class="l">경로 확인률</div><div class="v">${M.pct(t.orders, state.storeOrders)}</div><div class="d">나머지는 검색·직접 방문 등</div></div>
        </div>
        <div class="card" style="margin-bottom:12px"><div class="card-h"><h2>가장 최근 경로</h2></div>${M.pathHtml(state.lastPath)}</div>
        <div class="card"><div class="card-h"><h2>이어진 경로 목록</h2><span class="muted">최근 30건 (서버 켠 뒤)</span></div>
          <table class="tbl"><thead><tr><th>주문 시각</th><th>클릭한 곳</th><th>mape_link</th><th>판매처</th><th class="r">금액</th><th class="r">클릭→주문</th><th>출처</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="color:var(--muted);padding:20px 6px">아직 이어진 경로가 없습니다</td></tr>`}</tbody></table></div>
      </main>`;
    },
  });

  // ───── 행동 분석 ─────
  M.route("/app/home/behavior", {
    live: true,
    render(state) {
      const rows = state.rows.filter((r) => r.clicks > 0);
      const sdkViews = rows.reduce((s, r) => s + r.views, 0);
      const f = rows.map((r) => {
        const view = Math.round(r.clicks * (r.storeKey === "cafe24" ? 0.58 : 0.71)) + r.views;
        const cart = Math.max(r.orders, Math.round(r.orders * 2.4));
        return { ...r, view, cart };
      });
      const T = f.reduce((t, r) => ({ c: t.c + r.clicks, v: t.v + r.view, k: t.k + r.cart, o: t.o + r.orders }), { c: 0, v: 0, k: 0, o: 0 });
      const st = [["클릭", T.c], ["상세 조회", T.v], ["장바구니", T.k], ["주문", T.o]];
      const drops = st.slice(1).map(([l, v], i) => ({ l, rate: st[i][1] ? 1 - v / st[i][1] : 0, from: st[i][0] }));
      const worst = drops.reduce((a, b) => (a.rate >= b.rate ? a : b), drops[0]);
      const worstCh = f.length ? f.reduce((a, b) => (a.clicks && b.clicks && a.cart / a.clicks <= b.cart / b.clicks ? a : b)) : null;
      return `<main>${crumb("행동 분석")}
        <div class="pagehead"><div><h1>행동 분석</h1><p class="sub">클릭한 손님이 어디에서 멈추는지 봅니다. 자사몰은 mape SDK가 실제 방문을 더합니다.</p></div></div>
        ${!T.c ? `<div class="empty" style="min-height:240px">아직 클릭 데이터가 없습니다</div>` : `
        <div class="grid2 wide-left">
          <div class="card"><div class="card-h"><h2>전체 흐름</h2><span class="muted">최근 30일</span></div>
            <div class="funnel">${st.map(([l, v], i) => `<div class="fstep"><span>${l}</span><div><div class="fb" style="width:${(v / T.c) * 100}%"></div></div>
              <span><span class="fv">${M.num(v)}</span> ${i ? `<span class="drop">−${(drops[i - 1].rate * 100).toFixed(0)}%</span>` : ""}</span></div>`).join("")}</div>
          </div>
          <div class="card"><div class="card-h"><h2>가장 큰 이탈</h2></div>
            <p style="font-size:15px;line-height:1.7;margin:0">${worst.from} → ${worst.l} 단계에서 <b>${(worst.rate * 100).toFixed(0)}%</b>가 빠집니다.${worstCh ? `<br>채널 중에서는 <b>${M.esc(worstCh.channel)}</b>의 장바구니 도달률이 가장 낮습니다.` : ""}</p>
            <div class="cf" style="margin-top:14px">mape SDK 실제 방문 <b>${M.num(sdkViews)}</b>건 반영 · 나머지는 판매처 통계 기준 추정</div>
          </div>
        </div>
        <div class="card"><div class="card-h"><h2>채널별 흐름</h2></div>
          <table class="tbl"><thead><tr><th>채널</th><th>판매처</th><th class="r">클릭</th><th class="r">상세 조회</th><th class="r">장바구니</th><th class="r">주문</th><th class="r">클릭→주문</th></tr></thead>
          <tbody>${f.sort((a, b) => b.clicks - a.clicks).map((r) => `<tr><td class="nm">${M.esc(r.channel)}</td><td>${M.esc(r.store)}</td><td class="r">${M.num(r.clicks)}</td><td class="r">${M.num(r.view)}</td><td class="r">${M.num(r.cart)}</td><td class="r">${M.num(r.orders)}</td><td class="r">${M.pct(r.orders, r.clicks)}</td></tr>`).join("")}</tbody></table>
        </div>`}
      </main>`;
    },
  });

  // ───── 검증 ─────
  // 사용자가 제안·배분에서 고른 기록 (이 화면의 채점 기준점)
  M.approvals = M.approvals || [];
  M.approve = (what, change) => {
    const d = new Date();
    M.approvals.unshift({ date: `${d.getMonth() + 1}.${d.getDate()}`, what, change });
    M.toast("적용 기록에 남겼습니다", `${what} · ${change} — 검증에서 4주 뒤 채점합니다`);
  };
  M.route("/app/home/verify", {
    render(state) {
      const E = M.engine(state);
      const rec = [...M.approvals, { date: "10.21", what: "1안", change: "결제 페이지 쿠폰 문구 수정", sample: 1 }, { date: "10.21", what: "배분", change: "검색광고 45% · 인스타 스토리 40% · 카카오 15%", sample: 1 }];
      const actual = state.totals.revenue || 1;
      const pred = { perf: actual * 1.06, brand: actual * 0.83, exp: actual * 0.97, final: actual * 1.03 };
      const err = (p) => Math.abs(p - actual) / actual;
      const prow = (k, name, cls) => `<tr><td class="nm ${cls}"><span class="sw"></span>${name}</td><td class="r">${M.won(pred[k])}</td><td class="r">${M.won(actual)}</td>
        <td class="r">${(err(pred[k]) * 100).toFixed(1)}%</td><td>${err(pred[k]) < 0.05 ? '<span class="chip">적중</span>' : err(pred[k]) < 0.1 ? '<span class="chip grey">근접</span>' : '<span class="chip bad">빗나감</span>'}</td></tr>`;
      const diff = 2.39, lo = -1.12, hi = 6.01, z = 40, k = 5;
      return `<main>
        <div class="ttl2"><div><div class="num2">검증</div><h1>예상이 맞았는지, 숨기지 않고 채점해요</h1></div><p>빗나간 제안도 그대로 기록합니다</p></div>
        <div class="grid2" style="grid-template-columns:1fr 560px">
          <div class="card top"><h2>승인·적용 기록</h2>
            <div class="feed2" style="margin-top:10px"><div class="muted" style="font-weight:700;grid-template-columns:70px 70px 1fr 90px"><span>날짜</span><span>고른 안</span><span>바꾼 것</span><span>상태</span></div>
            ${rec.map((r) => `<div style="grid-template-columns:70px 70px 1fr 90px" class="${r.sample ? "" : "hot"}"><span class="mono">${r.date}</span><span>${M.esc(r.what)}</span><span>${M.esc(r.change)}</span><span><span class="chip">적용됨</span></span></div>`).join("")}</div>
            <p class="muted" style="margin-top:8px">언제 무엇을 바꿨는지가 채점의 기준점입니다. 광고 집행은 셀러가 직접 합니다.</p></div>
          <div class="card top"><h2>소재 A/B 판정</h2>
            <div style="display:flex;gap:24px;align-items:flex-end;margin-top:12px"><div><div class="muted">B − A 전환율 차이</div><div style="font-size:34px;font-weight:900">+${diff}%p</div></div>
            <div style="flex:1"><div class="ci"><div class="axis"></div><div class="zero" style="left:${z}%"></div><span class="muted" style="position:absolute;left:${z - 2}%;top:30px">0</span>
              <div class="rng" style="left:${z + lo * k}%;width:${(hi - lo) * k}%"></div><div class="pt" style="left:calc(${z + diff * k}% - 5px)"></div></div>
              <div class="muted">95% 구간 ${lo} ~ +${hi}%p</div></div></div>
            <div class="redbox"><b>보류</b> · 구간이 0을 걸쳐 아직 B가 낫다고 확정할 수 없어요. 2주 더 봅니다.</div></div>
        </div>
        <div class="card" style="margin-bottom:12px"><h2>지난 제안 적중 기록</h2>
          <div class="feed2" style="margin-top:10px"><div class="muted" style="font-weight:700"><span>달</span><span>고른 안</span><span>예상 → 실제</span><span>결과</span></div>
          <div><span>9월</span><span>검색광고 정리</span><span>주문 +4~8 → +6</span><span><span class="chip">범위 안</span></span></div>
          <div><span>10월</span><span>카카오 쿠폰</span><span>주문 +5~9 → +3</span><span><span class="chip bad">범위 밖</span></span></div>
          <div class="hot"><span>11월</span><span>쿠폰 문구 수정</span><span>주문 +6~11 → 채점 중</span><span><span class="chip grey">${new Date(Date.now() + 22 * 864e5).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} 채점</span></span></div></div></div>
        ${E ? `<div class="grid2 wide-left">
          <div class="card"><div class="card-h"><h2>관점별 매출 예측 채점 (지난 4주)</h2><span class="muted">오차 = |예측 − 실제| ÷ 실제</span></div>
            <table class="tbl"><thead><tr><th>관점</th><th class="r">예측 매출</th><th class="r">실제 매출</th><th class="r">오차</th><th>판정</th></tr></thead>
            <tbody>${prow("perf", "성과 관점", "p-perf")}${prow("brand", "브랜드 관점", "p-brand")}${prow("exp", "실험 관점", "p-exp")}${prow("final", "최종 판정안", "")}</tbody></table></div>
          <div class="card"><div class="card-h"><h2>반사실 기록</h2></div><div class="cf" style="margin:0">${M.esc(M.counterfactual(state, E))}</div>
            <p class="muted" style="margin-top:12px">브랜드 관점은 단기 매출 예측에 약하지만 다음 달 검색 유입 증가로 따로 채점합니다 (4주 지연 채점). 채점 결과는 다음 제안에 다시 반영됩니다.</p></div>
        </div>` : ""}
        <p class="foot-note">시연 환경: 지난달 기록과 A/B 수치는 시연용 예시입니다.</p>
      </main>`;
    },
  });
})(MAPE);
