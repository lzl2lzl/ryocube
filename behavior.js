// Browser adaptation of the desktop rules. Configuration and Mind are bundled
// from the original project; the only sensing available here is page input.
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mind.js'));
  else root.RoomBehavior = factory(root.RoomMind);
})(typeof window === 'undefined' ? globalThis : window, mindModule => {
  'use strict';
  const {Mind}=mindModule;
  class RoomBehavior {
    constructor({config, dialogue, persisted = {}, now = Date.now, random = Math.random, idleMinutes}) {
      if(Number.isFinite(idleMinutes))config={...config,behavior:{...config.behavior,awayAfterMinutes:idleMinutes}};
      this.config=config; this.rules=config.behavior; this.dialogue=dialogue; this.now=now; this.random=random;
      this.lastInputAt=now(); this.lastClickAt=-Infinity; this.lastSpokeAt=-Infinity;
      this.lastPick={}; this.events=[]; this.wakeClicks=[]; this.clickTimes=[]; this.manualSleep=false; this.nightAwake=false;
      this.options={late:false,autoSleep:true,mutter:true,blocked:false,paused:false,activityOverride:null};
      this.mind=new Mind({config,persisted,getIdleSeconds:()=>Math.max(0,(now()-this.lastInputAt)/1000),now});
      this.moodAt=now(); this.mood=this.pickMood(); this.singStroll=this.mood==='sing'&&random()<this.rules.singStroll.chance;
      this.nextTaunt=now()+this.rules.chatter.busyTauntEverySeconds*1000;
    }
    candidates() {
      const date=new Date(this.now()),minute=date.getHours()*60+date.getMinutes();
      const eat=this.rules.schedule.find(slot=>slot.activity==='eat');
      const end=eat?eat.to.split(':').map(Number).reduce((h,m)=>h*60+m):null;
      return this.rules.moodPool.activities.filter(item=>item.weight>0&&(item.key!=='wine'||(date.getHours()>=item.wineAfterHour&&(!item.requiresEatDone||end===null||minute>=end))));
    }
    pickMood() {
      const pool=this.candidates(); let draw=this.random()*pool.reduce((sum,item)=>sum+item.weight,0);
      for(const item of pool){draw-=item.weight;if(draw<=0)return item.key;}
      return pool.at(-1)?.key||'screen';
    }
    entries(key) {
      return (this.dialogue[key]||[]).map(entry=>typeof entry==='string'?{text:entry}:entry)
        .filter(entry=>entry&&typeof entry.text==='string'&&(entry.minAnger==null||this.mind.anger>=entry.minAnger)&&(entry.maxAnger==null||this.mind.anger<=entry.maxAnger));
    }
    say(key,{ambient=false,gapSeconds=0}={}) {
      if(ambient&&(!this.options.mutter||this.options.blocked||this.options.paused||this.view?.sleeping))return false;
      const gap=ambient?this.rules.chatter.minGapSeconds:gapSeconds;
      if(this.now()-this.lastSpokeAt<gap*1000)return false;
      const pool=this.entries(key); if(!pool.length)return false;
      const fresh=pool.filter(entry=>entry.text!==this.lastPick[key]); const choices=fresh.length?fresh:pool;
      const entry=choices[Math.floor(this.random()*choices.length)]; this.lastPick[key]=entry.text; this.lastSpokeAt=this.now();
      this.events.push({type:'speech',key,text:entry.text}); return true;
    }
    maybeSpeak(key) {
      const map=this.config.moodMap[key];
      if(map&&this.random()<map.speakChance)this.say(map.dialogueKey,{ambient:true});
    }
    input() { this.lastInputAt=this.now(); }
    sync(options={}) {
      Object.assign(this.options,options);
      if(!this.options.late)this.nightAwake=false;
      this.mind.sample(); const snapshot=this.mind.snapshot(); const previous=this.view;
      const t=this.now(),switchMs=this.rules.moodPool.switchMinutes*60000;
      const reroll=t-this.moodAt>=switchMs||t<this.moodAt;
      if(reroll){this.mood=this.pickMood();this.moodAt=t;this.singStroll=this.mood==='sing'&&this.random()<this.rules.singStroll.chance;}
      const override=['screen','sing'].includes(this.options.activityOverride)?this.options.activityOverride:null;
      const sleeping=(this.manualSleep&&override!=='screen')||(!override&&this.options.autoSleep&&this.options.late&&!this.nightAwake);
      if(sleeping&&!previous?.sleeping){this.mind.debugSetAnger(0);this.clickTimes=[];this.wakeClicks=[];}
      const ambient=override||snapshot.activity?.activity||(snapshot.anger.tier!=='calm'?snapshot.anger.tier:snapshot.neglected?'impatient':this.mood);
      // In the small room, meals retain priority over autonomous exploration.
      const roaming=!override&&!sleeping&&!snapshot.activity&&snapshot.userState==='away';
      if(roaming&&!previous?.roaming)this.roamFox=this.random()<this.rules.roam.foxChance;
      if(!roaming)this.roamFox=false;
      const map=this.config.moodMap[ambient]||{state:'idle'};
      this.view={key:sleeping?'sleep':roaming?'roam':ambient,ambient,pose:sleeping?'sleep':map.state,
        sleeping,roaming,autoFox:!!(map.toFox||this.roamFox),singStroll:this.singStroll,
        movement:sleeping?'still':roaming?'roam':ambient==='walk'||(ambient==='sing'&&this.singStroll)?'pace':'still',
        anger:snapshot.anger.value,tier:snapshot.anger.tier,schedule:snapshot.activity?.activity||null};
      if(previous&&!sleeping&&!roaming&&override!=='screen'){
        if(previous.tier!==this.view.tier&&this.view.tier==='hot')this.say('anger_hot');
        else if(previous.tier!==this.view.tier&&this.view.tier==='rage')this.say('anger_rage');
        else if(reroll||previous.schedule!==this.view.schedule)this.maybeSpeak(ambient);
      }
      if(t>=this.nextTaunt){this.nextTaunt=t+this.rules.chatter.busyTauntEverySeconds*1000;
        if(!sleeping&&!roaming&&snapshot.userState==='working'&&snapshot.anger.tier==='calm'&&!snapshot.neglected&&this.random()<this.rules.chatter.busyTauntChance)this.say('busy_taunt',{ambient:true});}
      return this.view;
    }
    entrance() {
      if(this.view.sleeping)return;
      const kind=this.mind.entrance;
      if(kind!=='daily'||this.random()<this.rules.entrance.dailySpeakChance)this.say(`entrance_${kind}`);
    }
    poke() {
      this.input(); const t=this.now();
      if(this.view.sleeping){
        this.wakeClicks=this.wakeClicks.filter(at=>t-at<2000);this.wakeClicks.push(t);
        if(this.wakeClicks.length<5)return {action:'light'};
        this.manualSleep=false;this.nightAwake=true;this.wakeClicks=[];this.mind.touch('poke');this.sync();this.say('sleep_wake');return {action:'wake'};
      }
      const gentle=t-this.lastClickAt>=this.rules.poke.gapSeconds*1000;this.lastClickAt=t;
      const wasRoaming=this.view.roaming;this.sync();
      const map=this.config.moodMap[this.view.ambient];
      if(gentle&&!wasRoaming&&((map&&this.say(map.dialogueKey))||this.say('poke'))){this.mind.touch('poke');return {action:'speak'};}
      this.mind.touch('click');this.clickTimes=this.clickTimes.filter(at=>t-at<this.rules.clickComboWindowSeconds*1000);this.clickTimes.push(t);
      const n=this.clickTimes.length,ladder=this.rules.clickLadder;
      this.sync();if(n<=ladder.dodgeClicks)return {action:'dodge'};
      const key=n>=ladder.brawlClicks?'click_combo':n>=ladder.askClicks?'click_5':'click_3';
      this.say(key,{gapSeconds:this.rules.chatter.clickReplyGapSeconds});
      return {action:'react',pose:n>=ladder.brawlClicks?'scold':'angry'};
    }
    toggleSleep() {
      this.input();const asleep=this.view.sleeping;
      this.manualSleep=!asleep;this.nightAwake=asleep&&this.options.late;this.wakeClicks=[];
      if(!asleep)this.mind.debugSetAnger(0);
      this.sync();this.say(asleep?'sleep_wake':'sleep_enter');
    }
    disturb(kind){
      if(this.view.sleeping||this.options.blocked||this.options.activityOverride==='screen')return false;
      this.input();this.mind.touch('drag');
      this.mind.anger=Math.min(this.rules.anger.max||120,this.mind.anger+(kind==='shake'?4:2));
      this.sync();this.say(kind==='shake'?'click_combo':'mood_unhappy',{gapSeconds:4});return true;
    }
    arrived() {
      if(this.view.roaming){const acts=['idle','idle','idle','sing','phone','impatient','sad','smash'];return acts[Math.floor(this.random()*acts.length)];}
      if(this.view.ambient==='sing')this.say('mood_sing',{ambient:true});
      return this.view.pose;
    }
    drain() {return this.events.splice(0);}
    persist() {return this.mind.persistPatch();}
  }
  return RoomBehavior;
});
