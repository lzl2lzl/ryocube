var __defProp = Object.defineProperty;
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
(() => {
  "use strict";
  const { clamp, rotate, deadZone, ShakeGate, MotionFilter, SwipeGesture } = RoomPhysics, $ = (id) => document.getElementById(id);
  class RoomInteraction {
    constructor(room, { onDisturb, onGestureMove, onTap, onStroke, onGestureStart, canTap, canInteract }) {
      this.room = room;
      this.onDisturb = onDisturb;
      this.onGestureMove = onGestureMove;
      this.onTap = onTap;
      this.onStroke = onStroke;
      this.onGestureStart = onGestureStart;
      this.canTap = canTap;
      this.canInteract = canInteract;
      this.gate = new ShakeGate();
      this.filter = new MotionFilter();
      this.gesture = new SwipeGesture();
      this.pointers = /* @__PURE__ */ new Set();
      this.enabled = false;
      this.blocked = false;
      this.angle = 0;
      this.offset = { x: 0, y: 0, tilt: 0, z: 0 };
      this.velocity = { x: 0, y: 0, tilt: 0, z: 0 };
      this.tilt = { x: 0, y: 0 };
      this.linear = { x: 0, y: 0, z: 0 };
      this.quake = false;
      this.level = 0;
      this.busy = false;
      this.dragging = false;
      this.returnAt = 0;
      this.suppressUntil = 0;
      this.sensorUntil = 0;
      this.frame = this.frame.bind(this);
      this.headPoints=Array.from({length:12},()=>{const point=document.createElement('span');point.className='head-hit-point';point.setAttribute('aria-hidden','true');$('character').appendChild(point);return point;});
      this.bindGestures();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.reset();
      });
    }
    setContext({ enabled, blocked, angle, reduce }) {
      if (!enabled && this.enabled || blocked && !this.blocked || this.angle !== angle) this.reset();
      this.enabled = enabled;
      this.blocked = blocked;
      this.angle = angle;
      this.reduce = reduce;
    }
    idleTarget() {
      const x = this.enabled ? this.tilt.x * Math.min(110, this.room.width * 0.28) : 0, y = this.enabled ? this.tilt.y * Math.min(100, this.room.height * 0.18) : 0;
      return { x, y, z: 0, tilt: clamp(x / 7, -8, 8) };
    }
    offsetChanged() {
      const target = this.idleTarget();
      return Object.keys(target).some((k) => Math.abs(target[k] - this.offset[k]) > 0.2 || Math.abs(this.velocity[k]) > 0.2);
    }
    begin(pose) {
      this.busy = true;
      this.room.setInteraction(true, pose);
    }
    drag(vector) {
      if (this.blocked || !this.canInteract()) return;
      if (!this.dragging) {
        this.dragging = true;
        this.dragOrigin = __spreadValues({}, this.offset);
        this.quake = false;
        this.gate.reset();
        this.begin("angry");
      }
      const v = rotate(vector.x, vector.y, -this.angle), p = this.room.position, w = this.room.width, h = this.room.height;
      this.dragTarget = { x: clamp(this.dragOrigin.x + v.x, -w * 0.43 - p.x, w * 0.43 - p.x), y: clamp(this.dragOrigin.y + v.y, -h * 0.62 - p.y, this.room.size * 0.17 - p.y), z: this.dragOrigin.z, tilt: clamp(v.x / w * 22 - v.y / h * 8, -22, 22) };
      this.returnAt = 0;
      this.wake();
    }
    swipe(vector) {
      var _a, _b;
      if (this.blocked || !this.canInteract()) return;
      if (!this.dragging) this.drag(vector);
      const v = rotate((_a = vector.vx) != null ? _a : vector.x * 4, (_b = vector.vy) != null ? _b : vector.y * 4, -this.angle), w = this.room.width, h = this.room.height;
      this.velocity.x = clamp(v.x * 0.75, -w * 2.3, w * 2.3);
      this.velocity.y = clamp(v.y * 0.75, -h * 1.5, h * 1.5);
      this.velocity.tilt = clamp(v.x / w * 18, -70, 70);
      this.dragging = false;
      this.returnAt = performance.now();
      this.sensorUntil = this.returnAt + 650;
      this.releaseTarget = __spreadValues({}, this.offset);
      this.begin("angry");
      this.onDisturb("swipe");
      this.wake();
    }
    cancelDrag() {
      if (this.dragging) {
        this.dragging = false;
        this.returnAt = performance.now();
        this.sensorUntil = this.returnAt + 650;
        this.releaseTarget = __spreadValues({}, this.offset);
        this.wake();
      }
    }
    wake() {
      if (!this.raf) {
        this.lastFrame = performance.now();
        this.raf = requestAnimationFrame(this.frame);
      }
    }
    frame(now) {
      this.raf = null;
      if (document.hidden || this.blocked) return this.reset();
      const dt = Math.min(0.04, Math.max(1e-3, (now - this.lastFrame) / 1e3));
      this.lastFrame = now;
      if (this.quake && now - this.lastMotion > 500) {
        this.quake = false;
        this.gate.reset();
        this.returnAt = now;
      }
      const p = this.room.position, w = this.room.width, h = this.room.height, idle = this.idleTarget();
      let target = __spreadValues({}, idle), spring = 42, damping = 13, force = { x: 0, y: 0, z: 0, tilt: 0 };
      const fresh = this.enabled && now >= this.sensorUntil && this.lastMotion !== void 0 ? Math.exp(-Math.max(0, now - this.lastMotion - 80) / 100) : 0;
      const ax = deadZone(this.linear.x, 0.18) * fresh, ay = deadZone(this.linear.y, 0.18) * fresh, az = deadZone(this.linear.z, 0.18) * fresh;
      if (this.dragging) {
        target = __spreadValues({}, this.dragTarget);
        spring = 190;
        damping = 24;
      } else if (this.quake) {
        spring = 24 - this.level * 12;
        damping = 7 - this.level * 2;
        target.y -= h * (0.045 + this.level * 0.19);
        target.tilt = clamp(-this.offset.x / w * 35 - this.velocity.x / w * 10, -60, 60);
        force = { x: -ax * w * (0.55 + this.level * 1.1), y: -ay * h * (0.3 + this.level * 0.6), z: -az * (90 + this.level * 100), tilt: 0 };
      } else {
        force = { x: -ax * w * 0.6, y: -ay * h * 0.35, z: -az * 240, tilt: -ax * 16 };
        if (this.returnAt && this.releaseTarget) {
          const hold = Math.max(0, 1 - (now - this.returnAt) / 450);
          for (const key of ["x", "y", "z", "tilt"]) target[key] += (this.releaseTarget[key] - idle[key]) * hold;
        }
      }
      if (this.reduce) {
        for (const key of ["x", "y", "tilt"]) {
          target[key] *= 0.35;
          force[key] *= 0.35;
        }
        target.z = 0;
        force.z = 0;
      }
      for (const key of ["x", "y", "tilt", "z"]) {
        this.velocity[key] += ((target[key] - this.offset[key]) * spring + force[key]) * dt;
        this.velocity[key] *= Math.exp(-damping * dt);
        this.offset[key] += this.velocity[key] * dt;
      }
      const bounds = this.busy ? [["x", -w * 0.44 - p.x, w * 0.44 - p.x], ["y", -h * 0.65 - p.y, this.room.size * 0.2 - p.y], ["z", -this.room.depth * 0.7 - p.z, 145 - p.z], ["tilt", -85, 85]] : [["x", -Math.min(110, w * 0.28), Math.min(110, w * 0.28)], ["y", -Math.min(100, h * 0.18), Math.min(100, h * 0.18)], ["z", -70, 70], ["tilt", -14, 14]];
      for (const [key, min, max] of bounds) {
        const value = clamp(this.offset[key], min, max);
        if (value !== this.offset[key]) {
          this.offset[key] = value;
          this.velocity[key] *= -0.28;
        }
      }
      this.room.setForceOffset(this.offset);
      $("tank").classList.toggle("is-quaking", this.quake);
      $("tank").style.setProperty("--rattle", "".concat((0.5 + this.level * 1.5).toFixed(2), "px"));
      const distance = Math.max(...Object.keys(idle).map((k) => Math.abs(this.offset[k] - idle[k]))), speed = Math.max(...Object.values(this.velocity).map(Math.abs));
      if (this.busy && !this.dragging && !this.quake && this.returnAt && (now - this.returnAt > 500 && distance < 2 && speed < 8 || now - this.returnAt > 3e3)) {
        this.busy = false;
        this.returnAt = 0;
        this.releaseTarget = null;
        this.room.setInteraction(false);
      }
      $("tank").dataset.motion = this.dragging ? "drag" : this.quake ? this.level > 0.55 ? "flight" : "shake" : this.busy ? "settling" : Math.hypot(ax, ay, az) > 0 ? "inertia" : Math.hypot(target.x, target.y) > 1 ? "tilt" : "idle";
      if (this.offsetChanged() || this.busy || this.quake || Math.hypot(ax, ay, az) > 0.1) this.raf = requestAnimationFrame(this.frame);
    }
    reset() {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      this.gate.reset();
      this.filter.reset();
      this.quake = false;
      this.level = 0;
      this.busy = false;
      this.dragging = false;
      this.returnAt = 0;
      this.releaseTarget = null;
      this.lastMotion = void 0;
      this.tilt = { x: 0, y: 0 };
      this.linear = { x: 0, y: 0, z: 0 };
      this.sensorUntil = 0;
      for (const key of ["x", "y", "tilt", "z"]) this.offset[key] = this.velocity[key] = 0;
      this.room.setForceOffset(this.offset);
      this.room.setInteraction(false);
      $("tank").classList.remove("is-quaking");
      $("tank").dataset.motion = "idle";
      this.stroke=null;this.movementStarted=false;
      this.gesture.cancel();
      const captured=Array.from(this.pointers);this.pointers.clear();
      for(const id of captured){try{if($('tank').hasPointerCapture(id))$('tank').releasePointerCapture(id);}catch(e){}}
      this.suppressUntil=performance.now()+800;
    }
    consumesClick(event) {
      if (event.detail === 0) return false;
      const suppressed = performance.now() < this.suppressUntil;
      this.suppressUntil = 0;
      return suppressed;
    }
    headContains(x,y) {
      const fox=this.room.options.fox;
      if(this.headForm!==fox){
        this.headForm=fox;
        this.headPoints.forEach((p,i)=>{const a=i*Math.PI/6;p.style.left=(50+Math.cos(a)*(fox?33:29))+'%';p.style.top=((fox?40:37)+Math.sin(a)*(fox?32:29))+'%';});
      }
      const vertices=this.headPoints.map(p=>{const r=p.getBoundingClientRect();return{x:r.left,y:r.top};});
      let inside=false;
      for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
        const a=vertices[i],b=vertices[j];
        if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      return inside;
    }
    startMovement(kind){if(!this.movementStarted){this.movementStarted=true;this.onGestureStart(kind);}}
    bindGestures() {
      const tank=$('tank');
      tank.addEventListener('pointerdown',event=>{
        if(event.target.closest('.bubble.is-scrollable')||!['touch','pen'].includes(event.pointerType)||!this.canTap())return;
        if(!this.pointers.size)this.suppressUntil=0;
        this.pointers.add(event.pointerId);
        if(this.pointers.size>1){this.stroke=null;this.gesture.cancel();this.cancelDrag();this.movementStarted=false;this.onGestureStart('cancel');this.suppressUntil=performance.now()+800;return;}
        this.movementStarted=false;
        this.stroke=event.target.closest('#character')&&this.canInteract()&&this.headContains(event.clientX,event.clientY)?new CubeGestures.PetStroke(event.clientX,event.clientY):null;
        if(this.stroke)this.stroke.id=event.pointerId;
        this.gesture.start(event.clientX,event.clientY,event.pointerId,performance.now());
      },{capture:true});
      tank.addEventListener('pointermove',event=>{
        if(this.stroke&&this.stroke.id===event.pointerId){
          const result=this.stroke.move(event.clientX,event.clientY,this.headContains(event.clientX,event.clientY));
          if(result.moved){this.onGestureMove();this.startMovement('pet');if(!tank.hasPointerCapture(event.pointerId))tank.setPointerCapture(event.pointerId);this.suppressUntil=performance.now()+800;}
          if(result.counted&&this.canInteract())this.onStroke();
          return;
        }
        if(this.gesture.move(event.clientX,event.clientY,event.pointerId,performance.now())){
          this.onGestureMove();this.startMovement('drag');
          if(!tank.hasPointerCapture(event.pointerId))tank.setPointerCapture(event.pointerId);
          if(this.dragging||Math.hypot(this.gesture.dx,this.gesture.dy)>=20)this.drag(this.gesture.vector(performance.now()));
        }
      });
      tank.addEventListener('pointerup',event=>{
        this.pointers.delete(event.pointerId);
        const stroke=this.stroke;
        if(stroke&&stroke.id===event.pointerId){
          this.stroke=null;this.gesture.cancel();this.suppressUntil=performance.now()+800;this.onGestureMove();
          if(!stroke.moved&&this.canTap())this.onTap();return;
        }
        const result=this.gesture.end(event.clientX,event.clientY,event.pointerId,performance.now());
        if(!result)return;
        if(result.moved){this.suppressUntil=performance.now()+800;this.onGestureMove();}
        if(result.swipe&&!this.blocked&&this.canInteract())this.swipe(result.swipe);
        else if(this.dragging)this.cancelDrag();
        else if(!result.moved&&this.canTap()){this.suppressUntil=performance.now()+800;this.onTap();}
      });
      const cancel=event=>{
        if(!this.pointers.has(event.pointerId))return;
        this.pointers.delete(event.pointerId);this.stroke=null;this.gesture.cancel();this.cancelDrag();this.onGestureMove();this.movementStarted=false;this.onGestureStart('cancel');this.suppressUntil=performance.now()+800;
      };
      tank.addEventListener('pointercancel',cancel);
      tank.addEventListener('lostpointercapture',event=>{if(event.target===tank)cancel(event);});
    }
  }
  window.RoomInteraction = RoomInteraction;
})();
