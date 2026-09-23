(function(parentModule){const module={exports:{}};
// 心理引擎(P2):月云了的"感知 + 内心状态"。
// 不 require electron —— 所有外部依赖(闲置秒数、时间、持久化)都注入进来,
// 因此核心逻辑可以用纯 Node 单测。反应/表现(P3)不在这里,这里只负责"他知道什么、他什么心情"。

// ---------- 纯函数(可单测) ----------

/** 出场分支:first(初次见面)/ reunion(久别重逢)/ daily(日常) */
function entranceFor(lastRunAt, now, reunionDays) {
  if (!lastRunAt) return 'first';
  const gapDays = (now - lastRunAt) / 86400000;
  return gapDays >= reunionDays ? 'reunion' : 'daily';
}

/** 出场的时间修饰:morning(早晨)/ latenight(深夜)/ null */
function entranceFlavorFor(now) {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 23 || h < 5) return 'latenight';
  return null;
}

/** "HH:MM" → 当天分钟数 */
function parseHM(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** 日程查表:now 落在哪个时段(支持跨午夜时段,如 23:00-07:00) */
function activityFor(schedule, now) {
  const d = new Date(now);
  const cur = d.getHours() * 60 + d.getMinutes();
  for (const slot of schedule) {
    const from = parseHM(slot.from);
    const to = parseHM(slot.to);
    const hit = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
    if (hit) return { activity: slot.activity, label: slot.label };
  }
  return null;
}

/** 愤怒档位:平常(calm) < 烦躁(irritable) < 红温(hot) < 暴走(rage) */
function tierFor(value, tiers) {
  if (value >= tiers.rage) return 'rage';
  if (value >= tiers.hot) return 'hot';
  if (value >= tiers.irritable) return 'irritable';
  return 'calm';
}

/**
 * 机主状态分类:
 * away    — 闲置超过阈值,人不在
 * working — 从上次"长停顿"到现在,持续活跃超过 workingAfterMinutes(在专心做事)
 * casual  — 刚坐下/零散操作
 */
function classifyUser({ idleSeconds, lastBreakAt, now }, behavior) {
  if (idleSeconds >= behavior.awayAfterMinutes * 60) return 'away';
  const activeFor = (now - lastBreakAt) / 60000;
  return activeFor >= behavior.workingAfterMinutes ? 'working' : 'casual';
}

// ---------- 心理引擎 ----------

class Mind {
  /**
   * @param {object} opts
   *  config      — 全量 config.json(用 behavior 段)
   *  persisted   — 持久化快照(lastRunAt/firstRunAt/anger/angerAt)
   *  getIdleSeconds — 返回系统闲置秒数的函数(生产环境接 powerMonitor)
   *  onUpdate    — 每次采样后的回调(snapshot) => void
   *  now         — 可注入的时钟,默认 Date.now(单测用)
   */
  constructor({ config, persisted, getIdleSeconds, onUpdate, now }) {
    this.behavior = config.behavior;
    this.getIdleSeconds = getIdleSeconds;
    this.onUpdate = onUpdate || (() => {});
    this.now = now || (() => Date.now());
    this.timer = null;

    const t = this.now();

    // 出场分支在启动瞬间定格
    this.entrance = entranceFor(persisted.lastRunAt, t, this.behavior.reunionDays);
    this.entranceFlavor = entranceFlavorFor(t);
    this.firstRunAt = persisted.firstRunAt || t;

    // 愤怒值:恢复上次的值并按离线时间衰减
    let anger = persisted.anger || 0;
    if (persisted.angerAt) {
      const offlineMin = (t - persisted.angerAt) / 60000;
      anger = Math.max(0, anger - offlineMin * this.behavior.anger.decayPerMinute);
    }
    this.anger = anger;
    this.angerUpdatedAt = t;

    // 活跃度记账
    this.lastBreakAt = t; // 上次"长停顿"结束点(刚启动视为刚坐下)
    this.lastInteractionAt = t; // 上次摸他
    this.idleSeconds = 0;
    this.neglectedNow = false; // 供愤怒漂移用:被放置期间愤怒不衰减反而缓涨

    // 连点记账(P3 的阶梯用,P2 先把数记对)
    this.clickTimes = [];
  }

  // ----- 采样循环 -----

  start() {
    this.stop();
    this.timer = setInterval(() => this.sample(), this.behavior.sampleSeconds * 1000);
    this.sample();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  sample() {
    const t = this.now();
    this.idleSeconds = this.getIdleSeconds();

    // 长停顿(超过 activityBreakSeconds 没动)重置"持续工作"起点:
    // 停顿期间不断把起点推到现在,恢复活跃后 working 从零重新累计
    if (this.idleSeconds >= this.behavior.activityBreakSeconds) {
      this.lastBreakAt = t;
    }

    this.decayAnger(t);
    this.onUpdate(this.snapshot(t));
  }

  // 愤怒漂移:平时随时间消气;被放置期间反而缓涨(设计:"你明明在,却不理我")
  decayAnger(t) {
    const min = (t - this.angerUpdatedAt) / 60000;
    if (min <= 0) return;
    const a = this.behavior.anger;
    if (this.neglectedNow) {
      this.anger = Math.min(a.max || 120, this.anger + min * (a.neglectPerMinute || 0));
    } else {
      this.anger = Math.max(0, this.anger - min * a.decayPerMinute);
    }
    this.angerUpdatedAt = t;
  }

  // ----- 交互入口(渲染进程上报) -----

  /** type: 'click' | 'drag' | 'topHover' | 'poke'(好奇轻点:记互动/解除放置,但不涨怒气不计连点) */
  touch(type) {
    const t = this.now();
    this.decayAnger(t);
    this.lastInteractionAt = t;
    this.neglectedNow = false; // 摸他=不再被放置,愤怒恢复正常衰减方向

    const a = this.behavior.anger;
    if (type === 'click') {
      // 连点窗口记账
      const windowMs = this.behavior.clickComboWindowSeconds * 1000;
      this.clickTimes = this.clickTimes.filter((x) => t - x < windowMs);
      this.clickTimes.push(t);
      const n = this.clickTimes.length;
      this.anger += n >= a.comboThreshold ? a.combo : a.click;
    } else if (a[type]) {
      this.anger += a[type];
    }
    this.onUpdate(this.snapshot(t));
    return this.snapshot(t);
  }

  /** 连点窗口内的点击次数(P3 阶梯用) */
  comboCount() {
    const t = this.now();
    const windowMs = this.behavior.clickComboWindowSeconds * 1000;
    this.clickTimes = this.clickTimes.filter((x) => t - x < windowMs);
    return this.clickTimes.length;
  }

  // ----- 调试入口 -----

  debugSetAnger(v) {
    this.anger = Math.max(0, v);
    this.angerUpdatedAt = this.now();
    this.onUpdate(this.snapshot(this.now()));
  }

  debugSetLastInteraction(msAgo) {
    this.lastInteractionAt = this.now() - msAgo;
    this.onUpdate(this.snapshot(this.now()));
  }

  // ----- 快照 -----

  debugForceAway(on) {
    this.forceAway = !!on; // 调试:强制"人不在",用于测试探索漫游
    this.onUpdate(this.snapshot(this.now()));
  }

  snapshot(t) {
    t = t || this.now();
    this.decayAnger(t); // 懒衰减:任何读取前先把时间账结清
    const b = this.behavior;
    const userState = this.forceAway
      ? 'away'
      : classifyUser({ idleSeconds: this.idleSeconds, lastBreakAt: this.lastBreakAt, now: t }, b);
    const sinceInteractionMin = (t - this.lastInteractionAt) / 60000;
    const neglected = userState === 'working' && sinceInteractionMin >= b.neglectAfterMinutes;
    this.neglectedNow = neglected; // 下一段时间的愤怒漂移方向由当前放置状态决定
    return {
      entrance: this.entrance,
      entranceFlavor: this.entranceFlavor,
      userState,
      idleSeconds: Math.round(this.idleSeconds),
      sinceInteractionMin: Math.round(sinceInteractionMin * 10) / 10,
      neglected,
      anger: {
        value: Math.round(this.anger * 10) / 10,
        tier: tierFor(this.anger, b.anger.tiers),
      },
      comboCount: this.clickTimes.length,
      activity: activityFor(b.schedule, t),
      at: t,
    };
  }

  /** 退出/心跳时要写盘的字段 */
  persistPatch() {
    const t = this.now();
    return {
      firstRunAt: this.firstRunAt,
      lastRunAt: t,
      anger: this.anger,
      angerAt: t,
    };
  }
}

module.exports = {
  Mind,
  entranceFor,
  entranceFlavorFor,
  activityFor,
  tierFor,
  classifyUser,
};

if (typeof window !== 'undefined') window.RoomMind=module.exports;
if (parentModule) parentModule.exports=module.exports;
})(typeof module === 'object' && module.exports ? module : null);
