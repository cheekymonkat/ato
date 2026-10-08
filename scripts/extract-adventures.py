#!/usr/bin/env python3
"""Extract the five supplied adventure trackers (PyMuPDF 1.28.x).
Reviewed column/section bounds isolate table rows; text and provenance come from PDFs.
Run --check to verify all generated files without writing them.
"""
import argparse, hashlib, json, re
from pathlib import Path
import pymupdf
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/reference/adventures'
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower().replace('’', '').replace("'", '')).strip('-')
def norm(s): return ''.join(c.lower() for c in s if c.isalnum()).replace('travelled','traveled')
RANGES_123 = [[(1,3),(1,2),None,None],[(4,6),(3,4),None,None],[(7,9),(5,6),(1,2),None],[(10,10),(7,8),(3,4),(1,2)],[None,(9,10),(5,6),(3,5)],[None,None,(7,8),(6,8)],[None,None,(9,10),(9,10)]]
RANGES_45 = [[(1,4),(1,3),(1,2),None,None,None],[(5,7),(4,6),(3,4),(1,1),None,None],[(8,10),(7,8),(5,6),(2,2),None,None],[None,(9,10),(7,8),(3,4),(1,2),(1,1)],[None,None,(9,10),(5,7),(3,4),(2,3)],[None,None,None,(8,10),(5,7),(4,6)],[None,None,None,None,(8,10),(7,10)]]
RANGES_2 = [[(1,3),(1,1),None,None],[(4,5),(2,3),None,None],[(6,7),(4,5),None,None],[(8,9),(6,7),(1,1),None],[(10,10),(8,9),(2,3),(1,1)],[None,(10,10),(4,5),(2,4)],[None,None,(6,8),(5,7)],[None,None,(9,10),(8,10)]]
TERRAINS = {
1:['Maze Outcrop (Inner 3)','Giant Shell (Inner 3)','Minos Manos Unit (Outer 3)','Abandoned Temple (Outer 3)','Giant Shell (Inner 3)','Minos Manos Unit (Outer 3)','Maze Outcrop (Inner 3)'],
2:['Graveyard of the Frail (Inner 3)','Krypteia Outpost (Outer 3)','Cyclops Trap (Outer 3)','Cyclops Trap (Outer 3)','Ambrosia Elephant (Outer 3)','Ambrosia Elephant (Outer 3)','Graveyard of the Frail (Inner 3)','Krypteia Outpost (Outer 3)'],
3:['Giant Shell (Inner 2)','Black Lake (Inner 3)','Hyperborean Ruins (Outer 3)','Spot of Nothingness (Inner 3)','Spot of Nothingness (Inner 3)','Hyperborean Ruins (Outer 3)','Abandoned Temple (Outer 3)'],
4:['Wishstorm (Inner 3)','Irem City (Inner 3)','Windblighted Fleet (Inner 3)','Ambrosia Cloud (Inner 3)','Irem City (Inner 3)','Wishstorm (Inner 3)','Windblighted Fleet (Inner 3)'],
5:['Black Abyss (Outer 3)','Trireme Graveyard (Inner 3)','School of Creatures (Inner 3)','Trench (IX4) (Inner 3)','Trireme Graveyard (Inner 3)','Black Abyss (Outer 3)','School of Creatures (Inner 3)']}
SPECIAL = {1:[('Rude Awakening',1),('Unfathomable Aeons',4)],2:[('Cruel Aeons',4)],3:[('Endless Aeons',4),('Rude Awakening',1),('Tomorrow’s Edge',8)],4:[('Barren Aeons',4),('Son of Dusk',1),('Shortages',8)],5:[('Rude Awakening',1),('Unknown Aeons',4),('Fracturess',8)]}
VARIANTS = {1:{1:'11',2:'22',9:'99'},4:{4:'44'}}

def lines(page):
 return [(pymupdf.Rect(l['bbox']), ''.join(s['text'] for s in l['spans']).strip()) for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) if ''.join(s['text'] for s in l['spans']).strip()]
def words(page, rect):
 ws=[w for w in page.get_text('words') if rect.contains(pymupdf.Point((w[0]+w[2])/2,(w[1]+w[3])/2))]
 # Publisher sometimes merges adjacent cells into a text line: geometry takes priority.
 return ' '.join(w[4] for w in sorted(ws, key=lambda w:(round(w[1]/3),w[0])))
def evidence(page, rect):return {'page':page.number+1,'rectPt':[round(x,3) for x in rect]}
def header(page, title):
 return next((r,s) for r,s in lines(page) if s.startswith(title) and re.search(r'\(\d+\)$',s))
def table(page, heading, kind, cycle, col=None):
 hr, hs=heading; bookpage=int(re.search(r'\((\d+)\)$',hs)[1]); title=re.sub(r'\s*\(\d+\)$','',hs)
 if col is None: col=0 if hr.x0<200 else 1 if hr.x0<400 else 2
 if kind=='hub':
  left,right=[(15,197),(205,394),(399,580)][col]
  if cycle==2 and bookpage==95:right=480
  rowLeft,rowRight=left,left+53
 elif kind=='rr': left,right,rowLeft,rowRight=15,268,20,55
 else:left,right,rowLeft,rowRight=278,580,280,302
 # Discover row anchors from the first cell, not the narrative title.
 end=hr.y0+(258 if kind=='hub' and cycle!=1 else 282 if kind=='hub' else 338)
 row_words=[w for w in page.get_text('words') if rowLeft<=(w[0]+w[2])/2<=rowRight and hr.y1<(w[1]+w[3])/2<min(end,838)]
 groups=[]
 for w in sorted(row_words,key=lambda w:(w[1],w[0])):
  mid=(w[1]+w[3])/2
  if not groups or abs(mid-groups[-1][0])>5:groups.append([mid,[w]])
  else:groups[-1][1].append(w)
 anchors=[]
 for y,ws in groups:
  label=' '.join(w[4] for w in sorted(ws,key=lambda w:w[0])).replace('Ω','Ω')
  if re.fullmatch(r'α|Ω|\d{1,2}(?:\s*-\s*\d{1,2})?',label):anchors.append((y,label))
 assert len(anchors)==(7 if kind=='hub' and not(cycle==1 and bookpage in [38,44,51]) else 8 if kind=='hub' else 10),(cycle,title,anchors)
 entries=[]
 for i,(y,label) in enumerate(anchors):
  y0=(anchors[i-1][0]+y)/2 if i else hr.y1+2
  y1=(anchors[i+1][0]+y)/2 if i+1<len(anchors) else y+17
  rect=pymupdf.Rect(left,y0,right,y1)
  story=words(page,pymupdf.Rect(rowRight+1,y0, right,y1))
  # Fated variant numbers and the star live beyond the story column.
  if kind=='rr': story=words(page,pymupdf.Rect(56,y0,210,y1)).replace(' *','').strip()
  assert story,(cycle,title,label)
  roll=None if label in ['α','Ω'] else [int(n) for n in label.split(' - ')]
  if roll and len(roll)==1:roll*=2
  box=[] if roll is None else [{}]
  if kind=='rr' and roll[0] in VARIANTS.get(cycle,{}):box.append({'passage':VARIANTS[cycle][roll[0]]})
  entries.append({'id':f'c{cycle}-{slug(title)}-{i+1}', 'title':story,'kind':'opening' if label=='α' else 'closing' if label=='Ω' else 'rolled','label':label.replace(' - ','–'),'roll':roll,'fatedBoxes':box,'source':evidence(page,rect)})
 return {'id':f'c{cycle}-{slug(title)}','title':title,'storybookPage':bookpage,'entries':entries,'source':evidence(page,pymupdf.Rect(left,hr.y0,right,anchors[-1][0]+17))}

def extract(cycle, source):
 path=next(source.glob(f'Cycle_{cycle}_*.pdf'));doc=pymupdf.open(path)
 sheet=json.loads((ROOT/f'data/reference/cycle-sheets/cycle-{cycle}.json').read_text())
 heads=[(p,r,s) for p in doc for r,s in lines(p) if re.search(r'\(\d+\)$',s) and not s.startswith(('R&R Adventures','Dreams of Pharos')) and r.y0>38 and ('Story' not in s)]
 hubs=[]
 for p,r,s in heads:hubs.append(table(p,(r,s),'hub',cycle))
 # Source page then vertical row then column gives the printed selection order.
 hubs.sort(key=lambda h:next(i for i,t in enumerate(sheet['adventureTracks']) if norm(t['title'])==norm(h['title'])))
 ranges=RANGES_2 if cycle==2 else RANGES_45 if cycle>=4 else RANGES_123
 assert len(hubs)==len(ranges)
 columns=['1A','1B','2A/2B','3A','3B','4A/4B'] if cycle>=4 else ['1','2','3','4']
 for i,h in enumerate(hubs):
  track=next(t for t in sheet['adventureTracks'] if norm(t['title'])==norm(h['title']))
  h.update(trackId=track['id'],progressBoxCount=track['progressBoxCount'],progressLabels=[b['label'] for b in track['boxes']],terrain=TERRAINS[cycle][i],selection={c:r for c,r in zip(columns,ranges[i])})
 tables=[{'kind':'rr',**table(doc[1],header(doc[1],'R&R Adventures'),'rr',cycle)}]
 if cycle<=3:tables.append({'kind':'pharos',**table(doc[1],header(doc[1],'Dreams of Pharos'),'pharos',cycle)})
 tracks=[]
 for title,count in SPECIAL[cycle]:
  rect,_=next((r,s) for r,s in lines(doc[1]) if s==title)
  tracks.append({'id':f'c{cycle}-{slug(title)}','title':title,'kind':'special','boxCount':count,'source':evidence(doc[1],rect)})
 if cycle==1:
  tracks.extend([{'id':'c1-code-0014','title':'0014','kind':'code','code':'0014','boxCount':8,'source':evidence(doc[0],pymupdf.Rect(402,281,579,307))},{'id':'c1-m023','title':'Siren Survivor','kind':'breakthrough','printedId':'M023','boxCount':4,'source':evidence(doc[1],pymupdf.Rect(285,473,580,503))}])
 if cycle==2:
  for code,title in [('0248','Hull Depleted'),('0249','Crew Depleted')]:
   rect,_=next((r,s) for r,s in lines(doc[1]) if s==code)
   tracks.append({'id':f'c2-code-{code}','title':title,'code':code,'kind':'code','boxCount':1,'source':evidence(doc[1],rect)})
 if cycle>=4:
  for rect,s in lines(doc[1]):
   if rect.x0>270 and 340<rect.y0<670 and re.fullmatch(r'\d{4}',s):tracks.append({'id':f'c{cycle}-code-{s}','title':s,'code':s,'kind':'code','boxCount':1,'source':evidence(doc[1],rect)})
 return {'schemaVersion':1,'cycle':cycle,'source':{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':len(doc),'coordinateSystem':'PDF points, top-left origin'},'hubs':hubs,'tables':tables,'tracks':tracks,'inwardOdyssey':{'boxCount':20,'storyTitlesSource':'catalogue Inward Odyssey card'},'unlistedSheetTracks':[{'id':t['id'],'title':t['title'],'boxCount':t['progressBoxCount'],'labels':[b['label'] for b in t['boxes']]} for t in sheet['adventureTracks'] if t['id'] not in [h['trackId'] for h in hubs]]}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,default=ROOT.parent/'ato_docs/adventures');parser.add_argument('--check',action='store_true');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True)
 for c in range(1,6):
  data=extract(c,args.source_dir);file=OUT/f'cycle-{c}.json';text=json.dumps(data,indent=2,ensure_ascii=False)+'\n'
  if args.check: assert file.read_text()==text,f'Stale extraction: {file}'
  else:file.write_text(text)
  print(f'Cycle {c}: {len(data["hubs"])} hubs, {sum(len(h["entries"]) for h in data["hubs"])} hub stories, {len(data["tables"])} replay tables, {len(data["tracks"])} extra tracks')
if __name__=='__main__':main()
