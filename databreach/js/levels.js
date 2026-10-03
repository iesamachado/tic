export const LEVELS = [
  {
    id: 1,
    missionText: "<strong>OBJETIVO:</strong> Encuentra el correo electrónico del CEO (director general).<br><br><strong>INFO:</strong> Se cree que su apellido es 'Smith'. Utiliza una consulta SQL básica para buscar en la tabla <code>empleados</code>.",
    setupSQL: [
      "CREATE TABLE empleados (id INT, nombre STRING, apellido STRING, cargo STRING, email STRING)",
      "INSERT INTO empleados VALUES (1, 'Alice', 'Johnson', 'Ventas', 'alice@corp.com')",
      "INSERT INTO empleados VALUES (2, 'Bob', 'Smith', 'CEO', 'bsmith_secret@corp.com')",
      "INSERT INTO empleados VALUES (3, 'Charlie', 'Davis', 'IT', 'cdavis@corp.com')"
    ],
    schema: [
      { table: 'empleados', cols: [{name: 'id', type: 'INT'}, {name: 'nombre', type: 'STR'}, {name: 'apellido', type: 'STR'}, {name: 'cargo', type: 'STR'}, {name: 'email', type: 'STR'}] }
    ],
    validate: (res) => {
      // res es el array de objetos devuelto por alasql
      if (!res || res.length === 0) return false;
      // Comprobar si en alguna fila y columna está el email secreto
      return res.some(row => Object.values(row).includes('bsmith_secret@corp.com'));
    },
    successMsg: "Has localizado el correo del CEO. Buen trabajo de reconocimiento inicial."
  },
  {
    id: 2,
    missionText: "<strong>OBJETIVO:</strong> Iniciar sesión como administrador aprovechando una Inyección SQL (SQLi).<br><br><strong>INFO:</strong> El sistema de login ejecuta esta consulta por detrás:<br><code>SELECT * FROM usuarios WHERE username = 'admin' AND password = '[TU_INPUT]'</code><br><br>Escribe tu <strong>[TU_INPUT]</strong> exacto en la consola (sin el SELECT) para engañar a la base de datos y que la condición siempre sea verdadera.",
    setupSQL: [
      "CREATE TABLE usuarios (id INT, username STRING, password STRING, role STRING)",
      "INSERT INTO usuarios VALUES (1, 'admin', 's3cr3t_p4ssW0rd!', 'ADMIN')",
      "INSERT INTO usuarios VALUES (2, 'guest', 'guest', 'USER')"
    ],
    schema: [
      { table: 'usuarios', cols: [{name: 'id', type: 'INT'}, {name: 'username', type: 'STR'}, {name: 'password', type: 'STR'}, {name: 'role', type: 'STR'}] }
    ],
    // Para este nivel, sobreescribiremos la lógica en game.js para que en vez de ejecutar su input como SQL libre, 
    // ejecute el SELECT inyectando el input del usuario.
    isInjectionLevel: true,
    validate: (res) => {
      if (!res || res.length === 0) return false;
      return res.some(row => row.username === 'admin');
    },
    successMsg: "¡Bypass de autenticación exitoso! Has logrado saltarte el login usando una inyección tautológica (' OR '1'='1)."
  },
  {
    id: 3,
    missionText: "<strong>OBJETIVO:</strong> Recuperar el código nuclear oculto.<br><br><strong>INFO:</strong> Existe una tabla secreta llamada <code>proyectos_clasificados</code>. Necesitamos el código del proyecto llamado 'OMEGA'.",
    setupSQL: [
      "CREATE TABLE proyectos_clasificados (id INT, nombre STRING, codigo_secreto STRING, activo BOOLEAN)",
      "INSERT INTO proyectos_clasificados VALUES (1, 'ALPHA', 'X-992', true)",
      "INSERT INTO proyectos_clasificados VALUES (2, 'OMEGA', 'NUK3-88B-XYZ', true)",
      "INSERT INTO proyectos_clasificados VALUES (3, 'DELTA', '000-111', false)"
    ],
    schema: [
      { table: 'proyectos_clasificados', cols: [{name: 'id', type: 'INT'}, {name: 'nombre', type: 'STR'}, {name: 'codigo_secreto', type: 'STR'}, {name: 'activo', type: 'BOOL'}] }
    ],
    validate: (res) => {
      if (!res || res.length === 0) return false;
      return res.some(row => Object.values(row).includes('NUK3-88B-XYZ'));
    },
    successMsg: "Has extraído la información clasificada. Auditoría completada."
  }
];
