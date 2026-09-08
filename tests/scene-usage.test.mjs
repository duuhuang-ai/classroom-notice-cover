import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesUsage,assignScenes,validateRecord,mergeCounts} from '../prototypes/scene-usage.mjs';
test('筛选互斥且覆盖非负次数',()=>{for(let i=0;i<10;i++)assert.equal(['0','1','2','3','4+'].filter(f=>matchesUsage(i,f)).length,1);});
test('优先低次数并避免轮次边界相邻重复',()=>{const scenes=[{id:'a'},{id:'b'},{id:'c'}];const assigned=assignScenes(scenes,{a:0,b:1,c:2},10,()=>0.5);assert.equal(assigned[0].id,'a');assigned.slice(1).forEach((s,i)=>assert.notEqual(s.id,assigned[i].id));assert.deepEqual(assignScenes([],{},3),[]);});
test('导入校验与幂等合并',()=>{assert.throws(()=>validateRecord({version:1,counts:{a:-1}},['a']));assert.throws(()=>validateRecord({version:1,counts:{a:1.5}},['a']));const incoming=validateRecord({version:1,counts:{a:3,b:7}},['a']);assert.deepEqual(incoming,{a:3});assert.deepEqual(mergeCounts(mergeCounts({a:1},incoming),incoming),{a:3});});
