import { requireAuth, currentUser, currentProfile, updateUserProfileData, isAdmin } from './common/auth.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { $ } from './common/utils.js';

const DICEBEAR_STYLES = [
  { id: 'bottts', name: 'Robots' },
  { id: 'adventurer', name: 'Aventureros' },
  { id: 'avataaars', name: 'Personas' },
  { id: 'fun-emoji', name: 'Emojis' },
  { id: 'pixel-art', name: 'Pixel Art' },
  { id: 'shapes', name: 'Formas' }
];

let currentStyle = 'bottts';
let selectedUrl = '';

requireAuth({
  allowedRoles: ['teacher', 'student', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    initProfile(user, profile);
  }
});

function initProfile(user, profile) {
  const isTeacher = profile.role === 'teacher' || isAdmin(user, profile);
  const nameInput = $('display-name-input');
  const urlInput = $('photo-url-input');
  const preview = $('avatar-preview');
  
  // Set current values
  nameInput.value = profile.displayName || '';
  const initialAvatar = profile.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
  urlInput.value = initialAvatar;
  preview.src = initialAvatar;
  selectedUrl = initialAvatar;

  // Si es alumno, el nombre no se puede cambiar
  if (!isTeacher) {
    nameInput.disabled = true;
    nameInput.title = "Los alumnos no pueden cambiar su nombre.";
    $('name-hint').textContent = "Tu nombre es fijado automáticamente por el docente.";
  }

  // Configurar botones de estilo
  renderStyleFilters();

  // Generar cuadrícula inicial
  generateAvatarGrid();

  $('btn-randomize').addEventListener('click', generateAvatarGrid);
  
  $('btn-cancel').addEventListener('click', () => {
    window.history.back();
  });

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newName = nameInput.value.trim();
    if (!newName && isTeacher) {
      showToast('Error', 'El nombre no puede estar vacío.', 'error');
      return;
    }

    try {
      showLoading('Guardando perfil...');
      
      const updateData = { photoURL: urlInput.value };
      if (isTeacher && newName !== profile.displayName) {
        updateData.displayName = newName;
      }

      await updateUserProfileData(updateData);
      
      showToast('Perfil actualizado', 'Tus cambios se han guardado correctamente.', 'success');
      renderHeader(currentUser, currentProfile);
      
      setTimeout(() => {
        const dashUrl = isTeacher ? 'dashboard_teacher.html' : 'dashboard_student.html';
        window.location.href = dashUrl;
      }, 1500);
      
    } catch (err) {
      console.error(err);
      showToast('Error', 'No se pudo guardar el perfil.', 'error');
    } finally {
      hideLoading();
    }
  });
}

function renderStyleFilters() {
  const container = $('style-filters');
  container.innerHTML = DICEBEAR_STYLES.map(style => `
    <button type="button" class="style-btn ${style.id === currentStyle ? 'active' : ''}" data-style="${style.id}">
      ${style.name}
    </button>
  `).join('');

  container.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentStyle = e.target.getAttribute('data-style');
      generateAvatarGrid();
    });
  });
}

function generateAvatarGrid() {
  const grid = $('avatar-grid');
  grid.innerHTML = '';
  
  // Generar 12 avatares aleatorios del estilo actual
  for (let i = 0; i < 12; i++) {
    const randomSeed = Math.random().toString(36).substring(7);
    const url = `https://api.dicebear.com/7.x/${currentStyle}/svg?seed=${randomSeed}`;
    
    const img = document.createElement('img');
    img.src = url;
    img.className = 'avatar-option';
    if (url === selectedUrl) {
      img.classList.add('selected');
    }

    img.addEventListener('click', () => {
      // Remover selección anterior
      grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
      img.classList.add('selected');
      
      // Actualizar vista previa
      selectedUrl = url;
      $('avatar-preview').src = url;
      $('photo-url-input').value = url;
    });

    grid.appendChild(img);
  }
}
