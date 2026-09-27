(function(parentModule) {
  const module2 = { exports: {} };
  function entranceFor(lastRunAt, now, reunionDays) {
    if (!lastRunAt) return "first";
    const gapDays = (now - lastRunAt) / 864e5;
    return gapDays >= reunionDays ? "reunion" : "daily";
  }
  function entranceFlavorFor(now) {
    const h = new Date(now).getHours();
    if (h >= 5 && h < 10) return "morning";
    if (h >= 23 || h < 5) return "latenight";
    return null;
  }
  function parseHM(s) {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  }
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
  function tierFor(value, tiers) {
    if (value >= tiers.rage) return "rage";
    if (value >= tiers.hot) return "hot";
    if (value >= tiers.irritable) return "irritable";
    return "calm";
  }
  function classifyUser({ idleSeconds, lastBreakAt, now }, behavior) {
    if (idleSeconds >= behavior.awayAfterMinutes * 60) return "away";
    const activeFor = (now - lastBreakAt) / 6e4;
    return activeFor >= behavior.workingAfterMinutes ? "working" : "casual";
  }
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
      this.onUpdate = onUpdate || (() => {
      });
      this.now = now || (() => Date.now());
      this.timer = null;
      const t = this.now();
      this.entrance = entranceFor(persisted.lastRunAt, t, this.behavior.reunionDays);
      this.entranceFlavor = entranceFlavorFor(t);
      this.firstRunAt = persisted.firstRunAt || t;
      let anger = persisted.anger || 0;
      if (persisted.angerAt) {
        const offlineMin = (t - persisted.angerAt) / 6e4;
        anger = Math.max(0, anger - offlineMin * this.behavior.anger.decayPerMinute);
      }
      this.anger = anger;
      this.angerUpdatedAt = t;
      this.lastBreakAt = t;
      this.lastInteractionAt = t;
      this.idleSeconds = 0;
      this.neglectedNow = false;
      this.clickTimes = [];
    }
    // ----- 采样循环 -----
    start() {
      this.stop();
      this.timer = setInterval(() => this.sample(), this.behavior.sampleSeconds * 1e3);
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
      if (this.idleSeconds >= this.behavior.activityBreakSeconds) {
        this.lastBreakAt = t;
      }
      this.decayAnger(t);
      this.onUpdate(this.snapshot(t));
    }
    // 愤怒漂移:平时随时间消气;被放置期间反而缓涨(设计:"你明明在,却不理我")
    decayAnger(t) {
      const min = (t - this.angerUpdatedAt) / 6e4;
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
      this.neglectedNow = false;
      const a = this.behavior.anger;
      if (type === "click") {
        const windowMs = this.behavior.clickComboWindowSeconds * 1e3;
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
      const windowMs = this.behavior.clickComboWindowSeconds * 1e3;
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
      this.forceAway = !!on;
      this.onUpdate(this.snapshot(this.now()));
    }
    snapshot(t) {
      t = t || this.now();
      this.decayAnger(t);
      const b = this.behavior;
      const userState = this.forceAway ? "away" : classifyUser({ idleSeconds: this.idleSeconds, lastBreakAt: this.lastBreakAt, now: t }, b);
      const sinceInteractionMin = (t - this.lastInteractionAt) / 6e4;
      const neglected = userState === "working" && sinceInteractionMin >= b.neglectAfterMinutes;
      this.neglectedNow = neglected;
      return {
        entrance: this.entrance,
        entranceFlavor: this.entranceFlavor,
        userState,
        idleSeconds: Math.round(this.idleSeconds),
        sinceInteractionMin: Math.round(sinceInteractionMin * 10) / 10,
        neglected,
        anger: {
          value: Math.round(this.anger * 10) / 10,
          tier: tierFor(this.anger, b.anger.tiers)
        },
        comboCount: this.clickTimes.length,
        activity: activityFor(b.schedule, t),
        at: t
      };
    }
    /** 退出/心跳时要写盘的字段 */
    persistPatch() {
      const t = this.now();
      return {
        firstRunAt: this.firstRunAt,
        lastRunAt: t,
        anger: this.anger,
        angerAt: t
      };
    }
  }
  module2.exports = {
    Mind,
    entranceFor,
    entranceFlavorFor,
    activityFor,
    tierFor,
    classifyUser
  };
  if (typeof window !== "undefined") window.RoomMind = module2.exports;
  if (parentModule) parentModule.exports = module2.exports;
})(typeof module === "object" && module.exports ? module : null);
