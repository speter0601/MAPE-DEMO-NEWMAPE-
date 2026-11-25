// 링크 · 수집 · 분석
(function (M) {
  const head = (num, title, desc) => `<div class="ttl2"><div><div class="num2">${num}</div><h1>${title}</h1></div><p>${desc}</p></div>`;

  // 연결·목표는 마이페이지로 옮김 (옛 주소 호환)
  M.route("/app/connect", { render: () => (setTimeout(() => M.go("#/app/my/connect")), "") });

  // ───── 링크 ─────
  const PLACES = ["QR 코드", "인스타그램 스토리", "인스타 릴스", "인스타 프로필", "네이버 블로그", "카카오채널"];
  function tracked(link) {
    const relative = link.target.startsWith("/");
    const u = new URL(link.target, "http://same-host");
    u.searchParams.set("mape_cid", "{클릭마다 발급}");
    if (link.storeKey === "smartstore") { u.searchParams.set("nt_source", "mape"); u.searchParams.set("nt_medium", link.channel); u.searchParams.set("nt_detail", link.slug); }
    else { u.searchParams.set("utm_source", "mape"); u.searchParams.set("utm_medium", link.channel); u.searchParams.set("utm_campaign", link.slug); }
    return decodeURIComponent((relative ? M.state.linkBase + u.pathname : u.origin + u.pathname) + u.search);
  }
  M.route("/app/link", {
    render(state) {
      const d = state.demoProduct || {};
      const links = state.rows.filter((r) => r.isRuntime).sort((a, b) => b.createdAt - a.createdAt);
      const last = links[0];
      const path = last && state.paths.find((p) => p.slug === last.slug);
      return `<main>${head("링크", "새 mape_link 만들기", "올릴 곳마다 다른 링크를 자동으로 만들어요")}
        <div class="grid2" style="grid-template-columns:460px 1fr;align-items:start">
          <form class="card form" id="lf" style="max-width:none">
            <label>상품 이름</label><input name="name" value="${M.esc(d.name || "")}">
            <label>상품 주소</label><input name="target" value="${M.esc(M.fullTarget(d.target || ""))}">
            <label>판매처</label><select name="storeKey"><option value="cafe24" ${d.storeKey === "cafe24" ? "selected" : ""}>자사몰 (UTM 자동)</option><option value="smartstore" ${d.storeKey === "smartstore" ? "selected" : ""}>스마트스토어 (NT 꼬리표 자동)</option></select>
            <label>어디에 올리나요</label><select name="channel">${PLACES.map((p) => `<option>${p}</option>`).join("")}</select>
            <label>캠페인 이름</label><input name="campaign" value="11월 신규 고객">
            <label>상품 가격</label><input name="price" value="${d.price || ""}" inputmode="numeric">
            <label style="display:flex;gap:10px;align-items:center;margin-top:16px;color:var(--ink)"><input type="checkbox" name="ab" style="width:auto"> 소재 두 개를 링크로 나눠 A/B 준비</label>
            <button class="btn pri" style="margin-top:16px">링크 만들기</button>
          </form>
          <div>
            ${links.length ? links.map((l) => `<div class="lk">
              <div style="flex:1;min-width:0">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${M.esc(l.name)}</b><span class="chip">링크 작동 확인</span><span class="chip">파라미터 빠짐 없음</span><span class="chip grey">${M.esc(l.channel)}</span></div>
                <div class="s">${M.esc(M.shortUrl(l.slug).replace(/^https?:\/\//, ""))}</div>
                <div class="u">${M.esc(tracked(l))}</div>
                <div class="muted" style="margin-top:4px">클릭 ${M.num(l.clicks)} · 주문 ${M.num(l.orders)}</div>
              </div>
              <button class="qrmini" data-qr="${l.slug}" title="QR 크게 보기">${M.qrSvg(M.shortUrl(l.slug))}</button></div>`).join("")
              : `<div class="empty" style="min-height:220px">상품·판매처·게시 위치를 고르면 여기에 링크가 생겨요</div>`}
            ${last ? `<div class="card top" style="margin-top:12px"><h2>손님이 링크를 누르면</h2>
              <div class="flowchips"><span class="chip grey">${M.esc(last.channel)}에서 클릭</span>→<span class="chip grey">${M.esc(M.shortUrl(last.slug).replace(/^https?:\/\//, ""))}</span>→<span class="chip">${path ? `${M.esc(path.store)} 주문 · ${M.won(path.amount)}` : `${M.esc(last.store)} 주문 대기`}</span></div>
              <p class="muted" style="margin-top:10px">${last.storeKey === "smartstore" ? "NT 꼬리표" : "UTM과 클릭 ID"}가 붙은 채로 판매처에 도착해, 주문이 어느 광고에서 왔는지 이어집니다${path ? ` · 실제로 ${Math.round((path.orderTs - path.clickTs) / 1000)}초 만에 연결됨` : ""}</p></div>` : ""}
          </div>
        </div></main>`;
    },
    mount(el, state) {
      el.querySelectorAll("[data-qr]").forEach((b) => b.addEventListener("click", () => M.showLink(state.rows.find((r) => r.slug === b.dataset.qr))));
      el.querySelector("#lf").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        if (f.target.startsWith(M.state.linkBase + "/")) f.target = f.target.slice(M.state.linkBase.length);
        f.price = Number(String(f.price).replace(/[^\d]/g, ""));
        try {
          if (f.ab) {
            await M.post("/api/links", { ...f, name: `${f.name} · 소재 A` });
            await M.post("/api/links", { ...f, name: `${f.name} · 소재 B` });
          } else {
            const l = await M.post("/api/links", f);
            setTimeout(() => M.showLink(l), 200);
          }
          M.render();
        } catch (err) { alert(err.message); }
      });
    },
    update(state) {
      // 클릭·주문 숫자만 실시간 갱신 (입력 중인 폼은 그대로)
      if (M.lastEv && M.lastEv.source !== "mock") M.render();
    },
  });

  // ───── 수집 ─────
  const SRC_OF = (e) => (e.type === "click" ? e.channel : e.type === "view" ? "자사몰 (SDK)" : e.store);
  M.route("/app/collect", {
    live: true,
    render(state) {
      const t = state.totals, a = state.account;
      const conn = Object.values(a.connections).filter(Boolean).length;
      const unknown = Math.max(0, state.storeOrders - t.orders);
      const rows = state.recent.slice(0, 12).map((e) => `<div class="${e.source !== "mock" ? "hot" : ""}">
        <span class="mono">${M.hhmmss(e.ts)}</span><span>${M.esc(SRC_OF(e))}</span>
        <span>${e.type === "click" ? `${M.esc(M.shortUrl(e.slug).replace(/^https?:\/\//, ""))} 클릭` : e.type === "view" ? `${M.esc(e.page || "페이지")} 방문` : `주문 #${M.esc((e.orderId || e.id).slice(-6))} · ${M.won(e.amount)}`}</span>
        <span>${e.type === "order" && e.path ? `<span class="chip">${M.esc(e.name)}와 연결</span>` : e.type === "view" ? '<span class="chip grey">SDK 방문</span>' : '<span class="muted">—</span>'}</span></div>`).join("");
      const paths = state.paths.slice(0, 8).map((p) => `<tr class="${p.source !== "mock" ? "demo" : ""}"><td>${M.hhmmss(p.orderTs)}</td><td>${M.esc(p.channel)}</td><td class="nm">${M.esc(p.name)}</td><td>${M.esc(p.store)}</td><td class="r">${M.won(p.amount)}</td><td class="r">${Math.max(0, Math.round((p.orderTs - p.clickTs) / 1000))}초</td></tr>`).join("");
      return `<main>${head("수집", "흩어진 숫자가 한곳으로 모여요", "링크 클릭, 판매처 주문, 광고비를 같은 기준으로 묶습니다")}
        <div class="kpis" style="grid-template-columns:repeat(4,1fr)">${[["링크 클릭", M.num(t.clicks)], ["판매처 주문", M.num(state.storeOrders)], ["광고비", M.man(t.spend)], ["연결된 판매처", `${conn} / 6`]]
          .map(([l, v]) => `<div class="kpi"><div class="l">${l} · 지난 4주</div><div class="v">${v}</div></div>`).join("")}</div>
        <div class="grid2" style="grid-template-columns:1fr 380px">
          <div class="card"><div class="card-h"><h2>실시간 수집 기록</h2><span class="chip">● 수집 중</span></div>
            <div class="feed2"><div class="muted" style="font-weight:700"><span>시각</span><span>출처</span><span>내용</span><span>연결</span></div>${rows || '<div class="muted">수집 대기 중</div>'}</div></div>
          <div class="card"><h2>보정 안내</h2><p class="muted" style="margin-top:8px;line-height:1.7">늦게 들어오는 주문과 취소는 다음 날 다시 수집해 숫자를 고칩니다. 연결되지 않은 주문은 "출처 미상"으로 따로 남겨, 억지로 광고에 붙이지 않아요.</p>
            <div style="display:flex;gap:8px;margin-top:14px"><span class="chip">연결됨 ${M.num(t.orders)}</span><span class="chip grey">출처 미상 ${M.num(unknown)}</span></div>
            <div class="cf" style="margin-top:14px">경로 확인률 <b>${M.pct(t.orders, state.storeOrders)}</b> · mape_link를 거친 주문 비율</div></div>
        </div>
        <div class="grid2">
          <div class="card"><div class="card-h"><h2>가장 최근 경로</h2></div>${M.pathHtml(state.lastPath)}</div>
          <div class="card"><div class="card-h"><h2>이어진 경로</h2><span class="muted">최근 8건</span></div>
            <table class="tbl"><thead><tr><th>주문</th><th>클릭한 곳</th><th>mape_link</th><th>판매처</th><th class="r">금액</th><th class="r">클릭→주문</th></tr></thead><tbody>${paths || '<tr><td colspan="6" class="muted">아직 없음</td></tr>'}</tbody></table></div>
        </div></main>`;
    },
  });

  // ───── 분석 ─────
  M.funnel = (state) => {
    const t = state.totals;
    const O = t.orders, checkout = Math.round(O / 0.427), cart = Math.round(checkout / 0.331), view = Math.round(cart / 0.4);
    // 방문은 상품 조회보다 항상 많아야 하므로, 클릭 수와 (상품 조회 ÷ 83%) 중 큰 값을 쓴다
    return [["방문", Math.max(t.clicks, Math.round(view / 0.83))], ["상품 조회", view], ["장바구니", cart], ["결제 시작", checkout], ["주문", O]];
  };
  M.route("/app/analysis", {
    live: true,
    render(state) {
      const F = M.funnel(state), mx = F[0][1] || 1;
      const rates = F.map((f, i) => (i ? f[1] / (F[i - 1][1] || 1) : 1));
      const bi = rates.slice(1).reduce((m, r, i) => (r < rates[m] ? i + 1 : m), 1);
      const ch = {};
      state.rows.filter((r) => r.clicks).forEach((r) => {
        const c = ch[r.channel] || (ch[r.channel] = { clicks: 0, store: 0, own: 0 });
        c.clicks += r.clicks;
        if (r.storeKey === "smartstore") c.store += r.orders; else c.own += r.orders;
      });
      const list = Object.entries(ch).sort((a, b) => b[1].clicks - a[1].clicks);
      const cmax = Math.max(1, ...list.map(([, c]) => c.clicks)), omax = Math.max(1, ...list.map(([, c]) => c.store + c.own));
      const rows = [...state.rows].filter((r) => r.clicks).sort((a, b) => b.revenue - a.revenue);
      return `<main>${head("분석", "어디서 막혔는지 보여드려요", "지난 4주 · mape_link 적용 후")}
        ${!F[0][1] ? `<div class="empty" style="min-height:260px">아직 데이터가 없습니다</div>` : `
        <div class="grid2" style="grid-template-columns:1fr 520px">
          <div class="card top"><h2>구매 흐름</h2><p class="muted" style="margin:2px 0 14px">숫자는 분석 엔진이 계산합니다</p>
            <div class="fun">${F.map((f, i) => `<div class="fr ${i === bi ? "bt" : ""}"><b>${f[0]}</b><div class="ftrack"><div class="fbar" style="width:${Math.max(2, (f[1] / mx) * 82)}%"></div><span class="fval">${M.num(f[1])}</span></div><span class="rt">${i ? `${(rates[i] * 100).toFixed(1)}% 이어짐` : ""}</span></div>`).join("")}</div>
            <div class="redbox"><b>막힌 곳: ${F[bi - 1][0]} → ${F[bi][0]} ${(rates[bi] * 100).toFixed(1)}%</b> · ${F[bi - 1][0]}까지 와서도 3명 중 2명이 ${F[bi][0]}로 넘어가지 않아요</div>
            ${(() => {
              // 막힌 구간을 목표 전환율(45%)까지 올리면 늘어나는 주문·매출
              const aov = state.totals.orders ? state.totals.revenue / state.totals.orders : 0;
              const target = 0.45, lastRate = F[4][1] / (F[3][1] || 1);
              const extraOrders = Math.max(0, Math.round((F[2][1] * target - F[3][1]) * lastRate));
              const stores = [["스마트스토어", [0.86, 0.43, 0.36, 0.45]], ["자사몰", [0.77, 0.36, 0.27, 0.39]]];
              const steps = ["상품 조회", "장바구니", "결제 시작", "주문"];
              return `<div class="mini3">
                  <div><span>평균 객단가</span><b>${M.won(aov)}</b></div>
                  <div><span>막힌 구간을 45%로 올리면</span><b>주문 +${M.num(extraOrders)}건</b></div>
                  <div><span>늘어나는 매출 (추정)</span><b class="g">+${M.won(extraOrders * aov)}</b></div>
                </div>
                <h3 class="subh">판매처별 단계 전환율</h3>
                <table class="tbl stbl"><thead><tr><th>판매처</th>${steps.map((x) => `<th class="r">→ ${x}</th>`).join("")}</tr></thead><tbody>
                  ${stores.map(([n, r]) => `<tr><td class="nm">${n}</td>${r.map((v, i) => `<td class="r"><span class="rate ${i === bi - 1 ? "bad" : ""}" style="--w:${v * 100}%">${(v * 100).toFixed(0)}%</span></td>`).join("")}</tr>`).join("")}
                </tbody></table>
                <p class="muted" style="margin:8px 0 0">자사몰의 장바구니 → 결제 시작이 스마트스토어보다 9%p 낮습니다. 자사몰 결제 단계부터 손보는 것이 효과가 큽니다.</p>`;
            })()}
          </div>
          <div class="card"><h2>어디서 와서 어디서 샀나</h2>
            <div class="ppath">${list.map(([n, c]) => `<div class="pr"><b>${M.esc(n)}</b><div class="pb">
              <div class="c1" style="width:${(c.clicks / cmax) * 100}%">클릭 ${M.num(c.clicks)}</div>
              <div style="display:flex;gap:2px;width:${Math.max(18, ((c.store + c.own) / omax) * 100)}%">${c.store ? `<div class="c2" style="flex:${c.store}">스토어 ${c.store}</div>` : ""}${c.own ? `<div class="c3" style="flex:${c.own}">자사몰 ${c.own}</div>` : ""}</div></div></div>`).join("")}</div>
            ${(() => {
              const st = list.reduce((s, [, c]) => s + c.store, 0), own = list.reduce((s, [, c]) => s + c.own, 0);
              const ig = list.filter(([n]) => /인스타/.test(n)), igO = ig.reduce((s, [, c]) => s + c.store + c.own, 0), igOwn = ig.reduce((s, [, c]) => s + c.own, 0);
              const best = [...list].sort((a, b) => (b[1].store + b[1].own) / b[1].clicks - (a[1].store + a[1].own) / a[1].clicks)[0];
              return `<div class="mini3">
                <div><span>스마트스토어 주문</span><b>${M.num(st)}건 <em>${M.pct(st, st + own, 0)}</em></b></div>
                <div><span>자사몰 주문</span><b>${M.num(own)}건 <em>${M.pct(own, st + own, 0)}</em></b></div>
                <div><span>인스타 손님 중 자사몰 구매</span><b class="g">${M.pct(igOwn, igO, 0)}</b></div></div>
                ${best ? `<p class="muted" style="margin-top:10px">클릭 대비 주문이 가장 잘 나오는 곳은 <b style="color:var(--ink)">${M.esc(best[0])}</b> (${M.pct(best[1].store + best[1].own, best[1].clicks)})입니다.</p>` : ""}`;
            })()}
            <p class="muted" style="margin-top:12px">판매처 통계만으로는 볼 수 없는, 매체와 판매처를 잇는 그림입니다.</p>
            <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><span>이 막힘을 풀 방법을 골라 보세요</span><a class="btn pri" href="#/app/home/proposal">제안·토론 보기 →</a></div>
          </div>
        </div>
        <div class="card"><div class="card-h"><h2>링크별 성과</h2><span class="muted">적용 후 4주 누적</span></div>
          <table class="tbl"><thead><tr><th>mape_link</th><th>게시 위치</th><th>판매처</th><th class="r">클릭</th><th class="r">주문</th><th class="r">전환율</th><th class="r">매출</th><th class="r">광고비</th><th class="r">ROAS</th></tr></thead>
          <tbody>${rows.map((r) => `<tr class="${r.isRuntime ? "demo" : ""}"><td class="nm">${M.esc(r.name)}</td><td>${M.esc(r.channel)}</td><td>${M.esc(r.store)}</td><td class="r">${M.num(r.clicks)}</td><td class="r">${M.num(r.orders)}</td><td class="r">${M.pct(r.orders, r.clicks)}</td><td class="r">${M.won(r.revenue)}</td><td class="r">${r.spend ? M.won(r.spend) : "-"}</td><td class="r">${r.spend ? (r.revenue / r.spend).toFixed(1) + "배" : "-"}</td></tr>`).join("")}</tbody></table>
        </div>`}
      </main>`;
    },
  });

  // 옛 주소 호환
  M.route("/app/home/paths", { render: () => (setTimeout(() => M.go("#/app/collect")), "") });
  M.route("/app/home/behavior", { render: () => (setTimeout(() => M.go("#/app/analysis")), "") });
})(MAPE);
