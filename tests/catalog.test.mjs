import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {sceneCatalog} from '../data/all-scenes.mjs';
import {assignScenes} from '../prototypes/scene-usage.mjs';
test('完整清单覆盖每张背景，四角有效，一轮分配无遗漏',async()=>{
 const files=(await readdir(new URL('../assets/scenes/',import.meta.url))).filter(f=>/^scene-\d+\.png$/.test(f));
 assert.equal(new Set(sceneCatalog.map(s=>s.id)).size,83);
 assert.deepEqual(sceneCatalog.map(s=>`${s.id}.png`).sort(),files.sort());
 for(const s of sceneCatalog){assert.equal(s.corners.length,4);for(const p of s.corners)assert.ok(p.length===2&&p.every(n=>Number.isFinite(n)&&n>0&&n<1),s.id);}
 assert.equal(new Set(assignScenes(sceneCatalog,{},83).map(s=>s.id)).size,83);
 for(const v of ['02','03']){
  const html=await readFile(new URL(`../prototypes/prototype-v${v}.html`,import.meta.url),'utf8');
  assert.ok(html.includes("import { sceneCatalog } from '../data/all-scenes.mjs'"));
 }
});
