import { requireAuth } from '../js/common/auth.js';
import { addPointsAndCheckLogros, awardMedal } from '../js/common/gamification.js';
import { db } from '../js/common/db.js';
import { GAMES } from '../js/common/utils.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const filename = window.location.pathname.split('/').pop();
const topicMap = {
  'multimedia.html': { topicKey: 'topic_multimedia', title: 'Edición Multimedia', medalId: 'experto_multimedia', goldMedalId: 'experto_multimedia_oro', relatedGameId: 'cc_trivial' },
  'cms.html': { topicKey: 'topic_cms', title: 'CMS y SEO', medalId: 'maestro_cms', goldMedalId: 'maestro_cms_oro' },
  'html.html': { topicKey: 'topic_html', title: 'HTML', medalId: 'dev_web', goldMedalId: 'dev_web_oro', relatedGameId: 'hex_invaders' },
  'js.html': { topicKey: 'topic_js', title: 'Javascript', medalId: 'dev_web', goldMedalId: 'dev_web_oro' },
  'cyber.html': { topicKey: 'topic_cyber', title: 'Ciberseguridad', medalId: 'sysadmin', goldMedalId: 'sysadmin_oro', relatedGameId: 'databreach' },
  'kanban.html': { topicKey: 'topic_kanban', title: 'Industria del Software', medalId: 'kanban_master', goldMedalId: 'kanban_master_oro', relatedGameId: 'kanban_hero' },
  'drive.html': { topicKey: 'topic_drive', title: 'Ofimática Colaborativa', medalId: 'raton_biblioteca', goldMedalId: 'raton_biblioteca' },
  'js_advanced.html': { topicKey: 'topic_js_adv', title: 'Javascript Avanzado', medalId: 'dev_web', goldMedalId: 'dev_web_oro' }
};

const tData = topicMap[filename];


    // === GENERACIÓN DEL ÍNDICE AUTOMÁTICO ===
    function generateTableOfContents() {
        const headers = document.querySelectorAll('h1, h2');
        if (headers.length < 3) return; // Si hay muy pocos, no merece la pena
        
        const tocContainer = document.createElement('div');
        tocContainer.className = 'toc-container';
        tocContainer.style.background = '#fff';
        tocContainer.style.border = '1px solid #e0e0e0';
        tocContainer.style.borderLeft = '5px solid #3498db';
        tocContainer.style.padding = '20px';
        tocContainer.style.borderRadius = '8px';
        tocContainer.style.margin = '20px auto 40px auto';
        tocContainer.style.maxWidth = '800px';
        tocContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
        
        const tocTitle = document.createElement('h3');
        tocTitle.textContent = '📑 Índice de Contenidos';
        tocTitle.style.marginTop = '0';
        tocTitle.style.color = '#2c3e50';
        tocTitle.style.borderBottom = '1px solid #eee';
        tocTitle.style.paddingBottom = '10px';
        tocContainer.appendChild(tocTitle);
        
        const tocList = document.createElement('ul');
        tocList.style.listStyleType = 'none';
        tocList.style.paddingLeft = '0';
        tocList.style.marginBottom = '0';
        
        headers.forEach((h, index) => {
            // Saltamos el H1 del header si es el primero (o lo dejamos como título principal)
            if (h.closest('.topic-header') && h.tagName.toLowerCase() === 'h1') {
                const li = document.createElement('li');
                li.style.marginTop = '15px';
                li.style.fontWeight = 'bold';
                li.style.fontSize = '1.1rem';
                li.style.color = '#3498db';
                li.textContent = h.textContent;
                tocList.appendChild(li);
                return;
            }
            
            // Asignar ID al elemento para poder saltar
            if (!h.id) {
                h.id = 'sec-' + index;
            }
            
            const li = document.createElement('li');
            li.style.margin = '8px 0';
            
            // Si es un H1 normal (que no está en header)
            if (h.tagName.toLowerCase() === 'h1') {
                 li.style.marginTop = '20px';
                 li.style.fontWeight = 'bold';
                 li.style.fontSize = '1.1rem';
                 li.style.borderTop = '1px dashed #eee';
                 li.style.paddingTop = '10px';
            } else {
                 li.style.paddingLeft = '20px';
                 li.style.position = 'relative';
                 li.innerHTML = '<span style="color:#bdc3c7; position:absolute; left:0;">•</span>';
            }
            
            const a = document.createElement('a');
            a.href = '#' + h.id;
            a.textContent = h.textContent;
            a.style.color = '#34495e';
            a.style.textDecoration = 'none';
            a.style.transition = 'color 0.2s';
            a.onmouseover = () => a.style.color = '#3498db';
            a.onmouseout = () => a.style.color = '#34495e';
            
            li.appendChild(a);
            tocList.appendChild(li);
        });
        
        tocContainer.appendChild(tocList);
        
        // Insertar justo antes del primer header o del primer section
        const firstHeader = document.querySelector('.topic-header');
        if (firstHeader) {
            firstHeader.parentNode.insertBefore(tocContainer, firstHeader.nextSibling);
        } else {
            document.body.insertBefore(tocContainer, document.body.firstChild);
        }
    }
    
    // Llamamos a la función de índice para todos los roles (student, teacher, admin)
    generateTableOfContents();


requireAuth({
  allowedRoles: ['student', 'teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    if (!tData) return;
    
    // Inyectar banner de juego relacionado (visible para todos, alumnos y profesores)
    if (tData.relatedGameId && GAMES[tData.relatedGameId]) {
      const game = GAMES[tData.relatedGameId];
      const banner = document.createElement('div');
      banner.style.margin = '40px auto';
      banner.style.maxWidth = '800px';
      banner.style.padding = '25px';
      banner.style.background = `linear-gradient(135deg, ${game.color}22, ${game.colorDark}33)`;
      banner.style.border = `2px solid ${game.color}`;
      banner.style.borderRadius = '12px';
      banner.style.display = 'flex';
      banner.style.alignItems = 'center';
      banner.style.gap = '20px';
      banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
      
      banner.innerHTML = `
        <div style="font-size: 4rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${game.icon}</div>
        <div style="flex: 1;">
          <h3 style="margin-top: 0; margin-bottom: 5px; color: ${game.colorDark};">🎮 Minijuego Relacionado</h3>
          <p style="margin-bottom: 0; color: #333;">Asienta estos conocimientos y gana XP en el minijuego <strong>${game.name}</strong> (disponible cuando tu profesor lo habilite en el panel de la clase).</p>
        </div>
      `;
      // Insertarlo antes del contenedor de test (o al final si no hay)
      document.body.appendChild(banner);
    }
    
    


    const testContainer = document.createElement('div');
    testContainer.id = 'theory-test-container';
    testContainer.style.margin = '60px auto';
    testContainer.style.maxWidth = '800px';
    testContainer.style.padding = '40px';
    testContainer.style.background = 'linear-gradient(145deg, #ffffff, #f0f8ff)';
    testContainer.style.borderRadius = '16px';
    testContainer.style.border = '2px solid #3498db';
    testContainer.style.boxShadow = '0 10px 30px rgba(52, 152, 219, 0.2)';
    testContainer.style.position = 'relative';
    testContainer.style.overflow = 'hidden';
    
    testContainer.innerHTML = `
      <div style="position: absolute; top: -20px; right: -20px; font-size: 8rem; opacity: 0.05; transform: rotate(15deg);">📝</div>
      <div style="text-align: center; position: relative; z-index: 1;">
        <div style="font-size: 3.5rem; margin-bottom: 10px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2));">🎓</div>
        <h2 style="color: #2980b9; margin-bottom: 15px; font-size: 2.2rem;">Test de Evaluación: ${tData.title}</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 25px; display: inline-block; text-align: left;">
            <ul style="margin: 0; padding-left: 20px; color: #555;">
                <li>Demuestra lo que has aprendido en esta lección.</li>
                <li>Consigue al menos un <strong>5.0</strong> para aprobar.</li>
                <li>Desbloquea la <strong>medalla oficial</strong> del tema al aprobar.</li>
                <li>Aciertos: <span style="color:#27ae60; font-weight:bold;">+1</span> | Fallos: <span style="color:#e74c3c; font-weight:bold;">-0.33</span> | Blanco: 0</li>
            </ul>
        </div>
        <br>
        <button id="btn-start-test" class="btn" style="background: #e67e22; color: white; padding: 15px 40px; font-size: 1.3rem; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 15px rgba(230, 126, 34, 0.4); border: none; cursor: pointer; transition: transform 0.2s;">
            ▶️ Iniciar Test
        </button>
      </div>
    `;
    document.body.appendChild(testContainer);

    let questions = [];

    document.getElementById('btn-start-test').addEventListener('click', (e) => {
      window.location.href = `test.html?file=${filename}`;
    });

    async function evaluateTest() {
      let score = 0;
      let respuestas = [];

      questions.forEach((q, idx) => {
        const radios = document.getElementsByName(`q_${idx}`);
        let answered = -1;
        for (let r of radios) {
          if (r.checked) {
            answered = parseInt(r.value);
            break;
          }
        }
        
        let isCorrect = false;
        if (answered !== -1) {
          if (q.opciones[answered].correcta) {
            score += 1;
            isCorrect = true;
          } else {
            score -= 0.33;
          }
        }
        
        respuestas.push({
          preguntaId: q.id,
          enunciado: q.enunciado,
          marcada: answered !== -1 ? q.opciones[answered].texto : 'BLANCO',
          correctaTexto: q.opciones.find(o => o.correcta)?.texto || '?',
          isCorrect: isCorrect,
          isBlanco: answered === -1
        });
      });

      const totalPossible = questions.length;
      let finalScore = (score / totalPossible) * 10;
      if (finalScore < 0) finalScore = 0;
      finalScore = Math.round(finalScore * 100) / 100;

      testContainer.innerHTML = `
        <div style="text-align: center;">
          <h2 style="margin-bottom: 20px;">Resultados del Test</h2>
          <div style="font-size: 5rem; margin-bottom: 10px;">${finalScore >= 5 ? '🎉' : '💀'}</div>
          <h1 style="color: ${finalScore >= 5 ? 'var(--success)' : 'var(--danger)'}; font-size: 3rem; margin-bottom: 20px;">
            ${finalScore} / 10
          </h1>
          <p style="font-size: 1.2rem; margin-bottom: 30px;">
            ${finalScore >= 5 
              ? '¡Enhorabuena! Has aprobado el test. Tus resultados han sido enviados a tu profesor.' 
              : 'Has suspendido. Repasa el temario y vuelve a intentarlo más tarde.'}
          </p>
          ${finalScore >= 9 ? '<p style="color: #f1c40f; font-weight: bold; font-size: 1.2rem; margin-bottom: 20px;">¡Sobresaliente! Se te ha otorgado una Medalla de Oro 🥇</p>' : ''}
          <button onclick="location.reload()" class="btn btn-outline">Cerrar y Volver</button>
        </div>
      `;

      if (finalScore >= 5) {
        try {
          const xp = Math.round(finalScore * 10);
          const res = await addPointsAndCheckLogros(user.uid, xp, null, 'tic2_users');
          await awardMedal(user.uid, 'raton_biblioteca', 'tic2_users');
          await awardMedal(user.uid, tData.medalId, 'tic2_users');
          
          if (finalScore >= 9) {
            await awardMedal(user.uid, tData.goldMedalId, 'tic2_users');
          }
          
          if (res && res.leagueUp) {
            showToast("¡Nueva Liga Desbloqueada!", `Has ascendido a la ${res.newLeague.name}`, "success", 5000);
          }
        } catch(err) {
          console.error('Error awarding medals:', err);
        }
      }

      try {
        await addDoc(collection(db, 'tic2_tests_teoria'), {
          uid: user.uid,
          alumnoNombre: profile.displayName || profile.email,
          topicKey: tData.topicKey,
          topicTitle: tData.title,
          score: finalScore,
          rawScore: score,
          maxPossible: totalPossible,
          respuestas: respuestas,
          fecha: serverTimestamp()
        });
      } catch (err) {
        console.error('Error saving test results:', err);
      }
    }
  }
});
import './presentation.js';
