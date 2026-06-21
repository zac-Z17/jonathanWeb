// --- CONFIGURACIÓN GENERAL ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwYf7D018s7blBVSfAbqgVQ_qDpqpzSeZUwzKkvzlu16a30N37QR5kGWAQr501Mk1Zr/exec";
const STATS_RESPALDO = { jovenes: 342, iglesias: 18, lideres: 24 };

// ==========================================
// ANIMACIÓN DE CONTADORES
// ==========================================
function animateCounter(id, targetValue) {
    const el = document.getElementById(id);
    if (!el) return;
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress); // Ease out quad
        const current = Math.floor(ease * targetValue);
        el.textContent = current;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = targetValue;
        }
    }
    requestAnimationFrame(update);
}

// Inicializador del observador para disparar animación al entrar en pantalla
function initCounterAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const jTarget = parseInt(document.getElementById("counter-jovenes").getAttribute("data-target") || "342");
                const iTarget = parseInt(document.getElementById("counter-iglesias").getAttribute("data-target") || "18");
                const lTarget = parseInt(document.getElementById("counter-lideres").getAttribute("data-target") || "24");
                
                animateCounter("counter-jovenes", jTarget);
                animateCounter("counter-iglesias", iTarget);
                animateCounter("counter-lideres", lTarget);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    const statsContainer = document.getElementById("counter-jovenes")?.parentElement?.parentElement;
    if (statsContainer) {
        observer.observe(statsContainer);
    } else {
        animateCounter("counter-jovenes", 342);
        animateCounter("counter-iglesias", 18);
        animateCounter("counter-lideres", 24);
    }
}

// ==========================================
// ACTUALIZACIÓN DE CONTADORES EN LA UI
// ==========================================
function actualizarCountersUI(stats) {
    const jCounter = document.getElementById("counter-jovenes");
    const iCounter = document.getElementById("counter-iglesias");
    const lCounter = document.getElementById("counter-lideres");

    if (jCounter) jCounter.setAttribute("data-target", stats.jovenes);
    if (iCounter) iCounter.setAttribute("data-target", stats.iglesias);
    if (lCounter) lCounter.setAttribute("data-target", stats.lideres);

    if (jCounter) jCounter.textContent = stats.jovenes;
    if (iCounter) iCounter.textContent = stats.iglesias;
    if (lCounter) lCounter.textContent = stats.lideres;
}

// Eventos estándar por defecto (Fallback Offline)
const EVENTOS_DEFAULT = [
    { id: "EV-1", nombre: "Convención Regional 1", fecha: "2026-06-19", lugar: "Coclé", precio: 50 },
    { id: "EV-2", nombre: "Convocatoria Juvenil Regional", fecha: "2026-08-22", lugar: "Veraguas", precio: 15 },
    { id: "EV-3", nombre: "Convocatoria Regional en Los Santos", fecha: "2026-09-18", lugar: "Los Santos", precio: 20 },
    { id: "EV-4", nombre: "Misión Social en Bocas del Toro", fecha: "2026-10-09", lugar: "Bocas del Toro", precio: 30 }
];

// ==========================================
// RENDERIZADO DINÁMICO DE EVENTOS EN EL CALENDARIO
// ==========================================

function formatearFechaEspanol(fechaStr) {
    if (!fechaStr) return "";
    // Si ya contiene letras (ej. rango formateado previamente), mostrar directo
    if (/[a-zA-Z]/.test(fechaStr)) return fechaStr;
    
    try {
        const partes = fechaStr.split("-");
        if (partes.length === 3) {
            const anio = partes[0];
            const mesNum = parseInt(partes[1]) - 1;
            const dia = parseInt(partes[2]);
            const meses = [
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            ];
            
            // Caso especial para eventos estándar
            if (fechaStr === "2026-06-19") return "19 al 21 de Junio, 2026";
            if (fechaStr === "2026-09-18") return "18 y 19 de Septiembre";
            if (fechaStr === "2026-10-09") return "09 y 10 de Octubre";
            
            return `${dia} de ${meses[mesNum]}, ${anio}`;
        }
    } catch (e) {
        console.error("Error al formatear fecha:", e);
    }
    return fechaStr;
}

function obtenerDescripcionEvento(nombre, lugar, precio) {
    const n = nombre.toLowerCase();
    if (n.includes("convención") || n.includes("convencion")) {
        return "Instancia clave para aprender, capacitarnos como líderes y ser renovados unificadamente.";
    }
    if (n.includes("convocatoria") && n.includes("santos")) {
        return "Talleres especializados, noches de vigilia unificada y jornadas de evangelización en las calles.";
    }
    if (n.includes("convocatoria")) {
        return "Gran día para unirnos como región, tener dinámicas, testimonios y despliegue de evangelismo físico.";
    }
    if (n.includes("misión") || n.includes("mision")) {
        return "Distribución de alimentos, actividades infantiles, oración por familias y campañas evangelísticas.";
    }
    return `Actividad oficial regional en ${lugar || 'la Región 1'}. Costo de recuperación: $${precio || 0}. ¡Inscríbete y participa con nosotros!`;
}

function obtenerCategoriaEvento(nombre, lugar) {
    const n = nombre.toLowerCase();
    if (n.includes("convención") || n.includes("convencion")) return "Magno Evento";
    if (n.includes("convocatoria") && n.includes("santos")) return "Los Santos";
    if (n.includes("misión") || n.includes("mision")) return "Misión Social";
    if (n.includes("convocatoria")) return "Convocatoria";
    return lugar || "Evento";
}

function renderEventosCalendario(eventos) {
    const container = document.getElementById("eventos-presenciales-container");
    if (!container) return;

    if (!eventos || eventos.length === 0) {
        eventos = EVENTOS_DEFAULT;
    }

    container.innerHTML = "";

    eventos.forEach((ev, index) => {
        const delay = index * 100;
        const categoria = obtenerCategoriaEvento(ev.nombre, ev.lugar);
        const descripcion = obtenerDescripcionEvento(ev.nombre, ev.lugar, ev.precio);
        const fechaFormateada = formatearFechaEspanol(ev.fecha);

        const card = document.createElement("div");
        card.className = "bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm border-l-4 border-l-mjAzul transition-all duration-300 hover:shadow-md";
        card.setAttribute("data-aos", "fade-left");
        if (delay > 0) {
            card.setAttribute("data-aos-delay", delay.toString());
        }

        card.innerHTML = `
            <div class="space-y-1">
                <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-mjAzul uppercase">${categoria}</span>
                <h3 class="font-bold text-slate-950 text-base">${ev.nombre}</h3>
                <p class="text-slate-500 text-xs">${descripcion}</p>
            </div>
            <div class="text-sm font-bold text-mjAzul bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-lg text-center md:text-right min-w-[160px]">
                ${fechaFormateada}
            </div>
        `;
        container.appendChild(card);
    });

    if (window.AOS) {
        window.AOS.refresh();
    }
}

// Carga los datos globales (total de inscritos activos) desde Sheets
function cargarDatosIniciales() {
    if (WEB_APP_URL.includes("https://script.google.com")) {
        fetch(WEB_APP_URL, {
            method: "GET",
            mode: "cors"
        })
        .then(res => res.json())
        .then(resData => {
            if (resData.stats) {
                actualizarCountersUI(resData.stats);
            } else if (resData.jovenes) {
                actualizarCountersUI({
                    jovenes: resData.jovenes,
                    iglesias: resData.iglesias || 18,
                    lideres: resData.lideres || 24
                });
            }

            // Renderizar eventos traídos de Google Sheets si existen
            if (resData.eventos && resData.eventos.length > 0) {
                renderEventosCalendario(resData.eventos);
            } else {
                renderEventosCalendario(EVENTOS_DEFAULT);
            }
            
            const statusEl = document.getElementById("connection-status");
            if (statusEl) {
                statusEl.textContent = "Conectado a Sheets";
                statusEl.className = "text-emerald-500 font-mono font-bold";
            }
        })
        .catch(err => {
            console.log("No se pudo conectar a Google Sheets. Usando datos de respaldo.", err);
            actualizarCountersUI(STATS_RESPALDO);
            renderEventosCalendario(EVENTOS_DEFAULT);
            
            const statusEl = document.getElementById("connection-status");
            if (statusEl) {
                statusEl.textContent = "Modo Respaldo";
                statusEl.className = "text-amber-500 font-mono font-bold";
            }
        });
    } else {
        actualizarCountersUI(STATS_RESPALDO);
        renderEventosCalendario(EVENTOS_DEFAULT);
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Renderizado inmediato por defecto para evitar pantalla en blanco
    renderEventosCalendario(EVENTOS_DEFAULT);

    // Inicializar animaciones de AOS
    AOS.init({
        duration: 800,
        once: true,
        offset: 50
    });

    // Cargar datos
    cargarDatosIniciales();

    // Iniciar observadores para animar los números al bajar scroll
    initCounterAnimations();
});

