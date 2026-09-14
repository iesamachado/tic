import { setupAuthListener } from "../../js/common/auth.js";
import { saveGameResult } from "../../js/common/db.js";
import { QUESTIONS } from "./questions.js";

// Game State
const GAME_ID = 'cc_trivial';
const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 15;

let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId') || null;
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = TIME_PER_QUESTION;
let timerInterval = null;
let selectedQuestions = [];
let isAnswering = false;

// DOM Elements
const screens = {
  start: document.getElementById('start-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen')
};

const UI = {
  score: document.getElementById('score'),
  questionCounter: document.getElementById('current-question'),
  timer: document.getElementById('timer'),
  questionText: document.getElementById('question-text'),
  answersGrid: document.getElementById('answers-grid'),
  finalScore: document.getElementById('final-score'),
  resultMessage: document.getElementById('result-message'),
  btnStart: document.getElementById('btn-start'),
  btnRestart: document.getElementById('btn-restart'),
  authWarning: document.getElementById('auth-warning')
};

// Auth Listener
setupAuthListener((user, profile) => {
  currentUser = user;
  if (!user) {
    UI.authWarning.style.display = 'block';
  } else {
    UI.authWarning.style.display = 'none';
  }
});

// Initialization
function initGame() {
  score = 0;
  currentQuestionIndex = 0;
  UI.score.innerText = score;
  
  // Select 10 random questions
  selectedQuestions = [...QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, TOTAL_QUESTIONS);
  
  showScreen('game');
  loadQuestion();
}

function loadQuestion() {
  isAnswering = false;
  timeLeft = TIME_PER_QUESTION;
  UI.timer.innerText = timeLeft;
  UI.questionCounter.innerText = currentQuestionIndex + 1;
  
  const q = selectedQuestions[currentQuestionIndex];
  UI.questionText.innerText = q.question;
  
  // Shuffle answers
  const answers = [q.correct, ...q.incorrect];
  answers.sort(() => 0.5 - Math.random());
  
  UI.answersGrid.innerHTML = '';
  answers.forEach(ans => {
    const btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.innerText = ans;
    btn.onclick = () => handleAnswer(btn, ans === q.correct);
    UI.answersGrid.appendChild(btn);
  });
  
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  if (isAnswering) return;
  
  timeLeft--;
  UI.timer.innerText = timeLeft;
  
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    handleAnswer(null, false); // Time out
  }
}

function handleAnswer(selectedBtn, isCorrect) {
  if (isAnswering) return;
  isAnswering = true;
  clearInterval(timerInterval);
  
  // Highlight buttons
  const buttons = UI.answersGrid.querySelectorAll('.btn-answer');
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.innerText === selectedQuestions[currentQuestionIndex].correct) {
      btn.classList.add('correct');
    } else if (btn === selectedBtn && !isCorrect) {
      btn.classList.add('incorrect');
    }
  });
  
  if (isCorrect) {
    // Points = 10 base + time bonus
    const points = 10 + timeLeft;
    score += points;
    UI.score.innerText = score;
  }
  
  setTimeout(nextQuestion, 2000);
}

function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < TOTAL_QUESTIONS) {
    loadQuestion();
  } else {
    endGame();
  }
}

async function endGame() {
  showScreen('result');
  UI.finalScore.innerText = score;
  
  // Max possible score ~ 250 (10 questions * 25 max points)
  let msg = '';
  if (score > 200) msg = "¡Impresionante! Eres un experto en propiedad intelectual.";
  else if (score > 100) msg = "¡Bien hecho! Tienes los conceptos claros.";
  else msg = "¡Cuidado! Vas a meter a la radio en un problema legal. ¡Repasa la teoría!";
  
  UI.resultMessage.innerText = msg;
  
  if (currentUser) {
    try {
      await saveGameResult(GAME_ID, currentUser.uid, classId, score);
      console.log('Puntuación guardada exitosamente.');
    } catch (e) {
      console.error('Error guardando puntuación:', e);
    }
  }
}

function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[screenName].classList.remove('hidden');
}

// Event Listeners
UI.btnStart.onclick = initGame;
UI.btnRestart.onclick = initGame;
