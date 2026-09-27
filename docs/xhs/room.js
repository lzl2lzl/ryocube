var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const periodFor = (date) => {
    const hour = date.getHours();
    return hour >= 23 || hour < 7 ? "late" : hour >= 19 ? "night" : "day";
  };
  class RoomMotion {
    constructor(data, onArrive) {
      this.data = data;
      this.onArrive = onArrive;
      this.options = { fox: false, paused: false, reduce: false, blocked: false, reaction: false, mode: "auto", weather: "auto", sleeping: false, pose: "idle", movement: "still", activity: "idle" };
      this.position = { x: 0, y: 0, z: 30, turn: 0, tilt: 0 };
      this.lastAttention = performance.now();
      this.forceOffset = { x: 0, y: 0, z: 0, tilt: 0 };
      this.interaction = { active: false, pose: "angry", at: 0 };
      this.lastFrame = 0;
      this.nextAction = performance.now() + 4500;
      this.pathIndex = -1;
      this.walking = false;
      this.frame = 1;
      this.period = "";
      this.litUntil = 0;
      this.lastMutter = 0;
      this.sunNextAt = 0;
      this.sunUntil = 0;
      this.glass = new RoomGlass(data, () => {
        if (this.restPose === "smash") {
          this.restPose = "idle";
          this.nextAction = performance.now() + this.pauseDuration();
        }
        this.restart();
      });
      this.tick = this.tick.bind(this);
      this.resize = new ResizeObserver(() => this.measure());
      this.resize.observe($("tank"));
      this.buildRain();
      this.measure();
      this.updateEnvironment();
      this.environmentTimer = setInterval(() => this.updateEnvironment(), 3e4);
      document.addEventListener("visibilitychange", () => {
        this.updateEnvironment();
        this.restart();
      });
    }
    static periodFor(date) {
      return periodFor(date);
    }
    setForceOffset(offset) {
      Object.assign(this.forceOffset, offset);
      if (this.width) this.renderPosition();
    }
    setInteraction(active, pose = "angry") {
      if (active === this.interaction.active) {
        const changed = this.interaction.pose !== pose;
        this.interaction.pose = pose;
        if (active && changed) this.render();
        return;
      }
      const now = performance.now();
      if (active) {
        this.interaction = { active: true, pose, at: now };
        this.glass.stop();
      } else {
        const elapsed = now - this.interaction.at;
        if (this.segment) this.segment.at += elapsed;
        if (this.settling) this.settling.at += elapsed;
        this.nextAction += elapsed;
        this.interaction.active = false;
      }
      this.restart();
    }
    measure() {
      const previousWidth = this.width, previousSize = this.size, previousDepth = this.depth;
      this.width = $("tank").clientWidth;
      this.height = $("tank").clientHeight;
      this.size = Math.min(590, Math.max(220, this.width * 1.18), Math.max(240, this.height * 0.9));
      this.depth = Math.min(210, Math.max(100, this.width * 0.46));
      $("tank").style.setProperty("--actor-size", "".concat(this.size, "px"));
      $("tank").style.setProperty("--depth", "".concat(this.depth, "px"));
      this.segment = null;
      this.walking = false;
      if (previousWidth) {
        this.position.x *= this.width / previousWidth;
        this.position.y *= this.size / previousSize;
        this.position.z *= this.depth / previousDepth;
      }
      if (this.options.sleeping) {
        const target = { x: this.width * 0.03, y: this.size * 0.12, z: -this.depth * 0.45, turn: 0, tilt: -66 };
        if (this.settling) this.settling.target = target;
        else this.position = target;
      }
      this.position.x = Math.max(-this.width * 0.5, Math.min(this.width * 0.5, this.position.x));
      this.position.y = Math.max(-this.height * 0.35, Math.min(this.size * 0.5, this.position.y));
      this.render();
    }
    setOptions(options) {
      const wasSleeping = this.options.sleeping, oldActivity = this.options.activity, oldTask = this.options.taskActivity;
      Object.assign(this.options, options);
      if (wasSleeping !== this.options.sleeping || oldActivity !== this.options.activity) {
        this.segment = null;
        this.walking = false;
        this.restPose = null;
        this.nextAction = performance.now() + this.pauseDuration();
      }
      if (wasSleeping !== this.options.sleeping || this.options.taskActivity && this.options.taskActivity !== oldTask || this.options.activity === "smash" && oldActivity !== "smash") {
        const target = this.options.sleeping ? { x: this.width * 0.03, y: this.size * 0.12, z: -this.depth * 0.45, turn: 0, tilt: -66 } : { x: 0, y: 0, z: this.options.activity === "smash" ? 85 : 30, turn: 0, tilt: 0 };
        this.settling = { start: __spreadValues({}, this.position), target, at: performance.now(), duration: 500 };
      }
      $("tank").dataset.sleeping = String(this.options.sleeping);
      $("tank").dataset.activity = this.options.activity;
      this.updateEnvironment();
      this.restart();
    }
    updateEnvironment() {
      const now = /* @__PURE__ */ new Date();
      const nextPeriod = this.options.mode === "auto" ? periodFor(now) : this.options.mode;
      const periodChanged = nextPeriod !== this.period;
      if (nextPeriod !== this.period) {
        this.period = nextPeriod;
      }
      document.documentElement.dataset.period = this.period;
      const localHour = now.getHours() + now.getMinutes() / 60;
      const daylight = this.options.mode === "auto" ? Math.max(0, Math.sin((localHour - 7) / 12 * Math.PI)) : 1;
      document.documentElement.style.setProperty("--day-top", "hsl(277 39% ".concat(76 + daylight * 10, "%)"));
      document.documentElement.style.setProperty("--day-bottom", "hsl(277 29% ".concat(58 + daylight * 10, "%)"));
      document.querySelector('meta[name="theme-color"]').content = this.period === "day" ? "#e7dfed" : "#211b2c";
      const slot = now.getFullYear() * 1e6 + (now.getMonth() + 1) * 1e4 + now.getDate() * 100 + now.getHours() * 2 + Math.floor(now.getMinutes() / 30);
      const weatherNumber = (Math.imul(slot, 2654435761) >>> 0) % 100;
      const weather = this.options.weather === "auto" ? weatherNumber < 28 ? "rain" : weatherNumber < 44 ? "fog" : "clear" : this.options.weather;
      $("tank").dataset.weather = weather;
      this.updateSunlight(weather);
      $("tank").classList.toggle("is-lit", Date.now() < this.litUntil);
      const activity = this.data.config.behavior.moodPool.activities.find((item) => item.key === this.options.activity) || this.data.config.behavior.schedule.find((item) => item.activity === this.options.activity);
      $("tank").setAttribute("aria-label", this.options.sleeping ? "窗内的角色正在睡觉，轻点窗户可短暂亮灯" : "紫色房间的窗户，角色正在".concat((activity == null ? void 0 : activity.label) || "寻找出口"));
      $("tank").classList.toggle("awake-at-night", this.period === "late" && !this.options.sleeping);
      this.render();
      if (periodChanged) this.restart();
    }
    updateSunlight(weather) {
      const tank = $("tank"), now = Date.now(), allowed = this.period === "day" && weather === "clear" && !document.hidden;
      if (!allowed) {
        clearTimeout(this.sunTimer);
        this.sunTimer = null;
        this.sunNextAt = 0;
        this.sunUntil = 0;
        tank.classList.remove("has-sunlight");
        return;
      }
      if (this.sunUntil && now >= this.sunUntil) {
        this.sunUntil = 0;
        tank.classList.remove("has-sunlight");
        this.sunNextAt = now + 12e4 + Math.random() * 24e4;
      }
      if (!this.sunUntil && !this.sunNextAt) this.sunNextAt = now + 45e3 + Math.random() * 135e3;
      if (!this.sunUntil && now >= this.sunNextAt) {
        this.sunUntil = now + 22e3 + Math.random() * 18e3;
        this.sunNextAt = 0;
        tank.classList.add("has-sunlight");
        clearTimeout(this.sunTimer);
        this.sunTimer = setTimeout(() => this.updateSunlight(tank.dataset.weather), this.sunUntil - now + 10);
      }
    }
    buildRain() {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 30; i++) {
        const drop = document.createElement("i");
        drop.className = "rain-drop";
        drop.style.cssText = "--x:".concat(i * 37.9 % 100, "%;--w:").concat(2 + i % 3, "px;--h:").concat(12 + i % 5 * 7, "px;--duration:").concat(5 + i % 7, "s;--delay:-").concat(i * 0.83, "s;--still-y:").concat(i * 23.7 % 100, "%");
        fragment.append(drop);
      }
      $("rain").append(fragment);
    }
    glance() {
      this.glass.stop();
      this.lastAttention = performance.now();
      this.segment = null;
      this.walking = false;
      this.litUntil = Date.now() + 12e3;
      $("tank").classList.add("is-lit");
      clearTimeout(this.lightTimer);
      this.lightTimer = setTimeout(() => this.updateEnvironment(), 12020);
      this.nextAction = performance.now() + 6e3;
      this.render();
      return this.options.sleeping;
    }
    restart() {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.moveTimer);
      this.raf = null;
      document.body.classList.toggle("motion-stopped", document.hidden || this.options.blocked);
      $("tank").dataset.walkingPaused = String(this.options.paused);
      if (!this.canTravel() && !this.interaction.active) {
        this.walking = false;
        this.segment = null;
      }
      if (this.settling && (document.hidden || this.options.reduce)) {
        this.position = __spreadValues({}, this.settling.target);
        this.settling = null;
      }
      this.render();
      if (document.hidden || this.options.blocked || this.interaction.active) return;
      if (this.settling || this.segment) {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
      if (this.canTravel() && this.options.movement !== "still") this.moveTimer = setTimeout(() => this.beginMove(), Math.max(0, this.nextAction - performance.now()));
    }
    canTravel() {
      return !document.hidden && !this.options.reduce && !this.options.paused && !this.options.blocked && !this.options.sleeping && !this.options.reaction && !this.interaction.active && !this.glass.busy && !(document.documentElement.dataset.input === "keyboard" && $("character").matches(":focus-visible"));
    }
    beginMove() {
      if (!this.canTravel()) return this.restart();
      const now = performance.now();
      if (now - this.lastAttention < 1500) {
        this.nextAction = this.lastAttention + 1500;
        return this.restart();
      }
      const destination = __spreadProps(__spreadValues({}, this.destination()), { tilt: 0 });
      const speed = this.options.movement === "roam" ? this.data.config.behavior.roam.speedPxPerSec : this.data.config.behavior.pace.speedPxPerSec;
      const distance = Math.hypot(destination.x - this.position.x, destination.y - this.position.y, destination.z - this.position.z);
      this.segment = { start: __spreadValues({}, this.position), target: destination, at: now, duration: Math.max(600, distance / speed * 1e3) };
      this.walking = true;
      this.restPose = null;
      $("tank").dataset.action = destination.name;
      this.render(now);
      this.raf = requestAnimationFrame(this.tick);
    }
    destination() {
      const w = this.width, h = this.height, s = this.size, d = this.depth;
      const places = [
        { x: -w * 0.24, y: 0, z: -d * 0.85, turn: -12, name: "back-left" },
        { x: w * 0.27, y: 0, z: -d * 0.7, turn: 12, name: "back-right" },
        { x: w * 0.48, y: 0, z: -30, turn: 20, name: "side-peek" },
        { x: w * 0.04, y: 0, z: 95, turn: 0, name: "front-glass" },
        { x: -w * 0.18, y: s * 0.33, z: 75, turn: 0, name: "head-peek" },
        { x: -w * 0.43, y: -h * 0.3, z: 45, turn: -18, name: "edge-search" },
        { x: w * 0.08, y: -h * 0.55, z: 105, turn: 0, name: "upper-search" },
        { x: 0, y: 0, z: 25, turn: 0, name: "center" }
      ];
      const choices = places.map((place2, index) => ({ place: place2, index })).filter((item) => item.index !== this.pathIndex);
      const selected = choices[Math.floor(Math.random() * choices.length)];
      this.pathIndex = selected.index;
      const place = selected.place;
      return place;
    }
    pauseDuration() {
      const rules = this.data.config.behavior;
      if (this.options.movement === "roam") return rules.roam.pauseMinMs + Math.random() * (rules.roam.pauseMaxMs - rules.roam.pauseMinMs);
      return (rules.pace.intervalMinSeconds + Math.random() * (rules.pace.intervalMaxSeconds - rules.pace.intervalMinSeconds)) * 1e3;
    }
    dodge() {
      if (this.options.reduce || this.options.paused || this.options.blocked || this.options.sleeping) return;
      const direction = this.position.x >= 0 ? -1 : 1;
      this.segment = { start: __spreadValues({}, this.position), target: { x: direction * this.width * 0.2, y: this.position.y, z: this.position.z, turn: direction * 8, tilt: 0 }, at: performance.now(), duration: this.data.config.behavior.nudge.durationMs, dodge: true };
      this.restart();
    }
    tick(now) {
      var _a;
      this.raf = null;
      if (document.hidden || this.options.blocked || this.interaction.active) return this.restart();
      const segment = this.settling || this.segment;
      if (segment) {
        const settling = !!this.settling, t = Math.min(1, (now - segment.at) / segment.duration), e = ease(t);
        for (const key of ["x", "y", "z", "turn", "tilt"]) this.position[key] = mix(segment.start[key] || 0, segment.target[key] || 0, e);
        this.walking = !settling;
        if (t >= 1) {
          const wasDodge = segment.dodge;
          this.settling = null;
          this.segment = null;
          this.walking = false;
          this.nextAction = now + this.pauseDuration();
          if (!settling && !wasDodge) {
            this.restPose = ((_a = this.onArrive) == null ? void 0 : _a.call(this)) || this.options.pose;
            if (this.restPose === "smash") this.settling = { start: __spreadValues({}, this.position), target: { x: 0, y: 0, z: 85, turn: 0, tilt: 0 }, at: now, duration: 500 };
          }
        }
      }
      this.render(now);
      if (this.settling || this.segment) this.raf = requestAnimationFrame(this.tick);
      else this.restart();
    }
    renderPosition(now = performance.now()) {
      const p = this.position, f = this.forceOffset, walking = this.walking && !this.interaction.active;
      const bob = walking && !this.options.reduce ? Math.sin(now / 115) * 2 : 0, lean = (p.tilt || 0) + f.tilt + (walking ? Math.sin(now / 220) * 1.4 : 0);
      const clamp = RoomPhysics.clamp, w = this.width, h = this.height, s = this.size;
      let x = p.x + f.x, y = p.y + f.y + bob, z = clamp(p.z + f.z, -this.depth * 0.9, 145);
      const a = lean * Math.PI / 180, b = p.turn * Math.PI / 180, origin = this.options.sleeping ? 0.58 : 1;
      const cy = s * (0.5 - origin), rx = -cy * Math.sin(a), ry = cy * Math.cos(a), rz = -rx * Math.sin(b);
      const scale = 425 / (425 - z - rz), baseY = h * 0.97 - s * (1 - origin);
      const px = w / 2 + (x + rx * Math.cos(b)) * scale, py = h * 0.43 + (baseY + y + ry - h * 0.43) * scale;
      const margin = Math.min(64, s * 0.16, w * 0.24, h * 0.24);
      x += (clamp(px, margin, w - margin) - px) / scale;
      y += (clamp(py, margin, h - margin) - py) / scale;
      $("actor").style.transform = "translateX(-50%) translate3d(".concat(x.toFixed(2), "px,").concat(y.toFixed(2), "px,").concat(z.toFixed(2), "px) rotateY(").concat(p.turn.toFixed(2), "deg) rotateZ(").concat(lean.toFixed(2), "deg)");
      $("actor-shadow").style.transform = "translateX(-50%) translate3d(".concat(x.toFixed(2), "px,0,").concat(z.toFixed(2), "px)");
      $("actor-shadow").style.opacity = String(Math.max(0.1, 1 - Math.abs(p.y + f.y) / this.height));
    }
    render(now = performance.now()) {
      if (!this.width) return;
      const p = this.position, sleep = this.options.sleeping;
      this.renderPosition(now);
      let state = sleep ? "sleep" : this.interaction.active ? this.interaction.pose : this.options.reaction ? this.options.reactionPose || "angry" : this.walking ? this.options.singStroll && this.options.activity === "sing" ? "sing" : "walk" : this.restPose || this.options.pose;
      const smash = !sleep && !this.interaction.active && !this.options.reaction && !this.walking && !this.settling && !this.options.paused && !this.options.blocked && !this.options.taskActivity && (this.options.activity === "smash" || this.restPose === "smash");
      this.glass.sync({ active: smash, fox: this.options.fox, reduce: this.options.reduce });
      if (state === "smash") state = "angry";
      if (state === "walk" && !this.walking) state = "idle";
      const definition = this.data.config.states[state] || this.data.config.states.idle;
      this.animateSprite(state, definition);
      $("actor").classList.toggle("breathing", !!definition.breathe && !this.walking && !this.options.reduce);
      $("actor").classList.toggle("singing-walk", this.walking && this.options.singStroll && this.options.activity === "sing");
      $("actor").dataset.depth = p.z.toFixed(1);
    }
    animateSprite(state, definition) {
      var _a;
      const frozen = document.hidden || this.options.blocked, form = this.options.fox ? "fox" : "human";
      const animationKey = "".concat(form, ":").concat(state, ":").concat(frozen);
      if (this.animationKey === animationKey) return;
      const samePose = ((_a = this.animationKey) == null ? void 0 : _a.split(":").slice(0, 2).join(":")) === "".concat(form, ":").concat(state);
      this.animationKey = animationKey;
      clearInterval(this.frameTimer);
      this.frameTimer = null;
      if (!samePose) this.frame = 1;
      const paint = () => {
        const pose = "".concat(state, "_").concat(this.frame), key = "".concat(form, "_").concat(pose);
        if (key !== this.spriteKey) {
          $("sprite").src = this.data.sprites[key] || this.data.sprites["".concat(form, "_idle_1")];
          this.spriteKey = key;
        }
        $("actor").dataset.pose = pose;
      };
      paint();
      if (!frozen && definition.frames > 1) this.frameTimer = setInterval(() => {
        this.frame = this.frame % definition.frames + 1;
        paint();
      }, 1e3 / (definition.fps || 1));
    }
  }
  window.RoomMotion = RoomMotion;
})();
