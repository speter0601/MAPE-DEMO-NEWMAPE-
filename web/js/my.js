// 마이페이지: 분석에 쓰일 정보를 넣고 관리하는 곳 (계정 · 연결 · 목표 · 링크 적용 · SDK)
(function (M) {
  const SRC = [["smartstore", "N", "#03A94D"], ["cafe24", "자", "#1D2420"], ["naver", "광", "#2E6FD8"], ["meta", "인", "#C13584"], ["kakao", "카", "#C9A000"]];

  // ───── 계정 · 요금제 ─────
  M.route("/app/my", {
    render(state) {
      const a = state.account, u = a.user || {};
      const conn = Object.values(a.connections).filter(Boolean).length;
      return `<main>
        <div class="grid2">
          <div class="card"><h2>가게 정보</h2>
            <table class="tbl" style="margin-top:10px">
              <tr><td class="muted" style="width:120px">스토어 이름</td><td class="nm">${M.esc(u.shop || "-")}</td></tr>
              <tr><td class="muted">이메일</td><td>${M.esc(u.email || "-")}</td></tr>
              <tr><td class="muted">판매처</td><td>스마트스토어 + 자사몰</td></tr>
              <tr><td class="muted">연결된 계정</td><td>${conn} / 5 <a class="btn sm" style="margin-left:8px" href="#/app/my/connect">관리</a></td></tr>
              <tr><td class="muted">mape_link</td><td>${a.linksApplied ? '<span class="chip">적용 4주 차</span>' : '<span class="chip grey">적용 전</span>'}</td></tr>
            </table></div>
          <div class="card"><h2>요금제</h2>
            <div class="plancur"><div><span class="muted">현재 요금제</span><b>프로</b></div><span class="chip">사용 중</span></div>
            <p class="muted" style="line-height:1.7;margin:10px 0 0">무료: 추적 · 수집 · 분석<br>프로: 제안 · 세 관점 토론 · 예산 배분 · 모니터링 · 검증<br>대행사 확장: 여러 셀러 계정을 한 화면에서 관리</p></div>
        </div>
        <div class="card"><h2>시연 도구</h2>
          <p class="muted" style="margin:6px 0 12px">리허설을 반복할 때 씁니다. 실제 서비스에는 없는 메뉴입니다. 단축키: Shift+D 바로 시작 · Shift+O 주문 연결 · Shift+C 클릭 기록</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="demoOrder">방금 QR 클릭에 주문 연결</button>
            <button class="btn" id="demoClick">QR 클릭 수동 기록</button>
            <button class="btn" id="resetDemo">실시간 시연 기록만 지우기</button>
            <button class="btn" id="resetAll">빈 계정으로 처음부터</button>
          </div></div>
      </main>`;
    },
    mount(el) {
      el.querySelector("#demoOrder").onclick = () => M.post("/api/demo/order");
      el.querySelector("#demoClick").onclick = async () => { await M.post("/api/demo/click"); M.toast("QR 클릭을 수동으로 기록했습니다"); };
      el.querySelector("#resetDemo").onclick = async () => { await M.post("/api/reset?mode=demo"); M.toast("시연 기록을 지웠습니다"); };
      el.querySelector("#resetAll").onclick = async () => {
        if (!confirm("빈 계정으로 돌아가 소개 화면부터 다시 시작합니다. 계속할까요?")) return;
        await M.post("/api/reset?mode=fresh");
        location.hash = "#/";
      };
    },
  });

  // ───── 연결 관리 ─────
  M.route("/app/my/connect", {
    live: true,
    render(state) {
      const a = state.account;
      return `<main>
        <div class="conn6">${SRC.map(([k, ic, c]) => {
          const s = state.sources[k], on = a.connections[k];
          return `<div class="cn"><div class="lg" style="background:${c}">${ic}</div><div><b>${M.esc(s.label)}</b><div class="muted">${on ? "연결됨 · " + (s.kind === "store" ? "주문 수집" : "광고비·클릭 수집") : "연결 전"}</div></div>
            <button class="tg ${on ? "on" : ""}" data-k="${k}" aria-label="${M.esc(s.label)} 연결"></button></div>`;
        }).join("")}
          <div class="cn" style="opacity:.55"><div class="lg" style="background:#9AA39E">+</div><div><b>다른 판매처</b><div class="muted">순차 지원 예정</div></div><span class="tg"></span></div>
        </div>
        <div class="card" style="margin-top:12px"><h2>수집 상태</h2>
          <table class="tbl" style="margin-top:8px"><thead><tr><th>계정</th><th>가져오는 것</th><th>권한</th><th>마지막 수집</th><th>상태</th></tr></thead><tbody>
          ${SRC.map(([k]) => { const s = state.sources[k], on = a.connections[k]; return `<tr><td class="nm">${M.esc(s.label)}</td><td>${s.kind === "store" ? "주문 · 취소 · 상품" : "광고비 · 노출 · 클릭 · 소재"}</td><td>읽기 전용</td><td>${on ? "오늘 06:00" : "-"}</td><td>${on ? '<span class="chip">정상</span>' : '<span class="chip grey">연결 전</span>'}</td></tr>`; }).join("")}
          </tbody></table>
          <p class="muted" style="margin:10px 0 0">늦게 들어오는 주문과 취소는 다음 날 다시 수집해 보정합니다. MAPE는 광고를 대신 수정하거나 집행하지 않습니다.</p>
        </div>
      </main>`;
    },
    mount(el, state) {
      el.querySelectorAll(".tg[data-k]").forEach((b) => b.addEventListener("click", () => M.post("/api/connect", { key: b.dataset.k, on: !state.account.connections[b.dataset.k] })));
    },
  });

  // ───── 목표 · 광고비 ─────
  M.route("/app/my/goal", {
    render(state) {
      const a = state.account, g = a.goal, sum = g.conv + g.brand + g.explore || 1;
      return `<main>
        <div class="grid2 wide-left">
          <div class="card top"><h2>이번 달 목표 비중</h2><p class="muted" style="margin:4px 0 12px">세 관점의 쟁점을 판정할 때만 이 비중을 씁니다 (토론 중에는 비공개)</p>
            <div class="wt" id="wt"></div>
            ${[["conv", "신규 주문"], ["brand", "브랜드"], ["explore", "실험"]].map(([k, l]) => `<div class="slider"><span>${l}</span><input type="range" min="0" max="100" step="5" value="${g[k]}" data-goal="${k}"><b>${g[k]}</b></div>`).join("")}
            <div class="goal-presets" style="margin-top:12px">${[["매출 우선", 60, 30, 10], ["브랜드 우선", 30, 60, 10], ["균형", 40, 40, 20]].map(([l, x, y, z]) => `<button class="btn sm" data-p="${x},${y},${z}">${l} ${x}/${y}/${z}</button>`).join("")}</div>
          </div>
          <div class="card top"><h2>월 광고비 한도</h2><p class="muted" style="margin:4px 0 16px">제안은 이 한도를 넘지 않아요</p>
            <input type="range" min="500000" max="5000000" step="100000" value="${a.budget}" id="bud" style="width:100%;accent-color:var(--green)">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px"><span class="muted">50만 원</span><b style="font-size:22px" id="budv">월 ${M.man(a.budget)} 원</b><span class="muted">500만 원</span></div>
          </div>
        </div>
        <p class="muted">바꾼 값은 바로 저장되고, 예산 배분 화면의 판정에 즉시 반영됩니다.</p>
      </main>`;
    },
    mount(el) {
      const sl = el.querySelectorAll("input[data-goal]");
      const wt = () => {
        const v = [...sl].map((s) => Number(s.value)), sum = v.reduce((x, y) => x + y, 0) || 1;
        el.querySelector("#wt").innerHTML = [["신규 주문", "#1D2420"], ["브랜드", "#2E6FD8"], ["실험", "#C77A0A"]].map(([l, c], i) =>
          `<div style="flex:${v[i] || 0.001};background:${c}">${v[i] ? `${l} ${Math.round((v[i] / sum) * 100)}%` : ""}</div>`).join("");
      };
      const save = () => { const goal = {}; sl.forEach((s) => (goal[s.dataset.goal] = Number(s.value))); M.post("/api/account", { goal }); };
      wt();
      sl.forEach((s) => { s.addEventListener("input", () => { s.nextElementSibling.textContent = s.value; wt(); }); s.addEventListener("change", save); });
      el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { const v = b.dataset.p.split(","); sl.forEach((s, i) => { s.value = v[i]; s.nextElementSibling.textContent = v[i]; }); wt(); save(); }));
      const bud = el.querySelector("#bud");
      bud.addEventListener("input", () => (el.querySelector("#budv").textContent = `월 ${M.man(Number(bud.value))} 원`));
      bud.addEventListener("change", () => M.post("/api/account", { budget: Number(bud.value) }));
    },
  });

  // ───── mape_link 적용 현황 ─────
  M.route("/app/my/apply", {
    render(state) {
      const links = state.rows.filter((r) => r.adSource);
      const applied = state.account.linksApplied;
      return `<main>
        <div class="card"><div class="card-h"><h2>광고 도착 주소 → mape_link</h2>${applied ? '<span class="chip">모두 적용됨 · 4주 차</span>' : '<span class="chip grey">적용 대기</span>'}</div>
          <table class="tbl"><thead><tr><th>광고 소재</th><th>쓰는 곳</th><th>원래 도착 주소</th><th>mape_link</th><th>상태</th><th class="r">클릭</th></tr></thead><tbody>
          ${links.map((r) => `<tr><td class="nm">${M.esc(r.name)}</td><td>${M.esc(r.channel)}</td><td class="muted">${M.esc(M.fullTarget(r.target).replace(/^https?:\/\//, ""))}</td>
            <td><code style="font-size:12px;color:var(--green-d)">${M.esc(M.shortUrl(r.slug).replace(/^https?:\/\//, ""))}</code></td>
            <td>${r.tracking ? '<span class="chip">적용됨</span>' : '<span class="chip grey">적용 대기</span>'}</td><td class="r">${M.num(r.clicks)}</td></tr>`).join("") ||
            `<tr><td colspan="6" class="muted" style="padding:20px 6px">광고 계정을 연결하면 소재별 mape_link가 만들어집니다</td></tr>`}
          </tbody></table>
          ${applied ? "" : `<a class="btn pri" style="margin-top:12px" href="#/setup/4">도착 주소 교체하러 가기</a>`}
          <p class="muted" style="margin:10px 0 0">MAPE는 광고를 대신 수정하지 않습니다. 각 광고 관리자에서 도착 주소만 mape_link로 바꾸면 그때부터 클릭과 주문이 이어집니다.</p>
        </div>
      </main>`;
    },
  });
})(MAPE);
