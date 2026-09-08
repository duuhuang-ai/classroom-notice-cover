export const USAGE_KEY='classroom-notice-cover.scene-usage.v1';
export function matchesUsage(count, filter) {
  return filter==='all' || (filter==='4+' ? count>=4 : count===Number(filter));
}
export function eligibleScenes(scenes, counts, filter) {
  return scenes.filter(s=>matchesUsage(counts[s.id]||0,filter));
}
export function assignScenes(pool, counts, length, random=Math.random) {
  if(!pool.length)return [];
  const result=[];let round=[];
  while(result.length<length){
    if(!round.length)round=pool.map(s=>({s,r:random()})).sort((a,b)=>(counts[a.s.id]||0)-(counts[b.s.id]||0)||a.r-b.r).map(x=>x.s);
    let index=round.findIndex(s=>s.id!==result.at(-1)?.id);
    if(index<0)index=0;
    result.push(round.splice(index,1)[0]);
  }
  return result;
}
export function validateRecord(record, ids) {
  if(!record||record.version!==1||!record.counts||typeof record.counts!=='object'||Array.isArray(record.counts))throw new Error('记录格式不正确');
  const counts={};
  for(const [id,n] of Object.entries(record.counts)){
    if(!Number.isSafeInteger(n)||n<0)throw new Error('使用次数必须是非负整数');
    if(ids.includes(id))counts[id]=n;
  }
  return counts;
}
export function mergeCounts(current, incoming){
  const merged={...current};
  for(const [id,n] of Object.entries(incoming))merged[id]=Math.max(merged[id]||0,n);
  return merged;
}
