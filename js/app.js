/* UI 组装：输入路由、HUD、图鉴、渔获卡。导出 App */
(function () {
  "use strict";

  const SAVE_KEY = "fishpond_save_v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    hud: $("hud"),
    zenFill: $("zenFill"),
    zenVal: $("zenVal"),
    baitBar: $("baitBar"),
    hint: $("hint"),
    toast: $("toast"),
    card: $("catchCard"),
    cardArt: $("cardArt"),
    cardName: $("cardName"),
    cardMeta: $("cardMeta"),
    cardPoem: $("cardPoem"),
    cardRarity: $("cardRarity"),
    btnKeep: $("btnKeep"),
    btnRelease: $("btnRelease"),
    journalBtn: $("journalBtn"),
    journal: $("journal"),
    journalGrid: $("journalGrid"),
    journalClose: $("journalClose"),
    journalStats: $("journalStats"),
    tensionWrap: $("tensionWrap"),
    tensionFill: $("tensionFill"),
    tensionHint: $("tensionHint"),
    lineLayer: $("lineLayer"),
    bobber: $("bobber"),
    actionBtn: $("actionBtn"),
    helpBtn: $("helpBtn"),
    help: $("help"),
    helpClose: $("helpClose"),
  };

  const save = loadSave();

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
        };
      }
    } catch (e) { /* 坏档则重开 */ }
    return { zen: 50, bait: "worm", records: {}, totalCaught: 0, totalReleased: 0, bestWeight: 0 };
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) { /* 隐身模式忽略 */ }
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(text, ms = 2400) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
  }

  /* ---------- zen ---------- */
  function paintZen(v) {
    save.zen = v;
    els.zenFill.style.width = v + "%";
    els.zenVal.textContent = Math.round(v);
    persist();
  }

  /* ---------- bait bar ---------- */
  function buildBaitBar() {
    els.baitBar.innerHTML = "";
    for (const b of Fishing.getBaits()) {
      const btn = document.createElement("button");
      btn.className = "bait";
      btn.dataset.id = b.id;
      btn.title = b.desc;
      btn.innerHTML = `<span class="bait-icon">${b.icon}</span><span class="bait-name">${b.name}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Fishing.setBait(b.id);
      });
      els.baitBar.appendChild(btn);
    }
    paintBait(save.bait);
  }
  function paintBait(idOrObj) {
    const id = typeof idOrObj === "string" ? idOrObj : idOrObj.id;
    save.bait = id;
    persist();
    for (const el of els.baitBar.querySelectorAll(".bait")) {
      el.classList.toggle("on", el.dataset.id === id);
    }
  }

  /* ---------- journal ---------- */
  function buildJournal() {
    els.journalGrid.innerHTML = "";
    const list = Fishing.getSpecies();
    for (const sp of list) {
      const rec = save.records[sp.id];
      const rmeta = Fishing.getRarityMeta(sp.rarity);
      const cell = document.createElement("button");
      cell.className = "j-cell" + (rec ? " got" : "");
      cell.innerHTML = `
        <div class="j-dot" style="background:${rmeta.color}"></div>
        <div class="j-name">${rec ? sp.name : "？？？"}</div>
        <div class="j-sub">${rec ? rec.count + " 尾 · " + rec.best + " kg" : rmeta.label}</div>
      `;
      if (rec) {
        cell.addEventListener("click", () => toast(`${sp.name}｜${sp.poem}`, 3200));
      }
      els.journalGrid.appendChild(cell);
    }
    els.journalStats.textContent = `收藏 ${Object.keys(save.records).length}/${list.length} · 起获 ${save.totalCaught} · 放流 ${save.totalReleased}`;
  }

  function openJournal() {
    buildJournal();
    els.journal.classList.add("open");
  }
  function closeJournal() {
    els.journal.classList.remove("open");
  }

  /* ---------- catch card ---------- */
  function showCard(fish) {
    const sp = fish.sp;
    const rmeta = Fishing.getRarityMeta(sp.rarity);
    els.cardRarity.textContent = rmeta.label;
    els.cardRarity.style.color = rmeta.color;
    els.cardName.textContent = sp.name;
    els.cardMeta.textContent = `${fish.weight} kg · ${fish.size} cm · ${Fishing.st.bait.name}`;
    els.cardPoem.textContent = sp.poem;
    // 色块鱼影
    els.cardArt.style.setProperty("--c1", sp.colors[0]);
    els.cardArt.style.setProperty("--c2", sp.colors[1]);
    els.card.classList.add("show");
  }
  function hideCard() {
    els.card.classList.remove("show");
  }

  // 收获才记分；放流只点亮图鉴
  function recordKeep(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) {
      save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    }
    save.records[id].count += 1;
    save.records[id].best = Math.max(save.records[id].best, fish.weight);
    save.totalCaught += 1;
    save.bestWeight = Math.max(save.bestWeight, fish.weight);
    persist();
  }

  function recordSeen(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) {
      save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    }
    save.totalReleased += 1;
    persist();
  }

  /* ---------- line & bobber ---------- */
  let bobberVisible = false;
  function showBobber(x, y) {
    els.bobber.style.transform = `translate(${x}px, ${y}px)`;
    els.bobber.classList.add("show");
    bobberVisible = true;
  }
  function hideBobber() {
    els.bobber.classList.remove("show");
    bobberVisible = false;
  }

  function drawLine() {
    const st = Fishing.st;
    if (!bobberVisible && st.state !== Fishing.S.FIGHTING) {
      els.lineLayer.innerHTML = "";
      return;
    }
    const rx = st.rodX, ry = st.rodY;
    const bx = st.lineX, by = st.lineY + (st.bobberDip || 0) * 8;
    // 竿：右下短杆
    const gx = rx + 28, gy = ry + 40;
    const cx = (rx + bx) / 2;
    const cy = Math.min(ry, by) - 40 - Math.hypot(rx - bx, ry - by) * 0.08;
    els.lineLayer.innerHTML = `
      <svg width="100%" height="100%" style="position:absolute;inset:0">
        <path d="M${gx} ${gy} Q ${rx + 8} ${ry + 8} ${rx} ${ry}" stroke="#5a4634" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M${rx} ${ry} Q ${cx} ${cy} ${bx} ${by}" stroke="rgba(255,255,255,.75)" stroke-width="1.2" fill="none"/>
      </svg>`;
  }

  function paintBobber(st) {
    if (!bobberVisible) return;
    const dip = st.bobberDip || 0;
    els.bobber.style.transform = `translate(${st.lineX}px, ${st.lineY + dip * 10}px) scale(${1 - dip * 0.12})`;
  }

  /* ---------- tension bar ---------- */
  function paintTension(st) {
    const on = st.state === Fishing.S.FIGHTING;
    els.tensionWrap.classList.toggle("show", on);
    if (!on) return;
    els.tensionFill.style.width = (st.tension * 100).toFixed(1) + "%";
    const t = st.tension;
    let hint = "按住收线，松手歇一下";
    let cls = "mid";
    if (t > 0.8) { hint = "线太紧了，松一下"; cls = "high"; }
    else if (t < 0.2) { hint = "线松了，轻轻收一点"; cls = "low"; }
    else if (t > 0.35 && t < 0.75) { hint = "手感刚刚好"; cls = "good"; }
    els.tensionHint.textContent = hint;
    els.tensionHint.className = cls;
    els.tensionFill.style.background =
      cls === "good" ? "linear-gradient(90deg,#6f9e82,#9bc4a8)" :
      cls === "high" ? "linear-gradient(90deg,#e87a6a,#f0a090)" :
      cls === "low" ? "linear-gradient(90deg,#d4a853,#e8c888)" :
      "linear-gradient(90deg,#7a9bb8,#a8c4d8)";
  }

  /* ---------- action button ---------- */
  function paintAction(st) {
    const map = {
      [Fishing.S.IDLE]: { text: "点水面抛竿", cls: "ghost" },
      [Fishing.S.CASTING]: { text: "……", cls: "ghost" },
      [Fishing.S.WAITING]: { text: "静候 · 可收回", cls: "soft" },
      [Fishing.S.NIBBLE]: { text: "有试探 · 耐心", cls: "wait" },
      [Fishing.S.BITE]: { text: "咬钩！扬竿", cls: "urgent" },
      [Fishing.S.FIGHTING]: { text: "按住收线", cls: "urgent" },
      [Fishing.S.CAUGHT]: { text: "看看渔获", cls: "soft" },
    };
    const m = map[st.state] || map[Fishing.S.IDLE];
    els.actionBtn.textContent = m.text;
    els.actionBtn.className = "action " + m.cls;
    els.actionBtn.hidden = false;
  }

  /* ---------- hint ---------- */
  const HINTS = {
    idle: "轻触水面抛竿 · 试探时请耐心 · 咬钩再扬竿",
    waiting: "浮漂静了……也许有鱼靠近",
    nibble: "水下有试探，别急着提竿",
    bite: "就是现在！",
    fight: "按住收线，过紧就松一松",
    caught: "一尾入网 · 也可放流积静心",
  };
  function setHint(k) {
    els.hint.textContent = HINTS[k] || HINTS.idle;
    els.hint.classList.remove("pulse");
    void els.hint.offsetWidth;
    els.hint.classList.add("pulse");
  }

  /* ---------- fishing events ---------- */
  Fishing.onEvent = (type, data) => {
    switch (type) {
      case "bait":
        paintBait(data.bait);
        if (!data.silent) toast(`换上${data.bait.name}`);
        break;
      case "zen":
        paintZen(data.zen);
        break;
      case "cast":
        showBobber(data.x, data.y);
        setHint("waiting");
        paintAction(Fishing.st);
        toast("浮漂轻轻落下");
        break;
      case "waiting":
        setHint("waiting");
        paintAction(Fishing.st);
        break;
      case "nibble":
      case "nibbleTick":
        setHint("nibble");
        paintAction(Fishing.st);
        if (type === "nibble") toast("水下有动静……", 1400);
        break;
      case "bite":
        setHint("bite");
        paintAction(Fishing.st);
        toast("咬钩！", 1200);
        break;
      case "fight":
        setHint("fight");
        paintAction(Fishing.st);
        toast("稳住手感", 1400);
        break;
      case "blank":
        toast("空空如也");
        break;
      case "escaped":
        hideBobber();
        hideCard();
        setHint("idle");
        paintAction(Fishing.st);
        toast(data.text || "游走了", 2200);
        break;
      case "retract":
        hideBobber();
        setHint("idle");
        paintAction(Fishing.st);
        toast("收回鱼线");
        break;
      case "caught":
        showBobber(Fishing.st.lineX, Fishing.st.lineY);
        showCard(data.fish);
        setHint("caught");
        paintAction(Fishing.st);
        break;
      case "kept":
        hideBobber();
        hideCard();
        setHint("idle");
        paintAction(Fishing.st);
        toast("收入篓篓 · 已记入图鉴", 1600);
        break;
      case "released":
        hideBobber();
        hideCard();
        setHint("idle");
        paintAction(Fishing.st);
        toast("放归池中 · 静心 +5", 1800);
        break;
      default:
        break;
    }
    paintAction(Fishing.st);
  };

  /* ---------- input ---------- */
  function isUiTarget(e) {
    return e.target.closest(".ui, .panel, .card, .hud");
  }

  function onPointerDown(e) {
    if (isUiTarget(e)) return;
    const x = e.clientX, y = e.clientY;
    const st = Fishing.st;
    if (st.state === Fishing.S.BITE) {
      Fishing.hook();
      return;
    }
    if (st.state === Fishing.S.NIBBLE) {
      Fishing.hook(); // 提前扬竿会惊走，由状态机处理
      return;
    }
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true);
      return;
    }
    if (st.state === Fishing.S.WAITING) {
      // 点击 = 收回重抛
      Fishing.retract();
      return;
    }
    if (st.state === Fishing.S.IDLE) {
      // 点花运附近提示
      const luck = Life.flowerLuck(x, y);
      Fishing.cast(x, y);
      if (luck > 0.3) toast("荷花近旁，花运正盛", 1800);
      if (window.Water) Water.addDrop(x, y, 10, 0.15);
    }
    // CAUGHT: 卡片处理，不抛竿
  }

  function onPointerUp() {
    Fishing.setReeling(false);
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  // 移动时轻微涟漪（不干扰钓鱼）
  let lastMove = null;
  window.addEventListener("pointermove", (e) => {
    if (isUiTarget(e)) return;
    if (lastMove) {
      const speed = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y);
      if (speed > 18 && Fishing.st.state === Fishing.S.IDLE) {
        Water.addDrop(e.clientX, e.clientY, 7 + speed * 0.05, Math.min(0.12, 0.02 + speed * 0.001));
      }
    }
    lastMove = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  // 拖拽收线：按住张力区
  els.tensionWrap.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });

  els.actionBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const st = Fishing.st;
    if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
    else if (st.state === Fishing.S.FIGHTING) Fishing.setReeling(true);
    else if (st.state === Fishing.S.WAITING) Fishing.retract();
    else if (st.state === Fishing.S.IDLE) toast("轻触水面任意处抛竿");
  });
  els.actionBtn.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    Fishing.setReeling(false);
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

  // 键盘：空格扬竿/收线
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      const st = Fishing.st;
      if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
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

  /* ---------- boot ---------- */
  function boot() {
    buildBaitBar();
    Fishing.setBait(save.bait || "worm", true);
    Fishing.st.zen = save.zen;
    paintZen(Fishing.st.zen);
    setHint("idle");
    paintAction(Fishing.st);
    // 初始提示稍后淡出
    setTimeout(() => {
      els.hint.style.opacity = "0.55";
    }, 5000);
  }

  function frame(now, dt) {
    const st = Fishing.st;
    drawLine();
    paintBobber(st);
    paintTension(st);
  }

  window.App = { boot, frame, toast };
  boot();
})();
