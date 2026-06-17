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
 * Obtiene o crea la pestaña de "Eventos".
 */
function obtenerOCrearEventosSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Eventos");
  if (!sheet) {
    sheet = ss.insertSheet("Eventos");
    sheet.appendRow(["ID", "Nombre", "Fecha", "Lugar", "Precio"]);
    sheet.getRange("A1:E1").setFontWeight("bold");
  }
  return sheet;
}

/**
 * Obtiene o crea la pestaña de "InscripcionesEventos".
 */
function obtenerOCrearInscripcionesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("InscripcionesEventos");
  if (!sheet) {
    sheet = ss.insertSheet("InscripcionesEventos");
    sheet.appendRow([
      "ID", 
      "ID Evento", 
      "Nombre Completo", 
      "Apellidos", 
      "Correo", 
      "Región", 
      "Distrito", 
      "Iglesia", 
      "Teléfono", 
      "Tipo Pago", 
      "Monto Abonado", 
      "URL Comprobante", 
      "Estado Factura",
      "Fecha Registro"
    ]);
    sheet.getRange("A1:N1").setFontWeight("bold");
  }
  return sheet;
}

/**
 * Guarda un comprobante en Base64 en una carpeta de Google Drive y retorna la URL
 */
function guardarComprobanteEnDrive(base64Data, fileName) {
  try {
    const folderName = "Comprobantes_Eventos_MJ";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    const partes = base64Data.split(",");
    const tipoMime = partes[0].split(";")[0].split(":")[1];
    const datosPuros = partes[1];
    
    const bytes = Utilities.base64Decode(datosPuros);
    const blob = Utilities.newBlob(bytes, tipoMime, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (error) {
    throw new Error("Error al guardar archivo en Google Drive: " + error.toString());
  }
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

  const filas = data.slice(1);
  const registros = filas.map((row, index) => {
    return {
      filaNum: index + 2,
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
    registros: registros
  };
}

function buscarFilaPorID(sheet, id, idColIndex = 7) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] === id) {
      return i + 1; // Retorna fila real (1-indexed)
    }
  }
  return -1;
}

/**
 * Obtiene todos los eventos de la pestaña
 */
function obtenerTodosLosEventos(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    return {
      id: row[0],
      nombre: row[1],
      fecha: row[2],
      lugar: row[3],
      precio: Number(row[4])
    };
  });
}

/**
 * Obtiene todas las inscripciones a eventos
 */
function obtenerTodasLasInscripciones(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    return {
      id: row[0],
      idEvento: row[1],
      nombre: row[2],
      apellidos: row[3],
      correo: row[4],
      region: row[5],
      distrito: row[6],
      iglesia: row[7],
      telefono: row[8],
      tipoPago: row[9],
      montoAbonado: Number(row[10]),
      urlComprobante: row[11],
      estadoFactura: row[12],
      fechaRegistro: row[13]
    };
  });
}

/**
 * Función principal para recibir peticiones POST (API principal)
 */
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const accion = datos.accion;
    const usuario = datos.usuario;
    const password = datos.password;

    // --- ACCIONES PÚBLICAS (No requieren autenticación administrativa) ---
    
    // A. Obtener eventos disponibles
    if (accion === "obtenerEventosPublicos") {
      const evSheet = obtenerOCrearEventosSheet();
      const eventos = obtenerTodosLosEventos(evSheet);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "eventos": eventos
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // B. Obtener historial de abonos de un usuario por correo
    if (accion === "obtenerHistorialUsuario") {
      const insSheet = obtenerOCrearInscripcionesSheet();
      const inscripciones = obtenerTodasLasInscripciones(insSheet);
      const filtradas = inscripciones.filter(i => i.correo.toLowerCase() === datos.correo.toLowerCase());
      
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "inscripciones": filtradas
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // C. Registrar una nueva inscripción (incluyendo carga de comprobante en Drive)
    if (accion === "registrarInscripcion") {
      const insSheet = obtenerOCrearInscripcionesSheet();
      const evSheet = obtenerOCrearEventosSheet();
      
      // Validar que el evento exista
      const eventos = obtenerTodosLosEventos(evSheet);
      const evento = eventos.find(e => e.id === datos.idEvento);
      if (!evento) {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "El evento seleccionado no existe." 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      // Validar monto total acumulado si abona
      const inscripciones = obtenerTodasLasInscripciones(insSheet);
      const previas = inscripciones.filter(i => i.correo.toLowerCase() === datos.correo.toLowerCase() && i.idEvento === datos.idEvento && i.estadoFactura !== "Inactivo");
      const totalAbonadoPrevio = previas.reduce((sum, current) => sum + current.montoAbonado, 0);
      
      const nuevoMonto = Number(datos.montoAbonado);
      if (totalAbonadoPrevio + nuevoMonto > evento.precio) {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "El monto ingresado excede el costo total del evento. Monto previo: $" + totalAbonadoPrevio + " / Costo total: $" + evento.precio 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      // Subir comprobante a Google Drive
      let urlComprobante = "";
      if (datos.comprobanteBase64) {
        const timestamp = Date.now();
        const safeEmail = datos.correo.replace(/[^a-zA-Z0-9]/g, "_");
        const nombreArchivo = "Comprobante_" + datos.idEvento + "_" + safeEmail + "_" + timestamp + ".jpg";
        urlComprobante = guardarComprobanteEnDrive(datos.comprobanteBase64, nombreArchivo);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ 
          "status": "error", 
          "message": "Es obligatorio adjuntar una foto del comprobante de pago." 
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      const idInscripcion = "INS-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      
      insSheet.appendRow([
        idInscripcion,
        datos.idEvento,
        datos.nombreCompleto,
        datos.apellidos,
        datos.correo,
        datos.region,
        datos.distrito,
        datos.iglesia,
        datos.telefono,
        datos.tipoPago,
        nuevoMonto,
        urlComprobante,
        "Pendiente", // Comienza como pendiente de revisión
        new Date().toISOString()
      ]);

      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "¡Inscripción registrada con éxito! Tu pago está pendiente de verificación.",
        "idInscripcion": idInscripcion
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIONES ADMINISTRATIVAS (Requieren credenciales del censo/regionales) ---
    
    if (!CREDENCIALES_AUTORIZADAS[usuario] || CREDENCIALES_AUTORIZADAS[usuario] !== password) {
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "error", 
        "message": "Acceso denegado. Credenciales de administrador incorrectas." 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIONES DEL CENSO DE JÓVENES (Existente / Retrocompatible) ---
    const sheetJovenes = obtenerOCrearPestana();

    if (accion === "login") {
      const infoGlobal = obtenerDatosGlobales(sheetJovenes);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Autenticación exitosa.",
        "stats": infoGlobal.stats,
        "registros": infoGlobal.registros
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    if (accion === "registrar") {
      const idUnico = "REG-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      sheetJovenes.appendRow([new Date(), datos.nombre, datos.iglesia, datos.telefono, datos.area, usuario, "Activo", idUnico]);
      const infoGlobal = obtenerDatosGlobales(sheetJovenes);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "stats": infoGlobal.stats, "registros": infoGlobal.registros })).setMimeType(ContentService.MimeType.JSON);
    }

    if (accion === "editar") {
      const fila = buscarFilaPorID(sheetJovenes, datos.id, 7);
      if (fila !== -1) {
        sheetJovenes.getRange(fila, 2).setValue(datos.nombre);
        sheetJovenes.getRange(fila, 3).setValue(datos.iglesia);
        sheetJovenes.getRange(fila, 4).setValue(datos.telefono);
        sheetJovenes.getRange(fila, 5).setValue(datos.area);
      }
      const infoGlobal = obtenerDatosGlobales(sheetJovenes);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "stats": infoGlobal.stats, "registros": infoGlobal.registros })).setMimeType(ContentService.MimeType.JSON);
    }

    if (accion === "cambiarEstado") {
      const fila = buscarFilaPorID(sheetJovenes, datos.id, 7);
      if (fila !== -1) {
        sheetJovenes.getRange(fila, 7).setValue(datos.estado);
      }
      const infoGlobal = obtenerDatosGlobales(sheetJovenes);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "stats": infoGlobal.stats, "registros": infoGlobal.registros })).setMimeType(ContentService.MimeType.JSON);
    }

    if (accion === "eliminar") {
      const fila = buscarFilaPorID(sheetJovenes, datos.id, 7);
      if (fila !== -1) {
        sheetJovenes.deleteRow(fila);
      }
      const infoGlobal = obtenerDatosGlobales(sheetJovenes);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "stats": infoGlobal.stats, "registros": infoGlobal.registros })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- NUEVAS ACCIONES DEL PORTAL DE EVENTOS ADMINISTRATIVO ---
    const evSheet = obtenerOCrearEventosSheet();
    const insSheet = obtenerOCrearInscripcionesSheet();

    // 1. Obtener datos iniciales del panel de eventos admin (Eventos + Inscripciones)
    if (accion === "obtenerDatosAdminEventos") {
      const eventos = obtenerTodosLosEventos(evSheet);
      const inscripciones = obtenerTodasLasInscripciones(insSheet);
      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "eventos": eventos,
        "inscripciones": inscripciones
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Guardar (crear o editar) Evento
    if (accion === "guardarEvento") {
      const id = datos.id || ("EV-" + Date.now() + "-" + Math.floor(Math.random() * 100));
      const fila = buscarFilaPorID(evSheet, id, 0);
      
      if (fila === -1) {
        // Crear
        evSheet.appendRow([
          id,
          datos.nombre,
          datos.fecha,
          datos.lugar,
          Number(datos.precio)
        ]);
      } else {
        // Editar
        evSheet.getRange(fila, 2).setValue(datos.nombre);
        evSheet.getRange(fila, 3).setValue(datos.fecha);
        evSheet.getRange(fila, 4).setValue(datos.lugar);
        evSheet.getRange(fila, 5).setValue(Number(datos.precio));
      }

      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "eventos": obtenerTodosLosEventos(evSheet)
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Eliminar Evento (Borrado en Cascada de Inscripciones)
    if (accion === "eliminarEvento") {
      const id = datos.id;
      const fila = buscarFilaPorID(evSheet, id, 0);
      if (fila !== -1) {
        evSheet.deleteRow(fila);
      }

      // Borrar todas las inscripciones asociadas a este evento
      const dataIns = insSheet.getDataRange().getValues();
      // Recorremos de atrás hacia adelante para evitar que se desfasen los índices al borrar filas
      for (let i = dataIns.length - 1; i >= 1; i--) {
        if (dataIns[i][1] === id) {
          insSheet.deleteRow(i + 1);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "eventos": obtenerTodosLosEventos(evSheet),
        "inscripciones": obtenerTodasLasInscripciones(insSheet)
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Modificar Estado de Factura o Detalles de Inscripción
    if (accion === "guardarInscripcionAdmin") {
      const id = datos.id;
      const fila = buscarFilaPorID(insSheet, id, 0);
      if (fila === -1) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Inscripción no encontrada." })).setMimeType(ContentService.MimeType.JSON);
      }

      // Actualizar campos
      insSheet.getRange(fila, 3).setValue(datos.nombreCompleto);
      insSheet.getRange(fila, 4).setValue(datos.apellidos);
      insSheet.getRange(fila, 5).setValue(datos.correo);
      insSheet.getRange(fila, 6).setValue(datos.region);
      insSheet.getRange(fila, 7).setValue(datos.distrito);
      insSheet.getRange(fila, 8).setValue(datos.iglesia);
      insSheet.getRange(fila, 9).setValue(datos.telefono);
      insSheet.getRange(fila, 10).setValue(datos.tipoPago);
      insSheet.getRange(fila, 11).setValue(Number(datos.montoAbonado));
      insSheet.getRange(fila, 13).setValue(datos.estadoFactura); // Pendiente, Abono, Completado

      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "inscripciones": obtenerTodasLasInscripciones(insSheet)
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Eliminar Inscripción Individual
    if (accion === "eliminarInscripcionAdmin") {
      const id = datos.id;
      const fila = buscarFilaPorID(insSheet, id, 0);
      if (fila !== -1) {
        insSheet.deleteRow(fila);
      }

      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "inscripciones": obtenerTodasLasInscripciones(insSheet)
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Acción administrativa no reconocida." })).setMimeType(ContentService.MimeType.JSON);

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
    const sheetJovenes = obtenerOCrearPestana();
    const evSheet = obtenerOCrearEventosSheet();
    const insSheet = obtenerOCrearInscripcionesSheet();
    
    const infoGlobal = obtenerDatosGlobales(sheetJovenes);
    const eventos = obtenerTodosLosEventos(evSheet);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "success", 
      "stats": infoGlobal.stats,
      "registros": infoGlobal.registros,
      "eventos": eventos
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
