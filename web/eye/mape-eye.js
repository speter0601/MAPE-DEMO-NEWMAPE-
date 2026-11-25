/*!
 * mape_eye — 현장 점검 오버레이
 * 광고가 걸린 실제 화면(DOM)을 읽어서 내 광고의 위치·문구·경쟁 상황을 세 관점으로 점검한다.
 * 확장 프로그램에서는 content script로, 시연 페이지에서는 <script>로 주입된다.
 */
(function () {
  if (window.__mapeEye) return;
  window.__mapeEye = true;

  const API = location.port === "4000" ? location.origin : "http://localhost:4000";
  const KEY = "mape_eye_mine";
  const css = `
  .me-panel{position:fixed;right:16px;top:16px;width:330px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:2px solid #13824f;z-index:2147483000;font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:13px;color:#16201b;box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .me-panel.min .me-body{display:none}
  .me-h{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #dfe4e1;background:#fff;position:sticky;top:0}
  .me-h b{font-weight:900;letter-spacing:.02em}
  .me-h span{color:#8a948f;font-size:11px;margin-left:6px;font-weight:600}
  .me-h button{border:1px solid #dfe4e1;background:#fff;font-size:11px;padding:4px 8px;cursor:pointer;margin-left:4px}
  .me-h button.on{background:#e8590c;color:#fff;border-color:#e8590c}
  .me-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px}
  .me-sum{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
  .me-sum div{background:#f6f7f6;padding:8px;text-align:center}
  .me-sum b{display:block;font-size:17px;font-variant-numeric:tabular-nums}
  .me-sum small{color:#8a948f;font-size:11px}
  .me-c{border-left:3px solid var(--c);background:#f6f7f6;padding:8px 10px;line-height:1.55}
  .me-c .who{font-weight:800;color:var(--c);font-size:12px;display:flex;gap:6px;align-items:center}
  .me-c .who i{font-style:normal;background:#e8590c;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px}
  .me-data{border:1px dashed #dfe4e1;padding:8px 10px;color:#4b5751;line-height:1.55}
  .me-foot{color:#8a948f;font-size:11px;line-height:1.5}
  .me-chips{display:flex;gap:6px;flex-wrap:wrap}.me-chips span{font-size:11px;font-weight:700;padding:2px 7px;background:#e7f3ec;color:#0c5e39}.me-chips span.bad{background:#FDF1F0;color:#E03A3A}
  .me-pin{position:absolute;width:24px;height:24px;border-radius:50%;background:#e8590c;color:#fff;font:800 12px/24px -apple-system,sans-serif;text-align:center;z-index:2147482999;box-shadow:0 0 0 3px rgba(232,89,12,.25);pointer-events:none}
  .me-mine{outline:3px solid #13824f !important;outline-offset:4px;position:relative}
  .me-tag{position:absolute;background:#13824f;color:#fff;font:700 11px -apple-system,sans-serif;padding:2px 6px;z-index:2147482998;pointer-events:none}
  .me-pick [data-adv]:hover,.me-pick .me-hov{outline:2px dashed #e8590c !important;cursor:crosshair}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "me-panel";
  document.body.appendChild(panel);
  let picking = false, apiData = null, pins = [];

  const num = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;
  const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
  const BENEFIT = /할인|%|특가|1\+1|최저가|쿠폰|무료배송|오늘\s?출발/;

  // ── 1. 화면에서 광고 영역 찾기: '광고' 표시가 붙은 구역 안의 광고 단위 ──
  function adSections() {
    const labels = [...document.querySelectorAll("span,em,i,div")].filter((el) => el.children.length === 0 && el.textContent.trim() === "광고");
    const secs = new Set(labels.map((l) => l.closest("section") || l.parentElement.parentElement));
    return [...secs].map((sec) => ({ sec, units: [...sec.querySelectorAll("[data-adv]")] })).filter((s) => s.units.length);
  }

  function mineName() {
    try { return localStorage.getItem(KEY) || null; } catch (e) { return null; }
  }
  function isMine(el) {
    const m = mineName();
    return m ? el.dataset.adv === m : el.dataset.mine === "1";
  }

  // ── 2. 분석 ──
  function analyze() {
    const secs = adSections();
    const search = secs.find((s) => s.units[0].querySelector(".ttl, a"));
    const shop = secs.find((s) => s !== search);
    const r = { found: !!search };
    if (!search) return r;
    const ads = search.units;
    const me = ads.find(isMine);
    r.total = ads.length;
    if (!me) return r;
    r.me = me;
    r.name = me.dataset.adv;
    r.rank = ads.indexOf(me) + 1;
    const rect = me.getBoundingClientRect();
    // 첫 화면 = 페이지를 처음 열었을 때 스크롤 없이 보이는 영역 (지금 스크롤 위치와 무관)
    const absBottom = rect.bottom + window.scrollY;
    r.aboveFold = absBottom <= window.innerHeight;
    r.belowBy = Math.max(0, Math.round(absBottom - window.innerHeight));
    const title = (me.querySelector(".ttl") || me).textContent.trim();
    r.title = title;
    r.myBenefit = BENEFIT.test(me.textContent);
    const comp = ads.filter((a) => a !== me);
    r.compBenefit = comp.filter((a) => BENEFIT.test((a.querySelector(".ttl") || a).textContent)).length;
    r.compCount = comp.length;
    r.brandInTitle = title.includes(r.name.replace(/\s*스토어$/, ""));
    // 경쟁 광고 제목에서 가장 많이 겹치는 단어
    const freq = {};
    comp.forEach((a) => new Set((a.querySelector(".ttl") || a).textContent.split(/[\s·,]+/).filter((w) => w.length > 1)).forEach((w) => (freq[w] = (freq[w] || 0) + 1)));
    const top = Object.entries(freq).filter(([w]) => w !== "텀블러").sort((a, b) => b[1] - a[1])[0];
    r.commonWord = top ? { w: top[0], n: top[1] } : null;
    r.myExt = me.querySelectorAll(".ext span").length;
    r.compExt = comp.reduce((s, a) => s + a.querySelectorAll(".ext span").length, 0) / (comp.length || 1);
    r.compReview = comp.some((a) => /리뷰|★/.test(a.textContent));
    r.myReview = /리뷰|★/.test(me.textContent);
    r.firstComp = comp[0];
    // 쇼핑 영역
    if (shop) {
      const items = shop.units;
      const mine = items.find(isMine);
      if (mine) {
        const price = (el) => num((el.querySelector(".p") || el).textContent);
        const reviews = (el) => { const m = el.textContent.match(/리뷰\s*([\d,]+)/); return m ? num(m[1]) : 0; };
        const others = items.filter((i) => i !== mine);
        r.shop = {
          el: mine, price: price(mine), cheapest: others.every((o) => price(o) >= price(mine)),
          avgPrice: others.reduce((s, o) => s + price(o), 0) / others.length,
          rev: reviews(mine), avgRev: others.reduce((s, o) => s + reviews(o), 0) / others.length,
          freeShip: /무료배송/.test(mine.textContent), compFreeShip: others.filter((o) => /무료배송/.test(o.textContent)).length,
        };
      }
    }
    return r;
  }

  // ── 3. 세 관점 코멘트 (숫자는 위 분석 결과만 사용) ──
  function comments(r) {
    const out = [];
    out.push({ c: "#1f6fb2", who: "성과", pin: 1, t:
      `검색 광고 ${r.total}개 중 <b>${r.rank}번째</b>, ${r.aboveFold ? "첫 화면 안에 보입니다" : `첫 화면에서 <b>${r.belowBy}px 아래</b>로 밀려 있습니다`}. ` +
      (r.myBenefit ? "혜택 문구가 있어 경쟁 광고와 같은 조건입니다." : `경쟁 ${r.compCount}곳 중 ${r.compBenefit}곳이 할인·혜택 문구를 쓰는데 내 광고 제목에는 혜택이 없습니다. 클릭률에 불리합니다.`) });
    out.push({ c: "#9a3fa8", who: "브랜드", pin: 2, t:
      (r.brandInTitle ? "제목에 브랜드명이 들어가 있습니다. " : `제목 '${r.title}'에 브랜드명이 없습니다. 클릭하지 않은 사람에게는 이름이 남지 않습니다. `) +
      (r.commonWord && r.commonWord.n >= 2 ? `반대로 경쟁 ${r.commonWord.n}곳이 '${r.commonWord.w}'를 똑같이 써서, 제품명 중심인 내 제목은 오히려 눈에 띕니다. 할인 문구를 따라가기보다 브랜드명을 붙이는 쪽을 권합니다.` : "") });
    if (r.shop) {
      const s = r.shop;
      out.push({ c: "#4b5751", who: "고객 반응", pin: 3, t:
        `쇼핑 영역에서 가격은 ${won(s.price)}으로 ${s.cheapest ? "<b>가장 저렴</b>합니다" : `평균 ${won(s.avgPrice)} 대비 ${s.price < s.avgPrice ? "저렴" : "비쌉"}니다`}. ` +
        `하지만 리뷰는 <b>${s.rev.toLocaleString()}개</b>로 경쟁 평균 ${Math.round(s.avgRev).toLocaleString()}개에 크게 못 미칩니다. 가격보다 리뷰 신뢰가 약점입니다.` +
        (!s.freeShip && s.compFreeShip ? ` 경쟁 ${s.compFreeShip}곳은 무료배송 표시가 있습니다.` : "") });
    }
    if (!r.myExt || r.myExt < r.compExt) {
      out.push({ c: "#1f6fb2", who: "성과", pin: 4, t: `광고 확장 정보(평점, 배송, 혜택 배지)가 ${r.myExt}개로 경쟁 평균 ${r.compExt.toFixed(1)}개보다 적습니다. 같은 자리에서도 광고 면적이 작아 보입니다.` });
    }
    return out;
  }

  // ── 4. 그리기 ──
  function clearMarks() {
    pins.forEach((p) => p.remove());
    pins = [];
    document.querySelectorAll(".me-mine").forEach((e) => e.classList.remove("me-mine"));
  }
  function pinAt(el, n, dx) {
    if (!el) return;
    const b = el.getBoundingClientRect();
    const p = document.createElement("div");
    p.className = "me-pin";
    p.textContent = n;
    p.style.left = window.scrollX + b.left + (dx != null ? dx : b.width - 30) + "px";
    p.style.top = window.scrollY + b.top - 10 + "px";
    document.body.appendChild(p);
    pins.push(p);
  }
  function tag(el, text) {
    const b = el.getBoundingClientRect();
    const t = document.createElement("div");
    t.className = "me-tag";
    t.textContent = text;
    t.style.left = window.scrollX + b.left - 4 + "px";
    t.style.top = window.scrollY + b.top - 24 + "px";
    document.body.appendChild(t);
    pins.push(t);
  }

  function dataBox() {
    if (!apiData) return `<div class="me-data">MAPE 서버에 연결하면 이 광고 위치의 클릭률·클릭당 비용이 함께 표시됩니다.</div>`;
    const rows = apiData.rows.filter((x) => /파워링크|쇼핑검색/.test(x.channel) && x.spend);
    if (!rows.length) return `<div class="me-data">광고 계정을 연결하면 이 위치의 성과가 함께 표시됩니다.</div>`;
    return `<div class="me-data"><b>MAPE 집계 (적용 후 4주)</b><br>${rows.map((x) => `${x.channel} · 클릭률 ${x.ctr ? (x.ctr * 100).toFixed(1) + "%" : "-"} · 주문 ${x.orders}건 · 주문당 광고비 ${x.orders ? won(x.spend / x.orders) : "-"}`).join("<br>")}<br><span style="color:#e8590c">파워링크 클릭당 비용 7일 +12%</span></div>`;
  }

  function render() {
    clearMarks();
    const r = analyze();
    const head = `<div class="me-h"><div><b>MAPE</b><span>현장 점검 · mape_eye</span></div>
      <div><button id="mePick" class="${picking ? "on" : ""}">${picking ? "광고를 클릭하세요" : "내 광고 지정"}</button><button id="meMin">${panel.classList.contains("min") ? "펼치기" : "접기"}</button></div></div>`;
    let body;
    if (!r.found) body = `<div class="me-foot">이 화면에서 '광고' 표시가 붙은 영역을 찾지 못했습니다.</div>`;
    else if (!r.me) body = `<div class="me-foot">광고 ${r.total}개를 찾았습니다. '내 광고 지정'을 누르고 내 광고를 클릭하세요.</div>`;
    else {
      const cs = comments(r);
      const shopName = r.shop ? r.shop.el.textContent : "";
      const match = r.title.split(/\s+/).filter((w) => w.length > 1 && shopName.includes(w)).length >= 2;
      const chips = [["링크 작동 확인", 1], [match ? "랜딩 상품 일치" : "랜딩 상품 확인 필요", match]];
      if (!r.myBenefit) chips.push(["혜택 문구 없음", 0]);
      if (!r.aboveFold) chips.push(["첫 화면 밖", 0]);
      if (r.shop && r.shop.rev < r.shop.avgRev / 5) chips.push(["리뷰 수 부족", 0]);
      body = `<div class="me-chips">${chips.map(([t, ok]) => `<span class="${ok ? "" : "bad"}">${t}</span>`).join("")}</div><div class="me-sum"><div><b>${r.rank}/${r.total}</b><small>광고 순위</small></div><div><b>${r.aboveFold ? "안" : "밖"}</b><small>첫 화면</small></div><div><b>${r.compBenefit}/${r.compCount}</b><small>경쟁 혜택 문구</small></div></div>
        ${cs.map((c) => `<div class="me-c" style="--c:${c.c}"><div class="who"><i>${c.pin}</i>${c.who} 관점</div>${c.t}</div>`).join("")}
        ${dataBox()}
        <div class="me-foot">화면의 실제 내용(순위, 문구, 가격, 리뷰 수)을 읽어 계산했습니다. 첫 화면은 창 크기 기준으로 계산합니다.</div>`;
      r.me.classList.add("me-mine");
      tag(r.me, "내 광고 · " + r.name);
      const ttl = r.me.querySelector(".ttl") || r.me;
      pinAt(ttl, 1, ttl.getBoundingClientRect().width + 8);
      const brandEl = r.me.querySelector(".url b") || r.me.querySelector(".url") || r.me;
      pinAt(brandEl, 2, brandEl.getBoundingClientRect().width + 6);
      if (r.shop) { r.shop.el.classList.add("me-mine"); pinAt(r.shop.el, 3); }
      if (cs.some((c) => c.pin === 4)) pinAt(r.me.querySelector(".ext") || r.me, 4, 0);
    }
    panel.innerHTML = head + `<div class="me-body">${body}</div>`;
    panel.querySelector("#meMin").onclick = () => { panel.classList.toggle("min"); render(); };
    panel.querySelector("#mePick").onclick = () => { picking = !picking; document.body.classList.toggle("me-pick", picking); render(); };
  }

  // 내 광고 지정 모드
  document.addEventListener("click", (e) => {
    if (!picking || panel.contains(e.target)) return;
    const el = e.target.closest("[data-adv]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    try { localStorage.setItem(KEY, el.dataset.adv); } catch (err) {}
    picking = false;
    document.body.classList.remove("me-pick");
    render();
  }, true);

  let t;
  const later = () => { clearTimeout(t); t = setTimeout(render, 120); };
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);

  // 모니터링에서 고른 위치로 화면 이동 (?focus=powerlink | shopping)
  const focus = new URLSearchParams(location.search).get("focus");
  if (focus) setTimeout(() => {
    const el = document.getElementById(focus === "shopping" ? "shopping" : "powerads");
    if (el) { el.scrollIntoView({ block: "start" }); el.style.boxShadow = "0 0 0 3px rgba(19,130,79,.35)"; render(); }
  }, 300);

  fetch(API + "/api/state").then((r) => r.json()).then((d) => { apiData = d; render(); }).catch(() => {});
  render();
})();
