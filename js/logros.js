import { requireAuth } from './common/auth.js';
import { renderHeader, showModal, showToast } from './common/ui.js';
import { $, escapeHtml } from './common/utils.js';
import { getLeague, MEDALS_CATALOG, LEAGUES, GUILDS_CATALOG } from './common/gamification.js';
import { db, getStudentClasses, getClassMembers } from './common/db.js';
import { collection, getDocs, doc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

        return `
          <div style="display:flex; align-items:center; gap: 15px; background:${isUnlocked ? '#fff' : '#f9f9f9'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${isUnlocked ? '#f1c40f' : '#bdc3c7'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); opacity: ${isUnlocked ? '1' : '0.6'}; transition: all 0.2s;">
            <div style="font-size: 2.5rem; filter: ${isUnlocked ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))' : 'grayscale(100%)'};">${displayIcon}</div>
            <div>
              <div style="font-weight: bold; font-size: 1.1rem; color: ${isUnlocked ? '#2c3e50' : '#7f8c8d'};">${escapeHtml(displayName)}</div>
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

    const rankingHtml = guildRanking.map((g, idx) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; ${g.name === profile.gremio ? 'font-weight: bold; background: #f9f9f9;' : ''}">
        <div style="display: flex; gap: 8px;">
          <span>${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.'}</span>
          <span style="color: ${g.color};">${g.icon} ${escapeHtml(g.name)}</span>
        </div>
        <span style="color: #f39c12; font-weight: bold;">⭐ ${g.points}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content: flex-end; margin-bottom: -30px; position: relative; z-index: 10;">
        <button onclick="window.leaveGuild()" class="btn btn-ghost btn--sm" style="color: #e74c3c; border: 1px solid #e74c3c; cursor: pointer; background: #fff;">
          🚪 Abandonar
        </button>
      </div>
      <div style="text-align: center; position: relative;">
        <div style="font-size: 4rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); margin-bottom: 10px;">${icon}</div>
        <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">${escapeHtml(profile.gremio)}</div>
        
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
          <div style="font-size: 3rem; margin-bottom: 10px;">${g.icon}</div>
          <h4 style="color: ${g.color}; margin-bottom: 10px;">${escapeHtml(g.name)}</h4>
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
