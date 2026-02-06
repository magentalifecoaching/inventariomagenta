import { saveEvents, saveItems } from './api.js';
import { renderInventory } from './inventory.js';

export function renderEventsModule(container, data) {
    const today = new Date().toISOString().split('T')[0]; // Fecha de hoy (YYYY-MM-DD)

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
                
                // Lógica: ¿Está finalizado?
                // Si hay fecha fin y es menor a hoy, está finalizado.
                const isFinished = event.endDate && event.endDate < today;
                const cardClass = isFinished ? 'dashboard-card finished' : 'dashboard-card';
                const statusLabel = isFinished ? '(Finalizado)' : '';
                
                // Color personalizado o default
                const eventColor = event.color || '#a855f7'; // Morado por defecto

                return `
                <div class="${cardClass}" style="border-left: 6px solid ${eventColor}; position: relative;">
                    
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px; z-index:10;">
                        <button onclick="event.stopPropagation(); window.modalEvent('${event.id}')" class="btn-icon" title="Editar">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteEvent('${event.id}')" class="btn-icon" title="Eliminar" style="color:var(--danger)">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>

                    <div onclick="window.viewEventDetail('${event.id}')" style="cursor:pointer;">
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                            <div class="icon-box" style="background:${eventColor}20; color:${eventColor}; margin:0;">
                                <i class="ph ph-calendar"></i>
                            </div>
                            
                            <div style="text-align:right;">
                                <span style="font-size:0.8rem; color:var(--text-muted); display:block;">Inicio: ${event.startDate || 'N/A'}</span>
                                <span style="font-size:0.8rem; color:var(--text-muted); display:block;">Fin: ${event.endDate || 'N/A'}</span>
                            </div>
                        </div>
                        
                        <h2 style="text-align:left; font-size:1.4rem; margin-bottom:0.5rem; color:var(--text-main);">
                            ${event.name} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:400;">${statusLabel}</span>
                        </h2>
                        
                        <div style="text-align:left;">
                             <span class="badge" style="background:${eventColor}20; color:${eventColor}; margin:0; border:1px solid ${eventColor}40;">
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
        const dataToExport = dbData.items.filter(i => i.eventId).map(i => {
            const evt = dbData.events.find(e => e.id === i.eventId);
            return {
                Evento: evt?.name || 'Desconocido',
                Inicio: evt?.startDate || '-',
                Fin: evt?.endDate || '-',
                Item: i.name,
                Stock: i.stock,
                Encargado: dbData.people.find(p => p.id === i.personId)?.name || 'N/A'
            };
        });

        if(dataToExport.length === 0) {
            alert("No hay items asignados a eventos.");
            return;
        }
        window.app.exportToExcel(dataToExport, 'Reporte_Eventos');
    });
};

// 2. Modal Crear / Editar (CON FECHAS Y COLOR)
window.modalEvent = (id = null) => {
    import('./app.js').then(({ dbData }) => {
        const event = id ? dbData.events.find(e => e.id === id) : {};
        
        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="event-id" value="${event.id || ''}">
                
                <div class="full-width" style="display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label>Nombre del Evento</label>
                        <input type="text" id="event-name" value="${event.name || ''}" required 
                            placeholder="Ej: Conferencia Anual">
                    </div>
                    <div style="width:80px;">
                        <label>Color</label>
                        <input type="color" id="event-color" value="${event.color || '#a855f7'}" style="height:48px; padding:2px;">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Fecha Inicio</label>
                    <input type="date" id="event-start" value="${event.startDate || ''}" required>
                </div>
                
                <div class="form-group">
                    <label>Fecha Finalización</label>
                    <input type="date" id="event-end" value="${event.endDate || ''}" required>
                </div>
                
                <div class="full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-purple" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Evento
                    </button>
                </div>
            </form>
        `;

        window.app.openModal(id ? 'Editar Evento' : 'Nuevo Evento', html, async () => {
            const startDate = document.getElementById('event-start').value;
            const endDate = document.getElementById('event-end').value;

            // Validación simple de fechas
            if(startDate > endDate) {
                alert("La fecha de inicio no puede ser posterior a la fecha final.");
                return; // Detiene el guardado pero NO cierra el modal (porque onSaveCallback es controlado)
            }

            const newEvent = { 
                id: document.getElementById('event-id').value || Date.now().toString(), 
                name: document.getElementById('event-name').value, 
                startDate: startDate,
                endDate: endDate,
                color: document.getElementById('event-color').value
            };
            
            const idx = dbData.events.findIndex(e => e.id === newEvent.id);
            if (idx >= 0) dbData.events[idx] = newEvent;
            else dbData.events.push(newEvent);
            
            await saveEvents(dbData.events);
            
            // Usamos el Toast nuevo y recargamos
            window.app.showToast("Evento guardado correctamente");
            
            // IMPORTANTE: Cerrar modal manual porque detuvimos el flujo automático en app.js para validaciones
            window.app.closeModal(); 
            window.app.reloadCurrentView();
        });
    });
};

// 3. Eliminar Evento
window.deleteEvent = (id) => {
    window.app.confirm(
        '¿Eliminar evento?', 
        'Los items serán liberados, no borrados.', 
        'Sí, eliminar', 
        'var(--danger)', 
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                dbData.events = dbData.events.filter(e => e.id !== id);
                await saveEvents(dbData.events);
                
                // Liberar items
                let modified = false;
                dbData.items.forEach(item => { 
                    if(item.eventId === id) { 
                        item.eventId = null; 
                        item.status = 'disponible'; 
                        modified = true; 
                    } 
                });
                
                if(modified) await saveItems(dbData.items);
                
                window.app.showToast("Evento eliminado");
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
        const color = event.color || '#a855f7';

        container.innerHTML = `
        <div class="container">
            <div class="header-bar">
                <div class="title-group">
                    <button onclick="app.showModule('events')" class="btn btn-white">
                        <i class="ph ph-caret-left"></i> Volver
                    </button>
                    <div>
                        <h1 style="color:${color}">${event.name}</h1>
                        <p>
                            <i class="ph ph-calendar"></i> ${event.startDate} al ${event.endDate}
                        </p>
                    </div>
                </div>
                <button onclick="window.assignItemsToEvent('${id}')" class="btn" style="background:${color}; color:white;">
                    <i class="ph ph-check-square-offset"></i> Asignar Items
                </button>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:2rem; flex-wrap:wrap;">
                 ${dbData.areas.map(area => {
                    const count = dbData.items.filter(i => i.eventId === id && i.areaId === area.id).length;
                    if(count === 0) return '';
                    return `
                        <div style="background:white; padding:6px 14px; border-radius:20px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-muted);">
                            <strong style="color:${color}">${area.name}:</strong> ${count}
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

        setTimeout(() => {
            const innerHeader = document.querySelector('#event-inventory-wrapper .header-bar');
            if(innerHeader) innerHeader.style.display = 'none';
        }, 0);
    });
};

// 5. Asignación Masiva
window.assignItemsToEvent = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === eventId);
        const color = event.color || 'var(--purple)';

        const availableItems = dbData.items.filter(i => !i.eventId);
        
        if(availableItems.length === 0) {
            window.app.showToast("No hay items disponibles");
            return;
        }

        const html = `
            <div style="margin-bottom:1rem; color:var(--text-muted);">Selecciona items para asignar:</div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; background:#f9fafb;">
                ${availableItems.map(item => {
                    const areaName = dbData.areas.find(a => a.id === item.areaId)?.name || 'Sin área';
                    return `
                    <label style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white;">
                        <input type="checkbox" class="item-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px; accent-color:${color};">
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
                <button type="submit" class="btn" style="background:${color}; color:white; width:100%; padding:1rem;">Confirmar Asignación</button>
            </div>
        `;

        window.app.openModal('Asignar Recursos', html, async () => {
            const checks = document.querySelectorAll('.item-check:checked');
            const ids = Array.from(checks).map(c => c.value);
            
            if(ids.length === 0) {
                 window.app.closeModal(); // Cerrar si no selecciona nada
                 return;
            }

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
                window.app.showToast(`${ids.length} items asignados`);
                window.app.closeModal(); // Cerramos modal manual
                await window.app.refreshData();
                window.viewEventDetail(eventId); 
            }
        });
    });
};