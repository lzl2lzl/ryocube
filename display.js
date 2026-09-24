(() => {
  'use strict';
  window.RoomDisplay = class {
    constructor({button, installLink, status, onChange}) {
      this.button=button;this.installLink=installLink;this.status=status;this.onChange=onChange;
      this.pending=false;this.lastActive=this.active;this.timer=null;
      this.standalone=matchMedia('(display-mode: standalone)');
      button.addEventListener('click',()=>this.toggle());
      for(const name of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(name,()=>this.sync());
      for(const name of ['fullscreenerror','webkitfullscreenerror']) document.addEventListener(name,()=>{if(this.pending)this.fail();});
      this.standalone.addEventListener?.('change',()=>this.render());
      window.addEventListener('pageshow',()=>this.sync());
      this.render();
    }
    get active(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
    get supported(){
      const root=document.documentElement;
      return !!((root.requestFullscreen&&document.fullscreenEnabled!==false)||
        (root.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false));
    }
    render(){
      this.button.hidden=!this.supported&&!this.active;
      this.button.disabled=this.pending;
      this.button.textContent=this.active?'退出全屏':'全屏显示';
      this.installLink.hidden=this.standalone.matches||navigator.standalone===true;
    }
    sync(){
      const active=this.active,changed=active!==this.lastActive;
      this.lastActive=active;
      if(changed||(this.pending&&active===this.target)){
        clearTimeout(this.timer);this.pending=false;this.status.hidden=true;
      }
      this.render();
      if(changed)this.onChange(active);
    }
    fail(){
      clearTimeout(this.timer);this.pending=false;
      this.status.textContent=this.active?'暂时无法退出，请用浏览器的退出手势或 Esc。':'暂时无法全屏。可尝试将浏览器切回完整窗口，或添加到主屏幕。';
      this.status.hidden=false;this.render();
    }
    toggle(){
      if(this.pending)return;
      this.target=!this.active;this.pending=true;this.status.hidden=true;this.render();
      // Request on this same click; Safari requires a live user gesture.
      this.timer=setTimeout(()=>{if(this.active===this.target)this.sync();else this.fail();},3000);
      try{
        const owner=this.target?document.documentElement:document;
        const action=this.target?
          (owner.requestFullscreen&&document.fullscreenEnabled!==false?owner.requestFullscreen:owner.webkitRequestFullscreen):
          (document.fullscreenElement?owner.exitFullscreen:owner.webkitExitFullscreen||owner.exitFullscreen);
        if(!action)throw new Error('Fullscreen unavailable');
        const result=action.call(owner);
        // Older WebKit returns void and reports completion through its event.
        if(result?.then)result.then(()=>{if(this.active===this.target)this.sync();else if(this.pending)this.fail();},()=>{if(this.pending)this.fail();});
      }catch{this.fail();}
    }
  };
})();
