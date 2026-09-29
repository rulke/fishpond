/* UI 组装：扇面拖抛、青瓷冰裂、全物态反馈（无飘字）。导出 App */
(function () {
  "use strict";

  const SAVE_KEY = "fishpond_save_v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    baitBar: $("baitBar"),
    baitTag: $("baitTag"),
    card: $("catchCard"),
    cardFish: $("cardFish"),
    cardName: $("cardName"),
    cardMeta: $("cardMeta"),
    cardPoem: $("cardPoem"),
    cardRarity: $("cardRarity"),
    cardBadge: $("cardBadge"),
    btnKeep: $("btnKeep"),
    btnRelease: $("btnRelease"),
    journalBtn: $("journalBtn"),
    journal: $("journal"),
    journalGrid: $("journalGrid"),
    journalClose: $("journalClose"),
    journalStats: $("journalStats"),
    zenBeads: $("zenBeads"),
    tensionWrap: $("tensionWrap"),
    reelNeedle: $("reelNeedle"),
    helpBtn: $("helpBtn"),
    help: $("help"),
    helpClose: $("helpClose"),
    aimFan: $("aimFan"),
    aimVeil: $("aimVeil"),
    castHint: $("castHint"),
    dock: $("dock"),
  };

  const save = loadSave();
  let sweetStart = 0.42;
  const SWEET_W = 0.12;

  // 拖抛瞄准
  let aiming = false;
  let aim = null; // Fishing.aimFromPointer 结果
  let fanKey = "";
  let tagTimer = 0;
  let press = null; // 按下手势：{x, y, t0, fired}——按时长/位移/方向分类
  let fanHoldUntil = 0; // 逃鱼/收线后扇面缓一拍再回来

  try {
    const rawSweet = localStorage.getItem("fishpond_sweet");
    if (rawSweet != null && Number.isFinite(Number(rawSweet))) sweetStart = Number(rawSweet);
    else sweetStart = 0.12 + Math.random() * 0.72;
  } catch (e) {
    sweetStart = 0.12 + Math.random() * 0.72;
  }
  sweetStart = Math.max(0.05, Math.min(0.83, sweetStart));

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          zen: typeof p.zen === "number" ? p.zen : 50,
          bait: p.bait || "worm",
          records: p.records || {},
          totalCaught: p.totalCaught || 0,
          totalReleased: p.totalReleased || 0,
          bestWeight: p.bestWeight || 0,
          hintDone: !!p.hintDone,
        };
      }
    } catch (e) { /* 坏档则重开 */ }
    return { zen: 50, bait: "worm", records: {}, totalCaught: 0, totalReleased: 0, bestWeight: 0, hintDone: false };
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      localStorage.setItem("fishpond_sweet", String(sweetStart));
    } catch (e) { /* 隐身模式忽略 */ }
  }

  function inSweet(p) {
    return p >= sweetStart && p <= sweetStart + SWEET_W;
  }

  // 甜区只在一次收获后才换位置，肌肉记忆不白练
  function rerollSweet() {
    sweetStart = 0.1 + Math.random() * 0.74;
    persist();
  }

  /* ---------- zen beads ---------- */
  function paintZen(v) {
    save.zen = v;
    persist();
    const filled = Math.round((v / 100) * 5);
    let html = "";
    for (let i = 0; i < 5; i++) {
      const on = i < filled;
      const full = v >= 95 && i === 4;
      html += `<span class="zen-bead${on ? " on" : ""}${full ? " full" : ""}"></span>`;
    }
    els.zenBeads.innerHTML = html;
  }

  // 放流后一颗静心珠从按钮飞回顶栏
  function flyBead(fromEl) {
    const a = fromEl.getBoundingClientRect();
    const b = els.zenBeads.getBoundingClientRect();
    const bead = document.createElement("span");
    bead.className = "fly-bead";
    bead.style.left = (a.left + a.width / 2) + "px";
    bead.style.top = (a.top + a.height / 2) + "px";
    document.body.appendChild(bead);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    bead.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: .1 },
    ], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => bead.remove();
  }

  /* ---------- bait ---------- */
  function baitSvgOf(id) {
    const b = Fishing.getBaits().find((x) => x.id === id);
    return b ? b.svg : "";
  }

  function showBaitTag(b) {
    const liked = Fishing.getSpecies().filter((sp) => sp.baits.includes(b.id));
    const fish = liked.map((sp) => {
      const c = Fishing.getRarityMeta(sp.rarity).color;
      return `<svg viewBox="0 0 20 10" aria-label="${sp.name}"><path d="M19 5 C15 1 9 1 5 4 L1 1 L2.5 5 L1 9 L5 6 C9 9 15 9 19 5 Z" fill="${c}"/></svg>`;
    }).join("");
    els.baitTag.innerHTML = `<b>${b.name}</b><i>${b.desc}</i><span class="tag-fish">${fish}</span>`;
    els.baitTag.classList.add("show");
    clearTimeout(tagTimer);
    tagTimer = setTimeout(() => els.baitTag.classList.remove("show"), 2400);
  }

  function paintBait(idOrObj, silent) {
    const id = typeof idOrObj === "string" ? idOrObj : idOrObj.id;
    save.bait = id;
    persist();
    const svg = baitSvgOf(id);
    if (window.Tackle) Tackle.setBait(svg);
    for (const el of els.baitBar.querySelectorAll(".bait-chip")) {
      const on = el.dataset.id === id;
      el.classList.toggle("on", on);
      if (on && !silent) {
        el.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
          { duration: 280, easing: "ease-out" }
        );
      }
    }
    if (!silent) {
      const b = Fishing.getBaits().find((x) => x.id === id);
      if (b) showBaitTag(b);
    }
  }

  function buildBaitBar() {
    els.baitBar.innerHTML = "";
    for (const b of Fishing.getBaits()) {
      const btn = document.createElement("button");
      btn.className = "bait-chip";
      btn.dataset.id = b.id;
      btn.title = b.name;
      btn.setAttribute("aria-label", b.name);
      btn.innerHTML = `<span class="bait-ico">${b.svg}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Fishing.setBait(b.id);
      });
      els.baitBar.appendChild(btn);
    }
    paintBait(save.bait, true);
  }

  /* ---------- 扇面拖抛 ---------- */
  function paintAim(force) {
    const st = Fishing.st.state;
    const showAim = aim && (aiming || st === Fishing.S.IDLE);
    if (!showAim || !aim) {
      if (els.aimFan.childNodes.length) els.aimFan.innerHTML = "";
      fanKey = "";
      return;
    }
    const sweet = inSweet(aim.pow);
    // 全屏任选落点：待机只有幽灵圈，按住才有预览漂；亮带=绕竿尖的距离环
    const mode = aiming ? "aim" : "idle";
    const key = [mode, aim.x.toFixed(1), aim.y.toFixed(1), sweet ? 1 : 0].join("|");
    if (!force && key === fanKey) return;
    fanKey = key;

    const { rx, ry, maxD } = aim;
    const s0 = sweetStart, s1 = sweetStart + SWEET_W;
    const r0 = s0 * maxD, r1 = s1 * maxD;
    const rMid = (r0 + r1) / 2;
    // 距离甜区：绕竿尖一圈的亮带（方向不限）
    const band = (fill, edge) => `
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${rMid.toFixed(1)}" fill="none"
        stroke="rgba(159,208,220,${fill})" stroke-width="${(r1 - r0).toFixed(1)}"/>
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${r0.toFixed(1)}" fill="none"
        stroke="rgba(255,255,255,${edge})" stroke-width="1"/>
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${r1.toFixed(1)}" fill="none"
        stroke="rgba(255,255,255,${edge})" stroke-width="1"/>`;
    const [xt, yt] = [aim.x, aim.y];
    const ghost = `
      <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="14" fill="none"
        stroke="rgba(44,74,88,.55)" stroke-width="1.4" stroke-dasharray="5 5"/>
      <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="2.8" fill="rgba(44,74,88,.55)"/>`;
    const preview = `
      <g class="pv-bob${sweet ? " sweet" : ""}" transform="translate(${xt.toFixed(1)} ${yt.toFixed(1)})${sweet ? " translate(0 2)" : ""}">
        <ellipse cx="0" cy="10" rx="9" ry="2.6" fill="rgba(255,255,255,.28)"/>
        <rect x="-2.6" y="-13" width="5.2" height="6" rx="2.6" fill="#e88a9a"/>
        <rect x="-4.6" y="-7.6" width="9.2" height="12" rx="4" fill="#fbfdfe" stroke="rgba(120,160,180,.55)" stroke-width="1"/>
        <rect x="-0.9" y="4.4" width="1.8" height="7" rx="0.9" fill="#a88868"/>
      </g>`;

    if (mode === "idle") {
      // 漂还浮在水面（脱钩后）就不画幽灵圈，真漂即是位置
      els.aimFan.innerHTML = band(0.12, 0.22) + (Tackle.floating ? "" : ghost);
      return;
    }
    els.aimFan.innerHTML = band(0.28, 0.45) + preview;
  }

  function startAim(x, y) {
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    aiming = true;
    aim = Fishing.aimFromPointer(x, y);
    els.aimVeil.classList.add("show");
    paintAim(true);
  }

  function moveAim(x, y) {
    if (!aiming) return;
    const next = Fishing.aimFromPointer(x, y);
    aim = next;
    paintAim();
  }

  let holdRingAnim = null;
  function holdRingShow(x, y) {
    if (!els.holdRing) {
      els.holdRing = document.createElement("div");
      els.holdRing.id = "holdRing";
      document.body.appendChild(els.holdRing);
    }
    els.holdRing.style.left = x + "px";
    els.holdRing.style.top = y + "px";
    els.holdRing.classList.add("show");
    holdRingAnim = els.holdRing.animate([
      { transform: "scale(1.2)", opacity: .95 },
      { transform: "scale(.42)", opacity: .5 },
    ], { duration: 450, easing: "ease-in" });
    holdRingAnim.onfinish = () => {
      holdRingAnim = null;
      els.holdRing.classList.remove("show");
      if (press && !press.fired && Fishing.st.state === Fishing.S.WAITING) {
        press.fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        Fishing.retract();
      } else if (press && !press.fired && Tackle.floating && Fishing.st.state === Fishing.S.IDLE) {
        // 脱钩后漂留在水面：长按同样收线
        press.fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        Tackle.startReelIn();
      }
    };
  }
  function holdRingCancel() {
    if (holdRingAnim) { holdRingAnim.cancel(); holdRingAnim = null; }
    if (els.holdRing) els.holdRing.classList.remove("show");
  }

  function clearFan() {
    els.aimFan.innerHTML = "";
    fanKey = "";
    els.aimVeil.classList.remove("show");
  }

  function endAim(x, y) {
    if (!aiming) return;
    aiming = false;
    clearFan();
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    // 极短按则以落点为瞄准
    const target = aim || Fishing.aimFromPointer(x, y);
    castTo(target.x, target.y);
  }

  function cancelAim() {
    if (!aiming) { return; }
    aiming = false;
    clearFan();
  }

  function castTo(x, y) {
    if (window.Tackle && Tackle.reeling) return false; // 漂还没收回，先不抛
    const ok = Fishing.castPoint(x, y);
    if (ok) {
      clearFan();
      if (window.Life) Life.disperse();
      if (!save.hintDone) { save.hintDone = true; persist(); } // 首竿成，引导圈退役
      if (window.Tackle) {
        // 分镜落点必须用钳制后的真实落点；漂在水面时从原位直接甩往新钓点
        const lx = Fishing.st.lineX, ly = Fishing.st.lineY;
        const fromPt = Tackle.floating ? Tackle.floatPos() : { x: Fishing.st.rodX, y: Fishing.st.rodY };
        Tackle.startFlight(fromPt, {
          x: lx, y: ly, dist: Math.hypot(lx - fromPt.x, ly - fromPt.y),
        });
        Tackle.setBait(baitSvgOf(save.bait));
      }
    }
    return ok;
  }

  /* ---------- journal ---------- */
  // 鱼鉴用的扁平小鱼：与渔获卡同一设计语言
  function miniFishSvg(sp, w) {
    const c1 = sp.colors[0], c2 = sp.colors[1];
    return `<svg viewBox="0 0 60 28" width="${w}" height="${Math.round(w * 28 / 60)}" aria-hidden="true">
      <path d="M50 14 C44 6 32 4 22 8 C16 10 12 12 12 14 C12 16 16 18 22 20 C32 24 44 22 50 14 Z" fill="${c1}"/>
      <path d="M13 14 L4 7 L6.5 14 L4 21 Z" fill="${c2}"/>
      <ellipse cx="33" cy="13" rx="6" ry="3" fill="${c2}" opacity=".45"/>
      <circle cx="45" cy="13" r="1.6" fill="#233"/>
    </svg>`;
  }

  function buildJournal() {
    const list = Fishing.getSpecies();
    const groups = {};
    for (const sp of list) (groups[sp.rarity] = groups[sp.rarity] || []).push(sp);
    const order = ["common", "mid", "rare", "epic", "legend"];
    let html = "";
    for (const r of order) {
      const g = groups[r];
      if (!g) continue;
      const meta = Fishing.getRarityMeta(r);
      html += `<div class="j-group"><div class="j-group-head" style="color:${meta.color}">${meta.label}</div><div class="j-grid">`;
      for (const sp of g) {
        const rec = save.records[sp.id];
        html += rec && rec.count > 0
          ? `<button class="j-cell got"><div class="j-fish">${miniFishSvg(sp, 76)}</div><div class="j-name">${sp.name}</div><div class="j-sub">${rec.count} 尾 · ${rec.best} kg</div></button>`
          : `<button class="j-cell"><div class="j-dot" style="background:${meta.color}"></div><div class="j-name">？？？</div><div class="j-sub">${meta.label}</div></button>`;
      }
      html += `</div></div>`;
    }
    els.journalGrid.innerHTML = html;
    // 统计：识得 / 收进 / 放流 / 最大纪录
    let best = null;
    for (const id in save.records) {
      const rec = save.records[id];
      if (rec.count > 0 && rec.best > 0 && (!best || rec.best > best.best)) {
        best = { name: rec.name, best: rec.best };
      }
    }
    els.journalStats.textContent =
      `识得 ${Object.keys(save.records).length}/${list.length} · 收进 ${save.totalCaught} · 放流 ${save.totalReleased}` +
      (best ? ` · 最大 ${best.name} ${best.best} kg` : "");
  }

  function openJournal() {
    buildJournal();
    els.journal.classList.add("open");
  }
  function closeJournal() {
    els.journal.classList.remove("open");
  }

  /* ---------- catch card ---------- */
  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (v >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((v >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (v & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }
  function paintCardFish(sp) {
    const c1 = sp.colors[0], c2 = sp.colors[1];
    els.cardFish.setAttribute("viewBox", "0 0 240 120");
    els.cardFish.innerHTML = `
      <ellipse cx="122" cy="100" rx="88" ry="8" fill="#123" opacity=".07"/>
      <g transform="translate(22 16) scale(3.3)">
        <g class="cf-tail" style="transform-origin:13px 14px">
          <path d="M13 14 L4 7 L6.5 14 L4 21 Z" fill="${c2}"/>
        </g>
        <path d="M50 14 C44 6 32 4 22 8 C16 10 12 12 12 14 C12 16 16 18 22 20 C32 24 44 22 50 14 Z" fill="${c1}"/>
        <ellipse cx="31" cy="13" rx="7" ry="3.2" fill="${c2}" opacity=".45"/>
        <circle cx="45" cy="13" r="1.8" fill="#233"/>
        <circle cx="44.5" cy="12.5" r="0.6" fill="#fff" opacity=".9"/>
      </g>`;
  }

  function showCard(fish) {
    const sp = fish.sp;
    const rmeta = Fishing.getRarityMeta(sp.rarity);
    els.cardRarity.textContent = rmeta.label;
    els.cardRarity.style.setProperty("--seal", rmeta.color);
    const rec = save.records[sp.id];
    if (!rec || rec.count === 0) {
      els.cardBadge.textContent = "初见";
      els.cardBadge.hidden = false;
    } else if (fish.weight > save.bestWeight) {
      els.cardBadge.textContent = "新记";
      els.cardBadge.hidden = false;
    } else {
      els.cardBadge.hidden = true;
    }
    els.cardName.textContent = sp.name;
    els.cardMeta.textContent = `${fish.weight} kg · ${fish.size} cm · ${Fishing.st.bait.name}`;
    els.cardPoem.textContent = sp.poem;
    paintCardFish(sp);
    els.card.classList.remove("leave");
    els.card.classList.add("show");
  }

  function hideCard() {
    els.card.classList.add("leave");
    setTimeout(() => els.card.classList.remove("show", "leave"), 280);
  }

  function recordKeep(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    save.records[id].count += 1;
    save.records[id].best = Math.max(save.records[id].best, fish.weight);
    save.totalCaught += 1;
    save.bestWeight = Math.max(save.bestWeight, fish.weight);
    persist();
  }

  function recordSeen(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    save.totalReleased += 1;
    persist();
  }

  function sinkButton(el) {
    el.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }],
      { duration: 220, easing: "ease-out" }
    );
  }

  /* ---------- panels：状态只用器物与按钮表达，不飘字 ---------- */
  function paintPanels(st) {
    els.tensionWrap.classList.toggle("show", st.state === Fishing.S.FIGHTING);
    els.dock.classList.toggle("card-mode", st.state === Fishing.S.CAUGHT);
    if (st.state !== Fishing.S.IDLE) {
      // 离开待机就收掉扇面与暗角，不留残影
      aiming = false;
      clearFan();
    }
  }

  /* ---------- fishing events ---------- */
  Fishing.onEvent = (type, data) => {
    switch (type) {
      case "bait":
        paintBait(data.bait, data.silent);
        break;
      case "zen":
        paintZen(data.zen);
        break;
      case "waiting":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "nibble":
      case "nibbleTick":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "bite":
        if (window.Tackle) {
          Tackle.setPhase("bite");
          Tackle.splashRing(Fishing.st.lineX, Fishing.st.lineY);
          Tackle.bitePulse(Fishing.st.lineX, Fishing.st.lineY);
        }
        if (window.Life) Life.lungeBait();
        break;
      case "fight":
        if (window.Tackle) {
          Tackle.setPhase("fight", Fishing.st.tension);
          Tackle.startHookset();
          Tackle.setBobberVisible(false);
          Tackle.splashRing(Fishing.st.lineX, Fishing.st.lineY, true);
        }
        if (window.Water) Water.addDrop(Fishing.st.lineX, Fishing.st.lineY, 24, 1.1);
        if (window.Life) Life.hookActive();
        break;
      case "blank":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "escaped":
        hideCard();
        fanHoldUntil = performance.now() + 800;
        {
          const fk = window.Life ? Life.currentKoi() : null;
          if (data.from === "fight" && fk) {
            // 鱼松口窜走，漂在它脱钩的位置弹回水面
            Fishing.st.lineX = fk.x; Fishing.st.lineY = fk.y;
            if (window.Tackle) {
              Tackle.setFloatPos(fk.x, fk.y);
              Tackle.setBobberVisible(true);
            }
            Fishing.st.biteRebound = 0.7;
            Fishing.st.biteReboundAmp = 3;
          }
        }
        if (window.Water && data.from === "fight") {
          // 断线的"崩"：大水花标在断点
          Water.addDrop(Fishing.st.lineX, Fishing.st.lineY, 30, 1.2);
        }
        if (window.Life) Life.fleeBait();
        if (window.Tackle && (data.from === "fight" || data.from === "bite")) {
          // 脱钩后漂浮在原地（真实）：不自动收线，玩家长按收线或直接换钓点
          Tackle.setPhase("wait");
        }
        if (window.Tackle && data.from === "nibble") {
          // 提前扬竿是玩家自己提的竿：竿已出水，收线合理
          setTimeout(() => Tackle.startReelIn(), 80);
        }
        break;
      case "retract":
        fanHoldUntil = performance.now() + 800;
        if (window.Life) Life.disperse();
        if (window.Tackle) Tackle.startReelIn();
        break;
      case "caught":
        if (window.Tackle) {
          Tackle.show(Fishing.st.lineX, Fishing.st.lineY);
          Tackle.setPhase("wait");
        }
        if (window.Life) Life.leapCatch();
        setTimeout(() => showCard(data.fish), 650);
        break;
      case "kept":
        sinkButton(els.btnKeep);
        if (window.Life) Life.removeCurrent();
        setTimeout(() => {
          if (window.Tackle) Tackle.startReelIn();
          hideCard();
          rerollSweet();
        }, 140);
        break;
      case "released":
        sinkButton(els.btnRelease);
        flyBead(els.btnRelease);
        if (window.Life) Life.releaseCurrent();
        setTimeout(() => {
          if (window.Tackle) Tackle.startReelIn();
          hideCard();
          rerollSweet();
        }, 140);
        break;
      default:
        break;
    }
    paintPanels(Fishing.st);
  };

  /* ---------- input ---------- */
  function isUiTarget(e) {
    return e.target.closest(".hud, .panel, .card, .bait-chip");
  }

  function onPointerDown(e) {
    if (isUiTarget(e)) return;
    const st = Fishing.st;
    const onBobber = !!(e.target.closest && e.target.closest("#bobber"));
    if (st.state === Fishing.S.BITE) {
      // 起竿：没顶后任意按下即提竿（起竿爆发动画在 fight 事件里）
      Fishing.hook();
      return;
    }
    if (st.state === Fishing.S.NIBBLE) {
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      if (onBobber) { press.fired = true; Fishing.hook(); } // 点漂=提前扬竿
      else if (window.Water) Water.addDrop(e.clientX, e.clientY, 5, 0.1);
      return;
    }
    if (st.state === Fishing.S.WAITING) {
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      holdRingShow(e.clientX, e.clientY); // 长按 450ms 收线
      return;
    }
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true);
      return;
    }
    if (st.state === Fishing.S.IDLE) {
      if (window.Tackle && Tackle.reeling) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 6, 0.14);
        return;
      }
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      if (window.Tackle && Tackle.floating) holdRingShow(e.clientX, e.clientY); // 漂在水面：长按收线
    }
  }

  function onPointerMove(e) {
    if (aiming) {
      moveAim(e.clientX, e.clientY);
      return;
    }
    if (!press || press.fired) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    const dt = performance.now() - press.t0;
    const st = Fishing.st;
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true); // 起竿后按住不放，直接进入收线节奏
      return;
    }
    if (st.state === Fishing.S.NIBBLE && dy < -40 && dt < 350) {
      press.fired = true;
      holdRingCancel();
      Fishing.hook(); // 上滑=提前扬竿
      return;
    }
    if (st.state === Fishing.S.WAITING && dy < -40 && dt < 350) {
      press.fired = true;
      holdRingCancel();
      Tackle.startTwitch(); // 空扬竿：竿轻点水
      if (window.Water) Water.addDrop(press.x, press.y, 8, 0.25);
      return;
    }
    if (st.state === Fishing.S.IDLE && Math.hypot(dx, dy) > 24) {
      holdRingCancel();
      startAim(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    Fishing.setReeling(false);
    if (aiming) {
      press = null;
      endAim(e.clientX, e.clientY);
      return;
    }
    if (press) {
      const fired = press.fired;
      press = null;
      holdRingCancel();
      if (fired) return;
      const st = Fishing.st;
      if (st.state === Fishing.S.WAITING) {
        Tackle.startTwitch(); // 轻点=空扬竿
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 8, 0.25);
      } else if (st.state === Fishing.S.NIBBLE) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 5, 0.1);
      } else if (st.state === Fishing.S.IDLE) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 7, 0.18);
      }
    }
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", (e) => {
    Fishing.setReeling(false);
    press = null;
    holdRingCancel();
    if (aiming) cancelAim();
  });

  els.tensionWrap.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });

  els.btnKeep.addEventListener("click", (e) => {
    e.stopPropagation();
    if (Fishing.st.pendingFish) recordKeep(Fishing.st.pendingFish);
    Fishing.keepCatch();
  });
  els.btnRelease.addEventListener("click", (e) => {
    e.stopPropagation();
    if (Fishing.st.pendingFish) recordSeen(Fishing.st.pendingFish);
    Fishing.releaseCatch();
  });

  els.journalBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openJournal();
  });
  els.journalClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeJournal();
  });
  els.journal.addEventListener("click", (e) => {
    if (e.target === els.journal) closeJournal();
  });

  els.helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.help.classList.add("open");
  });
  els.helpClose.addEventListener("click", (e) => {
    e.stopPropagation();
    els.help.classList.remove("open");
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      const st = Fishing.st;
      if (st.state === Fishing.S.IDLE) castTo(innerWidth * 0.45, innerHeight * 0.4);
      else if (st.state === Fishing.S.WAITING) Fishing.retract();
      else if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
      else if (st.state === Fishing.S.FIGHTING) Fishing.setReeling(true);
    }
    if (e.code === "Escape") {
      closeJournal();
      els.help.classList.remove("open");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") Fishing.setReeling(false);
  });

  /* ---------- boot / frame ---------- */
  function boot() {
    buildBaitBar();
    Fishing.setBait(save.bait || "worm", true);
    Fishing.st.zen = save.zen;
    paintZen(Fishing.st.zen);
    // 默认瞄准池心
    aim = Fishing.aimFromPointer(innerWidth * 0.45, innerHeight * 0.4);
    paintAim(true);
    paintPanels(Fishing.st);
  }

  function frame(now, dt) {
    const st = Fishing.st;
    if (window.Tackle) {
      if (st.state === Fishing.S.FIGHTING) {
        Tackle.setPhase("fight", st.tension);
        els.reelNeedle.setAttribute("transform", `rotate(${(-120 + st.tension * 240).toFixed(1)} 48 48)`);
        els.tensionWrap.classList.toggle("danger", st.tension > 0.78 || st.tension < 0.25);
      }
      Tackle.setDip(st.bobberDip || 0);
      if (!Tackle.visible && !Tackle.animating && !Tackle.reeling && st.state === Fishing.S.IDLE) {
        Tackle.setPhase("idle");
      }
      // 鱼跃出/遛鱼时，钓线跟着鱼走；黑漂时漂跟着鱼走
      const jk = window.Life ? Life.currentKoi() : null;
      if (jk && jk.job && (jk.job.kind === "leap" || jk.job.kind === "hooked" || jk.job.kind === "hookjump")) {
        Tackle.lineFollow(jk.x, jk.y);
      } else Tackle.clearLineFollow();
      if (st.state === Fishing.S.BITE) Tackle.dragFloatTo(st.lineX, st.lineY);
      else Tackle.clearDragFloat();
      Tackle.update(dt);
    }
    if (st.state === Fishing.S.IDLE && !aiming && performance.now() > fanHoldUntil) {
      if (!aim) aim = Fishing.aimFromPointer(innerWidth * 0.45, innerHeight * 0.4);
      paintAim();
      // 首钓引导：池心呼吸圈，首竿成即退役
      if (!save.hintDone) {
        els.castHint.style.left = aim.x.toFixed(1) + "px";
        els.castHint.style.top = aim.y.toFixed(1) + "px";
        els.castHint.classList.add("show");
      } else {
        els.castHint.classList.remove("show");
      }
    } else {
      els.castHint.classList.remove("show");
    }
  }

  window.App = { boot, frame };
  boot();
})();
