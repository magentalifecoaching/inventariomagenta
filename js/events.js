import { saveEvents, saveItems } from './api.js';
import { renderInventory } from './inventory.js';

export function renderEventsModule(container, data) {
    container.innerHTML = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú
                </button>
                <div>
                    <h1>Eventos</h1>
                    <p>Logística y planificación</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.downloadEventsExcel()" class="btn btn-success">
                    <i class="ph ph-microsoft-excel-logo"></i> Excel
                </button>
                <button onclick="window.modalEvent()" class="btn btn-purple">
                    <i class="ph ph-calendar-plus"></i> Nuevo Evento
                </button>
            </div>
        </div>

        <div class="grid-dashboard">
            ${data.events.map(event => {
                const count = data.items.filter(i => i.eventId === event.id).length;
                
                return `
                <div class="dashboard-card" style="border-left: 5px solid var(--purple); position: relative;">
                    
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px;">
                        <button onclick="event.stopPropagation(); window.modalEvent('${event.id}')" class="btn-icon" title="Editar">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteEvent('${event.id}')" class="btn-icon" title="Eliminar" style="color:var(--danger)">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>

                    <div onclick="window.viewEventDetail('${event.id}')" style="cursor:pointer;">
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                            <div class="icon-box" style="background:#f3e8ff; color:var(--purple); margin:0;">
                                <i class="ph ph-calendar"></i>
                            </div>
                            <span style="font-size:0.9rem; font-weight:600; color:#581c87; background:#f3e8ff; padding:4px 10px; border-radius:8px;">
                                ${event.date || 'Sin fecha'}
                            </span>
                        </div>
                        
                        <h2 style="text-align:left; font-size:1.4rem; margin-bottom:0.5rem; color:var(--text-main);">${event.name}</h2>
                        
                        <div style="text-align:left;">
                             <span class="badge" style="background:#f3e8ff; color:#6b21a8; margin:0; border:1px solid #d8b4fe;">
                                ${count} items asignados
                             </span>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    </div>
    `;
}

/* =========================================
   LÓGICA
   ========================================= */

// 1. Descargar Excel
window.downloadEventsExcel = () => {
    import('./app.js').then(({ dbData }) => {
        const dataToExport = dbData.items.filter(i => i.eventId).map(i => ({
            Evento: dbData.events.find(e => e.id === i.eventId)?.name || 'Desconocido',
            Fecha: dbData.events.find(e => e.id === i.eventId)?.date || '-',
            Item: i.name,
            Stock: i.stock,
            Encargado: dbData.people.find(p => p.id === i.personId)?.name || 'N/A'
        }));

        if(dataToExport.length === 0) {
            alert("No hay items asignados a eventos.");
            return;
        }
        window.app.exportToExcel(dataToExport, 'Reporte_Eventos');
    });
};

// 2. Modal Crear / Editar (Diseño Form Grid)
window.modalEvent = (id = null) => {
    import('./app.js').then(({ dbData }) => {
        const event = id ? dbData.events.find(e => e.id === id) : {};
        
        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="event-id" value="${event.id || ''}">
                
                <div class="full-width">
                    <label>Nombre del Evento</label>
                    <input type="text" id="event-name" value="${event.name || ''}" required 
                           placeholder="Ej: Conferencia Anual, Grabación Spot...">
                </div>
                
                <div class="form-group">
                    <label>Fecha del Evento</label>
                    <input type="date" id="event-date" value="${event.date || ''}" required>
                </div>
                
                <div class="full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-purple" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Evento
                    </button>
                </div>
            </form>
        `;

        window.app.openModal(id ? 'Editar Evento' : 'Nuevo Evento', html, async () => {
            const newEvent = { 
                id: document.getElementById('event-id').value || Date.now().toString(), 
                name: document.getElementById('event-name').value, 
                date: document.getElementById('event-date').value 
            };
            
            const idx = dbData.events.findIndex(e => e.id === newEvent.id);
            if (idx >= 0) dbData.events[idx] = newEvent;
            else dbData.events.push(newEvent);
            
            await saveEvents(dbData.events);
            window.app.reloadCurrentView();
        });
    });
};

// 3. Eliminar Evento (Con Alerta Bonita)
window.deleteEvent = (id) => {
    window.app.confirm(
        '¿Eliminar evento?', 
        'Los items asignados NO se borrarán, pero serán liberados (volverán a estar disponibles).', 
        'Sí, eliminar', 
        'var(--danger)', 
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                // Borrar evento
                dbData.events = dbData.events.filter(e => e.id !== id);
                await saveEvents(dbData.events);
                
                // Liberar items (Cascada)
                let modified = false;
                dbData.items.forEach(item => { 
                    if(item.eventId === id) { 
                        item.eventId = null; 
                        item.status = 'disponible'; // Resetear estado
                        modified = true; 
                    } 
                });
                
                if(modified) await saveItems(dbData.items);
                
                window.app.reloadCurrentView();
            });
        }
    );
};

// 4. Ver Detalle y Asignar
window.viewEventDetail = (id) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === id);
        if(!event) return;

        const container = document.getElementById('main-layout');

        container.innerHTML = `
        <div class="container">
            <div class="header-bar">
                <div class="title-group">
                    <button onclick="app.showModule('events')" class="btn btn-white">
                        <i class="ph ph-caret-left"></i> Volver a Eventos
                    </button>
                    <div>
                        <h1>${event.name}</h1>
                        <p><i class="ph ph-calendar"></i> ${event.date}</p>
                    </div>
                </div>
                <button onclick="window.assignItemsToEvent('${id}')" class="btn btn-purple">
                    <i class="ph ph-check-square-offset"></i> Asignar Items
                </button>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:2rem; flex-wrap:wrap;">
                 ${dbData.areas.map(area => {
                    const count = dbData.items.filter(i => i.eventId === id && i.areaId === area.id).length;
                    if(count === 0) return '';
                    return `
                        <div style="background:white; padding:6px 14px; border-radius:20px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-muted);">
                            <strong>${area.name}:</strong> ${count}
                        </div>
                    `;
                }).join('')}
            </div>

            <div id="event-inventory-wrapper"></div>
        </div>
        `;

        // Renderizar tabla
        renderInventory(
            document.getElementById('event-inventory-wrapper'), 
            dbData, 
            (item) => item.eventId === id
        );

        // Limpieza visual
        setTimeout(() => {
            const innerHeader = document.querySelector('#event-inventory-wrapper .header-bar');
            if(innerHeader) innerHeader.style.display = 'none';
        }, 0);
    });
};

// 5. Asignación Masiva
window.assignItemsToEvent = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const availableItems = dbData.items.filter(i => !i.eventId);
        
        if(availableItems.length === 0) {
            alert("No hay items disponibles en el inventario general.");
            return;
        }

        const html = `
            <div style="margin-bottom:1rem; color:var(--text-muted);">Selecciona items para asignar:</div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; background:#f9fafb;">
                ${availableItems.map(item => {
                    const areaName = dbData.areas.find(a => a.id === item.areaId)?.name || 'Sin área';
                    return `
                    <label style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white;">
                        <input type="checkbox" class="item-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px; accent-color:var(--purple);">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${item.name}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                                <span>Stock: ${item.stock}</span>
                                <span>${areaName}</span>
                            </div>
                        </div>
                    </label>
                    `;
                }).join('')}
            </div>
            <div style="margin-top:1.5rem;">
                <button type="submit" class="btn btn-purple" style="width:100%; padding:1rem;">Confirmar Asignación</button>
            </div>
        `;

        window.app.openModal('Asignar Recursos', html, async () => {
            const checks = document.querySelectorAll('.item-check:checked');
            const ids = Array.from(checks).map(c => c.value);
            
            let modified = false;
            dbData.items.forEach(item => {
                if(ids.includes(item.id)) {
                    item.eventId = eventId;
                    item.status = 'en uso';
                    modified = true;
                }
            });

            if(modified) {
                await saveItems(dbData.items);
                // Aquí llamamos directamente a la vista de detalle para refrescar
                await window.app.refreshData();
                window.viewEventDetail(eventId); 
            }
        });
    });
};