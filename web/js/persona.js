// mape_persona: 세 관점 예산 배분 엔진 + 제안 / 세 관점 토론 / 예산 배분 화면
// 원칙: 숫자는 엔진이 계산하고, 페르소나는 해석만 한다. 목표는 토론이 끝난 뒤 쟁점 판정에만 쓴다.
(function (M) {
  const P = {
    perf: { key: "perf", name: "성과 관점", short: "성", cls: "p-perf", goal: "conv", desc: "단기 ROAS·주문 효율을 본다. 이미 일어난 성과만 믿는다." },
    brand: { key: "brand", name: "브랜드 관점", short: "브", cls: "p-brand", goal: "brand", desc: "도달·반복 노출·장기 자산을 본다. 단기 성과는 약하다." },
    exp: { key: "exp", name: "실험 관점", short: "실", cls: "p-exp", goal: "explore", desc: "한계효용이 꺾이는 곳에서 돈을 떼어 새 채널을 시험한다. 안정성은 낮다." },
  };
  M.PERSONAS = P;
  const NEW_CH = "유튜브 쇼츠 (미진입)";

  const round10k = (v) => Math.round(v / 10000) * 10000;

  function normalize(w, budget) {
    const keys = Object.keys(w);
    const sum = keys.reduce((s, k) => s + w[k], 0) || 1;
    const out = {};
    keys.forEach((k) => (out[k] = round10k((w[k] / sum) * budget)));
    // 반올림 오차는 가장 큰 칸에서 정리
    const diff = budget - keys.reduce((s, k) => s + out[k], 0);
    const big = keys.reduce((a, b) => (out[a] >= out[b] ? a : b));
    out[big] += diff;
    return out;
  }

  // 엔진: 같은 데이터 → 세 가지 해석 방법론 → 배분안
  // 배분 계산은 30일 누적 데이터 기준 월 1회 결정이라, 같은 연결 상태에서는 한 번 계산한 값을 고정해 쓴다
  // (실시간 목업 이벤트 때문에 토론 문장과 표의 숫자가 어긋나지 않게)
  let snap = null;
  function snapshotRows(state) {
    const key = JSON.stringify(state.account.connections) + state.account.linksApplied;
    if (!snap || snap.key !== key) snap = { key, rows: JSON.parse(JSON.stringify(state.rows)) };
    return snap.rows;
  }

  M.engine = function (state, goalOverride) {
    const budget = state.account.budget || 3000000;
    const goal = goalOverride || state.account.goal;
    const paid = snapshotRows(state).filter((r) => r.tracking && r.spend > 0);
    if (!paid.length) return null;
    const ch = {};
    paid.forEach((r) => {
      const c = ch[r.channel] || (ch[r.channel] = { channel: r.channel, spend: 0, revenue: 0, clicks: 0, orders: 0, impressions: 0, brand: r.brand });
      c.spend += r.spend; c.revenue += r.revenue; c.clicks += r.clicks; c.orders += r.orders; c.impressions += r.impressions || 0;
    });
    const list = Object.values(ch);
    const totalSpend = list.reduce((s, c) => s + c.spend, 0);
    list.forEach((c) => {
      c.roas = c.spend ? c.revenue / c.spend : 0;
      c.share = c.spend / totalSpend;
      c.cvr = c.clicks ? c.orders / c.clicks : 0;
      c.cpm = c.impressions ? (c.spend / c.impressions) * 1000 : 0;
      // 지출-주문 기울기: 점유율이 클수록 체감 (로그 포화 가정)
      c.slope = c.roas * (1 - c.share) * 0.9;
    });
    const names = list.map((c) => c.channel);
    const all = [...names, NEW_CH];
    const zero = Object.fromEntries(all.map((k) => [k, 0]));

    const current = { ...zero, ...normalize(Object.fromEntries(list.map((c) => [c.channel, c.spend])), budget) };
    current[NEW_CH] = 0;

    // 성과: ROAS 제곱 비례
    const perf0 = { ...zero, ...normalize(Object.fromEntries(list.map((c) => [c.channel, Math.pow(c.roas, 2)])), budget) };
    // 브랜드: 노출 × 브랜드 적합도 비례
    const brand = { ...zero, ...normalize(Object.fromEntries(list.map((c) => [c.channel, c.impressions * c.brand])), budget) };
    // 실험: 현재 배분에서 15%는 미진입 채널로, 10%는 기울기가 가장 가파른 곳으로
    const steep = list.reduce((a, b) => (a.slope >= b.slope ? a : b)).channel;
    const expW = Object.fromEntries(list.map((c) => [c.channel, c.spend * 0.75]));
    expW[steep] += totalSpend * 0.1;
    expW[NEW_CH] = totalSpend * 0.15;
    const exp = { ...zero, ...normalize(expW, budget) };

    // 토론 중 입장 변경: 성과 관점이 기울기 둔화 근거를 받아들여 최고 ROAS 채널을 10만 원 줄임
    const top = list.reduce((a, b) => (a.roas >= b.roas ? a : b));
    const second = list.filter((c) => c !== top).reduce((a, b) => (a.roas >= b.roas ? a : b));
    const perf = { ...perf0 };
    perf[top.channel] -= 100000; perf[second.channel] += 100000;

    const plans = { perf, brand, exp };
    const min = {}, max = {};
    all.forEach((k) => {
      const vals = [perf[k], brand[k], exp[k]];
      min[k] = Math.min(...vals); max[k] = Math.max(...vals);
    });
    const consensus = all.reduce((s, k) => s + min[k], 0);
    const remainder = budget - consensus;

    // 목표 판정: 각 관점의 (안 − 합의) 를 목표 가중치로 섞는다
    const g = { perf: goal.conv, brand: goal.brand, exp: goal.explore };
    const gs = g.perf + g.brand + g.exp || 1;
    const final = {};
    all.forEach((k) => {
      final[k] = min[k] + ["perf", "brand", "exp"].reduce((s, p) => s + (g[p] / gs) * (plans[p][k] - min[k]), 0);
    });
    const fin = normalize(final, budget);

    // 쟁점: 관점 간 차이가 큰 위치
    const issues = all
      .map((k) => {
        const hi = Object.keys(plans).reduce((a, b) => (plans[a][k] >= plans[b][k] ? a : b));
        const lo = Object.keys(plans).reduce((a, b) => (plans[a][k] <= plans[b][k] ? a : b));
        return { channel: k, spread: max[k] - min[k], hi, lo, hiV: plans[hi][k], loV: plans[lo][k] };
      })
      .filter((i) => i.spread >= 100000)
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 3);

    return { budget, goal, list, all, current, plans, perf0, min, max, consensus, remainder, final: fin, issues, steep, top, second, NEW_CH };
  };

  // 반사실: 목표가 달랐다면
  M.counterfactual = function (state, E) {
    const g = state.account.goal;
    const alt = g.conv >= g.brand ? { conv: 30, brand: 60, explore: 10, label: "브랜드 우선(30/60/10)" } : { conv: 60, brand: 30, explore: 10, label: "매출 우선(60/30/10)" };
    const E2 = M.engine(state, alt);
    const k = E.all.reduce((a, b) => (Math.abs(E2.final[a] - E.final[a]) >= Math.abs(E2.final[b] - E.final[b]) ? a : b));
    return `${alt.label}이었다면 ${k}는 ${M.man(E.final[k])} 대신 ${M.man(E2.final[k])}이었을 것`;
  };

  const issueQuestion = (i) => {
    const q = { perf: "주문 효율을 지킬까", brand: "도달을 넓힐까", exp: "새 채널을 시험할까" };
    return `${i.channel}: ${P[i.hi].name} ${M.man(i.hiV)} vs ${P[i.lo].name} ${M.man(i.loV)} — ${q[i.hi]}, ${q[i.lo]}?`;
  };

  function miniAlloc(plan, E, cls) {
    const max = Math.max(...E.all.map((k) => plan[k]));
    return `<div class="alloc-mini ${cls}">${E.all.map((k) => `<div class="am"><span>${M.esc(k)}</span><div class="t"><div class="f" style="width:${(plan[k] / max) * 100}%"></div></div><span class="v">${M.man(plan[k])}</span></div>`).join("")}</div>`;
  }

  const noData = () => `<main><div class="empty" style="min-height:300px">mape_link를 광고에 적용하고 경로 데이터가 쌓이면 세 관점이 배분안을 만듭니다<br><a class="btn pri" style="margin-top:12px" href="#/setup/4">mape_link 적용</a></div></main>`;

  const crumb = (t) => `<div class="crumb"><a href="#/app/home">홈</a> / ${t}</div>`;

  // ───── 제안 ─────
  const SEG = ["#1D2420", "#2E6FD8", "#C77A0A", "#23A04A", "#9a3fa8", "#C13584", "#8a948f"];
  // 배분 막대: 막대 안에는 비율만(충분히 넓을 때), 이름과 금액은 아래 범례로
  M.allocBar = (plan, E) => {
    const keys = E.all.filter((k) => plan[k] > 0).sort((a, b) => plan[b] - plan[a]);
    const col = (k) => SEG[E.all.indexOf(k) % SEG.length];
    const pct = (k) => Math.round((plan[k] / E.budget) * 100);
    return `<div class="alloc">${keys.map((k) => `<div style="flex:${plan[k]};background:${col(k)}" title="${M.esc(k)} ${M.man(plan[k])} (${pct(k)}%)">${pct(k) >= 12 ? pct(k) + "%" : ""}</div>`).join("")}</div>
      <div class="alegend">${keys.map((k) => `<div><i style="background:${col(k)}"></i><span>${M.esc(k.replace(" (미진입)", " *"))}</span><b>${M.man(plan[k])}</b><em>${pct(k)}%</em></div>`).join("")}</div>`;
  };

  M.route("/app/home/proposal", {
    render(state) {
      const E = M.engine(state);
      if (!E) return noData();
      const g = state.account.goal;
      const F = M.funnel(state);
      const low = E.list.reduce((a, b) => (a.roas <= b.roas ? a : b));
      const O = state.totals.orders;
      const r = (lo, hi) => `+${Math.max(1, Math.round(O * lo))} ~ +${Math.max(2, Math.round(O * hi))}건`;
      const props = [
        { n: "1안", t: "결제 페이지 쿠폰 문구 수정", why: `장바구니 → 결제 시작이 ${((F[3][1] / F[2][1]) * 100).toFixed(1)}%로 가장 크게 막힙니다 [분석]`, exp: `예상 주문 ${r(0.04, 0.07)}`, need: "쿠폰 문구 2종, 결제 페이지 수정 권한", con: "광고비 배분은 그대로라 신규 유입은 늘지 않음" },
        { n: "2안", t: `${low.channel} 예산 일부를 유튜브 쇼츠 시험으로`, why: `${low.channel} ROAS ${low.roas.toFixed(1)}배로 가장 낮고, 기존 위치는 기울기가 둔화 중 [3]`, exp: `예상 주문 −${Math.max(1, Math.round(O * 0.01))} ~ +${Math.max(2, Math.round(O * 0.03))}건`, need: "쇼츠 소재 1개, 새 mape_link", con: "4주간 성과가 불안정할 수 있음" },
        { n: "3안", t: `${E.top.channel} 키워드 정리 · 클릭당 비용 상한`, why: `${E.top.channel} 클릭당 비용 7일 +12%, 전환율은 그대로 [4]`, exp: `예상 주문 ${r(0.02, 0.045)}`, need: "키워드 목록 정리, 입찰 상한 설정", con: "노출이 줄어 브랜드 검색이 약해질 수 있음" },
      ];
      const lines = {
        perf: `ROAS가 가장 높은 ${E.top.channel}(${E.top.roas.toFixed(1)}배)과 ${E.second.channel} 중심으로 모읍니다.`,
        brand: `노출이 넓은 위치에 더 싣고, 검색광고는 지금보다 줄입니다.`,
        exp: `기존 배분에서 15%를 떼어 유튜브 쇼츠를 4주간 시험하고, 기울기가 가파른 ${E.steep}에 10%를 더합니다.`,
      };
      const titles = { perf: "효율 집중", brand: "도달 확대", exp: "새 채널 시험" };
      return `<main>
        <div class="ttl2"><div><div class="num2">제안</div><h1>다음 4주, 세 관점이 함께 고민해요</h1></div><p>목표: 신규 주문 ${g.conv} · 브랜드 ${g.brand} · 실험 ${g.explore}</p></div>
        <div class="prop">${props.map((p, i) => `<div class="card ${i === 0 ? "sel" : ""}">
          <span class="chip ${i === 1 ? "grey" : ""}" style="align-self:flex-start">${p.n}</span><b style="font-size:17px">${M.esc(p.t)}</b>
          <dl><dt>근거</dt><dd>${M.esc(p.why)}</dd><dt>예상 범위</dt><dd><b>${p.exp}</b></dd><dt>필요한 것</dt><dd>${M.esc(p.need)}</dd><dt>단점</dt><dd>${M.esc(p.con)}</dd></dl>
          <div style="display:flex;gap:8px;margin-top:auto;padding-top:8px"><button class="btn sm pri" data-pick="${i}">이 안 고르기</button><a class="btn sm" href="#/app/home/debate">전문가에게 묻기</a></div></div>`).join("")}</div>

        <div class="card-h" style="margin-top:8px"><h2>예산 배분 · 세 관점이 같은 데이터를 다르게 해석한 안</h2><a class="btn sm" href="#/app/home/debate">세 관점 토론 보기 →</a></div>
        <div class="grid3">${["perf", "brand", "exp"].map((k) => `
          <div class="card plan ${P[k].cls}"><div class="who">${P[k].name}</div><h3>${titles[k]}</h3><p>${lines[k]}</p>${miniAlloc(E.plans[k], E, P[k].cls)}</div>`).join("")}</div>
        <div class="grid2" style="grid-template-columns:1fr 1fr 1.4fr">
          <div class="card agree"><b style="color:var(--green-d)">합의</b><p style="margin:6px 0 0;line-height:1.6">세 안 모두 동의한 <b>${M.won(E.consensus)}</b> · ${E.all.filter((k) => E.min[k] > 0).map((k) => `${k} ${M.man(E.min[k])}`).join(", ")}</p></div>
          <div class="card issue2"><b style="color:#E03A3A">쟁점</b><p style="margin:6px 0 0;line-height:1.6">${E.issues.map((i) => `${i.channel}: ${P[i.hi].name.replace(" 관점", "")} ${M.man(i.hiV)} vs ${P[i.lo].name.replace(" 관점", "")} ${M.man(i.loV)}`).join("<br>")}</p></div>
          <div class="card top"><h2>목표로 판정한 예산 배분</h2><p class="muted" style="margin:2px 0 4px">쟁점은 AI가 아니라 목표 비중이 판정합니다 · 월 ${M.man(E.budget)} 원</p>${M.allocBar(E.final, E)}
            <p style="margin:10px 0 0;font-size:13px">반사실: ${M.esc(M.counterfactual(state, E))}</p>
            <div style="display:flex;gap:8px;margin-top:10px"><a class="btn sm pri" href="#/app/home/budget">예산 배분 결과 보기</a></div></div>
        </div>
        <p class="foot-note">숫자(ROAS, 노출, 기울기, 배분액, 예상 범위)는 분석 엔진이 계산하고, 세 관점은 해석과 근거 서술만 합니다.</p>
      </main>`;
    },
    mount(el, state) {
      el.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
        const card = b.closest(".card");
        el.querySelectorAll(".prop .card").forEach((c) => c.classList.toggle("sel", c === card));
        M.approve(card.querySelector(".chip").textContent, card.querySelector("b").textContent);
      }));
    },
  });

  // ───── 세 관점 토론: 대화하면서 배분안이 실제로 바뀌는 과정 ─────
  function evidence(E) {
    const list = E.list;
    const byRoas = [...list].sort((a, b) => b.roas - a.roas);
    const byImp = [...list].sort((a, b) => b.impressions - a.impressions);
    return [
      { n: 1, t: "위치별 ROAS", d: byRoas.map((c) => `${c.channel} ${c.roas.toFixed(1)}배`).join(" · ") },
      { n: 2, t: "위치별 노출(추정)", d: byImp.map((c) => `${c.channel} ${M.num(c.impressions)}회`).join(" · ") },
      { n: 3, t: "지출-주문 기울기", d: `${E.top.channel}은 광고비 점유율 ${(E.top.share * 100).toFixed(0)}%로 체감 구간, 가장 가파른 곳은 ${E.steep}` },
      { n: 4, t: "최근 7일 추세", d: `${E.top.channel} 클릭당 비용 12% 상승, 전환율은 변화 없음` },
      { n: 5, t: "위치별 전환율", d: list.map((c) => `${c.channel} ${(c.cvr * 100).toFixed(1)}%`).join(" · ") },
    ];
  }

  const STAGES = ["독립 배분", "반박", "근거 있는 수정", "합의·쟁점 추출", "목표 판정"];

  function planText(plan, E) {
    return E.all.filter((k) => plan[k] > 0).sort((a, b) => plan[b] - plan[a]).map((k) => `${k.replace(" (미진입)", "")} ${M.man(plan[k])}`).join(", ");
  }

  function script(E, state) {
    const reels = E.list.find((c) => /릴스/.test(c.channel)) || E.list[0];
    const story = E.list.find((c) => /스토리/.test(c.channel)) || E.list[1] || E.list[0];
    const bTop = Object.keys(E.plans.brand).reduce((a, b) => (E.plans.brand[a] >= E.plans.brand[b] ? a : b));
    const g = state.account.goal;
    const perfBefore = { ...E.perf0 };
    return [
      { stage: 1, sys: `1단계 · 독립 배분 — 세 관점이 서로의 안을 보지 않고, 같은 데이터(근거 1~5)로 월 ${M.won(E.budget)}을 각자 나눕니다. 사장님 목표는 아직 비공개입니다.` },
      { p: "perf", set: { perf: perfBefore }, t: `제 배분은 ${planText(perfBefore, E)}입니다. ROAS가 높은 순서대로 몰았습니다 [1]. ${reels.channel}은 ${reels.roas.toFixed(1)}배라 최소한만 남깁니다.` },
      { p: "brand", set: { brand: E.plans.brand }, t: `제 배분은 ${planText(E.plans.brand, E)}입니다. 노출이 가장 넓은 ${bTop}에 가장 많이 싣습니다 [2]. 검색광고는 이미 찾는 사람만 잡으니 지금보다 줄입니다.` },
      { p: "exp", set: { exp: E.plans.exp }, t: `제 배분은 ${planText(E.plans.exp, E)}입니다. 기존 배분의 15%를 떼어 유튜브 쇼츠를 4주 시험하고, 기울기가 가장 가파른 ${E.steep}에 10%를 더합니다 [3].` },
      { stage: 2, sys: "2단계 · 반박 — 세 배분안을 서로 공개합니다. 근거 번호로만 반박할 수 있습니다." },
      { p: "perf", t: `브랜드 관점은 ${reels.channel}에 ${M.man(E.plans.brand[reels.channel])}을 넣었는데, ${reels.channel} 전환율은 ${(reels.cvr * 100).toFixed(1)}%로 ${story.channel} ${(story.cvr * 100).toFixed(1)}%보다 낮습니다 [5]. 노출이 주문으로 안 이어지면 비용입니다.` },
      { p: "brand", t: `ROAS는 이미 일어난 일만 셉니다. 노출이 만든 검색 수요는 검색광고 성과로 잡혀서 노출 쪽 공이 보이지 않습니다. 성과 관점의 ${E.top.channel} ${M.man(perfBefore[E.top.channel])}은 그 착시 위에 있습니다.` },
      { p: "exp", t: `성과 관점에 근거를 하나 더하겠습니다. ${E.top.channel} 클릭당 비용이 최근 7일 12% 올랐습니다 [4]. 기울기도 꺾이는 구간이라 [3], 같은 돈을 더 넣어도 주문이 비례해서 늘지 않습니다.` },
      { p: "perf", t: `실험 관점의 유튜브 쇼츠 ${M.man(E.plans.exp[E.NEW_CH])}은 데이터가 하나도 없는 곳입니다. 근거가 무엇입니까?` },
      { p: "exp", t: `데이터가 없다는 것이 제 관점의 전제입니다. 기존 위치의 한계효용이 줄어드는 만큼만 떼어 [3], 4주 뒤 검증에서 채점받겠습니다.` },
      { stage: 3, sys: "3단계 · 근거 있는 수정 — 새 근거를 받아들인 관점만 배분을 바꿀 수 있습니다. 근거 번호 없이 상대 쪽으로 움직이면 동조로 보고 발언을 다시 생성합니다." },
      { p: "perf", set: { perf: E.plans.perf }, stance: "chg", refs: "[3][4]", t: `기울기 둔화 [3]와 클릭당 비용 상승 [4]는 받아들입니다. ${E.top.channel}을 ${M.man(perfBefore[E.top.channel])} → ${M.man(E.plans.perf[E.top.channel])}으로 낮추고, 그만큼 ${E.second.channel}으로 옮깁니다.` },
      { regen: `동조 감지 · 브랜드 관점의 첫 수정 발언이 근거 번호 없이 ${E.top.channel} 금액을 성과 관점 쪽으로 올렸습니다 → 발언 재생성` },
      { p: "brand", stance: "keep", t: `다시 말씀드리면, 새로 나온 근거 [4]는 검색광고 비용 이야기라 노출 배분을 바꿀 이유가 아닙니다. 제 배분은 그대로 갑니다.` },
      { p: "exp", stance: "keep", t: `제 안도 유지합니다. 성과 관점의 수정은 제 근거 [3][4]를 받아들인 것이라 제 배분을 바꿀 새 근거는 없습니다.` },
      { stage: 4, show: "min", sys: `4단계 · 합의·쟁점 추출 — 위치마다 세 안 중 가장 작은 금액은 셋 다 동의한 돈입니다. 합의 베이스라인 ${M.won(E.consensus)}, 남은 ${M.won(E.remainder)}이 쟁점입니다.` },
      ...E.issues.map((i, n) => ({ issue: `쟁점 ${n + 1} · ${i.channel}: ${P[i.hi].name} ${M.man(i.hiV)} vs ${P[i.lo].name} ${M.man(i.loV)}` })),
      { stage: 5, show: "final", sys: `5단계 · 목표 판정 — 이제 사장님 목표(단기 매출 ${g.conv} / 브랜드 ${g.brand} / 탐색 ${g.explore})를 꺼냅니다. AI가 아니라 목표가 쟁점을 판정합니다.` },
      { sys: `최종 배분: ${planText(E.final, E)} · 반사실: ${M.counterfactual(state, E)}`, final: true },
    ];
  }

  const fmtRefs = (t) => M.esc(t).replace(/\[(\d)\]/g, '<span class="ev" data-ev="$1">[$1]</span>');

  function msgHtml(m) {
    if (m.sys) return `<div class="msg sys"><div class="bd">${M.esc(m.sys)}${m.final ? `<br><a class="btn sm pri" style="margin-top:10px" href="#/app/home/budget">예산 배분 결과 보기</a>` : ""}</div></div>`;
    if (m.issue) return `<div class="msg sys"><div class="bd" style="border-left:4px solid var(--accent);text-align:left;color:var(--ink)">${M.esc(m.issue)}</div></div>`;
    if (m.regen) return `<div class="msg sys"><div class="bd" style="color:var(--accent);border-color:var(--accent)">⟳ ${M.esc(m.regen)}</div></div>`;
    if (m.user) return `<div class="msg user"><div class="bd">${M.esc(m.user)}</div></div>`;
    const p = P[m.p];
    const st = m.stance === "chg" ? `<span class="stance chg">입장 변경 · 근거 ${m.refs}</span>` : m.stance === "keep" ? `<span class="stance keep">입장 유지</span>` : "";
    return `<div class="msg ${p.cls}"><div class="av">${p.short}</div><div><div class="bd"><div class="nm">${p.name} ${st}</div>${fmtRefs(m.t)}</div></div></div>`;
  }

  function boardHtml(E, b, changed) {
    const col = (k) => (b[k] ? (x) => M.man(b[k][x]) : () => '<span class="muted">대기</span>');
    const cls = (k, x) => (changed && changed[k] && changed[k].includes(x) ? " chg" : "");
    return `<table class="tbl board">
      <thead><tr><th>위치</th><th class="r perf">성과</th><th class="r brand">브랜드</th><th class="r exp">실험</th>
        ${b.min ? '<th class="r">합의</th>' : ""}${b.final ? '<th class="r">최종</th>' : ""}</tr></thead>
      <tbody>${E.all.map((x) => `<tr><td class="nm">${M.esc(x.replace(" (미진입)", " *"))}</td>
        ${["perf", "brand", "exp"].map((k) => `<td class="r${cls(k, x)}">${col(k)(x)}</td>`).join("")}
        ${b.min ? `<td class="r min">${M.man(E.min[x])}</td>` : ""}${b.final ? `<td class="r fin">${M.man(E.final[x])}</td>` : ""}</tr>`).join("")}</tbody>
      <tfoot><tr><td class="nm">합계</td>${["perf", "brand", "exp"].map((k) => `<td class="r">${b[k] ? M.man(E.all.reduce((s, x) => s + b[k][x], 0)) : "-"}</td>`).join("")}
        ${b.min ? `<td class="r min">${M.man(E.consensus)}</td>` : ""}${b.final ? `<td class="r fin">${M.man(E.budget)}</td>` : ""}</tr></tfoot>
    </table><p class="muted" style="margin:8px 0 0">* 미진입 채널 · 단위 만 원</p>`;
  }

  function reply(q, E) {
    if (/성과|효율|roas|ROAS|파워링크|주문/.test(q)) return { p: "perf", t: `${E.top.channel}의 ROAS ${E.top.roas.toFixed(1)}배가 근거입니다 [1]. 다만 체감 구간이라 [3] ${M.man(E.plans.perf[E.top.channel])}으로 상한을 뒀습니다.` };
    if (/브랜드|노출|도달|릴스|스토리/.test(q)) return { p: "brand", t: `노출 순위가 근거입니다 [2]. 당장의 주문보다 다음 달 검색 수요를 보고 배분했습니다.` };
    if (/유튜브|실험|새|쇼츠|시험/.test(q)) return { p: "exp", t: `기존 위치의 기울기가 둔화되고 있어서입니다 [3]. 4주 뒤 검증에서 시험 결과를 채점합니다.` };
    return { sys: `세 관점 모두 같은 근거(1~5)를 봅니다. 성과·브랜드·실험 중 어느 관점에 묻는지 함께 적어 주세요.` };
  }

  let timer = null;
  M.route("/app/home/debate", {
    render(state) {
      const E = M.engine(state);
      if (!E) return noData();
      const ev = evidence(E);
      return `<main>
        ${crumb("세 관점 토론")}
        <div class="pagehead"><div><div class="num2">세 관점 토론</div><h1>세 관점 토론 · 예산 배분</h1><p class="sub">대화가 진행되는 동안 오른쪽 배분 보드가 실제로 바뀝니다. 입장 변경은 근거 번호가 있을 때만 허용됩니다.</p></div>
          <div style="display:flex;gap:8px"><button class="btn" id="replay">처음부터</button><button class="btn" id="skip">끝까지 보기</button><a class="btn pri" href="#/app/home/budget">예산 배분 결과</a></div></div>
        <div class="stepper" id="stepper">${STAGES.map((t, i) => `<div data-s="${i + 1}"><b>${i + 1}</b>${t}</div>`).join("")}</div>
        <div class="chat-wrap">
          <div class="chat">
            <div class="chat-log" id="log"></div>
            <div class="typing" id="typing"></div>
            <form class="chat-in" id="ask"><input id="q" placeholder="토론에 끼어들기 (예: 유튜브 쇼츠는 왜 시험해?)" autocomplete="off"><button>보내기</button></form>
          </div>
          <div>
            <div class="card" style="margin-bottom:12px"><div class="card-h"><h2>배분 보드</h2><span class="muted">월 ${M.won(E.budget)}</span></div><div id="board"></div></div>
            <div class="card"><div class="card-h"><h2>근거</h2><span class="muted">엔진 계산값</span></div>
              <div class="evlist">${ev.map((e) => `<div class="evitem" id="ev${e.n}"><b>[${e.n}] ${e.t}</b><br>${M.esc(e.d)}</div>`).join("")}</div>
            </div>
          </div>
        </div>
      </main>`;
    },
    mount(el, state) {
      const E = M.engine(state);
      if (!E) return;
      const log = el.querySelector("#log"), typing = el.querySelector("#typing"), boardEl = el.querySelector("#board");
      let msgs, i, b;
      const setStage = (n) => el.querySelectorAll("#stepper div").forEach((d) => {
        const s = Number(d.dataset.s);
        d.className = s < n ? "done" : s === n ? "on" : "";
      });
      const apply = (m) => {
        let changed = null;
        if (m.stage) setStage(m.stage);
        if (m.set) {
          changed = {};
          Object.entries(m.set).forEach(([k, v]) => {
            changed[k] = E.all.filter((x) => !b[k] || b[k][x] !== v[x]);
            b[k] = v;
          });
        }
        if (m.show) b[m.show] = true;
        boardEl.innerHTML = boardHtml(E, b, changed);
        log.insertAdjacentHTML("beforeend", msgHtml(m));
        log.scrollTop = log.scrollHeight;
        if (m.final) setStage(6);
      };
      const start = () => {
        clearTimeout(timer);
        msgs = script(E, state); i = 0; b = { perf: null, brand: null, exp: null, min: false, final: false };
        log.innerHTML = ""; setStage(0);
        boardEl.innerHTML = boardHtml(E, b);
        next();
      };
      const next = () => {
        if (!document.body.contains(log) || i >= msgs.length) { typing.textContent = ""; return; }
        const m = msgs[i++];
        typing.textContent = m.p ? `${P[m.p].name} 입력 중...` : "";
        timer = setTimeout(() => { apply(m); next(); }, m.p ? 1400 : 700);
      };
      el.querySelector("#replay").onclick = start;
      el.querySelector("#skip").onclick = () => { clearTimeout(timer); typing.textContent = ""; while (i < msgs.length) apply(msgs[i++]); };
      el.querySelector("#ask").addEventListener("submit", (e) => {
        e.preventDefault();
        const q = el.querySelector("#q").value.trim();
        if (!q) return;
        el.querySelector("#q").value = "";
        log.insertAdjacentHTML("beforeend", msgHtml({ user: q }));
        const r = reply(q, E);
        setTimeout(() => { log.insertAdjacentHTML("beforeend", msgHtml(r)); log.scrollTop = log.scrollHeight; }, 900);
        log.scrollTop = log.scrollHeight;
      });
      log.addEventListener("mouseover", (e) => {
        const n = e.target.dataset && e.target.dataset.ev;
        el.querySelectorAll(".evitem").forEach((x) => x.classList.toggle("hl", x.id === "ev" + n));
      });
      start();
    },
  });

  // ───── 예산 배분 판정 ─────
  M.route("/app/home/budget", {
    render(state) {
      const E = M.engine(state);
      if (!E) return noData();
      const g = state.account.goal;
      const rows = E.all.map((k) => `<tr>
        <td class="nm">${M.esc(k)}</td>
        <td class="r">${M.man(E.current[k])}</td>
        <td class="r">${M.man(E.plans.perf[k])}</td><td class="r">${M.man(E.plans.brand[k])}</td><td class="r">${M.man(E.plans.exp[k])}</td>
        <td class="r min">${M.man(E.min[k])}</td>
        <td class="r fin">${M.man(E.final[k])}</td></tr>`).join("");
      const tot = (o) => M.man(E.all.reduce((s, k) => s + o[k], 0));
      return `<main>
        ${crumb("예산 배분")}
        <div class="pagehead"><div><div class="num2">예산 배분</div><h1>예산 배분 판정</h1><p class="sub">AI가 판정하지 않습니다. 사장님이 정한 목표가 쟁점을 판정합니다.</p></div>
          <a class="btn" href="#/app/home/debate">토론 다시 보기</a></div>
        <div class="grid2 wide-left">
          <div class="card">
            <div class="card-h"><h2>위치별 배분 (월 ${M.won(E.budget)})</h2><span class="muted">단위 만 원</span></div>
            <table class="tbl alloc-tbl">
              <thead><tr><th>광고 위치</th><th class="r">지금</th><th class="r perf">성과</th><th class="r brand">브랜드</th><th class="r exp">실험</th><th class="r">합의(최소)</th><th class="r">최종</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr><td class="nm">합계</td><td class="r">${tot(E.current)}</td><td class="r">${tot(E.plans.perf)}</td><td class="r">${tot(E.plans.brand)}</td><td class="r">${tot(E.plans.exp)}</td><td class="r min">${M.man(E.consensus)}</td><td class="r fin">${tot(E.final)}</td></tr></tfoot>
            </table>
            <p class="foot-note">합의 = 위치마다 세 안 중 가장 작은 금액의 합 (평균이 아님). 최종 = 합의 + 남은 금액을 목표 비율로 각 관점의 주장에 나눔.</p>
          </div>
          <div class="card">
            <div class="card-h"><h2>목표 (판정 기준)</h2><span class="muted">바꾸면 바로 다시 판정</span></div>
            ${[["conv", "단기 매출", "perf"], ["brand", "브랜드", "brand"], ["explore", "새 채널 탐색", "exp"]].map(([k, l, p]) => `
              <div class="slider ${P[p].cls}"><span><span class="sw"></span>${l}</span><input type="range" min="0" max="100" step="5" value="${g[k]}" data-goal="${k}"><b>${g[k]}</b></div>`).join("")}
            ${M.allocBar(E.final, E)}
            <div class="verdict" style="margin-top:14px">합의 <b>${M.won(E.consensus)}</b>은 그대로 두고,<br>쟁점 <b>${M.won(E.remainder)}</b>을 목표 ${g.conv}/${g.brand}/${g.explore}로 판정했습니다.</div>
            <div class="cf"><b>반사실</b> · ${M.esc(M.counterfactual(state, E))}</div>
            <button class="btn pri" id="applyAlloc" style="margin-top:12px;width:100%;justify-content:center">이 판정안 적용 (직접 집행 후 검증에서 채점)</button>
          </div>
        </div>
        <div class="card"><div class="card-h"><h2>쟁점 (트레이드오프 질문)</h2><span class="muted">세 관점이 갈린 곳</span></div>
          ${E.issues.map((i) => `<div class="issue"><div class="q">${M.esc(issueQuestion(i))}</div><div class="a">최종 판정 ${M.man(E.final[i.channel])} — 목표에서 ${i.hi === "perf" ? "단기 매출" : i.hi === "brand" ? "브랜드" : "탐색"} 비중이 클수록 ${P[i.hi].name} 쪽으로 기웁니다.</div></div>`).join("")}
        </div>
      </main>`;
    },
    mount(el, state) {
      const ab = el.querySelector("#applyAlloc");
      if (ab) ab.addEventListener("click", () => {
        const E = M.engine(state);
        M.approve("배분", E.all.filter((k) => E.final[k] > 0).map((k) => `${k.replace(" (미진입)", "")} ${Math.round((E.final[k] / E.budget) * 100)}%`).join(" · "));
      });
      el.querySelectorAll("input[data-goal]").forEach((inp) => {
        inp.addEventListener("input", () => (inp.nextElementSibling.textContent = inp.value));
        inp.addEventListener("change", async () => {
          const goal = {};
          el.querySelectorAll("input[data-goal]").forEach((x) => (goal[x.dataset.goal] = Number(x.value)));
          await M.post("/api/account", { goal });
          M.render();
        });
      });
    },
  });
})(MAPE);
