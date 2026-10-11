export const TASK_1_DEFAULT_RUBRIC = [
  {
    id: "crit_1",
    title: "Url Entregada",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Casi Perfecto" },
      { points: 0.5, desc: "Bien" },
      { points: 0.25, desc: "Mal" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_2",
    title: "Se puede acceder a la web",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_3",
    title: "4 tareas creadas por cada miembro del grupo",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_4",
    title: "Tareas en disdintos estados",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_5",
    title: "Tareas asignadas",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_6",
    title: "Perfil correcto profesor",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_7",
    title: "Tareas correctas",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_8",
    title: "Uso avanzado del tablero kanban",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  },
  {
    id: "crit_9",
    title: "Facil de usar o explicación correcta para usarlo",
    desc: "",
    levels: [
      { points: 1.0, desc: "Muy Bien" },
      { points: 0.75, desc: "Bien" },
      { points: 0.5, desc: "Puede mejorar" },
      { points: 0.25, desc: "Regular" },
      { points: 0.0, desc: "No realizado" }
    ]
  }
];

/**
 * Resuelve la rúbrica activa según prioridad:
 * 1. Rúbrica personalizada guardada en la clase (config.customRubric)
 * 2. Rúbrica por defecto asignada a la tarea (task.customRubric)
 * 3. Rúbrica general offline (OFFLINE_RUBRIC)
 */
export function getActiveRubric(task, config, fallback = null) {
  if (config && Array.isArray(config.customRubric) && config.customRubric.length > 0) {
    return config.customRubric;
  }
  if (task && Array.isArray(task.customRubric) && task.customRubric.length > 0) {
    return task.customRubric;
  }
  return fallback;
}

/**
 * Analiza un texto CSV dividiéndolo en filas y columnas respetando comillas.
 */
export function parseCSV(text) {
  const firstFew = text.slice(0, 1000);
  const commas = (firstFew.match(/,/g) || []).length;
  const semicolons = (firstFew.match(/;/g) || []).length;
  const tabs = (firstFew.match(/\t/g) || []).length;
  let delimiter = ',';
  if (semicolons > commas && semicolons > tabs) delimiter = ';';
  else if (tabs > commas && tabs > semicolons) delimiter = '\t';

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  
  const cleanText = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      rows.push(currentRow);
      currentRow = [];
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

/**
 * Parsea un CSV con el formato de exportación de rúbrica de Google Classroom (v1.0-s).
 */
export function parseClassroomRubricCSV(csvText) {
  if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
    throw new Error('El archivo CSV está vacío.');
  }

  const rows = parseCSV(csvText);
  if (!rows || rows.length === 0) {
    throw new Error('No se han encontrado filas en el archivo CSV.');
  }

  let startIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCell = (rows[i][0] || '').toLowerCase();
    if (firstCell.includes('guías de evaluación') || 
        firstCell.includes('guias de evaluacion') ||
        firstCell.includes('rubric') || 
        firstCell.includes('rúbrica') || 
        firstCell.includes('se recomienda no editar') ||
        firstCell.startsWith('v1.0')) {
      startIndex = i + 1;
    }
  }

  const cleanRows = rows.slice(startIndex);

  function isPointsRow(row) {
    const cells = row.slice(1);
    const candidateCells = cells.filter(c => c !== '');
    if (candidateCells.length === 0) {
      const allCandidates = row.filter(c => c !== '');
      if (allCandidates.length >= 2 && allCandidates.every(c => {
        const numStr = c.replace(',', '.');
        return !isNaN(parseFloat(numStr)) && isFinite(numStr);
      })) {
        return { isPoints: true, startCol: 0 };
      }
      return { isPoints: false };
    }
    
    const isNum = candidateCells.every(c => {
      const numStr = c.replace(',', '.');
      return !isNaN(parseFloat(numStr)) && isFinite(numStr);
    });
    
    return { isPoints: isNum && candidateCells.length > 0, startCol: 1 };
  }

  const criteria = [];
  let pendingTitle = '';
  let pendingDesc = '';

  for (let i = 0; i < cleanRows.length; i++) {
    const row = cleanRows[i];
    const nonBlank = row.filter(c => c !== '');
    if (nonBlank.length === 0) continue;

    const pointsCheck = isPointsRow(row);
    if (pointsCheck.isPoints) {
      const startCol = pointsCheck.startCol;
      const pointsVals = row.slice(startCol).map(c => c !== '' ? parseFloat(c.replace(',', '.')) : null);
      
      const levelTitleRow = (i + 1 < cleanRows.length) ? cleanRows[i + 1] : [];
      const levelTitles = levelTitleRow.slice(startCol);
      
      let levelDescRow = [];
      let advance = 1;
      if (i + 2 < cleanRows.length) {
        const nextCheck = isPointsRow(cleanRows[i + 2]);
        const hasCol0 = cleanRows[i + 2][0] !== '';
        if (!nextCheck.isPoints && !hasCol0 && cleanRows[i + 2].slice(startCol).some(c => c !== '')) {
          levelDescRow = cleanRows[i + 2].slice(startCol);
          advance = 2;
        }
      }
      i += advance;

      const levels = [];
      for (let k = 0; k < pointsVals.length; k++) {
        if (pointsVals[k] !== null && !isNaN(pointsVals[k])) {
          const pts = pointsVals[k];
          const title = (levelTitles[k] || '').trim();
          const desc = (levelDescRow[k] || '').trim();
          let fullDesc = title;
          if (desc && title && desc !== title) {
            fullDesc = `${title}: ${desc}`;
          } else if (desc && !title) {
            fullDesc = desc;
          }
          levels.push({
            points: pts,
            desc: fullDesc || `${pts} pts`
          });
        }
      }

      const critIndex = criteria.length + 1;
      criteria.push({
        id: `crit_${critIndex}`,
        title: pendingTitle || `Criterio ${critIndex}`,
        desc: pendingDesc || '',
        levels: levels
      });

      pendingTitle = '';
      pendingDesc = '';
    } else {
      const col0 = (row[0] || '').trim();
      if (col0) {
        if (!pendingTitle) {
          pendingTitle = col0;
        } else if (!pendingDesc) {
          pendingDesc = col0;
        } else {
          pendingTitle = `${pendingTitle} - ${pendingDesc}`;
          pendingDesc = col0;
        }
      }
    }
  }

  if (criteria.length === 0) {
    throw new Error('No se detectaron criterios válidos en el archivo CSV. Comprueba que el formato corresponda a Google Classroom (v1.0-s).');
  }

  return criteria;
}

/**
 * Exporta una rúbrica a texto CSV en formato compatible con Google Classroom.
 */
export function exportRubricToClassroomCSV(rubric) {
  let csv = "Se recomienda no editar las guías de evaluación en formato de hoja de cálculo,,,,,\n";
  csv += "v1.0-s,,,,,\n";
  rubric.forEach(crit => {
    csv += `"${(crit.title || '').replace(/"/g, '""')}",,,,,\n`;
    csv += `"${(crit.desc || '').replace(/"/g, '""')}",,,,,\n`;
    const pointsRow = crit.levels.map(l => l.points.toString()).join(',');
    csv += `,${pointsRow}\n`;
    const levelsRow = crit.levels.map(l => `"${(l.desc || '').replace(/"/g, '""')}"`).join(',');
    csv += `,${levelsRow}\n`;
    csv += `,,,,,\n`;
  });
  return csv;
}

/**
 * Calcula la puntuación obtenida, máxima y la nota final (normalizada a base 10).
 */
export function calculateRubricGrade(scores, rubric) {
  let rawScore = 0;
  let count = 0;
  let maxScore = 0;
  
  rubric.forEach(crit => {
    const maxCritPoints = Math.max(...crit.levels.map(l => l.points || 0), 0);
    maxScore += maxCritPoints;
    if (scores[crit.id] !== undefined && scores[crit.id] !== null) {
      rawScore += parseFloat(scores[crit.id]);
      count++;
    }
  });

  const finalGrade = maxScore > 0 ? (rawScore / maxScore) * 10 : rawScore;
  const isComplete = count === rubric.length;

  return {
    rawScore: Number(rawScore.toFixed(2)),
    maxScore: Number(maxScore.toFixed(2)),
    finalGrade: Number(finalGrade.toFixed(2)),
    count,
    isComplete
  };
}
