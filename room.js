(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const periodFor = date => { const hour = date.getHours(); return hour >= 23 || hour < 7 ? 'late' : hour >= 19 ? 'night' : 'day'; };
  class RoomMotion {
    constructor(data, onArrive) {
      this.data = data; this.onArrive = onArrive;
      this.options = {fox:false,paused:false,reduce:false,blocked:false,reaction:false,mode:'auto',weather:'auto',sleeping:false,pose:'idle',movement:'still',activity:'idle'};
      this.position = {x:0,y:0,z:30,turn:0,tilt:0}; this.lastAttention = performance.now();
      this.forceOffset={x:0,y:0,z:0,tilt:0};this.interaction={active:false,pose:'angry',at:0};
      this.lastFrame = 0; this.nextAction = performance.now() + 4500;
      this.pathIndex = -1; this.walking = false; this.frame = 1;
      this.period = ''; this.litUntil = 0; this.lastMutter = 0;
      this.sunNextAt=0;this.sunUntil=0;
      this.glass=new RoomGlass(data,()=>{if(this.restPose==='smash'){this.restPose='idle';this.nextAction=performance.now()+this.pauseDuration();}this.restart();});
      this.tick = this.tick.bind(this);
      this.resize = new ResizeObserver(() => this.measure()); this.resize.observe($('tank'));
      this.buildRain(); this.measure(); this.updateEnvironment();
      this.environmentTimer = setInterval(() => this.updateEnvironment(), 30000);
      document.addEventListener('visibilitychange', () => { this.updateEnvironment(); this.restart(); });
    }
    static periodFor(date) { return periodFor(date); }
    setForceOffset(offset){Object.assign(this.forceOffset,offset);if(this.width)this.renderPosition();}
    setInteraction(active,pose='angry'){
      if(active===this.interaction.active){const changed=this.interaction.pose!==pose;this.interaction.pose=pose;if(active&&changed)this.render();return;}
      const now=performance.now();
      if(active){this.interaction={active:true,pose,at:now};this.glass.stop();}
      else{const elapsed=now-this.interaction.at;if(this.segment)this.segment.at+=elapsed;if(this.settling)this.settling.at+=elapsed;this.nextAction+=elapsed;this.interaction.active=false;}
      this.restart();
    }
    measure() {
      const previousWidth=this.width,previousSize=this.size,previousDepth=this.depth;
      this.width = $('tank').clientWidth; this.height = $('tank').clientHeight;
      this.size = Math.min(590, Math.max(220, this.width * 1.18), Math.max(240, this.height * .9));
      this.depth = Math.min(210, Math.max(100, this.width * .46));
      $('tank').style.setProperty('--actor-size', `${this.size}px`);
      $('tank').style.setProperty('--depth', `${this.depth}px`);
      this.segment = null;
      this.walking=false;
      if(previousWidth){this.position.x*=this.width/previousWidth;this.position.y*=this.size/previousSize;this.position.z*=this.depth/previousDepth;}
      if(this.options.sleeping){const target={x:this.width*.03,y:this.size*.12,z:-this.depth*.45,turn:0,tilt:-66};if(this.settling)this.settling.target=target;else this.position=target;}
      this.position.x = Math.max(-this.width * .5, Math.min(this.width * .5, this.position.x));
      this.position.y = Math.max(-this.height * .35, Math.min(this.size * .5, this.position.y));
      this.render();
    }
    setOptions(options) {
      const wasSleeping=this.options.sleeping,oldActivity=this.options.activity,oldTask=this.options.taskActivity;
      Object.assign(this.options, options);
      if(wasSleeping!==this.options.sleeping||oldActivity!==this.options.activity){
        this.segment=null;this.walking=false;this.restPose=null;
        this.nextAction=performance.now()+this.pauseDuration();
      }
      if(wasSleeping!==this.options.sleeping||(this.options.taskActivity&&this.options.taskActivity!==oldTask)||(this.options.activity==='smash'&&oldActivity!=='smash')){
        const target=this.options.sleeping?{x:this.width*.03,y:this.size*.12,z:-this.depth*.45,turn:0,tilt:-66}:{x:0,y:0,z:this.options.activity==='smash'?85:30,turn:0,tilt:0};
        this.settling={start:{...this.position},target,at:performance.now(),duration:500};
      }
      $('tank').dataset.sleeping=String(this.options.sleeping);
      $('tank').dataset.activity=this.options.activity;
      this.updateEnvironment();
      this.restart();
    }
    updateEnvironment() {
      const now = new Date();
      const nextPeriod = this.options.mode === 'auto' ? periodFor(now) : this.options.mode;
      const periodChanged = nextPeriod !== this.period;
      if (nextPeriod !== this.period) {
        this.period = nextPeriod;
      }
      document.documentElement.dataset.period = this.period;
      const localHour = now.getHours() + now.getMinutes() / 60;
      const daylight = this.options.mode === 'auto' ? Math.max(0, Math.sin((localHour - 7) / 12 * Math.PI)) : 1;
      document.documentElement.style.setProperty('--day-top', `hsl(277 39% ${76 + daylight*10}%)`);
      document.documentElement.style.setProperty('--day-bottom', `hsl(277 29% ${58 + daylight*10}%)`);
      document.querySelector('meta[name="theme-color"]').content = this.period === 'day' ? '#e7dfed' : '#211b2c';
      const slot = now.getFullYear()*1000000+(now.getMonth()+1)*10000+now.getDate()*100+now.getHours()*2+Math.floor(now.getMinutes()/30);
      const weatherNumber = ((Math.imul(slot, 2654435761) >>> 0) % 100);
      const weather = this.options.weather === 'auto' ? (weatherNumber < 28 ? 'rain' : weatherNumber < 44 ? 'fog' : 'clear') : this.options.weather;
      $('tank').dataset.weather = weather;
      this.updateSunlight(weather);
      $('tank').classList.toggle('is-lit', Date.now() < this.litUntil);
      const activity=this.data.config.behavior.moodPool.activities.find(item=>item.key===this.options.activity)||this.data.config.behavior.schedule.find(item=>item.activity===this.options.activity);
      $('tank').setAttribute('aria-label', this.options.sleeping ? '窗内的角色正在睡觉，轻点窗户可短暂亮灯' : `紫色房间的窗户，角色正在${activity?.label||'寻找出口'}`);
      $('tank').classList.toggle('awake-at-night',this.period==='late'&&!this.options.sleeping);
      this.render();
      if (periodChanged) this.restart();
    }
    updateSunlight(weather){
      const tank=$('tank'),now=Date.now(),allowed=this.period==='day'&&weather==='clear'&&!document.hidden;
      if(!allowed){clearTimeout(this.sunTimer);this.sunTimer=null;this.sunNextAt=0;this.sunUntil=0;tank.classList.remove('has-sunlight');return;}
      if(this.sunUntil&&now>=this.sunUntil){this.sunUntil=0;tank.classList.remove('has-sunlight');this.sunNextAt=now+120000+Math.random()*240000;}
      if(!this.sunUntil&&!this.sunNextAt)this.sunNextAt=now+45000+Math.random()*135000;
      if(!this.sunUntil&&now>=this.sunNextAt){
        this.sunUntil=now+22000+Math.random()*18000;this.sunNextAt=0;tank.classList.add('has-sunlight');
        clearTimeout(this.sunTimer);this.sunTimer=setTimeout(()=>this.updateSunlight(tank.dataset.weather),this.sunUntil-now+10);
      }
    }
    buildRain() {
      const fragment = document.createDocumentFragment();
      for (let i=0;i<30;i++) {
        const drop=document.createElement('i'); drop.className='rain-drop';
        drop.style.cssText=`--x:${(i*37.9)%100}%;--w:${2+i%3}px;--h:${12+i%5*7}px;--duration:${5+i%7}s;--delay:-${i*.83}s;--still-y:${(i*23.7)%100}%`;
        fragment.append(drop);
      }
      $('rain').append(fragment);
    }
    glance() {
      this.glass.stop();
      this.lastAttention=performance.now(); this.segment=null; this.walking=false;
      this.litUntil=Date.now()+12000;
      $('tank').classList.add('is-lit');
      clearTimeout(this.lightTimer);
      this.lightTimer=setTimeout(()=>this.updateEnvironment(),12020);
      this.nextAction=performance.now()+6000; this.render();
      return this.options.sleeping;
    }
    restart() {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.moveTimer);this.raf=null;
      document.body.classList.toggle('motion-stopped', document.hidden || this.options.blocked);
      $('tank').dataset.walkingPaused=String(this.options.paused);
      if(!this.canTravel()&&!this.interaction.active){this.walking=false;this.segment=null;}
      if(this.settling&&(document.hidden||this.options.reduce)){this.position={...this.settling.target};this.settling=null;}
      this.render();
      if(document.hidden||this.options.blocked||this.interaction.active)return;
      if(this.settling||this.segment){this.raf=requestAnimationFrame(this.tick);return;}
      if(this.canTravel()&&this.options.movement!=='still')this.moveTimer=setTimeout(()=>this.beginMove(),Math.max(0,this.nextAction-performance.now()));
    }
    canTravel() {
      return !document.hidden&&!this.options.reduce&&!this.options.paused&&!this.options.blocked&&!this.options.sleeping&&!this.options.reaction&&!this.interaction.active&&!this.glass.busy&&!(document.documentElement.dataset.input==='keyboard'&&$('character').matches(':focus-visible'));
    }
    beginMove() {
      if(!this.canTravel())return this.restart();
      const now=performance.now();
      if(now-this.lastAttention<1500){this.nextAction=this.lastAttention+1500;return this.restart();}
      const destination={...this.destination(),tilt:0};
      const speed=this.options.movement==='roam'?this.data.config.behavior.roam.speedPxPerSec:this.data.config.behavior.pace.speedPxPerSec;
      const distance=Math.hypot(destination.x-this.position.x,destination.y-this.position.y,destination.z-this.position.z);
      this.segment={start:{...this.position},target:destination,at:now,duration:Math.max(600,distance/speed*1000)};
      this.walking=true;this.restPose=null;$('tank').dataset.action=destination.name;
      this.render(now);this.raf=requestAnimationFrame(this.tick);
    }
    destination() {
      const w=this.width,h=this.height,s=this.size,d=this.depth;
      // A room route: back corners, side inspection, front glass and cropped peeks.
      const places=[
        {x:-w*.24,y:0,z:-d*.85,turn:-12,name:'back-left'},
        {x:w*.27,y:0,z:-d*.7,turn:12,name:'back-right'},
        {x:w*.48,y:0,z:-30,turn:20,name:'side-peek'},
        {x:w*.04,y:0,z:95,turn:0,name:'front-glass'},
        {x:-w*.18,y:s*.33,z:75,turn:0,name:'head-peek'},
        {x:-w*.43,y:-h*.30,z:45,turn:-18,name:'edge-search'},
        {x:w*.08,y:-h*.55,z:105,turn:0,name:'upper-search'},
        {x:0,y:0,z:25,turn:0,name:'center'}
      ];
      // Choose a new room destination each time instead of repeating a fixed route.
      const choices=places.map((place,index)=>({place,index})).filter(item=>item.index!==this.pathIndex);
      const selected=choices[Math.floor(Math.random()*choices.length)];this.pathIndex=selected.index;
      const place=selected.place;
      return place;
    }
    pauseDuration() {
      const rules=this.data.config.behavior;
      if(this.options.movement==='roam')return rules.roam.pauseMinMs+Math.random()*(rules.roam.pauseMaxMs-rules.roam.pauseMinMs);
      return (rules.pace.intervalMinSeconds+Math.random()*(rules.pace.intervalMaxSeconds-rules.pace.intervalMinSeconds))*1000;
    }
    dodge() {
      if(this.options.reduce||this.options.paused||this.options.blocked||this.options.sleeping)return;
      const direction=this.position.x>=0?-1:1;
      this.segment={start:{...this.position},target:{x:direction*this.width*.2,y:this.position.y,z:this.position.z,turn:direction*8,tilt:0},at:performance.now(),duration:this.data.config.behavior.nudge.durationMs,dodge:true};
      this.restart();
    }
    tick(now) {
      this.raf=null;
      if(document.hidden||this.options.blocked||this.interaction.active)return this.restart();
      const segment=this.settling||this.segment;
      if(segment){
        const settling=!!this.settling,t=Math.min(1,(now-segment.at)/segment.duration),e=ease(t);
        for(const key of ['x','y','z','turn','tilt'])this.position[key]=mix(segment.start[key]||0,segment.target[key]||0,e);
        this.walking=!settling;
        if (t>=1) {
          const wasDodge=segment.dodge;
          this.settling=null;this.segment=null;this.walking=false;this.nextAction=now+this.pauseDuration();
          if(!settling&&!wasDodge){this.restPose=this.onArrive?.()||this.options.pose;if(this.restPose==='smash')this.settling={start:{...this.position},target:{x:0,y:0,z:85,turn:0,tilt:0},at:now,duration:500};}
        }
      }
      this.render(now);
      if(this.settling||this.segment)this.raf=requestAnimationFrame(this.tick);else this.restart();
    }
    renderPosition(now=performance.now()){
      const p=this.position,f=this.forceOffset,walking=this.walking&&!this.interaction.active;
      const bob=walking&&!this.options.reduce?Math.sin(now/115)*2:0,lean=(p.tilt||0)+f.tilt+(walking?Math.sin(now/220)*1.4:0);
      const clamp=RoomPhysics.clamp,w=this.width,h=this.height,s=this.size;
      // Keep an opaque central part of the sprite inside the window, after
      // rotation around its feet and perspective. Logical travel stays intact.
      let x=p.x+f.x,y=p.y+f.y+bob,z=clamp(p.z+f.z,-this.depth*.9,145);
      const a=lean*Math.PI/180,b=p.turn*Math.PI/180,origin=this.options.sleeping?.58:1;
      const cy=s*(.5-origin),rx=-cy*Math.sin(a),ry=cy*Math.cos(a),rz=-rx*Math.sin(b);
      // Tank and actor stage both apply 850px perspective. Their combined
      // projection is 425px; this is also conservative when a browser flattens one.
      const scale=425/(425-z-rz),baseY=h*.97-s*(1-origin);
      const px=w/2+(x+rx*Math.cos(b))*scale,py=h*.43+(baseY+y+ry-h*.43)*scale;
      const margin=Math.min(64,s*.16,w*.24,h*.24);
      x+=(clamp(px,margin,w-margin)-px)/scale;y+=(clamp(py,margin,h-margin)-py)/scale;
      $('actor').style.transform=`translateX(-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${p.turn.toFixed(2)}deg) rotateZ(${lean.toFixed(2)}deg)`;
      $('actor-shadow').style.transform=`translateX(-50%) translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px)`;
      $('actor-shadow').style.opacity=String(Math.max(.1,1-Math.abs(p.y+f.y)/this.height));
    }
    render(now=performance.now()) {
      if (!this.width) return;
      const p=this.position,sleep=this.options.sleeping;this.renderPosition(now);
      let state=sleep?'sleep':this.interaction.active?this.interaction.pose:this.options.reaction?this.options.reactionPose||'angry':this.walking?(this.options.singStroll&&this.options.activity==='sing'?'sing':'walk'):this.restPose||this.options.pose;
      const smash=!sleep&&!this.interaction.active&&!this.options.reaction&&!this.walking&&!this.settling&&!this.options.paused&&!this.options.blocked&&!this.options.taskActivity&&(this.options.activity==='smash'||this.restPose==='smash');
      this.glass.sync({active:smash,fox:this.options.fox,reduce:this.options.reduce});
      if(state==='smash')state='angry';
      if(state==='walk'&&!this.walking)state='idle';
      const definition=this.data.config.states[state]||this.data.config.states.idle;
      this.animateSprite(state,definition);
      $('actor').classList.toggle('breathing',!!definition.breathe&&!this.walking&&!this.options.reduce);
      $('actor').classList.toggle('singing-walk',this.walking&&this.options.singStroll&&this.options.activity==='sing');
      $('actor').dataset.depth=p.z.toFixed(1);
    }
    animateSprite(state,definition) {
      // Expressions use their own low-frequency clock, independent of room travel.
      const frozen=document.hidden||this.options.blocked,form=this.options.fox?'fox':'human';
      const animationKey=`${form}:${state}:${frozen}`;
      if(this.animationKey===animationKey)return;
      const samePose=this.animationKey?.split(':').slice(0,2).join(':')===`${form}:${state}`;
      this.animationKey=animationKey;clearInterval(this.frameTimer);this.frameTimer=null;
      if(!samePose)this.frame=1;
      const paint=()=>{const pose=`${state}_${this.frame}`,key=`${form}_${pose}`;
        if(key!==this.spriteKey){$('sprite').src=this.data.sprites[key]||this.data.sprites[`${form}_idle_1`];this.spriteKey=key;}
        $('actor').dataset.pose=pose;};
      paint();
      if(!frozen&&definition.frames>1)this.frameTimer=setInterval(()=>{this.frame=this.frame%definition.frames+1;paint();},1000/(definition.fps||1));
    }
  }
  window.RoomMotion=RoomMotion;
})();
