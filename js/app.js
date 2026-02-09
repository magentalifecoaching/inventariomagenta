// =========================================
// 1. IMPORTACIONES
// =========================================
import { db, auth, provider, signInWithPopup, signOut } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";

import { getDB, savePeople, saveActivities } from './api.js';

import { renderInventory } from './inventory.js';
import { renderAreasModule } from './areas.js';
import { renderEventsModule } from './events.js';
import { renderSuppliersModule } from './suppliers.js';
import { renderStatsModule } from './stats.js';
import { renderCalendarModule } from './calendar.js';

// =========================================
// 2. ESTADO GLOBAL
// =========================================
export let dbData = null; 
const container = document.getElementById('main-layout');

let currentView = 'menu'; 
let currentViewParams = null; 

// CONFIGURACIÓN GLOBAL
window.APP_CONFIG = {
    logoUrl: "https://cdn-icons-png.flaticon.com/512/2897/2897785.png" 
};

// =========================================
// 3. SISTEMA DE SEGURIDAD (LOGIN)
// =========================================
function renderLogin() {
    container.innerHTML = `
        <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:white; text-align:center;">
            <div style="background:#f0f9ff; padding:2rem; border-radius:20px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
                <img src="${window.APP_CONFIG.logoUrl}" style="width:80px; margin-bottom:1rem;">
                <h1 style="margin-bottom:10px; font-size:2rem;">Sistema de Inventario</h1>
                <p style="color:var(--text-muted); margin-bottom:20px;">Acceso autorizado</p>
                
                <button id="btn-login" class="btn btn-primary" style="padding:15px 30px; font-size:1.1rem; width:100%;">
                    <i class="ph ph-google-logo"></i> Iniciar Sesión con Google
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('btn-login').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (error) { alert("Error: " + error.message); }
    });
}

function addLogoutButton(user) {
    if (document.getElementById('logout-container')) return;

    const div = document.createElement('div');
    div.id = 'logout-container';
    div.style = "position:fixed; bottom:20px; right:20px; z-index:9999; background:white; padding:8px 15px; border-radius:30px; box-shadow:0 4px 15px rgba(0,0,0,0.1); display:flex; gap:10px; align-items:center; border:1px solid var(--border);";
    
    div.innerHTML = `
        <img src="${user.photoURL}" style="width:28px; height:28px; border-radius:50%; border:2px solid var(--border);">
        <span style="font-size:0.85rem; font-weight:600; color:var(--text-main);">${user.displayName}</span>
        <div style="width:1px; height:15px; background:var(--border);"></div>
        <button id="btn-logout" style="border:none; background:transparent; color:var(--danger); cursor:pointer; font-weight:bold; font-size:0.85rem;">
            <i class="ph ph-sign-out"></i> Salir
        </button>
    `;
    document.body.appendChild(div);
    
    document.getElementById('btn-logout').onclick = () => {
        if(confirm("¿Cerrar sesión?")) {
            signOut(auth);
            div.remove();
        }
    };
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        init(); 
        addLogoutButton(user);
    } else {
        renderLogin(); 
    }
});

// =========================================
// 4. LÓGICA PRINCIPAL
// =========================================

async function init() {
    // getDB ahora trae { people, items, areas, events, ACTIVITIES }
    dbData = await getDB();
    renderMenu();
}

function renderMenu() {
    currentView = 'menu';
    currentViewParams = null;

    // Calcular totales
    const itemsCount = dbData.items ? dbData.items.length : 0;
    const areasCount = dbData.areas ? dbData.areas.length : 0;
    const eventsCount = dbData.events ? dbData.events.length : 0;
    const suppliersCount = dbData.suppliers ? dbData.suppliers.length : 0;

    container.innerHTML = `
    <div class="container">
        <div style="text-align:center; margin-bottom:2rem; margin-top:2rem; position:relative;">
            <button onclick="window.globalSearch()" class="global-search-btn" title="Buscar (Ctrl+K)">
                <i class="ph ph-magnifying-glass"></i>
            </button>
            <img src="${window.APP_CONFIG.logoUrl}" style="width:100px; margin-bottom:1rem;">
            <h1 style="font-size:2.5rem; color:var(--text-main); font-weight:800;">Panel de Control</h1>
            <p style="color:var(--text-muted); font-size:1.1rem;">Gestión de recursos y logística</p>
        </div>

        <div class="grid-dashboard">
            <div class="dashboard-card" onclick="app.showModule('stats')">
                <div class="icon-box" style="background:#fef3c7; color:#d97706;">
                    <i class="ph ph-chart-pie"></i>
                </div>
                <h2 style="font-size:1.4rem;">Dashboard</h2>
                <span class="badge" style="background:#fef3c7; color:#92400e;">
                    Estadísticas
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('calendar')">
                <div class="icon-box" style="background:#faf5ff; color:var(--purple);">
                    <i class="ph ph-calendar"></i>
                </div>
                <h2 style="font-size:1.4rem;">Calendario</h2>
                <span class="badge" style="background:#f3e8ff; color:#6b21a8;">
                    Vista mensual
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('suppliers')">
                <div class="icon-box" style="background:#ecfdf5; color:#10b981;">
                    <i class="ph ph-factory"></i>
                </div>
                <h2 style="font-size:1.4rem;">Proveedores</h2>
                <span class="badge" style="background:#d1fae5; color:#065f46;">
                    ${suppliersCount} proveedores
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('inventory')">
                <div class="icon-box" style="background:#eff6ff; color:var(--primary);">
                    <i class="ph ph-package"></i>
                </div>
                <h2 style="font-size:1.4rem;">Inventario</h2>
                <span class="badge" style="background:#dbeafe; color:#1e40af;">
                    ${itemsCount} items
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('areas')">
                <div class="icon-box" style="background:#f0fdf4; color:var(--success);">
                    <i class="ph ph-squares-four"></i>
                </div>
                <h2 style="font-size:1.4rem;">Áreas</h2>
                <span class="badge" style="background:#dcfce7; color:#166534;">
                    ${areasCount} áreas
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('events')">
                <div class="icon-box" style="background:#faf5ff; color:var(--purple);">
                    <i class="ph ph-calendar-check"></i>
                </div>
                <h2 style="font-size:1.4rem;">Eventos</h2>
                <span class="badge" style="background:#f3e8ff; color:#6b21a8;">
                    ${eventsCount} eventos
                </span>
            </div>
        </div>
    </div>`;
}

// =========================================
// 5. OBJETO GLOBAL "APP"
// =========================================
window.app = {
    showModule: (moduleName, params = null) => {
        currentView = moduleName;
        currentViewParams = params;

        if (moduleName === 'menu') renderMenu();
        if (moduleName === 'inventory') renderInventory(container, dbData);
        if (moduleName === 'areas') renderAreasModule(container, dbData);
        if (moduleName === 'events') renderEventsModule(container, dbData);
        if (moduleName === 'suppliers') renderSuppliersModule(container, dbData);
        if (moduleName === 'stats') renderStatsModule(container, dbData);
        if (moduleName === 'calendar') renderCalendarModule(container, dbData);
    },

    reloadCurrentView: async () => {
        dbData = await getDB();

        if (['menu', 'inventory', 'areas', 'events', 'suppliers', 'stats', 'calendar'].includes(currentView)) {
            window.app.showModule(currentView, currentViewParams);
        } else {
            renderMenu();
        }
    },
    
    closeModal: () => {
        document.getElementById('modal-container').classList.add('hidden');
        document.getElementById('modal-confirm-container').classList.add('hidden');
    },

    openModal: (title, htmlContent, onSaveCallback) => {
        const modal = document.getElementById('modal-container');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = htmlContent;
        modal.classList.remove('hidden');

        const form = document.getElementById('dynamic-form');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault(); 
                await onSaveCallback(e);
                // El cierre del modal ahora se controla manualmente en las funciones 
                // para permitir validaciones o mensajes toast.
            };
        }
    },

    confirm: (title, message, actionBtnText, actionBtnColor, onConfirmCallback) => {
        const modal = document.getElementById('modal-confirm-container');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');

        btnOk.innerText = actionBtnText || 'Confirmar';
        btnOk.style.background = actionBtnColor || 'var(--danger)';

        modal.classList.remove('hidden');

        const newBtnOk = btnOk.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnCancel.addEventListener('click', () => modal.classList.add('hidden'));
        newBtnOk.addEventListener('click', async () => {
            await onConfirmCallback();
            modal.classList.add('hidden');
        });
    },

    showToast: (message) => {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="ph ph-check-circle" style="font-size:1.2rem;"></i> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    exportToExcel: (data, fileName) => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    },

    refreshData: async () => {
        dbData = await getDB();
    },

    _getDbData: () => dbData
};

// UTILIDAD DE CREACIÓN RÁPIDA (Personas)
window.addPersonPrompt = () => {};

// =========================================
// 6. BÚSQUEDA GLOBAL
// =========================================
window.globalSearch = () => {
    const html = `
        <div class="global-search-container">
            <div class="global-search-input-wrapper">
                <i class="ph ph-magnifying-glass"></i>
                <input type="text" id="global-search-input" placeholder="Buscar ítems, eventos, áreas, personas, proveedores..." autofocus>
            </div>
            <div id="global-search-results" class="global-search-results">
                <div class="search-hint">
                    <i class="ph ph-lightbulb"></i> Escribe para buscar en todo el sistema
                </div>
            </div>
        </div>
    `;

    window.app.openModal('Búsqueda Global', html, () => {});

    const input = document.getElementById('global-search-input');
    const resultsContainer = document.getElementById('global-search-results');

    let debounceTimer;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const term = e.target.value.trim().toLowerCase();
            if (term.length < 2) {
                resultsContainer.innerHTML = '<div class="search-hint"><i class="ph ph-lightbulb"></i> Escribe al menos 2 caracteres</div>';
                return;
            }
            const results = searchAll(term, dbData);
            renderSearchResults(results, resultsContainer);
        }, 300);
    });
};

function searchAll(term, data) {
    const t = term.toLowerCase();
    return {
        items: (data.items || []).filter(i =>
            i.name?.toLowerCase().includes(t) ||
            i.brand?.toLowerCase().includes(t)
        ).slice(0, 5),
        events: (data.events || []).filter(e =>
            e.name?.toLowerCase().includes(t)
        ).slice(0, 5),
        areas: (data.areas || []).filter(a =>
            a.name?.toLowerCase().includes(t)
        ).slice(0, 5),
        activities: (data.activities || []).filter(a =>
            a.name?.toLowerCase().includes(t) ||
            a.description?.toLowerCase().includes(t)
        ).slice(0, 5),
        people: (data.people || []).filter(p =>
            p.name?.toLowerCase().includes(t)
        ).slice(0, 5),
        suppliers: (data.suppliers || []).filter(s =>
            s.name?.toLowerCase().includes(t) ||
            s.contact?.toLowerCase().includes(t)
        ).slice(0, 5)
    };
}

function renderSearchResults(results, container) {
    const total = results.items.length + results.events.length + results.areas.length +
                  (results.activities || []).length + results.people.length + results.suppliers.length;

    if (total === 0) {
        container.innerHTML = '<div class="search-no-results"><i class="ph ph-magnifying-glass-minus"></i> No se encontraron resultados</div>';
        return;
    }

    let html = '';

    if (results.items.length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-package"></i> Ítems</div>`;
        html += results.items.map(i => `
            <div class="search-result-item" onclick="app.closeModal(); app.showModule('inventory')">
                <span class="search-result-name">${i.name}</span>
                <span class="search-result-meta">${i.brand || ''}</span>
            </div>
        `).join('');
    }

    if (results.events.length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-calendar-check"></i> Eventos</div>`;
        html += results.events.map(e => `
            <div class="search-result-item" onclick="app.closeModal(); app.showModule('events')">
                <span class="search-result-name">${e.name}</span>
                <span class="search-result-meta">${e.startDate || ''}</span>
            </div>
        `).join('');
    }

    if (results.areas.length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-squares-four"></i> Áreas</div>`;
        html += results.areas.map(a => `
            <div class="search-result-item" onclick="app.closeModal(); app.showModule('areas')">
                <span class="search-result-name">${a.name}</span>
            </div>
        `).join('');
    }

    if ((results.activities || []).length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-clock"></i> Actividades</div>`;
        html += results.activities.map(a => {
            const evtName = (dbData?.events || []).find(e => e.id === a.eventId)?.name || '';
            return `
            <div class="search-result-item" onclick="app.closeModal(); window.viewEventDetail && window.viewEventDetail('${a.eventId}')">
                <span class="search-result-name">${a.name}</span>
                <span class="search-result-meta">${a.startTime || ''} ${evtName ? '| ' + evtName : ''}</span>
            </div>`;
        }).join('');
    }

    if (results.people.length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-users"></i> Personas</div>`;
        html += results.people.map(p => `
            <div class="search-result-item" onclick="app.closeModal(); app.showModule('inventory')">
                <span class="search-result-name">${p.name}</span>
            </div>
        `).join('');
    }

    if (results.suppliers.length > 0) {
        html += `<div class="search-group-title"><i class="ph ph-factory"></i> Proveedores</div>`;
        html += results.suppliers.map(s => `
            <div class="search-result-item" onclick="app.closeModal(); app.showModule('suppliers')">
                <span class="search-result-name">${s.name}</span>
                <span class="search-result-meta">${s.category || ''}</span>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

// Atajo de teclado Ctrl+K
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.globalSearch();
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        window.globalSearch();
    }
});