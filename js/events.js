import { saveEvents, saveItems, saveActivities } from './api.js';
import { renderInventory } from './inventory.js';

// =========================================
// 1. VISTA PRINCIPAL (GRID DE EVENTOS)
// =========================================
export function renderEventsModule(container, data) {
    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú
                </button>
                <div>
                    <h1>Eventos y Logística</h1>
                    <p>Planificación de cronogramas y recursos</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.modalEvent()" class="btn btn-purple">
                    <i class="ph ph-calendar-plus"></i> Nuevo Evento
                </button>
            </div>
        </div>

        <div class="grid-dashboard">
            ${data.events.map(event => {
                const isFinished = event.endDate && event.endDate < today;
                const cardClass = isFinished ? 'dashboard-card finished' : 'dashboard-card';
                const statusLabel = isFinished ? '(Finalizado)' : '';
                const eventColor = event.color || '#a855f7';
                
                // Contar actividades e items
                const actCount = (data.activities || []).filter(a => a.eventId === event.id).length;
                const itemsCount = data.items.filter(i => i.eventId === event.id).length;

                return `
                <div class="${cardClass}" style="border-left: 6px solid ${eventColor}; position: relative;">
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px; z-index:10;">
                        <button onclick="event.stopPropagation(); window.modalEvent('${event.id}')" class="btn-icon" title="Editar Evento">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteEvent('${event.id}')" class="btn-icon" title="Eliminar Evento" style="color:var(--danger)">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>

                    <div onclick="window.viewEventDetail('${event.id}')" style="cursor:pointer;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                            <div class="icon-box" style="background:${eventColor}20; color:${eventColor}; margin:0;">
                                <i class="ph ph-calendar"></i>
                            </div>
                            <div style="text-align:right;">
                                <span style="font-size:0.8rem; color:var(--text-muted); display:block;">Inicio: ${event.startDate || '-'}</span>
                                <span style="font-size:0.8rem; color:var(--text-muted); display:block;">Fin: ${event.endDate || '-'}</span>
                            </div>
                        </div>
                        
                        <h2 style="text-align:left; font-size:1.4rem; margin-bottom:0.5rem;">
                            ${event.name} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:400;">${statusLabel}</span>
                        </h2>
                        
                        <div style="display:flex; gap:10px; margin-top:1rem;">
                             <span class="badge" style="background:#f1f5f9; color:#64748b;">
                                <i class="ph ph-clock"></i> ${actCount} Actividades
                             </span>
                             <span class="badge" style="background:${eventColor}20; color:${eventColor}; border:1px solid ${eventColor}40;">
                                <i class="ph ph-package"></i> ${itemsCount} Items
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

// =========================================
// 2. VISTA DE DETALLE (CRONOGRAMA Y GESTIÓN)
// =========================================
window.viewEventDetail = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === eventId);
        if(!event) return;

        const color = event.color || '#a855f7';
        const container = document.getElementById('main-layout');

        // Renderizado base
        container.innerHTML = `
        <div class="container">
            <div class="header-bar">
                <div class="title-group">
                    <button onclick="app.showModule('events')" class="btn btn-white">
                        <i class="ph ph-caret-left"></i> Volver
                    </button>
                    <div>
                        <h1 style="color:${color}">${event.name}</h1>
                        <p><i class="ph ph-calendar"></i> ${event.startDate} al ${event.endDate}</p>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.downloadEventPDF('${eventId}')" class="btn btn-success">
                        <i class="ph ph-file-pdf"></i> Descargar Cronograma PDF
                    </button>
                    <button onclick="window.modalActivity('${eventId}')" class="btn btn-primary">
                        <i class="ph ph-plus"></i> Nueva Actividad
                    </button>
                </div>
            </div>

            <div class="tabs-header">
                <button class="tab-btn active" onclick="window.switchTab('timeline', '${eventId}')" id="tab-timeline">
                    <i class="ph ph-list-dashes"></i> Cronograma
                </button>
                <button class="tab-btn" onclick="window.switchTab('global', '${eventId}')" id="tab-global">
                    <i class="ph ph-package"></i> Inventario Global
                </button>
            </div>

            <div id="event-content-area"></div>
        </div>
        `;

        // Cargar por defecto el Cronograma
        window.renderTimeline(eventId);
    });
};

window.switchTab = (tabName, eventId) => {
    // Actualizar clases de botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'timeline') window.renderTimeline(eventId);
    if (tabName === 'global') window.renderGlobalList(eventId);
};

// --- SUB-VISTA: CRONOGRAMA ---
window.renderTimeline = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const activities = (dbData.activities || [])
            .filter(a => a.eventId === eventId)
            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

        const generalItems = dbData.items.filter(i => i.eventId === eventId && !i.activityId);
        const area = document.getElementById('event-content-area');

        let html = '<div class="timeline">';

        // 1. Bloque General (Sin horario)
        if (generalItems.length > 0) {
            html += `
            <div class="timeline-item">
                <div class="timeline-dot" style="background:#64748b; border-color:#e2e8f0;"></div>
                <span class="timeline-time">LOGÍSTICA GENERAL</span>
                <h3 class="timeline-title">Recursos Transversales / Generales</h3>
                ${renderItemsList(generalItems, true)}
            </div>`;
        } else if (activities.length === 0) {
            html += `<div style="padding:2rem; text-align:center; color:var(--text-muted);">
                Añade actividades para ver el cronograma o asigna items al evento.
            </div>`;
        }

        // 2. Actividades Cronometradas
        activities.forEach(act => {
            const actItems = dbData.items.filter(i => i.activityId === act.id);
            html += `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <span class="timeline-time">${act.startTime || '??:??'} - ${act.endTime || '??:??'}</span>
                
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h3 class="timeline-title">${act.name}</h3>
                        ${act.description ? `<p style="color:var(--text-muted); margin-top:-10px; font-size:0.9rem;">${act.description}</p>` : ''}
                    </div>
                    <div style="display:flex; gap:5px;">
                         <button onclick="window.modalActivity('${eventId}', '${act.id}')" class="btn-icon"><i class="ph ph-pencil-simple"></i></button>
                         <button onclick="window.deleteActivity('${act.id}', '${eventId}')" class="btn-icon" style="color:var(--danger)"><i class="ph ph-trash"></i></button>
                    </div>
                </div>

                ${renderItemsList(actItems)}
                
                <div style="margin-top:1rem;">
                    <button onclick="window.assignItemsToActivity('${eventId}', '${act.id}')" class="btn btn-white" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                        <i class="ph ph-plus"></i> Añadir Recursos
                    </button>
                </div>
            </div>`;
        });

        html += '</div>';
        area.innerHTML = html;
    });
};

// Helper para dibujar lista de items pequeña
function renderItemsList(items, isGeneral = false) {
    if (items.length === 0) return '<div style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">Sin recursos asignados.</div>';
    
    return `
    <div class="activity-items-list">
        ${items.map(i => `
            <div class="activity-item-row">
                <div style="display:flex; gap:10px; align-items:center;">
                    <strong style="color:var(--text-main);">${i.name}</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted);">(${i.brand || 'Genérico'})</span>
                </div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <span style="font-weight:600; color:var(--primary);">x${i.stock}</span>
                    <button onclick="window.modalAddItem('${i.id}')" class="btn-icon" style="font-size:1rem; padding:2px;"><i class="ph ph-pencil-simple"></i></button>
                </div>
            </div>
        `).join('')}
    </div>`;
}

// --- SUB-VISTA: INVENTARIO GLOBAL ---
window.renderGlobalList = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const area = document.getElementById('event-content-area');
        // Usamos la función existente de inventory.js pero filtrada
        // Importamos dinámicamente para no causar conflictos circulares
        import('./inventory.js').then(({ renderInventory }) => {
            // Creamos un div wrapper
            area.innerHTML = `<div id="global-inv-wrapper"></div>`;
            renderInventory(
                document.getElementById('global-inv-wrapper'), 
                dbData, 
                (item) => item.eventId === eventId // Filtro solo este evento
            );
            // Ocultamos la cabecera repetida que trae renderInventory
            setTimeout(() => {
                const innerHeader = document.querySelector('#global-inv-wrapper .header-bar');
                if(innerHeader) innerHeader.style.display = 'none';
            }, 0);
        });
    });
};

// =========================================
// 3. GESTIÓN (MODALES Y LÓGICA)
// =========================================

// --- MODAL EVENTO (Crear/Editar) ---
window.modalEvent = (id = null) => {
    import('./app.js').then(({ dbData }) => {
        const event = id ? dbData.events.find(e => e.id === id) : {};
        
        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="event-id" value="${event.id || ''}">
                <div class="full-width" style="display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label>Nombre del Evento</label>
                        <input type="text" id="event-name" value="${event.name || ''}" required placeholder="Ej: Retiro Anual">
                    </div>
                    <div style="width:80px;">
                        <label>Color</label>
                        <input type="color" id="event-color" value="${event.color || '#a855f7'}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Fecha Inicio</label>
                    <input type="date" id="event-start" value="${event.startDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>Fecha Fin</label>
                    <input type="date" id="event-end" value="${event.endDate || ''}" required>
                </div>
                <div class="full-width">
                    <button type="submit" class="btn btn-purple" style="width:100%;">Guardar Evento</button>
                </div>
            </form>
        `;

        window.app.openModal(id ? 'Editar Evento' : 'Nuevo Evento', html, async () => {
            const newEvent = { 
                id: document.getElementById('event-id').value || Date.now().toString(), 
                name: document.getElementById('event-name').value, 
                startDate: document.getElementById('event-start').value,
                endDate: document.getElementById('event-end').value,
                color: document.getElementById('event-color').value
            };
            
            const idx = dbData.events.findIndex(e => e.id === newEvent.id);
            if (idx >= 0) dbData.events[idx] = newEvent;
            else dbData.events.push(newEvent);
            
            await saveEvents(dbData.events);
            window.app.showToast("Evento guardado");
            window.app.closeModal();
            window.app.reloadCurrentView();
        });
    });
};

// --- MODAL ACTIVIDAD (Crear/Editar) ---
window.modalActivity = (eventId, activityId = null) => {
    import('./app.js').then(({ dbData }) => {
        const act = activityId 
            ? (dbData.activities || []).find(a => a.id === activityId) 
            : {};
        
        const html = `
            <form id="dynamic-form" class="form-grid">
                <div class="full-width">
                    <label>Nombre de la Actividad</label>
                    <input type="text" id="act-name" value="${act.name || ''}" required placeholder="Ej: Caminata sobre fuego">
                </div>
                <div class="form-group">
                    <label>Hora Inicio</label>
                    <input type="time" id="act-start" value="${act.startTime || ''}">
                </div>
                <div class="form-group">
                    <label>Hora Fin</label>
                    <input type="time" id="act-end" value="${act.endTime || ''}">
                </div>
                <div class="full-width">
                    <label>Descripción / Notas</label>
                    <input type="text" id="act-desc" value="${act.description || ''}" placeholder="Detalles extra...">
                </div>
                <div class="full-width">
                    <button type="submit" class="btn btn-primary" style="width:100%;">Guardar Actividad</button>
                </div>
            </form>
        `;

        window.app.openModal(activityId ? 'Editar Actividad' : 'Nueva Actividad', html, async () => {
            const newAct = {
                id: activityId || Date.now().toString(),
                eventId: eventId,
                name: document.getElementById('act-name').value,
                startTime: document.getElementById('act-start').value,
                endTime: document.getElementById('act-end').value,
                description: document.getElementById('act-desc').value
            };

            if (!dbData.activities) dbData.activities = [];
            const idx = dbData.activities.findIndex(a => a.id === newAct.id);
            if (idx >= 0) dbData.activities[idx] = newAct;
            else dbData.activities.push(newAct);

            await saveActivities(dbData.activities);
            window.app.showToast("Actividad guardada");
            window.app.closeModal();
            window.viewEventDetail(eventId); // Recargar vista detalle
        });
    });
};

// --- ELIMINAR ---
window.deleteEvent = (id) => {
    window.app.confirm('¿Eliminar Evento?', 'Se borrará el evento y sus actividades. Los items quedarán libres.', 'Eliminar', 'var(--danger)', async () => {
        import('./app.js').then(async ({ dbData }) => {
            // 1. Borrar evento
            dbData.events = dbData.events.filter(e => e.id !== id);
            // 2. Borrar actividades asociadas
            if (dbData.activities) {
                dbData.activities = dbData.activities.filter(a => a.eventId !== id);
            }
            // 3. Liberar items
            let itemsModified = false;
            dbData.items.forEach(i => {
                if(i.eventId === id) {
                    i.eventId = null;
                    i.activityId = null;
                    i.status = 'disponible';
                    itemsModified = true;
                }
            });

            await Promise.all([
                saveEvents(dbData.events),
                saveActivities(dbData.activities),
                itemsModified ? saveItems(dbData.items) : Promise.resolve()
            ]);

            window.app.showToast("Evento eliminado");
            window.app.reloadCurrentView();
        });
    });
};

window.deleteActivity = (actId, eventId) => {
    window.app.confirm('¿Borrar Actividad?', 'Los items volverán a la lista General del evento.', 'Borrar', 'var(--danger)', async () => {
        import('./app.js').then(async ({ dbData }) => {
            // 1. Borrar actividad
            dbData.activities = dbData.activities.filter(a => a.id !== actId);
            // 2. Mover items a General (null activityId)
            let itemsModified = false;
            dbData.items.forEach(i => {
                if(i.activityId === actId) {
                    i.activityId = null; // Se quedan en el evento, pero sin actividad
                    itemsModified = true;
                }
            });

            await Promise.all([
                saveActivities(dbData.activities),
                itemsModified ? saveItems(dbData.items) : Promise.resolve()
            ]);

            window.app.showToast("Actividad eliminada");
            window.viewEventDetail(eventId);
        });
    });
};

// --- ASIGNAR RECURSOS RÁPIDO ---
window.assignItemsToActivity = (eventId, activityId) => {
    import('./app.js').then(({ dbData }) => {
        // Buscamos items que estén DISPONIBLES (sin evento) 
        // O que sean del MISMO evento pero sin actividad (General)
        const availableItems = dbData.items.filter(i => 
            (!i.eventId && i.status === 'disponible') || 
            (i.eventId === eventId && !i.activityId)
        );

        if(availableItems.length === 0) return window.app.showToast("No hay items disponibles para asignar");

        const html = `
            <div style="margin-bottom:1rem; color:var(--text-muted);">Selecciona items para esta actividad:</div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
                ${availableItems.map(item => {
                    const label = item.eventId === eventId ? '<span style="color:var(--primary); font-size:0.75rem;">(En Evento General)</span>' : '';
                    return `
                    <label style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white;">
                        <input type="checkbox" class="item-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px;">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${item.name} ${label}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Stock: ${item.stock} | Marca: ${item.brand || '-'}</div>
                        </div>
                    </label>`;
                }).join('')}
            </div>
            <div style="margin-top:1.5rem;">
                <button id="btn-assign-confirm" class="btn btn-primary" style="width:100%;">Asignar Seleccionados</button>
            </div>
        `;

        window.app.openModal('Asignar Recursos', html, async () => {
            // Este callback se ignora porque usaremos el botón custom
        });

        // Lógica manual del botón
        document.getElementById('btn-assign-confirm').onclick = async () => {
            const checks = document.querySelectorAll('.item-check:checked');
            const ids = Array.from(checks).map(c => c.value);

            if(ids.length === 0) return;

            dbData.items.forEach(item => {
                if(ids.includes(item.id)) {
                    item.eventId = eventId;
                    item.activityId = activityId;
                    item.status = 'en uso';
                }
            });

            await saveItems(dbData.items);
            window.app.showToast(`${ids.length} items asignados`);
            window.app.closeModal();
            window.viewEventDetail(eventId);
        };
    });
};

// =========================================
// 4. GENERADOR DE PDF (CRONOGRAMA)
// =========================================
window.downloadEventPDF = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === eventId);
        const activities = (dbData.activities || [])
            .filter(a => a.eventId === eventId)
            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
        const generalItems = dbData.items.filter(i => i.eventId === eventId && !i.activityId);

        // Inicializar jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabecera
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(event.name, 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Fecha: ${event.startDate} al ${event.endDate}`, 14, 30);
        doc.line(14, 35, 196, 35);

        let finalY = 40;

        // 1. Tabla de Recursos Generales (si hay)
        if (generalItems.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Recursos Generales / Transversales", 14, finalY + 10);
            
            const generalRows = generalItems.map(i => [i.name, i.brand || '-', i.stock.toString()]);
            doc.autoTable({
                startY: finalY + 15,
                head: [['Ítem', 'Marca', 'Cant.']],
                body: generalRows,
                theme: 'striped',
                headStyles: { fillColor: [100, 116, 139] }
            });
            finalY = doc.lastAutoTable.finalY + 10;
        }

        // 2. Iterar Actividades
        activities.forEach(act => {
            const actItems = dbData.items.filter(i => i.activityId === act.id);
            
            // Título Actividad (Hora - Nombre)
            // Chequear si cabe en la página
            if (finalY > 250) { doc.addPage(); finalY = 20; }

            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246); // Azul
            doc.text(`${act.startTime || '??:??'} - ${act.endTime || '??:??'} | ${act.name}`, 14, finalY + 10);
            
            if (act.description) {
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(act.description, 14, finalY + 16);
                finalY += 6;
            }

            if (actItems.length > 0) {
                const rows = actItems.map(i => [i.name, i.brand || '-', i.stock.toString()]);
                doc.autoTable({
                    startY: finalY + 12,
                    head: [['Ítem', 'Marca', 'Cant.']],
                    body: rows,
                    theme: 'grid',
                    headStyles: { fillColor: [59, 130, 246] }, // Azul primario
                    margin: { left: 14 }
                });
                finalY = doc.lastAutoTable.finalY;
            } else {
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text("(Sin recursos asignados)", 14, finalY + 12);
                finalY += 15;
            }
            finalY += 5; // Espacio entre actividades
        });

        doc.save(`Cronograma_${event.name.replace(/\s+/g, '_')}.pdf`);
    });
};