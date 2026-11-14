import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
}});
const { GameSimulation } = await import('../src/game/simulation/GameSimulation.ts');
const { createMissionConfig } = await import('../src/game/content/progression.ts');
const { MISSION_POINTS: points, STATIC_OBSTACLES, DOOR_OBSTACLE } = await import('../src/game/content/mission.ts');
const sim = new GameSimulation(createMissionConfig('ghost-signal', 'breach-rig'));
const s = sim.getSnapshot();
const idle = { moveX: 0, moveY: 0, sprint: false, interactHeld: false, interactPressed: false, scanPressed: false, firePressed: false, pausePressed: false, intelPressed: false };
let frames = 0;
const step = (input = {}) => { sim.update(1 / 60, { ...idle, ...input }); frames++; assert.notEqual(s.phase, 'failed', `died at ${s.objective}`); };
const dist = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
function walk(target, radius = 0.3) {
  const obstacles = s.doorOpen ? STATIC_OBSTACLES : [...STATIC_OBSTACLES, DOOR_OBSTACLE];
  const blocked = (x,z) => x < -17 || x > 17 || z < -15 || z > 15 || obstacles.some(o => {
    const dx = Math.max(Math.abs(x-o.x)-o.halfWidth,0), dz = Math.max(Math.abs(z-o.z)-o.halfDepth,0);
    return Math.hypot(dx,dz) < 0.65;
  });
  const start = [Math.round(s.player.position.x*2), Math.round(s.player.position.z*2)];
  const queue = [start], previous = new Map([[start.join(','), null]]);
  let end;
  for(let i=0;i<queue.length;i++) {
    const node=queue[i];
    if(dist({x:node[0]/2,z:node[1]/2},target)<Math.max(radius,0.4)) { end=node; break; }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n=[node[0]+dx,node[1]+dz], key=n.join(',');
      if(!previous.has(key)&&!blocked(n[0]/2,n[1]/2)) { previous.set(key,node); queue.push(n); }
    }
  }
  assert.ok(end, `no route to ${JSON.stringify(target)}`);
  const route=[];
  for(let n=end;n;n=previous.get(n.join(','))) route.push({x:n[0]/2,z:n[1]/2});
  for(const p of route.reverse()) {
    let ticks=0;
    while(dist(s.player.position,p)>0.13) {
      assert.ok(ticks++<60, `stuck at ${JSON.stringify(s.player.position)} to ${JSON.stringify(p)}`);
      const dx=p.x-s.player.position.x,dz=p.z-s.player.position.z;
      step({moveX:Math.abs(dx)>0.07?Math.sign(dx):0,moveY:Math.abs(dz)>0.07?-Math.sign(dz):0});
    }
  }
}
function holdUntil(done, input, max = 300) {
  for(let i=0;i<max&&!done();i++) step(input);
  assert.ok(done(), `objective stalled at ${s.objective}`);
}
sim.startMission();
walk(points.deployPad, 1.7);
holdUntil(()=>s.insertionComplete,{interactHeld:true});
walk(points.surveyPoint,1.8);
holdUntil(()=>s.scanComplete,{scanPressed:true});
walk(points.terminal,1.5);
holdUntil(()=>s.hackComplete,{interactHeld:true});
walk(points.core,1.5);
holdUntil(()=>s.coreCollected,{interactHeld:true});
console.log('core secured through real movement',frames,s.player.health);
for(let i=0;i<6000&&!s.combatComplete;i++) {
  const drone=s.guards.find(g=>g.id==='relay-drone');
  const target=!s.turret.destroyed?s.turret.position:!drone.down?drone.position:null;
  if(!target) break;
  const dx=target.x-s.player.position.x,dz=target.z-s.player.position.z;
  step({moveX:Math.abs(dx)>0.2?Math.sign(dx):0,moveY:Math.abs(dz)>0.2?-Math.sign(dz):0,firePressed:true});
}
assert.ok(s.combatComplete,'combat must finish');
walk(points.extraction,1.6);
holdUntil(()=>s.phase==='complete',{interactHeld:true});
console.log('mission complete', { frames, health:s.player.health, stats:s.stats });

