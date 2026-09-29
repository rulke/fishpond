/* 钓具层：墨线竿 / 线 / 漂 / 抛竿分镜 / 收线动画。导出 Tackle */
(function () {
  "use strict";

  const layer = document.getElementById("lineLayer");
  const bobber = document.getElementById("bobber");
  const hookBait = document.getElementById("hookBait");

  layer.innerHTML = `
    <svg id="tackleSvg" width="100%" height="100%" style="position:absolute;inset:0">
      <defs>
        <!-- 入口渐隐：竿根自底坞后探出时淡出，读作延伸到画面外 -->
        <linearGradient id="rodFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3d5a68" stop-opacity="0"/>
          <stop offset="16%" stop-color="#3d5a68" stop-opacity="1"/>
          <stop offset="100%" stop-color="#3d5a68" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <!-- 竿影 -->
      <path id="rodShadow" fill="none" stroke="rgba(40,70,85,.10)" stroke-width="5" stroke-linecap="round"/>
      <!-- 竿体：三段锥度，只露画外之竿 -->
      <path id="rodButt" fill="none" stroke="url(#rodFade)" stroke-width="3.4" stroke-linecap="round"/>
      <path id="rodMid" fill="none" stroke="url(#rodFade)" stroke-width="2.3" stroke-linecap="round"/>
      <path id="rodPath" fill="none" stroke="url(#rodFade)" stroke-width="1.4" stroke-linecap="round"/>
      <path id="rodShine" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.8" stroke-linecap="round"/>
      <!-- 导环：垂直于竿身的细椭圆 -->
      <ellipse id="guide1" rx="3.2" ry="1.2" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"/>
      <ellipse id="guide2" rx="2.8" ry="1.1" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="0.9"/>
      <ellipse id="guide3" rx="2.4" ry="1" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="0.85"/>
      <!-- 竿尖线结 -->
      <circle id="rodKnot" r="1.8" fill="rgba(255,255,255,.25)" stroke="rgba(255,255,255,.8)" stroke-width="1.1"/>
      <!-- 钓线 -->
      <path id="linePath" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-linecap="round"/>
    </svg>`;

  const rodFade = document.getElementById("rodFade");
  const rodPath = document.getElementById("rodPath");
  const rodButt = document.getElementById("rodButt");
  const rodMid = document.getElementById("rodMid");
  const rodShine = document.getElementById("rodShine");
  const rodShadow = document.getElementById("rodShadow");
  const rodKnot = document.getElementById("rodKnot");
  const linePath = document.getElementById("linePath");
  const guide1 = document.getElementById("guide1");
  const guide2 = document.getElementById("guide2");
  const guide3 = document.getElementById("guide3");

  let baitSvg = "";
  let visible = false;
  let phase = "idle";
  let tension = 0.35;
  let bend = 0.04;
  let bendTarget = 0.04;
  let dip = 0;

  // 抛竿分镜
  let anim = null; // { t, from, to, dist, flightDur, arcH }
  let bobX = 0, bobY = 0;
  let landFlash = 0;

  // 收线动画：漂沿原路收回竿尖，替代"瞬间消失"
  let reel = null; // { t, dur, fx, fy }
  let reelFlash = 0;

  // 线跟随：跃出水面的鱼 / 遛鱼中的鱼把线带离漂位
  let lineFollowPt = null;

  // 竿随线转向：绕入口点旋转，方位平滑追踪线的末端
  let rodAng = null;    // 当前方位角（屏幕坐标，向上为负角）
  let rodFocus = null;  // 待机时由 App 喂入的瞄准焦点
  function setRodFocus(x, y) { rodFocus = (x == null) ? null : { x, y }; }
  function angDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // 黑漂拖走：漂位被咬钩的鱼拽着走
  let dragPt = null;
  function dragFloatTo(x, y) { dragPt = { x, y }; }
  function clearDragFloat() { dragPt = null; }
  function setFloatPos(x, y) { bobX = x; bobY = y; }

  // 起竿（hookset）与空扬竿（twitch）的时间线
  let hooksetT = -1, twitchT = -1;

  function rodAnchor() {
    const W = innerWidth, H = innerHeight;
    // 画外之手：竿根隐在底坞之后，只露从中段到竿尖的一段
    const bx = W > 720 ? W * 0.5 + 150 : W * 0.5 + 95;
    const by = H + 8;
    const rtx = W > 720 ? W * 0.5 + 60 : W * 0.55;
    const rty = H > 640 ? H * 0.74 : H * 0.76;
    return {
      bx, by,
      len: Math.hypot(rtx - bx, rty - by),
      restAng: Math.atan2(rty - by, rtx - bx),
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

  // 后摆→弹出→放线→落水；飞行时长随抛距伸缩
  function startFlight(from, to) {
    reel = null;
    const dist = to.dist || Math.hypot(to.x - from.x, to.y - from.y);
    anim = {
      t: 0,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      dist,
      flightDur: 0.3 + Math.min(0.3, dist / 650 * 0.26),
      arcH: 26 + dist * 0.16,
    };
    visible = true;
    if (bobber) {
      bobber.classList.add("show");
      bobber.style.transform = `translate(${from.x}px, ${from.y}px)`;
    }
    phase = "windup";
    bendTarget = -0.8;
    bobX = from.x;
    bobY = from.y;
  }

  // 抛竿全程耗时（毫秒），供等待期计时器对齐分镜
  function castDuration(dist) {
    const fd = 0.3 + Math.min(0.3, dist / 650 * 0.26);
    return Math.round((0.26 + fd + 0.14) * 1000);
  }

  // 钓线改跟跃出水面/遛鱼中的鱼
  function lineFollow(x, y) { lineFollowPt = { x, y }; }
  function clearLineFollow() { lineFollowPt = null; }

  // 起竿：竿猛甩向肩后再回弹入遛鱼（0.55s 爆发，弯曲线由 update 覆盖）
  function startHookset() {
    hooksetT = 0;
    reelFlash = 1;
  }

  // 空扬竿：等待期轻点/上滑，竿小幅一动
  function startTwitch() {
    twitchT = 0;
  }

  // 咬钩急环：荷粉色双脉冲，两拍正好是咬钩窗口
  function bitePulse(x, y) {
    const el = document.createElement("div");
    el.className = "bite-pulse";
    el.style.left = x + "px";
    el.style.top = y + "px";
    document.body.appendChild(el);
    el.animate([
      { transform: "translate(-50%,-50%) scale(.5)", opacity: 1 },
      { transform: "translate(-50%,-50%) scale(1.7)", opacity: 0 },
    ], { duration: 800, iterations: 2, easing: "ease-out" }).onfinish = () => el.remove();
  }

  function setBobberVisible(v) {
    if (bobber) bobber.classList.toggle("show", !!v && visible);
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
    const ang = rodAng === null ? a.restAng : rodAng;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const tipLen = a.len + bend * 22 * 0.9; // 甩鞭伸长 / 后摆缩短
    return {
      x: a.bx + dx * tipLen,
      y: a.by + dy * tipLen,
      baseX: a.bx,
      baseY: a.by,
      gripX: a.bx,
      gripY: a.by,
      dx, dy,
    };
  }

  function updateAnim(dt) {
    if (!anim) return false;
    anim.t += dt;
    const t = anim.t;
    const WIND = 0.18, WHIP = 0.26;
    const F_END = WHIP + anim.flightDur;
    const L_END = F_END + 0.14;

    if (t < WIND) {
      // 深后摆蓄力
      phase = "windup";
      bendTarget = -0.8;
    } else if (t < WHIP) {
      // 鞭击：竿尖猛然前甩
      phase = "whip";
      bendTarget = 1.0;
    } else if (t < F_END) {
      // 飞行：水平渐减速 + 抛物线 + 漂体空翻
      phase = "flight";
      bendTarget = 0.32 - (t - WHIP) / anim.flightDur * 0.2;
      const u = (t - WHIP) / anim.flightDur;
      const e = 1 - (1 - u) * (1 - u);
      bobX = anim.from.x + (anim.to.x - anim.from.x) * e;
      bobY = anim.from.y + (anim.to.y - anim.from.y) * e - Math.sin(u * Math.PI) * anim.arcH;
      if (bobber) bobber.style.transform =
        `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px) rotate(${Math.round(u * 320)}deg)`;
    } else if (t < L_END) {
      // 落水：两次渐弱弹跳 + 水花
      phase = "land";
      bendTarget = 0.06;
      const u = (t - F_END) / 0.14;
      bobX = anim.to.x;
      bobY = anim.to.y + Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u) * 10;
      if (bobber) bobber.style.transform = `translate(${bobX.toFixed(1)}px, ${bobY.toFixed(1)}px)`;
      if (landFlash < 0.01) landFlash = 1;
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
    // 黑漂：漂被咬钩的鱼拽着走（滞后跟随）
    if (dragPt && phase === "bite") {
      bobX += (dragPt.x - bobX) * Math.min(1, dt * 4);
      bobY += (dragPt.y - bobY) * Math.min(1, dt * 4);
    }

    // 竿随线转向：鱼（遛鱼/跃出）→ 漂 → 待机瞄准焦点；限制在池侧扇区
    const A0 = rodAnchor();
    if (rodAng === null) rodAng = A0.restAng;
    const focus = lineFollowPt || (visible ? { x: bobX, y: bobY } : null) || rodFocus;
    if (focus) {
      const ta0 = Math.atan2(focus.y - A0.by, focus.x - A0.bx);
      const ta = Math.max(-160 * Math.PI / 180, Math.min(-35 * Math.PI / 180, ta0));
      rodAng += angDelta(ta, rodAng) * Math.min(1, dt * 3);
    }

    if (reel) {
      reel.t += dt;
      const u = Math.min(1, reel.t / reel.dur);
      const e = u * u * (3 - 2 * u);
      const tp0 = tipPosition();
      bobX = reel.fx + (tp0.x - reel.fx) * e;
      bobY = reel.fy + (tp0.y - reel.fy) * e;
      // 收杆：漂贴水跳回（渐弱弹跳），竿身上扬，跳点起小涟漪
      const hop = Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * 30;
      bobY -= hop;
      bendTarget = -0.2 + u * 0.5;
      reel.dropT = (reel.dropT || 0) - dt;
      if (hop > 8 && reel.dropT <= 0 && window.Water) {
        Water.addDrop(bobX, bobY, 7, 0.2);
        reel.dropT = 0.16;
      }
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
    // 起竿爆发：猛甩向肩后 → 回弹过冲 → 交给遛鱼弯曲
    if (hooksetT >= 0) {
      hooksetT += dt;
      if (hooksetT < 0.15) bendTarget = -1.15;
      else {
        const u = Math.min(1, (hooksetT - 0.15) / 0.4);
        bendTarget = 1.0 - u * 0.35;
      }
      extra += Math.sin(hooksetT * 40) * 2;
      if (hooksetT > 0.55) hooksetT = -1;
    }
    // 空扬竿：竿小幅一动
    if (twitchT >= 0) {
      twitchT += dt;
      bendTarget = -0.38 * Math.sin(Math.min(1, twitchT / 0.3) * Math.PI);
      if (twitchT > 0.32) twitchT = -1;
    }
    const tip = tipPosition();
    const tipX = tip.x + extra;
    const tipY = tip.y;
    // 弯折的法向弓起：随竿身方位一起转
    const midX = (tipX + tip.gripX) / 2 + (-tip.dy) * bend * 12;
    const midY = (tipY + tip.gripY) / 2 + tip.dx * bend * 12;

    // 二次曲线采点：入口(0) → 竿尖(1)
    const eX = tip.gripX, eY = tip.gripY;
    const qAt = (t) => {
      const u = 1 - t;
      return [u * u * eX + 2 * u * t * midX + t * t * tipX,
              u * u * eY + 2 * u * t * midY + t * t * tipY];
    };
    const seg = (el, t0, t1) => {
      const p0 = qAt(t0), pc = qAt((t0 + t1) / 2), p1 = qAt(t1);
      el.setAttribute("d", `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q${pc[0].toFixed(1)} ${pc[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`);
    };
    seg(rodButt, 0, 0.46);
    seg(rodMid, 0.32, 0.72);
    seg(rodPath, 0.58, 1);
    // 入口渐隐方向随竿身
    rodFade.setAttribute("x1", eX.toFixed(1));
    rodFade.setAttribute("y1", eY.toFixed(1));
    rodFade.setAttribute("x2", tipX.toFixed(1));
    rodFade.setAttribute("y2", tipY.toFixed(1));
    const sh0 = qAt(0.14);
    rodShadow.setAttribute("d", `M${(sh0[0] + 3).toFixed(1)} ${(sh0[1] + 5).toFixed(1)} Q${(midX + 3).toFixed(1)} ${(midY + 5).toFixed(1)} ${(tipX + 2).toFixed(1)} ${(tipY + 4).toFixed(1)}`);
    const up0 = qAt(0), upc = qAt(0.5), up1 = qAt(1);
    rodShine.setAttribute("d", `M${(up0[0] - 1.2).toFixed(1)} ${(up0[1] - 0.9).toFixed(1)} Q${(upc[0] - 1.2).toFixed(1)} ${(upc[1] - 0.9).toFixed(1)} ${(up1[0] - 1.2).toFixed(1)} ${(up1[1] - 0.9).toFixed(1)}`);
    // 导环贴竿身、垂直朝向
    const guideAt = (el, t) => {
      const p = qAt(t);
      const ddx = 2 * (1 - t) * (midX - eX) + 2 * t * (tipX - midX);
      const ddy = 2 * (1 - t) * (midY - eY) + 2 * t * (tipY - midY);
      const deg = Math.atan2(ddy, ddx) * 180 / Math.PI + 90;
      el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${deg.toFixed(1)})`);
    };
    guideAt(guide1, 0.42);
    guideAt(guide2, 0.66);
    guideAt(guide3, 0.88);
    rodKnot.setAttribute("cx", tipX.toFixed(1));
    rodKnot.setAttribute("cy", tipY.toFixed(1));

    const showLine = visible || anim || phase === "fight";
    if (showLine) {
      const tx = tipX, ty = tipY;
      // 线的终点：默认是漂；鱼跃出水面时改跟鱼体
      const bx = lineFollowPt ? lineFollowPt.x : bobX;
      const by = (lineFollowPt ? lineFollowPt.y : bobY) + dip * 5;
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
    setRodFocus,
    startHookset,
    startTwitch,
    setBobberVisible,
    splashRing,
    bitePulse,
    lineFollow,
    clearLineFollow,
    dragFloatTo,
    clearDragFloat,
    setFloatPos,
    castDuration,
    update,
    get visible() { return visible; },
    get animating() { return !!anim; },
    get reeling() { return !!reel; },
    // 漂正浮在水面（脱钩后未收回）：长按收线/原位再抛用
    get floating() { return visible && !reel && !anim; },
    get floatPos() { return { x: bobX, y: bobY }; },
    get landFlash() { return landFlash; },
  };
})();
