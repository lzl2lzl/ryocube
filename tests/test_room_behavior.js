const assert = require('node:assert/strict');
const test = require('node:test');
const RoomBehavior = require('../behavior.js');
const fs = require('node:fs'), path = require('node:path');
const raw = fs.readFileSync(path.join(__dirname, '../assets.js'), 'utf8').trim();
const bundled = JSON.parse(raw.slice('window.YUE_DATA = '.length, -1));
const original = structuredClone(bundled.config);
// Preserve the original activity pool for legacy rule checks; the smash test
// below separately exercises the full room-specific configuration.
original.behavior.moodPool.activities = original.behavior.moodPool.activities.filter(item => item.key !== 'smash');
const lines = bundled.dialogue;
function fixture(hour=10,minute=0,random=()=>0.1,config=structuredClone(original)) {
  let time=new Date(2026,8,24,hour,minute).getTime();
  const behavior=new RoomBehavior({config,dialogue:{...lines,mood_unhappy:['不要以为把我抓到这个小框框里就可以怎样！']},now:()=>time,random});
  const at=(h,m=0)=>{time=new Date(2026,8,24,h,m).getTime();behavior.input();return behavior.sync();};
  behavior.sync();
  return {behavior,at,advance(ms){time+=ms;return behavior.sync();}};
}
test('original lunch boundaries override mood, anger and page inactivity',()=>{
  const f=fixture();assert.notEqual(f.at(11,29).key,'cook');assert.equal(f.at(11,30).key,'cook');
  f.behavior.mind.debugSetAnger(100);assert.equal(f.at(12,59).key,'cook');
  assert.equal(f.at(13).key,'eat');assert.equal(f.advance(11*60000).key,'eat');
  assert.equal(f.at(13,59).key,'eat');assert.notEqual(f.at(14).key,'eat');
});
test('wine becomes eligible at 19:00 and all original weights are respected',()=>{
  const f=fixture(18,59);assert.ok(!f.behavior.candidates().some(a=>a.key==='wine'));
  f.at(19);assert.ok(f.behavior.candidates().some(a=>a.key==='wine'));
  assert.equal(f.behavior.candidates().length,8);
  f.behavior.rules.moodPool.activities.forEach(a=>a.weight=a.key==='wine'?10:0);
  assert.equal(f.behavior.pickMood(),'wine');
});
test('mood changes at ten minutes, singing draws its stroll chance once',()=>{
  let value=0.01;const f=fixture(10,0,()=>value);assert.equal(f.behavior.mood,'screen');
  value=0.65;f.advance(599999);assert.equal(f.behavior.mood,'screen');
  f.advance(1);assert.equal(f.behavior.mood,'sing');assert.equal(f.behavior.singStroll,false);
  value=0;f.advance(2000);assert.equal(f.behavior.singStroll,false);
});
test('idle window enters roaming and returns on input; meals remain intact',()=>{
  const f=fixture(15);assert.notEqual(f.behavior.view.key,'roam');
  assert.equal(f.advance(600000).key,'roam');assert.equal(f.behavior.view.autoFox,true);
  f.behavior.input();assert.notEqual(f.behavior.sync().key,'roam');assert.equal(f.behavior.view.autoFox,false);
});
test('gentle activity clicks do not anger him; empty activities use original ladder',()=>{
  const f=fixture();assert.equal(f.behavior.poke().action,'speak');assert.equal(f.behavior.mind.anger,0);
  f.behavior.mood='phone';f.behavior.sync();f.advance(4000);
  for(let n=0;n<5;n++)assert.equal(f.behavior.poke().action,'dodge');
  assert.equal(f.behavior.poke().pose,'angry');assert.equal(f.behavior.mind.comboCount(),6);
});
test('deep night sleeps, one tap lights, five quick taps wake, next night resets',()=>{
  const f=fixture(23);f.behavior.mind.debugSetAnger(40);
  assert.equal(f.behavior.sync({late:true}).sleeping,true);assert.equal(f.behavior.mind.anger,0);
  for(let i=0;i<4;i++)assert.equal(f.behavior.poke().action,'light');
  assert.equal(f.behavior.poke().action,'wake');assert.equal(f.behavior.view.sleeping,false);
  f.behavior.sync({late:false});assert.equal(f.behavior.sync({late:true}).sleeping,true);
});
test('ambient speech obeys probability gate, empty pools and thirty second spacing',()=>{
  const f=fixture();assert.equal(f.behavior.say('mood_phone',{ambient:true}),false);
  assert.equal(f.behavior.say('mood_unhappy',{ambient:true}),true);assert.equal(f.behavior.drain()[0].text,'不要以为把我抓到这个小框框里就可以怎样！');
  assert.equal(f.behavior.say('mood_screen',{ambient:true}),false);f.advance(30000);
  assert.equal(f.behavior.say('mood_screen',{ambient:true}),true);f.advance(30000);
  f.behavior.sync({mutter:false});assert.equal(f.behavior.say('mood_screen',{ambient:true}),false);
});
test('saved anger decays offline and five days selects reunion',()=>{
  const now=new Date(2026,8,24,15).getTime();
  const b=new RoomBehavior({config:original,dialogue:lines,now:()=>now,persisted:{anger:50,angerAt:now-180000,lastRunAt:now-6*86400000}});
  assert.equal(b.mind.anger,20);assert.equal(b.mind.entrance,'reunion');
});
test('sleep resets the presentation click ladder independently of Mind anger accounting',()=>{
  const f=fixture();f.behavior.mood='phone';f.behavior.sync();
  for(let i=0;i<12;i++)f.behavior.poke();
  assert.equal(f.behavior.clickTimes.length,12);
  f.behavior.toggleSleep();f.behavior.toggleSleep();
  assert.equal(f.behavior.clickTimes.length,0);
  f.advance(3100);f.behavior.poke();f.advance(100);
  assert.equal(f.behavior.poke().action,'dodge');
});
test('clock tasks hold screen or singing through sleep, meals and idle; ending restores schedule',()=>{
  const f=fixture(12);f.advance(120000);
  let view=f.behavior.sync({late:true,activityOverride:'screen',mutter:false});
  assert.equal(view.pose,'screen');assert.equal(view.sleeping,false);assert.equal(view.roaming,false);
  view=f.behavior.sync({activityOverride:'sing',mutter:true});assert.equal(view.pose,'sing');assert.equal(view.sleeping,false);assert.equal(view.roaming,false);
  view=f.behavior.sync({late:false,activityOverride:null});assert.equal(view.ambient,'cook');
  view=f.behavior.sync({late:true});assert.equal(view.sleeping,true);
});
test('room-only smash participates in the weighted pool and roaming rests without overriding priorities',()=>{
  const fs=require('node:fs'),path=require('node:path'),raw=fs.readFileSync(path.join(__dirname,'../assets.js'),'utf8').trim();
  const data=JSON.parse(raw.slice('window.YUE_DATA = '.length,-1));
  const f=fixture(15,0,()=>.999,structuredClone(data.config));
  assert.equal(f.behavior.candidates().find(a=>a.key==='smash').weight,1);assert.equal(f.behavior.mood,'smash');assert.equal(f.behavior.view.key,'smash');
  assert.equal(f.behavior.sync({activityOverride:'screen'}).key,'screen');assert.equal(f.behavior.sync({activityOverride:'sing'}).key,'sing');
  assert.equal(f.behavior.sync({activityOverride:null,late:true}).key,'sleep');f.behavior.sync({late:false});
  assert.equal(f.at(12).key,'cook');f.at(15);f.advance(600000);assert.equal(f.behavior.view.roaming,true);assert.equal(f.behavior.arrived(),'smash');
  assert.equal(original.behavior.moodPool.activities.some(a=>a.key==='smash'),false);
});
test('swipes and shaking add anger without counting as taps or rerolling activities',()=>{
  const f=fixture(15);f.behavior.sync();const pickedAt=f.behavior.moodAt,mood=f.behavior.mood;
  assert.equal(f.behavior.disturb('swipe'),true);assert(f.behavior.mind.anger>0);assert.equal(f.behavior.clickTimes.length,0);
  assert.equal(f.behavior.moodAt,pickedAt);assert.equal(f.behavior.mood,mood);
  f.behavior.sync({activityOverride:'screen'});const anger=f.behavior.mind.anger;assert.equal(f.behavior.disturb('shake'),false);assert.equal(f.behavior.mind.anger,anger);
  f.behavior.sync({activityOverride:null,late:true});assert.equal(f.behavior.disturb('swipe'),false);assert.equal(f.behavior.view.sleeping,true);
});
