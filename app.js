(() => {
  'use strict';
  const $=id=>document.getElementById(id),storageKey='yue-window-room-v2';
  let saved={},canSave=true;
  try{saved=JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem('yue-safari-companion-v1')||'{}')||{};}catch{canSave=false;}
  const state={fox:saved.fox===true,...RoomPhysics.preferences(saved),
    theme:['auto','day','night','late'].includes(saved.theme)?saved.theme:'auto',weather:['auto','clear','rain','fog'].includes(saved.weather)?saved.weather:'auto',
    rotation:Number.isInteger(saved.rotation)?((saved.rotation%4)+4)%4:0,
    fontSize:typeof saved.fontSize==='number'&&Number.isFinite(saved.fontSize)?Math.max(12,Math.min(24,Math.round(saved.fontSize))):16,reaction:false,reactionPose:'angry'};
  let bubbleTimeout,reactionTimeout,longPressTimeout,resumeTimer,previousFocus,alarmFocus,currentSheet=null,longPressed=false,pausedUntil=0,knocks=[],focusLocked=false,clock,interaction;
  const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)'),data=window.YUE_DATA;
  const behavior=new RoomBehavior({config:data.config,dialogue:data.dialogue,persisted:saved.mind||{},idleMinutes:1});
  const room=new RoomMotion(data,()=>{const pose=behavior.arrived();flushSpeech();return pose;});
  interaction=new RoomInteraction(room,{canTap:()=>!focusLocked&&!currentSheet&&$('companion-menu').hidden&&$('alarm-overlay').hidden,
    canInteract:()=>!focusLocked&&!currentSheet&&$('companion-menu').hidden&&$('alarm-overlay').hidden&&!behavior.view?.sleeping,
    onTap:()=>{if(!longPressed)knock();longPressed=false;},onGestureMove:()=>{clearTimeout(longPressTimeout);},onDisturb:kind=>{if(behavior.disturb(kind)){updateActivity();persist();}}});
  clock=new RoomClockUI({onRing:text=>{room.glance();if($('alarm-overlay').hidden)alarmFocus=document.activeElement;$('alarm-heading').textContent=text;$('companion').inert=true;$('alarm-overlay').hidden=false;document.body.classList.add('alarm-open');updateActivity();$('alarm-overlay').focus();},onStart:()=>closeSheet(),onChange:()=>{if(clock)updateActivity();},onDismiss:()=>{$('alarm-overlay').hidden=true;$('companion').inert=false;document.body.classList.remove('alarm-open');updateActivity();if(alarmFocus?.isConnected&&alarmFocus.getClientRects().length&&!alarmFocus.disabled&&!alarmFocus.closest('[inert],[hidden]'))alarmFocus.focus();else if(currentSheet)$('sheet').focus();else $('open-timer').focus();}});

  function persist(){
    try{const{fox,autoDismiss,theme,weather,rotation,fontSize}=state;
      // Clock state is deliberately absent: refresh always starts with empty clocks.
      localStorage.setItem(storageKey,JSON.stringify({fox,autoDismiss,theme,weather,rotation,fontSize,mind:behavior.persist()}));
    }catch{canSave=false;}$('storage-note').hidden=canSave;
  }
  function updateActivity(){
    const loop=clock?.model.loopView(),task=loop&&!loop.paused?(loop.phase==='focus'?'screen':'sing'):null,locked=task==='screen';
    if(locked&&!focusLocked){
      clearTimeout(reactionTimeout);clearTimeout(longPressTimeout);clearTimeout(resumeTimer);clearTimeout(bubbleTimeout);
      state.reaction=false;longPressed=false;pausedUntil=0;knocks=[];$('bubble').textContent='';behavior.drain();
      $('companion-menu').hidden=true;$('menu-backdrop').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false');
      if(currentSheet==='preferences'){currentSheet=null;$('sheet-overlay').hidden=true;$('app-content').inert=false;document.body.classList.remove('sheet-open');}
      if($('alarm-overlay').hidden&&!currentSheet)$('open-timer').focus();
    }
    focusLocked=locked;$('companion').classList.toggle('focus-active',locked);$('tank').inert=locked;$('rotate-view').disabled=locked;$('menu-toggle').disabled=locked;
    const blocked=!!currentSheet||!$('companion-menu').hidden||!$('alarm-overlay').hidden,paused=Date.now()<pausedUntil;
    const late=(state.theme==='auto'?RoomMotion.periodFor(new Date()):state.theme)==='late';
    const view=behavior.sync({late,autoSleep:true,blocked,paused,mutter:!locked,activityOverride:task});
    interaction?.setContext({enabled:state.gravity,blocked:blocked||locked||view.sleeping,angle:state.rotation*90,reduce:prefersReduced.matches});
    room.setOptions({fox:state.fox||view.autoFox,paused,reduce:prefersReduced.matches,blocked,reaction:state.reaction,
      reactionPose:state.reactionPose,mode:state.theme,weather:state.weather,sleeping:view.sleeping,pose:view.pose,movement:view.movement,activity:view.key,singStroll:view.singStroll,taskActivity:task});
    $('sleep-toggle').textContent=view.sleeping?'唤醒他':'哄他睡觉';flushSpeech();
  }
  function rotateLayout(){
    const app=$('app-content'),css=getComputedStyle(app),left=parseFloat(css.paddingLeft),right=parseFloat(css.paddingRight),top=parseFloat(css.paddingTop),bottom=parseFloat(css.paddingBottom);
    const width=app.clientWidth-left-right,height=app.clientHeight-top-bottom,odd=state.rotation%2;
    const viewport=$('room-viewport');viewport.style.width=`${odd?height:width}px`;viewport.style.height=`${odd?width:height}px`;
    viewport.style.left=`${left+width/2}px`;viewport.style.top=`${top+height/2}px`;viewport.style.setProperty('--room-angle',`${state.rotation*90}deg`);
    viewport.dataset.rotation=String(state.rotation*90);
    const panels=$('panels-viewport'),panelWidth=odd?app.clientHeight:app.clientWidth,panelHeight=odd?app.clientWidth:app.clientHeight;
    panels.style.width=`${panelWidth}px`;panels.style.height=`${panelHeight}px`;panels.style.setProperty('--room-angle',`${state.rotation*90}deg`);
    panels.style.setProperty('--panel-width',`${panelWidth}px`);panels.style.setProperty('--panel-height',`${panelHeight}px`);
    panels.classList.toggle('is-short',panelHeight<=400);panels.dataset.rotation=String(state.rotation*90);
    const card=$('alarm-card');card.style.width=`${panelWidth}px`;card.style.height=`${panelHeight}px`;card.style.setProperty('--room-angle',`${state.rotation*90}deg`);card.classList.toggle('is-landscape',panelWidth>panelHeight);
  }
  function renderSettings(){
    $('switch-form').textContent=state.fox?'变回人形':'变成狐狸';$('appearance').value=state.theme;$('weather').value=state.weather;
    $('auto-dismiss').checked=state.autoDismiss;$('gravity-enabled').checked=state.gravity;
    $('character').setAttribute('aria-label',`${state.fox?'狐狸形态的角色':'框里的角色'}，点按敲窗，长按设置`);
    renderFontSize();rotateLayout();updateActivity();persist();
  }
  function renderFontSize(){
    document.documentElement.style.setProperty('--dialogue-font-size',`${state.fontSize}px`);
    $('font-size').value=String(state.fontSize);$('font-size-value').textContent=String(state.fontSize);
    $('font-size').style.setProperty('--range-fill',`${(state.fontSize-12)/12*100}%`);
    $('font-size').setAttribute('aria-valuetext',`${state.fontSize}号`);
  }
  function updateBubbleOverflow(){
    const bubble=$('bubble'),scrollable=bubble.scrollHeight>bubble.clientHeight+1;
    bubble.classList.toggle('is-scrollable',scrollable);bubble.tabIndex=scrollable?0:-1;
  }
  function scheduleBubbleDismiss(){clearTimeout(bubbleTimeout);if(state.autoDismiss)bubbleTimeout=setTimeout(()=>{$('bubble').textContent='';},Math.min(14000,Math.max(5000,$('bubble').textContent.length*250)));}
  function showText(text){if(focusLocked)return;$('bubble').textContent=text;$('bubble').scrollTop=0;updateBubbleOverflow();scheduleBubbleDismiss();}
  function flushSpeech(){for(const event of behavior.drain())if(event.type==='speech')showText(event.text);}
  function reactWith(pose){clearTimeout(reactionTimeout);state.reaction=true;state.reactionPose=pose;updateActivity();reactionTimeout=setTimeout(()=>{state.reaction=false;updateActivity();},data.config.reactionMs);}
  function closeMenu(restore=false){$('companion-menu').hidden=true;$('menu-backdrop').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false');updateActivity();if(restore)$('menu-toggle').focus({preventScroll:true});}
  function openMenu(){if(currentSheet||focusLocked)return;$('companion-menu').hidden=false;$('menu-backdrop').hidden=false;$('menu-toggle').setAttribute('aria-expanded','true');updateActivity();$('switch-form').focus({preventScroll:true});}
  new RoomDisplay({button:$('toggle-fullscreen'),installLink:$('install-app'),status:$('display-status'),onChange:()=>{closeMenu(true);interaction.reset();rotateLayout();requestAnimationFrame(rotateLayout);}});
  function openSheet(kind){
    if(focusLocked&&kind!=='timer')return;
    closeMenu();previousFocus=document.activeElement;currentSheet=kind;
    $('clock-content').hidden=kind!=='timer';$('preferences-content').hidden=kind!=='preferences';
    $('sheet-title').textContent=kind==='timer'?'闹钟与计时器':'房间设置';
    $('sheet-overlay').hidden=false;$('app-content').inert=true;document.body.classList.add('sheet-open');updateActivity();clock.render();$('sheet').focus();
  }
  function closeSheet(){
    if(currentSheet==='timer')clock.silence();$('sheet-overlay').hidden=true;$('app-content').inert=false;document.body.classList.remove('sheet-open');currentSheet=null;updateActivity();
    if(previousFocus&&!previousFocus.disabled&&!previousFocus.closest('[hidden],[inert]'))previousFocus.focus();else $('open-timer').focus();
  }
  function knock(){
    if(focusLocked)return;
    recordInput();
    const now=Date.now();knocks=knocks.filter(at=>now-at<3000);knocks.push(now);
    if(knocks.length>=3){pausedUntil=now+60000;knocks=[];}
    else if(pausedUntil>now)pausedUntil=now+60000;
    clearTimeout(resumeTimer);if(pausedUntil>now)resumeTimer=setTimeout(()=>{pausedUntil=0;updateActivity();},pausedUntil-now);
    room.glance();const result=behavior.poke();updateActivity();
    if(result.action==='light'){clearTimeout(bubbleTimeout);$('bubble').textContent='';}
    if(result.action==='dodge')room.dodge();if(result.pose)reactWith(result.pose);persist();
  }
  function recordInput(){if(focusLocked)return;behavior.input();if(pausedUntil>Date.now()){pausedUntil=Date.now()+60000;clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{pausedUntil=0;updateActivity();},60000);}}
  $('tank').addEventListener('click',event=>{if(!interaction.consumesClick(event)&&!longPressed)knock();longPressed=false;});
  $('tank').addEventListener('keydown',event=>{if(event.target===$('tank')&&['Enter',' '].includes(event.key)){event.preventDefault();knock();}});
  $('character').addEventListener('contextmenu',event=>{event.preventDefault();openMenu();});
  $('character').addEventListener('pointerdown',event=>{if(event.button!==0||focusLocked)return;longPressed=false;longPressTimeout=setTimeout(()=>{longPressed=true;openMenu();},600);});
  ['pointerup','pointercancel','pointerleave'].forEach(name=>$('character').addEventListener(name,()=>clearTimeout(longPressTimeout)));
  $('menu-toggle').addEventListener('click',()=>$('companion-menu').hidden?openMenu():closeMenu(true));
  $('menu-backdrop').addEventListener('click',()=>closeMenu(true));
  $('rotate-view').addEventListener('click',()=>{if(focusLocked)return;state.rotation=(state.rotation+1)%4;interaction.reset();rotateLayout();updateActivity();persist();});
  new ResizeObserver(rotateLayout).observe($('app-content'));
  $('switch-form').addEventListener('click',()=>{state.fox=!state.fox;closeMenu(true);renderSettings();});
  $('sleep-toggle').addEventListener('click',()=>{closeMenu(true);behavior.toggleSleep();state.reaction=false;renderSettings();});
  $('open-guide').addEventListener('click',()=>closeMenu());$('install-app').addEventListener('click',()=>closeMenu());$('open-settings').addEventListener('click',()=>openSheet('preferences'));
  $('open-timer').addEventListener('click',()=>openSheet('timer'));$('close-sheet').addEventListener('click',closeSheet);
  document.querySelector('.sheet-backdrop').addEventListener('click',closeSheet);
  $('appearance').addEventListener('change',()=>{state.theme=$('appearance').value;renderSettings();});
  $('weather').addEventListener('change',()=>{state.weather=$('weather').value;renderSettings();});
  $('auto-dismiss').addEventListener('change',()=>{state.autoDismiss=$('auto-dismiss').checked;scheduleBubbleDismiss();persist();});
  $('font-size').addEventListener('input',()=>{state.fontSize=Number($('font-size').value);renderFontSize();updateBubbleOverflow();persist();});
  let fontDrag=null;
  function dragFontSize(event){
    const input=$('font-size'),bounds=input.getBoundingClientRect();
    const point=RoomPhysics.rotate(event.clientX-bounds.x-bounds.width/2,event.clientY-bounds.y-bounds.height/2,-state.rotation*90);
    const ratio=(point.x+input.clientWidth/2-13)/Math.max(1,input.clientWidth-26);
    const value=Math.round(12+Math.max(0,Math.min(1,ratio))*12);
    if(Number(input.value)!==value){input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}
    event.preventDefault();
  }
  $('font-size').addEventListener('pointerdown',event=>{if(event.button!==0||fontDrag!==null)return;fontDrag=event.pointerId;$('font-size').focus({preventScroll:true});$('font-size').setPointerCapture(event.pointerId);dragFontSize(event);});
  $('font-size').addEventListener('pointermove',event=>{if(fontDrag===event.pointerId)dragFontSize(event);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('font-size').addEventListener(name,event=>{if(fontDrag===event.pointerId)fontDrag=null;}));
  new ResizeObserver(updateBubbleOverflow).observe($('bubble'));
  ['pointerdown','pointermove','pointerup','pointercancel','click','keydown'].forEach(name=>$('bubble').addEventListener(name,event=>{if($('bubble').classList.contains('is-scrollable'))event.stopPropagation();}));
  let bubbleDrag=null;
  $('bubble').addEventListener('pointerdown',event=>{
    if(!$('bubble').classList.contains('is-scrollable')||event.button!==0||bubbleDrag)return;
    bubbleDrag={id:event.pointerId,x:event.clientX,y:event.clientY,top:$('bubble').scrollTop};
    $('bubble').setPointerCapture(event.pointerId);clearTimeout(bubbleTimeout);
  });
  $('bubble').addEventListener('pointermove',event=>{
    if(bubbleDrag?.id!==event.pointerId)return;
    const delta=RoomPhysics.rotate(event.clientX-bubbleDrag.x,event.clientY-bubbleDrag.y,-state.rotation*90);
    $('bubble').scrollTop=bubbleDrag.top-delta.y;event.preventDefault();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('bubble').addEventListener(name,event=>{if(bubbleDrag?.id===event.pointerId){bubbleDrag=null;scheduleBubbleDismiss();}}));
  $('gravity-enabled').addEventListener('change',async()=>{
    const toggle=$('gravity-enabled');
    if(!toggle.checked){state.gravity=false;updateActivity();persist();return;}
    toggle.disabled=true;
    state.gravity=await interaction.requestAccess();toggle.checked=state.gravity;toggle.disabled=false;
    updateActivity();persist();
  });
  prefersReduced.addEventListener('change',updateActivity);
  document.addEventListener('visibilitychange',()=>{updateActivity();persist();});window.addEventListener('pagehide',persist);
  let lastPointerInput=0;
  document.addEventListener('pointermove',()=>{if(Date.now()-lastPointerInput>1000){recordInput();lastPointerInput=Date.now();}},{passive:true});
  document.documentElement.dataset.input='pointer';
  document.addEventListener('pointerdown',()=>{document.documentElement.dataset.input='pointer';recordInput();},true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Tab')document.documentElement.dataset.input='keyboard';
    recordInput();if(!$('alarm-overlay').hidden)return;if(event.key==='Escape'){if(currentSheet)closeSheet();else closeMenu(true);}
    if(event.key==='Tab'&&currentSheet){
      const items=[...$('sheet').querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled&&el.tabIndex!==-1),first=items[0],last=items.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('sheet'))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  Object.values(data.sprites).forEach(src=>{const image=new Image();image.src=src;});
  renderSettings();if(!$('bubble').textContent){behavior.entrance();flushSpeech();}
  setInterval(()=>{if(!document.hidden)updateActivity();},data.config.behavior.sampleSeconds*1000);setInterval(persist,60000);
})();
