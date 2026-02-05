import { saveItems, savePeople } from './api.js';

export function renderInventory(container, data, filterFn = null) {
    // Si viene un filtro externo (ej: desde el detalle de un Área), lo aplicamos primero
    let items = data.items;
    if (filterFn) items = items.filter(filterFn);

    // Generamos las opciones para el filtro de áreas dinámicamente
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
                <input type="text" id="filter-search" placeholder="Buscar por nombre, encargado o código...">
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
                        <th>Stock</th>
                        <th>Estado</th>
                        <th>Seguimiento</th>
                        <th>Encargado</th>
                        <th>Ubicación</th>
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
    `;
    
    container.innerHTML = html;
    
    // Activar los eventos de filtrado
    setupFilters();
}

// Helper para dibujar una fila (lo sacamos para que el código sea más limpio)
function renderRow(item, data) {
    const areaName = data.areas.find(a => a.id === item.areaId)?.name || '-';
    const eventName = data.events.find(e => e.id === item.eventId)?.name;
    const personName = data.people.find(p => p.id === item.personId)?.name || '-';
    
    // Lógica visual para la ubicación
    const location = eventName 
        ? `<span style="color:var(--purple); font-weight:600; display:flex; align-items:center; gap:4px;"><i class="ph ph-calendar"></i> ${eventName}</span>` 
        : `<span style="color:var(--text-muted);">${areaName}</span>`;
    
    // Clases de color
    const statusClass = item.status === 'disponible' ? 'status-green' : (item.status === 'en uso' ? 'status-yellow' : 'status-red');
    const trackClass = item.tracking === 'conseguido' ? 'status-green' : (item.tracking === 'en_proceso' ? 'status-blue' : 'status-yellow');

    // IMPORTANTE: Ponemos los datos en atributos 'data-' para que el filtro los encuentre rápido
    return `
    <tr data-name="${item.name.toLowerCase()}" 
        data-person="${personName.toLowerCase()}" 
        data-status="${item.status}" 
        data-area="${item.areaId}">
        
        <td style="font-weight:600; color:var(--text-main);">${item.name}</td>
        <td>${item.stock}</td>
        <td><span class="status-pill ${statusClass}">${item.status || 'N/A'}</span></td>
        <td><span class="status-pill ${trackClass}">${item.tracking ? item.tracking.replace('_', ' ') : '-'}</span></td>
        <td>${personName}</td>
        <td>${location}</td>
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

// Lógica de Filtrado (Se ejecuta cuando escribes o cambias un select)
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
            const person = row.dataset.person;
            const rowStatus = row.dataset.status;
            const rowArea = row.dataset.area;

            // Lógica: Debe cumplir TODAS las condiciones
            const matchText = name.includes(term) || person.includes(term);
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

// --- MODAL CREAR / EDITAR (CON DISEÑO MEJORADO) ---
window.modalAddItem = (itemId = null) => {
    import('./app.js').then(({ dbData }) => {
        const item = itemId ? dbData.items.find(i => i.id === itemId) : {};
        
        // HTML del Formulario usando Grid para que no se vea apretado
        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                
                <div class="full-width">
                    <label>Nombre del Ítem</label>
                    <input type="text" id="item-name" value="${item.name || ''}" required placeholder="Ej: Cámara Sony A7">
                </div>
                
                <div class="form-group">
                    <label>Stock (Cantidad)</label>
                    <input type="number" id="item-stock" value="${item.stock || 1}" required min="1">
                </div>
                
                <div class="form-group">
                    <label>Encargado</label>
                    <div style="display:flex; gap:5px;">
                        <select id="item-person">
                            <option value="">-- Sin asignar --</option>
                            ${dbData.people.map(p => `<option value="${p.id}" ${item.personId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                        <button type="button" onclick="window.addPersonPrompt()" class="btn btn-white" title="Nuevo Encargado">+</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Estado Físico</label>
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

                <div class="full-width">
                    <label>Área Perteneciente</label>
                    <select id="item-area">
                        <option value="">-- Seleccionar Área --</option>
                        ${dbData.areas.map(a => `<option value="${a.id}" ${item.areaId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>
                </div>

                <div class="full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Cambios
                    </button>
                </div>
            </form>
        `;

        // Abrir Modal
        window.app.openModal(itemId ? 'Editar Ítem' : 'Nuevo Ítem', html, async () => {
            const newItem = {
                id: document.getElementById('item-id').value || Date.now().toString(),
                name: document.getElementById('item-name').value,
                stock: parseInt(document.getElementById('item-stock').value),
                status: document.getElementById('item-status').value,
                tracking: document.getElementById('item-tracking').value,
                areaId: document.getElementById('item-area').value,
                personId: document.getElementById('item-person').value,
                eventId: item.eventId || null // Mantenemos evento si ya tenía
            };
            
            // Guardar Lógica
            const idx = dbData.items.findIndex(i => i.id === newItem.id);
            if (idx >= 0) dbData.items[idx] = newItem;
            else dbData.items.push(newItem);
            
            await saveItems(dbData.items);
            
            // Recargar vista sin ir al inicio
            window.app.reloadCurrentView();
        });
    });
};

// --- ELIMINAR ÍTEM (Con la nueva Alerta Bonita) ---
window.deleteItem = (id) => {
    // Usamos el nuevo sistema de app.confirm
    window.app.confirm(
        '¿Eliminar este ítem?',                 // Título
        'Esta acción borrará el ítem del inventario permanentemente.', // Mensaje
        'Sí, eliminar',                         // Texto botón
        'var(--danger)',                        // Color botón (Rojo)
        async () => {                           // Acción al confirmar
            import('./app.js').then(async ({ dbData }) => {
                dbData.items = dbData.items.filter(i => i.id !== id);
                await saveItems(dbData.items);
                window.app.reloadCurrentView(); // Recargar vista
            });
        }
    );
};

// --- EXCEL ---
window.downloadInventoryExcel = () => {
    import('./app.js').then(({ dbData }) => {
        const exportData = dbData.items.map(i => ({
            Nombre: i.name,
            Stock: i.stock,
            Estado: i.status,
            Seguimiento: i.tracking,
            Encargado: dbData.people.find(p => p.id === i.personId)?.name || 'N/A',
            Area: dbData.areas.find(a => a.id === i.areaId)?.name || 'N/A',
            Evento: dbData.events.find(e => e.id === i.eventId)?.name || 'N/A'
        }));
        window.app.exportToExcel(exportData, 'Inventario_Completo');
    });
};