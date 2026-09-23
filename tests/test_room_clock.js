const assert=require('node:assert/strict'),test=require('node:test'),Clock=require('../clock.js');
test('single alarm rolls past times to tomorrow and fires only once',()=>{
  let now=new Date(2026,8,24,14,30).getTime();const c=new Clock(()=>now);
  assert.equal(c.setAlarm('14:20'),true);assert.equal(new Date(c.alarm.at).getDate(),25);
  now=c.alarm.at;assert.equal(c.tick()[0].mode,'alarm');assert.deepEqual(c.tick(),[]);assert.equal(c.alarm,null);
});
test('loop alternates focus/rest and catches up suspended time with one current event',()=>{
  let now=0;const c=new Clock(()=>now);c.startLoop(25,5);assert.equal(c.loopView().phase,'focus');
  now=25*60000;assert.equal(c.tick()[0].text,'该休息了');
  now=30*60000;assert.equal(c.tick()[0].text,'该专注了');
  now=89*60000;assert.equal(c.tick().length,1);assert.equal(c.loopView().phase,'rest');assert.equal(c.loopView().round,3);assert.equal(c.loopView().remaining,60000);
});
test('paused loops exclude the paused duration',()=>{
  let now=0;const c=new Clock(()=>now);c.startLoop(2,1);now=30000;c.toggleLoop();now=90000;
  assert.equal(c.loopView().remaining,90000);c.toggleLoop();now=120000;assert.equal(c.loopView().remaining,60000);
});
test('stopwatch starts, pauses, resumes and resets without records',()=>{
  let now=0;const c=new Clock(()=>now);c.toggleWatch();now=65000;assert.equal(c.watchValue(),65000);
  c.toggleWatch();now=100000;assert.equal(c.watchValue(),65000);c.toggleWatch();now=110000;assert.equal(c.watchValue(),75000);
  c.resetWatch();assert.equal(c.watchValue(),0);assert.equal(c.watch.started,null);
});
test('a new page starts with no alarms, loops or stopwatch state',()=>{
  const old=new Clock();old.setAlarm('23:59');old.startLoop(25,5);old.toggleWatch();const next=new Clock();
  assert.equal(next.active,false);assert.equal(next.alarm,null);assert.equal(next.loop,null);assert.equal(next.watchValue(),0);
});
test('invalid durations and times are rejected',()=>{
  const c=new Clock();assert.equal(c.setAlarm('27:00'),false);assert.equal(c.startLoop(0,5),false);assert.equal(c.startLoop(1.5,5),false);assert.equal(c.startLoop(25,181),false);
});
