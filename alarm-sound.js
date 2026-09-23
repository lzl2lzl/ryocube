(() => {
  class AlarmSound {
    constructor(sources){this.sources=sources;this.nodes=new Set();this.generation=0;this.enabled=true;}
    async unlock(){
      try{
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
        if(!this.context){this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.8;
          const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-10;limiter.ratio.value=12;this.master.connect(limiter);limiter.connect(this.context.destination);}
        await this.context.resume();
        this.loading||=Promise.all(Object.entries(this.sources).map(async([key,uri])=>{
          const binary=atob(uri.split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
          return[key,await this.context.decodeAudioData(bytes.buffer)];
        })).then(entries=>{this.buffers=Object.fromEntries(entries);}).catch(error=>{this.loading=null;throw error;});
        await this.loading;return this.context.state==='running';
      }catch{return false;}
    }
    burst(){
      if(!this.enabled||!this.buffers||this.context.state!=='running')return;
      const t=this.context.currentTime;
      for(const[key,delay,gain,rate] of [['core',0,.65,1],['bubble',.18,.5,1.13],['violet',.6,.5,1],['bubble',1.25,.5,.9],['core',1.8,.55,1.08]]){
        const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=this.buffers[key];source.playbackRate.value=rate;level.gain.value=gain;
        source.connect(level);level.connect(this.master);this.nodes.add(source);source.onended=()=>{this.nodes.delete(source);source.disconnect();level.disconnect();};source.start(t+delay);
      }
    }
    async ring(preview=false){
      this.stop();const token=this.generation;if(!this.enabled)return;
      if(!await this.unlock()||token!==this.generation)return;
      this.burst();if(!preview)this.repeat=setInterval(()=>this.burst(),4000);
      if(preview)this.end=setTimeout(()=>this.stop(),4000);
    }
    stop(){this.generation++;clearInterval(this.repeat);clearTimeout(this.end);for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
  }
  window.AlarmSound=AlarmSound;
})();
