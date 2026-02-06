import { db, auth, provider, signInWithPopup, signOut } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth"; 
import { getDB, savePeople } from './api.js';

import { renderInventory } from './inventory.js';
import { renderAreasModule } from './areas.js';
import { renderEventsModule } from './events.js';

export let dbData = null;
const container = document.getElementById('main-layout');
let currentView = 'menu'; 
let currentViewParams = null; 

// CONFIGURACIÓN GLOBAL
window.APP_CONFIG = {
    // CAMBIA ESTO POR LA URL DE TU LOGO
    logoUrl: "https://lirp.cdn-website.com/94755939/dms3rep/multi/opt/LLama_Magenta_3-1920w.png" 
};

// --- LOGIN ---
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
        <img src="${user.photoURL}" style="width:28px; height:28px; border-radius:50%;">
        <span style="font-size:0.85rem; font-weight:600;">${user.displayName}</span>
        <button id="btn-logout" style="border:none; background:transparent; color:var(--danger); cursor:pointer;"><i class="ph ph-sign-out"></i></button>
    `;
    document.body.appendChild(div);
    document.getElementById('btn-logout').onclick = () => { if(confirm("¿Salir?")) { signOut(auth); div.remove(); } };
}

onAuthStateChanged(auth, (user) => {
    if (user) { init(); addLogoutButton(user); } 
    else { renderLogin(); }
});

// --- LÓGICA APP ---
async function init() {
    dbData = await getDB();
    renderMenu();
}

function renderMenu() {
    currentView = 'menu';
    currentViewParams = null;
    container.innerHTML = `
    <div class="container">
        <div style="text-align:center; margin-bottom:3rem; margin-top:2rem;">
            <img src="${window.APP_CONFIG.logoUrl}" style="width:100px; margin-bottom:1rem;">
            <h1 style="font-size:2.5rem; font-weight:800;">Panel de Control</h1>
        </div>
        <div class="grid-dashboard">
            <div class="dashboard-card" onclick="app.showModule('inventory')">
                <div class="icon-box" style="background:#eff6ff; color:var(--primary);"><i class="ph ph-package"></i></div>
                <h2>Inventario</h2>
                <span class="badge" style="background:#dbeafe; color:#1e40af;">${dbData.items.length} items</span>
            </div>
            <div class="dashboard-card" onclick="app.showModule('areas')">
                <div class="icon-box" style="background:#f0fdf4; color:var(--success);"><i class="ph ph-squares-four"></i></div>
                <h2>Áreas</h2>
                <span class="badge" style="background:#dcfce7; color:#166534;">${dbData.areas.length} áreas</span>
            </div>
            <div class="dashboard-card" onclick="app.showModule('events')">
                <div class="icon-box" style="background:#faf5ff; color:var(--purple);"><i class="ph ph-calendar-check"></i></div>
                <h2>Eventos</h2>
                <span class="badge" style="background:#f3e8ff; color:#6b21a8;">${dbData.events.length} eventos</span>
            </div>
        </div>
    </div>`;
}

window.app = {
    showModule: (moduleName, params = null) => {
        currentView = moduleName;
        currentViewParams = params;
        if (moduleName === 'menu') renderMenu();
        if (moduleName === 'inventory') renderInventory(container, dbData);
        if (moduleName === 'areas') renderAreasModule(container, dbData);
        if (moduleName === 'events') renderEventsModule(container, dbData);
    },
    reloadCurrentView: async () => {
        dbData = await getDB();
        if (['menu', 'inventory', 'areas', 'events'].includes(currentView)) {
            window.app.showModule(currentView, currentViewParams);
        } else { renderMenu(); }
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
                // NOTA: El modal no se cierra aquí automáticamente para permitir flujos complejos,
                // quien llame a openModal debe decidir cuándo cerrar.
                // En este caso, lo cerramos por defecto salvo que la lógica interna diga lo contrario.
                modal.classList.add('hidden');
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
    // --- NUEVO: SISTEMA TOAST ---
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
        // Desaparecer a los 3 segundos
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
    refreshData: async () => { dbData = await getDB(); }
};