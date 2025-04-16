import os
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin, quote
from collections import OrderedDict
from io import BytesIO
from PIL import Image

# === CONFIGURATION ===
base_dir = os.path.dirname(__file__)
assets_dir = os.path.join(base_dir, "assets")
image_dir = os.path.join(assets_dir, "images")
audio_dir = os.path.join(assets_dir, "audio")
silhouette_dir = os.path.join(image_dir, "silhouette")
life_icon_dir = os.path.join(image_dir, "lifehistory_icons")

os.makedirs(image_dir, exist_ok=True)
os.makedirs(audio_dir, exist_ok=True)
os.makedirs(silhouette_dir, exist_ok=True)
os.makedirs(life_icon_dir, exist_ok=True)

def sanitize_filename(text):
    return "".join(c if c.isalnum() else "_" for c in text.lower())

def download_file(url, dest_folder, filename):
    ext = os.path.splitext(urlparse(url).path)[1]
    local_path = os.path.join(dest_folder, f"{filename}{ext}")
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            with open(local_path, 'wb') as f:
                f.write(response.content)
            print(f"✅ {filename}")
            return local_path
    except Exception as e:
        print(f"⚠️ Erreur download {filename} : {e}")
    return None

def extract_best_image(data_interchange):
    if not data_interchange:
        return None
    parts = [p.strip("[] ").split(",")[0] for p in data_interchange.split("],") if p]
    return parts[-1] if parts else None

def get_wikipedia_description(nom):
    try:
        url_fr = f"https://fr.wikipedia.org/api/rest_v1/page/summary/{quote(nom)}"
        res = requests.get(url_fr, timeout=10).json()
        if 'extract' in res:
            return res['extract']
        url_en = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(nom)}"
        res = requests.get(url_en, timeout=10).json()
        return res.get("extract", "Description indisponible.")
    except:
        return "Description indisponible."

def telecharger_audio(sci):
    try:
        url = f"https://xeno-canto.org/api/2/recordings?query={quote(sci)}"
        res = requests.get(url, timeout=10).json()
        recs = res.get("recordings", [])
        if not recs:
            return None
        best = next((r for r in recs if r.get("q") == "A"), recs[0])
        file_url = best["file"]
        if not file_url.startswith("http"):
            file_url = "https:" + file_url
        audio_data = requests.get(file_url).content
        path = os.path.join(audio_dir, f"{sanitize_filename(sci)}.mp3")
        with open(path, "wb") as f:
            f.write(audio_data)
        return path
    except:
        return None

def telecharger_images_fallback(nom, max_images=3):
    try:
        nom_url = nom.lower().replace(" ", ".")
        url = f"https://www.oiseaux.net/oiseaux/photos/{nom_url}.html"
        res = requests.get(url, timeout=10)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, "html.parser")
        anchors = soup.find_all("a", href=True)
        images, count = [], 0
        for a in anchors:
            img_tag = a.find("img")
            if not img_tag:
                continue
            src = img_tag.get("data-src")
            if not src:
                continue
            img_url = "https://www.oiseaux.net" + src.replace("..", "")
            try:
                resp = requests.get(img_url, timeout=10)
                if "image" not in resp.headers.get("Content-Type", ""):
                    continue
                image = Image.open(BytesIO(resp.content)).convert("RGB")
                image.thumbnail((1600, 1600), Image.LANCZOS)
                path = os.path.join(image_dir, f"{sanitize_filename(nom)}_fallback_{count}.jpg")
                image.save(path, format="JPEG", optimize=True, quality=85)
                images.append(path)
                count += 1
                if count >= max_images:
                    break
            except:
                continue
        return images
    except:
        return []

def get_english_name(nom_fr, sci):
    for entry in translations:
        if entry.get("nom") == nom_fr or entry.get("sci") == sci:
            return entry.get("en")
    return None

with open("birds.json", "r", encoding="utf-8") as f:
    birds_data = json.load(f)

with open("fr_to_en_complete_clean.json", "r", encoding="utf-8") as f:
    translations = json.load(f)

def enrich_bird(bird):
    nom_fr, sci = bird["nom"], bird["sci"]
    nom_en = get_english_name(nom_fr, sci)

    if not nom_en:
        return {"error": "nom anglais manquant"}

    bird_id = sanitize_filename(sci)
    slug = "_".join(nom_en.split())
    url = f"https://www.allaboutbirds.org/guide/{slug}"
    life_url = f"{url}/lifehistory"
    overview_url = f"{url}/overview"

    print(f"\n🔎 Scraping {nom_fr} → {url}")
    headers = {"User-Agent": "Mozilla/5.0"}
    page_res = requests.get(url, headers=headers)

    result = {
        "nom": nom_fr,
        "nom_en": nom_en,
        "sci": sci,
        "hero_image": None,
        "hero_menu_images": [],
        "sound": None,
        "silhouette_image": None,
        "description": None,
        "cool_facts": [],
        "tags_quick": [],
        "lifehistory_tags": [],
        "life_history_texts": OrderedDict(),
        "image_credits": []
    }

    if page_res.status_code == 200:
        try:
            soup = BeautifulSoup(page_res.text, "html.parser")
            hero_section = soup.find("section", class_="hero-wrap")
            if hero_section:
                hero_url = extract_best_image(hero_section.get("data-interchange", ""))
                if hero_url:
                    result["hero_image"] = download_file(hero_url, image_dir, f"{bird_id}_hero")
                    result["image_credits"].append("allaboutbirds")
            hero_menu = soup.select(".hero-menu img")
            for i, img_tag in enumerate(hero_menu[:3]):
                menu_url = extract_best_image(img_tag.get("data-interchange", ""))
                if menu_url:
                    path = download_file(menu_url, image_dir, f"{bird_id}_menu{i+1}")
                    if path:
                        result["hero_menu_images"].append(path)
                        result["image_credits"].append("allaboutbirds")
            sound_div = soup.select_one("div.jp-jplayer.player-audio")
            if sound_div and sound_div.has_attr("name"):
                sound_url = sound_div["name"]
                result["sound"] = download_file(sound_url, audio_dir, f"{bird_id}_sound1")
            silhouette_img = soup.find("img", alt=lambda x: x and "silhouette" in x.lower())
            if silhouette_img and silhouette_img.get("src"):
                sil_url = urljoin(url, silhouette_img["src"])
                result["silhouette_image"] = download_file(sil_url, silhouette_dir, f"{bird_id}_silhouette")
            h2 = soup.find("h2", class_="overview")
            if h2 and h2.get_text(strip=True) == "Basic Description":
                p = h2.find_next_sibling("p")
                while p and not p.get_text(strip=True):
                    p = p.find_next_sibling("p")
                if p:
                    result["description"] = p.get_text(strip=True)
            result["tags_quick"] = [a.get_text(strip=True) for a in soup.select(".BirdGuideSidebar-characteristics__value")]
            for li in soup.select("ul.LH-menu li"):
                spans = li.select("span.text-label span")
                if len(spans) >= 2:
                    tag_type = spans[0].get_text(strip=True)
                    tag_value = spans[1].get_text(strip=True)
                    icon_img = li.select_one("img")
                    icon_url = urljoin(url, icon_img["src"]) if icon_img else None
                    icon_local = download_file(icon_url, life_icon_dir, f"{bird_id}_{tag_type.lower()}") if icon_url else None
                    result["lifehistory_tags"].append({"type": tag_type, "value": tag_value, "icon": icon_local})
            life_res = requests.get(life_url, headers=headers)
            if life_res.status_code == 200:
                life_soup = BeautifulSoup(life_res.text, "html.parser")
                for section_id in ["habitat", "food", "behavior", "nesting", "conservation"]:
                    section = life_soup.find("section", {"aria-labelledby": section_id})
                    if section:
                        for p in section.find_all("p"):
                            text = p.get_text(strip=True)
                            if text:
                                result["life_history_texts"][section_id] = text
                                break
            overview_res = requests.get(overview_url, headers=headers)
            if overview_res.status_code == 200:
                overview_soup = BeautifulSoup(overview_res.text, "html.parser")
                cool_fact_div = overview_soup.find("div", class_="accordion-content")
                if cool_fact_div:
                    result["cool_facts"] = [li.get_text(strip=True) for li in cool_fact_div.find_all("li")]
        except Exception as e:
            print(f"⚠️ Fallback partiel pour {nom_fr}: {e}")

    if not result["description"]:
        result["description"] = get_wikipedia_description(nom_fr)
    if not result["sound"]:
        result["sound"] = telecharger_audio(sci)
    if not result["hero_image"] and not result["hero_menu_images"]:
        fallback_imgs = telecharger_images_fallback(nom_fr, max_images=4)
        result["hero_menu_images"].extend(fallback_imgs)
        if fallback_imgs:
            result["hero_image"] = fallback_imgs[0]
            result["image_credits"].extend(["oiseaux.net"] * len(fallback_imgs))
    return result

enriched_birds, errors = [], []
for bird in birds_data:
    enriched = enrich_bird(bird)
    if "error" in enriched:
        print(f"❌ {bird['nom']} ({bird['sci']}) → {enriched['error']}")
        errors.append({**bird, "error": enriched["error"]})
    else:
        print(f"✅ {bird['sci']} enrichi")
        enriched_birds.append(enriched)

with open("birds_enriched_allaboutbirds.json", "w", encoding="utf-8") as f:
    json.dump(enriched_birds, f, indent=2, ensure_ascii=False)
with open("birds_enriched_errors.json", "w", encoding="utf-8") as f:
    json.dump(errors, f, indent=2, ensure_ascii=False)

print("\n🎉 Scraping terminé.")
print(f"✅ {len(enriched_birds)} espèces enrichies")
print(f"⚠️ {len(errors)} erreurs — voir birds_enriched_errors.json")
