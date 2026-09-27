const test=require('node:test');const assert=require('node:assert/strict');
const {SwipeGesture}=require('../docs/xhs/physics.js');
test('slow body drag releases without a fling',()=>{const g=new SwipeGesture();g.start(0,0,1,0);g.move(30,0,1,1000);assert.equal(g.end(40,0,1,2000).swipe,null);});
test('fast body swipe retains release velocity',()=>{const g=new SwipeGesture();g.start(0,0,1,0);g.move(25,0,1,20);assert.ok(g.end(60,0,1,50).swipe.vx>450);});
test('holding still after a fast move cancels fling momentum',()=>{const g=new SwipeGesture();g.start(0,0,1,0);g.move(60,0,1,30);assert.equal(g.end(60,0,1,200).swipe,null);});
test('short jitter remains a tap',()=>{const g=new SwipeGesture();g.start(0,0,1,0);assert.deepEqual(g.end(6,3,1,50),{moved:false,swipe:null});});
