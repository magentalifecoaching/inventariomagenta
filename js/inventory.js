import { saveItems, savePeople, saveAreas, saveEvents } from './api.js';

export function renderInventory(container, data, filterFn = null) {
    let items = data.items;
    if (filterFn) items = items.filter(filterFn);

    const areaOptions = data.areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    const html = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú Principal
                </button>
                <div>
                    <h1>Inventario General</h1>
                    <p id="items-count-badge">${items.length} items registrados</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.downloadInventoryExcel()" class="btn btn-success">
                    <i class="ph ph-microsoft-excel-logo"></i> Excel
                </button>
                <button onclick="window.modalAddItem()" class="btn btn-primary">
                    <i class="ph ph-plus-circle"></i> Nuevo Ítem
                </button>
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-group">
                <i class="ph ph-magnifying-glass"></i>
                <input type="text" id="filter-search" placeholder="Buscar por nombre, marca o encargado...">
            </div>
            
            <select id="filter-status" class="filter-select">
                <option value="">Todos los Estados</option>
                <option value="disponible">🟢 Disponible</option>
                <option value="en uso">🟡 En Uso</option>
                <option value="mantenimiento">🔴 Mantenimiento</option>
            </select>

            <select id="filter-area" class="filter-select">
                <option value="">Todas las Áreas</option>
                ${areaOptions}
            </select>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Ítem</th>
                        <th>Marca</th>
                        <th>Stock</th>
                        <th>Estado</th>
                        <th>Seguimiento</th>
                        <th>Encargado</th>
                        <th>Ubicación / Actividad</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="inventory-body">
                    ${items.map(item => renderRow(item, data)).join('')}
                </tbody>
            </table>
            ${items.length === 0 ? '<div style="padding:3rem; text-align:center; color:var(--text-muted);">No hay items para mostrar</div>' : ''}
        </div>
    </div>
    
    <div id="quick-create-container"></div>
    `;
    
    container.innerHTML = html;
    setupFilters();
}

function renderRow(item, data) {
    const areaName = data.areas.find(a => a.id === item.areaId)?.name || '-';
    const eventName = data.events.find(e => e.id === item.eventId)?.name;
    const activityName = data.activities ? data.activities.find(a => a.id === item.activityId)?.name : null;
    const personName = data.people.find(p => p.id === item.personId)?.name || '-';
    
    // Lógica de Ubicación: Muestra Evento y Actividad si existe
    let locationHtml = `<span style="color:var(--text-muted);">${areaName}</span>`;
    
    if (eventName) {
        let subText = activityName ? `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">↳ ${activityName}</span>` : '';
        locationHtml = `<span style="color:var(--purple); font-weight:600; line-height:1.2;">
            <i class="ph ph-calendar"></i> ${eventName}
            ${subText}
        </span>`;
    }
    
    const statusClass = item.status === 'disponible' ? 'status-green' : (item.status === 'en uso' ? 'status-yellow' : 'status-red');
    const trackClass = item.tracking === 'conseguido' ? 'status-green' : (item.tracking === 'en_proceso' ? 'status-blue' : 'status-yellow');

    return `
    <tr data-name="${item.name.toLowerCase()}" 
        data-brand="${(item.brand || '').toLowerCase()}"
        data-person="${personName.toLowerCase()}" 
        data-status="${item.status}" 
        data-area="${item.areaId}">
        
        <td style="font-weight:600; color:var(--text-main);">${item.name}</td>
        <td style="color:var(--text-muted);">${item.brand || '-'}</td>
        <td>${item.stock}</td>
        <td><span class="status-pill ${statusClass}">${item.status || 'N/A'}</span></td>
        <td><span class="status-pill ${trackClass}">${item.tracking ? item.tracking.replace('_', ' ') : '-'}</span></td>
        <td>${personName}</td>
        <td>${locationHtml}</td>
        <td style="text-align:right;">
            <button onclick="window.modalAddItem('${item.id}')" class="btn-icon" title="Editar">
                <i class="ph ph-pencil-simple" style="color:var(--primary)"></i>
            </button>
            <button onclick="window.deleteItem('${item.id}')" class="btn-icon" title="Eliminar">
                <i class="ph ph-trash" style="color:var(--danger)"></i>
            </button>
        </td>
    </tr>`;
}

function setupFilters() {
    const searchInput = document.getElementById('filter-search');
    const statusSelect = document.getElementById('filter-status');
    const areaSelect = document.getElementById('filter-area');
    const rows = document.querySelectorAll('#inventory-body tr');

    const filterFn = () => {
        const term = searchInput.value.toLowerCase();
        const status = statusSelect.value;
        const area = areaSelect.value;

        rows.forEach(row => {
            const name = row.dataset.name;
            const brand = row.dataset.brand;
            const person = row.dataset.person;
            const rowStatus = row.dataset.status;
            const rowArea = row.dataset.area;

            const matchText = name.includes(term) || person.includes(term) || brand.includes(term);
            const matchStatus = status === "" || rowStatus === status;
            const matchArea = area === "" || rowArea === area;

            if (matchText && matchStatus && matchArea) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    };

    searchInput.addEventListener('keyup', filterFn);
    statusSelect.addEventListener('change', filterFn);
    areaSelect.addEventListener('change', filterFn);
}

// --- MODAL CREAR / EDITAR ---
window.modalAddItem = (itemId = null) => {
    import('./app.js').then(({ dbData }) => {
        const item = itemId ? dbData.items.find(i => i.id === itemId) : {};
        
        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                
                <div class="form-group">
                    <label>Nombre del Ítem</label>
                    <input type="text" id="item-name" value="${item.name || ''}" required placeholder="Ej: Cámara Sony A7">
                </div>

                <div class="form-group">
                    <label>Marca</label>
                    <input type="text" id="item-brand" value="${item.brand || ''}" placeholder="Ej: Sony, Apple, Bosch...">
                </div>
                
                <div class="form-group">
                    <label>Stock</label>
                    <input type="number" id="item-stock" value="${item.stock || 1}" required min="1">
                </div>
                
                <div class="form-group">
                    <label>Encargado</label>
                    <div style="display:flex; gap:5px;">
                        <select id="item-person" style="flex:1;">
                            <option value="">-- Sin asignar --</option>
                            ${dbData.people.map(p => `<option value="${p.id}" ${item.personId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                        <button type="button" onclick="window.quickCreate('person', 'item-person')" class="btn btn-white" title="Crear Encargado">
                            <i class="ph ph-plus" style="color:var(--primary);"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Estado</label>
                    <select id="item-status">
                        <option value="disponible" ${item.status === 'disponible' ? 'selected' : ''}>🟢 Disponible</option>
                        <option value="en uso" ${item.status === 'en uso' ? 'selected' : ''}>🟡 En uso</option>
                        <option value="mantenimiento" ${item.status === 'mantenimiento' ? 'selected' : ''}>🔴 Mantenimiento</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Seguimiento</label>
                    <select id="item-tracking">
                        <option value="conseguido" ${item.tracking === 'conseguido' ? 'selected' : ''}>✅ Conseguido</option>
                        <option value="en_proceso" ${item.tracking === 'en_proceso' ? 'selected' : ''}>⏳ En proceso</option>
                        <option value="por_conseguir" ${item.tracking === 'por_conseguir' ? 'selected' : ''}>🔍 Por conseguir</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Área</label>
                    <div style="display:flex; gap:5px;">
                        <select id="item-area" style="flex:1;">
                            <option value="">-- Sin Área --</option>
                            ${dbData.areas.map(a => `<option value="${a.id}" ${item.areaId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                        </select>
                        <button type="button" onclick="window.quickCreate('area', 'item-area')" class="btn btn-white" title="Crear Área">
                            <i class="ph ph-plus" style="color:var(--success);"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Evento (Ubicación)</label>
                    <div style="display:flex; gap:5px;">
                        <select id="item-event" style="flex:1;">
                            <option value="">-- Sin Evento --</option>
                            ${dbData.events.map(e => `<option value="${e.id}" ${item.eventId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
                        </select>
                        <button type="button" onclick="window.quickCreate('event', 'item-event')" class="btn btn-white" title="Crear Evento">
                            <i class="ph ph-plus" style="color:var(--purple);"></i>
                        </button>
                    </div>
                </div>

                <div class="full-width hidden" id="item-activity-container" style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid var(--border);">
                    <label style="color:var(--primary);">↳ Asignar a Actividad del Evento:</label>
                    <select id="item-activity" style="margin-top:5px;">
                        <option value="">-- General / Todo el Evento --</option>
                        </select>
                </div>

                <div class="full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Ítem
                    </button>
                </div>
            </form>
        `;

        window.app.openModal(itemId ? 'Editar Ítem' : 'Nuevo Ítem', html, async () => {
            const newItem = {
                id: document.getElementById('item-id').value || Date.now().toString(),
                name: document.getElementById('item-name').value,
                brand: document.getElementById('item-brand').value,
                stock: parseInt(document.getElementById('item-stock').value),
                status: document.getElementById('item-status').value,
                tracking: document.getElementById('item-tracking').value,
                areaId: document.getElementById('item-area').value,
                personId: document.getElementById('item-person').value,
                eventId: document.getElementById('item-event').value || null,
                activityId: document.getElementById('item-activity').value || null // NUEVO
            };
            
            const idx = dbData.items.findIndex(i => i.id === newItem.id);
            if (idx >= 0) dbData.items[idx] = newItem;
            else dbData.items.push(newItem);
            
            await saveItems(dbData.items);
            
            window.app.showToast("Ítem guardado exitosamente");
            window.app.reloadCurrentView();
        });

        // --- LÓGICA DINÁMICA DE ACTIVIDADES ---
        const eventSelect = document.getElementById('item-event');
        const activitySelect = document.getElementById('item-activity');
        const activityContainer = document.getElementById('item-activity-container');

        // Función para llenar actividades
        const populateActivities = (eventId, selectedActId = null) => {
            activitySelect.innerHTML = '<option value="">-- General / Todo el Evento --</option>';
            
            if (!eventId) {
                activityContainer.classList.add('hidden');
                return;
            }

            const eventActivities = (dbData.activities || []).filter(a => a.eventId === eventId);
            
            if (eventActivities.length > 0) {
                eventActivities.forEach(act => {
                    const opt = document.createElement('option');
                    opt.value = act.id;
                    opt.text = `${act.startTime || ''} - ${act.name}`;
                    if (act.id === selectedActId) opt.selected = true;
                    activitySelect.appendChild(opt);
                });
                activityContainer.classList.remove('hidden');
            } else {
                activityContainer.classList.add('hidden');
            }
        };

        // Evento cambio
        eventSelect.addEventListener('change', (e) => populateActivities(e.target.value));

        // Carga inicial (si estamos editando)
        if (item.eventId) {
            populateActivities(item.eventId, item.activityId);
        }
    });
};

// --- CREACIÓN RÁPIDA (MINI-MODAL) ---
window.quickCreate = (type, targetSelectId) => {
    const container = document.getElementById('quick-create-container');
    let title = '', inputsHtml = '';
    const today = new Date().toISOString().split('T')[0];

    if (type === 'person') {
        title = 'Nuevo Encargado';
        inputsHtml = `<input type="text" id="quick-input-name" placeholder="Nombre completo" class="quick-input">`;
    } else if (type === 'area') {
        title = 'Nueva Área';
        inputsHtml = `<input type="text" id="quick-input-name" placeholder="Nombre del área" class="quick-input">`;
    } else if (type === 'event') {
        title = 'Nuevo Evento Rápido';
        inputsHtml = `
            <input type="text" id="quick-input-name" placeholder="Nombre del evento" class="quick-input" style="margin-bottom:10px;">
            <div style="display:flex; gap:5px;">
                <input type="date" id="quick-input-start" value="${today}" class="quick-input">
                <input type="date" id="quick-input-end" value="${today}" class="quick-input">
            </div>
        `;
    }

    container.innerHTML = `
        <div class="modal-overlay" style="z-index: 3000; background: rgba(0,0,0,0.4);">
            <div class="modal-content" style="max-width: 350px; padding: 1.5rem; border-radius:12px; animation: slideUp 0.2s ease-out;">
                <h3 style="margin-top:0; font-size:1.1rem;">${title}</h3>
                <div style="margin: 1rem 0;">
                    ${inputsHtml}
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('quick-create-container').innerHTML = ''" class="btn btn-white" style="flex:1;">Cancelar</button>
                    <button id="btn-quick-save" class="btn btn-success" style="flex:1;">Crear</button>
                </div>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `.quick-input { width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; }`;
    container.appendChild(style);

    document.getElementById('btn-quick-save').onclick = async () => {
        const name = document.getElementById('quick-input-name').value;
        if (!name) return alert("El nombre es obligatorio");

        const { dbData } = await import('./app.js'); 
        let newId = Date.now().toString();
        let newObj = null;

        if (type === 'person') {
            newObj = { id: newId, name };
            dbData.people.push(newObj);
            await savePeople(dbData.people);
        } else if (type === 'area') {
            newObj = { id: newId, name };
            dbData.areas.push(newObj);
            await saveAreas(dbData.areas);
        } else if (type === 'event') {
            const start = document.getElementById('quick-input-start').value;
            const end = document.getElementById('quick-input-end').value;
            newObj = { id: newId, name, startDate: start, endDate: end, color: '#a855f7' };
            dbData.events.push(newObj);
            await saveEvents(dbData.events);
        }

        const select = document.getElementById(targetSelectId);
        if (select) {
            const option = document.createElement('option');
            option.value = newObj.id;
            option.text = newObj.name;
            option.selected = true;
            select.appendChild(option);
            
            // Si creamos un evento, disparamos el evento 'change' para que se actualice 
            // la lista de actividades (que saldrá vacía, pero correcta)
            if(type === 'event') {
                select.dispatchEvent(new Event('change'));
            }
        }

        document.getElementById('quick-create-container').innerHTML = '';
        window.app.showToast(`${title.replace('Nuevo ', '').replace('Nueva ', '')} creado`);
    };
};

// --- ELIMINAR Y EXCEL ---
window.deleteItem = (id) => {
    window.app.confirm('¿Eliminar ítem?', 'No podrás recuperarlo.', 'Eliminar', 'var(--danger)', async () => {
        import('./app.js').then(async ({ dbData }) => {
            dbData.items = dbData.items.filter(i => i.id !== id);
            await saveItems(dbData.items);
            window.app.showToast("Ítem eliminado");
            window.app.reloadCurrentView();
        });
    });
};

window.downloadInventoryExcel = () => {
    import('./app.js').then(({ dbData }) => {
        const exportData = dbData.items.map(i => {
            const actName = dbData.activities ? dbData.activities.find(a => a.id === i.activityId)?.name : '';
            const evtName = dbData.events.find(e => e.id === i.eventId)?.name || 'N/A';
            
            return {
                Nombre: i.name,
                Marca: i.brand || '',
                Stock: i.stock,
                Estado: i.status,
                Encargado: dbData.people.find(p => p.id === i.personId)?.name || 'N/A',
                Area: dbData.areas.find(a => a.id === i.areaId)?.name || 'N/A',
                Evento: evtName,
                Actividad: actName || 'General' // Nueva columna en Excel
            };
        });
        window.app.exportToExcel(exportData, 'Inventario_Completo');
    });
};