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
           "Италия":88,"Франция":209,"Нидерланды":139,"Швейцария":217,
           "Венгрия":50,"Венгрии":50}

# ---- категории ДЛЯ ТОЧЕК (point types). У каждой точки должна быть категория. ----
PCAT = [  # (подстрока в нижнем регистре, id) — специфичное раньше общего
 ("руины замка",115),("руины дворца",118),("руины церкви",120),("руины усадьб",116),
 ("руины мельниц",117),("руины мост",119),("руины",114),
 ("замок",43),("крепост",61),("дворец",33),("усадьб",136),
 ("костёл",150),("косте",150),("собор",127),("церков",142),("храм",141),("монастыр",74),("часовн",150),
 ("скансен",77),("музей под откр",77),("музей",76),
 ("ботанич",192),("парк развлеч",92),("аттракцион",92),("зоопарк",46),
 ("национальн парк",79),("природн парк",79),("заповедн",79),("парк",90),("сад",123),
 ("пещер",97),("водопад",20),
 ("озер",84),("плесо",84),("пруд",84),("водохран",21),("залив",18),("море",18),
 ("река",110),("канал",51),("набереж",110),("пляж",101),("болото",15),
 ("остров",86),("полуостров",183),("клиф",126),("скал",126),("долин",37),("ущель",37),
 ("вершин",26),("гора",26),("пик ",26),("щит",26),("холм",140),("перевал",26),("поляна",26),
 ("канатн",186),("фуникул",186),("гондол",186),("колесо обозр",204),
 ("термаль",193),("курорт",193),("спа",193),("бювет",193),("источник",193),("здруй",193),("zdrój",193),
 ("ратуш",107),("площад",187),("рынок",187),("rynek",187),("фонтан",152),("памятник",89),
 ("маяк",68),("бункер",17),
 ("радиоб",11),("радиост",11),("башня",11),("вежа",200),("водонапорн",157),("мельниц",19),("ветр",19),
 ("мост",75),("виадук",196),("акведук",1),
 ("старый город",156),("древний город",156),("город",184),("деревн",171),("село",171),("хутор",171),
 ("лес",67),("тропа",147),("эко",147),("вокзал",23),("станц",23),("аэропорт",8),("парковк",91),
]
_ADDR_CATS=None
def _addr_cats():
    """Полный справочник категорий точек {name_lower: id}, отсортированный по длине имени (длинные раньше)."""
    global _ADDR_CATS
    if _ADDR_CATS is None:
        try:
            import urllib.parse
            _,t=req("GET","/travels/facets/?where="+urllib.parse.quote(json.dumps({"publish":1,"moderation":1})))
            items=json.loads(t).get("facets",{}).get("categoryTravelAddress",[])
            pairs=[(str(x.get("name","")).strip().lower(), x.get("id")) for x in items if x.get("name") and x.get("id")]
            _ADDR_CATS=sorted(pairs, key=lambda p:-len(p[0]))
        except Exception:
            _ADDR_CATS=[]
    return _ADDR_CATS

def point_categories(name):
    s=(name or "").lower(); ids=[]
    for sub,cid in PCAT:                      # приоритетные ключи
        if sub in s and cid not in ids:
            ids.append(cid)
            if len(ids)>=2: break
    if len(ids)<2:                             # дополняем по полному справочнику
        for nm,cid in _addr_cats():
            if len(nm)>=4 and nm in s and cid not in ids:
                ids.append(cid)
                if len(ids)>=2: break
    return ids or [184]   # 184=Город — крайний случай (точка всегда с категорией)

# ---- убрать «технические» фразы (нельзя выдавать, что данные из фото/GPS) ----
def strip_meta(html):
    if not html: return html
    for p in [r"[^.>]*\bGPS\b[^.<]*\.?", r"[^.>]*\bEXIF\b[^.<]*\.?",
              r"[^.>]*по\s+точкам\s+съёмки[^.<]*\.?", r"[^.>]*по\s+аэрокадрам[^.<]*\.?",
              r"[^.>]*по\s+координатам\s+фотограф[^.<]*\.?", r"[^.>]*из\s+кластер[^.<]*\.?",
              r"\(нижняя оценка[^)]*\)", r"_+\s*", ]:
        html=re.sub(p,"",html,flags=re.I)
    html=re.sub(r"\(\s*[,.;]?\s*\)","",html)
    html=re.sub(r"<p>\s*[:.;]?\s*</p>","",html)
    html=re.sub(r"\s{2,}"," ",html)
    return html.strip()

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
    html = strip_meta(md_to_html(body))
    c = countries[0] if countries else 160
    markers=[{"id":None,"lat":la,"lng":ln,"address":nm,"country":c,"categories":point_categories(nm),"image":None} for (nm,la,ln) in points]
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

def recat(tid):
    """Дозаполнить категории всех точек статьи + почистить технические фразы. Точки/фото сохраняются (id preserved)."""
    _,t=req("GET",f"/travels/{tid}/"); d=json.loads(t); d=d.get("data",d)
    if not d.get("name"): print(f"  {tid}: skip (нет данных)"); return
    cs=d.get("countries") or [160]; c=cs[0] if cs else 160
    markers=[]
    for a in (d.get("travelAddress") or []):
        mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", a.get("coord") or "")
        if not mm: continue
        markers.append({"id":a.get("id"),"lat":float(mm.group(1)),"lng":float(mm.group(2)),
            "address":a.get("address") or "", "country":c,
            "categories":point_categories(a.get("address")), "image":None})
    desc=strip_meta(d.get("description") or "")
    payload={"id":tid,"name":d.get("name"),"description":desc,"year":str(d.get("year") or "2025"),
      "categories":d.get("categories") or [20],"countries":cs,
      "coordsMeTravel":markers,"travelAddress":[],"gallery":[],
      "transports":[],"month":[],"complexity":[],"companions":[],"over_nights_stay":[],
      "thumbs200ForCollectionArr":[],"travelImageThumbUrlArr":[],"travelImageAddress":[],
      "minus":"__draft_placeholder__","plus":"__draft_placeholder__",
      "recommendation":"__draft_placeholder__","youtube_link":"__draft_placeholder__",
      "publish":False,"moderation":False,"visa":False,
      "number_days":None,"number_peoples":None,"budget":None}
    st,txt=req("PUT","/travels/upsert/",payload)
    print(f"  [{st}] recat {tid}: точек {len(markers)} (с категориями), desc {len(desc)}")
    return st

def _put_with_desc(d, new_desc):
    """PUT статьи с новым описанием, сохраняя точки (с категориями), галерею, обложку, страны."""
    tid=d.get("id"); cs=d.get("countries") or [160]; c=cs[0] if cs else 160
    markers=[]
    for a in (d.get("travelAddress") or []):
        mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", a.get("coord") or "")
        if not mm: continue
        markers.append({"id":a.get("id"),"lat":float(mm.group(1)),"lng":float(mm.group(2)),
            "address":a.get("address") or "", "country":c,
            "categories":point_categories(a.get("address")), "image":None})
    payload={"id":tid,"name":d.get("name"),"description":new_desc,"year":str(d.get("year") or "2025"),
      "categories":d.get("categories") or [20],"countries":cs,
      "coordsMeTravel":markers,"travelAddress":[],"gallery":[],
      "transports":[],"month":[],"complexity":[],"companions":[],"over_nights_stay":[],
      "thumbs200ForCollectionArr":[],"travelImageThumbUrlArr":[],"travelImageAddress":[],
      "minus":"__draft_placeholder__","plus":"__draft_placeholder__",
      "recommendation":"__draft_placeholder__","youtube_link":"__draft_placeholder__",
      "publish":False,"moderation":False,"visa":False,
      "number_days":None,"number_peoples":None,"budget":None}
    return req("PUT","/travels/upsert/",payload)

def _norm_url(u):
    if not u: return None
    if u.startswith("http://"): u="https://"+u[7:]
    elif u.startswith("/"): u="https://metravel.by"+u
    return u

def _tokens(s):
    return set(w for w in re.findall(r"[A-Za-zА-Яа-яёЁ]{4,}", (s or "").lower()))

def desc_images(tid, n=6):
    """Вставить в текст описания ФОТО К ТОЧКАМ (релевантные месту, не дублируют галерею).
    Где заголовок совпадает с названием точки — её фото; остальные распределяются по порядку. Идемпотентно."""
    _,t=req("GET",f"/travels/{tid}/"); d=json.loads(t); d=d.get("data",d)
    if not d.get("name"): print(f"  {tid}: нет данных"); return
    # фото к точкам (только реальные, не плейсхолдер address-image/)
    pts=[]
    for a in (d.get("travelAddress") or []):
        u=a.get("travelImageThumbUrl") or ""
        if u and not u.rstrip("/").endswith("address-image"):
            pts.append((a.get("address") or "", _norm_url(u)))
    desc=re.sub(r'<p class="mt-img">.*?</p>','', d.get("description","") or "")  # убрать прежние вставки
    if not pts:
        # запасной вариант: если фото к точкам нет — берём из галереи
        gal=[_norm_url(g.get("url") if isinstance(g,dict) else g) for g in (d.get("gallery") or [])]
        gal=[u for u in gal if u]
        pts=[("",u) for u in gal[::max(1,len(gal)//n)][:n]]
        if not pts: print(f"  {tid}: нет фото"); return
    fig=lambda u:f'<p class="mt-img"><img src="{u}" alt="" style="max-width:100%;height:auto;border-radius:10px"></p>'
    # заголовки h2/h3 по порядку
    heads=[(m.group(1), m.end()) for m in re.finditer(r"<h[23]>(.*?)</h[23]>", desc)]
    used=set(); placement={}   # pos -> url
    # 1) сопоставление по названию
    for text,pos in heads:
        ht=_tokens(text); best=None
        for i,(addr,url) in enumerate(pts):
            if i in used: continue
            if ht & _tokens(addr): best=i; break
        if best is not None: placement[pos]=pts[best][1]; used.add(best)
    # 2) оставшиеся точки — в заголовки без фото, по порядку
    rem=[i for i in range(len(pts)) if i not in used]
    for text,pos in heads:
        if pos in placement or not rem: continue
        placement[pos]=pts[rem.pop(0)][1]; used.add(0)  # noqa
    # собрать с вставками по позициям (с конца, чтобы не сбить индексы)
    nd=desc
    for pos in sorted(placement, reverse=True):
        nd=nd[:pos]+fig(placement[pos])+nd[pos:]
    if not heads:  # нет заголовков — после первых абзацев
        ps=re.split(r'(</p>)', nd); out=[]; k=0
        urls=[u for _,u in pts]
        for seg in ps:
            out.append(seg)
            if seg=='</p>' and k<min(n,len(urls)): out.append(fig(urls[k])); k+=1
        nd="".join(out)
    st,_=_put_with_desc(d,nd)
    print(f"  [{st}] desc_images {tid}: вставлено {len(placement) or 0} фото (к точкам), точек с фото {len(pts)}")
    return st

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
        # эвристика: кадр ближе всего к ПЕРВОЙ точке (главная достопримечательность), а не «первый по порядку».
        # ВНИМАНИЕ: это лишь черновик обложки — автор ОБЯЗАН визуально проверить и при необходимости заменить (cover).
        cov=sel[0]
        try:
            _,t=req("GET",f"/travels/{tid}/"); dd=json.loads(t); dd=dd.get("data",dd)
            a0=(dd.get("travelAddress") or [None])[0]
            mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", (a0 or {}).get("coord") or "") if a0 else None
            if mm:
                pt=(float(mm.group(1)),float(mm.group(2))); bd=1e18
                for g in sel:
                    la,lo=_exif(g)
                    if la is None: continue
                    dist=_hav(pt,(la,lo))
                    if dist<bd: bd=dist; cov=g
        except Exception: pass
        print("  cover(черновик, проверь визуально!)", *upload_image(cov,"travelMainImage",tid))
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
    elif cmd=="recat":
        for x in a[1:]:
            if x.isdigit(): recat(int(x))
    elif cmd=="descimg":
        for x in a[1:]:
            if x.isdigit(): desc_images(int(x))
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
