(() => {
  'use strict';
  const {clamp,rotate,deadZone,ShakeGate,MotionFilter,SwipeGesture}=RoomPhysics,$=id=>document.getElementById(id);
  class RoomInteraction{
    constructor(room,{onDisturb,onGestureMove,onTap,canTap,canInteract}){
      this.room=room;this.onDisturb=onDisturb;this.onGestureMove=onGestureMove;this.onTap=onTap;this.canTap=canTap;this.canInteract=canInteract;
      this.gate=new ShakeGate();this.filter=new MotionFilter();this.gesture=new SwipeGesture();this.pointers=new Set();this.enabled=false;this.blocked=false;this.angle=0;
      this.offset={x:0,y:0,tilt:0,z:0};this.velocity={x:0,y:0,tilt:0,z:0};this.tilt={x:0,y:0};this.linear={x:0,y:0,z:0};this.quake=false;this.level=0;this.busy=false;this.dragging=false;this.returnAt=0;this.suppressUntil=0;this.sensorUntil=0;
      this.available=window.isSecureContext&&typeof DeviceMotionEvent!=='undefined';
      this.permission=this.available?(typeof DeviceMotionEvent.requestPermission==='function'?'prompt':'granted'):'unsupported';
      this.frame=this.frame.bind(this);this.motion=this.motion.bind(this);
      this.bindGestures();this.renderPermission();
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();});
      window.addEventListener('orientationchange',()=>this.reset());
      screen.orientation?.addEventListener('change',()=>this.reset());
    }
    setContext({enabled,blocked,angle,reduce}){
      if((!enabled&&this.enabled)||(blocked&&!this.blocked)||this.angle!==angle)this.reset();
      this.enabled=enabled;this.blocked=blocked;this.angle=angle;this.reduce=reduce;
      const listen=enabled&&this.permission==='granted';
      if(listen&&!this.listening)window.addEventListener('devicemotion',this.motion,{passive:true});
      else if(!listen&&this.listening)window.removeEventListener('devicemotion',this.motion);
      this.listening=listen;this.renderPermission();
    }
    renderPermission(){
      const note=$('motion-status');
      note.hidden=!this.accessAttempted||this.pending||this.permission==='granted';
      note.textContent=this.permission==='unsupported'?'当前浏览器不支持重力感应。':'未获授权，重力未开启。';
    }
    async requestAccess(){
      if(this.pending)return false;
      this.accessAttempted=true;
      if(!this.available){this.renderPermission();return false;}
      if(this.permission==='granted'){this.renderPermission();return true;}
      this.pending=true;this.renderPermission();
      try{this.permission=await DeviceMotionEvent.requestPermission();}
      catch{this.permission='denied';}
      finally{this.pending=false;this.renderPermission();}
      return this.permission==='granted';
    }
    motion(event){
      if(!this.enabled||this.blocked||document.hidden)return;
      const now=performance.now(),sample=this.filter.sample(event.acceleration,event.accelerationIncludingGravity,now);
      if(!sample)return;
      this.lastMotion=now;
      const screenAngle=Number(screen.orientation?.angle??window.orientation??0),angle=screenAngle-this.angle;
      this.tilt=rotate(sample.tilt.x,sample.tilt.y,angle);
      this.linear={...rotate(sample.linear.x,-sample.linear.y,angle),z:sample.linear.z};
      const wasQuake=this.quake;
      if(this.pointers.size||this.dragging||now<this.sensorUntil){this.gate.reset();this.quake=false;this.linear={x:0,y:0,z:0};}
      else{
        const result=this.gate.sample(sample.raw,now);this.quake=result.active;this.level=result.level;
        if(this.quake){
          this.begin(this.level>.4?'scold':'surprise');this.returnAt=0;this.releaseTarget=null;
          if(!wasQuake||now>=this.nextAnger){this.onDisturb('shake');this.nextAnger=now+3500;}
        }
      }
      if(wasQuake&&!this.quake&&!this.dragging)this.returnAt=now;
      if(this.quake||this.busy||Math.hypot(this.linear.x,this.linear.y,this.linear.z)>.18||this.offsetChanged())this.wake();
    }
    idleTarget(){
      const x=this.enabled?this.tilt.x*Math.min(110,this.room.width*.28):0,y=this.enabled?this.tilt.y*Math.min(100,this.room.height*.18):0;
      return{x,y,z:0,tilt:clamp(x/7,-8,8)};
    }
    offsetChanged(){const target=this.idleTarget();return Object.keys(target).some(k=>Math.abs(target[k]-this.offset[k])>.2||Math.abs(this.velocity[k])>.2);}
    begin(pose){this.busy=true;this.room.setInteraction(true,pose);}
    drag(vector){
      if(this.blocked||!this.canInteract())return;
      if(!this.dragging){this.dragging=true;this.dragOrigin={...this.offset};this.quake=false;this.gate.reset();this.begin('angry');}
      const v=rotate(vector.x,vector.y,-this.angle),p=this.room.position,w=this.room.width,h=this.room.height;
      this.dragTarget={x:clamp(this.dragOrigin.x+v.x,-w*.43-p.x,w*.43-p.x),y:clamp(this.dragOrigin.y+v.y,-h*.62-p.y,this.room.size*.17-p.y),z:this.dragOrigin.z,tilt:clamp(v.x/w*22-v.y/h*8,-22,22)};
      this.returnAt=0;this.wake();
    }
    swipe(vector){
      if(this.blocked||!this.canInteract())return;
      if(!this.dragging)this.drag(vector);
      const v=rotate(vector.vx??vector.x*4,vector.vy??vector.y*4,-this.angle),w=this.room.width,h=this.room.height;
      this.velocity.x=clamp(v.x*.75,-w*2.3,w*2.3);this.velocity.y=clamp(v.y*.75,-h*1.5,h*1.5);
      this.velocity.tilt=clamp(v.x/w*18,-70,70);this.dragging=false;this.returnAt=performance.now();this.sensorUntil=this.returnAt+650;
      this.releaseTarget={...this.offset};this.begin('angry');this.onDisturb('swipe');this.wake();
    }
    cancelDrag(){if(this.dragging){this.dragging=false;this.returnAt=performance.now();this.sensorUntil=this.returnAt+650;this.releaseTarget={...this.offset};this.wake();}}
    wake(){if(!this.raf){this.lastFrame=performance.now();this.raf=requestAnimationFrame(this.frame);}}
    frame(now){
      this.raf=null;if(document.hidden||this.blocked)return this.reset();
      const dt=Math.min(.04,Math.max(.001,(now-this.lastFrame)/1000));this.lastFrame=now;
      if(this.quake&&now-this.lastMotion>500){this.quake=false;this.gate.reset();this.returnAt=now;}
      const p=this.room.position,w=this.room.width,h=this.room.height,idle=this.idleTarget();
      let target={...idle},spring=42,damping=13,force={x:0,y:0,z:0,tilt:0};
      const fresh=this.enabled&&now>=this.sensorUntil&&this.lastMotion!==undefined?Math.exp(-Math.max(0,now-this.lastMotion-80)/100):0;
      const ax=deadZone(this.linear.x,.18)*fresh,ay=deadZone(this.linear.y,.18)*fresh,az=deadZone(this.linear.z,.18)*fresh;
      if(this.dragging){target={...this.dragTarget};spring=190;damping=24;}
      else if(this.quake){
        spring=24-this.level*12;damping=7-this.level*2;
        target.y-=h*(.045+this.level*.19);target.tilt=clamp(-this.offset.x/w*35-this.velocity.x/w*10,-60,60);
        force={x:-ax*w*(.55+this.level*1.1),y:-ay*h*(.3+this.level*.6),z:-az*(90+this.level*100),tilt:0};
      }else{
        force={x:-ax*w*.6,y:-ay*h*.35,z:-az*240,tilt:-ax*16};
        if(this.returnAt&&this.releaseTarget){const hold=Math.max(0,1-(now-this.returnAt)/450);for(const key of ['x','y','z','tilt'])target[key]+=(this.releaseTarget[key]-idle[key])*hold;}
      }
      if(this.reduce){for(const key of ['x','y','tilt']){target[key]*=.35;force[key]*=.35;}target.z=0;force.z=0;}
      for(const key of ['x','y','tilt','z']){this.velocity[key]+=((target[key]-this.offset[key])*spring+force[key])*dt;this.velocity[key]*=Math.exp(-damping*dt);this.offset[key]+=this.velocity[key]*dt;}
      const bounds=this.busy?[['x',-w*.44-p.x,w*.44-p.x],['y',-h*.65-p.y,this.room.size*.2-p.y],['z',-this.room.depth*.7-p.z,145-p.z],['tilt',-85,85]]:[['x',-Math.min(110,w*.28),Math.min(110,w*.28)],['y',-Math.min(100,h*.18),Math.min(100,h*.18)],['z',-70,70],['tilt',-14,14]];
      for(const [key,min,max]of bounds){const value=clamp(this.offset[key],min,max);if(value!==this.offset[key]){this.offset[key]=value;this.velocity[key]*=-.28;}}
      this.room.setForceOffset(this.offset);$('tank').classList.toggle('is-quaking',this.quake);$('tank').style.setProperty('--rattle',`${(.5+this.level*1.5).toFixed(2)}px`);
      const distance=Math.max(...Object.keys(idle).map(k=>Math.abs(this.offset[k]-idle[k]))),speed=Math.max(...Object.values(this.velocity).map(Math.abs));
      if(this.busy&&!this.dragging&&!this.quake&&this.returnAt&&((now-this.returnAt>500&&distance<2&&speed<8)||now-this.returnAt>3000)){
        this.busy=false;this.returnAt=0;this.releaseTarget=null;this.room.setInteraction(false);
      }
      $('tank').dataset.motion=this.dragging?'drag':this.quake?(this.level>.55?'flight':'shake'):this.busy?'settling':Math.hypot(ax,ay,az)>0?'inertia':Math.hypot(target.x,target.y)>1?'tilt':'idle';
      if(this.offsetChanged()||this.busy||this.quake||Math.hypot(ax,ay,az)>.1)this.raf=requestAnimationFrame(this.frame);
    }
    reset(){
      cancelAnimationFrame(this.raf);this.raf=null;this.gate.reset();this.filter.reset();this.quake=false;this.level=0;this.busy=false;this.dragging=false;this.returnAt=0;this.releaseTarget=null;this.lastMotion=undefined;this.tilt={x:0,y:0};this.linear={x:0,y:0,z:0};this.sensorUntil=0;
      for(const key of ['x','y','tilt','z'])this.offset[key]=this.velocity[key]=0;
      this.room.setForceOffset(this.offset);this.room.setInteraction(false);$('tank').classList.remove('is-quaking');$('tank').dataset.motion='idle';this.gesture.cancel();this.pointers.clear();
    }
    consumesClick(event){if(event.detail===0)return false;const suppressed=performance.now()<this.suppressUntil;this.suppressUntil=0;return suppressed;}
    bindGestures(){
      const tank=$('tank');
      tank.addEventListener('pointerdown',event=>{
        if(event.target.closest('.bubble.is-scrollable'))return;
        if(!['touch','pen'].includes(event.pointerType)||!this.canTap())return;
        if(!this.pointers.size)this.suppressUntil=0;
        this.pointers.add(event.pointerId);if(this.pointers.size>1){this.cancelDrag();this.gesture.cancel();this.suppressUntil=performance.now()+800;this.onGestureMove();return;}
        this.gesture.start(event.clientX,event.clientY,event.pointerId,performance.now());
      },{capture:true});
      tank.addEventListener('pointermove',event=>{if(this.gesture.move(event.clientX,event.clientY,event.pointerId,performance.now())){this.onGestureMove();if(!tank.hasPointerCapture(event.pointerId))tank.setPointerCapture(event.pointerId);if(this.dragging||Math.hypot(this.gesture.dx,this.gesture.dy)>=20)this.drag(this.gesture.vector(performance.now()));}});
      tank.addEventListener('pointerup',event=>{
        this.pointers.delete(event.pointerId);const result=this.gesture.end(event.clientX,event.clientY,event.pointerId,performance.now());if(!result)return;
        if(result.moved){this.suppressUntil=performance.now()+700;this.onGestureMove();}
        if(result.swipe&&!this.blocked&&this.canInteract())this.swipe(result.swipe);
        else if(this.dragging)this.cancelDrag();
        else if(!result.moved&&this.canTap()){this.suppressUntil=performance.now()+700;this.onTap();}
      });
      tank.addEventListener('pointercancel',event=>{this.pointers.delete(event.pointerId);this.cancelDrag();this.gesture.cancel();this.suppressUntil=performance.now()+700;this.onGestureMove();});
      tank.addEventListener('lostpointercapture',event=>{if(event.target!==tank)return;this.pointers.delete(event.pointerId);if(this.gesture.origin?.id===event.pointerId){this.cancelDrag();this.gesture.cancel();}});
    }
  }
  window.RoomInteraction=RoomInteraction;
})();
