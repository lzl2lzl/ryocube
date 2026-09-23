((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RoomPhysics=api;})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rotate=(x,y,degrees)=>{const a=degrees*Math.PI/180;return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};};
  const preferences=saved=>({gravity:false,autoDismiss:typeof saved.autoDismiss==='boolean'?saved.autoDismiss:saved.keepBubble!==true});
  const deadZone=(value,threshold)=>Math.abs(value)<=threshold?0:Math.sign(value)*(Math.abs(value)-threshold);
  class ShakeGate{
    constructor(){this.reset();}
    reset(){this.started=null;this.lastStrong=-Infinity;this.lastSample=null;this.lastTurn=-Infinity;this.direction=null;this.turns=[];this.energy=0;this.active=false;this.level=0;}
    sample(vector,now){
      if(this.lastSample!==null&&(now-this.lastSample>450||now<this.lastSample))this.reset();
      const dt=this.lastSample===null?0:clamp((now-this.lastSample)/1000,0,.1);this.lastSample=now;
      const magnitude=Math.hypot(vector.x,vector.y,vector.z),wasActive=this.active;
      this.energy=this.energy*Math.exp(-dt/1.6)+clamp((magnitude-6)/12,0,1.5)*dt;
      if(now-this.lastStrong>500){this.started=null;this.turns=[];this.direction=null;this.active=false;}
      if(magnitude>=9){
        if(this.started===null)this.started=now;this.lastStrong=now;
        const direction={x:vector.x/magnitude,y:vector.y/magnitude,z:vector.z/magnitude};
        if(!this.direction)this.direction=direction;
        else if(direction.x*this.direction.x+direction.y*this.direction.y+direction.z*this.direction.z<-.4&&now-this.lastTurn>=90){this.turns.push(now);this.lastTurn=now;this.direction=direction;}
      }
      this.turns=this.turns.filter(t=>now-t<=1400);
      this.active=this.started!==null&&now-this.started>=500&&this.turns.length>=(wasActive?2:3)&&now-this.lastTurn<=500&&this.energy>=(wasActive?.14:.25);
      this.level=this.active?clamp((this.energy-.25)/.65,0,1):0;
      return{active:this.active,level:this.level,energy:this.energy};
    }
  }
  class MotionFilter{
    constructor(){this.reset();}
    reset(){this.gravity=null;this.estimatedGravity=null;this.neutral=null;this.last=null;this.linear={x:0,y:0,z:0};}
    sample(acceleration,includingGravity,now){
      const valid=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
      if(!valid(acceleration)&&!valid(includingGravity))return null;
      if(this.last!==null&&(now-this.last>450||now<this.last))this.reset();
      const dt=this.last===null?.02:clamp((now-this.last)/1000,.001,.1);this.last=now;
      let linear,gravity;
      if(valid(acceleration)){linear={x:acceleration.x,y:acceleration.y,z:acceleration.z};if(valid(includingGravity))gravity={x:includingGravity.x-linear.x,y:includingGravity.y-linear.y,z:includingGravity.z-linear.z};}
      else{
        this.estimatedGravity ||= {x:includingGravity.x,y:includingGravity.y,z:includingGravity.z};gravity={};const alpha=1-Math.exp(-dt/.32);
        for(const key of ['x','y','z'])gravity[key]=this.estimatedGravity[key]+(includingGravity[key]-this.estimatedGravity[key])*alpha;
        this.estimatedGravity={...gravity};
        linear={x:includingGravity.x-gravity.x,y:includingGravity.y-gravity.y,z:includingGravity.z-gravity.z};
      }
      if(gravity){
        if(!this.gravity)this.gravity={...gravity};else for(const key of ['x','y','z'])this.gravity[key]+=(gravity[key]-this.gravity[key])*(1-Math.exp(-dt/.14));
        if(!this.neutral&&Math.hypot(linear.x,linear.y,linear.z)<3)this.neutral={...this.gravity};
      }
      const alpha=1-Math.exp(-dt/.065);for(const key of ['x','y','z'])this.linear[key]+=(clamp(linear[key],-40,40)-this.linear[key])*alpha;
      const tilt=this.gravity&&this.neutral?{x:deadZone(-(this.gravity.x-this.neutral.x),1.2)/6,y:deadZone(this.gravity.y-this.neutral.y,1.2)/6}:{x:0,y:0};
      return{raw:linear,linear:{...this.linear},tilt:{x:clamp(tilt.x,-1,1),y:clamp(tilt.y,-1,1)}};
    }
  }
  class SwipeGesture{
    start(x,y,id,now=0){this.origin={x,y,id};this.dx=0;this.dy=0;this.moved=false;this.samples=[{x,y,at:now}];}
    move(x,y,id,now=0){if(!this.origin||id!==this.origin.id)return false;this.dx=x-this.origin.x;this.dy=y-this.origin.y;this.moved ||= Math.hypot(this.dx,this.dy)>12;this.samples.push({x,y,at:now});this.samples=this.samples.filter(s=>now-s.at<=100).slice(-12);return this.moved;}
    vector(now=0){const a=this.samples[0],b=this.samples.at(-1),seconds=Math.max(.016,(now-a.at)/1000);return{x:this.dx,y:this.dy,vx:clamp((b.x-a.x)/seconds,-2400,2400),vy:clamp((b.y-a.y)/seconds,-2400,2400)};}
    end(x,y,id,now=0){if(!this.origin||id!==this.origin.id)return null;this.move(x,y,id,now);const moved=this.moved,result=Math.hypot(this.dx,this.dy)>=20?this.vector(now):null;this.cancel();return{moved,swipe:result};}
    cancel(){this.origin=null;this.moved=false;this.samples=[];}
  }
  return{clamp,rotate,deadZone,preferences,ShakeGate,MotionFilter,SwipeGesture};
});
