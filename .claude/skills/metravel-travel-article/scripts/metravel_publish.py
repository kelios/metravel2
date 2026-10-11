#!/usr/bin/env python3
"""
metravel_publish.py — движок черновиков путешествий автора 1 на metravel.by.

Токен в коде и в окружении скрипта не хранится. `token()` получает проверенный
токен владельца (owner1, `expectedUserId: 1`) через `scripts/lib/metravel-token-bridge.js`
по приватному каналу — тот же общий resolver, что у `createToolSession` в JS
(`docs/DEVELOPMENT.md` → «Operator token sessions»). Запросы — только к https://metravel.by.

Что движок гарантирует сам, без опоры на текст регламента:
  * upsert берёт `year`, `month` и `created_at` из `date:` черновика и не шлёт `month: []`;
  * пустые plus/minus/recommendation/youtube_link уходят `null`, сентинела нет;
  * правка существующей статьи эхом сохраняет publish/moderation и поля, которых нет в черновике;
  * descimg кладёт в тело только `travel-description-image` (перезаливка, alt = имя точки);
  * между заливками `POST /api/upload` выдерживается пауза ≥ max(длительность запроса, 10 с) (#2306).

CLI:
  # создать/обновить черновик из markdown (date: YYYY-MM-DD | YYYY-MM | A..B обязателен для новой)
  python metravel_publish.py upsert <draft.md> [--id <travelId>] [--year <YYYY>] [--dry-run]
  # залить фото (обложка + галерея + фото к точкам) из папки(папок)
  python metravel_publish.py photos <travelId> <folder> [<folder2> ...] [--gallery N] [--no-cover] [--no-points]
  # только обложка из конкретного файла
  python metravel_publish.py cover <travelId> <imageFile>
  # фото точек в текст (перезаливка в collection=description), категории точек
  python metravel_publish.py descimg <travelId> ; python metravel_publish.py recat <travelId>
  # справочники id категорий/стран
  python metravel_publish.py facets
"""
import os, sys, json, re, glob, math, subprocess, urllib.request, urllib.error, urllib.parse, pathlib, time, datetime, hashlib, io, html as _html

BASE = os.environ.get("METRAVEL_API", "https://metravel.by/api")

class _NoAuthRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("metravel-auth: request/redirect")


def _origin():
    import urllib.parse
    parsed = urllib.parse.urlsplit(BASE)
    if (parsed.scheme, parsed.netloc) != ("https", "metravel.by") or parsed.path not in ("", "/", "/api", "/api/") or parsed.query or parsed.fragment:
        raise RuntimeError("metravel-auth: configure/origin")
    return "https://metravel.by"


def token():
    import struct
    root = pathlib.Path(__file__).resolve().parents[4]
    reader, writer = os.pipe()
    child = None
    try:
        frame = json.dumps({"v": 1, "op": "token", "profile": "owner", "expectedUserId": 1, "origin": _origin()}).encode()
        child = subprocess.Popen(["node", str(root / "scripts/lib/metravel-token-bridge.js"), str(writer)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, pass_fds=(writer,))
        os.close(writer); writer = -1
        out, err = child.communicate(struct.pack(">I", len(frame)) + frame, timeout=45)
        if child.returncode or out:
            raise RuntimeError("metravel-auth: request/authentication")
        raw = os.read(reader, 16389)
        if len(raw) < 4 or struct.unpack(">I", raw[:4])[0] != len(raw) - 4 or len(raw) > 16388:
            raise RuntimeError("metravel-auth: request/response")
        result = json.loads(raw[4:])
        value = result.get("token")
        if result.get("v") != 1 or result.get("userId") != 1 or not isinstance(value, str) or not value or len(value) > 4096 or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value):
            raise RuntimeError("metravel-auth: request/response")
        return value
    except Exception:
        if child is not None and child.poll() is None:
            child.kill(); child.communicate()
        raise RuntimeError("metravel-auth: request/authentication") from None
    finally:
        os.close(reader)
        if writer >= 0: os.close(writer)


def _authenticated(method, endpoint, body=None, content_type=None):
    _origin()
    if not isinstance(endpoint, str) or not endpoint.startswith("/") or endpoint.startswith("//") or any(ord(c) <= 32 or ord(c) == 127 for c in endpoint) or "\\" in endpoint:
        raise RuntimeError("metravel-auth: request/origin")
    request = urllib.request.Request(BASE.rstrip("/") + endpoint, data=body, method=method)
    request.add_header("Authorization", "Token " + token())
    if content_type: request.add_header("Content-Type", content_type)
    try:
        with urllib.request.build_opener(_NoAuthRedirect()).open(request, timeout=15) as response:
            result = response.read(16777217)
            if len(result) > 16777216: raise RuntimeError("metravel-auth: request/response")
            return response.status, result.decode()
    except urllib.error.HTTPError as error:
        # Error bodies can reflect credentials; downstream callers get safe data.
        return error.code, "metravel-auth: request/response"
    except Exception:
        raise RuntimeError("metravel-auth: request/network") from None


def req(method, path, data=None):
    return _authenticated(method, path, json.dumps(data).encode() if data is not None else None, "application/json" if data is not None else None)

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
SENTINEL = "__draft_placeholder__"   # маркер визарда: движок его не пишет, встречный — обнуляет

def parse_trip_date(value, today=None):
    """`date:` черновика → {year, month, created_at, exact_day}. Формы: YYYY-MM-DD, YYYY-MM, «A..B».
    Без точного дня — 1-е число месяца; несколько месяцев — created_at по самому раннему (#2046)."""
    s = (value or "").strip().strip("\"'")
    if not s: return None
    parts = [x.strip() for x in s.split("..")]
    if len(parts) > 2: raise ValueError(f"date: {s!r} — ожидается YYYY-MM-DD, YYYY-MM или диапазон A..B")
    def one(x):
        m = re.fullmatch(r"(\d{4})-(\d{2})(?:-(\d{2}))?", x)
        if not m: raise ValueError(f"date: {x!r} — ожидается YYYY-MM-DD или YYYY-MM")
        return datetime.date(int(m[1]), int(m[2]), int(m[3] or 1)), bool(m[3])
    (start, exact), (end, _) = one(parts[0]), one(parts[-1])
    if end < start: raise ValueError(f"date: {s!r} — конец раньше начала")
    if start > (today or datetime.date.today()): raise ValueError(f"date: {s!r} — дата в будущем, бэкенд ответит 400")
    months, y, mo = [], start.year, start.month
    while (y, mo) <= (end.year, end.month) and len(months) < 12:
        if mo not in months: months.append(mo)
        y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
    return {"year": start.year, "month": months, "created_at": start.isoformat() + "T12:00:00Z", "exact_day": exact}

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
    return title, body, countries, cats, points, parse_trip_date(fm.get("date"))

def inline(s):
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)
    return s.replace("`","")

# Шаблонные заголовки убираем (текст оставляем) — чтобы читалось как живой текст.
DROP_H = {"вступление","введение","итог","итоги","заключение","что увидели",
          "как прошло","как прошёл день","как прошел день","о поездке","точки",
          "резюме","описание","места","места (точки на карте)","точки маршрута"}
# Переименовываем в естественные.
RENAME_H = {"маршрут по точкам":"Маршрут","полезное":"Если соберётесь",
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

def _get_detail(tid):
    _,t=req("GET",f"/travels/{tid}/"); d=json.loads(t)
    return d.get("data",d) if isinstance(d,dict) else {}

def _clean_text(v):
    return None if v in (None, "", SENTINEL) else v

def _markers_from_detail(d, recategorize=False):
    """Точки из детали: coordsMeTravel (id, координаты, категории, фото) — как buildUpsertPayload в seo-edit.js.
    Пустые категории дозаполняются по имени; recategorize=True пересчитывает все."""
    cs=d.get("countries") or [160]; c=cs[0] if cs else 160; out=[]
    points=d.get("coordsMeTravel")
    if points is None:   # деталь без coordsMeTravel — координаты из travelAddress[].coord
        points=[]
        for a in (d.get("travelAddress") or []):
            mm=re.match(r"\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", a.get("coord") or "")
            if mm: points.append({"id":a.get("id"),"lat":mm.group(1),"lng":mm.group(2),"address":a.get("address"),"categories":a.get("categories")})
    for p in points:
        if p.get("lat") is None or p.get("lng") is None: continue
        cats=p.get("categories") or []
        out.append({"id":p.get("id"),"lat":float(p["lat"]),"lng":float(p["lng"]),"address":p.get("address") or "",
                    "country":p.get("country") or c,"image":p.get("image"),
                    "categories":point_categories(p.get("address")) if recategorize or not cats else cats})
    return out

def _payload_from_detail(d, **over):
    """Эхо всех полей детали (publish/moderation/month/plus… не теряются); override — только переданное."""
    payload={"id":d.get("id"),"name":d.get("name"),"description":d.get("description") or "",
      "meta_description":d.get("meta_description"),"year":d.get("year"),
      "categories":d.get("categories") or [20],"countries":d.get("countries") or [160],
      "coordsMeTravel":_markers_from_detail(d),"travelAddress":[],"gallery":[],
      "transports":d.get("transports") or [],"month":d.get("month") or [],"complexity":d.get("complexity") or [],
      "companions":d.get("companions") or [],"over_nights_stay":d.get("over_nights_stay") or [],
      "thumbs200ForCollectionArr":[],"travelImageThumbUrlArr":[],"travelImageAddress":[],
      "minus":_clean_text(d.get("minus")),"plus":_clean_text(d.get("plus")),
      "recommendation":_clean_text(d.get("recommendation")),"youtube_link":_clean_text(d.get("youtube_link")),
      "publish":bool(d.get("publish")),"moderation":bool(d.get("moderation")),"visa":bool(d.get("visa")),
      "number_days":d.get("number_days"),"number_peoples":d.get("number_peoples"),"budget":d.get("budget")}
    payload.update(over)
    return payload

def _same_month(stamp, year, months):
    m=re.match(r"(\d{4})-(\d{2})", stamp or "")
    return bool(m) and int(m[1])==year and int(m[2]) in months

def upsert(path, existing_id=None, year=None, dry_run=False):
    title, body, countries, cats, points, trip = parse_md(path)
    html = strip_meta(md_to_html(body))
    c = countries[0] if countries else 160
    markers=[{"id":None,"lat":la,"lng":ln,"address":nm,"country":c,"categories":point_categories(nm),"image":None} for (nm,la,ln) in points]
    detail=None
    if existing_id:
        detail=_get_detail(existing_id)
        if not detail.get("id"): print(f"  {existing_id}: нет данных — upsert не выполнен"); return None
        # id точек сохраняются (ближайшая координата) — фото точек не теряются
        pool=[(float(p["lat"]),float(p["lng"]),p.get("id"),p.get("image")) for p in (detail.get("coordsMeTravel") or []) if p.get("lat") is not None]
        for mk in markers:
            bi=-1; bd=1e18
            for i,(la2,lo2,_pid,_img) in enumerate(pool):
                dd=(mk["lat"]-la2)**2+(mk["lng"]-lo2)**2
                if dd<bd: bd=dd; bi=i
            if bi>=0 and bd < 0.002**2:
                _,_,mk["id"],mk["image"]=pool.pop(bi)
    over={"name":title,"description":html,"coordsMeTravel":markers}
    if cats or not detail: over["categories"]=cats or [20]
    if countries or not detail: over["countries"]=countries or [160]
    if trip:
        over["year"]=trip["year"]; over["month"]=trip["month"]
        stored=(detail or {}).get("created_at")
        if not (stored and not trip["exact_day"] and _same_month(stored, trip["year"], trip["month"])):
            over["created_at"]=trip["created_at"]
    elif not (detail or {}).get("month"):
        print("  ОТКАЗ: в черновике нет `date:` (YYYY-MM-DD) — month и created_at не из чего взять. Добавь дату поездки.")
        return None
    if year: over["year"]=int(year)
    if detail:
        payload=_payload_from_detail(detail, **over)
    else:
        payload=_payload_from_detail({"id":None,"publish":False,"moderation":False}, **over)
    if dry_run:
        print(json.dumps({k:v for k,v in payload.items() if k!="description"}, ensure_ascii=False, indent=1))
        print(f"  dry-run: description {len(html)} симв., PUT не выполнен")
        return payload
    st,txt=req("PUT","/travels/upsert/", payload)
    nid=None
    try: nid=json.loads(txt).get("id")
    except Exception: pass
    print(f"[{st}] upsert id={nid} pts={len(markers)} cats={payload['categories']} ctry={payload['countries']} month={payload['month']} :: {title[:50]}")
    if st>=400: print("   ERR:", txt[:300])
    return nid

def recat(tid):
    """Дозаполнить категории точек без категории + почистить технические фразы. Остальные поля — эхом."""
    d=_get_detail(tid)
    if not d.get("name"): print(f"  {tid}: skip (нет данных)"); return
    markers=_markers_from_detail(d)
    desc=strip_meta(d.get("description") or "")
    st,txt=req("PUT","/travels/upsert/",_payload_from_detail(d, description=desc, coordsMeTravel=markers))
    print(f"  [{st}] recat {tid}: точек {len(markers)} (с категориями), desc {len(desc)}")
    return st

def _put_with_desc(d, new_desc):
    """PUT статьи с новым описанием; остальное (точки, галерея, publish, month, plus…) — эхом детали."""
    return req("PUT","/travels/upsert/",_payload_from_detail(d, description=new_desc))

def _norm_url(u):
    if not u: return None
    if u.startswith("http://"): u="https://"+u[7:]
    elif u.startswith("/"): u="https://metravel.by"+u
    return u

def _tokens(s):
    return set(w for w in re.findall(r"[A-Za-zА-Яа-яёЁ]{4,}", (s or "").lower()))

def _fetch_as_jpeg(url):
    """Скачать первопартийную картинку metravel.by и сохранить JPEG для перезаливки → (путь, (w, h))."""
    from PIL import Image
    if not (url or "").startswith("https://metravel.by/"): raise RuntimeError("descimg: только картинки metravel.by")
    request=urllib.request.Request(url, headers={"User-Agent":"metravel-publish/1.0"})
    with urllib.request.build_opener(_NoAuthRedirect()).open(request, timeout=30) as response:
        data=response.read(33554433)
    im=Image.open(io.BytesIO(data)).convert("RGB")
    dst=os.path.join(TMP,"d_%s.jpg"%hashlib.md5(url.encode()).hexdigest())
    im.save(dst,"JPEG",quality=92)
    return dst, im.size

def _desc_figure(src_url, tid, alt):
    """Перезалить кадр в collection=description и вернуть плоский <p><img> (address-image в тело не попадает)."""
    path,(w,h)=_fetch_as_jpeg(src_url)
    code,url=upload_image(path,"description",tid)
    url=_norm_url(url)
    if code!="200" and code!="201" or not url:
        print(f"    upload [{code}] не дал url — кадр {src_url} пропущен"); return None
    return f'<p><img src="{_html.escape(url)}" width="{w}" height="{h}" alt="{_html.escape(alt)}" /></p>'

def desc_images(tid, n=6):
    """Вставить в текст фото точек: каждый кадр перезаливается в collection=description,
    alt = имя точки (или подпись галереи / заголовок раздела). Где заголовок совпадает с
    названием точки — её фото; остальные по порядку. Идемпотентно по alt."""
    d=_get_detail(tid)
    if not d.get("name"): print(f"  {tid}: нет данных"); return
    # прежние вставки движка (<p class="mt-img"> с address-image и пустым alt) снимаются
    desc=re.sub(r'<p class="mt-img">.*?</p>','', d.get("description","") or "")
    have={_html.unescape(a).strip().lower() for a in re.findall(r'<img[^>]*\balt="([^"]*)"', desc)}
    pts=[]
    for a in (d.get("travelAddress") or []):
        u=a.get("travelImageThumbUrl") or ""
        if u and not u.rstrip("/").endswith("address-image"):
            pts.append(((a.get("address") or "").strip(), _norm_url(u)))
    if not pts:
        # запасной вариант: фото к точкам нет — кадры галереи (тоже перезаливкой)
        gal=[g for g in (d.get("gallery") or []) if isinstance(g,dict) and g.get("url")]
        pts=[((g.get("caption") or "").strip(), _norm_url(g["url"])) for g in gal[::max(1,len(gal)//n)][:n]]
        if not pts: print(f"  {tid}: нет фото"); return
    pts=[(name,url) for name,url in pts if not name or name.lower() not in have]
    heads=[(m.group(1), m.end()) for m in re.finditer(r"<h[23]>(.*?)</h[23]>", desc)]
    used=set(); placement={}   # pos -> (url, alt)
    for text,pos in heads:           # 1) сопоставление по названию
        ht=_tokens(text)
        for i,(addr,url) in enumerate(pts):
            if i not in used and ht & _tokens(addr):
                placement[pos]=(url, addr); used.add(i); break
    rem=[i for i in range(len(pts)) if i not in used]
    for text,pos in heads:           # 2) остальные — в заголовки без фото, по порядку
        if pos in placement or not rem: continue
        i=rem.pop(0); placement[pos]=(pts[i][1], pts[i][0] or re.sub(r"<[^>]+>","",text).strip())
    if not heads:                    # 3) нет заголовков — после первых абзацев
        ends=[m.end() for m in re.finditer(r"</p>", desc)]
        for pos,(name,url) in zip(ends, pts[:n]): placement[pos]=(url, name)
    nd=desc; inserted=0
    for pos in sorted(placement, reverse=True):
        url,alt=placement[pos]
        if not alt: print(f"    кадр {url} без имени точки/подписи — пропущен"); continue
        fig=_desc_figure(url, tid, alt)
        if fig: nd=nd[:pos]+fig+nd[pos:]; inserted+=1
    if nd==(d.get("description") or ""): print(f"  {tid}: нечего вставлять"); return
    st,_=_put_with_desc(d,nd)
    print(f"  [{st}] desc_images {tid}: вставлено {inserted} фото (перезалиты в description), точек с фото {len(pts)}")
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

# Один POST /api/upload — ~10 с CPU единственного ядра прода (варианты картинки синхронно).
# Без пауз заливка держит хост на 70–90 %, API живым пользователям — по 5 с, а monitor.sh
# шлёт владельцу «SYSTEM ALERT» (#2306). Поэтому строго последовательно и duty ≤ 50 %:
# следующая заливка стартует не раньше max(длительность прошлой, 10 с) после её конца.
UPLOAD_MIN_PAUSE_S = 10
_LAST_UPLOAD = {"end": None, "took": 0.0}

def _pace_upload():
    if _LAST_UPLOAD["end"] is None: return
    wait = _LAST_UPLOAD["end"] + max(_LAST_UPLOAD["took"], UPLOAD_MIN_PAUSE_S) - time.monotonic()
    if wait > 0: time.sleep(wait)

def upload_image(file, collection, id_):
    import secrets
    dst = _resize(file)
    boundary = "metravel-" + secrets.token_hex(18)
    filename = os.path.basename(dst).replace('"', '%22').replace('\r', '%0D').replace('\n', '%0A')
    fields = [("collection", collection), ("id", str(id_))]
    parts = []
    for name, value in fields:
        parts.append(("--" + boundary + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + str(value) + '\r\n').encode())
    parts.append(("--" + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + filename + '"\r\nContent-Type: image/jpeg\r\n\r\n').encode())
    with open(dst, 'rb') as source: parts.append(source.read())
    parts.append(('\r\n--' + boundary + '--\r\n').encode())
    _pace_upload()
    started = time.monotonic()
    try:
        code, body = _authenticated("POST", "/upload", b''.join(parts), "multipart/form-data; boundary=" + boundary)
    finally:
        _LAST_UPLOAD["end"] = time.monotonic(); _LAST_UPLOAD["took"] = _LAST_UPLOAD["end"] - started
    try: url = json.loads(body).get("url")
    except Exception: url = None
    return str(code), url

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
        path=a[1]; eid=None; year=None
        if "--id" in a: eid=int(a[a.index("--id")+1])
        if "--year" in a: year=a[a.index("--year")+1]
        try:
            if upsert(path, eid, year, dry_run="--dry-run" in a) is None: sys.exit(2)
        except ValueError as error:
            sys.exit(f"  ОТКАЗ: {error}")
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
    main()
