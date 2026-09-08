"""Import this approved 23-image batch without overwriting existing assets."""
from pathlib import Path
import json, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
source=Path('/Users/tina/.codex/generated_images/01a080f7-75c1-7d10-9eb5-1e83a0fb4713')
files=sorted(source.glob('*.png'),key=lambda p:(p.stat().st_mtime,p.name))
assert len(files)==23
catalog=[]
existing={hashlib.sha256(p.read_bytes()).hexdigest():p for p in (root/"assets/scenes").glob("scene-*.png")}
next_id=max(int(p.stem.split("-")[-1]) for p in existing.values())+1
sheet=Image.new('RGB',(1200,1725),'#ddd');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(files,61):
 im=Image.open(f).convert('RGB');a=np.asarray(im);h,w=a.shape[:2];dark=a.min(axis=2)<140
 top=[];bottom=[]
 for x in range(int(w*.25),int(w*.75),4):
  y=int(h*.45)
  assert not dark[y,x]
  u=y
  while u>0 and not dark[u,x]:u-=1
  b=y
  while b<h-1 and not dark[b,x]:b+=1
  top.append((x,u+3));bottom.append((x,b-3))
 t=np.polyfit(*zip(*top),1);b=np.polyfit(*zip(*bottom),1)
 left=[];right=[]
 for y in range(int(max(np.polyval(t,0),np.polyval(t,w)))+20,int(min(np.polyval(b,0),np.polyval(b,w)))-20,4):
  x=w//2;l=x;r=x
  while l>0 and not dark[y,l]:l-=1
  while r<w-1 and not dark[y,r]:r+=1
  left.append((y,l+3));right.append((y,r-3))
 l=np.polyfit(*zip(*left),1);r=np.polyfit(*zip(*right),1)
 def cross(edge,side):
  x=(side[0]*edge[1]+side[1])/(1-side[0]*edge[0]);return [round(x,1),round(np.polyval(edge,x),1)]
 corners=[cross(t,l),cross(t,r),cross(b,r),cross(b,l)]
 dest=existing.get(hashlib.sha256(f.read_bytes()).hexdigest())
 if dest is None:
  dest=root/'assets/scenes'/f'scene-{next_id}.png';next_id+=1
 scene_id=dest.stem
 name=f'近距离教室 · {int(scene_id.split("-")[-1])-60:02d}'
 if dest.exists(): assert dest.read_bytes()==f.read_bytes()
 else:shutil.copy2(f,dest)
 catalog.append(dict(id=scene_id,name=name,src=f'../assets/scenes/{dest.name}',sourceSize=[w,h],corners=[[round(x/w,7),round(y/h,7)] for x,y in corners],sourceFile=f.name))
 d=ImageDraw.Draw(im);d.line([tuple(p) for p in corners]+[tuple(corners[0])],fill='red',width=5)
 im.thumbnail((230,310));x=((i-61)%5)*240;y=((i-61)//5)*345;sheet.paste(im,(x,y+25));draw.text((x+5,y+5),str(i),fill='black')
catalog.sort(key=lambda s:int(s['id'].split('-')[-1]))
(root/'data/closeup-scenes-v01.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
sheet.save(root/'output/playwright/closeup-corners-check.jpg')
print('Verified/imported',len(catalog),'scenes')
