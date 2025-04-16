
let birdsData = [];

fetch("birds_enriched_allaboutbirds.json")
  .then((res) => res.json())
  .then((data) => {
    birdsData = data;
    renderCards(data);
  });

function renderCards(data) {
  const grid = document.getElementById("speciesGrid");
  grid.innerHTML = "";

  data.forEach((bird, index) => {
    const card = document.createElement("div");
    card.className = "card";

    const imgSrc = bird.hero_image || bird.hero_menu_images?.[0] || bird.images?.[0] || bird.fallback_images?.[0] || "placeholder.jpg";

    card.innerHTML = `
      <img src="${imgSrc}" alt="${bird.nom}">
      <div class="card-content">
        <h2>${bird.nom}</h2>
        <p><em>${bird.sci}</em></p>
        <button onclick="openModal(${index})">En savoir +</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function openModal(index) {
  const bird = birdsData[index];
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");
  modal.dataset.index = index;
  modal.dataset.img = 0;

  const allImages = [
    ...(bird.hero_image ? [bird.hero_image] : []),
    ...(bird.hero_menu_images || []),
    ...(bird.images || []),
    ...(bird.fallback_images || [])
  ];

  // 👉 Important : on n'ajoute ici QUE le contenu de la fiche, pas les flèches !
  content.innerHTML = `
    <div class="carousel" style="position: relative;">
      <button class="carousel-btn left" onclick="changeModalImage(${index}, -1)">&#10094;</button>
      <img id="modalCarouselImage" src="${allImages[0]}" style="max-width: 100%; margin-bottom: 1rem;">
      <button class="carousel-btn right" onclick="changeModalImage(${index}, 1)">&#10095;</button>
    </div>
    <audio controls src="${bird.sound}" style="width: 100%; margin-bottom: 1rem;"></audio>
    <h2>${bird.nom}</h2>
    <p><em>${bird.sci}</em> ${bird.nom_en ? ` - ${bird.nom_en}` : ""}</p>
    ${bird.silhouette_image ? `<img src="${bird.silhouette_image}" alt="Silhouette" style="max-width: 150px; float: right; margin-left: 1rem;" />` : ""}
    <p>${bird.description || ""}</p>
  `;

  if (bird.lifehistory_tags?.length) {
    content.innerHTML += `<div style="display: flex; flex-wrap: wrap; gap: 1rem; margin: 1.5rem 0;">`;
    bird.lifehistory_tags.forEach(tag => {
      const bg = tagColors[tag.type] || "#eee";
      content.innerHTML += `
        <div style="flex: 1 1 40%; display: flex; align-items: center; gap: 0.5rem; background: ${bg}; padding: 0.5rem; border-radius: 0.5rem;">
          <div style="background: ${bg}; padding: 0.25rem; border-radius: 0.25rem; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
            <img src="${tag.icon}" alt="${tag.type}" style="width: 42px; height: 42px;">
          </div>
          <strong>${tag.type}:</strong> ${tag.value}
        </div>
      `;
    });
    content.innerHTML += `</div>`;
  }

  for (const [key, val] of Object.entries(bird.life_history_texts || {})) {
    content.innerHTML += `
      <div style="margin-top: 1rem">
        <strong>${key.charAt(0).toUpperCase() + key.slice(1)} :</strong>
        <p>${val}</p>
      </div>
    `;
  }

  modal.classList.remove("hidden");
}

function changeModalImage(index, direction) {
  const bird = birdsData[index];
  const images = [
    ...(bird.hero_image ? [bird.hero_image] : []),
    ...(bird.hero_menu_images || []),
    ...(bird.images || []),
    ...(bird.fallback_images || [])
  ];
  const modal = document.getElementById("modal");
  let current = parseInt(modal.dataset.img || "0");
  current = (current + direction + images.length) % images.length;
  modal.dataset.img = current;
  document.getElementById("modalCarouselImage").src = images[current];
}

document.getElementById("closeModal").onclick = () => {
  document.getElementById("modal").classList.add("hidden");
};

function switchMode(mode) {
  document.getElementById('explorationSection').classList.toggle('hidden', mode !== 'exploration');
  document.getElementById('revisionSection').classList.toggle('hidden', mode !== 'revision');
}

// Script du quiz
let birds = [], currentIndex = 0, currentBird = null, currentImageIndex = 0, currentImages = [];
let score = 0, total = 0;
let resultMessage = null;
let recentBirds = [];
const maxRecent = 20;
const audioTrue = new Audio("assets/audio/true.mp3");
const audioFalse = new Audio("assets/audio/false.mp3");

const tagColors = {
  Habitat: "#AEDFF7",
  Nesting: "#F7D6AE",
  Food: "#D0F7AE",
  Behavior: "#F7AECF",
  Conservation: "#F7F3AE"
};


fetch("birds_enriched_allaboutbirds.json")
  .then((res) => res.json())
  .then((data) => {
    birds = data.filter(b => (b.hero_image || b.hero_menu_images?.length || b.images?.length || b.fallback_images?.length) && b.sound);
    shuffle(birds);
    loadQuestion();
  });

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function loadQuestion() {
  updateScoreBoard();
  document.getElementById("quizContent").innerHTML = "";
  do {
    currentBird = birds[currentIndex];
    currentIndex = (currentIndex + 1) % birds.length;
  } while (recentBirds.includes(currentBird.nom) && birds.length > maxRecent);
  recentBirds.push(currentBird.nom);
  if (recentBirds.length > maxRecent) recentBirds.shift();
  currentImageIndex = 0;
  currentImages = [
    ...(currentBird.hero_image ? [currentBird.hero_image] : []),
    ...(currentBird.hero_menu_images || []),
    ...(currentBird.images || []),
    ...(currentBird.fallback_images || [])
  ];
  renderCarousel();
  document.getElementById("quizContent").innerHTML += `
    <audio controls src="${currentBird.sound}" style="width: 100%;"></audio>
  `;
  document.getElementById("guessInput").value = "";
  document.getElementById("result").textContent = "";
  document.getElementById("guessInput").style.display = "inline-block";
  document.getElementById("validateButton").style.display = "inline-block";
  document.getElementById("guessInput").focus();
  setTimeout(() => {
    const input = document.getElementById("guessInput");
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
}

function renderCarousel() {
  document.getElementById("quizContent").innerHTML = `
    <div class="carousel">
      <button class="left" onclick="changeImage(-1)">&#10094;</button>
      <img id="carouselImage" src="${currentImages[0]}" alt="Image de l'oiseau">
      <button class="right" onclick="changeImage(1)">&#10095;</button>
    </div>
  `;
}

function changeImage(direction) {
  currentImageIndex = (currentImageIndex + direction + currentImages.length) % currentImages.length;
  document.getElementById("carouselImage").src = currentImages[currentImageIndex];
}

function checkAnswer() {
  const guess = document.getElementById("guessInput").value.trim().toLowerCase();
  const correct = currentBird.nom.toLowerCase();
  const resultDiv = document.getElementById("result");

  const isCorrect = guess === correct;
  const message = isCorrect ? "✅ Bonne réponse." : "❌ Mauvaise réponse.";
  const color = isCorrect ? "green" : "red";

  resultDiv.textContent = message;
  resultDiv.style.color = color;

  if (navigator.vibrate) {
    navigator.vibrate(isCorrect ? 100 : [100, 50, 100]);
  }  

  total++;
  updateScoreBoard();

  document.getElementById("guessInput").style.display = "none";
  document.getElementById("validateButton").style.display = "none";

  resultMessage = { text: message, color };

  showFullCard();
  setTimeout(() => {
    document.getElementById("quizContent").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 200);
  
}

function showFullCard() {
  let html = "";

  if (resultMessage) {
    html += `
      <div style="margin-bottom: 1rem">
        <div style="font-weight: bold; color: ${resultMessage.color};">${resultMessage.text}</div>
        <button onclick="nextQuestion()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #007BFF; color: white; border: none; border-radius: 0.5rem;">Suivant</button>
      </div>
    `;
    resultMessage = null;
  }

  html += `
    <h2>${currentBird.nom}</h2>
    <p><em>${currentBird.sci}</em> ${currentBird.nom_en ? ` - ${currentBird.nom_en}` : ""}</p>
    ${currentBird.silhouette_image ? `<img src="${currentBird.silhouette_image}" alt="Silhouette" style="max-width: 150px; float: right; margin-left: 1rem;" />` : ""}
    <p>${currentBird.description || ""}</p>
  `;

  if (currentBird.lifehistory_tags?.length) {
    html += `<div style="display: flex; flex-wrap: wrap; gap: 1rem; margin: 1.5rem 0;">`;
    currentBird.lifehistory_tags.forEach(tag => {
      const bg = tagColors[tag.type] || "#eee";
      html += `
        <div style="flex: 1 1 40%; display: flex; align-items: center; gap: 0.5rem; background: ${bg}; padding: 0.5rem; border-radius: 0.5rem;">
          <div style="background: ${bg}; padding: 0.25rem; border-radius: 0.25rem; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
            <img src="${tag.icon}" alt="${tag.type}" style="width: 42px; height: 42px;">
          </div>
          <strong>${tag.type}:</strong> ${tag.value}
        </div>
      `;
    });
    html += `</div>`;
  }

  for (const [key, val] of Object.entries(currentBird.life_history_texts || {})) {
    html += `
      <div style="margin-top: 1rem">
        <strong>${key.charAt(0).toUpperCase() + key.slice(1)} :</strong>
        <p>${val}</p>
      </div>
    `;
  }

  document.getElementById("quizContent").innerHTML += `<div style="margin-top: 2rem; text-align: left">${html}</div>`;
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= birds.length) {
    alert("Bravo ! Vous avez terminé toutes les espèces disponibles.");
    currentIndex = 0;
    shuffle(birds);
  }
  loadQuestion();
}

function updateScoreBoard() {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  document.getElementById("scoreBoard").textContent = `Score : ${score} / ${total} — Précision : ${percent}%`;
}

// Fermer la modale avec la touche Échap
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("modal");
    if (!modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
    }
  }
});

// Entrée = valider la réponse dans le mode révision
document.getElementById("guessInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    checkAnswer();
  }
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modal");
  if (modal.classList.contains("hidden")) return;

  let current = parseInt(modal.dataset.index);
  if (e.key === "ArrowRight") {
    current = (current + 1) % birdsData.length;
    openModal(current);
  } else if (e.key === "ArrowLeft") {
    current = (current - 1 + birdsData.length) % birdsData.length;
    openModal(current);
  } else if (e.key === "Escape") {
    modal.classList.add("hidden");
  }
});

function navigateModal(direction) {
  const modal = document.getElementById("modal");
  let current = parseInt(modal.dataset.index);
  current = (current + direction + birdsData.length) % birdsData.length;
  openModal(current);
}

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

