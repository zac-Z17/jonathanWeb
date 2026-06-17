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
 * Obtiene o crea la pestaña de "Jóvenes" en la hoja de cálculo.
 * Realiza migración automática de columnas si la estructura es antigua (6 columnas).
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
      "Usuario Registrador",
      "Estado",
      "ID"
    ]);
    sheet.getRange("A1:H1").setFontWeight("bold");
  } else {
    // Migración automática si es una versión anterior (6 columnas)
    const lastCol = sheet.getLastColumn();
    if (lastCol === 6) {
      sheet.getRange(1, 7).setValue("Estado").setFontWeight("bold");
      sheet.getRange(1, 8).setValue("ID").setFontWeight("bold");
      
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const estadosRange = sheet.getRange(2, 7, lastRow - 1, 1);
        const idsRange = sheet.getRange(2, 8, lastRow - 1, 1);
        
        const estadosValues = [];
        const idsValues = [];
        for (let i = 2; i <= lastRow; i++) {
          estadosValues.push(["Activo"]);
          // Generar ID único para migrados
          idsValues.push(["REG-MIG-" + Date.now() + "-" + i + "-" + Math.floor(Math.random() * 1000)]);
        }
        estadosRange.setValues(estadosValues);
        idsRange.setValues(idsValues);
      }
    }
  }
  return sheet;
}

/**
 * Calcula estadísticas globales (solo de jóvenes ACTIVOS) y obtiene la lista de registros
 */
function obtenerDatosGlobales(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      stats: { jovenes: 0, iglesias: 0, lideres: 0 },
      registros: []
    };
  }

  // Descartar cabecera
  const filas = data.slice(1);

  // Mapear registros
  const registros = filas.map((row, index) => {
    return {
      filaNum: index + 2, // Fila real en Google Sheets (1-based, +2 por cabecera y descarte)
      fecha: row[0],
      nombre: row[1],
      iglesia: row[2],
      telefono: row[3],
      area: row[4],
      registrador: row[5],
      estado: row[6] || "Activo",
      id: row[7] || ("REG-GEN-" + Date.now() + "-" + index)
    };
  });

  // Estadísticas basadas SOLO en jóvenes ACTIVOS
  const registrosActivos = registros.filter(r => r.estado === "Activo");
  
  const totalJovenes = registrosActivos.length;
  const iglesiasUnicas = new Set();
  const lideresUnicos = new Set();
  
  registrosActivos.forEach(r => {
    if (r.iglesia) iglesiasUnicas.add(r.iglesia.toString().trim());
    if (r.registrador) lideresUnicos.add(r.registrador.toString().trim());
  });

  return {
    stats: {
      jovenes: totalJovenes,
      iglesias: iglesiasUnicas.size,
      lideres: lideresUnicos.size
    },
    // Devolvemos todos los registros para que el administrador los gestione en la tabla
    registros: registros
  };
}

/**
 * Busca el número de fila en el que se encuentra un ID específico
 */
function buscarFilaPorID(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === id) {
      return i + 1; // Retorna fila real (1-indexed)
    }
  }
  return -1;
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

    // 2. ACCIÓN: LOGUEARSE (Retorna datos iniciales tras autenticación)
    if (datos.accion === "login") {
      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Autenticación exitosa.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ACCIÓN: REGISTRAR JOVEN
    if (datos.accion === "registrar") {
      const idUnico = "REG-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      
      sheet.appendRow([
        new Date(), // Fecha y Hora
        datos.nombre,
        datos.iglesia,
        datos.telefono,
        datos.area,
        usuario,
        "Activo",   // Estado por defecto
        idUnico     // ID único asignado
      ]);

      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Datos almacenados correctamente.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ACCIÓN: EDITAR JOVEN
    if (datos.accion === "editar") {
      const fila = buscarFilaPorID(sheet, datos.id);
      if (fila === -1) {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "Registro no encontrado." 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      // Modificar celdas individuales
      sheet.getRange(fila, 2).setValue(datos.nombre);
      sheet.getRange(fila, 3).setValue(datos.iglesia);
      sheet.getRange(fila, 4).setValue(datos.telefono);
      sheet.getRange(fila, 5).setValue(datos.area);

      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Registro editado con éxito.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. ACCIÓN: CAMBIAR ESTADO (Activo / Inactivo)
    if (datos.accion === "cambiarEstado") {
      const fila = buscarFilaPorID(sheet, datos.id);
      if (fila === -1) {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "Registro no encontrado." 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      sheet.getRange(fila, 7).setValue(datos.estado); // "Activo" o "Inactivo"

      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Estado actualizado con éxito.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 6. ACCIÓN: ELIMINAR REGISTRO
    if (datos.accion === "eliminar") {
      const fila = buscarFilaPorID(sheet, datos.id);
      if (fila === -1) {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "Registro no encontrado." 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      sheet.deleteRow(fila);

      const infoGlobal = obtenerDatosGlobales(sheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Registro eliminado permanentemente.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
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
      "registros": infoGlobal.registros
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
