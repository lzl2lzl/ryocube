(() => {
  const $=id=>document.getElementById(id);
  const format=ms=>{const n=Math.max(0,Math.floor(ms/1000)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');};
  class RoomClockUI {
    constructor({onRing,onStart,onDismiss,onChange}){
      this.model=new RoomClock();this.sound=new AlarmSound(window.YUE_DATA.audio);this.mode='alarm';this.onRing=onRing;this.onStart=onStart;this.onDismiss=onDismiss;this.onChange=onChange;this.ringing=false;this.confirmTaps=0;
      const date=new Date(Date.now()+15*60000);$('alarm-time').value=`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      document.querySelectorAll('[data-clock-mode]').forEach(button=>button.addEventListener('click',()=>this.select(button.dataset.clockMode)));
      document.querySelector('.clock-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const modes=['alarm','loop','watch'];const index=event.key==='Home'?0:event.key==='End'?2:(modes.indexOf(this.mode)+(event.key==='ArrowRight'?1:2))%3;this.select(modes[index]);document.querySelector(`[data-clock-mode="${this.mode}"]`).focus();});
      $('alarm-form').addEventListener('submit',event=>{event.preventDefault();this.sound.unlock();if(this.model.setAlarm($('alarm-time').value)){this.render();this.onStart();}});
      $('alarm-cancel').addEventListener('click',()=>{this.model.alarm=null;this.silence();this.render();});
      $('loop-form').addEventListener('submit',event=>{event.preventDefault();this.sound.unlock();if(this.model.startLoop(Number($('focus-minutes').value),Number($('rest-minutes').value))){this.render();this.onStart();}});
      $('loop-pause').addEventListener('click',()=>{this.model.toggleLoop();this.silence();this.render();});
      $('loop-stop').addEventListener('click',()=>{this.model.loop=null;this.silence();this.render();});
      $('watch-toggle').addEventListener('click',()=>{this.model.toggleWatch();this.render();if(this.model.watch.started!==null)this.onStart();});
      $('watch-reset').addEventListener('click',()=>{this.model.resetWatch();this.render();});
      $('alarm-overlay').addEventListener('click',()=>this.confirm());
      $('alarm-overlay').addEventListener('keydown',event=>{event.stopPropagation();if(['Enter',' '].includes(event.key)){event.preventDefault();this.confirm();}else if(event.key==='Tab')event.preventDefault();});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.tick();});
      window.addEventListener('pageshow',()=>this.tick());
      this.interval=setInterval(()=>this.tick(),1000);this.render();
    }
    select(mode){this.mode=mode;this.render();}
    tick(){
      const events=this.model.tick();if(events.length)this.pending=events.at(-1);
      if(!document.hidden&&this.pending){const event=this.pending;this.pending=null;this.mode=event.mode;this.ringing=true;this.confirmTaps=0;this.sound.ring();this.onRing(event.text);}
      if(!document.hidden)this.render();
    }
    confirm(){if(!this.ringing)return;this.confirmTaps++;if(this.confirmTaps>=2)this.silence();}
    silence(){this.pending=null;this.sound.stop();if(this.ringing){this.ringing=false;this.onDismiss();}this.render();}
    render(){
      for(const mode of ['alarm','loop','watch']){$(`clock-${mode}`).hidden=this.mode!==mode;const tab=document.querySelector(`[data-clock-mode="${mode}"]`);tab.setAttribute('aria-selected',String(this.mode===mode));tab.tabIndex=this.mode===mode?0:-1;}
      const alarm=this.model.alarm;$('alarm-form').hidden=!!alarm;$('alarm-running').hidden=!alarm;
      if(alarm){$('alarm-display').textContent=alarm.time;$('alarm-remaining').textContent=`还有 ${format(Math.ceil((alarm.at-Date.now())/1000)*1000)}`;}
      const loop=this.model.loopView();$('loop-form').hidden=!!loop;$('loop-running').hidden=!loop;
      if(loop){$('loop-phase').textContent=`第 ${loop.round} 轮 · ${loop.phase==='focus'?'专注':'休息'}`;$('loop-display').textContent=format(Math.ceil(loop.remaining/1000)*1000);$('loop-pause').textContent=loop.paused?'继续':'暂停';}
      $('watch-display').textContent=format(this.model.watchValue());$('watch-toggle').textContent=this.model.watch.started===null?'开始':'暂停';$('watch-reset').disabled=this.model.watchValue()===0;
      $('open-timer').classList.toggle('is-running',this.model.active);$('open-timer').setAttribute('aria-label',this.model.active?'查看闹钟与计时':'打开闹钟与计时');
      const watch=this.model.watchValue(),watchVisible=this.model.watch.started!==null||watch>0;
      $('loop-hud').hidden=!loop;$('watch-hud').hidden=!watchVisible;$('clock-hud').hidden=!loop&&!watchVisible;
      $('clock-hud').classList.toggle('has-two',!!loop&&watchVisible);
      if(loop){$('loop-hud-label').textContent=(loop.phase==='focus'?'专注':'休息')+(loop.paused?' · 已暂停':'');$('loop-hud-value').textContent=format(Math.ceil(loop.remaining/1000)*1000);}
      if(watchVisible){$('watch-hud-label').textContent=this.model.watch.started===null?'计时了了 · 已暂停':'计时了了';$('watch-hud-value').textContent=format(watch);$('watch-hud').classList.toggle('long-time',format(watch).length>5);}
      const activityKey=loop&&!loop.paused?loop.phase:'none';
      if(activityKey!==this.activityKey){this.activityKey=activityKey;this.onChange?.();}
    }
  }
  window.RoomClockUI=RoomClockUI;
})();
