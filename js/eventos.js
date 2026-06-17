// --- CONFIGURACIÓN GENERAL ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_7p41yoH9_a2J2HRC8DoD75MUmw49EuCwxGv6UTrDAIy71mVBwoq3aMhzTbQ5M6DS/exec";

// Credenciales para la sección de administración
const CREDENCIALES_LOCALES = {
    "admin.general": "IDP*Reg1*2026",
    "lider.cocle": "Cocle#MJSector1",
    "lider.veraguas": "Ver@guas#MJ26",
    "lider.herrera": "Herrer@#IDP2026",
    "lider.lossantos": "San+os#MJ1921",
    "lider.bocas": "Boc@s*DelToro1"
};

// Claves de almacenamiento local (para persistencia offline y sesión)
const EVENTOS_CLAVE = "mj_eventos_local_v1";
const INS_CLAVE = "mj_inscripciones_local_v1";

// Variables de estado
let usuarioIdentificado = JSON.parse(localStorage.getItem("usuario_identificado")) || null;
let adminUsuario = sessionStorage.getItem("adminUsuario") || "";
let adminPassword = sessionStorage.getItem("adminPassword") || "";

let eventosGlobales = [];
let inscripcionesGlobales = [];
let dbOffline = false;

// Instancias de gráficos
let chartInscritosPorEvento = null;
let chartInscritosPorRegion = null;

// Mock data en caso de fallo de red
const MOCK_EVENTOS = [
    { id: "EV-MOCK-1", nombre: "Convención Regional 1", fecha: "2026-06-19", lugar: "Coclé", precio: 50 },
    { id: "EV-MOCK-2", nombre: "Convocatoria Juvenil", fecha: "2026-08-22", lugar: "Veraguas", precio: 15 },
    { id: "EV-MOCK-3", nombre: "Misión Social Bocas", fecha: "2026-10-09", lugar: "Bocas del Toro", precio: 30 }
];

const MOCK_INSCRIPCIONES = [
    { id: "INS-MOCK-1", idEvento: "EV-MOCK-1", nombre: "Juan", apellidos: "Pérez", correo: "juan@gmail.com", region: "Coclé", distrito: "Penonomé", iglesia: "IDP Coclé", telefono: "6611-2233", tipoPago: "Abono", montoAbonado: 20, urlComprobante: "#", estadoFactura: "Abono", fechaRegistro: new Date().toISOString() },
    { id: "INS-MOCK-2", idEvento: "EV-MOCK-1", nombre: "María", apellidos: "Gómez", correo: "maria@gmail.com", region: "Veraguas", distrito: "Santiago", iglesia: "IDP Veraguas", telefono: "6799-8877", tipoPago: "Completo", montoAbonado: 50, urlComprobante: "#", estadoFactura: "Completado", fechaRegistro: new Date().toISOString() }
];

// ==========================================
// SISTEMA DE NOTIFICACIONES (TOAST)
// ==========================================
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all duration-500 transform translate-x-20 opacity-0 min-w-[280px]`;
    
    let bgClass = "bg-white text-slate-800 border-slate-200";
    let icon = "🔔";

    if (type === "success") {
        bgClass = "bg-emerald-950/90 text-emerald-300 border-emerald-800/50 backdrop-blur-md";
        icon = "✅";
    } else if (type === "error") {
        bgClass = "bg-red-950/90 text-red-300 border-red-800/50 backdrop-blur-md";
        icon = "❌";
    } else if (type === "warning") {
        bgClass = "bg-amber-950/90 text-amber-300 border-amber-800/50 backdrop-blur-md";
        icon = "⚠️";
    }

    toast.className += ` ${bgClass}`;
    toast.innerHTML = `<span class="text-base">${icon}</span><span class="text-xs font-bold font-sans">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-x-20", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("translate-x-20", "opacity-0");
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 4000);
}

// ==========================================
// SESIÓN DE USUARIO PÚBLICO (IDENTIFICACIÓN)
// ==========================================
function actualizarSesionUsuarioUI() {
    const identifiedSection = document.getElementById("user-identified-section");
    const loginSection = document.getElementById("user-login-section");
    const userNameEl = document.getElementById("user-display-name");
    const userEmailEl = document.getElementById("user-display-email");
    const publicContainer = document.getElementById("public-events-container");

    if (usuarioIdentificado) {
        identifiedSection.classList.remove("hidden");
        loginSection.classList.add("hidden");
        userNameEl.textContent = usuarioIdentificado.nombre;
        userEmailEl.textContent = usuarioIdentificado.correo;
        publicContainer.classList.remove("opacity-50", "pointer-events-none");
    } else {
        identifiedSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
        publicContainer.classList.add("opacity-50", "pointer-events-none");
    }
}

function identificarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById("user-input-name").value.trim();
    const correo = document.getElementById("user-input-email").value.trim().toLowerCase();

    if (!nombre || !correo) {
        showToast("Por favor complete todos los campos.", "error");
        return;
    }

    usuarioIdentificado = { nombre, correo };
    localStorage.setItem("usuario_identificado", JSON.stringify(usuarioIdentificado));
    showToast(`Bienvenido(a), ${nombre}`, "success");
    actualizarSesionUsuarioUI();
    cargarEventosYHistorial();
}

function desidentificarUsuario() {
    usuarioIdentificado = null;
    localStorage.removeItem("usuario_identificado");
    showToast("Sesión de usuario finalizada", "warning");
    actualizarSesionUsuarioUI();
    
    // Limpiar historial de abonos anterior
    const abonoBanner = document.getElementById("abono-previo-banner");
    if (abonoBanner) abonoBanner.classList.add("hidden");
    
    renderEventosPublicos(eventosGlobales);
}

// ==========================================
// CARGA DE DATOS DESDE SHEETS / LOCAL
// ==========================================
function obtenerDatosLocales() {
    let eventos = localStorage.getItem(EVENTOS_CLAVE);
    let inscripciones = localStorage.getItem(INS_CLAVE);

    if (!eventos) {
        localStorage.setItem(EVENTOS_CLAVE, JSON.stringify(MOCK_EVENTOS));
        eventos = JSON.stringify(MOCK_EVENTOS);
    }
    if (!inscripciones) {
        localStorage.setItem(INS_CLAVE, JSON.stringify(MOCK_INSCRIPCIONES));
        inscripciones = JSON.stringify(MOCK_INSCRIPCIONES);
    }

    return {
        eventos: JSON.parse(eventos),
        inscripciones: JSON.parse(inscripciones)
    };
}

function guardarDatosLocales(eventos, inscripciones) {
    if (eventos) localStorage.setItem(EVENTOS_CLAVE, JSON.stringify(eventos));
    if (inscripciones) localStorage.setItem(INS_CLAVE, JSON.stringify(inscripciones));
}

function cargarEventosYHistorial() {
    showToast("Cargando eventos...", "warning");
    
    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        // Fetch GET a Sheets
        fetch(WEB_APP_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success" && data.eventos) {
                eventosGlobales = data.eventos;
                guardarDatosLocales(eventosGlobales, null);
                
                // Si el usuario está identificado, buscar su historial de abonos
                if (usuarioIdentificado) {
                    buscarHistorialAbonosSheets();
                } else {
                    renderEventosPublicos(eventosGlobales);
                }
            } else {
                throw new Error("Formato inválido de Sheets");
            }
        })
        .catch(err => {
            console.log("Fallo de red al obtener eventos. Conmutando a modo local.", err);
            dbOffline = true;
            conmutarAModoLocalUI();
            
            const local = obtenerDatosLocales();
            eventosGlobales = local.eventos;
            inscripcionesGlobales = local.inscripciones;
            renderEventosPublicos(eventosGlobales);
        });
    } else {
        const local = obtenerDatosLocales();
        eventosGlobales = local.eventos;
        inscripcionesGlobales = local.inscripciones;
        renderEventosPublicos(eventosGlobales);
    }
}

function buscarHistorialAbonosSheets() {
    fetch(WEB_APP_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            accion: "obtenerHistorialUsuario",
            correo: usuarioIdentificado.correo
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.inscripciones) {
            inscripcionesGlobales = data.inscripciones;
            renderEventosPublicos(eventosGlobales);
        } else {
            showToast("No se pudo obtener el historial de abonos", "error");
            renderEventosPublicos(eventosGlobales);
        }
    })
    .catch(err => {
        console.log("Error de red al consultar historial. Usando copia local.", err);
        const local = obtenerDatosLocales();
        inscripcionesGlobales = local.inscripciones.filter(i => i.correo.toLowerCase() === usuarioIdentificado.correo.toLowerCase());
        renderEventosPublicos(eventosGlobales);
    });
}

function conmutarAModoLocalUI() {
    const indicator = document.getElementById("connection-indicator");
    const text = document.getElementById("connection-text");
    if (indicator) {
        indicator.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
    }
    if (text) {
        text.textContent = "Desconectado (Local)";
        text.className = "text-[10px] font-bold text-amber-500 tracking-wider uppercase";
    }
}

// ==========================================
// RENDERIZADO DE VISTA PÚBLICA DE EVENTOS
// ==========================================
function renderEventosPublicos(eventos) {
    const grid = document.getElementById("events-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!eventos || eventos.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400 italic">
                <i class="fa-regular fa-calendar-xmark text-4xl block mb-3 text-slate-600"></i>
                No hay eventos regionales disponibles en este momento.
            </div>
        `;
        return;
    }

    eventos.forEach(evt => {
        // Buscar abonos previos para este evento
        let abonoAcumulado = 0;
        let estadoCompletado = false;
        
        if (usuarioIdentificado) {
            const inscripcionesEvento = inscripcionesGlobales.filter(i => i.idEvento === evt.id && i.estadoFactura !== "Inactivo");
            abonoAcumulado = inscripcionesEvento.reduce((sum, item) => sum + Number(item.montoAbonado), 0);
            
            // Verificar si el estado es Completado en el panel administrativo
            // Si el total acumulado iguala o supera el precio, o si alguna inscripción está Completada
            const tieneCompletado = inscripcionesEvento.some(i => i.estadoFactura === "Completado");
            if (tieneCompletado || abonoAcumulado >= evt.precio) {
                estadoCompletado = true;
            }
        }

        const card = document.createElement("div");
        card.className = "glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-2 relative overflow-hidden group";
        
        let overlayIndicator = "";
        let btnText = "Inscribirse / Abonar";
        let btnClass = "bg-mjAzul hover:bg-blue-800 text-white";

        if (usuarioIdentificado) {
            if (estadoCompletado) {
                overlayIndicator = `<div class="absolute top-3 right-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">¡Inscripción Completa!</div>`;
                btnText = "Ver Detalles";
                btnClass = "bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/40 text-emerald-400";
            } else if (abonoAcumulado > 0) {
                overlayIndicator = `<div class="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">Abonado: $${abonoAcumulado.toFixed(2)}</div>`;
                btnText = "Completar Pago";
                btnClass = "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold";
            }
        }

        // Formatear Fecha
        const fechaFormateada = new Date(evt.fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });

        card.innerHTML = `
            ${overlayIndicator}
            <div class="space-y-3">
                <div class="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                    <i class="fa-solid fa-ticket text-lg"></i>
                </div>
                <h4 class="text-white font-extrabold text-lg leading-tight group-hover:text-blue-400 transition-colors">${evt.nombre}</h4>
                <div class="text-xs text-slate-400 space-y-1 font-medium">
                    <p class="flex items-center gap-2"><i class="fa-regular fa-calendar text-blue-500"></i> ${fechaFormateada}</p>
                    <p class="flex items-center gap-2"><i class="fa-solid fa-location-dot text-blue-500"></i> ${evt.lugar}</p>
                </div>
            </div>
            
            <div class="mt-6 pt-4 border-t border-slate-800/50 flex items-center justify-between">
                <div>
                    <span class="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Costo</span>
                    <span class="text-2xl font-black text-white">$${evt.precio.toFixed(2)}</span>
                </div>
                <button onclick="abrirFormularioInscripcion('${evt.id}')" class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 ${btnClass}">
                    ${btnText} <i class="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
// FORMULARIO DE REGISTRO PÚBLICO
// ==========================================
let eventoSeleccionadoId = "";

function abrirFormularioInscripcion(eventoId) {
    if (!usuarioIdentificado) {
        showToast("Primero debes identificarte en la parte superior.", "warning");
        document.getElementById("user-input-name").focus();
        return;
    }

    const evt = eventosGlobales.find(e => e.id === eventoId);
    if (!evt) return;

    eventoSeleccionadoId = eventoId;
    
    // Rellenar cabecera del modal
    document.getElementById("modal-ins-titulo").textContent = `Inscripción: ${evt.nombre}`;
    document.getElementById("modal-ins-costo").textContent = `$${evt.precio.toFixed(2)}`;

    // Rellenar datos por defecto del usuario
    document.getElementById("ins-nombre").value = usuarioIdentificado.nombre;
    document.getElementById("ins-correo").value = usuarioIdentificado.correo;

    // Calcular abonos acumulados
    const previas = inscripcionesGlobales.filter(i => i.idEvento === eventoId && i.estadoFactura !== "Inactivo");
    const totalAbonadoPrevio = previas.reduce((sum, item) => sum + Number(item.montoAbonado), 0);
    const saldoRestante = evt.precio - totalAbonadoPrevio;

    const abonoBanner = document.getElementById("abono-previo-banner");
    const abonoDetalle = document.getElementById("abono-previo-detalle");

    if (totalAbonadoPrevio > 0) {
        abonoBanner.classList.remove("hidden");
        abonoDetalle.innerHTML = `
            Ya has realizado abonos previos por un total de <strong class="text-amber-400 font-mono">$${totalAbonadoPrevio.toFixed(2)}</strong>.<br>
            Saldo restante para completar: <strong class="text-emerald-400 font-mono">$${saldoRestante.toFixed(2)}</strong>.
        `;
    } else {
        abonoBanner.classList.add("hidden");
    }

    // Configurar tipo de pago
    const selectTipo = document.getElementById("ins-tipo-pago");
    const inputMonto = document.getElementById("ins-monto");

    // Limpiar valores anteriores del formulario
    inputMonto.value = "";
    document.getElementById("ins-apellidos").value = "";
    document.getElementById("ins-telefono").value = "";
    document.getElementById("ins-comprobante").value = "";
    document.getElementById("comprobante-preview-container").classList.add("hidden");

    // Lógica de validación de montos
    if (saldoRestante <= 0) {
        showToast("Este evento ya ha sido pagado en su totalidad.", "info");
        return;
    }

    // Si el saldo restante es menor que el precio, obligar a que sea abono (o completo por el saldo restante)
    selectTipo.innerHTML = "";
    if (totalAbonadoPrevio > 0) {
        selectTipo.innerHTML = `
            <option value="Abono">Abonar saldo restante</option>
            <option value="Completo">Completar pago total ($${saldoRestante.toFixed(2)})</option>
        `;
        inputMonto.value = saldoRestante;
    } else {
        selectTipo.innerHTML = `
            <option value="Abono">Abono parcial</option>
            <option value="Completo">Pago Completo ($${evt.precio.toFixed(2)})</option>
        `;
        inputMonto.value = evt.precio;
    }

    // Abrir modal
    document.getElementById("modal-inscripcion").classList.remove("hidden");
}

function cerrarFormularioInscripcion() {
    document.getElementById("modal-inscripcion").classList.add("hidden");
    eventoSeleccionadoId = "";
}

function cambiarTipoPago() {
    const selectTipo = document.getElementById("ins-tipo-pago").value;
    const inputMonto = document.getElementById("ins-monto");
    const evt = eventosGlobales.find(e => e.id === eventoSeleccionadoId);
    if (!evt) return;

    const previas = inscripcionesGlobales.filter(i => i.idEvento === eventoSeleccionadoId && i.estadoFactura !== "Inactivo");
    const totalAbonadoPrevio = previas.reduce((sum, item) => sum + Number(item.montoAbonado), 0);
    const saldoRestante = evt.precio - totalAbonadoPrevio;

    if (selectTipo === "Completo") {
        inputMonto.value = saldoRestante;
        inputMonto.setAttribute("readonly", true);
    } else {
        inputMonto.value = "";
        inputMonto.removeAttribute("readonly");
    }
}

// Vista previa del comprobante y validación de tipo de archivo
document.getElementById("ins-comprobante").addEventListener("change", function(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById("comprobante-preview-container");
    const imgPreview = document.getElementById("comprobante-preview");

    if (file) {
        if (!file.type.match('image.*')) {
            showToast("Por favor, seleccione un archivo de imagen válido (PNG, JPG, JPEG).", "error");
            this.value = "";
            previewContainer.classList.add("hidden");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            imgPreview.src = evt.target.result;
            previewContainer.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.classList.add("hidden");
    }
});

// Enviar formulario de inscripción pública
document.getElementById("form-inscripcion-evento").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-ins-submit");
    const fileInput = document.getElementById("ins-comprobante");
    const file = fileInput.files[0];

    if (!file) {
        showToast("Es obligatorio subir la foto del comprobante de pago.", "error");
        return;
    }

    const evt = eventosGlobales.find(e => e.id === eventoSeleccionadoId);
    const monto = Number(document.getElementById("ins-monto").value);

    // Validar montos acumulados localmente antes de enviar
    const previas = inscripcionesGlobales.filter(i => i.idEvento === eventoSeleccionadoId && i.estadoFactura !== "Inactivo");
    const totalAbonadoPrevio = previas.reduce((sum, item) => sum + Number(item.montoAbonado), 0);

    if (monto <= 0) {
        showToast("El monto debe ser mayor a cero.", "error");
        return;
    }

    if (totalAbonadoPrevio + monto > evt.precio) {
        showToast(`El monto excede el costo total del evento ($${evt.precio.toFixed(2)}). Ya has abonado $${totalAbonadoPrevio.toFixed(2)}.`, "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> Procesando e Inscribiendo...`;
    showToast("Subiendo comprobante y registrando...", "warning");

    const reader = new FileReader();
    reader.onload = function(evtReader) {
        const base64Data = evtReader.target.result;

        const payload = {
            accion: "registrarInscripcion",
            idEvento: eventoSeleccionadoId,
            nombreCompleto: document.getElementById("ins-nombre").value.trim(),
            apellidos: document.getElementById("ins-apellidos").value.trim(),
            correo: document.getElementById("ins-correo").value.trim().toLowerCase(),
            region: document.getElementById("ins-region").value,
            distrito: document.getElementById("ins-distrito").value.trim(),
            iglesia: document.getElementById("ins-iglesia").value,
            telefono: document.getElementById("ins-telefono").value.trim(),
            tipoPago: document.getElementById("ins-tipo-pago").value,
            montoAbonado: monto,
            comprobanteBase64: base64Data
        };

        if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
            fetch(WEB_APP_URL, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                btn.disabled = false;
                btn.textContent = "Subir Inscripción";
                
                if (data.status === "success") {
                    cerrarFormularioInscripcion();
                    showToast("¡Inscripción exitosa! Su pago está en revisión.", "success");
                    
                    // Recargar datos para ver el nuevo abono
                    buscarHistorialAbonosSheets();
                } else {
                    showToast(`Error: ${data.message}`, "error");
                }
            })
            .catch(err => {
                console.log("Error al subir al Sheets. Guardando localmente.", err);
                registrarInscripcionLocal(payload, btn);
            });
        } else {
            registrarInscripcionLocal(payload, btn);
        }
    };
    reader.readAsDataURL(file);
});

function registrarInscripcionLocal(payload, btn) {
    btn.disabled = false;
    btn.textContent = "Subir Inscripción";

    const local = obtenerDatosLocales();
    const idInscripcion = "INS-" + Date.now() + "-" + Math.floor(Math.random() * 100);
    
    const nuevaIns = {
        id: idInscripcion,
        idEvento: payload.idEvento,
        nombre: payload.nombreCompleto,
        apellidos: payload.apellidos,
        correo: payload.correo,
        region: payload.region,
        distrito: payload.distrito,
        iglesia: payload.iglesia,
        telefono: payload.telefono,
        tipoPago: payload.tipoPago,
        montoAbonado: payload.montoAbonado,
        urlComprobante: "#", // Localmente no sube a Drive
        estadoFactura: "Pendiente",
        fechaRegistro: new Date().toISOString()
    };

    local.inscripciones.push(nuevaIns);
    guardarDatosLocales(null, local.inscripciones);
    
    // Actualizar cache local
    inscripcionesGlobales = local.inscripciones.filter(i => i.correo.toLowerCase() === usuarioIdentificado.correo.toLowerCase());
    
    cerrarFormularioInscripcion();
    showToast("Guardado localmente (Offline). Comprobante offline.", "warning");
    renderEventosPublicos(eventosGlobales);
}


// ==========================================
// PORTAL DE ADMINISTRACIÓN (LOGIN / LOGOUT)
// ==========================================
function switchAdminSection(showAdmin) {
    const publicArea = document.getElementById("public-area");
    const adminArea = document.getElementById("admin-area");
    const toggleBtn = document.getElementById("btn-toggle-admin");

    if (showAdmin) {
        publicArea.classList.add("hidden");
        adminArea.classList.remove("hidden");
        toggleBtn.innerHTML = `<i class="fa-solid fa-house text-sm"></i> Vista Pública`;
        
        // Verificar si ya tiene sesión iniciada
        if (adminUsuario && adminPassword) {
            document.getElementById("admin-login-container").classList.add("hidden");
            document.getElementById("admin-dashboard-container").classList.remove("hidden");
            document.getElementById("admin-nav-user").textContent = adminUsuario.replace(".", " ");
            cargarDatosAdminPanel();
        } else {
            document.getElementById("admin-login-container").classList.remove("hidden");
            document.getElementById("admin-dashboard-container").classList.add("hidden");
        }
    } else {
        publicArea.classList.remove("hidden");
        adminArea.classList.add("hidden");
        toggleBtn.innerHTML = `<i class="fa-solid fa-lock text-sm"></i> Acceso Administrativo`;
        cargarEventosYHistorial();
    }
}

document.getElementById("form-admin-login").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-admin-login-submit");
    const errorEl = document.getElementById("admin-login-error");
    const user = document.getElementById("admin-login-user").value.trim();
    const pass = document.getElementById("admin-login-pass").value;

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> Autenticando...`;
    errorEl.classList.add("hidden");

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        // Enviar petición POST de login para evento admins
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "obtenerDatosAdminEventos",
                usuario: user,
                password: pass
            })
        })
        .then(res => res.json())
        .then(data => {
            btn.disabled = false;
            btn.textContent = "Verificar Credenciales";

            if (data.status === "success") {
                adminUsuario = user;
                adminPassword = pass;
                sessionStorage.setItem("adminUsuario", user);
                sessionStorage.setItem("adminPassword", pass);

                document.getElementById("admin-login-container").classList.add("hidden");
                document.getElementById("admin-dashboard-container").classList.remove("hidden");
                document.getElementById("admin-nav-user").textContent = user.replace(".", " ");

                showToast(`Sesión admin iniciada para ${user}`, "success");
                
                // Rellenar datos
                eventosGlobales = data.eventos;
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(eventosGlobales, inscripcionesGlobales);
                actualizarAdminUI();
            } else {
                errorEl.textContent = `❌ ${data.message}`;
                errorEl.classList.remove("hidden");
            }
        })
        .catch(err => {
            console.log("Fallo de red al autenticar admin. Usando validación local.", err);
            validarAdminLocal(user, pass, btn, errorEl);
        });
    } else {
        validarAdminLocal(user, pass, btn, errorEl);
    }
});

function validarAdminLocal(user, pass, btn, errorEl) {
    btn.disabled = false;
    btn.textContent = "Verificar Credenciales";

    if (CREDENCIALES_LOCALES[user] && CREDENCIALES_LOCALES[user] === pass) {
        adminUsuario = user;
        adminPassword = pass;
        sessionStorage.setItem("adminUsuario", user);
        sessionStorage.setItem("adminPassword", pass);

        document.getElementById("admin-login-container").classList.add("hidden");
        document.getElementById("admin-dashboard-container").classList.remove("hidden");
        document.getElementById("admin-nav-user").textContent = user.replace(".", " ");

        dbOffline = true;
        conmutarAModoLocalUI();
        showToast("Sesión admin local iniciada (Modo Offline)", "warning");

        const local = obtenerDatosLocales();
        eventosGlobales = local.eventos;
        inscripcionesGlobales = local.inscripciones;
        actualizarAdminUI();
    } else {
        errorEl.textContent = "❌ Credenciales administrativas incorrectas.";
        errorEl.classList.remove("hidden");
    }
}

function adminLogout() {
    adminUsuario = "";
    adminPassword = "";
    sessionStorage.removeItem("adminUsuario");
    sessionStorage.removeItem("adminPassword");

    document.getElementById("form-admin-login").reset();
    document.getElementById("admin-dashboard-container").classList.add("hidden");
    document.getElementById("admin-login-container").classList.remove("hidden");
    
    showToast("Sesión de administrador cerrada", "info");
}

function cargarDatosAdminPanel() {
    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "obtenerDatosAdminEventos",
                usuario: adminUsuario,
                password: adminPassword
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                eventosGlobales = data.eventos;
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(eventosGlobales, inscripcionesGlobales);
                actualizarAdminUI();
            } else {
                showToast(`Error al cargar panel: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al obtener datos de admin. Usando local.", err);
            dbOffline = true;
            conmutarAModoLocalUI();
            const local = obtenerDatosLocales();
            eventosGlobales = local.eventos;
            inscripcionesGlobales = local.inscripciones;
            actualizarAdminUI();
        });
    } else {
        const local = obtenerDatosLocales();
        eventosGlobales = local.eventos;
        inscripcionesGlobales = local.inscripciones;
        actualizarAdminUI();
    }
}

// ==========================================
// CONTROL DE PESTAÑAS (ADMIN TABS)
// ==========================================
function switchAdminTab(tabId) {
    document.getElementById("admin-tab-content-resumen").classList.add("hidden");
    document.getElementById("admin-tab-content-eventos").classList.add("hidden");
    document.getElementById("admin-tab-content-inscripciones").classList.add("hidden");

    const btnResumen = document.getElementById("admin-tab-btn-resumen");
    const btnEventos = document.getElementById("admin-tab-btn-eventos");
    const btnInscripciones = document.getElementById("admin-tab-btn-inscripciones");

    [btnResumen, btnEventos, btnInscripciones].forEach(btn => {
        btn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all";
    });

    document.getElementById(`admin-tab-content-${tabId}`).classList.remove("hidden");
    const activeBtn = document.getElementById(`admin-tab-btn-${tabId}`);
    activeBtn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all bg-mjAzul text-white shadow-lg shadow-mjAzul/15";

    const title = document.getElementById("admin-page-title");
    const subtitle = document.getElementById("admin-page-subtitle");

    if (tabId === "resumen") {
        title.textContent = "Resumen de Eventos";
        subtitle.textContent = "Estadísticas y análisis visual de inscritos, pagos y cobertura por provincia";
        if (chartInscritosPorEvento) chartInscritosPorEvento.resize();
        if (chartInscritosPorRegion) chartInscritosPorRegion.resize();
    } else if (tabId === "eventos") {
        title.textContent = "Eventos Oficiales";
        subtitle.textContent = "Administra la creación, edición y eliminación de eventos de la Región 1";
    } else if (tabId === "inscripciones") {
        title.textContent = "Control de Inscripciones";
        subtitle.textContent = "Gestiona, audita, aprueba abonos y filtra inscritos para cada evento";
    }
}

// ==========================================
// GRÁFICOS Y ESTADÍSTICAS DEL ADMIN PANEL
// ==========================================
function actualizarAdminUI() {
    // 1. Calcular contadores del panel
    const inscripcionesActivas = inscripcionesGlobales.filter(i => i.estadoFactura !== "Inactivo");
    
    // Total recaudado
    const totalRecaudado = inscripcionesActivas.reduce((sum, item) => sum + Number(item.montoAbonado), 0);
    
    document.getElementById("admin-stat-eventos").textContent = eventosGlobales.length;
    document.getElementById("admin-stat-inscritos").textContent = inscripcionesActivas.length;
    document.getElementById("admin-stat-recaudado").textContent = `$${totalRecaudado.toFixed(2)}`;

    // 2. Renderizar Gráficos
    renderGráficosAdmin(eventosGlobales, inscripcionesActivas);

    // 3. Rellenar selects de filtros en inscripciones
    const filterEv = document.getElementById("admin-filter-evento");
    const selectEventosModal = document.getElementById("admin-ins-evento"); // Select en modal de edición
    
    const prevSelectedEv = filterEv.value;
    filterEv.innerHTML = `<option value="Todos">Todos los Eventos</option>`;
    if (selectEventosModal) selectEventosModal.innerHTML = "";

    eventosGlobales.forEach(evt => {
        filterEv.innerHTML += `<option value="${evt.id}">${evt.nombre}</option>`;
        if (selectEventosModal) {
            selectEventosModal.innerHTML += `<option value="${evt.id}">${evt.nombre} ($${evt.precio.toFixed(2)})</option>`;
        }
    });
    filterEv.value = prevSelectedEv || "Todos";

    // 4. Renderizar tablas
    renderTableEventos(eventosGlobales);
    filterInscripcionesAdmin();
}

function renderGráficosAdmin(eventos, inscripciones) {
    // A. Inscritos por Evento
    const eventoLabels = eventos.map(e => e.nombre);
    const eventoCounts = eventos.map(e => {
        return inscripciones.filter(i => i.idEvento === e.id).length;
    });

    if (chartInscritosPorEvento) {
        chartInscritosPorEvento.data.labels = eventoLabels;
        chartInscritosPorEvento.data.datasets[0].data = eventoCounts;
        chartInscritosPorEvento.update();
    } else {
        const ctx1 = document.getElementById("chart-inscritos-evento");
        if (ctx1) {
            chartInscritosPorEvento = new Chart(ctx1.getContext("2d"), {
                type: 'bar',
                data: {
                    labels: eventoLabels.map(l => l.length > 15 ? l.substring(0, 15) + "..." : l),
                    datasets: [{
                        label: 'Inscritos',
                        data: eventoCounts,
                        backgroundColor: 'rgba(59, 130, 246, 0.65)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
                        x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                    }
                }
            });
        }
    }

    // B. Inscritos por Región (Provincias/Áreas)
    const regionesList = ["IDP Bocas del Toro", "IDP Coclé", "IDP Chiriquí", "IDP Herrera", "IDP Los Santos", "IDP Veraguas"];
    const regionCounts = regionesList.map(dist => {
        return inscripciones.filter(i => i.distrito === dist).length;
    });

    if (chartInscritosPorRegion) {
        chartInscritosPorRegion.data.datasets[0].data = regionCounts;
        chartInscritosPorRegion.update();
    } else {
        const ctx2 = document.getElementById("chart-inscritos-region");
        if (ctx2) {
            chartInscritosPorRegion = new Chart(ctx2.getContext("2d"), {
                type: 'doughnut',
                data: {
                    labels: regionesList.map(r => r.replace("IDP ", "")),
                    datasets: [{
                        data: regionCounts,
                        backgroundColor: [
                            'rgba(245, 158, 11, 0.75)',  // Amber
                            'rgba(59, 130, 246, 0.75)',   // Blue
                            'rgba(139, 92, 246, 0.75)',  // Purple
                            'rgba(239, 68, 68, 0.75)',    // Red
                            'rgba(16, 185, 129, 0.75)',  // Emerald
                            'rgba(100, 116, 139, 0.75)'  // Slate
                        ],
                        borderColor: '#020617',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#e2e8f0', boxWidth: 10, font: { size: 9 } }
                        }
                    }
                }
            });
        }
    }
}

// ==========================================
// CRUD EVENTOS (ADMINISTRADOR)
// ==========================================
function renderTableEventos(eventos) {
    const tableBody = document.getElementById("table-eventos-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (!eventos || eventos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">No hay eventos creados todavía.</td></tr>`;
        return;
    }

    eventos.forEach(evt => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-900 bg-slate-950/20 hover:bg-slate-900/40 transition-all";
        
        const fechaFormateada = new Date(evt.fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        });

        tr.innerHTML = `
            <td class="p-4 sm:p-5 font-bold text-white max-w-[180px] truncate">${evt.nombre}</td>
            <td class="p-4 sm:p-5 font-mono text-slate-300">${fechaFormateada}</td>
            <td class="p-4 sm:p-5 text-slate-300 font-medium">${evt.lugar}</td>
            <td class="p-4 sm:p-5 font-bold text-amber-400 font-mono">$${evt.precio.toFixed(2)}</td>
            <td class="p-4 sm:p-5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openEditEventoModal('${evt.id}', '${evt.nombre.replace(/'/g, "\\'")}', '${evt.fecha}', '${evt.lugar.replace(/'/g, "\\'")}', ${evt.precio})" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-mjAzul hover:text-white text-slate-400 flex items-center justify-center border border-slate-800 hover:border-mjAzul transition-all" title="Editar Evento">
                        <i class="fa-solid fa-pencil text-xs"></i>
                    </button>
                    <button onclick="openDeleteEventoModal('${evt.id}', '${evt.nombre.replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-red-950/40 hover:text-red-400 text-slate-400 flex items-center justify-center border border-slate-800 hover:border-red-900/40 transition-all" title="Eliminar Evento">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function openAddEventoModal() {
    document.getElementById("evento-id").value = "";
    document.getElementById("evento-nombre").value = "";
    document.getElementById("evento-fecha").value = "";
    document.getElementById("evento-lugar").value = "";
    document.getElementById("evento-precio").value = "";
    document.getElementById("modal-evento-titulo").textContent = "Crear Nuevo Evento";
    document.getElementById("modal-evento").classList.remove("hidden");
}

function openEditEventoModal(id, nombre, fecha, lugar, precio) {
    // fecha viene en formato YYYY-MM-DD o similar. Formatear para el date input (YYYY-MM-DD)
    let dateVal = "";
    if (fecha) {
        const d = new Date(fecha);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        dateVal = `${yyyy}-${mm}-${dd}`;
    }

    document.getElementById("evento-id").value = id;
    document.getElementById("evento-nombre").value = nombre;
    document.getElementById("evento-fecha").value = dateVal;
    document.getElementById("evento-lugar").value = lugar;
    document.getElementById("evento-precio").value = precio;
    document.getElementById("modal-evento-titulo").textContent = "Editar Evento";
    document.getElementById("modal-evento").classList.remove("hidden");
}

function cerrarEventoModal() {
    document.getElementById("modal-evento").classList.add("hidden");
}

document.getElementById("form-evento").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("evento-id").value;
    const nombre = document.getElementById("evento-nombre").value.trim();
    const fecha = document.getElementById("evento-fecha").value;
    const lugar = document.getElementById("evento-lugar").value.trim();
    const precio = Number(document.getElementById("evento-precio").value);

    if (!nombre || !fecha || !lugar || precio <= 0) {
        showToast("Por favor, rellene todos los campos con valores correctos.", "error");
        return;
    }

    cerrarEventoModal();
    showToast("Guardando evento...", "warning");

    const payload = {
        accion: "guardarEvento",
        usuario: adminUsuario,
        password: adminPassword,
        id: id || null,
        nombre,
        fecha,
        lugar,
        precio
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                eventosGlobales = data.eventos;
                guardarDatosLocales(eventosGlobales, null);
                actualizarAdminUI();
                showToast("¡Evento guardado exitosamente!", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al guardar evento. Guardando local.", err);
            guardarEventoLocal(payload);
        });
    } else {
        guardarEventoLocal(payload);
    }
});

function guardarEventoLocal(payload) {
    const local = obtenerDatosLocales();
    const idVal = payload.id || ("EV-" + Date.now() + "-" + Math.floor(Math.random() * 100));
    const index = local.eventos.findIndex(e => e.id === idVal);

    const eventoObj = {
        id: idVal,
        nombre: payload.nombre,
        fecha: payload.fecha,
        lugar: payload.lugar,
        precio: payload.precio
    };

    if (index === -1) {
        local.eventos.push(eventoObj);
    } else {
        local.eventos[index] = eventoObj;
    }

    guardarDatosLocales(local.eventos, null);
    eventosGlobales = local.eventos;
    actualizarAdminUI();
    showToast("Evento guardado localmente (Offline)", "warning");
}

// Borrar evento en cascada
function openDeleteEventoModal(id, nombre) {
    document.getElementById("delete-evento-id").value = id;
    document.getElementById("delete-evento-nombre").textContent = nombre;
    document.getElementById("modal-delete-evento").classList.remove("hidden");
}

function cerrarDeleteEventoModal() {
    document.getElementById("modal-delete-evento").classList.add("hidden");
}

function confirmarEliminarEvento() {
    const id = document.getElementById("delete-evento-id").value;
    cerrarDeleteEventoModal();
    showToast("Eliminando evento y sus inscripciones en cascada...", "warning");

    const payload = {
        accion: "eliminarEvento",
        usuario: adminUsuario,
        password: adminPassword,
        id: id
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                eventosGlobales = data.eventos;
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(eventosGlobales, inscripcionesGlobales);
                actualizarAdminUI();
                showToast("Evento e inscripciones eliminados permanentemente", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al eliminar evento. Borrando localmente.", err);
            eliminarEventoLocal(id);
        });
    } else {
        eliminarEventoLocal(id);
    }
}

function eliminarEventoLocal(id) {
    const local = obtenerDatosLocales();
    local.eventos = local.eventos.filter(e => e.id !== id);
    
    // Eliminación en cascada local
    local.inscripciones = local.inscripciones.filter(i => i.idEvento !== id);

    guardarDatosLocales(local.eventos, local.inscripciones);
    eventosGlobales = local.eventos;
    inscripcionesGlobales = local.inscripciones;
    
    actualizarAdminUI();
    showToast("Evento e inscripciones eliminados localmente (Offline)", "warning");
}


// ==========================================
// AUDITORÍA Y COMPROBACIÓN DE INSCRIPCIONES (ADMIN)
// ==========================================
function renderTableInscripciones(inscripciones) {
    const tableBody = document.getElementById("table-inscripciones-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (!inscripciones || inscripciones.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400 italic">No hay inscripciones registradas para los filtros aplicados.</td></tr>`;
        return;
    }

    inscripciones.forEach(ins => {
        const tr = document.createElement("tr");
        
        // Determinar color por estado
        let estadoBadgeClass = "bg-slate-800 text-slate-500 border border-slate-700/50";
        if (ins.estadoFactura === "Pendiente") {
            estadoBadgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse";
        } else if (ins.estadoFactura === "Abono") {
            estadoBadgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/25";
        } else if (ins.estadoFactura === "Completado") {
            estadoBadgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
        } else if (ins.estadoFactura === "Inactivo") {
            estadoBadgeClass = "bg-slate-900 text-slate-600 border border-slate-800";
            tr.className += " opacity-50";
        }

        tr.className += " border-b border-slate-900 bg-slate-950/20 hover:bg-slate-900/40 transition-all";

        // Obtener nombre del evento
        const evt = eventosGlobales.find(e => e.id === ins.idEvento);
        const eventoNombre = evt ? evt.nombre : "Evento Desconocido";

        // Enlace al comprobante
        let comprobanteBtn = "";
        if (ins.urlComprobante && ins.urlComprobante !== "#" && ins.urlComprobante.startsWith("http")) {
            comprobanteBtn = `
                <a href="${ins.urlComprobante}" target="_blank" class="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold hover:underline">
                    <i class="fa-regular fa-image"></i> Ver Foto
                </a>
            `;
        } else {
            comprobanteBtn = `<span class="text-slate-600 italic">Sin enlace (Local)</span>`;
        }

        tr.innerHTML = `
            <td class="p-4 sm:p-5 font-bold text-white max-w-[130px] truncate">${ins.nombre} ${ins.apellidos}</td>
            <td class="p-4 sm:p-5 text-[11px] font-semibold text-slate-300 max-w-[140px] truncate">${eventoNombre}</td>
            <td class="p-4 sm:p-5 text-[11px] text-slate-400 font-medium">${ins.distrito}</td>
            <td class="p-4 sm:p-5 font-mono text-slate-300 text-[11px]">${ins.telefono}</td>
            <td class="p-4 sm:p-5 text-center text-slate-400 font-medium text-[11px]">${ins.tipoPago}</td>
            <td class="p-4 sm:p-5 text-center font-bold text-amber-400 font-mono text-[12px]">$${ins.montoAbonado.toFixed(2)}</td>
            <td class="p-4 sm:p-5 text-center text-[11px]">${comprobanteBtn}</td>
            <td class="p-4 sm:p-5 text-center">
                <span class="px-2.5 py-1 rounded-full font-black text-[9px] uppercase ${estadoBadgeClass}">
                    ${ins.estadoFactura}
                </span>
            </td>
            <td class="p-4 sm:p-5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="toggleInscripcionActiva('${ins.id}', '${ins.estadoFactura}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-800 hover:border-slate-700 transition-all" title="${ins.estadoFactura === 'Inactivo' ? 'Activar' : 'Poner Inactivo'}">
                        <i class="fa-solid ${ins.estadoFactura === 'Inactivo' ? 'fa-eye text-emerald-400' : 'fa-eye-slash text-slate-500'} text-xs"></i>
                    </button>
                    <button onclick="openEditInscripcionModal('${ins.id}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-mjAzul hover:text-white text-slate-400 flex items-center justify-center border border-slate-800 hover:border-mjAzul transition-all" title="Editar">
                        <i class="fa-solid fa-pencil text-xs"></i>
                    </button>
                    <button onclick="openDeleteInscripcionModal('${ins.id}', '${ins.nombre.replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-red-950/40 hover:text-red-400 text-slate-400 flex items-center justify-center border border-slate-800 hover:border-red-900/40 transition-all" title="Eliminar permanentemente">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function filterInscripcionesAdmin() {
    const search = document.getElementById("admin-search-input").value.trim().toLowerCase();
    const filterEv = document.getElementById("admin-filter-evento").value;
    const filterEst = document.getElementById("admin-filter-estado").value;

    const filtradas = inscripcionesGlobales.filter(ins => {
        // Filtro búsqueda
        const fullname = `${ins.nombre} ${ins.apellidos}`.toLowerCase();
        const matchesSearch = fullname.includes(search) || 
                              ins.correo.toLowerCase().includes(search) || 
                              ins.telefono.includes(search) ||
                              ins.distrito.toLowerCase().includes(search);
        
        // Filtro Evento
        const matchesEvento = filterEv === "Todos" || ins.idEvento === filterEv;

        // Filtro Estado
        const matchesEstado = filterEst === "Todos" || ins.estadoFactura === filterEst;

        return matchesSearch && matchesEvento && matchesEstado;
    });

    renderTableInscripciones(filtrados);
}

// Activar o Inactivar Inscripción (afecta el conteo general y abono acumulado)
function toggleInscripcionActiva(id, estadoActual) {
    let nuevoEstado = "Pendiente";
    
    if (estadoActual === "Inactivo") {
        // Al reactivar, vuelve a Pendiente
        nuevoEstado = "Pendiente";
    } else {
        // Poner como inactivo
        nuevoEstado = "Inactivo";
    }

    showToast("Cambiando estado de inscripción...", "warning");
    const ins = inscripcionesGlobales.find(i => i.id === id);
    if (!ins) return;

    const payload = {
        accion: "guardarInscripcionAdmin",
        usuario: adminUsuario,
        password: adminPassword,
        id: id,
        nombreCompleto: ins.nombre,
        apellidos: ins.apellidos,
        correo: ins.correo,
        region: ins.region,
        distrito: ins.distrito,
        iglesia: ins.iglesia,
        telefono: ins.telefono,
        tipoPago: ins.tipoPago,
        montoAbonado: ins.montoAbonado,
        estadoFactura: nuevoEstado
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(null, inscripcionesGlobales);
                actualizarAdminUI();
                showToast(`Inscripción marcada como ${nuevoEstado}`, "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al cambiar estado de inscripción. Modificando local.", err);
            guardarInscripcionLocal(payload);
        });
    } else {
        guardarInscripcionLocal(payload);
    }
}

// Modal de Edición de Inscripción Admin
function openEditInscripcionModal(id) {
    const ins = inscripcionesGlobales.find(i => i.id === id);
    if (!ins) return;

    document.getElementById("admin-ins-id").value = ins.id;
    document.getElementById("admin-ins-nombre").value = ins.nombre;
    document.getElementById("admin-ins-apellidos").value = ins.apellidos;
    document.getElementById("admin-ins-correo").value = ins.correo;
    document.getElementById("admin-ins-region").value = ins.region;
    document.getElementById("admin-ins-distrito").value = ins.distrito;
    document.getElementById("admin-ins-iglesia").value = ins.iglesia;
    document.getElementById("admin-ins-telefono").value = ins.telefono;
    document.getElementById("admin-ins-tipo-pago").value = ins.tipoPago;
    document.getElementById("admin-ins-monto").value = ins.montoAbonado;
    document.getElementById("admin-ins-estado").value = ins.estadoFactura;
    document.getElementById("admin-ins-evento").value = ins.idEvento;

    document.getElementById("modal-edit-inscripcion").classList.remove("hidden");
}

function cerrarEditInscripcionModal() {
    document.getElementById("modal-edit-inscripcion").classList.add("hidden");
}

document.getElementById("form-edit-inscripcion").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("admin-ins-id").value;
    const nombreCompleto = document.getElementById("admin-ins-nombre").value.trim();
    const apellidos = document.getElementById("admin-ins-apellidos").value.trim();
    const correo = document.getElementById("admin-ins-correo").value.trim().toLowerCase();
    const region = document.getElementById("admin-ins-region").value;
    const distrito = document.getElementById("admin-ins-distrito").value.trim();
    const iglesia = document.getElementById("admin-ins-iglesia").value;
    const telefono = document.getElementById("admin-ins-telefono").value.trim();
    const tipoPago = document.getElementById("admin-ins-tipo-pago").value;
    const monto = Number(document.getElementById("admin-ins-monto").value);
    const estadoFactura = document.getElementById("admin-ins-estado").value;
    const idEvento = document.getElementById("admin-ins-evento").value;

    if (!nombreCompleto || !apellidos || !correo || !distrito || !telefono || monto <= 0) {
        showToast("Complete los datos requeridos.", "error");
        return;
    }

    cerrarEditInscripcionModal();
    showToast("Guardando cambios...", "warning");

    const payload = {
        accion: "guardarInscripcionAdmin",
        usuario: adminUsuario,
        password: adminPassword,
        id,
        nombreCompleto,
        apellidos,
        correo,
        region,
        distrito,
        iglesia,
        telefono,
        tipoPago,
        montoAbonado: monto,
        estadoFactura,
        idEvento
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(null, inscripcionesGlobales);
                actualizarAdminUI();
                showToast("Inscripción modificada correctamente", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al modificar inscripción. Cambiando local.", err);
            guardarInscripcionLocal(payload);
        });
    } else {
        guardarInscripcionLocal(payload);
    }
});

function guardarInscripcionLocal(payload) {
    const local = obtenerDatosLocales();
    const index = local.inscripciones.findIndex(i => i.id === payload.id);
    if (index !== -1) {
        local.inscripciones[index].nombre = payload.nombreCompleto;
        local.inscripciones[index].apellidos = payload.apellidos;
        local.inscripciones[index].correo = payload.correo;
        local.inscripciones[index].region = payload.region;
        local.inscripciones[index].distrito = payload.distrito;
        local.inscripciones[index].iglesia = payload.iglesia;
        local.inscripciones[index].telefono = payload.telefono;
        local.inscripciones[index].tipoPago = payload.tipoPago;
        local.inscripciones[index].montoAbonado = payload.montoAbonado;
        local.inscripciones[index].estadoFactura = payload.estadoFactura;
        local.inscripciones[index].idEvento = payload.idEvento;

        guardarDatosLocales(null, local.inscripciones);
        inscripcionesGlobales = local.inscripciones;
        actualizarAdminUI();
        showToast("Inscripción guardada localmente (Offline)", "warning");
    }
}

// Modal de eliminación individual de inscripción
function openDeleteInscripcionModal(id, nombre) {
    document.getElementById("delete-ins-id").value = id;
    document.getElementById("delete-ins-nombre").textContent = nombre;
    document.getElementById("modal-delete-inscripcion").classList.remove("hidden");
}

function cerrarDeleteInscripcionModal() {
    document.getElementById("modal-delete-inscripcion").classList.add("hidden");
}

function confirmarEliminarInscripcion() {
    const id = document.getElementById("delete-ins-id").value;
    cerrarDeleteInscripcionModal();
    showToast("Eliminando inscripción...", "warning");

    const payload = {
        accion: "eliminarInscripcionAdmin",
        usuario: adminUsuario,
        password: adminPassword,
        id: id
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                inscripcionesGlobales = data.inscripciones;
                guardarDatosLocales(null, inscripcionesGlobales);
                actualizarAdminUI();
                showToast("Inscripción eliminada permanentemente", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Fallo de red al eliminar inscripción. Cambiando local.", err);
            eliminarInscripcionLocal(id);
        });
    } else {
        eliminarInscripcionLocal(id);
    }
}

function eliminarInscripcionLocal(id) {
    const local = obtenerDatosLocales();
    local.inscripciones = local.inscripciones.filter(i => i.id !== id);
    guardarDatosLocales(null, local.inscripciones);
    inscripcionesGlobales = local.inscripciones;
    actualizarAdminUI();
    showToast("Inscripción eliminada localmente (Offline)", "warning");
}


// ==========================================
// INICIALIZACIÓN Y CARGA DE DOCUMENTO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    actualizarSesionUsuarioUI();
    cargarEventosYHistorial();
});
