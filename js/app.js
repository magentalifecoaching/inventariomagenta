// =========================================
// 1. IMPORTACIONES
// =========================================
// Herramientas de Seguridad y Firebase
import { db, auth, provider, signInWithPopup, signOut } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth"; 

// Herramientas de Datos (API)
import { getDB, savePeople } from './api.js';

// Módulos de la App
import { renderInventory } from './inventory.js';
import { renderAreasModule } from './areas.js';
import { renderEventsModule } from './events.js';

// =========================================
// 2. ESTADO GLOBAL
// =========================================
export let dbData = null; // Aquí vivirán tus datos descargados
const container = document.getElementById('main-layout');

// Variables de Navegación (Para no perderse al recargar)
let currentView = 'menu'; 
let currentViewParams = null; 

// =========================================
// 3. SISTEMA DE SEGURIDAD (LOGIN)
// =========================================

// A. Pantalla de Login (Se muestra si no hay usuario)
function renderLogin() {
    container.innerHTML = `
        <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:white; text-align:center;">
            <div style="background:#f0f9ff; padding:2rem; border-radius:20px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
                <i class="ph ph-lock-key" style="font-size:3rem; color:var(--primary); margin-bottom:1rem;"></i>
                <h1 style="margin-bottom:10px; font-size:2rem;">Sistema de Inventario</h1>
                <p style="color:var(--text-muted); margin-bottom:20px;">Acceso restringido a personal autorizado</p>
                
                <button id="btn-login" class="btn btn-primary" style="padding:15px 30px; font-size:1.1rem; width:100%;">
                    <i class="ph ph-google-logo"></i> Iniciar Sesión con Google
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('btn-login').addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            alert("Error de autenticación: " + error.message);
        }
    });
}

// B. Botón Flotante para Salir (Se muestra cuando estás dentro)
function addLogoutButton(user) {
    // Si ya existe, no lo creamos de nuevo
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

// C. El "Portero" (Observador de Auth)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ✅ USUARIO AUTENTICADO
        console.log("Conectado como:", user.email);
        init(); // Arrancar la app
        addLogoutButton(user);
    } else {
        // ⛔ NO AUTENTICADO
        renderLogin(); // Mostrar candado
    }
});

// =========================================
// 4. LÓGICA PRINCIPAL DE LA APP
// =========================================

async function init() {
    // 1. Cargar datos de Firebase
    dbData = await getDB();
    
    // 2. Renderizar menú inicial
    renderMenu();
}

function renderMenu() {
    currentView = 'menu';
    currentViewParams = null;

    container.innerHTML = `
    <div class="container">
        <div style="text-align:center; margin-bottom:3rem; margin-top:2rem;">
            <h1 style="font-size:2.5rem; color:var(--text-main); font-weight:800;">Panel de Control</h1>
            <p style="color:var(--text-muted); font-size:1.1rem;">Gestión de recursos y logística</p>
        </div>
        
        <div class="grid-dashboard">
            <div class="dashboard-card" onclick="app.showModule('inventory')">
                <div class="icon-box" style="background:#eff6ff; color:var(--primary);">
                    <i class="ph ph-package"></i>
                </div>
                <h2 style="font-size:1.4rem;">Inventario General</h2>
                <p style="color:var(--text-muted); margin-top:0.5rem;">Gestión completa de items</p>
                <span class="badge" style="background:#dbeafe; color:#1e40af;">
                    ${dbData.items.length} items
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('areas')">
                <div class="icon-box" style="background:#f0fdf4; color:var(--success);">
                    <i class="ph ph-squares-four"></i>
                </div>
                <h2 style="font-size:1.4rem;">Áreas</h2>
                <p style="color:var(--text-muted); margin-top:0.5rem;">Departamentos fijos</p>
                <span class="badge" style="background:#dcfce7; color:#166534;">
                    ${dbData.areas.length} áreas
                </span>
            </div>

            <div class="dashboard-card" onclick="app.showModule('events')">
                <div class="icon-box" style="background:#faf5ff; color:var(--purple);">
                    <i class="ph ph-calendar-check"></i>
                </div>
                <h2 style="font-size:1.4rem;">Eventos</h2>
                <p style="color:var(--text-muted); margin-top:0.5rem;">Logística temporal</p>
                <span class="badge" style="background:#f3e8ff; color:#6b21a8;">
                    ${dbData.events.length} eventos
                </span>
            </div>
        </div>
    </div>`;
}

// =========================================
// 5. OBJETO GLOBAL "APP" (UTILIDADES)
// =========================================
window.app = {
    // --- NAVEGACIÓN ---
    showModule: (moduleName, params = null) => {
        currentView = moduleName;
        currentViewParams = params;
        
        if (moduleName === 'menu') renderMenu();
        if (moduleName === 'inventory') renderInventory(container, dbData);
        if (moduleName === 'areas') renderAreasModule(container, dbData);
        if (moduleName === 'events') renderEventsModule(container, dbData);
    },

    // Recargar vista actual (sin ir al inicio)
    reloadCurrentView: async () => {
        dbData = await getDB(); // Refrescar datos desde la nube
        
        if (['menu', 'inventory', 'areas', 'events'].includes(currentView)) {
            // Si estamos en un módulo principal, recargamos el módulo
            window.app.showModule(currentView, currentViewParams);
        } else {
            // Si estábamos en un sub-detalle (casos especiales), volvemos al menú por seguridad
            renderMenu(); 
        }
    },
    
    // --- MODALES Y VENTANAS ---
    closeModal: () => {
        document.getElementById('modal-container').classList.add('hidden');
        document.getElementById('modal-confirm-container').classList.add('hidden');
    },

    // Modal de Formularios (Grande)
    openModal: (title, htmlContent, onSaveCallback) => {
        const modal = document.getElementById('modal-container');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = htmlContent;
        modal.classList.remove('hidden');

        const form = document.getElementById('dynamic-form');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault(); // Prevenir recarga
                await onSaveCallback(e);
                modal.classList.add('hidden');
            };
        }
    },

    // Modal de Confirmación (Alerta bonita)
    confirm: (title, message, actionBtnText, actionBtnColor, onConfirmCallback) => {
        const modal = document.getElementById('modal-confirm-container');
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');

        // Configurar textos
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        btnOk.innerText = actionBtnText || 'Confirmar';
        btnOk.style.background = actionBtnColor || 'var(--danger)';

        // Mostrar
        modal.classList.remove('hidden');

        // Clonar botones para limpiar eventos anteriores
        const newBtnOk = btnOk.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        // Asignar nuevos eventos
        newBtnCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        newBtnOk.addEventListener('click', async () => {
            await onConfirmCallback();
            modal.classList.add('hidden');
        });
    },

    // --- UTILIDADES ---
    exportToExcel: (data, fileName) => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    },

    refreshData: async () => {
        dbData = await getDB();
    }
};

// --- FUNCIÓN RÁPIDA: AÑADIR ENCARGADO ---
window.addPersonPrompt = () => {
    const html = `
        <form id="dynamic-form">
            <div class="form-group">
                <label>Nombre del Nuevo Encargado</label>
                <input type="text" id="new-person-name" required placeholder="Ej: Maria Gonzalez">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">Guardar</button>
        </form>
    `;
    window.app.openModal('Añadir Encargado', html, async () => {
        const name = document.getElementById('new-person-name').value;
        if(name) {
            dbData.people.push({ id: Date.now().toString(), name });
            await savePeople(dbData.people);
            alert("Encargado añadido correctamente.");
        }
    });
};