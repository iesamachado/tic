import { setupAuthListener } from "../../js/common/auth.js";
import { saveGameResult } from "../../js/common/db.js";


// Utilidad: Validar DNI Español
function isValidDNI(dni) {
  dni = dni.toUpperCase().trim();
  const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
  if (!dniRegex.test(dni)) return false;
  
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  const number = parseInt(dni.substring(0, 8), 10);
  const letter = dni.charAt(8);
  
  return letters.charAt(number % 23) === letter;
}

// Utilidad: Generar código determinista
function generateCodeFromDNI(dni) {
  const number = parseInt(dni.substring(0, 8), 10);
  // Operación: (número * 13) módulo 9000 + 1000 -> siempre da 4 dígitos (1000 - 9999)
  return ((number * 13) % 9000 + 1000).toString();
}

// Reemplazo de Alerts por un Toast HTML
function showGameAlert(msg, isError = false) {
  const toast = document.getElementById('game-toast');
  const toastText = document.getElementById('toast-text');
  
  toastText.innerHTML = msg.replace(/\n/g, '<br>');
  
  if (isError) {
    toast.style.backgroundColor = '#e74c3c';
    toast.style.color = 'white';
  } else {
    toast.style.backgroundColor = '#2ecc71';
    toast.style.color = 'white';
    // If it's a long message like the official one, keep it dark mode friendly
    if(msg.includes('Funcionario')) {
       toast.style.backgroundColor = '#3498db';
    }
  }
  
  toast.classList.remove('hidden');
  
  // Trigger animation
  setTimeout(() => { toast.style.opacity = '1'; }, 10);
  
  // Hide after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 4000);
}

const GAME_ID = 'cert_arcade';
let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId') || null;

let score = 100;
let errors = 0;
let generatedCode = "1234";
let playerDNI = "";


const sprite = document.getElementById('player-sprite');
function setSprite(emoji, left, scaleX = 1) {
  if (sprite) {
    sprite.innerHTML = emoji;
    sprite.style.left = left;
    sprite.style.transform = `scaleX(${scaleX})`;
  }
}

const screens = {
  start: document.getElementById('start-screen'),
  phase1: document.getElementById('phase1'),
  phase2: document.getElementById('phase2'),
  phase3: document.getElementById('phase3'),
  phase4: document.getElementById('phase4'),
  result: document.getElementById('result-screen')
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

// Navigation
function showScreen(screenId) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[screenId].classList.remove('hidden');
}

document.getElementById('btn-start').onclick = () => {
  score = 100;
  errors = 0;
  generatedCode = ''; playerDNI = '';
  showScreen('phase1');
  setSprite('💻', '10%');
};

document.getElementById('btn-restart').onclick = () => showScreen('start');
  setSprite('🧍', '10%');

// Phase 1 Logic
document.querySelectorAll('.action-btn').forEach(btn => {
  btn.onclick = () => {
    if (btn.dataset.action === 'correct') {
      const dialogue = document.querySelector('#phase2 .dialogue-box');
      dialogue.innerHTML = `
        <p><strong>Funcionario:</strong> "Identidad verificada perfectamente. Tenga su resguardo."</p>
        <div style="background: #eaf2f8; color: #004b87; padding: 15px; margin: 15px 0; border-radius: 4px; text-align: center; border: 2px dashed #004b87;">
          Código de Descarga:<br>
          <span style="font-size: 2rem; font-weight: bold; letter-spacing: 5px; font-family: monospace;">${generatedCode}</span>
        </div>
        <p style="color: #f1c40f; text-align: center; font-weight: bold;">✍️ APÚNTALO EN UN PAPEL ANTES DE IRTE.</p>
        <button id="btn-go-home" class="btn btn-primary" style="width: 100%; margin-top: 15px;">Ir a casa e Instalar</button>
      `;
      
      document.getElementById('btn-go-home').onclick = () => {
        showScreen('phase3');
        setSprite('🏃', '10%', -1);
        setTimeout(() => setSprite('💻', '10%', 1), 1500);
      };

    } else {
      errors++;
      score = Math.max(0, score - 10);
      showGameAlert('❌ Funcionario: "No, con eso no me sirve para acreditarle." (-10 pts)', true);
    }
  };
});

// Phase 3 Logic
document.getElementById('btn-download').onclick = async () => {
  const dni = document.getElementById('final-dni').value.trim();
  const code = document.getElementById('final-code').value.trim();
  
  if (dni === playerDNI && code === generatedCode) {
    document.getElementById('error-msg').style.display = 'none';
    showScreen('phase4');
    setSprite('💾', '10%');
  } else {
    errors++;
    score = Math.max(0, score - 20);
    document.getElementById('error-msg').style.display = 'block';
  }
};




// Phase 4 Logic
let hasBackup = false;

document.getElementById('icon-sede').onclick = () => {
  if (!hasBackup) {
    showGameAlert('⚠️ ¡Espera! Antes de hacer trámites, exporta una COPIA DE SEGURIDAD de tu certificado.', true);
    return;
  }
  document.getElementById('sede-modal').classList.remove('hidden');
};

document.getElementById('btn-close-modal').onclick = () => {
  document.getElementById('sede-modal').classList.add('hidden');
};

document.getElementById('btn-generate-pdf').onclick = () => {
  const nombre = document.getElementById('pdf-nombre').value.trim();
  const apellidos = document.getElementById('pdf-apellidos').value.trim();
  const lugar = document.getElementById('pdf-lugar').value.trim();
  const fecha = document.getElementById('pdf-fecha').value;

  if (!nombre || !apellidos || !lugar || !fecha) {
    showGameAlert("❌ Faltan datos para procesar el documento oficial.", true);
    return;
  }

  // Generate PDF using jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Diseño del certificado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("MINISTERIO DE JUSTICIA", 105, 30, null, null, "center");
  
  doc.setFontSize(16);
  doc.setTextColor(142, 68, 173); // Purple
  doc.text("CERTIFICADO LITERAL DE NACIMIENTO", 105, 45, null, null, "center");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);

  const textBody = `El Funcionario del Registro Civil correspondiente CERTIFICA:\n\nQue D./Dña. ${nombre} ${apellidos}, nacido/a en ${lugar}\nel día ${fecha}, consta inscrito/a en este Registro.\n\nY para que conste y surta los efectos oportunos, se expide\nel presente certificado telemático.`;
  
  doc.text(textBody, 20, 80);

  // Cuadro de firma digital (Fake hash)
  const fakeHash = Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
  const currentDate = new Date().toLocaleString('es-ES');
  
  doc.setDrawColor(41, 128, 185); // Blue border
  doc.setLineWidth(1);
  doc.rect(20, 150, 170, 40);
  
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(41, 128, 185);
  doc.text("FIRMADO DIGITALMENTE", 25, 160);
  
  doc.setFont("courier", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(`Firma válida reconocida por la FNMT.`, 25, 168);
  doc.text(`Titular del Certificado: ${nombre.toUpperCase()} ${apellidos.toUpperCase()}`, 25, 175);
  doc.text(`Fecha de firma: ${currentDate}`, 25, 182);
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`HASH: ${fakeHash}`, 25, 200);

  doc.save(`Partida_Nacimiento_${nombre}_${apellidos}.pdf`);

  document.getElementById('sede-modal').classList.add('hidden');
  showGameAlert('✅ ¡Trámite superado! Se ha descargado tu PDF firmado digitalmente. Es tu entregable.');
  
  setTimeout(() => endGame(), 3500);
};


document.getElementById('icon-backup').onclick = async () => {
  if (hasBackup) {
    showGameAlert('ℹ️ Ya tienes una copia de seguridad hecha.');
    return;
  }
  
  showGameAlert('✅ ¡Copia exportada con contraseña a tu móvil personal! Tu identidad está a salvo.');
  setSprite('💾', '10%');
  hasBackup = true;
};

async function endGame() {

  showScreen('result');
  setSprite('🎉', '50%');
  document.getElementById('score').innerText = score;
  
  if (currentUser) {
    try {
      await saveGameResult(GAME_ID, currentUser.uid, classId, score);
      console.log('Puntuación del certificado guardada.');
    } catch (e) {
      console.error('Error guardando puntuación:', e);
    }
  }
}
