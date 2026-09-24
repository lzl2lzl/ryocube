const test=require('node:test'),assert=require('node:assert/strict');
const {ShakeGate,MotionFilter,SwipeGesture,rotate,preferences}=require('../physics.js');
function shake(gate,from,to,strength=18,step=20,axis='x'){let result;for(let t=from;t<=to;t+=step){const a={x:0,y:0,z:0};a[axis]=Math.sin(t/100)*strength;result=gate.sample(a,t);}return result;}
test('hand tremor, walking-like motion, a single shove and braking do not lift the actor',()=>{
 for(const strength of [.1,.6,1.4]){const g=new ShakeGate();assert(!shake(g,0,15000,strength).active);}
 const g=new ShakeGate();for(let t=0;t<5000;t+=20)assert(!g.sample({x:t<250?25:t<500?-25:0,y:0,z:0},t).active);
 g.reset();for(let t=0;t<10000;t+=20)assert(!g.sample({x:20,y:0,z:0},t).active);
});
test('deliberate repeated reversals trigger before five seconds and build flight intensity',()=>{
 const g=new ShakeGate();assert(!shake(g,0,500,4).active);const first=shake(g,520,1300,4);assert(first.active);assert(first.level<.5);
 const later=shake(g,1320,4500,22);assert(later.active&&later.level>.8);assert(later.level<=1);
});
test('front-back shaking and different sampling rates use the same intent rule',()=>{
 const levels=[];for(const step of [10,20,50]){const result=shake(new ShakeGate(),0,3000,20,step,'z');assert(result.active);levels.push(result.level);}
 assert(Math.max(...levels)-Math.min(...levels)<.12);
});
test('quiet gaps and stopped sensors release shake instead of latching',()=>{
 const g=new ShakeGate();assert(shake(g,0,2200).active);for(let t=2220;t<2850;t+=20)g.sample({x:0,y:0,z:0},t);assert(!g.active);
 assert(!shake(g,2860,3300).active);assert(!g.sample({x:0,y:0,z:0},4400).active);assert.equal(g.energy,0);
});
test('starting grip is neutral, tilt follows lower edge and does not become acceleration',()=>{
 const f=new MotionFilter(),zero={x:0,y:0,z:0};for(let t=0;t<=600;t+=20)assert.equal(f.sample(zero,{x:0,y:8,z:5},t).tilt.y,0);
 let sample;for(let t=620;t<1600;t+=20)sample=f.sample(zero,{x:-6,y:8,z:5},t);
 assert(sample.tilt.x>.6);assert.deepEqual(sample.linear,zero);f.reset();assert.equal(f.sample(zero,{x:-6,y:8,z:5},2000).tilt.x,0);
});
test('acceleration-only, gravity-only and missing sensor fields remain usable',()=>{
 const f=new MotionFilter();assert.equal(f.sample(null,{x:null,y:null,z:null},0),null);
 assert(f.sample({x:12,y:0,z:-8},null,20).linear.x>0);f.reset();assert.deepEqual(f.sample(null,{x:0,y:0,z:9.8},0).linear,{x:0,y:0,z:0});
 assert(f.sample(null,{x:15,y:0,z:9.8},20).linear.x>0);
});
test('native-style acceleration objects expose coordinates through prototype getters',()=>{
 class Reading{constructor(x,y,z){this.values=[x,y,z];}get x(){return this.values[0];}get y(){return this.values[1];}get z(){return this.values[2];}}
 const filter=new MotionFilter(),zero=new Reading(0,0,0),gravity=new Reading(0,0,9.8);
 filter.sample(zero,gravity,0);const real=filter.sample(new Reading(14,0,-8),new Reading(14,0,1.8),20);
 assert(real.linear.x>0&&real.linear.z<0);assert(Object.values(real.linear).every(Number.isFinite));
 filter.reset();filter.sample(null,gravity,0);const fallback=filter.sample(null,new Reading(14,0,9.8),20);
 assert(fallback.linear.x>0);assert(Object.values(fallback.linear).every(Number.isFinite));
});
test('tap drift stays a tap, drag speed reflects release and a pause cancels fling momentum',()=>{
 const g=new SwipeGesture();g.start(100,100,1,0);assert.deepEqual(g.end(105,107,1,80),{moved:false,swipe:null});
 g.start(100,100,1,0);g.move(150,100,1,40);const fast=g.end(200,100,1,80).swipe;assert(fast.vx>1000&&fast.x===100);
 g.start(100,100,1,0);g.move(150,100,1,500);const held=g.end(150,100,1,750).swipe;assert.equal(held.vx,0);
 g.start(100,100,2,0);assert.equal(g.end(200,100,3,40),null);g.cancel();assert.equal(g.end(200,100,2,80),null);
});
test('physical swipe direction maps correctly into all room rotations',()=>{
 for(const angle of [0,90,180,270]){const room=rotate(80,0,-angle),screen=rotate(room.x,room.y,angle);assert(Math.abs(screen.x-80)<.001&&Math.abs(screen.y)<.001);}
 assert(Math.abs(rotate(0,-80,-90).x+80)<.001);
});
test('gravity starts off including old saved-on choices; dialogue preferences still migrate',()=>{
 assert.deepEqual(preferences({}),{gravity:false,autoDismiss:true});assert.equal(preferences({keepBubble:true}).autoDismiss,false);assert.equal(preferences({keepBubble:false}).autoDismiss,true);
 assert.equal(preferences({gravity:true}).gravity,false);assert.deepEqual(preferences({gravity:false,autoDismiss:true,keepBubble:true}),{gravity:false,autoDismiss:true});
});

test("small tilt responds in both axes without linear acceleration",()=>{const f=new MotionFilter(),zero={x:0,y:0,z:0};f.sample(zero,{x:0,y:9.8,z:0},0);let sample;for(let t=20;t<800;t+=20)sample=f.sample(zero,{x:-.6,y:9.76,z:.85},t);assert(sample.tilt.x>.15);assert(Math.abs(sample.tilt.y)>.2);assert.deepEqual(sample.linear,zero);});
