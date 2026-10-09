import { requireAuth } from './common/auth.js';
import { renderHeader, showModal, showToast } from './common/ui.js';
import { $, escapeHtml } from './common/utils.js';
import { getLeague, MEDALS_CATALOG, LEAGUES, GUILDS_CATALOG, MEDAL_XP, computeGameXP } from './common/gamification.js';
import { db, getStudentClasses, getClassMembers, getStudentResultsByGame } from './common/db.js';
import { collection, getDocs, doc, updateDoc, deleteField, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { GAMES } from './common/utils.js';

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    
    if ($('logros-avatar')) {
      $('logros-avatar').src = profile.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
    }
    if ($('logros-name')) {
      $('logros-name').textContent = profile.displayNameAnonymized || profile.displayName || profile.name || 'Alumno';
    }
    
    const pts = profile.puntosTotal || profile.totalScore || 0;
    const logros = profile.logros || [];
    const liga = getLeague(pts);

    if ($('stat-xp')) $('stat-xp').textContent = pts;
    if ($('stat-league-name')) $('stat-league-name').textContent = liga.name;

    const btnXp = $('btn-xp-details');
    if (btnXp) {
      btnXp.addEventListener('click', () => {
        showStudentHistoryModal(user.uid, profile.displayNameAnonymized || profile.displayName || profile.name || 'Alumno', profile);
      });
    }
    if ($('stat-league-icon')) $('stat-league-icon').textContent = liga.icon;
    if ($('stat-medals')) $('stat-medals').textContent = logros.length;
    
    if ($('gremio-container')) {
      await renderGremioSection(user, profile);
    }

    const leaguesContainer = $('student-leagues-list');
    if (leaguesContainer) {
      // Queremos mostrar de menor a mayor de izquierda a derecha
      const reversedLeagues = [...LEAGUES].reverse();
      
      leaguesContainer.innerHTML = reversedLeagues.map((l, reversedIdx) => {
        // En el array original LEAGUES, el índice original es (LEAGUES.length - 1 - reversedIdx)
        const originalIdx = LEAGUES.length - 1 - reversedIdx;
        const isCurrent = l.id === liga.id;
        const isUnlocked = pts >= l.pts;
        const nextLeague = originalIdx > 0 ? LEAGUES[originalIdx-1] : null; 
        
        let progressHtml = '';
        if (isCurrent && nextLeague) {
          const range = nextLeague.pts - l.pts;
          const currentProgress = pts - l.pts;
          const pct = Math.min(100, Math.max(0, (currentProgress / range) * 100));
          progressHtml = `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; width: 100%;">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:6px; color:#7f8c8d;">
                <span>Hacia ${escapeHtml(nextLeague.name)}</span>
                <span style="font-weight:bold;">¡Faltan ${nextLeague.pts - pts}!</span>
              </div>
              <div style="height: 10px; background-color: #ecf0f1; border-radius: 5px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                <div style="height: 100%; background-color: ${l.color}; width: ${pct}%; transition: width 0.5s ease-out;"></div>
              </div>
            </div>
          `;
        }

        return `
          <div style="display:flex; flex-direction:column; align-items:center; text-align:center; min-width: 200px; flex: 0 0 auto; background:${isCurrent ? '#fff' : '#f9f9f9'}; padding: 20px 15px; border-radius: 8px; border: 2px solid ${isCurrent ? l.color : 'transparent'}; border-bottom: 5px solid ${isUnlocked ? l.color : '#bdc3c7'}; box-shadow: ${isCurrent ? '0 4px 10px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)'}; opacity: ${isUnlocked ? '1' : '0.6'}; transition: all 0.2s; position: relative;">
            ${isCurrent ? `<span style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: ${l.color}; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; white-space: nowrap; z-index: 2;">Tu Liga Actual</span>` : ''}
            
            <div style="font-size: 3rem; filter: ${isUnlocked ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))' : 'grayscale(100%)'}; margin-bottom: 10px; position: relative;">
              ${l.icon}
              ${isUnlocked && !isCurrent ? '<div style="position: absolute; bottom: 0; right: -10px; background: #27ae60; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; border: 2px solid #fff;">✓</div>' : ''}
            </div>
            
            <div style="font-weight: bold; font-size: 1.1rem; color: ${isUnlocked ? l.color : '#7f8c8d'}; margin-bottom: 5px;">${escapeHtml(l.name)}</div>
            <div style="font-size: 0.85rem; color: #7f8c8d;">Requiere: <strong style="color: #2c3e50;">${l.pts} XP</strong></div>
            
            ${progressHtml}
          </div>
        `;
      }).join('');
    }

    const medalsContainer = $('student-medals-list');
    if (medalsContainer) {
      const sortedMedals = [...MEDALS_CATALOG].sort((a, b) => {
        const aUnlocked = logros.some(l => l.id === a.id) ? 1 : 0;
        const bUnlocked = logros.some(l => l.id === b.id) ? 1 : 0;
        return bUnlocked - aUnlocked;
      });
      
      medalsContainer.innerHTML = sortedMedals.map(cat => {
        const isUnlocked = logros.some(l => l.id === cat.id);
        const isHidden = !cat.public && !isUnlocked;
        
        const displayIcon = isHidden ? '❓' : (cat.icon || '🏅');
        const displayName = isHidden ? 'Logro Oculto' : cat.name;
        const displayDesc = isHidden ? 'Descubre cómo desbloquearlo jugando...' : cat.desc;
        const xpVal = isUnlocked ? (MEDAL_XP[cat.id] || 50) : 0;
        const xpBadge = isUnlocked ? `<span style="background:#f1c40f; color:#000; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:8px;">+${xpVal} XP</span>` : '';

        return `
          <div style="display:flex; align-items:center; gap: 15px; background:${isUnlocked ? '#fff' : '#f9f9f9'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${isUnlocked ? '#f1c40f' : '#bdc3c7'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); opacity: ${isUnlocked ? '1' : '0.6'}; transition: all 0.2s;">
            <div style="font-size: 2.5rem; filter: ${isUnlocked ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))' : 'grayscale(100%)'};">${displayIcon}</div>
            <div>
              <div style="font-weight: bold; font-size: 1.1rem; color: ${isUnlocked ? '#2c3e50' : '#7f8c8d'}; display:flex; align-items:center;">
                ${escapeHtml(displayName)}
                ${xpBadge}
              </div>
              <div style="font-size: 0.85rem; color: #7f8c8d; line-height: 1.2; margin-top: 4px;">${escapeHtml(displayDesc || '')}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
});

export async function renderGremioSection(user, profile) {
  const container = $('gremio-container');
  if (!container) return;

  // Bind global function to leave
  window.leaveGuild = async function() {
    showModal({
      title: 'Abandonar Gremio',
      body: '¿Estás seguro de que quieres abandonar tu gremio actual? Podrás unirte a otro, pero perderás tu lugar.',
      dangerous: true,
      confirmText: 'Abandonar',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'tic2_users', user.uid), { gremio: deleteField() });
          profile.gremio = "";
          renderHeader(user, profile);
          await renderGremioSection(user, profile);
          showToast('Gremio abandonado', '', 'info');
        } catch (e) {
          console.error('Error al abandonar gremio:', e);
          showToast('Error', 'Hubo un error al abandonar el gremio.', 'error');
        }
      }
    });
  };

  // Bind global function for joining
  window.joinGuild = async function(guildName) {
    showModal({
      title: 'Unirse al gremio',
      body: `¿Estás seguro de que quieres unirte a ${guildName}?`,
      confirmText: 'Unirme',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'tic2_users', user.uid), { gremio: guildName });
          profile.gremio = guildName;
          renderHeader(user, profile);
          await renderGremioSection(user, profile);
          showToast('¡Bienvenido al gremio!', `Te has unido a ${guildName}`, 'success');
        } catch (e) {
          console.error('Error al unirse al gremio:', e);
          showToast('Error', 'Hubo un error al unirte al gremio.', 'error');
        }
      }
    });
  };

  // Cálculo de cupos de gremios en la clase
  let classMembers = [];
  try {
    const myClasses = await getStudentClasses(user.uid);
    if (myClasses.length > 0) {
      const firstClassId = myClasses[0].id;
      classMembers = await getClassMembers(firstClassId);
    }
  } catch(e) {
    console.error("No se pudo obtener la clase del alumno", e);
  }

  let guildCounts = {};
  let guildPoints = {};
  GUILDS_CATALOG.forEach(g => {
    guildCounts[g.name] = 0;
    guildPoints[g.name] = 0;
  });
  
  let totalInClass = classMembers.length;
  if (totalInClass < 4) totalInClass = 4;
  
  classMembers.forEach(m => {
    if (m.gremio && guildCounts[m.gremio] !== undefined) {
      guildCounts[m.gremio]++;
      guildPoints[m.gremio] += (m.puntosTotal || m.totalScore || 0);
    }
  });

  const numGuilds = GUILDS_CATALOG.length;
  const maxPerGuild = Math.max(1, Math.ceil(totalInClass / numGuilds) + 1);

  const guildRanking = GUILDS_CATALOG.map(g => ({
    name: g.name,
    icon: g.icon,
    color: g.color,
    points: guildPoints[g.name],
    members: guildCounts[g.name]
  })).sort((a,b) => b.points - a.points);

  const mainLayout = document.getElementById('main-layout-container');

  if (profile.gremio) {
    if (mainLayout) mainLayout.classList.remove('no-guild-layout');

    const guildInfo = GUILDS_CATALOG.find(g => g.name === profile.gremio);
    const color = guildInfo ? guildInfo.color : '#3498db';
    const icon = guildInfo ? guildInfo.icon : '🛡️';
    const image = guildInfo ? guildInfo.image : '';
    
    const count = guildCounts[profile.gremio] || 1;
    const myGuildData = guildRanking.find(g => g.name === profile.gremio);
    const myGuildPos = guildRanking.findIndex(g => g.name === profile.gremio) + 1;
    const myGuildPoints = myGuildData ? myGuildData.points : 0;

    const membersInMyGuild = classMembers.filter(m => m.gremio === profile.gremio);
    const membersHtml = membersInMyGuild.map(m => `
      <div style="display:flex; align-items:center; gap: 8px; background: #f9f9f9; padding: 5px 10px; border-radius: 20px; border: 1px solid #eee;">
        <img src="${escapeHtml(m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}`)}" style="width: 24px; height: 24px; border-radius: 50%;">
        <span style="font-size: 0.85rem; font-weight: bold; color: var(--text-base);">${escapeHtml(m.displayNameAnonymized || m.displayName || m.email?.split('@')[0] || 'Alumno')}</span>
      </div>
    `).join('');

    const rankingHtml = guildRanking.map((gObj, idx) => {
      const gInfo = GUILDS_CATALOG.find(x => x.name === gObj.name) || { color: '#ccc', image: '' };
      return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 10px; border-bottom: 1px solid #eee; ${gObj.name === profile.gremio ? 'font-weight: bold; background: #f9f9f9; border-left: 4px solid ' + gInfo.color + ';' : ''}">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 20px; font-weight: bold; color: var(--text-muted);">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.'}</span>
          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: ${gInfo.color}; display: flex; align-items: center; justify-content: center; border: 2px solid var(--text-primary); box-shadow: 2px 2px 0px rgba(0,0,0,1); flex-shrink: 0;">
            <img src="${gInfo.image}" alt="" style="width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply;">
          </div>
          <span style="color: ${gInfo.color}; font-family: 'Press Start 2P', system-ui; font-size: 0.65rem; line-height: 1.4;">${escapeHtml(gObj.name)}</span>
        </div>
        <span style="color: var(--text-primary); font-weight: 900; font-family: 'Press Start 2P', system-ui; font-size: 0.8rem;">⭐ ${gObj.points}</span>
      </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content: flex-end; margin-bottom: -30px; position: relative; z-index: 10;">
        <button onclick="window.leaveGuild()" class="btn btn-ghost btn--sm" style="color: #e74c3c; border: 1px solid #e74c3c; cursor: pointer; background: #fff;">
          🚪 Abandonar
        </button>
      </div>
      <div style="text-align: center; position: relative;">
        <div style="width:100px; height:100px; border-radius:50%; background-color:${color}; display:inline-flex; align-items:center; justify-content:center; border:5px solid var(--text-primary); box-shadow:6px 6px 0px rgba(0,0,0,1); margin: 0 auto 15px auto;">
          <img src="${image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
        </div>
        <div style="font-size: 1.2rem; font-weight: 900; color: ${color}; font-family: 'Press Start 2P', system-ui; line-height: 1.5; margin-bottom: 15px;">${escapeHtml(profile.gremio)}</div>
        
        <div style="margin-top: 15px; display: flex; justify-content: center; gap: 15px;">
          <div style="background: #fdfbf7; border: 1px solid #f1c40f; border-radius: 8px; padding: 8px 15px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: bold; color: #f39c12;">⭐ ${myGuildPoints}</div>
            <div style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase;">Puntos Gremio</div>
          </div>
          <div style="background: #f4f6f7; border: 1px solid #bdc3c7; border-radius: 8px; padding: 8px 15px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: bold; color: #2c3e50;">#${myGuildPos}</div>
            <div style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase;">Ranking</div>
          </div>
        </div>

        <div style="margin-top: 15px;">
          <span style="background: #ecf0f1; border-radius: 12px; padding: 4px 10px; font-size: 0.8rem; font-weight: bold; color: #2c3e50;">
            ${count} / ${maxPerGuild} plazas ocupadas en tu clase
          </span>
        </div>
        <p style="margin-top: 15px; color: var(--text-muted); font-size: 0.9rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.4;">
          ${escapeHtml(guildInfo?.desc || '')}
        </p>

        <div style="margin-top: 25px; text-align: left; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 3px solid ${color};">
          <h4 style="font-size: 0.9rem; margin-bottom: 10px; color: #2c3e50; text-transform: uppercase;">👥 Tus compañeros:</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${membersHtml || '<span class="text-muted" style="font-size: 0.85rem;">Aún no hay nadie más en este gremio.</span>'}
          </div>
        </div>

        <div style="margin-top: 20px; text-align: left; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <h4 style="font-size: 0.9rem; margin-bottom: 10px; color: #2c3e50; text-transform: uppercase;">🏆 Ranking de Gremios</h4>
          <div style="font-size: 0.9rem;">
            ${rankingHtml}
          </div>
        </div>
      </div>
    `;
  } else {
    // Si no tiene gremio, mostramos el selector en horizontal
    if (mainLayout) mainLayout.classList.add('no-guild-layout');

    container.innerHTML = `
      <div class="text-center" style="margin-bottom: 20px;">
        <h4 style="color: var(--text-base); margin-bottom: 5px;">Es hora de elegir tu destino</h4>
        <p class="text-muted" style="font-size: 0.9rem;">Los gremios tienen plazas limitadas en tu clase para mantener el equilibrio.</p>
      </div>
      <div id="guild-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
        <div style="grid-column: 1/-1; text-align: center;">Cargando gremios y plazas disponibles en tu clase...</div>
      </div>
    `;

    const cardsContainer = $('guild-cards');
    cardsContainer.innerHTML = GUILDS_CATALOG.map(g => {
      const count = guildCounts[g.name];
      const isFull = count >= maxPerGuild;
      
      const plazasBadge = `<div style="background: #ecf0f1; border-radius: 12px; padding: 4px 10px; font-size: 0.8rem; font-weight: bold; color: #2c3e50; margin-top: auto; margin-bottom: 10px;">${count} / ${maxPerGuild} plazas ocupadas</div>`;

      return `
        <div style="display:flex; flex-direction:column; background: #fff; padding: 20px; border-radius: 8px; border-top: 5px solid ${g.color}; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; opacity: ${isFull ? '0.6' : '1'}; position: relative;">
          ${isFull ? '<div style="position:absolute; top: 10px; right: 10px; background: #e74c3c; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">LLENO</div>' : ''}
          <div style="width:90px; height:90px; border-radius:50%; background-color:${g.color}; display:flex; align-items:center; justify-content:center; border:4px solid var(--text-primary); box-shadow:4px 4px 0px rgba(0,0,0,1); margin: 0 auto 15px auto;">
            <img src="${g.image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
          </div>
          <h4 style="color: ${g.color}; margin-bottom: 10px; text-shadow:1px 1px 0px var(--text-primary); font-family: 'Press Start 2P', system-ui; font-size:1.1rem; line-height: 1.4;">${escapeHtml(g.name)}</h4>
          <p style="font-size: 0.85rem; color: #7f8c8d; flex-grow: 1; margin-bottom: 15px;">${escapeHtml(g.desc)}</p>
          ${plazasBadge}
          <button class="btn btn-primary" style="background: ${g.color}; border-color: ${g.color}; width: 100%;" 
                  ${isFull ? 'disabled' : `onclick="window.joinGuild('${escapeHtml(g.name)}')"`}>
            ${isFull ? 'Cupo máximo' : 'Unirme'}
          </button>
        </div>
      `;
    }).join('');
  }
}

// -- Historial de XP --
async function showStudentHistoryModal(studentId, studentName, profile) {
  let modal = document.getElementById('modal-student-history');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-student-history';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:680px; width:95%; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 id="history-modal-title"></h3>
          <button class="modal-close" id="close-history-modal" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body" style="padding:15px; overflow-y:auto; flex: 1;">
          <div id="history-modal-body"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('close-history-modal').addEventListener('click', () => modal.classList.remove('modal-backdrop--visible'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal-backdrop--visible'); });
  }

  document.getElementById('history-modal-title').textContent = `📊 Línea de Tiempo de ${studentName}`;
  document.getElementById('history-modal-body').innerHTML = '<div style="padding:32px; text-align:center;">⏳ Cargando línea de tiempo...</div>';
  modal.classList.add('modal-backdrop--visible');

  let timeline = [];
  try {
    const GAME_NAMES = Object.fromEntries(Object.values(GAMES).map(g => [g.id, `${g.icon} ${g.name}`]));

    // 1. Juegos
    const qGames = query(collection(db, 'tic2_game_results'), where('studentId', '==', studentId));
    const gamesSnap = await getDocs(qGames);
    
    const gameDocs = [];
    gamesSnap.forEach(d => gameDocs.push(d.data()));
    gameDocs.sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    
    const gameHistory = {};
    gameDocs.forEach(r => {
      const gName = GAME_NAMES[r.gameId] || r.gameId || 'Juego';
      const key = `${r.gameId}_${r.classId || 'free'}`;
      if (!gameHistory[key]) gameHistory[key] = { best: 0, totalEarned: 0 };
      
      let xpEarned = 5;
      if (r.score > gameHistory[key].best) {
         xpEarned += (computeGameXP(r.score, r.gameId) - computeGameXP(gameHistory[key].best, r.gameId));
         gameHistory[key].best = r.score;
      }
      if (gameHistory[key].totalEarned + xpEarned > 750) {
         xpEarned = Math.max(0, 750 - gameHistory[key].totalEarned);
      }
      gameHistory[key].totalEarned += xpEarned;
      
      timeline.push({
        type: 'Juego',
        title: `Jugó a ${gName}`,
        desc: `Puntuación: ${r.score}`,
        xp: xpEarned,
        timestamp: r.timestamp?.seconds ? r.timestamp.seconds * 1000 : Date.now(),
        icon: '🎮'
      });
    });

    // 1b. Tareas Asignadas (Classroom / ClassHub)
    const studentClasses = await getStudentClasses(studentId);
    for (const cls of studentClasses) {
      const qAssigns = collection(db, "tic2_classes", cls.id, "tic2_assignments");
      const assignsSnap = await getDocs(qAssigns);
      assignsSnap.forEach(d => {
        const a = d.data();
        const gName = GAME_NAMES[a.gameId] || a.gameId || "Tarea";
        timeline.push({
          type: "Tarea",
          title: `Asignación: ${a.title}`,
          desc: `Objetivo: ${a.targetScore} en ${gName}`,
          xp: 0,
          timestamp: a.dueDate ? new Date(a.dueDate).getTime() : Date.now() - 100000,
          icon: "📋"
        });
      });
    }

    // 2. Tests de Teoría
    const qTests = query(collection(db, 'tic2_tests_teoria'), where('uid', '==', studentId));
    const testsSnap = await getDocs(qTests);
    testsSnap.forEach(d => {
      const t = d.data();
      let xp = 0;
      if (t.score >= 3) {
        xp = t.score >= 5 ? Math.round(t.score * 10) : 5;
      }
      timeline.push({
        type: 'Test',
        title: `Test de ${t.topicTitle || 'Teoría'}`,
        desc: `Nota: ${t.score} / 10`,
        xp: xp,
        timestamp: t.fecha?.seconds ? t.fecha.seconds * 1000 : Date.now(),
        icon: '📖'
      });
    });

    // 3. Exámenes Reales
    const qExams = query(collection(db, 'respuestas_test'), where('uid', '==', studentId));
    const examsSnap = await getDocs(qExams);
    examsSnap.forEach(d => {
      const e = d.data();
      let xp = 0;
      if (e.nota >= 3) {
        xp = 100;
        if (e.nota >= 5) xp += 100;
        if (e.nota >= 9) xp += 200;
      }
      timeline.push({
        type: 'Examen',
        title: `Examen Oficial`,
        desc: `Nota: ${e.nota} / 10`,
        xp: xp,
        timestamp: e.fecha?.seconds ? e.fecha.seconds * 1000 : Date.now(),
        icon: '📝'
      });
    });

    // 3b. Tareas Offline
    const qOffline = query(collection(db, 'tic2_offline_grades'), where('studentId', '==', studentId));
    const offlineSnap = await getDocs(qOffline);
    offlineSnap.forEach(d => {
      const o = d.data();
      let xp = 0;
      if (o.finalGrade > 0) xp += 100;
      if (o.finalGrade >= 5) xp += 100;
      if (o.finalGrade >= 9) xp += 200;
      timeline.push({
        type: 'TareaOffline',
        title: `Tarea Corregida`,
        desc: `Nota: ${o.finalGrade} / 10`,
        xp: xp,
        timestamp: o.updatedAt?.seconds ? o.updatedAt.seconds * 1000 : Date.now(),
        icon: '📝'
      });
    });

    // 4. Medallas
    if (profile && profile.logros) {
      profile.logros.forEach(m => {
        const xpEarned = MEDAL_XP[m.id] || 50;
        const ts = m.fecha ? new Date(m.fecha).getTime() : Date.now();
        timeline.push({
          type: 'Medalla',
          title: `Medalla: ${m.name}`,
          desc: m.desc || '',
          xp: xpEarned,
          timestamp: ts,
          icon: m.icon || '🏅'
        });
      });
    }

  } catch(e) {
    console.error('Error cargando historial:', e);
    document.getElementById('history-modal-body').innerHTML = `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error al cargar: ${escapeHtml(e.message)}</div>`;
    return;
  }

  // Ordenar timeline descendente por fecha
  timeline.sort((a, b) => b.timestamp - a.timestamp);

  let html = '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column;">';
  
  if (timeline.length === 0) {
    html = '<div style="text-align:center;color:var(--text-muted);padding:16px;">Sin actividad registrada.</div>';
  } else {
    html += timeline.map((item, index) => {
      const dateStr = new Date(item.timestamp).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const xpBadge = item.xp > 0 ? `<span style="background:#f1c40f; color:#000; font-weight:bold; padding:3px 8px; border-radius:12px; font-size:0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">+${item.xp} XP</span>` : (item.type === 'Test' || item.type === 'Examen' ? `<span style="background:#e74c3c; color:#fff; font-weight:bold; padding:3px 8px; border-radius:12px; font-size:0.8rem;">0 XP</span>` : '');
      const isLast = index === timeline.length - 1;
      const borderBottom = isLast ? '' : 'border-bottom:1px solid var(--border);';
      
      return `
        <li style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; ${borderBottom}">
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="font-size:1.5rem; width:30px; text-align:center;">${item.icon}</div>
            <div>
              <strong style="font-size:1rem; color:var(--text-primary); display:block; margin-bottom:2px;">${escapeHtml(item.title)}</strong>
              <div style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(item.desc)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${dateStr}</div>
            </div>
          </div>
          <div>${xpBadge}</div>
        </li>
      `;
    }).join('');
    html += '</ul>';
  }

  document.getElementById('history-modal-body').innerHTML = html;
}
