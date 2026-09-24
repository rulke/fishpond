/* 钓具层：墨线竿 / 线 / 漂 / 抛竿分镜 / 收线动画。导出 Tackle */
(function () {
  "use strict";

  const layer = document.getElementById("lineLayer");
  const bobber = document.getElementById("bobber");
  const hookBait = document.getElementById("hookBait");

  layer.innerHTML = `
    <svg id="tackleSvg" width="100%" height="100%" style="position:absolute;inset:0">
      <defs>
        <linearGradient id="rodFade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#2c4a58" stop-opacity="0.15"/>
          <stop offset="30%" stop-color="#3d5a68"/>
          <stop offset="100%" stop-color="#3d5a68"/>
        </linearGradient>
      </defs>
      <!-- 竿影 -->
      <path id="rodShadow" fill="none" stroke="rgba(40,70,85,.10)" stroke-width="5" stroke-linecap="round"/>
      <!-- 竿体（墨线） -->
      <path id="rodPath" fill="none" stroke="url(#rodFade)" stroke-width="2.6" stroke-linecap="round"/>
      <path id="rodShine" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.8" stroke-linecap="round"/>
      <!-- 短握把：瓷白 -->
      <path id="rodGrip" fill="none" stroke="#eef5f8" stroke-width="5" stroke-linecap="round"/>
      <path id="rodGripEdge" fill="none" stroke="rgba(44,74,88,.25)" stroke-width="0.8" stroke-linecap="round"/>
      <!-- 导环 -->
      <circle id="guide1" r="2.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1"/>
      <circle id="guide2" r="1.8" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="0.9"/>
      <!-- 卷线瓷钮 -->
      <circle id="reelDot" r="3.2" fill="#dceaf0" stroke="rgba(44,74,88,.25)" stroke-width="0.8"/>
      <!-- 钓线 -->
      <path id="linePath" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-linecap="round"/>
    </svg>`;

  const rodPath = document.getElementById("rodPath");
  const rodShine = document.getElementById("rodShine");
  const rodGrip = document.getElementById("rodGrip");
  const rodGripEdge = document.getElementById("rodGripEdge");
  const rodShadow = document.getElementById("rodShadow");
  const linePath = document.getElementById("linePath");
  const guide1 = document.getElementById("guide1");
  const guide2 = document.getElementById("guide2");
  const reelDot = document.getElementById("reelDot");

  let baitSvg = "";
  let visible = false;
  let phase = "idle";
  let tension = 0.35;
  let bend = 0.04;
  let bendTarget = 0.04;
  let dip = 0;

  // 抛竿分镜
  let anim = null; // { t, from, to, dist }
  let bobX = 0, bobY = 0;
  let landFlash = 0;

  // 收线动画：漂沿原路收回竿尖，替代"瞬间消失"
  let reel = null; // { t, dur, fx, fy }
  let reelFlash = 0;

  function rodAnchor() {
    const W = innerWidth, H = innerHeight;
    return {
      bx: W + 10,
      by: H + 12,
      // 竿尖探入画面多一些，让"竿"看得见（扇面原点与此同源）
      tx: W > 720 ? W - 140 : W * 0.74,
      ty: H > 640 ? H - 120 : H * 0.8,
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
  }

  function hide() {
    visible = false;
    anim = null;
    reel = null;
    if (bobber) bobber.classList.remove("show");
    linePath.setAttribute("d", "");
    phase = "idle";
  }

  function setPhase(p, t) {
    if (reel) return;
    if (anim && p !== "flight" && p !== "castanim") return;
    phase = p;
    if (typeof t === "number") tension = t;
    if (p === "fight") bendTarget = 0.35 + tension * 0.55;
    else if (p === "windup") bendTarget = -0.55;
    else if (p === "whip") bendTarget = 0.7;
    else if (p === "flight") bendTarget = 0.2;
    else if (p === "bite") bendTarget = -0.3;
    else if (p === "wait") bendTarget = 0.08;
    else bendTarget = 0.04;
  }

  function setDip(d) { dip = d; }

  // 后摆→弹出→放线→落水
  function startFlight(from, to) {
    reel = null;
    anim = {
      t: 0,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      dist: to.dist || Math.hypot(to.x - from.x, to.y - from.y),
    };
    visible = true;
    if (bobber) {
      bobber.classList.add("show");
      bobber.style.transform = `translate(${from.x}px, ${from.y}px)`;
    }
    phase = "windup";
    bendTarget = -0.55;
    bobX = from.x;
    bobY = from.y;
  }

  function startReelIn() {
    if (!visible || reel) return;
    anim = null;
    reel = { t: 0, dur: 0.65, fx: bobX, fy: bobY };
    phase = "reelin";
    bend = -0.5; // 断线/收线的第一下回弹
    bendTarget = 0.16;
    reelFlash = 1; // 线白闪
  }

  // 白色水花环：咬钩等关键瞬间的物态标点
  function splashRing(x, y, big) {
    const n = big ? 2 : 1;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const ring = document.createElement("div");
        ring.className = "bite-ring";
        ring.style.left = x + "px";
        ring.style.top = y + "px";
        document.body.appendChild(ring);
        ring.animate([
          { transform: "translate(-50%,-50%) scale(.25)", opacity: .95 },
          { transform: `translate(-50%,-50%) scale(${big ? 2.2 : 1.5})`, opacity: 0 },
        ], { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => ring.remove();
      }, i * 130);
    }
  }

  function tipPosition() {
    const a = rodAnchor();
    const bendPx = bend * 22;
    return {
      x: a.tx - bendPx * 0.7,
      y: a.ty - bendPx * 0.7,
      baseX: a.tx,
      baseY: a.ty,
      gripX: a.bx - 56,
      gripY: a.by - 48,
    };
  }

  function updateAnim(dt) {
    if (!anim) return false;
    anim.t += dt;
    const t = anim.t;

    // 0–0.12 后摆 | 0.12–0.22 弹出 | 0.22–0.50 飞行 | 0.50–0.62 落水
    if (t < 0.12) {
      phase = "windup";
      bendTarget = -0.6;
    } else if (t < 0.22) {
      phase = "whip";
      bendTarget = 0.75;
    } else if (t < 0.5) {
      phase = "flight";
      bendTarget = 0.15;
      const u = (t - 0.22) / 0.28;
      const e = u * u * (3 - 2 * u);
      bobX = anim.from.x + (anim.to.x - anim.from.x) * e;
      const arc = Math.sin(u * Math.PI) * (48 + anim.dist * 0.1);
      bobY = anim.from.y + (anim.to.y - anim.from.y) * e - arc;
      if (bobber) bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px)`;
    } else if (t < 0.62) {
      phase = "land";
      bendTarget = 0.05;
      const u = (t - 0.5) / 0.12;
      bobX = anim.to.x;
      bobY = anim.to.y + Math.sin(u * Math.PI * 2) * 2.5;
      if (bobber) bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px)`;
      if (t >= 0.5 && landFlash < 0.01) landFlash = 1;
    } else {
      anim = null;
      phase = "wait";
      bendTarget = 0.08;
      return true;
    }
    return false;
  }

  function update(dt) {
    if (landFlash > 0) landFlash = Math.max(0, landFlash - dt * 2.5);
    if (reelFlash > 0) reelFlash = Math.max(0, reelFlash - dt * 2.2);

    if (reel) {
      reel.t += dt;
      const u = Math.min(1, reel.t / reel.dur);
      const e = u * u * (3 - 2 * u);
      const a = rodAnchor();
      bobX = reel.fx + (a.tx - reel.fx) * e;
      bobY = reel.fy + (a.ty - reel.fy) * e - Math.sin(u * Math.PI) * 14;
      if (bobber) bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px)`;
      if (u >= 1) hide();
    } else if (anim) {
      updateAnim(dt);
    } else if (visible && bobber) {
      // 静水期：漂体随涟漪场起伏 + 环境微波；dip 让试探/咬钩直接作用于漂体
      const nowS = performance.now() / 1000;
      let h = 0, dxs = 0;
      if (window.Water) {
        const f = Water.rippleField(bobX, bobY, nowS);
        h = f.h; dxs = f.dx;
      }
      const waveY = h * 30 + Math.sin(nowS * 1.35 + bobX * 0.013) * 1.4;
      const waveR = Math.max(-1, Math.min(1, dxs * 6)) * 5 + Math.sin(nowS * 0.9) * 2.5;
      bobber.style.transform =
        `translate(${bobX.toFixed(1)}px, ${(bobY + dip * 6 + waveY).toFixed(1)}px) rotate(${waveR.toFixed(2)}deg)`;
    }

    bend += (bendTarget - bend) * Math.min(1, dt * 12);
    let extra = 0;
    if (phase === "fight") {
      extra = Math.sin(performance.now() * 0.02) * tension * 2.5;
      // 张力进入预警带，竿尖开始发抖
      const warn = Math.max(0, (tension - 0.78) / 0.14);
      if (warn > 0) extra += Math.sin(performance.now() * 0.13) * warn * 3.2;
    }

    const tip = tipPosition();
    const tipX = tip.x + extra;
    const tipY = tip.y;
    const midX = (tipX + tip.gripX) / 2 + bend * 10;
    const midY = (tipY + tip.gripY) / 2 + bend * 6;

    const rodD = `M${tip.gripX.toFixed(1)} ${tip.gripY.toFixed(1)} Q${midX.toFixed(1)} ${midY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;
    rodPath.setAttribute("d", rodD);
    rodShine.setAttribute("d", rodD);
    rodShadow.setAttribute("d", `M${(tip.gripX + 3).toFixed(1)} ${(tip.gripY + 5).toFixed(1)} Q${(midX + 3).toFixed(1)} ${(midY + 5).toFixed(1)} ${(tipX + 2).toFixed(1)} ${(tipY + 4).toFixed(1)}`);
    rodGrip.setAttribute("d", `M${(tip.gripX + 14).toFixed(1)} ${(tip.gripY + 10).toFixed(1)} Q${(tip.gripX + 22).toFixed(1)} ${(tip.gripY + 16).toFixed(1)} ${(tip.gripX + 30).toFixed(1)} ${(tip.gripY + 22).toFixed(1)}`);
    rodGripEdge.setAttribute("d", rodGrip.getAttribute("d"));

    guide1.setAttribute("cx", (tipX + (tip.gripX - tipX) * 0.3).toFixed(1));
    guide1.setAttribute("cy", (tipY + (tip.gripY - tipY) * 0.3).toFixed(1));
    guide2.setAttribute("cx", (tipX + (tip.gripX - tipX) * 0.55).toFixed(1));
    guide2.setAttribute("cy", (tipY + (tip.gripY - tipY) * 0.55).toFixed(1));
    reelDot.setAttribute("cx", (tip.gripX + 8).toFixed(1));
    reelDot.setAttribute("cy", (tip.gripY + 8).toFixed(1));

    const showLine = visible || anim || phase === "fight";
    if (showLine) {
      const tx = tipX, ty = tipY;
      const bx = bobX, by = bobY + dip * 5;
      const dist = Math.hypot(tx - bx, ty - by) + 1;
      const effT = phase === "reelin" ? 0.85 : tension;
      // 越松垂得越多（1.4 次幂让低张力段下垂更明显）
      const slack = Math.pow(1 - Math.min(1, effT), 1.4) * 70 + 6;
      const flySlack = anim && phase === "flight" ? -18 : 0;
      const cx = (tx + bx) / 2;
      const cy = (ty + by) / 2 + slack + flySlack;
      linePath.setAttribute("d", `M${tx.toFixed(1)} ${ty.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
      // 线就是张力计：白 → 渐粉（预警） → 深粉（临界）；松弛时偏青
      let ls = "rgba(255,255,255,.6)", lw = 1.15;
      if (phase === "fight") {
        if (tension > 0.9) { ls = "rgba(233,110,130,.95)"; lw = 1.5; }
        else if (tension > 0.78) {
          const u = (tension - 0.78) / 0.12;
          ls = `rgba(${(255 - 22 * u) | 0},${(255 - 117 * u) | 0},${(255 - 101 * u) | 0},${(0.55 + 0.35 * u).toFixed(2)})`;
          lw = 1.15 + u * 0.35;
        } else if (tension < 0.22) { ls = "rgba(126,184,200,.8)"; lw = 0.9; }
      }
      if (reelFlash > 0) { ls = `rgba(255,255,255,${(0.55 + 0.4 * reelFlash).toFixed(2)})`; lw = 1.2 + reelFlash * 0.5; }
      linePath.setAttribute("stroke-width", lw.toFixed(2));
      linePath.setAttribute("stroke", ls);
    } else {
      linePath.setAttribute("d", "");
    }

    if (hookBait && baitSvg) hookBait.innerHTML = baitSvg;
  }

  window.Tackle = {
    setBait,
    show,
    hide,
    setPhase,
    setDip,
    startFlight,
    startReelIn,
    splashRing,
    update,
    get visible() { return visible; },
    get animating() { return !!anim; },
    get reeling() { return !!reel; },
    get landFlash() { return landFlash; },
  };
})();
