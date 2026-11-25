// 소개 사이트(mape.kr) → 가입 → 첫 설정 1(상황) → 2(판매처·광고 연결) → 3(목표·광고비)
(function (M) {
  // ───── 소개 사이트 ─────
  M.route("/", {
    render(state) {
      const a = state.account;
      const cta = a.onboarded ? `<a class="btn pri" href="#/app/home">내 홈으로</a>` : `<a class="btn pri" href="#/signup">무료로 시작하기</a>`;
      return `
      <section class="hero"><div class="hero-in">
        <div>
          <h1>셀러를 위한<br><em>마케팅 의사결정</em> 서비스</h1>
          <p>스마트스토어, 자사몰, 인스타… 판매처마다 흩어진 클릭과 주문을<br>링크 하나로 잇고, 다음 달 광고비를 어디에 쓸지<br>세 관점의 근거와 함께 제안합니다.</p>
          ${cta} <a class="btn" href="javascript:void(0)" onclick="MAPE.scrollTo('features')">기능 보기</a>
        </div>
        <div class="flowpic">
          <div class="fp"><b>모으기</b><span>링크 클릭 · 판매처 주문 · 광고비</span></div>
          <div class="fp"><b>잇기</b><span>같은 mape_link로 클릭과 주문을 한 경로로</span></div>
          <div class="fp"><b>제안</b><span>성과·브랜드·실험 세 관점이 토론, 목표가 판정</span></div>
          <div class="fp"><b>검증</b><span>지난 제안이 맞았는지 다음 달 실데이터로 채점</span></div>
        </div>
      </div></section>

      <section class="section" id="features">
        <h2>판매처끼리는 서로의 데이터를 모릅니다</h2>
        <p class="sub">인스타는 클릭만, 스마트스토어는 주문만 압니다. MAPE는 그 사이를 잇는 데서 시작합니다.</p>
        <div class="feat">
          <div class="card" id="f-link"><code>mape_link</code><h3>추적 · 분석</h3><p>손님이 클릭한 곳과 주문한 판매처를 짧은 링크 하나로 잇습니다. 스마트스토어 NT, 자사몰 UTM 꼬리표는 자동으로 붙습니다.</p></div>
          <div class="card" id="f-persona"><code>mape_persona</code><h3>제안</h3><p>성과·브랜드·실험 세 관점이 같은 데이터로 토론합니다. 합의와 쟁점을 나누고, 쟁점은 사장님 목표가 판정합니다.</p></div>
          <div class="card" id="f-eye"><code>mape_eye</code><h3>모니터링</h3><p>광고가 걸린 실제 화면을 함께 보며 순위, 첫 화면 노출, 혜택 문구를 점검합니다.</p></div>
          <div class="card" id="f-duo"><code>mape_duo</code><h3>AI 어시스턴트</h3><p>모든 화면 오른쪽 아래에서 지금 보는 데이터에 대해 묻고, 근거 번호와 함께 답을 받습니다.</p></div>
        </div>
      </section>

      <section class="section" id="pricing" style="padding-top:0">
        <h2>요금</h2>
        <div class="plans">
          <div class="card"><h3>무료</h3><span class="muted">보여주기</span>
            <ol><li>mape_link 추적</li><li>경로 수집</li><li>행동 분석</li></ol></div>
          <div class="card on"><h3>프로</h3><span class="muted">제안 · 증명</span>
            <ol start="4"><li>제안 · 세 관점 토론 · 예산 배분</li><li>모니터링 (현장 점검)</li><li>검증 (적중 기록)</li></ol></div>
          <div class="card"><h3>대행사</h3><span class="muted">확장</span>
            <ol><li>여러 셀러 계정을 한 화면에서</li><li>셀러별 제안·검증 리포트</li><li>화이트라벨 보고서</li></ol></div>
        </div>
        <div style="margin-top:28px">${cta}</div>
      </section>`;
    },
  });

  // ───── 가입 ─────
  M.route("/signup", {
    render(state) {
      const u = state.account.user || {};
      return `<div class="setup signup">
        <h1>MAPE 시작하기</h1><p class="sub" style="margin-bottom:22px">가입은 30초면 끝납니다.</p>
        <form class="form" id="f">
          <label>이메일</label><input name="email" value="${M.esc(u.email || "seller@sunuri.kr")}">
          <label>비밀번호</label><input type="password" name="pw" value="mape-demo-pw">
          <label>스토어 이름</label><input name="shop" value="${M.esc(u.shop || "순우리 스토어")}">
          <button class="btn pri" style="width:100%;justify-content:center;margin-top:22px;padding:13px">가입하고 첫 설정 시작</button>
        </form></div>`;
    },
    mount(el) {
      el.querySelector("#f").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        await M.post("/api/account", { signedUp: true, user: { email: f.get("email"), shop: f.get("shop") } });
        M.go("#/setup/1");
      });
    },
  });

  const steps = (n) => `<div class="steps">${["상황 선택", "판매처 · 광고 연결", "목표 · 광고비", "mape_link 적용"].map((t, i) =>
    `<div class="${i + 1 === n ? "on" : i + 1 < n ? "done" : ""}">첫 설정 ${i + 1} · ${t}</div>`).join("")}</div>`;

  // ───── 첫 설정 1: 상황 선택 ─────
  const SITU = {
    who: [["seller", "🛒", "스마트스토어로 파는 셀러", "판매처 1~2곳, 광고는 직접 운영"], ["brand", "🏠", "자체 사이트로 파는 브랜드", "자사몰 중심, 이미지 배너 광고"], ["agency", "🧾", "마케팅을 대신하는 대행사", "여러 셀러 계정을 함께 관리"]],
    stores: [["1", "1곳"], ["2", "2곳"], ["3", "3곳 이상"]],
    spend: [["s", "100만 원 미만"], ["m", "100~500만 원"], ["l", "500만 원 이상"]],
  };
  M.route("/setup/1", {
    render(state) {
      const s = state.account.situation && state.account.situation.who ? state.account.situation : { who: "seller", stores: "2", spend: "m" };
      const pills = (key) => `<div class="pills" data-group="${key}">${SITU[key].map(([v, l]) => `<button type="button" class="pill ${s[key] === v ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>`;
      return `<div class="setup">${steps(1)}
        <h1>지금 어떤 상황인가요?</h1><p class="sub">상황에 맞는 시작 단계를 추천해 드려요.</p>
        <div class="choices" data-group="who" style="margin-top:20px">${SITU.who.map(([v, ic, b, d]) =>
          `<button type="button" class="choice ${s.who === v ? "on" : ""}" data-v="${v}"><span style="font-size:26px;display:block;margin-bottom:6px">${ic}</span><b>${b}</b><span>${d}</span></button>`).join("")}</div>
        <div class="grid2"><div class="card"><h2>판매처는 몇 곳인가요?</h2>${pills("stores")}</div><div class="card"><h2>월 광고비는 어느 정도인가요?</h2>${pills("spend")}</div></div>
        <div class="recbar" id="reco"></div>
        <div class="navrow"><a class="btn" href="#/signup">이전</a><button class="btn pri" id="next">다음 · 판매처 연결</button></div>
      </div>`;
    },
    mount(el, state) {
      const sel = state.account.situation && state.account.situation.who ? { ...state.account.situation } : { who: "seller", stores: "2", spend: "m" };
      const reco = () => {
        const multi = sel.stores !== "1";
        el.querySelector("#reco").innerHTML = `<span class="arr">→</span><div style="flex:1"><div>추천 시작 단계: <b>${sel.who === "agency" ? "대행사 플랜 · 셀러 계정 묶기부터" : multi ? "링크 만들기부터" : "분석부터"}</b></div>
          <div class="sm2">${sel.who === "agency" ? "셀러마다 판매처와 광고 계정을 따로 연결해 한 화면에서 관리해요" : multi ? `판매처가 ${SITU.stores.find((x) => x[0] === sel.stores)[1]}라, 어느 광고가 어느 판매처에서 팔렸는지부터 잇는 게 먼저예요` : "판매처가 한 곳이면 경로보다 어디서 이탈하는지가 먼저예요"}</div></div>`;
      };
      reco();
      el.querySelectorAll("[data-group]").forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]");
        if (!b) return;
        g.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("on", x === b));
        sel[g.dataset.group] = b.dataset.v;
        reco();
      }));
      el.querySelector("#next").addEventListener("click", async () => {
        await M.post("/api/account", { situation: sel });
        M.go("#/setup/2");
      });
    },
  });

  // ───── 첫 설정 2: 판매처·광고 연결 ─────
  const SRC_UI = {
    smartstore: { ic: "N", color: "#03A94D", perms: ["주문 내역 읽기 (최근 90일)", "상품 목록 읽기"], kind: "판매처" },
    cafe24: { ic: "자", color: "#4b5751", perms: ["주문 내역 읽기 (최근 90일)", "mape SDK 설치 확인"], kind: "판매처" },
    meta: { ic: "인", color: "#C13584", perms: ["광고 계정 성과 읽기 (노출·클릭·지출)", "광고 소재 목록 읽기"], kind: "광고" },
    naver: { ic: "광", color: "#2E6FD8", perms: ["검색광고 성과 읽기", "키워드·소재 목록 읽기"], kind: "광고" },
    kakao: { ic: "카", color: "#C9A000", perms: ["채널 메시지 발송 성과 읽기", "쿠폰 사용 내역 읽기"], kind: "광고" },
  };
  const busy = {};

  function collected(state) {
    const t = state.totals;
    const links = state.rows.filter((r) => r.adSource).length;
    return `
      <div class="item"><span>판매처 주문 (30일)</span><b>${M.num(state.storeOrders)}건</b></div>
      <div class="item"><span>광고비 (30일)</span><b>${M.won(t.spend)}</b></div>
      <div class="item"><span>자동 생성된 mape_link</span><b>${links}개</b></div>
      <div class="item hl"><span>클릭과 이어진 주문</span><b>${M.num(t.orders)}건</b></div>
      <p class="muted" style="margin:12px 0 0;line-height:1.6">판매처 주문과 광고비는 각 플랫폼이 따로 집계한 숫자라 서로 이어져 있지 않습니다. 마지막 단계에서 mape_link를 광고에 적용하면 클릭과 주문이 이어지기 시작합니다.</p>`;
  }

  function srcCard(k, state) {
    const s = state.sources[k], ui = SRC_UI[k], on = state.account.connections[k];
    return `<div class="src ${on ? "on" : ""}" id="src-${k}">
      <div class="top"><div class="ic" style="background:${ui.color}">${ui.ic}</div><span class="kind">${ui.kind}</span></div>
      <h3>${M.esc(s.label)}</h3>
      <div class="st">${on ? "✓ 연결됨 · " + M.esc(s.summary.text) : busy[k] ? "불러오는 중..." : "연결하지 않음"}</div>
      <div class="prog" style="${busy[k] ? "" : "display:none"}"><i></i></div>
      ${on ? `<button class="btn sm" data-off="${k}">연결 해제</button>` : `<button class="btn sm pri" data-con="${k}" ${busy[k] ? "disabled" : ""}>연결</button>`}
    </div>`;
  }

  async function doConnect(k, el) {
    const ui = SRC_UI[k], s = M.state.sources[k];
    M.openModal(`<h2>${M.esc(s.label)} 연결</h2>
      <p class="sub">MAPE가 아래 정보를 <b>읽기 전용</b>으로 가져옵니다. 광고 집행이나 주문 변경 권한은 요청하지 않습니다.</p>
      <ul class="perm">${ui.perms.map((p) => `<li>${p}</li>`).join("")}</ul>
      <div class="modal-actions"><button class="btn" onclick="MAPE.closeModal()">취소</button><button class="btn pri" id="ok">권한 승인</button></div>`, (box) => {
      box.querySelector("#ok").addEventListener("click", async () => {
        M.closeModal();
        busy[k] = true;
        const card = el.querySelector("#src-" + k);
        card.outerHTML = srcCard(k, M.state);
        const bar = el.querySelector(`#src-${k} .prog i`);
        el.querySelector(`#src-${k} .st`).textContent = ui.kind === "광고" ? "광고 소재 불러오는 중 · mape_link 만드는 중..." : `${s.summary.text} 불러오는 중...`;
        requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = "100%")));
        await M.sleep(1600);
        busy[k] = false;
        await M.post("/api/connect", { key: k });
      });
    });
  }

  M.route("/setup/2", {
    render(state) {
      return `<div class="setup" style="max-width:1100px">${steps(2)}
        <div class="pagehead"><div><h1>판매처와 광고 계정을 연결하세요</h1><p class="sub">연결할 때마다 오른쪽에 데이터가 모입니다. 나중에 추적 탭에서 언제든 추가할 수 있습니다.</p></div></div>
        <div class="connect-grid">
          <div class="sources" id="srcs">${Object.keys(SRC_UI).map((k) => srcCard(k, state)).join("")}
            <div class="src" style="opacity:.55"><div class="top"><div class="ic" style="background:#9AA39E">+</div><span class="kind">판매처</span></div><h3>다른 판매처</h3><div class="st">쿠팡 · 11번가 등 순차 지원 예정</div><button class="btn sm" disabled>준비 중</button></div></div>
          <div class="collected"><h2>지금까지 모인 데이터</h2><div id="col">${collected(state)}</div></div>
        </div>
        <div class="navrow"><a class="btn" href="#/setup/1">이전</a><button class="btn pri" id="next">다음 · 목표 설정</button></div>
        <p class="foot-note">시연 환경: 판매처·광고 계정 연동은 시뮬레이션입니다. mape_link 클릭과 mape SDK 주문은 실제로 수집됩니다.</p>
      </div>`;
    },
    mount(el) {
      el.querySelector("#srcs").addEventListener("click", async (e) => {
        const c = e.target.closest("[data-con]"), o = e.target.closest("[data-off]");
        if (c) doConnect(c.dataset.con, el);
        if (o) await M.post("/api/connect", { key: o.dataset.off, on: false });
      });
      el.querySelector("#next").addEventListener("click", () => M.go("#/setup/3"));
    },
    update(state) {
      const col = M.$("col");
      if (col) col.innerHTML = collected(state);
      Object.keys(SRC_UI).forEach((k) => {
        const card = M.$("src-" + k);
        if (card && !busy[k]) card.outerHTML = srcCard(k, state);
      });
    },
  });

  // ───── 첫 설정 3: 목표·광고비 ─────
  const PRESETS = [["매출 우선", 60, 30, 10], ["브랜드 우선", 30, 60, 10], ["균형", 40, 40, 20]];
  M.route("/setup/3", {
    render(state) {
      const g = state.account.goal;
      return `<div class="setup">${steps(3)}
        <h1>이번 달 목표와 광고비 한도</h1>
        <p class="sub">이 목표는 세 관점 토론이 <b>끝난 뒤</b> 쟁점을 판정할 때만 쓰입니다. 토론 중에는 페르소나에게 보이지 않아, 사장님 눈치를 보지 않고 해석합니다.</p>
        <div class="card" style="margin-top:20px;max-width:620px">
          <div class="goal-presets">${PRESETS.map(([l, a, b, c]) => `<button class="btn sm" data-p="${a},${b},${c}">${l} ${a}/${b}/${c}</button>`).join("")}</div>
          <div class="wt" id="wt"></div>
          ${[["conv", "단기 매출"], ["brand", "브랜드"], ["explore", "새 채널 탐색"]].map(([k, l]) =>
            `<div class="slider"><span>${l}</span><input type="range" min="0" max="100" step="5" value="${g[k]}" data-goal="${k}"><b>${g[k]}</b></div>`).join("")}
          <div class="form" style="padding:0;border:0;max-width:none">
            <label>월 광고비 한도</label>
            <input id="budget" value="${M.num(state.account.budget)}" inputmode="numeric">
          </div>
        </div>
        <div class="navrow" style="max-width:620px"><a class="btn" href="#/setup/2">이전</a><button class="btn pri" id="done">다음 · mape_link 적용</button></div>
      </div>`;
    },
    mount(el) {
      const sl = el.querySelectorAll("input[data-goal]");
      const wt = () => {
        const v = [...sl].map((s) => Number(s.value)), sum = v.reduce((a, b) => a + b, 0) || 1;
        el.querySelector("#wt").innerHTML = [["신규 주문", "#1D2420"], ["브랜드", "#2E6FD8"], ["실험", "#C77A0A"]].map(([l, c], i) =>
          `<div style="flex:${v[i] || 0.001};background:${c}">${v[i] ? `${l} ${Math.round((v[i] / sum) * 100)}%` : ""}</div>`).join("");
      };
      wt();
      sl.forEach((s) => s.addEventListener("input", () => { s.nextElementSibling.textContent = s.value; wt(); }));
      el.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
        const v = b.dataset.p.split(",");
        sl.forEach((s, i) => { s.value = v[i]; s.nextElementSibling.textContent = v[i]; });
        wt();
      }));
      el.querySelector("#done").addEventListener("click", async () => {
        const goal = {};
        sl.forEach((s) => (goal[s.dataset.goal] = Number(s.value)));
        const budget = Number(el.querySelector("#budget").value.replace(/[^\d]/g, "")) || 3000000;
        await M.post("/api/account", { goal, budget });
        M.go("#/setup/4");
      });
    },
  });

  // ───── 첫 설정 4: mape_link 적용 (광고 도착 주소 교체) → 4주 후로 시점 이동 ─────
  M.route("/setup/4", {
    render(state) {
      const links = state.rows.filter((r) => r.adSource);
      return `<div class="setup" style="max-width:1100px">${steps(4)}
        <h1>광고 도착 주소를 mape_link로 바꿔 주세요</h1>
        <p class="sub">광고 소재마다 mape_link를 만들어 두었습니다. MAPE는 광고를 대신 수정하지 않으니, 각 광고 관리자에서 도착 주소만 아래 링크로 바꿔 주세요. 그 순간부터 클릭과 주문이 이어집니다.</p>
        <div class="card" style="margin-top:20px">
          ${links.length ? `<table class="tbl"><thead><tr><th>광고 소재</th><th>쓰는 곳</th><th>원래 도착 주소</th><th></th><th>바꿀 주소 (mape_link)</th><th></th></tr></thead><tbody>
          ${links.map((r) => `<tr><td class="nm">${M.esc(r.name)}</td><td>${M.esc(r.channel)}</td>
            <td class="muted">${M.esc(M.fullTarget(r.target).replace(/^https?:\/\//, ""))}</td><td style="color:var(--green);font-weight:900">→</td>
            <td><code style="font-size:12px;color:var(--green-d)">${M.esc(M.shortUrl(r.slug).replace(/^https?:\/\//, ""))}</code></td>
            <td><button class="btn sm" data-cp="${M.esc(M.shortUrl(r.slug))}">복사</button></td></tr>`).join("")}
          </tbody></table>` : `<div class="empty">광고 계정을 연결하면 소재별 mape_link가 여기에 나타납니다 <a class="btn sm" style="margin-left:10px" href="#/setup/2">연결하러 가기</a></div>`}
        </div>
        <div class="reco" style="margin-top:14px">링크를 바꾼 뒤 <b>4주</b>가 지나면 경로 데이터가 충분히 쌓여 제안까지 쓸 수 있습니다. 시연에서는 4주 뒤 시점으로 바로 넘어갑니다.</div>
        <div class="navrow"><a class="btn" href="#/setup/3">이전</a><button class="btn pri" id="apply" ${links.length ? "" : "disabled"}>도착 주소 교체 완료 · 4주 후로</button></div>
      </div>`;
    },
    mount(el) {
      el.querySelectorAll("[data-cp]").forEach((b) => b.addEventListener("click", () => {
        navigator.clipboard && navigator.clipboard.writeText(b.dataset.cp);
        b.textContent = "복사됨";
      }));
      const btn = el.querySelector("#apply");
      if (btn) btn.addEventListener("click", async () => {
        await M.timeSkip();
        await M.post("/api/account", { linksApplied: true, onboarded: true });
        M.go("#/app/home");
        setTimeout(() => M.toast("mape_link 적용 4주 차", "4주간 모인 경로 데이터입니다. 새 상품은 왼쪽 위 '새 mape_link 만들기'로"), 300);
      });
    },
  });

  // 시점 이동 연출
  M.timeSkip = () => new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "skip";
    ov.innerHTML = `<div class="skip-in"><div class="skip-d" id="skd">D+0</div><div class="skip-t">mape_link 적용 후 4주</div>
      <div class="skip-s">광고 클릭과 판매처 주문이 링크 하나로 이어지는 중</div><div class="prog" style="width:320px;margin:22px auto 0"><i id="skp"></i></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => { ov.classList.add("on"); ov.querySelector("#skp").style.width = "100%"; });
    let d = 0;
    const t = setInterval(() => { d = Math.min(28, d + 1); ov.querySelector("#skd").textContent = "D+" + d; }, 1500 / 28);
    setTimeout(() => { clearInterval(t); resolve(); setTimeout(() => { ov.classList.remove("on"); setTimeout(() => ov.remove(), 400); }, 250); }, 1900);
  });
})(MAPE);
