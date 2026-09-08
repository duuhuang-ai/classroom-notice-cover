"""Build shared catalog and review sheets; never changes source images."""
from pathlib import Path
from collections import deque
import json,re
import numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
old=(root/'data/scenes.js').read_text()
catalog=[]
for block in re.findall(r'\{([^{}]+)\}',old):
 id=re.search(r'id: "([^"]+)"',block)[1]
 name=re.search(r'name: "([^"]+)"',block)[1]
 w,h=json.loads(re.search(r'sourceSize: (\[[^\n]+\])',block)[1])
 corners=json.loads(re.search(r'corners: (\[[^\n]+\])',block)[1])
 catalog.append(dict(id=id,name=name,src=f'../assets/scenes/{id}.png',corners=[[x/w,y/h] for x,y in corners]))
for n in range(11,61):
 im=Image.open(root/f'assets/scenes/scene-{n:02}.png').convert('RGB');im.thumbnail((360,480))
 a=np.asarray(im);h,w=a.shape[:2];mask=(a.min(2)>220)&((a.max(2).astype(int)-a.min(2))<25)
 seen=np.zeros((h,w),bool);best=[]
 for yy,xx in zip(*np.where(mask)):
  if seen[yy,xx]:continue
  q=deque([(yy,xx)]);seen[yy,xx]=True;component=[]
  while q:
   y,x=q.popleft();component.append((y,x))
   for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
    ny,nx=y+dy,x+dx
    if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((ny,nx))
  if len(component)>len(best):best=component
 assert len(best)>w*h*.06,(n,len(best))
 pts=np.array(best);ys,xs=pts[:,0],pts[:,1]
 top=[];bottom=[];left=[];right=[]
 for x in range(int(np.quantile(xs,.15)),int(np.quantile(xs,.85))):
  col=ys[xs==x];top.append((x,col.min()));bottom.append((x,col.max()))
 t=np.polyfit(*zip(*top),1);b=np.polyfit(*zip(*bottom),1)
 for y in range(int(max(np.polyval(t,xs.min()),np.polyval(t,xs.max())))+5,int(min(np.polyval(b,xs.min()),np.polyval(b,xs.max())))-5):
  row=xs[ys==y]
  if len(row):left.append((y,row.min()));right.append((y,row.max()))
 l=np.polyfit(*zip(*left),1);r=np.polyfit(*zip(*right),1)
 def cross(edge,side):
  x=(side[0]*edge[1]+side[1])/(1-side[0]*edge[0]);return [x/w,np.polyval(edge,x)/h]
 corners=np.array([cross(t,l),cross(t,r),cross(b,r),cross(b,l)])
 center=corners.mean(0);corners=center+(corners-center)*.985
 assert np.isfinite(corners).all() and corners.min()>0 and corners.max()<1,n
 catalog.append(dict(id=f'scene-{n:02}',name=f'课堂背景 · {n:02}',src=f'../assets/scenes/scene-{n:02}.png',corners=corners.round(7).tolist()))
catalog+=json.loads((root/'data/closeup-scenes-v01.json').read_text())
(root/'data/all-scenes.mjs').write_text('export const sceneCatalog = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n')
for start in range(0,50,25):
 sheet=Image.new('RGB',(1500,2100),'#eeeeee');d=ImageDraw.Draw(sheet)
 for i,s in enumerate(catalog[10+start:10+start+25]):
  im=Image.open(root/'assets/scenes'/f"{s['id']}.png").convert('RGB');im.thumbnail((290,390))
  w,h=im.size;draw=ImageDraw.Draw(im);points=[(x*w,y*h) for x,y in s['corners']];draw.line(points+[points[0]],fill='red',width=2)
  x=i%5*300;y=i//5*420;sheet.paste(im,(x,y+22));d.text((x+4,y+4),s['id'],fill='black')
 sheet.save(root/f'output/playwright/catalog-corners-{start//25+1}.jpg')
print('Built',len(catalog),'scenes')
