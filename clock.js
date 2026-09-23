((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.RoomClock=factory();})(typeof window==='undefined'?globalThis:window,()=>{
  class RoomClock {
    constructor(now=Date.now){this.now=now;this.alarm=null;this.loop=null;this.watch={elapsed:0,started:null};}
    setAlarm(time){
      if(!/^\d{2}:\d{2}$/.test(time))return false;
      const [h,m]=time.split(':').map(Number);if(h>23||m>59)return false;
      const at=new Date(this.now());at.setHours(h,m,0,0);if(at.getTime()<=this.now())at.setDate(at.getDate()+1);
      this.alarm={at:at.getTime(),time};return true;
    }
    startLoop(work,rest){
      if(![work,rest].every(n=>Number.isInteger(n)&&n>=1&&n<=180))return false;
      this.loop={work:work*60000,rest:rest*60000,elapsed:0,started:this.now(),phaseKey:0};return true;
    }
    loopView(){
      if(!this.loop)return null;const loop=this.loop,elapsed=loop.elapsed+(loop.started===null?0:Math.max(0,this.now()-loop.started));
      const length=loop.work+loop.rest,round=Math.floor(elapsed/length),part=elapsed%length,rest=part>=loop.work;
      return{phase:rest?'rest':'focus',round:round+1,phaseKey:round*2+(rest?1:0),remaining:(rest?length:loop.work)-part,paused:loop.started===null};
    }
    toggleLoop(){if(!this.loop)return;if(this.loop.started===null)this.loop.started=this.now();else{this.loop.elapsed+=Math.max(0,this.now()-this.loop.started);this.loop.started=null;}}
    watchValue(){return this.watch.elapsed+(this.watch.started===null?0:Math.max(0,this.now()-this.watch.started));}
    toggleWatch(){if(this.watch.started===null)this.watch.started=this.now();else{this.watch.elapsed=this.watchValue();this.watch.started=null;}}
    resetWatch(){this.watch={elapsed:0,started:null};}
    tick(){
      const events=[];
      if(this.alarm&&this.now()>=this.alarm.at){events.push({mode:'alarm',text:'时间到了'});this.alarm=null;}
      const view=this.loopView();
      if(view&&view.phaseKey!==this.loop.phaseKey){this.loop.phaseKey=view.phaseKey;events.push({mode:'loop',text:view.phase==='rest'?'该休息了':'该专注了'});}
      return events;
    }
    get active(){return !!(this.alarm||this.loop||this.watch.started!==null);}
  }
  return RoomClock;
});
