// --- CONFIGURACIÓN GENERAL ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwYf7D018s7blBVSfAbqgVQ_qDpqpzSeZUwzKkvzlu16a30N37QR5kGWAQr501Mk1Zr/exec";

// Credenciales de respaldo local para simulación fuera de línea
const CREDENCIALES_LOCALES = {
    "admin.general": "IDP*Reg1*2026",
    "lider.cocle": "Cocle#MJSector1",
    "lider.veraguas": "Ver@guas#MJ26",
    "lider.herrera": "Herrer@#IDP2026",
    "lider.lossantos": "San+os#MJ1921",
    "lider.bocas": "Boc@s*DelToro1"
};

// Claves del almacenamiento local
const REGISTROS_CLAVE = "mj_registros_local_v1";
const STATS_CLAVE = "mj_stats_local_v1";

// Variables de estado
let usuarioAutorizado = sessionStorage.getItem("usuarioAutorizado") || "";
let passwordAutorizado = sessionStorage.getItem("passwordAutorizado") || "";
let dbOffline = false;
let registrosGlobales = []; // Guarda la copia en memoria de todos los registros

// Instancias de gráficos
let chartIglesias = null;
let chartAreas = null;

// Registros de prueba por defecto
const MOCK_REGISTROS_INICIALES = [
    { id: "REG-MOCK-1", fecha: new Date(Date.now() - 1000 * 60 * 60).toISOString(), nombre: "Carlos Torres", iglesia: "IDP Chiriquí", telefono: "6622-1133", area: "Multimedia", registrador: "admin.general", estado: "Activo" },
    { id: "REG-MOCK-2", fecha: new Date(Date.now() - 1000 * 60 * 180).toISOString(), nombre: "Maybelis Castillo", iglesia: "IDP Coclé", telefono: "6544-9988", area: "Espiritual", registrador: "lider.cocle", estado: "Activo" },
    { id: "REG-MOCK-3", fecha: new Date(Date.now() - 1000 * 60 * 300).toISOString(), nombre: "David Rodríguez", iglesia: "IDP Veraguas", telefono: "6711-2244", area: "Evangelismo", registrador: "admin.general", estado: "Activo" },
    { id: "REG-MOCK-4", fecha: new Date(Date.now() - 1000 * 60 * 450).toISOString(), nombre: "José Pinto", iglesia: "IDP Bocas del Toro", telefono: "6900-5511", area: "Logística", registrador: "lider.bocas", estado: "Inactivo" }
];

// ==========================================
// SISTEMA DE NOTIFICACIONES (TOAST)
// ==========================================
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
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
// CARGA DE DATOS LOCALES Y SIMULADOS
// ==========================================
function obtenerDatosLocales() {
    let registros = localStorage.getItem(REGISTROS_CLAVE);
    let stats = localStorage.getItem(STATS_CLAVE);

    if (!registros) {
        localStorage.setItem(REGISTROS_CLAVE, JSON.stringify(MOCK_REGISTROS_INICIALES));
        registros = JSON.stringify(MOCK_REGISTROS_INICIALES);
    }
    if (!stats) {
        const statsIniciales = { jovenes: 3, iglesias: 3, lideres: 3 };
        localStorage.setItem(STATS_CLAVE, JSON.stringify(statsIniciales));
        stats = JSON.stringify(statsIniciales);
    }

    return {
        registros: JSON.parse(registros),
        stats: JSON.parse(stats)
    };
}

function guardarDatosLocales(registros) {
    localStorage.setItem(REGISTROS_CLAVE, JSON.stringify(registros));
    
    // Recalcular estadísticas basadas en los jóvenes ACTIVOS
    const activos = registros.filter(r => r.estado === "Activo");
    const iglesias = new Set(activos.map(r => r.iglesia));
    const lideres = new Set(activos.map(r => r.registrador));

    const stats = {
        jovenes: activos.length,
        iglesias: iglesias.size,
        lideres: lideres.size
    };
    localStorage.setItem(STATS_CLAVE, JSON.stringify(stats));
    return stats;
}

// ==========================================
// CÁLCULO DE GRÁFICOS E INTERFAZ
// ==========================================
function actualizarEstadisticasYGraficos(stats, registros) {
    registrosGlobales = registros;

    // Actualizar contadores
    document.getElementById("dash-counter-jovenes").textContent = stats.jovenes;
    document.getElementById("dash-counter-iglesias").textContent = stats.iglesias;
    document.getElementById("dash-counter-lideres").textContent = stats.lideres;

    // Procesar datos para los gráficos (SOLO ACTIVOS)
    const registrosActivos = registros.filter(r => r.estado === "Activo");

    // 1. Datos por Iglesia
    const iglesiasList = [
        "IDP Bocas del Toro", "IDP Coclé", "IDP Chiriquí", 
        "IDP Herrera", "IDP Los Santos", "IDP Veraguas"
    ];
    const iglesiaCounts = {};
    iglesiasList.forEach(name => iglesiaCounts[name] = 0);
    registrosActivos.forEach(r => {
        if (iglesiasList.includes(r.iglesia)) {
            iglesiaCounts[r.iglesia]++;
        }
    });

    // 2. Datos por Área de Servicio
    const areasList = ["Evangelismo", "Multimedia", "Logística", "Espiritual", "Ninguno"];
    const areaCounts = {};
    areasList.forEach(name => areaCounts[name] = 0);
    registrosActivos.forEach(r => {
        if (areasList.includes(r.area)) {
            areaCounts[r.area]++;
        }
    });

    // Renderizar o actualizar gráfico de iglesias
    if (chartIglesias) {
        chartIglesias.data.datasets[0].data = iglesiasList.map(name => iglesiaCounts[name]);
        chartIglesias.update();
    } else {
        const ctx1 = document.getElementById("chart-iglesias").getContext("2d");
        chartIglesias = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: iglesiasList.map(name => name.replace("IDP ", "")),
                datasets: [{
                    label: 'Jóvenes Activos',
                    data: iglesiasList.map(name => iglesiaCounts[name]),
                    backgroundColor: 'rgba(59, 130, 246, 0.65)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        ticks: { color: '#94a3b8', stepSize: 1 },
                        grid: { color: 'rgba(51, 65, 85, 0.2)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Renderizar o actualizar gráfico de áreas de servicio
    if (chartAreas) {
        chartAreas.data.datasets[0].data = areasList.map(name => areaCounts[name]);
        chartAreas.update();
    } else {
        const ctx2 = document.getElementById("chart-areas").getContext("2d");
        chartAreas = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: areasList,
                datasets: [{
                    data: areasList.map(name => areaCounts[name]),
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.75)', // Evangelismo - Emerald
                        'rgba(139, 92, 246, 0.75)', // Multimedia - Purple
                        'rgba(245, 158, 11, 0.75)', // Logística - Orange
                        'rgba(59, 130, 246, 0.75)',  // Espiritual - Blue
                        'rgba(100, 116, 139, 0.75)'  // Ninguno - Slate
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
                        labels: { color: '#e2e8f0', boxWidth: 12, font: { size: 10 } }
                    }
                }
            }
        });
    }

    // Actualizar tabla
    renderTable(registros);
}

// ==========================================
// GESTIÓN DE LA TABLA (CRUD & FILTROS)
// ==========================================
function renderTable(registros) {
    const tableBody = document.getElementById("table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (!registros || registros.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">No hay jóvenes registrados todavía.</td></tr>`;
        return;
    }

    registros.forEach(reg => {
        const tr = document.createElement("tr");
        tr.className = `border-b border-slate-900 bg-slate-950/20 hover:bg-slate-900/40 transition-all ${reg.estado === "Inactivo" ? "opacity-55" : ""}`;
        
        // Badge de iglesia
        let badgeBg = "bg-slate-800 text-slate-400 border border-slate-700/60";
        if (reg.iglesia.includes("Coclé")) badgeBg = "bg-blue-950/60 text-blue-400 border border-blue-900/40";
        else if (reg.iglesia.includes("Chiriquí")) badgeBg = "bg-purple-950/60 text-purple-400 border border-purple-900/40";
        else if (reg.iglesia.includes("Veraguas")) badgeBg = "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40";
        else if (reg.iglesia.includes("Herrera")) badgeBg = "bg-orange-950/60 text-orange-400 border border-orange-900/40";
        else if (reg.iglesia.includes("Los Santos")) badgeBg = "bg-red-950/60 text-red-400 border border-red-900/40";
        else if (reg.iglesia.includes("Bocas")) badgeBg = "bg-amber-950/60 text-amber-400 border border-amber-900/40";

        // Estado badge e interruptor
        const statusActive = reg.estado !== "Inactivo";
        const statusText = statusActive ? "Activo" : "Inactivo";
        const statusBadgeClass = statusActive 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
            : "bg-slate-800 text-slate-500 border border-slate-700/50";
        
        const statusIconClass = statusActive ? "fa-toggle-on text-emerald-400" : "fa-toggle-off text-slate-600";

        tr.innerHTML = `
            <td class="p-4 sm:p-5 font-bold text-white max-w-[150px] truncate">${reg.nombre}</td>
            <td class="p-4 sm:p-5"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] ${badgeBg}">${reg.iglesia}</span></td>
            <td class="p-4 sm:p-5 font-mono text-slate-300">${reg.telefono}</td>
            <td class="p-4 sm:p-5 text-slate-300 font-medium">${reg.area}</td>
            <td class="p-4 sm:p-5 text-slate-400 font-medium">${reg.registrador}</td>
            <td class="p-4 sm:p-5 text-center">
                <button onclick="toggleEstado('${reg.id}', '${reg.estado}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[9px] ${statusBadgeClass} hover:brightness-110 transition-all select-none">
                    <i class="fa-solid ${statusIconClass} text-xs"></i> ${statusText}
                </button>
            </td>
            <td class="p-4 sm:p-5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openEditModal('${reg.id}', '${reg.nombre.replace(/'/g, "\\'")}', '${reg.iglesia}', '${reg.telefono}', '${reg.area}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-mjAzul hover:text-white text-slate-400 flex items-center justify-center border border-slate-800 hover:border-mjAzul transition-all" title="Editar">
                        <i class="fa-solid fa-pencil text-xs"></i>
                    </button>
                    <button onclick="openDeleteModal('${reg.id}', '${reg.nombre.replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-red-950/40 hover:text-red-400 text-slate-400 flex items-center justify-center border border-slate-800 hover:border-red-900/40 transition-all" title="Eliminar">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function filterRegistros() {
    const search = document.getElementById("search-input").value.trim().toLowerCase();
    const filterIgl = document.getElementById("filter-iglesia").value;
    const filterEst = document.getElementById("filter-estado").value;

    const filtrados = registrosGlobales.filter(reg => {
        // Filtro búsqueda
        const matchesSearch = reg.nombre.toLowerCase().includes(search) || 
                              reg.telefono.includes(search) || 
                              reg.registrador.toLowerCase().includes(search);
        
        // Filtro Iglesia
        const matchesIglesia = filterIgl === "Todas" || reg.iglesia === filterIgl;

        // Filtro Estado
        const matchesEstado = filterEst === "Todos" || reg.estado === filterEst;

        return matchesSearch && matchesIglesia && matchesEstado;
    });

    renderTable(filtrados);
}

// ==========================================
// ACCIONES CRUD (INTERFAZ CON SERVIDOR)
// ==========================================

// --- 1. TOGGLE ACTIVIDAD ---
function toggleEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === "Inactivo" ? "Activo" : "Inactivo";
    showToast("Actualizando estado...", "warning");

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "cambiarEstado",
                usuario: usuarioAutorizado,
                password: passwordAutorizado,
                id: id,
                estado: nuevoEstado
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                actualizarEstadisticasYGraficos(data.stats, data.registros);
                showToast(`Registro marcado como ${nuevoEstado.toLowerCase()}`, "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Error de red. Guardando localmente.", err);
            toggleEstadoLocal(id, nuevoEstado);
        });
    } else {
        toggleEstadoLocal(id, nuevoEstado);
    }
}

function toggleEstadoLocal(id, nuevoEstado) {
    const datos = obtenerDatosLocales();
    const index = datos.registros.findIndex(r => r.id === id);
    if (index !== -1) {
        datos.registros[index].estado = nuevoEstado;
        const stats = guardarDatosLocales(datos.registros);
        actualizarEstadisticasYGraficos(stats, datos.registros);
        showToast(`Estado cambiado localmente (Offline)`, "warning");
    }
}

// --- 2. ELIMINACIÓN ---
function openDeleteModal(id, nombre) {
    document.getElementById("delete-id").value = id;
    document.getElementById("delete-name").textContent = nombre;
    document.getElementById("modal-delete").classList.remove("hidden");
}

function closeDeleteModal() {
    document.getElementById("modal-delete").classList.add("hidden");
}

function confirmarEliminar() {
    const id = document.getElementById("delete-id").value;
    closeDeleteModal();
    showToast("Eliminando registro...", "warning");

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "eliminar",
                usuario: usuarioAutorizado,
                password: passwordAutorizado,
                id: id
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                actualizarEstadisticasYGraficos(data.stats, data.registros);
                showToast("Miembro eliminado permanentemente de la base global", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Error de red. Eliminando localmente.", err);
            eliminarLocal(id);
        });
    } else {
        eliminarLocal(id);
    }
}

function eliminarLocal(id) {
    const datos = obtenerDatosLocales();
    const filtrados = datos.registros.filter(r => r.id !== id);
    const stats = guardarDatosLocales(filtrados);
    actualizarEstadisticasYGraficos(stats, filtrados);
    showToast("Registro eliminado localmente (Offline)", "warning");
}

// --- 3. EDICIÓN ---
function openEditModal(id, nombre, iglesia, telefono, area) {
    document.getElementById("edit-id").value = id;
    document.getElementById("edit-nombre").value = nombre;
    document.getElementById("edit-iglesia").value = iglesia;
    document.getElementById("edit-telefono").value = telefono;
    document.getElementById("edit-area").value = area;
    document.getElementById("modal-edit").classList.remove("hidden");
}

function closeEditModal() {
    document.getElementById("modal-edit").classList.add("hidden");
}

document.getElementById("form-edit").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const iglesia = document.getElementById("edit-iglesia").value;
    const telefono = document.getElementById("edit-telefono").value.trim();
    const area = document.getElementById("edit-area").value;
    
    closeEditModal();
    showToast("Guardando cambios...", "warning");

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "editar",
                usuario: usuarioAutorizado,
                password: passwordAutorizado,
                id: id,
                nombre: nombre,
                iglesia: iglesia,
                telefono: telefono,
                area: area
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                actualizarEstadisticasYGraficos(data.stats, data.registros);
                showToast("Cambios guardados exitosamente", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Error de red. Editando localmente.", err);
            editarLocal(id, nombre, iglesia, telefono, area);
        });
    } else {
        editarLocal(id, nombre, iglesia, telefono, area);
    }
});

function editarLocal(id, nombre, iglesia, telefono, area) {
    const datos = obtenerDatosLocales();
    const index = datos.registros.findIndex(r => r.id === id);
    if (index !== -1) {
        datos.registros[index].nombre = nombre;
        datos.registros[index].iglesia = iglesia;
        datos.registros[index].telefono = telefono;
        datos.registros[index].area = area;

        const stats = guardarDatosLocales(datos.registros);
        actualizarEstadisticasYGraficos(stats, datos.registros);
        showToast("Cambios guardados localmente (Offline)", "warning");
    }
}

// --- 4. REGISTRO ---
document.getElementById("form-registro").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-registro-submit");
    const nombre = document.getElementById("reg-nombre").value.trim();
    const iglesia = document.getElementById("reg-iglesia").value;
    const telefono = document.getElementById("reg-telefono").value.trim();
    const area = document.getElementById("reg-area").value;

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> Guardando en base global...`;
    showToast("Enviando registro...", "warning");

    const nuevoRegistro = {
        id: "REG-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        fecha: new Date().toISOString(),
        nombre: nombre,
        iglesia: iglesia,
        telefono: telefono,
        area: area,
        registrador: usuarioAutorizado,
        estado: "Activo"
    };

    if (WEB_APP_URL.includes("https://script.google.com") && !dbOffline) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "registrar",
                usuario: usuarioAutorizado,
                password: passwordAutorizado,
                nombre: nombre,
                iglesia: iglesia,
                telefono: telefono,
                area: area
            })
        })
        .then(res => res.json())
        .then(data => {
            btn.disabled = false;
            btn.textContent = "Registrar e Inyectar a Base Global";

            if (data.status === "success") {
                document.getElementById("form-registro").reset();
                actualizarEstadisticasYGraficos(data.stats, data.registros);
                showToast("¡Registro agregado a Google Sheets!", "success");
            } else {
                showToast(`Error: ${data.message}`, "error");
            }
        })
        .catch(err => {
            console.log("Error de red al registrar. Guardando en local.", err);
            registrarLocal(nuevoRegistro, btn);
        });
    } else {
        registrarLocal(nuevoRegistro, btn);
    }
});

function registrarLocal(nuevoRegistro, btn) {
    btn.disabled = false;
    btn.textContent = "Registrar e Inyectar a Base Global";

    const datos = obtenerDatosLocales();
    datos.registros.push(nuevoRegistro);
    const stats = guardarDatosLocales(datos.registros);
    
    document.getElementById("form-registro").reset();
    actualizarEstadisticasYGraficos(stats, datos.registros);
    showToast("Registro guardado localmente (Offline)", "warning");
}

// ==========================================
// CONTROL DE SESIÓN (LOGIN & LOGOUT)
// ==========================================
document.getElementById("form-login").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-login-submit");
    const errEl = document.getElementById("login-error");
    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> Verificando...`;
    errEl.classList.add("hidden");

    if (WEB_APP_URL.includes("https://script.google.com")) {
        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                accion: "login",
                usuario: user,
                password: pass
            })
        })
        .then(res => res.json())
        .then(data => {
            btn.disabled = false;
            btn.textContent = "Verificar Credenciales";

            if (data.status === "success") {
                conectarExitosamente(user, pass, data.stats, data.registros);
                showToast(`Sesión en línea iniciada: líder de ${user.split('.')[1] || 'la región'}`, "success");
            } else {
                errEl.textContent = `❌ ${data.message || "Usuario o Contraseña inválidos."}`;
                errEl.classList.remove("hidden");
            }
        })
        .catch(err => {
            console.log("Fallo de red al autenticar. Intentando validación local.", err);
            validarSesionLocalmente(user, pass, btn, errEl);
        });
    } else {
        validarSesionLocalmente(user, pass, btn, errEl);
    }
});

function validarSesionLocalmente(user, pass, btn, errEl) {
    btn.disabled = false;
    btn.textContent = "Verificar Credenciales";

    if (CREDENCIALES_LOCALES[user] && CREDENCIALES_LOCALES[user] === pass) {
        const datosLocales = obtenerDatosLocales();
        conectarExitosamente(user, pass, datosLocales.stats, datosLocales.registros);
        conmutarAModoLocal();
        showToast("Acceso local verificado (Modo Offline)", "warning");
    } else {
        errEl.textContent = "❌ Usuario o Contraseña inválidos (Local).";
        errEl.classList.remove("hidden");
    }
}

function conectarExitosamente(user, pass, stats, registros) {
    usuarioAutorizado = user;
    passwordAutorizado = pass;
    sessionStorage.setItem("usuarioAutorizado", user);
    sessionStorage.setItem("passwordAutorizado", pass);

    document.getElementById("nav-user").textContent = user.replace(".", " ");
    
    // Transición de paneles
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("dashboard-container").classList.remove("hidden");

    // Configurar modo en línea por defecto
    dbOffline = false;
    document.getElementById("connection-indicator").className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
    document.getElementById("connection-text").textContent = "En Línea";
    document.getElementById("connection-text").className = "text-[10px] font-mono uppercase tracking-wider text-emerald-400";

    actualizarEstadisticasYGraficos(stats, registros);
}

function conmutarAModoLocal() {
    dbOffline = true;
    document.getElementById("connection-indicator").className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
    document.getElementById("connection-text").textContent = "Desconectado";
    document.getElementById("connection-text").className = "text-[10px] font-mono uppercase tracking-wider text-amber-500";
}

function logout() {
    usuarioAutorizado = "";
    passwordAutorizado = "";
    sessionStorage.removeItem("usuarioAutorizado");
    sessionStorage.removeItem("passwordAutorizado");
    
    document.getElementById("form-login").reset();
    document.getElementById("form-registro").reset();

    document.getElementById("dashboard-container").classList.add("hidden");
    document.getElementById("login-container").classList.remove("hidden");
    
    showToast("Sesión cerrada correctamente", "info");
}

// ==========================================
// PANEL: CONTROL DE PESTAÑAS (TABS)
// ==========================================
function switchTab(tabId) {
    // Ocultar todos los contenidos
    document.getElementById("tab-content-resumen").classList.add("hidden");
    document.getElementById("tab-content-registro").classList.add("hidden");
    document.getElementById("tab-content-gestion").classList.add("hidden");

    // Quitar estilos activos de todos los botones
    const btnResumen = document.getElementById("tab-btn-resumen");
    const btnRegistro = document.getElementById("tab-btn-registro");
    const btnGestion = document.getElementById("tab-btn-gestion");

    [btnResumen, btnRegistro, btnGestion].forEach(btn => {
        btn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all";
    });

    // Mostrar el activo y aplicar estilos activos
    document.getElementById(`tab-content-${tabId}`).classList.remove("hidden");
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    activeBtn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all bg-mjAzul text-white shadow-lg shadow-mjAzul/15";

    // Modificar títulos de cabecera
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    
    if (tabId === "resumen") {
        pageTitle.textContent = "Resumen General";
        pageSubtitle.textContent = "Estadísticas y análisis de los registros regionales de jóvenes";
        if (chartIglesias) chartIglesias.resize();
        if (chartAreas) chartAreas.resize();
    } else if (tabId === "registro") {
        pageTitle.textContent = "Registrar Miembro";
        pageSubtitle.textContent = "Agrega nuevos jóvenes líderes o miembros a la base regional";
    } else if (tabId === "gestion") {
        pageTitle.textContent = "Gestionar Inscripciones";
        pageSubtitle.textContent = "Administra, filtra, edita o elimina los registros de la base regional";
    }
}

// Menú móvil
document.getElementById("btn-mobile-menu").addEventListener("click", () => {
    const nav = document.getElementById("sidebar-nav");
    nav.classList.toggle("hidden");
});

// ==========================================
// AUTO-INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Si ya hay credenciales en sesión, entrar automáticamente
    if (usuarioAutorizado && passwordAutorizado) {
        document.getElementById("nav-user").textContent = usuarioAutorizado.replace(".", " ");
        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("dashboard-container").classList.remove("hidden");
        
        // Intentar recuperar del servidor
        if (WEB_APP_URL.includes("https://script.google.com")) {
            fetch(WEB_APP_URL, { method: "GET", mode: "cors" })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" || data.stats) {
                    actualizarEstadisticasYGraficos(data.stats, data.registros);
                } else {
                    throw new Error("Formato inválido");
                }
            })
            .catch(err => {
                console.log("Fallo al recuperar del servidor al iniciar. Usando local.", err);
                const datosLocales = obtenerDatosLocales();
                actualizarEstadisticasYGraficos(datosLocales.stats, datosLocales.registros);
                conmutarAModoLocal();
            });
        } else {
            const datosLocales = obtenerDatosLocales();
            actualizarEstadisticasYGraficos(datosLocales.stats, datosLocales.registros);
            conmutarAModoLocal();
        }
    }
});
