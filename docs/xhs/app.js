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
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id), storageKey = "yue-window-room-v2";
  let saved = {}, canSave = true;
  try {
    saved = JSON.parse(await CubeStorage.get(storageKey) || "{}") || {};
  } catch (e) {
    canSave = false;
  }
  const state = __spreadProps(__spreadValues({
    fox: saved.fox === true
  }, RoomPhysics.preferences(saved)), {
    theme: ["auto", "day", "night", "late"].includes(saved.theme) ? saved.theme : "auto",
    weather: ["auto", "clear", "rain", "fog"].includes(saved.weather) ? saved.weather : "auto",
    rotation: Number.isInteger(saved.rotation) ? (saved.rotation % 4 + 4) % 4 : 0,
    fontSize: typeof saved.fontSize === "number" && Number.isFinite(saved.fontSize) ? Math.max(12, Math.min(24, Math.round(saved.fontSize))) : 16,
    reaction: false,
    reactionPose: "angry"
  });
  let bubbleTimeout, reactionTimeout, longPressTimeout, resumeTimer, previousFocus, alarmFocus, currentSheet = null, longPressed = false, pausedUntil = 0, knocks = [], focusLocked = false, clock, interaction;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)"), data = window.YUE_DATA;
  const behavior = new RoomBehavior({ config: data.config, dialogue: data.dialogue, persisted: saved.mind || {}, idleMinutes: 1 });
  const room = new RoomMotion(data, () => {
    const pose = behavior.arrived();
    flushSpeech();
    return pose;
  });
  interaction = new RoomInteraction(room, {
    canTap: () => !focusLocked && !currentSheet && $("companion-menu").hidden && $("alarm-overlay").hidden,
    canInteract: () => {
      var _a;
      return !focusLocked && !currentSheet && $("companion-menu").hidden && $("alarm-overlay").hidden && !((_a = behavior.view) == null ? void 0 : _a.sleeping);
    },
    onStroke: soothe,
    onTap: () => {
      if (!longPressed) knock();
      longPressed = false;
    },
    onGestureMove: () => {
      clearTimeout(longPressTimeout);
    },
    onDisturb: (kind) => {
      if (behavior.disturb(kind)) {
        updateActivity();
        persist();
      }
    }
  });
  clock = new RoomClockUI({ onRing: (text) => {
    room.glance();
    if ($("alarm-overlay").hidden) alarmFocus = document.activeElement;
    $("alarm-heading").textContent = text;
    $("companion").inert = true;
    $("alarm-overlay").hidden = false;
    document.body.classList.add("alarm-open");
    updateActivity();
    $("alarm-overlay").focus();
  }, onStart: () => closeSheet(), onChange: () => {
    if (clock) updateActivity();
  }, onDismiss: () => {
    $("alarm-overlay").hidden = true;
    $("companion").inert = false;
    document.body.classList.remove("alarm-open");
    updateActivity();
    if ((alarmFocus == null ? void 0 : alarmFocus.isConnected) && alarmFocus.getClientRects().length && !alarmFocus.disabled && !alarmFocus.closest("[inert],[hidden]")) alarmFocus.focus();
    else if (currentSheet) $("sheet").focus();
    else $("open-timer").focus();
  } });
  function persist() {
    try {
      const { fox, autoDismiss, theme, weather, rotation, fontSize } = state;
      CubeStorage.set(storageKey, JSON.stringify({ fox, autoDismiss, theme, weather, rotation, fontSize, mind: behavior.persist() })).then((ok) => {
        canSave = ok;
        $("storage-note").hidden = ok;
      });
    } catch (e) {
      canSave = false;
    }
    $("storage-note").hidden = canSave;
  }
  function updateActivity() {
    const loop = clock == null ? void 0 : clock.model.loopView(), task = loop && !loop.paused ? loop.phase === "focus" ? "screen" : "sing" : null, locked = task === "screen";
    if (locked && !focusLocked) {
      clearTimeout(reactionTimeout);
      clearTimeout(longPressTimeout);
      clearTimeout(resumeTimer);
      clearTimeout(bubbleTimeout);
      state.reaction = false;
      longPressed = false;
      pausedUntil = 0;
      knocks = [];
      $("bubble").textContent = "";
      behavior.drain();
      $("companion-menu").hidden = true;
      $("menu-backdrop").hidden = true;
      $("menu-toggle").setAttribute("aria-expanded", "false");
      if (currentSheet === "preferences") {
        currentSheet = null;
        $("sheet-overlay").hidden = true;
        $("app-content").inert = false;
        document.body.classList.remove("sheet-open");
      }
      if ($("alarm-overlay").hidden && !currentSheet) $("open-timer").focus();
    }
    focusLocked = locked;
    $("companion").classList.toggle("focus-active", locked);
    $("tank").inert = locked;
    $("rotate-view").disabled = locked;
    $("menu-toggle").disabled = locked;
    $("open-settings").disabled = locked;
    const blocked = !!currentSheet || !$("companion-menu").hidden || !$("alarm-overlay").hidden, paused = Date.now() < pausedUntil;
    const late = (state.theme === "auto" ? RoomMotion.periodFor(/* @__PURE__ */ new Date()) : state.theme) === "late";
    const view = behavior.sync({ late, autoSleep: true, blocked, paused, mutter: !locked, activityOverride: task });
    interaction == null ? void 0 : interaction.setContext({ enabled: state.gravity, blocked: blocked || locked || view.sleeping, angle: state.rotation * 90, reduce: prefersReduced.matches });
    room.setOptions({
      fox: state.fox || view.autoFox,
      paused,
      reduce: prefersReduced.matches,
      blocked,
      reaction: state.reaction,
      reactionPose: state.reactionPose,
      mode: state.theme,
      weather: state.weather,
      sleeping: view.sleeping,
      pose: view.pose,
      movement: view.movement,
      activity: view.key,
      singStroll: view.singStroll,
      taskActivity: task
    });

    flushSpeech();
  }
  function rotateLayout() {
    const app = $("app-content"), css = getComputedStyle(app), left = parseFloat(css.paddingLeft), right = parseFloat(css.paddingRight), top = parseFloat(css.paddingTop), bottom = parseFloat(css.paddingBottom);
    const width = app.clientWidth - left - right, height = app.clientHeight - top - bottom, odd = state.rotation % 2;
    const viewport = $("room-viewport");
    viewport.style.width = "".concat(odd ? height : width, "px");
    viewport.style.height = "".concat(odd ? width : height, "px");
    viewport.style.left = "".concat(left + width / 2, "px");
    viewport.style.top = "".concat(top + height / 2, "px");
    viewport.style.setProperty("--room-angle", "".concat(state.rotation * 90, "deg"));
    viewport.dataset.rotation = String(state.rotation * 90);
    const panels = $("panels-viewport"), panelWidth = odd ? app.clientHeight : app.clientWidth, panelHeight = odd ? app.clientWidth : app.clientHeight;
    panels.style.width = "".concat(panelWidth, "px");
    panels.style.height = "".concat(panelHeight, "px");
    panels.style.setProperty("--room-angle", "".concat(state.rotation * 90, "deg"));
    panels.style.setProperty("--panel-width", "".concat(panelWidth, "px"));
    panels.style.setProperty("--panel-height", "".concat(panelHeight, "px"));
    panels.classList.toggle("is-short", panelHeight <= 400);
    panels.dataset.rotation = String(state.rotation * 90);
    const card = $("alarm-card");
    card.style.width = "".concat(panelWidth, "px");
    card.style.height = "".concat(panelHeight, "px");
    card.style.setProperty("--room-angle", "".concat(state.rotation * 90, "deg"));
    card.classList.toggle("is-landscape", panelWidth > panelHeight);
    room.measure();
  }
  function renderSettings() {
    $("appearance").value = state.theme;
    $("weather").value = state.weather;
    $("auto-dismiss").checked = state.autoDismiss;
    $("character").setAttribute("aria-label", "".concat(state.fox ? "狐狸形态的角色" : "框里的角色", "，点按敲窗，摸头哄睡"));
    renderFontSize();
    rotateLayout();
    updateActivity();
    persist();
  }
  function renderFontSize() {
    document.documentElement.style.setProperty("--dialogue-font-size", "".concat(state.fontSize, "px"));
    $("font-size").value = String(state.fontSize);
    $("font-size-value").textContent = String(state.fontSize);
    $("font-size").style.setProperty("--range-fill", "".concat((state.fontSize - 12) / 12 * 100, "%"));
    $("font-size").setAttribute("aria-valuetext", "".concat(state.fontSize, "号"));
  }
  function updateBubbleOverflow() {
    const bubble = $("bubble"), scrollable = bubble.scrollHeight > bubble.clientHeight + 1;
    bubble.classList.toggle("is-scrollable", scrollable);
    bubble.tabIndex = scrollable ? 0 : -1;
  }
  function scheduleBubbleDismiss() {
    clearTimeout(bubbleTimeout);
    if (state.autoDismiss) bubbleTimeout = setTimeout(() => {
      $("bubble").textContent = "";
    }, Math.min(14e3, Math.max(5e3, $("bubble").textContent.length * 250)));
  }
  function showText(text) {
    if (focusLocked) return;
    $("bubble").textContent = text;
    $("bubble").scrollTop = 0;
    updateBubbleOverflow();
    scheduleBubbleDismiss();
  }
  function flushSpeech() {
    for (const event of behavior.drain()) if (event.type === "speech") showText(event.text);
  }
  function reactWith(pose) {
    clearTimeout(reactionTimeout);
    state.reaction = true;
    state.reactionPose = pose;
    updateActivity();
    reactionTimeout = setTimeout(() => {
      state.reaction = false;
      updateActivity();
    }, data.config.reactionMs);
  }
  function closeMenu(restore = false) {
    $("companion-menu").hidden = true;
    $("menu-backdrop").hidden = true;
    $("menu-toggle").setAttribute("aria-expanded", "false");
    updateActivity();
    if (restore) $("menu-toggle").focus({ preventScroll: true });
  }
  function openMenu() {
    if (currentSheet || focusLocked) return;
    $("companion-menu").hidden = false;
    $("menu-backdrop").hidden = false;
    $("menu-toggle").setAttribute("aria-expanded", "true");
    updateActivity();
    $("switch-form").focus({ preventScroll: true });
  }
  function openSheet(kind) {
    if (focusLocked && kind !== "timer") return;
    closeMenu();
    previousFocus = document.activeElement;
    currentSheet = kind;
    $("clock-content").hidden = kind !== "timer";
    $("preferences-content").hidden = kind !== "preferences";
    $("sheet-title").textContent = kind === "timer" ? "闹钟与计时器" : "房间设置";
    $("sheet-overlay").hidden = false;
    $("app-content").inert = true;
    document.body.classList.add("sheet-open");
    updateActivity();
    clock.render();
    $("sheet").focus();
  }
  function closeSheet() {
    if (currentSheet === "timer") clock.silence();
    $("sheet-overlay").hidden = true;
    $("app-content").inert = false;
    document.body.classList.remove("sheet-open");
    currentSheet = null;
    updateActivity();
    if (previousFocus && !previousFocus.disabled && !previousFocus.closest("[hidden],[inert]")) previousFocus.focus();
    else $("open-timer").focus();
  }
  let formTaps=[];
  function knock() {
    if (focusLocked) return;
    const tapTime=Date.now();
    if(formTaps.length && tapTime-formTaps[formTaps.length-1]>450)formTaps=[];
    formTaps=formTaps.filter(at=>tapTime-at<=3000);formTaps.push(tapTime);
    if(formTaps.length>=9){
      const wasFox=state.fox||!!behavior.view.autoFox;
      formTaps=[];strokes=0;knocks=[];recordInput();state.fox=!wasFox;
      clearTimeout(reactionTimeout);state.reaction=false;interaction.reset();renderSettings();
      showText(state.fox?'……这样总行了吧。':'好了，变回来了。');return;
    }
    recordInput();
    const now = Date.now();
    knocks = knocks.filter((at) => now - at < 3e3);
    knocks.push(now);
    if (knocks.length >= 3) {
      pausedUntil = now + 6e4;
      knocks = [];
    } else if (pausedUntil > now) pausedUntil = now + 6e4;
    clearTimeout(resumeTimer);
    if (pausedUntil > now) resumeTimer = setTimeout(() => {
      pausedUntil = 0;
      updateActivity();
    }, pausedUntil - now);
    room.glance();
    const result = behavior.poke();
    updateActivity();
    if (result.action === "light") {
      clearTimeout(bubbleTimeout);
      $("bubble").textContent = "";
    }
    if (result.action === "dodge") room.dodge();
    if (result.pose) reactWith(result.pose);
    persist();
  }
  let strokes=0,lastStroke=0;
  function soothe(){
    formTaps=[];
    if(focusLocked||behavior.view.sleeping)return;
    const now=Date.now();if(now-lastStroke>20000)strokes=0;lastStroke=now;strokes++;
    recordInput();clearTimeout(longPressTimeout);clearTimeout(reactionTimeout);
    if(strokes>=9){
      strokes=0;state.reaction=false;behavior.toggleSleep();behavior.drain();updateActivity();showText("……只睡一小会儿。");persist();return;
    }
    const lines={1:"……你在摸哪里？",3:"唔……有点困了。",5:"你让我睡觉我就睡觉吗？",7:"……再摸一下也不是不行。",8:"我才……没有……困……"};
    reactWith(strokes===5||strokes===6?'angry':'idle');
    clearTimeout(reactionTimeout);reactionTimeout=setTimeout(()=>{state.reaction=false;updateActivity();},4500);
    const sprite=$("sprite");sprite.classList.remove('soothed');void sprite.offsetWidth;sprite.classList.add('soothed');
    if(lines[strokes])showText(lines[strokes]);
  }
  function recordInput() {
    if (focusLocked) return;
    behavior.input();
    if (pausedUntil > Date.now()) {
      pausedUntil = Date.now() + 6e4;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        pausedUntil = 0;
        updateActivity();
      }, 6e4);
    }
  }
  $("tank").addEventListener("click", (event) => {
    if (!interaction.consumesClick(event) && !longPressed) knock();
    longPressed = false;
  });
  $("tank").addEventListener("keydown", (event) => {
    if (event.target === $("tank") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      knock();
    }
  });
  $("menu-toggle").addEventListener("click", () => {
    if(focusLocked)return;
    $("guide-view").hidden=false;$("companion").inert=true;
  });
  $("menu-backdrop").addEventListener("click", () => closeMenu(true));
  $("rotate-view").addEventListener("click", () => {
    if (focusLocked) return;
    state.rotation = (state.rotation + 1) % 4;
    interaction.reset();
    rotateLayout();
    updateActivity();
    persist();
  });
  new ResizeObserver(rotateLayout).observe($("app-content"));
  $("guide-back").addEventListener("click", () => {
    $("guide-view").hidden = true;
    $("companion").inert = false;
  });
  $("open-settings").addEventListener("click", () => openSheet("preferences"));
  $("open-timer").addEventListener("click", () => openSheet("timer"));
  $("close-sheet").addEventListener("click", closeSheet);
  document.querySelector(".sheet-backdrop").addEventListener("click", closeSheet);
  $("appearance").addEventListener("change", () => {
    state.theme = $("appearance").value;
    renderSettings();
  });
  $("weather").addEventListener("change", () => {
    state.weather = $("weather").value;
    renderSettings();
  });
  $("auto-dismiss").addEventListener("change", () => {
    state.autoDismiss = $("auto-dismiss").checked;
    scheduleBubbleDismiss();
    persist();
  });
  $("font-size").addEventListener("input", () => {
    state.fontSize = Number($("font-size").value);
    renderFontSize();
    updateBubbleOverflow();
    persist();
  });
  let fontDrag = null;
  function dragFontSize(event) {
    const input = $("font-size"), bounds = input.getBoundingClientRect();
    const point = RoomPhysics.rotate(event.clientX - bounds.x - bounds.width / 2, event.clientY - bounds.y - bounds.height / 2, -state.rotation * 90);
    const ratio = (point.x + input.clientWidth / 2 - 13) / Math.max(1, input.clientWidth - 26);
    const value = Math.round(12 + Math.max(0, Math.min(1, ratio)) * 12);
    if (Number(input.value) !== value) {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    event.preventDefault();
  }
  $("font-size").addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || fontDrag !== null) return;
    fontDrag = event.pointerId;
    $("font-size").focus({ preventScroll: true });
    $("font-size").setPointerCapture(event.pointerId);
    dragFontSize(event);
  });
  $("font-size").addEventListener("pointermove", (event) => {
    if (fontDrag === event.pointerId) dragFontSize(event);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => $("font-size").addEventListener(name, (event) => {
    if (fontDrag === event.pointerId) fontDrag = null;
  }));
  new ResizeObserver(updateBubbleOverflow).observe($("bubble"));
  ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "keydown"].forEach((name) => $("bubble").addEventListener(name, (event) => {
    if ($("bubble").classList.contains("is-scrollable")) event.stopPropagation();
  }));
  let bubbleDrag = null;
  $("bubble").addEventListener("pointerdown", (event) => {
    if (!$("bubble").classList.contains("is-scrollable") || event.button !== 0 || bubbleDrag) return;
    bubbleDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, top: $("bubble").scrollTop };
    $("bubble").setPointerCapture(event.pointerId);
    clearTimeout(bubbleTimeout);
  });
  $("bubble").addEventListener("pointermove", (event) => {
    if ((bubbleDrag == null ? void 0 : bubbleDrag.id) !== event.pointerId) return;
    const delta = RoomPhysics.rotate(event.clientX - bubbleDrag.x, event.clientY - bubbleDrag.y, -state.rotation * 90);
    $("bubble").scrollTop = bubbleDrag.top - delta.y;
    event.preventDefault();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => $("bubble").addEventListener(name, (event) => {
    if ((bubbleDrag == null ? void 0 : bubbleDrag.id) === event.pointerId) {
      bubbleDrag = null;
      scheduleBubbleDismiss();
    }
  }));
  if (prefersReduced.addEventListener) prefersReduced.addEventListener("change", updateActivity);
  else prefersReduced.addListener(updateActivity);
  document.addEventListener("visibilitychange", () => {
    updateActivity();
    persist();
  });
  window.addEventListener("pagehide", persist);
  let lastPointerInput = 0;
  document.addEventListener("pointermove", () => {
    if (Date.now() - lastPointerInput > 1e3) {
      recordInput();
      lastPointerInput = Date.now();
    }
  }, { passive: true });
  document.documentElement.dataset.input = "pointer";
  document.addEventListener("pointerdown", () => {
    document.documentElement.dataset.input = "pointer";
    recordInput();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab") document.documentElement.dataset.input = "keyboard";
    recordInput();
    if (!$("alarm-overlay").hidden) return;
    if (event.key === "Escape") {
      if (currentSheet) closeSheet();
      else closeMenu(true);
    }
    if (event.key === "Tab" && currentSheet) {
      const items = [...$("sheet").querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter((el) => el.getClientRects().length && !el.disabled && el.tabIndex !== -1), first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $("sheet"))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  Object.values(data.sprites).forEach((src) => {
    const image = new Image();
    image.src = src;
  });
  renderSettings();
  if (!$("bubble").textContent) {
    behavior.entrance();
    flushSpeech();
  }
  setInterval(() => {
    if (!document.hidden) updateActivity();
  }, data.config.behavior.sampleSeconds * 1e3);
  setInterval(persist, 6e4);
})();
