// --- CONFIGURACIÓN GENERAL ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_7p41yoH9_a2J2HRC8DoD75MUmw49EuCwxGv6UTrDAIy71mVBwoq3aMhzTbQ5M6DS/exec";
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
            
            const statusEl = document.getElementById("connection-status");
            if (statusEl) {
                statusEl.textContent = "Conectado a Sheets";
                statusEl.className = "text-emerald-500 font-mono font-bold";
            }
        })
        .catch(err => {
            console.log("No se pudo conectar a Google Sheets. Usando datos de respaldo.", err);
            actualizarCountersUI(STATS_RESPALDO);
            
            const statusEl = document.getElementById("connection-status");
            if (statusEl) {
                statusEl.textContent = "Modo Respaldo";
                statusEl.className = "text-amber-500 font-mono font-bold";
            }
        });
    } else {
        actualizarCountersUI(STATS_RESPALDO);
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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
