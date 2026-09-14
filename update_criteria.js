const fs = require('fs');

let utils = fs.readFileSync('js/common/utils.js', 'utf8');

const startIndex = utils.indexOf('export const GAMES_CRITERIA_MAPPING = {');
let endIndex = utils.lastIndexOf('];'); 
if (endIndex === -1) {
    endIndex = utils.indexOf('};', utils.indexOf('export const CYR_EVALUATION_DATA = {'));
} else {
    endIndex = utils.indexOf('};', endIndex);
}

if (startIndex !== -1 && endIndex !== -1) {
  const newCriteria = `export const GAMES_CRITERIA_MAPPING = {
  kanban_game: {
    '2º Bachillerato': 'TIC2.5.2 (Ciclo de vida del software) / TIC2.5.3 (Resolución de problemas)'
  },
  ciber_security: {
    '2º Bachillerato': 'TIC2.2.1 (Medidas de seguridad) / TIC2.2.2 (Privacidad en Internet)'
  },
  supermario: {
    '2º Bachillerato': 'TIC2.5.1 (Desarrollar aplicaciones) / TIC2.5.3 (Algoritmos)'
  },
  app_creator: {
    '2º Bachillerato': 'TIC2.5.1 (Desarrollar aplicaciones) / TIC2.1.1 (Impacto del software)'
  }
};

export const CYR_EVALUATION_DATA = {
  2: [
    { crit: '1.1', text: 'Analizar y valorar el impacto de la industria de desarrollo de software en la sociedad actual, en especial en la innovación y el empleo.', block: 'A. Desarrollo de Software', current: '-', prop: '-' },
    { crit: '2.1', text: 'Emplear medidas de seguridad informática necesarias para la protección de las personas y de sus datos.', block: 'C. Seguridad Informática', current: 'CyberDefender', prop: 'Wiki Ciberseguridad, UVUS' },
    { crit: '2.2', text: 'Proteger la privacidad en Internet y reconocer contenido, contactos o conductas inapropiadas.', block: 'C. Seguridad Informática', current: 'CyberDefender', prop: 'Wiki Ciberseguridad' },
    { crit: '3.1', text: 'Elaborar y publicar contenidos en la web, integrando información textual, gráfica y multimedia.', block: 'B. Publicación de contenidos', current: '-', prop: 'Web HTML, WordPress, Guión Podcast' },
    { crit: '4.1', text: 'Trabajar colaborativamente en la creación de contenidos digitales, respetando los derechos de autor.', block: 'B. Publicación de contenidos', current: '-', prop: 'Podcast Audacity, Ivoox/Spotify' },
    { crit: '5.1', text: 'Desarrollar una variedad de aplicaciones informáticas en las que se emplee una aproximación modular.', block: 'A. Desarrollo de Software', current: 'SuperMarioBros, App Creator', prop: 'SuperMario Move Move' },
    { crit: '5.2', text: 'Aplicar los principales pasos del ciclo de vida de una aplicación, trabajando de forma colaborativa.', block: 'A. Desarrollo de Software', current: 'Kanban Hero', prop: 'Tablero Kanban' },
    { crit: '5.3', text: 'Analizar y resolver problemas de tratamiento de la información, empleando abstracción y algoritmos.', block: 'A. Desarrollo de Software', current: 'SuperMarioBros', prop: 'Crea tu App' }
  ]
};`;
  
  utils = utils.substring(0, startIndex) + newCriteria + utils.substring(endIndex + 2);
  fs.writeFileSync('js/common/utils.js', utils);
} else {
  console.log("Not found", startIndex, endIndex);
}
