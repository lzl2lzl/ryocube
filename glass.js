(() => {
  'use strict';
  const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  // A short four-hit performance: raised arm -> contact -> recoil. Only the
  // local glass patch grows; no room-sized shake, flashing light or new sound.
  class RoomGlass {
    constructor(data,onDone){
      this.data=data;this.onDone=onDone;this.busy=false;this.desired=false;this.stage=0;this.generation=0;this.nextBurstAt=0;this.timers=new Set();this.animations=[];
      this.layer=$('glass-cracks');this.character=$('character');
      this.limbs=document.createElement('span');this.limbs.className='smash-limbs';this.limbs.setAttribute('aria-hidden','true');
      for(const side of ['left','right']){const limb=document.createElement('span');limb.className=`smash-arm smash-${side}`;const img=document.createElement('img');img.src=data.sprites.human_angry_1;img.alt='';img.draggable=false;const paw=document.createElement('span');paw.className='smash-fox-paw';const contact=document.createElement('i');contact.className='smash-contact';limb.append(img,paw,contact);this.limbs.append(limb);this[side]=limb;}
      this.character.append(this.limbs);this.layer.dataset.stage='0';
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();this.paintHealing();});
    }
    later(fn,ms){const token=this.generation,id=setTimeout(()=>{this.timers.delete(id);if(token===this.generation)fn();},ms);this.timers.add(id);return id;}
    sync({active,fox,reduce}){
      const form=fox?'fox':'human';if(this.form&&this.form!==form)this.stop();this.form=form;this.reduce=reduce;this.character.dataset.smashForm=form;this.desired=active&&!document.hidden;
      if(!this.desired){this.stop();return;}
      if(!this.busy&&!this.nextTimer){const wait=Math.max(0,this.nextBurstAt-Date.now());if(wait)this.nextTimer=this.later(()=>{this.nextTimer=null;if(this.desired)this.start();},wait);else this.start();}
    }
    start(){
      if(!this.desired||document.hidden)return;this.busy=true;this.hitCount=0;this.character.classList.add('is-smashing');this.layer.dataset.smashing='true';
      clearInterval(this.healTimer);this.healAt=null;if(!this.stage)this.makePatch();this.strike();
    }
    strike(){
      if(!this.busy)return;this.cancelMotion();const right=this.right,left=this.left,duration=1100;
      const travel=this.reduce?-.8:-2.2,scale=this.reduce?1.01:1.035;
      this.animations.push(right.animate([
        {transform:'rotate(0deg)',offset:0},{transform:'rotate(-27deg)',offset:.28},
        {transform:'rotate(-132deg) scale(1.13)',offset:.52},{transform:'rotate(-132deg) scale(1.13)',offset:.60},{transform:'rotate(-118deg) scale(1.05)',offset:.70},{transform:'rotate(0deg)',offset:1}
      ],{duration,easing:'linear'}));
      if(!this.reduce){this.animations.push(left.animate([{transform:'rotate(0deg)'},{transform:'rotate(20deg)',offset:.52},{transform:'rotate(0deg)'}],{duration,easing:'linear'}));}
      this.animations.push(this.character.animate([{transform:'scale(1)'},{transform:`translateY(${travel}px) scale(${scale})`,offset:.52},{transform:'scale(1)'}],{duration,easing:'linear'}));
      // Keep the impact inside the contact hold; global easing would shift it.
      this.later(()=>this.impact(),590);
      this.later(()=>{this.hitCount++;if(this.hitCount<4)this.strike();else this.finish();},duration+180);
    }
    impact(){
      if(!this.busy||!this.desired||document.hidden)return;
      if(!this.stage){const hand=this.right.querySelector('.smash-contact').getBoundingClientRect(),tank=$('tank'),bounds=tank.getBoundingClientRect();const angle=Number($('room-viewport').dataset.rotation||0)*Math.PI/180,dx=hand.x+hand.width/2-(bounds.x+bounds.width/2),dy=hand.y+hand.height/2-(bounds.y+bounds.height/2);this.point={x:Math.max(.12,Math.min(.88,.5+(Math.cos(angle)*dx+Math.sin(angle)*dy)/tank.clientWidth)),y:Math.max(.15,Math.min(.88,.5+(-Math.sin(angle)*dx+Math.cos(angle)*dy)/tank.clientHeight))};this.layer.style.setProperty('--crack-x',`${this.point.x*100}%`);this.layer.style.setProperty('--crack-y',`${this.point.y*100}%`);}
      this.stage=Math.min(4,this.stage+1);this.paintStage(this.stage,false);
      this.layer.dataset.hits=String(Number(this.layer.dataset.hits||0)+1);
      this.patch.animate([{transform:'translate(-50%,-50%) scale(.97)'},{transform:'translate(-50%,-50%) scale(1.025)',offset:.35},{transform:'translate(-50%,-50%) scale(1)'}],{duration:this.reduce?1:170,easing:'ease-out'});
    }
    finish(){this.busy=false;this.cancelMotion();this.character.classList.remove('is-smashing');this.layer.dataset.smashing='false';this.nextBurstAt=Date.now()+18000+Math.random()*14000;this.beginHealing();this.onDone?.();if(this.desired)this.sync({active:true,fox:this.form==='fox',reduce:this.reduce});}
    stop(){
      const running=this.busy;this.desired=false;this.busy=false;this.generation++;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();this.nextTimer=null;this.cancelMotion();this.character.classList.remove('is-smashing');this.layer.dataset.smashing='false';
      if(running){this.nextBurstAt=Date.now()+18000+Math.random()*14000;this.beginHealing();}
      else if(this.stage&&!this.healAt)this.beginHealing();
    }
    cancelMotion(){for(const animation of this.animations)animation.cancel();this.animations=[];}
    beginHealing(){if(!this.stage||this.healAt)return;this.healFrom=this.stage;this.healAt=Date.now()+1600;clearInterval(this.healTimer);this.healTimer=setInterval(()=>this.paintHealing(),200);this.paintHealing();}
    paintHealing(){
      if(this.healAt==null)return;const elapsed=Date.now()-this.healAt;if(elapsed<0)return;
      const remaining=Math.max(0,this.healFrom-Math.floor(elapsed/(8000/this.healFrom)));
      if(!document.hidden)this.paintStage(remaining,true);
      if(elapsed>=8000){this.stage=0;this.healAt=null;clearInterval(this.healTimer);this.healTimer=null;this.paintStage(0,true);}
    }
    paintStage(stage,healing){this.stage=stage;this.layer.dataset.stage=String(stage);this.layer.classList.toggle('is-healing',healing);this.groups?.forEach((group,index)=>group.classList.toggle('is-visible',index<stage));}
    makePatch(){
      this.layer.replaceChildren();this.patch=document.createElementNS(NS,'svg');this.patch.setAttribute('viewBox','-120 -120 240 240');this.patch.classList.add('crack-patch');this.layer.append(this.patch);this.groups=[];
      const rays=[];for(let i=0;i<8;i++){const angle=i*Math.PI/4+(Math.random()-.5)*.3,length=55+Math.random()*50;const points=[[0,0]];for(let j=1;j<=4;j++){const radius=length*j/4,offset=(Math.random()-.5)*14;points.push([Math.cos(angle)*radius-Math.sin(angle)*offset,Math.sin(angle)*radius+Math.cos(angle)*offset]);}rays.push(points);}
      const pathString=points=>points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      for(let tier=1;tier<=4;tier++){
        const group=document.createElementNS(NS,'g');group.classList.add('crack-tier');this.groups.push(group);this.patch.append(group);
        for(let i=0;i<rays.length;i++){
          const points=rays[i],segment=[points[tier-1],points[tier]];this.addLine(group,pathString(segment));
          if(tier>=2){const p=points[tier-1],q=points[tier],sign=i%2?1:-1;this.addLine(group,pathString([p,[p[0]+(q[0]-p[0])*.45-sign*(q[1]-p[1])*.38,p[1]+(q[1]-p[1])*.45+sign*(q[0]-p[0])*.38]]));}
          if(tier===3&&i%2===0)this.addLine(group,pathString([points[2],[(points[2][0]+rays[(i+1)%8][2][0])*.42,(points[2][1]+rays[(i+1)%8][2][1])*.42],rays[(i+1)%8][2]]));
        }
        if(tier===1){const chip=document.createElementNS(NS,'path');chip.setAttribute('d','M-5 -2 1 -7 7 -1 3 6 -4 5Z');chip.classList.add('crack-chip');group.append(chip);}
      }
    }
    addLine(group,d){for(const cls of ['crack-shadow','crack-light']){const path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.setAttribute('pathLength','1');path.classList.add(cls);group.append(path);}}
  }
  window.RoomGlass=RoomGlass;
})();
