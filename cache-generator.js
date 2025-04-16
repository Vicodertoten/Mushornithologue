const fs = require("fs");
const path = require("path");

const birds = JSON.parse(fs.readFileSync("birds_enriched_allaboutbirds.json", "utf-8"));

let filesToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/birds_enriched_allaboutbirds.json",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Ajouter tous les fichiers audio et image
birds.forEach(bird => {
  if (bird.sound) filesToCache.push(`/${bird.sound}`);
  if (bird.hero_image) filesToCache.push(`/${bird.hero_image}`);
  if (bird.silhouette_image) filesToCache.push(`/${bird.silhouette_image}`);
  if (bird.hero_menu_images && bird.hero_menu_images.length) {
    bird.hero_menu_images.forEach(img => filesToCache.push(`/${img}`));
  }
  if (bird.lifehistory_tags && bird.lifehistory_tags.length) {
    bird.lifehistory_tags.forEach(tag => {
      if (tag.icon) filesToCache.push(`/${tag.icon}`);
    });
  }
});

// Supprimer les doublons
filesToCache = [...new Set(filesToCache)];

const swTemplate = `const CACHE_NAME = "ornitho-v1";
const FILES_TO_CACHE = ${JSON.stringify(filesToCache, null, 2)};

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
`;

fs.writeFileSync("sw.js", swTemplate);
console.log("✅ Service worker mis à jour avec tous les fichiers à cacher !");
