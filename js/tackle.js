/* 钓具层：竿 / 线 / 漂 / 钩饵，DOM 复用只改属性。导出 Tackle */
(function () {
  "use strict";

  const layer = document.getElementById("lineLayer");
  const bobber = document.getElementById("bobber");
  const hookBait = document.getElementById("hookBait");

  // 一次性建 SVG 骨架，之后只改 d / 变换
  layer.innerHTML = `
    <svg id="tackleSvg" width="100%" height="100%" style="position:absolute;inset:0">
      <defs>
        <linearGradient id="rodGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#5c4634"/>
          <stop offset="35%" stop-color="#8b6b4a"/>
          <stop offset="70%" stop-color="#a8845c"/>
          <stop offset="100%" stop-color="#6b5340"/>
        </linearGradient>
        <linearGradient id="gripGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3d2e22"/>
          <stop offset="50%" stop-color="#6b5340"/>
          <stop offset="100%" stop-color="#3d2e22"/>
        </linearGradient>
      </defs>
      <!-- 竿体（弯折用 path） -->
      <path id="rodShadow" fill="none" stroke="rgba(30,70,90,.14)" stroke-width="11" stroke-linecap="round"/>
      <path id="rodPath" fill="none" stroke="url(#rodGrad)" stroke-width="8" stroke-linecap="round"/>
      <path id="rodShine" fill="none" stroke="rgba(255,240,210,.4)" stroke-width="1.6" stroke-linecap="round"/>
      <!-- 握把 -->
      <path id="rodGrip" fill="none" stroke="url(#gripGrad)" stroke-width="12" stroke-linecap="round"/>
      <!-- 导环 -->
      <circle id="guide1" r="3.4" fill="none" stroke="#d4b880" stroke-width="1.5"/>
      <circle id="guide2" r="2.6" fill="none" stroke="#d4b880" stroke-width="1.3"/>
      <!-- 钓线 -->
      <path id="linePath" fill="none" stroke="rgba(250,246,236,.86)" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;

  const rodPath = document.getElementById("rodPath");
  const rodShine = document.getElementById("rodShine");
  const rodGrip = document.getElementById("rodGrip");
  const rodShadow = document.getElementById("rodShadow");
  const linePath = document.getElementById("linePath");
  const guide1 = document.getElementById("guide1");
  const guide2 = document.getElementById("guide2");

  let baitSvg = "";
  let visible = false;
  let phase = "idle"; // idle|cast|flight|wait|fight
  let tension = 0.35;
  let bend = 0;       // 0..1 弯折
  let bendTarget = 0;
  let flightT = -1;   // >=0 时抛出动画
  let flightFrom = { x: 0, y: 0 };
  let flightTo = { x: 0, y: 0 };
  let bobX = 0, bobY = 0;
  let dip = 0;

  function rodAnchor() {
    const W = innerWidth, H = innerHeight;
    // 右下角入画
    return {
      bx: W - 8,
      by: H + 6,
      // 竿梢默认位置（IDLE）
      tx: W > 720 ? W - 36 : W * 0.88,
      ty: H > 640 ? H - 28 : H * 0.92,
    };
  }

  function setBait(svg) {
    baitSvg = svg || "";
    if (hookBait) hookBait.innerHTML = baitSvg;
  }

  function show(x, y) {
    bobX = x; bobY = y;
    visible = true;
    if (bobber) {
      bobber.classList.add("show");
      bobber.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (hookBait) hookBait.innerHTML = baitSvg;
  }

  function hide() {
    visible = false;
    if (bobber) bobber.classList.remove("show");
    linePath.setAttribute("d", "");
    phase = "idle";
  }

  function setPhase(p, t) {
    phase = p;
    if (typeof t === "number") tension = t;
    if (p === "fight") bendTarget = 0.35 + tension * 0.55;
    else if (p === "cast") bendTarget = 0.55;
    else if (p === "flight") bendTarget = 0.15;
    else if (p === "wait") bendTarget = 0.08;
    else bendTarget = 0.04;
  }

  function setDip(d) { dip = d; }

  function startFlight(from, to) {
    flightFrom = from;
    flightTo = to;
    flightT = 0;
    phase = "flight";
    visible = true;
    if (bobber) bobber.classList.add("show");
  }

  function tipPosition() {
    const a = rodAnchor();
    // 弯折：梢向内（左上）弯
    const bendPx = bend * 28;
    return {
      x: a.tx - bendPx * 0.55,
      y: a.ty - bendPx * 0.85,
      gripX: a.bx - 46,
      gripY: a.by - 42,
      guide1X: a.tx + (a.bx - a.tx) * 0.28,
      guide1Y: a.ty + (a.by - a.ty) * 0.28,
      guide2X: a.tx + (a.bx - a.tx) * 0.55,
      guide2Y: a.ty + (a.by - a.ty) * 0.55,
    };
  }

  function update(dt) {
    bend += (bendTarget - bend) * Math.min(1, dt * 8);
    // 张力微抖
    let extra = 0;
    if (phase === "fight") {
      extra = Math.sin(performance.now() * 0.02) * tension * 3;
    }

    const tip = tipPosition();
    const tipX = tip.x + extra;
    const tipY = tip.y;

    // 竿体：三次曲线，弯点在 55%
    const midX = (tipX + tip.gripX) / 2 - bend * 16;
    const midY = (tipY + tip.gripY) / 2 - bend * 10;
    const rodD = `M${tip.gripX.toFixed(1)} ${tip.gripY.toFixed(1)} Q${midX.toFixed(1)} ${midY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;
    rodPath.setAttribute("d", rodD);
    rodShine.setAttribute("d", `M${(tip.gripX - 1).toFixed(1)} ${(tip.gripY - 2).toFixed(1)} Q${midX.toFixed(1)} ${(midY - 2).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`);
    rodGrip.setAttribute("d", `M${(tip.gripX + 18).toFixed(1)} ${(tip.gripY + 14).toFixed(1)} Q${(tip.gripX + 32).toFixed(1)} ${(tip.gripY + 24).toFixed(1)} ${(tip.gripX + 44).toFixed(1)} ${(tip.gripY + 34).toFixed(1)}`);
    rodShadow.setAttribute("d", `M${(tip.gripX + 6).toFixed(1)} ${(tip.gripY + 10).toFixed(1)} Q${(midX + 6).toFixed(1)} ${(midY + 10).toFixed(1)} ${(tipX + 4).toFixed(1)} ${(tipY + 6).toFixed(1)}`);
    guide1.setAttribute("cx", tip.guide1X.toFixed(1));
    guide1.setAttribute("cy", tip.guide1Y.toFixed(1));
    guide2.setAttribute("cx", tip.guide2X.toFixed(1));
    guide2.setAttribute("cy", tip.guide2Y.toFixed(1));

    // 落点 / 飞行
    if (flightT >= 0) {
      flightT += dt * 2.8;
      const t = Math.min(1, flightT);
      // 抛物线
      const e = t * t * (3 - 2 * t); // smoothstep
      bobX = flightFrom.x + (flightTo.x - flightFrom.x) * e;
      const arc = Math.sin(t * Math.PI) * (60 + flightTo.dist * 0.08);
      bobY = flightFrom.y + (flightTo.y - flightFrom.y) * e - arc;
      if (bobber) bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px)`;
      if (t >= 1) {
        flightT = -1;
        bobX = flightTo.x; bobY = flightTo.y;
        setPhase("wait");
      }
    } else if (visible && bobber) {
      const y = bobY + dip * 10;
      bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 - dip * 0.1).toFixed(3)})`;
    }

    // 线：从竿梢到漂，受弯与张力
    if (visible || phase === "fight") {
      const tx = tipX, ty = tipY;
      const bx = bobX, by = bobY + dip * 6;
      const dist = Math.hypot(tx - bx, ty - by);
      // 松弛垂度：张力高则绷直
      const slack = (1 - Math.min(1, tension)) * 46 + 8;
      const cx = (tx + bx) / 2;
      const cy = (ty + by) / 2 + slack;
      linePath.setAttribute("d", `M${tx.toFixed(1)} ${ty.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
      const sw = (phase === "fight" && tension > 0.8) ? 1.5 : (1.25 - Math.min(dist, 700) * 0.0006);
      linePath.setAttribute("stroke-width", sw.toFixed(2));
      if (phase === "fight" && tension > 0.8) {
        linePath.setAttribute("stroke", "rgba(232,122,106,.9)");
      } else if (phase === "fight" && tension < 0.2) {
        linePath.setAttribute("stroke", "rgba(201,164,90,.85)");
      } else {
        linePath.setAttribute("stroke", "rgba(250,246,236,.82)");
      }
    } else {
      // 空闲时也画短竿，暗示钓位
      linePath.setAttribute("d", "");
    }
  }

  window.Tackle = {
    setBait,
    show,
    hide,
    setPhase,
    setDip,
    startFlight,
    update,
    get visible() { return visible; },
  };
})();
