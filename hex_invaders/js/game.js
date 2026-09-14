import { setupAuthListener } from "../../js/common/auth.js";
import { saveGameResult } from "../../js/common/db.js";

const GAME_ID = 'hex_invaders';
let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId') || null;

let score = 0;
let lives = 3;
let targetHex = "";
let isPlaying = false;

// Elementos
const ui = {
  startScreen: document.getElementById('start-screen'),
  gameScreen: document.getElementById('game-screen'),
  resultScreen: document.getElementById('result-screen'),
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  targetHex: document.getElementById('target-hex'),
  alienZone: document.getElementById('alien-zone'),
  finalScore: document.getElementById('final-score')
};

// Auth
setupAuthListener((user, profile) => {
  currentUser = user;
  if (!user) {
    document.getElementById('auth-warning').style.display = 'block';
  } else {
    document.getElementById('auth-warning').style.display = 'none';
  }
});

// Colores fáciles de identificar para empezar
const baseColors = [
  { hex: "#FF0000", name: "Rojo puro" },
  { hex: "#00FF00", name: "Verde puro" },
  { hex: "#0000FF", name: "Azul puro" },
  { hex: "#FFFF00", name: "Amarillo (R+V)" },
  { hex: "#FF00FF", name: "Magenta (R+A)" },
  { hex: "#00FFFF", name: "Cian (V+A)" },
  { hex: "#FFFFFF", name: "Blanco" },
  { hex: "#000000", name: "Negro" },
  { hex: "#888888", name: "Gris" }
];

function getRandomHex() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function startGame() {
  score = 0;
  lives = 3;
  isPlaying = true;
  updateHUD();
  ui.startScreen.classList.add('hidden');
  ui.resultScreen.classList.add('hidden');
  ui.gameScreen.classList.remove('hidden');
  nextRound();
}

function nextRound() {
  if (!isPlaying) return;
  ui.alienZone.innerHTML = '';
  
  // Decide si usar un color fácil (70% prob al inicio) o uno random oscuro/claro
  let correctColor = "";
  if (Math.random() > 0.3 || score < 50) {
    correctColor = baseColors[Math.floor(Math.random() * baseColors.length)].hex;
  } else {
    correctColor = getRandomHex();
  }
  
  targetHex = correctColor;
  ui.targetHex.innerText = targetHex;

  // Generar opciones falsas
  let options = [correctColor];
  while (options.length < 3) {
    let rand = getRandomHex();
    if (!options.includes(rand)) {
      options.push(rand);
    }
  }
  
  // Barajar
  options.sort(() => Math.random() - 0.5);

  // Crear Aliens y animarlos
  const positions = ['10%', '42%', '75%'];
  let fallSpeed = 1 + (score / 50); // Aumenta velocidad con los puntos
  
  options.forEach((color, index) => {
    const alien = document.createElement('div');
    alien.className = 'alien';
    alien.style.backgroundColor = color;
    alien.style.left = positions[index];
    alien.innerText = "👾";
    alien.dataset.top = -80; // Empieza fuera de pantalla
    alien.dataset.color = color;
    
    if (color === "#000000") {
      alien.style.border = "2px solid #fff";
    }

    alien.onclick = (e) => shootAlien(alien, color === correctColor, e);
    ui.alienZone.appendChild(alien);
  });

  // Empezar el game loop de caída
  if (window.fallInterval) clearInterval(window.fallInterval);
  window.fallInterval = setInterval(() => {
    if (!isPlaying) {
      clearInterval(window.fallInterval);
      return;
    }
    const aliens = document.querySelectorAll('.alien');
    let hitBottom = false;
    
    aliens.forEach(alien => {
      let currentTop = parseFloat(alien.dataset.top);
      currentTop += fallSpeed;
      alien.dataset.top = currentTop;
      alien.style.top = currentTop + 'px';
      
      if (currentTop > 300) { // Límite inferior
        hitBottom = true;
      }
    });

    if (hitBottom) {
      clearInterval(window.fallInterval);
      handleHit(false, true); // Fallo por invasión
    }
  }, 30);
;
}

function shootAlien(alienDiv, isCorrect, event) {
  if (!isPlaying) return;
  
  // Dibujar láser desde el centro inferior hasta el alien
  const laser = document.createElement('div');
  laser.className = 'laser';
  const alienRect = alienDiv.getBoundingClientRect();
  const zoneRect = ui.alienZone.getBoundingClientRect();
  
  // Posición final del láser
  const targetX = alienRect.left + (alienRect.width/2) - zoneRect.left;
  const targetY = alienRect.top + (alienRect.height/2) - zoneRect.top;
  
  laser.style.left = targetX + 'px';
  laser.style.height = (zoneRect.height - targetY) + 'px';
  laser.style.top = targetY + 'px';
  ui.alienZone.appendChild(laser);
  
  setTimeout(() => {
    laser.remove();
    
    // Si acierta, explota y gana. Si falla, explota la nave equivocada pero la invasión continúa.
    if (isCorrect) {
      alienDiv.innerText = "💥";
      alienDiv.style.backgroundColor = "transparent";
      alienDiv.style.border = "none";
      alienDiv.style.boxShadow = "none";
      setTimeout(() => handleHit(true, false), 150);
    } else {
      // Nave equivocada: No explota, el láser rebota (feedback visual) y sigue cayendo
      alienDiv.style.transform = "rotate(15deg) scale(0.9)";
      setTimeout(() => alienDiv.style.transform = "rotate(0deg) scale(1)", 150);
    }

  }, 100);
}

function handleHit(isCorrect, isCollision) {
  if (!isPlaying) return;
  if (window.fallInterval) clearInterval(window.fallInterval);

  if (isCorrect) {
    score += 10;
    ui.gameScreen.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    setTimeout(() => ui.gameScreen.style.backgroundColor = '', 200);
    updateHUD();
    nextRound();
  } else {
    lives--;
    ui.gameScreen.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    setTimeout(() => ui.gameScreen.style.backgroundColor = '', 200);
    updateHUD();
    
    if (lives <= 0) {
      endGame();
    } else {
      // Si fue colisión (invasión), un alert rápido o directamente pasa a la sig
      setTimeout(() => nextRound(), 300);
    }
  }
}

function updateHUD() {
  ui.score.innerText = score;
  ui.lives.innerText = "❤️".repeat(lives);
}

async function endGame() {
  isPlaying = false;
  ui.gameScreen.classList.add('hidden');
  ui.resultScreen.classList.remove('hidden');
  ui.finalScore.innerText = score;

  if (currentUser) {
    try {
      await saveGameResult(GAME_ID, currentUser.uid, classId, score);
      console.log('Puntuación Hex Invaders guardada.');
    } catch (e) {
      console.error('Error al guardar puntuación:', e);
    }
  }
}

// Botones
document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-restart').onclick = startGame;
