// --- BASE DE DATOS DE CREDENCIALES (Ocultas del HTML) ---
const CREDENCIALES_AUTORIZADAS = {
  "admin.general": "IDP*Reg1*2026",
  "lider.cocle": "Cocle#MJSector1",
  "lider.veraguas": "Ver@guas#MJ26",
  "lider.herrera": "Herrer@#IDP2026",
  "lider.lossantos": "San+os#MJ1921",
  "lider.bocas": "Boc@s*DelToro1"
};

/**
 * Obtiene o crea la pestaña de "Jóvenes" en la hoja de cálculo
 */
function obtenerOCrearPestana() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Jóvenes");
  if (!sheet) {
    sheet = ss.insertSheet("Jóvenes");
    sheet.appendRow([
      "Marca Temporal", 
      "Nombre Completo", 
      "Iglesia Local", 
      "Teléfono / WhatsApp", 
      "Área de Interés", 
      "Usuario Registrador"
    ]);
    // Formatear la cabecera en negrita
    sheet.getRange("A1:F1").setFontWeight("bold");
  }
  return sheet;
}

/**
 * Calcula estadísticas globales y obtiene los registros más recientes
 */
function obtenerDatosGlobales(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      stats: { jovenes: 0, iglesias: 0, lideres: 0 },
      recientes: []
    };
  }

  // Descartar cabecera
  const registros = data.slice(1);

  // Estadísticas
  const totalJovenes = registros.length;
  
  const iglesiasUnicas = new Set();
  const lideresUnicos = new Set();
  
  registros.forEach(row => {
    if (row[2]) iglesiasUnicas.add(row[2].toString().trim());
    if (row[5]) lideresUnicos.add(row[5].toString().trim());
  });

  // Obtener los últimos 10 registros
  const ultimosRegistros = registros.slice(-10).reverse().map(row => {
    return {
      fecha: row[0],
      nombre: row[1],
      iglesia: row[2],
      telefono: row[3],
      area: row[4],
      registrador: row[5]
    };
  });

  return {
    stats: {
      jovenes: totalJovenes,
      iglesias: iglesiasUnicas.size,
      lideres: lideresUnicos.size
    },
    recientes: ultimosRegistros
  };
}

/**
 * Función principal para recibir peticiones POST (API principal)
 */
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const usuario = datos.usuario;
    const password = datos.password;

    // 1. VALIDACIÓN ESTRICTA DE CREDENCIALES
    if (!CREDENCIALES_AUTORIZADAS[usuario] || CREDENCIALES_AUTORIZADAS[usuario] !== password) {
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "error", 
        "message": "Usuario o contraseña regionales incorrectos." 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = obtenerOCrearPestana();

    // 2. ACCIÓN: LOGUEARSE (Si la petición solo venía a validar el login)
    if (datos.accion === "login") {
      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Autenticación exitosa.",
        "stats": infoGlobal.stats,
        "recientes": infoGlobal.recientes
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ACCIÓN: REGISTRAR JOVEN (Si la petición viene a guardar datos)
    if (datos.accion === "registrar") {
      // Insertar los datos en Google Sheets
      sheet.appendRow([
        new Date(), // Fecha y Hora
        datos.nombre,
        datos.iglesia,
        datos.telefono,
        datos.area,
        usuario     // Deja registro de qué líder ingresó el dato
      ]);

      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Datos almacenados correctamente.",
        "stats": infoGlobal.stats,
        "recientes": infoGlobal.recientes
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "error", 
      "message": "Acción no reconocida." 
    }))
    .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "error", 
      "message": "Error del servidor: " + error.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función principal para recibir peticiones GET
 */
function doGet(e) {
  try {
    const sheet = obtenerOCrearPestana();
    const infoGlobal = obtenerDatosGlobales(sheet);
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "success", 
      "stats": infoGlobal.stats,
      "recientes": infoGlobal.recientes
    }))
    .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "error", 
      "message": error.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}
