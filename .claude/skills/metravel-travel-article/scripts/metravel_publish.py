#!/usr/bin/env python3
"""
metravel_publish.py — движок публикации/редактирования путешествий на metravel.by.

Токен НЕ хранится в коде. Источник токена (в порядке приоритета):
  1) переменная окружения METRAVEL_TOKEN
  2) файл ~/.metravel_token (одна строка)
Токен — это сессионный токен авторизации залогиненного пользователя metravel.by
(DRF Token). Используется ТОЛЬКО для запросов к metravel.by.

CLI:
  # создать/обновить статью из markdown-черновика
  python metravel_publish.py upsert <draft.md> [--id <travelId>]
  # залить фото (обложка + галерея + фото к точкам) из папки(папок)
  python metravel_publish.py photos <travelId> <folder> [<folder2> ...] [--gallery N] [--no-cover] [--no-points]
  # только обложка из конкретного файла
  python metravel_publish.py cover <travelId> <imageFile>
  # справочники id категорий/стран
  python metravel_publish.py facets
"""
import os, sys, json, re, glob, math, subprocess, urllib.request, urllib.error

BASE = os.environ.get("METRAVEL_API", "https://metravel.by/api")

def token():
    t = os.environ.get("METRAVEL_TOKEN")
    if not t:
        p = os.path.expanduser("~/.metravel_token")
        if os.path.exists(p):
            t = open(p).read().strip()
    if not t:
        sys.exit("ERROR: set METRAVEL_TOKEN env var or ~/.metravel_token file")
    return t

def req(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(BASE + path, data=body, method=method)
    r.add_header("Authorization", "Token " + token())
    if body is not None:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ---- category / country maps (fetch live via `facets`) ----
CAT = {"Поход":2,"Хайкинг":21,"Треккинг":22,"Тур выходного дня":19,
       "Самостоятельное путешествие":20,"Автопутешествие":6,"Сплав":4,
       "Веломаршрут":24,"Велопоход":7,"Food":3,"Фестиваль/концерт":14}
COUNTRY = {"Польша":160,"Словакия":184,"Чехия":215,"Австрия":20,"Беларусь":3,
           "Испания":87,"Португалия":161,"Хорватия":212,"Германия":65,
           "Италия":88,"Франция":209,"Нидерланды":139,"Швейцария":217}

# ---------------- markdown -> travel ----------------
def parse_md(path):
    md = open(path).read()
    fm = {}
    m = re.search(r"^---\n(.*?)\n---\n", md, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"([a-z_]+):\s*(.*)", line)
            if mm: fm[mm.group(1)] = mm.group(2).strip()
    title = fm.get("title","").strip().strip('"')
    countries = [COUNTRY[c.strip()] for c in re.split(r"[,/]", fm.get("country","")) if c.strip() in COUNTRY]
    cats = []
    cm = re.search(r"categories:\s*\[(.*?)\]", md)
    if cm:
        for c in cm.group(1).split(","):
            c=c.strip().strip('"')
            if c in CAT: cats.append(CAT[c])
    body = md[m.end():] if m else md
    cut = re.search(r"\n---\n##\s*Фото", body)
    if cut: body = body[:cut.start()]
    body = re.sub(r"^\s*#\s+.+?(\n|$)", "", body, count=1).strip()
    points = []
    pm = re.search(r"##\s*Точки для карты.*?\n(.*)", md, re.S)
    if pm:
        for row in pm.group(1).splitlines():
            cells=[c.strip() for c in row.split("|") if c.strip()]
            if len(cells)>=2:
                co=re.match(r"(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", cells[1])
                if co and not cells[0].lower().startswith(("место","---")):
                    points.append((cells[0], float(co.group(1)), float(co.group(2))))
    return title, body, countries, cats, points

def inline(s):
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)
    return s.replace("`","")

# Шаблонные заголовки убираем (текст оставляем) — чтобы читалось как живой текст.
DROP_H = {"вступление","введение","итог","итоги","заключение","что увидели",
          "как прошло","как прошёл день","как прошел день","о поездке","точки",
          "резюме","описание","места","места (точки на карте)","точки маршрута"}
# Переименовываем в естественные.
RENAME_H = {"маршрут по точкам":"Маршрут","полезное":"Советы путешественнику",
            "как прошло путешествие":"Как всё прошло"}

def _h2(text):
    key=text.strip().lower().rstrip(":")
    if key in DROP_H: return ""
    return "<h2>"+RENAME_H.get(key, text.strip())+"</h2>"

def md_to_html(body):
    body=inline(body); out=[]; para=[]; lst=None; ltag=None
    def fp():
        nonlocal para
        if para: out.append("<p>"+" ".join(para)+"</p>"); para=[]
    def fl():
        nonlocal lst,ltag
        if lst: out.append(f"<{ltag}>"+"".join(f"<li>{x}</li>" for x in lst)+f"</{ltag}>"); lst=None; ltag=None
    for raw in body.splitlines():
        line=raw.strip()
        if not line: fp(); fl(); continue
        if line.startswith("## "):
            fp(); fl()
            h=_h2(line[3:])
            if h: out.append(h)
            continue
        if line.startswith("### "): fp(); fl(); out.append("<h3>"+re.sub(r"^\d+\.\s*","",line[4:].strip())+"</h3>"); continue
        m=re.match(r"^(\d+)\.\s+(.*)", line); b=re.match(r"^[-*]\s+(.*)", line)
        if m:
            fp()
            if ltag!="ol": fl(); lst=[]; ltag="ol"
            lst.append(m.group(2)); continue
        if b:
            fp()
            if ltag!="ul": fl(); lst=[]; ltag="ul"
            lst.append(b.group(1)); continue
        fl(); para.append(line)
    fp(); fl()
    return "".join(out)

def _template():
    st,txt=req("GET","/travels/upsert/")  # not used; template comes from an existing draft if available
    return {}

def upsert(path, existing_id=None, year="2024"):
    title, body, countries, cats, points = parse_md(path)
    html = md_to_html(body)
    c = countries[0] if countries else 160
    markers=[{"id":None,"lat":la,"lng":ln,"address":nm,"country":c,"categories":[],"image":None} for (nm,la,ln) in points]
    # preserve existing point ids on update (match by nearest coord) so photos survive
    if existing_id:
        try:
            _,t=req("GET",f"/travels/{existing_id}/"); d=json.loads(t); d=d.get("data",d)
            pool=[]
            for a in (d.get("travelAddress") or []):
                mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", a.get("coord") or "")
                if mm: pool.append((float(mm.group(1)),float(mm.group(2)),a.get("id")))
            for mk in markers:
                bi=-1; bd=1e18; best=None
                for i,(la2,lo2,pid) in enumerate(pool):
                    dd=(mk["lat"]-la2)**2+(mk["lng"]-lo2)**2
                    if dd<bd: bd=dd; best=pid; bi=i
                if best is not None and bd < 0.002**2:
                    mk["id"]=best; pool.pop(bi)
        except Exception as e:
            print("  (id-preserve skipped:", e, ")")
    payload={
      "id":existing_id, "name":title, "description":html, "year":year,
      "categories":cats or [20], "countries":countries or [160],
      "coordsMeTravel":markers, "travelAddress":[], "gallery":[],
      "transports":[], "month":[], "complexity":[], "companions":[], "over_nights_stay":[],
      "thumbs200ForCollectionArr":[], "travelImageThumbUrlArr":[], "travelImageAddress":[],
      "minus":"__draft_placeholder__","plus":"__draft_placeholder__",
      "recommendation":"__draft_placeholder__","youtube_link":"__draft_placeholder__",
      "publish":False, "moderation":False, "visa":False,
      "number_days":None, "number_peoples":None, "budget":None,
    }
    st,txt=req("PUT","/travels/upsert/", payload)
    nid=None
    try: nid=json.loads(txt).get("id")
    except: pass
    print(f"[{st}] upsert id={nid} pts={len(markers)} cats={cats} ctry={countries} :: {title[:50]}")
    if st>=400: print("   ERR:", txt[:300])
    return nid

# ---------------- photos ----------------
TMP="/tmp/mt_up"; os.makedirs(TMP, exist_ok=True); MAXDIM=1600
def _exif(path):
    from PIL import Image, ExifTags
    G=next(k for k,v in ExifTags.TAGS.items() if v=='GPSInfo')
    try: ex=Image.open(path)._getexif() or {}
    except: return (None,None)
    g=ex.get(G)
    if not g: return (None,None)
    gg={ExifTags.GPSTAGS.get(k,k):v for k,v in g.items()}
    if 'GPSLatitude' not in gg: return (None,None)
    def d(v,r):
        a,b,c=[float(x) for x in v]; x=a+b/60+c/3600
        return -x if r in ('S','W') else x
    return (round(d(gg['GPSLatitude'],gg.get('GPSLatitudeRef','N')),6),
            round(d(gg['GPSLongitude'],gg.get('GPSLongitudeRef','E')),6))

def _resize(src):
    dst=os.path.join(TMP,"u_%d.jpg"%(abs(hash(src))%10**9))
    subprocess.run(["sips","-Z",str(MAXDIM),src,"--out",dst],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return dst if os.path.exists(dst) else src

def upload_image(file, collection, id_):
    dst=_resize(file)
    out=subprocess.run(["curl","-s","-w","\n%{http_code}","--max-time","120",
        "-H","Authorization: Token "+token(),
        "-F","file=@"+dst+";type=image/jpeg","-F","collection="+collection,"-F","id="+str(id_),
        BASE+"/upload"],capture_output=True,text=True).stdout
    p=out.rsplit("\n",1); body=p[0]; code=p[1] if len(p)>1 else "?"
    url=None
    try: url=json.loads(body).get("url")
    except: pass
    return code,url

def _hav(a,b):
    (la1,lo1),(la2,lo2)=a,b; R=6371000; p=math.pi/180
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)*p/2)**2+math.cos(la1*p)*math.cos(la2*p)*math.sin((lo2-lo1)*p/2)**2))

def photos(tid, folders, gallery=10, cover=True, points=True, cover_file=None):
    jpgs=[]
    for f in folders:
        jpgs+=sorted(x for x in glob.glob(os.path.join(f,'**','*'),recursive=True)
                     if x.lower().endswith(('.jpg','.jpeg')) and '/._' not in x)
    print(f"travel {tid}: {len(jpgs)} photos")
    if not jpgs and not cover_file: return
    sel=[]
    if gallery>0 and jpgs:
        n=min(gallery,len(jpgs)); step=max(1,len(jpgs)//n); sel=jpgs[::step][:n]
    if cover_file:
        print("  cover", *upload_image(cover_file,"travelMainImage",tid))
    elif cover and sel:
        print("  cover", *upload_image(sel[0],"travelMainImage",tid))
    for i,g in enumerate(sel):
        c,_=upload_image(g,"gallery",tid); print(f"  gallery {i+1}/{len(sel)} [{c}]")
    if points:
        _,t=req("GET",f"/travels/{tid}/"); d=json.loads(t); d=d.get("data",d)
        geo=[(p,)+_exif(p) for p in jpgs]
        for a in (d.get("travelAddress") or []):
            mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", a.get("coord") or "")
            if not mm: continue
            pt=(float(mm.group(1)),float(mm.group(2))); best=None; bd=1e18
            for (p,la,lo) in geo:
                if la is None: continue
                dd=_hav(pt,(la,lo))
                if dd<bd: bd=dd; best=p
            if best and bd<3000:
                c,_=upload_image(best,"travelImageAddress",a.get("id")); print(f"  point {a.get('id')} ({int(bd)}m) [{c}]")

# ---------------- cli ----------------
def main():
    a=sys.argv[1:]
    if not a: sys.exit(__doc__)
    cmd=a[0]
    if cmd=="facets":
        _,t=req("GET","/travels/facets/?where="+urllib.parse.quote(json.dumps({"publish":1,"moderation":1})))
        f=json.loads(t).get("facets",{})
        print("categories:",[(x['id'],x['name']) for x in f.get('categories',[])])
        print("countries:",[(x['id'],x['name']) for x in f.get('countries',[]) if x['name'] in ('Польша','Словакия','Чехия','Австрия','Испания','Португалия','Хорватия','Беларусь')])
    elif cmd=="upsert":
        path=a[1]; eid=None; year="2024"
        if "--id" in a: eid=int(a[a.index("--id")+1])
        if "--year" in a: year=a[a.index("--year")+1]
        upsert(path, eid, year)
    elif cmd=="cover":
        print(*upload_image(a[2],"travelMainImage",int(a[1])))
    elif cmd=="photos":
        tid=int(a[1]); rest=a[2:]
        gal=10; cov=True; pts=True
        if "--gallery" in rest: gal=int(rest[rest.index("--gallery")+1]); rest=[x for i,x in enumerate(rest) if x!="--gallery" and rest[i-1]!="--gallery"]
        cov="--no-cover" not in rest; pts="--no-points" not in rest
        folders=[x for x in rest if not x.startswith("--")]
        photos(tid, folders, gallery=gal, cover=cov, points=pts)
    else:
        sys.exit(__doc__)

if __name__=="__main__":
    import urllib.parse
    main()
