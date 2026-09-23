/* 钓鱼状态机：抛竿 / 试探 / 咬钩 / 遛鱼 / 渔获。导出 Fishing */
(function () {
  "use strict";

  const BAITS = [
    { id: "worm", name: "红虫", icon: "🪱", desc: "寻常小物也爱", tier: "common" },
    { id: "corn", name: "玉米", icon: "🌽", desc: "肥鱼偏好", tier: "mid" },
    { id: "petal", name: "花瓣饵", icon: "🌸", desc: "花运在侧更灵", tier: "rare" },
  ];

  const SPECIES = [
    { id: "crucian", name: "鲫鱼", rarity: "common", weight: [0.2, 1.2], baits: ["worm", "corn"], poem: "浅滩碎金，一闪即逝。", colors: ["#c9d6c2", "#8fad8a"] },
    { id: "loach", name: "泥鳅", rarity: "common", weight: [0.1, 0.5], baits: ["worm"], poem: "泥里修行，滑不留手。", colors: ["#8b7355", "#5c4a32"] },
    { id: "bream", name: "鳊鱼", rarity: "common", weight: [0.4, 2.0], baits: ["corn", "worm"], poem: "薄如银叶，贴水而行。", colors: ["#d8e2ea", "#9aafc0"] },
    { id: "carp", name: "鲤鱼", rarity: "mid", weight: [1.0, 5.5], baits: ["corn", "petal"], poem: "一摆尾，半池春水皱。", colors: ["#e8a86a", "#c47a3a"] },
    { id: "goldfish", name: "琉金", rarity: "mid", weight: [0.2, 0.9], baits: ["petal", "worm"], poem: "袖珍灯笼，照不见岸。", colors: ["#ff9a52", "#ff7028"] },
    { id: "koi", name: "锦鲤", rarity: "rare", weight: [1.5, 8.0], baits: ["petal", "corn"], poem: "花影落处，有缘者得。", colors: ["#fff2ea", "#ef5a3a"] },
    { id: "puffer", name: "河豚", rarity: "rare", weight: [0.3, 1.5], baits: ["worm", "petal"], poem: "圆滚滚一肚子气，也圆滚滚一肚子甜。", colors: ["#e8d9a8", "#c4a86a"] },
    { id: "moon", name: "月光鳗", rarity: "epic", weight: [0.8, 3.0], baits: ["petal"], poem: "只在心最静时，才肯露一线银光。", colors: ["#d4e8f5", "#7a9bb8"] },
    { id: "lotus", name: "荷心精灵", rarity: "legend", weight: [0.1, 0.3], baits: ["petal"], poem: "不是鱼，是荷叶尖上的一滴露。", colors: ["#ffd6e8", "#fff3c9"] },
  ];

  const RARITY = {
    common: { label: "寻常", weight: 58, color: "#6f9e82" },
    mid: { label: "雅致", weight: 26, color: "#d4a853" },
    rare: { label: "珍奇", weight: 12, color: "#e87a6a" },
    epic: { label: "月华", weight: 3.2, color: "#7a9bb8" },
    legend: { label: "传说", weight: 0.8, color: "#c08bb8" },
  };

  const S = {
    IDLE: "IDLE",
    CASTING: "CASTING",
    WAITING: "WAITING",
    NIBBLE: "NIBBLE",
    BITE: "BITE",
    FIGHTING: "FIGHTING",
    CAUGHT: "CAUGHT",
  };

  // 游玩状态
  const st = {
    state: S.IDLE,
    bait: BAITS[0],
    zen: 50,          // 0-100，越高稀有越有缘
    lineX: 0, lineY: 0,   // 浮漂位置
    rodX: 0, rodY: 0,     // 竿尖
    nibbleLeft: 0,
    nibbleTimer: 0,
    biteTimer: 0,
    waitTimer: 0,
    pendingFish: null,
    tension: 0.35,        // 0-1
    fightProgress: 0,     // 0-1 收服进度
    fightPhase: 0,
    bobberDip: 0,
    lastCastAt: 0,
    onEvent: null,        // UI 回调
  };

  function emit(type, data) {
    if (st.onEvent) st.onEvent(type, data || {});
  }

  function setBait(id, silent) {
    if (st.state !== S.IDLE && st.state !== S.CAUGHT) return false;
    const b = BAITS.find((x) => x.id === id);
    if (!b) return false;
    st.bait = b;
    emit("bait", { bait: b, silent: !!silent });
    return true;
  }

  function zenAdd(v) {
    st.zen = Math.max(0, Math.min(100, st.zen + v));
    emit("zen", { zen: st.zen });
  }

  function rollSpecies() {
    const luck = (window.Life && Life.flowerLuck) ? Life.flowerLuck(st.lineX, st.lineY) : 0;
    const zenBonus = (st.zen - 50) / 50; // -1..1
    // 过滤可用饵的鱼
    const avail = SPECIES.filter((sp) => sp.baits.includes(st.bait.id));
    // 稀有权重：花瓣饵 + 花运 + 静心抬升高稀有
    const rareBoost = (st.bait.id === "petal" ? 1.5 : 1) * (1 + luck * 1.2) * (1 + Math.max(0, zenBonus) * 0.8);
    const commonPen = 1 / rareBoost;
    const weights = avail.map((sp) => {
      const r = RARITY[sp.rarity];
      let w = r.weight;
      if (sp.rarity === "common" || sp.rarity === "mid") w *= commonPen;
      else w *= rareBoost;
      return w;
    });
    let sum = weights.reduce((a, b) => a + b, 0) || 1;
    let t = Math.random() * sum;
    for (let i = 0; i < avail.length; i++) {
      t -= weights[i];
      if (t <= 0) return avail[i];
    }
    return avail[avail.length - 1] || SPECIES[0];
  }

  function rollFish() {
    const sp = rollSpecies();
    const [w0, w1] = sp.weight;
    const weight = +(w0 + Math.random() * (w1 - w0)).toFixed(2);
    const size = Math.round(12 + (weight / Math.max(w1, 0.1)) * 28 + Math.random() * 6);
    return { sp, weight, size };
  }

  function waitDuration() {
    // 静心高则更快上鱼；附近有鱼也加速
    let base = 6 + Math.random() * 10;
    base *= 1 - (st.zen - 50) * 0.004;
    if (window.Life) {
      const d = Life.nearestKoiDist(st.lineX, st.lineY);
      if (d < 200) base *= 0.7;
    }
    return Math.max(2.5, base);
  }

  function cast(x, y) {
    if (st.state !== S.IDLE && st.state !== S.CAUGHT) return false;
    const now = performance.now();
    if (now - st.lastCastAt < 400) return false;
    st.lastCastAt = now;
    st.lineX = x;
    st.lineY = y;
    // 竿尖：右下或左下，以靠近落点为准
    st.rodX = innerWidth > 720 ? innerWidth - 36 : innerWidth * 0.88;
    st.rodY = innerHeight > 640 ? innerHeight - 28 : innerHeight * 0.92;
    st.state = S.CASTING;
    st.bobberDip = 0;
    st.tension = 0.35;
    st.fightProgress = 0;
    st.pendingFish = null;
    zenAdd(-1);
    if (window.Water) Water.addDrop(x, y, 28, 0.9);
    if (window.Life) Life.startleKoi(x, y);
    emit("cast", { x, y });
    setTimeout(() => {
      if (st.state !== S.CASTING) return;
      st.state = S.WAITING;
      st.waitTimer = waitDuration();
      if (window.Life) Life.attractKoi(st.lineX, st.lineY, 0.35);
      emit("waiting", {});
    }, 420);
    return true;
  }

  function retract() {
    if (st.state === S.CAUGHT || st.state === S.IDLE) return;
    if (st.state === S.FIGHTING) {
      // 主动收线失败也温柔
      st.state = S.IDLE;
      emit("escaped", { text: "线松了，它缓缓游开。" });
      return;
    }
    st.state = S.IDLE;
    emit("retract", {});
  }

  // 试探中提前扬竿 → 惊走
  function hook() {
    if (st.state === S.NIBBLE) {
      st.state = S.IDLE;
      zenAdd(-6);
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 18, 0.5);
      emit("escaped", { text: "扬竿早了，水花一散。" });
      return;
    }
    if (st.state === S.BITE) {
      st.state = S.FIGHTING;
      st.tension = 0.45;
      st.fightProgress = 0;
      st.fightPhase = 0;
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 22, 0.8);
      emit("fight", { fish: st.pendingFish });
      return;
    }
    if (st.state === S.WAITING) {
      // 空竿，轻轻点一下水
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 14, 0.25);
      emit("blank", {});
    }
  }

  function setReeling(on) {
    st.reeling = !!on;
  }

  function updateFight(dt) {
    if (!st.pendingFish) return;
    const f = st.pendingFish;
    // 鱼的拉力：呼吸正弦 + 冲刺脉冲
    st.fightPhase += dt * (1.2 + f.weight * 0.15);
    const surge = Math.max(0, Math.sin(st.fightPhase * 2.2)) ** 2;
    const pull = 0.12 + surge * 0.35 + f.weight * 0.02;
    if (st.reeling) {
      st.tension += dt * (0.28 + f.weight * 0.03);
      st.fightProgress += dt * 0.22 * (st.tension > 0.25 && st.tension < 0.78 ? 1.25 : 0.35);
    } else {
      st.tension -= dt * 0.32;
      st.fightProgress += dt * 0.08;
    }
    st.tension -= dt * pull * 0.35;
    st.tension = Math.max(0, Math.min(1, st.tension));

    // 张力过高/过低太久会脱钩（阈值很宽，休闲向）
    if (st.tension > 0.92 || st.tension < 0.08) {
      st.slackBad = (st.slackBad || 0) + dt;
      if (st.slackBad > 1.4) {
        st.state = S.IDLE;
        st.slackBad = 0;
        zenAdd(-4);
        emit("escaped", { text: "手感不对，它借力走了。" });
        return;
      }
    } else {
      st.slackBad = 0;
    }

    if (st.tension > 0.35 && st.tension < 0.8) {
      if (window.Water && Math.random() < dt * 3) Water.addDrop(st.lineX, st.lineY, 10, 0.08);
    }

    if (st.fightProgress >= 1) {
      st.fightProgress = 1;
      st.state = S.CAUGHT;
      zenAdd(8 + (f.sp.rarity === "legend" ? 15 : f.sp.rarity === "epic" ? 10 : 4));
      if (window.Water) {
        Water.addDrop(st.lineX, st.lineY, 36, 1.4);
        Water.addDrop(st.lineX + 20, st.lineY - 10, 18, 0.6);
      }
      emit("caught", { fish: f });
    }
  }

  function releaseCatch() {
    if (st.state !== S.CAUGHT) return;
    st.state = S.IDLE;
    zenAdd(5);
    emit("released", { fish: st.pendingFish });
  }

  function keepCatch() {
    if (st.state !== S.CAUGHT) return;
    st.state = S.IDLE;
    emit("kept", { fish: st.pendingFish });
  }

  function update(now, dt) {
    switch (st.state) {
      case S.WAITING: {
        st.waitTimer -= dt;
        if (window.Life && Math.random() < dt * 0.4) Life.attractKoi(st.lineX, st.lineY, 0.08);
        if (st.waitTimer <= 0) {
          st.state = S.NIBBLE;
          st.nibbleLeft = 1 + ((Math.random() * 3) | 0);
          st.nibbleTimer = 0.35 + Math.random() * 0.5;
          emit("nibble", { left: st.nibbleLeft });
        }
        break;
      }
      case S.NIBBLE: {
        st.nibbleTimer -= dt;
        if (st.nibbleTimer <= 0) {
          // 一次试探点水
          st.bobberDip = 1;
          if (window.Water) Water.addDrop(st.lineX, st.lineY, 12, 0.35 + Math.random() * 0.2);
          st.nibbleLeft -= 1;
          if (st.nibbleLeft <= 0) {
            st.state = S.BITE;
            st.biteTimer = 1.6;
            st.bobberDip = 1.5;
            st.pendingFish = rollFish();
            if (window.Water) Water.addDrop(st.lineX, st.lineY, 16, 0.7);
            if (window.Life) Life.attractKoi(st.lineX, st.lineY, 0.8);
            emit("bite", { fish: st.pendingFish });
          } else {
            st.nibbleTimer = 0.55 + Math.random() * 0.7;
            emit("nibbleTick", { left: st.nibbleLeft });
          }
        }
        st.bobberDip = Math.max(0, st.bobberDip - dt * 3);
        break;
      }
      case S.BITE: {
        st.biteTimer -= dt;
        st.bobberDip = Math.max(0.4, st.bobberDip - dt * 0.3);
        if (st.biteTimer <= 0) {
          st.state = S.IDLE;
          zenAdd(-3);
          emit("escaped", { text: "没提竿……它吐钩走了。" });
        }
        break;
      }
      case S.FIGHTING: {
        updateFight(dt);
        break;
      }
      case S.CAUGHT: {
        st.bobberDip = 0;
        break;
      }
      default:
        break;
    }
  }

  function getRarityMeta(r) { return RARITY[r] || RARITY.common; }
  function getSpecies() { return SPECIES; }
  function getBaits() { return BAITS; }

  window.Fishing = {
    S,
    st,
    setBait,
    cast,
    retract,
    hook,
    setReeling,
    releaseCatch,
    keepCatch,
    update,
    getRarityMeta,
    getSpecies,
    getBaits,
    set onEvent(fn) { st.onEvent = fn; },
    get state() { return st.state; },
  };
})();
