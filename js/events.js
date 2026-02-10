import { saveEvents, saveItems, saveActivities } from './api.js';
import { renderInventory } from './inventory.js';
import { generateId, debounce, upsert, formatDate } from './utils.js';

// =========================================
// ESTADO TEMPORAL PARA ACTIVIDADES EN MODAL
// =========================================
let tempActivities = [];

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

        <div class="filter-bar">
            <div class="search-group">
                <i class="ph ph-magnifying-glass"></i>
                <input type="text" id="events-search" placeholder="Buscar eventos por nombre...">
            </div>
        </div>

        <div class="grid-dashboard" id="events-grid">
            ${data.events.map(event => {
                const isFinished = event.endDate && event.endDate < today;
                const cardClass = isFinished ? 'dashboard-card finished' : 'dashboard-card';
                const statusLabel = isFinished ? '(Finalizado)' : '';
                const eventColor = event.color || '#a855f7';

                const actCount = (data.activities || []).filter(a => a.eventId === event.id).length;
                const itemsCount = data.items.filter(i => i.eventId === event.id).length;

                return `
                <div class="${cardClass}" style="border-left: 6px solid ${eventColor}; position: relative;" data-event-name="${event.name.toLowerCase()}">
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

    // Search filter for events (con debounce)
    const searchInput = document.getElementById('events-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#events-grid .dashboard-card').forEach(card => {
                const name = card.dataset.eventName || '';
                card.style.display = name.includes(term) ? '' : 'none';
            });
        }, 150));
    }
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
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.importFromGeneralInventory('${eventId}')" class="btn btn-white">
                        <i class="ph ph-download-simple"></i> Importar del Inventario
                    </button>
                    <button onclick="window.downloadEventPDF('${eventId}')" class="btn btn-success">
                        <i class="ph ph-file-pdf"></i> PDF
                    </button>
                    <button onclick="window.modalActivity('${eventId}')" class="btn btn-primary">
                        <i class="ph ph-plus"></i> Nueva Actividad
                    </button>
                </div>
            </div>

            <div class="filter-bar">
                <div class="search-group">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="event-detail-search" placeholder="Buscar actividades o recursos dentro del evento...">
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

            <div id="bulk-actions-bar" class="bulk-actions-bar hidden">
                <span id="bulk-count">0 seleccionados</span>
                <button onclick="window.bulkMoveToActivity('${eventId}')" class="btn btn-primary" style="padding:0.4rem 1rem; font-size:0.85rem;">
                    <i class="ph ph-arrows-left-right"></i> Mover a Actividad
                </button>
                <button onclick="window.bulkRemoveItems('${eventId}')" class="btn btn-white" style="padding:0.4rem 1rem; font-size:0.85rem; color:var(--danger); border-color:var(--danger);">
                    <i class="ph ph-trash"></i> Liberar Seleccionados
                </button>
            </div>

            <div id="event-content-area"></div>
        </div>
        `;

        // Search within event (con debounce)
        const searchInput = document.getElementById('event-detail-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.timeline-item').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(term) ? '' : 'none';
                });
            }, 150));
        }

        window.renderTimeline(eventId);
    });
};

window.switchTab = (tabName, eventId) => {
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

        const generalItems = dbData.items.filter(i => i.eventId === eventId && (!i.activityIds || i.activityIds.length === 0));
        const area = document.getElementById('event-content-area');

        let html = '<div class="timeline">';

        // 1. Bloque General (con botón eliminar)
        if (generalItems.length > 0) {
            html += `
            <div class="timeline-item">
                <div class="timeline-dot" style="background:#64748b; border-color:#e2e8f0;"></div>
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <span class="timeline-time">LOGÍSTICA GENERAL</span>
                        <h3 class="timeline-title">Recursos Transversales / Generales</h3>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="window.clearGeneralItems('${eventId}')" class="btn-icon" style="color:var(--danger);" title="Eliminar sección completa">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
                ${renderItemsWithCheckboxes(generalItems)}
            </div>`;
        } else if (activities.length === 0) {
            html += `<div style="padding:2rem; text-align:center; color:var(--text-muted);">
                Añade actividades para ver el cronograma o asigna items al evento.
            </div>`;
        }

        // 2. Actividades Cronometradas
        activities.forEach(act => {
            const actItems = dbData.items.filter(i => (i.activityIds || []).includes(act.id));
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

                ${renderItemsWithCheckboxes(actItems)}

                <div style="margin-top:1rem; display:flex; gap:8px; flex-wrap:wrap;">
                    <button onclick="window.assignItemsToActivity('${eventId}', '${act.id}')" class="btn btn-white" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                        <i class="ph ph-plus"></i> Añadir Recursos
                    </button>
                    <button onclick="window.importFromGeneralInventory('${eventId}', '${act.id}')" class="btn btn-white" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                        <i class="ph ph-download-simple"></i> Importar del Inventario
                    </button>
                </div>
            </div>`;
        });

        html += '</div>';
        area.innerHTML = html;

        // Setup checkboxes
        setupCheckboxListeners(eventId);
    });
};

// Helper: render items con checkboxes
function renderItemsWithCheckboxes(items) {
    if (items.length === 0) return '<div style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">Sin recursos asignados.</div>';

    return `
    <div class="activity-items-list">
        ${items.map(i => `
            <div class="activity-item-row">
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="checkbox" class="item-select-check" value="${i.id}" style="width:1.1rem; height:1.1rem; cursor:pointer; accent-color:var(--primary);">
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

// Checkbox listeners para acciones masivas
function setupCheckboxListeners(eventId) {
    const bulkBar = document.getElementById('bulk-actions-bar');
    const bulkCount = document.getElementById('bulk-count');
    if (!bulkBar) return;

    document.querySelectorAll('.item-select-check').forEach(check => {
        check.addEventListener('change', () => {
            const checked = document.querySelectorAll('.item-select-check:checked');
            if (checked.length > 0) {
                bulkBar.classList.remove('hidden');
                bulkCount.textContent = `${checked.length} seleccionado${checked.length > 1 ? 's' : ''}`;
            } else {
                bulkBar.classList.add('hidden');
            }
        });
    });
}

// --- SUB-VISTA: INVENTARIO GLOBAL ---
window.renderGlobalList = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const area = document.getElementById('event-content-area');
        import('./inventory.js').then(({ renderInventory }) => {
            area.innerHTML = `<div id="global-inv-wrapper"></div>`;
            renderInventory(
                document.getElementById('global-inv-wrapper'),
                dbData,
                (item) => item.eventId === eventId
            );
            setTimeout(() => {
                const innerHeader = document.querySelector('#global-inv-wrapper .header-bar');
                if(innerHeader) innerHeader.style.display = 'none';
            }, 0);
        });
    });
};

// =========================================
// 3. ACCIONES MASIVAS (BULK)
// =========================================

window.bulkMoveToActivity = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const checkedIds = Array.from(document.querySelectorAll('.item-select-check:checked')).map(c => c.value);
        if (checkedIds.length === 0) return;

        const activities = (dbData.activities || []).filter(a => a.eventId === eventId);

        const html = `
            <div style="margin-bottom:1rem; color:var(--text-muted);">Asignar <strong>${checkedIds.length}</strong> ítem(s) a:</div>
            <div style="display:flex; gap:8px; margin-bottom:1rem;">
                <button id="btn-bulk-clear" class="btn btn-white" style="flex:1;">Limpiar Actividades</button>
                <button id="btn-bulk-add" class="btn btn-primary" style="flex:1;">Agregar a Actividades</button>
            </div>
            <div id="activity-selection" style="border:1px solid var(--border); border-radius:8px; padding:10px; max-height:200px; overflow-y:auto;">
                ${activities.map(a => `
                    <label style="display:flex; align-items:center; padding:8px; cursor:pointer;">
                        <input type="checkbox" class="bulk-act-check" value="${a.id}" style="width:1rem; height:1rem; margin-right:8px; accent-color:var(--primary);">
                        <span>${a.startDate || '??-??-??'} ${a.startTime || '??:??'} - ${a.name}</span>
                    </label>
                `).join('')}
            </div>
        `;

        window.app.openModal('Asignar a Actividades', html, () => {});

        document.getElementById('btn-bulk-clear').onclick = async () => {
            dbData.items.forEach(item => {
                if (checkedIds.includes(item.id)) {
                    item.activityIds = [];
                }
            });

            await saveItems(dbData.items);
            window.app.closeModal();
            window.app.showToast(`${checkedIds.length} ítems sin actividades asignadas`);
            window.viewEventDetail(eventId);
        };

        document.getElementById('btn-bulk-add').onclick = async () => {
            const selectedActivityIds = Array.from(document.querySelectorAll('.bulk-act-check:checked')).map(c => c.value);
            if (selectedActivityIds.length === 0) {
                window.app.showToast('Selecciona al menos una actividad');
                return;
            }

            dbData.items.forEach(item => {
                if (checkedIds.includes(item.id)) {
                    const current = item.activityIds || [];
                    item.activityIds = [...new Set([...current, ...selectedActivityIds])];
                }
            });

            await saveItems(dbData.items);
            window.app.closeModal();
            window.app.showToast(`${checkedIds.length} ítems asignados a ${selectedActivityIds.length} actividades`);
            window.viewEventDetail(eventId);
        };
    });
};

window.bulkRemoveItems = (eventId) => {
    const checkedIds = Array.from(document.querySelectorAll('.item-select-check:checked')).map(c => c.value);
    if (checkedIds.length === 0) return;

    window.app.confirm(
        '¿Liberar ítems seleccionados?',
        `Se liberarán ${checkedIds.length} ítem(s) del evento. Volverán al inventario general.`,
        'Liberar',
        'var(--danger)',
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                dbData.items.forEach(item => {
                    if (checkedIds.includes(item.id)) {
                        item.eventId = null;
                        item.activityIds = [];
                        item.status = 'disponible';
                    }
                });

                await saveItems(dbData.items);
                window.app.showToast(`${checkedIds.length} ítems liberados`);
                window.viewEventDetail(eventId);
            });
        }
    );
};

// =========================================
// 4. ELIMINAR LOGÍSTICA GENERAL
// =========================================
window.clearGeneralItems = (eventId) => {
    window.app.confirm(
        '¿Eliminar Logística General?',
        'Los ítems volverán al inventario general como disponibles.',
        'Eliminar',
        'var(--danger)',
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                dbData.items.forEach(item => {
                    if (item.eventId === eventId && (!item.activityIds || item.activityIds.length === 0)) {
                        item.eventId = null;
                        item.activityIds = [];
                        item.status = 'disponible';
                    }
                });

                await saveItems(dbData.items);
                window.app.showToast('Sección de logística general eliminada');
                window.viewEventDetail(eventId);
            });
        }
    );
};

// =========================================
// 5. IMPORTAR DESDE INVENTARIO GENERAL
// =========================================
window.importFromGeneralInventory = (eventId, activityId = null) => {
    import('./app.js').then(({ dbData }) => {
        const availableItems = dbData.items.filter(i => !i.eventId && i.status === 'disponible');

        if (availableItems.length === 0) {
            return window.app.showToast('No hay ítems disponibles en el inventario general');
        }

        const activities = (dbData.activities || []).filter(a => a.eventId === eventId);

        const html = `
            <div style="margin-bottom:1rem;">
                <div class="search-group" style="margin-bottom:1rem;">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="import-inv-search" placeholder="Buscar ítems..." style="border:none; background:transparent; width:100%; outline:none;">
                </div>
                ${!activityId ? `
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.9rem; font-weight:600; color:#334155; margin-bottom:0.5rem; display:block;">Asignar a actividad:</label>
                    <select id="import-target-activity" style="width:100%; padding:0.75rem; border:1px solid var(--border); border-radius:8px;">
                        <option value="">-- General / Todo el Evento --</option>
                        ${activities.map(a => `<option value="${a.id}">${a.startTime || ''} - ${a.name}</option>`).join('')}
                    </select>
                </div>
                ` : ''}
            </div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;" id="import-items-list">
                ${availableItems.map(item => `
                    <label class="import-item-label" style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white; transition:background 0.15s;" data-name="${item.name.toLowerCase()}" data-brand="${(item.brand || '').toLowerCase()}">
                        <input type="checkbox" class="import-item-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px; accent-color:var(--primary);">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${item.name}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Stock: ${item.stock} | Marca: ${item.brand || '-'}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div style="margin-top:1.5rem;">
                <button id="btn-import-confirm" class="btn btn-primary" style="width:100%;">
                    <i class="ph ph-download-simple"></i> Importar Seleccionados
                </button>
            </div>
        `;

        window.app.openModal('Importar desde Inventario General', html, () => {});

        // Búsqueda dentro del modal
        const searchInput = document.getElementById('import-inv-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.import-item-label').forEach(label => {
                    const name = label.dataset.name || '';
                    const brand = label.dataset.brand || '';
                    label.style.display = (name.includes(term) || brand.includes(term)) ? '' : 'none';
                });
            });
        }

        document.getElementById('btn-import-confirm').onclick = async () => {
            const checks = document.querySelectorAll('.import-item-check:checked');
            const ids = Array.from(checks).map(c => c.value);
            if (ids.length === 0) return window.app.showToast('Selecciona al menos un ítem');

            const targetAct = activityId || (document.getElementById('import-target-activity')?.value || null);
            const targetActIds = targetAct ? [targetAct] : [];

            dbData.items.forEach(item => {
                if (ids.includes(item.id)) {
                    item.eventId = eventId;
                    item.activityIds = targetActIds;
                    item.status = 'en uso';
                }
            });

            await saveItems(dbData.items);
            window.app.closeModal();
            window.app.showToast(`${ids.length} ítems importados al evento`);
            window.viewEventDetail(eventId);
        };
    });
};

// =========================================
// 6. MODAL EVENTO (Crear/Editar) CON ACTIVIDADES
// =========================================
window.modalEvent = (id = null) => {
    import('./app.js').then(({ dbData }) => {
        const event = id ? dbData.events.find(e => e.id === id) : {};

        // Cargar actividades existentes si se edita
        tempActivities = id
            ? (dbData.activities || []).filter(a => a.eventId === id).map(a => ({...a}))
            : [];

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

                <!-- Sección de Actividades -->
                <div class="full-width" style="border-top:2px solid var(--border); padding-top:1rem; margin-top:0.5rem;">
                    <label style="font-size:1rem; font-weight:700; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-clock" style="color:var(--primary);"></i> Actividades del Cronograma
                    </label>
                    <div id="modal-activities-list"></div>
                    <div style="display:flex; gap:8px; margin-top:1rem;">
                        <button type="button" onclick="window.addTempActivity()" class="btn btn-white" style="flex:1;">
                            <i class="ph ph-plus"></i> Nueva Actividad
                        </button>
                        <button type="button" onclick="window.importActivitiesFromOtherEvent()" class="btn btn-white" style="flex:1;">
                            <i class="ph ph-copy"></i> Copiar de Otro Evento
                        </button>
                    </div>
                </div>

                <div class="full-width">
                    <button type="submit" class="btn btn-purple" style="width:100%;">Guardar Evento</button>
                </div>
            </form>
        `;

        window.app.openModal(id ? 'Editar Evento' : 'Nuevo Evento', html, async () => {
            const eventId = document.getElementById('event-id').value || generateId();
            const newEvent = {
                id: eventId,
                name: document.getElementById('event-name').value,
                startDate: document.getElementById('event-start').value,
                endDate: document.getElementById('event-end').value,
                color: document.getElementById('event-color').value
            };

            upsert(dbData.events, newEvent);

            // Guardar actividades temporales
            tempActivities.forEach(act => {
                act.eventId = eventId;
                if (!act.id) act.id = generateId();
            });

            if (!dbData.activities) dbData.activities = [];
            // Reemplazar actividades del evento con las temporales
            dbData.activities = dbData.activities.filter(a => a.eventId !== eventId);
            dbData.activities = [...dbData.activities, ...tempActivities];

            await Promise.all([
                saveEvents(dbData.events),
                saveActivities(dbData.activities)
            ]);

            window.app.showToast("Evento guardado");
            window.app.closeModal();
            window.app.reloadCurrentView();
        });

        // Renderizar actividades existentes
        renderModalActivities();
    });
};

function renderModalActivities() {
    const list = document.getElementById('modal-activities-list');
    if (!list) return;

    if (tempActivities.length === 0) {
        list.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.9rem; background:#f8fafc; border-radius:8px; border:1px dashed var(--border);">Sin actividades. Añade actividades para armar el cronograma.</div>';
        return;
    }

    list.innerHTML = tempActivities.map((act, idx) => `
        <div style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; background:white;">
            <div style="width:8px; height:8px; border-radius:50%; background:var(--primary); flex-shrink:0;"></div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.95rem;">${act.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${act.startDate || '??-??-??'} ${act.startTime || '??:??'} - ${act.endTime || '??:??'}${act.description ? ' | ' + act.description : ''}</div>
            </div>
            <button type="button" onclick="window.editTempActivity(${idx})" class="btn-icon" title="Editar"><i class="ph ph-pencil-simple"></i></button>
            <button type="button" onclick="window.removeTempActivity(${idx})" class="btn-icon" style="color:var(--danger);" title="Eliminar"><i class="ph ph-trash"></i></button>
        </div>
    `).join('');
}

window.addTempActivity = () => {
    // Remover formulario previo si existe
    document.getElementById('temp-act-form')?.remove();

    const list = document.getElementById('modal-activities-list');
    const formDiv = document.createElement('div');
    formDiv.id = 'temp-act-form';
    formDiv.style = 'padding:1rem; border:2px solid var(--primary); border-radius:8px; background:#eff6ff; margin-bottom:8px;';
    formDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Nombre</label>
                <input type="text" id="temp-act-name" placeholder="Ej: Caminata" style="padding:0.5rem; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Descripción</label>
                <input type="text" id="temp-act-desc" placeholder="Notas..." style="padding:0.5rem; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Fecha Inicio</label>
                <input type="date" id="temp-act-start-date" style="padding:0.5rem; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Fecha Fin</label>
                <input type="date" id="temp-act-end-date" style="padding:0.5rem; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Hora Inicio</label>
                <input type="time" id="temp-act-start" style="padding:0.5rem; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:600;">Hora Fin</label>
                <input type="time" id="temp-act-end" style="padding:0.5rem; font-size:0.9rem;">
            </div>
        </div>
        <div style="display:flex; gap:8px;">
            <button type="button" id="btn-temp-act-save" class="btn btn-primary" style="flex:1; padding:0.5rem; font-size:0.9rem;">Agregar</button>
            <button type="button" onclick="document.getElementById('temp-act-form')?.remove()" class="btn btn-white" style="flex:1; padding:0.5rem; font-size:0.9rem;">Cancelar</button>
        </div>
    `;

    list.appendChild(formDiv);

    // Focus en el nombre
    document.getElementById('temp-act-name').focus();

    // Evento save
    document.getElementById('btn-temp-act-save').onclick = () => {
        const name = document.getElementById('temp-act-name').value;
        if (!name) return alert('El nombre es obligatorio');

        tempActivities.push({
            id: generateId(),
            name,
            description: document.getElementById('temp-act-desc').value,
            startDate: document.getElementById('temp-act-start-date').value,
            endDate: document.getElementById('temp-act-end-date').value,
            startTime: document.getElementById('temp-act-start').value,
            endTime: document.getElementById('temp-act-end').value,
            eventId: document.getElementById('event-id')?.value || ''
        });

        document.getElementById('temp-act-form')?.remove();
        renderModalActivities();
    };
};

window.editTempActivity = (idx) => {
    const act = tempActivities[idx];
    document.getElementById('temp-act-form')?.remove();

    window.addTempActivity();

    // Rellenar datos
    document.getElementById('temp-act-name').value = act.name || '';
    document.getElementById('temp-act-desc').value = act.description || '';
    document.getElementById('temp-act-start-date').value = act.startDate || '';
    document.getElementById('temp-act-end-date').value = act.endDate || '';
    document.getElementById('temp-act-start').value = act.startTime || '';
    document.getElementById('temp-act-end').value = act.endTime || '';

    // Cambiar botón a "Actualizar"
    const saveBtn = document.getElementById('btn-temp-act-save');
    saveBtn.textContent = 'Actualizar';
    saveBtn.onclick = () => {
        const name = document.getElementById('temp-act-name').value;
        if (!name) return alert('El nombre es obligatorio');

        tempActivities[idx] = {
            ...tempActivities[idx],
            name,
            description: document.getElementById('temp-act-desc').value,
            startDate: document.getElementById('temp-act-start-date').value,
            endDate: document.getElementById('temp-act-end-date').value,
            startTime: document.getElementById('temp-act-start').value,
            endTime: document.getElementById('temp-act-end').value
        };

        document.getElementById('temp-act-form')?.remove();
        renderModalActivities();
    };
};

window.removeTempActivity = (idx) => {
    tempActivities.splice(idx, 1);
    renderModalActivities();
};

window.importActivitiesFromOtherEvent = () => {
    import('./app.js').then(({ dbData }) => {
        const currentEventId = document.getElementById('event-id')?.value || '';
        const otherEvents = dbData.events.filter(e => e.id !== currentEventId);

        if (otherEvents.length === 0) return window.app.showToast('No hay otros eventos');

        // Usamos el mismo patrón que quickCreate: overlay con z-index alto
        let overlay = document.getElementById('import-acts-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'import-acts-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';

        let innerHtml = `
            <div class="modal-content" style="max-width:600px; animation:slideUp 0.2s ease-out;">
                <div class="modal-header">
                    <h3>Importar Actividades de Otro Evento</h3>
                    <button onclick="document.getElementById('import-acts-overlay')?.remove()" class="btn-icon">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
        `;

        let hasActivities = false;
        otherEvents.forEach(evt => {
            const acts = (dbData.activities || []).filter(a => a.eventId === evt.id);
            if (acts.length === 0) return;
            hasActivities = true;

            innerHtml += `
                <div style="margin-bottom:1.5rem;">
                    <div style="font-weight:700; margin-bottom:0.5rem; color:${evt.color || '#a855f7'}; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-calendar"></i> ${evt.name}
                    </div>`;

            acts.forEach(a => {
                innerHtml += `
                    <label style="display:flex; align-items:center; padding:10px; border:1px solid var(--border); border-radius:6px; margin-bottom:4px; cursor:pointer; background:white; transition:background 0.15s;">
                        <input type="checkbox" class="import-act-check"
                            data-name="${a.name}"
                            data-start-date="${a.startDate || ''}"
                            data-end-date="${a.endDate || ''}"
                            data-start="${a.startTime || ''}"
                            data-end="${a.endTime || ''}"
                            data-desc="${a.description || ''}"
                            style="width:1.1rem; height:1.1rem; margin-right:12px; accent-color:var(--primary);">
                        <div>
                            <div style="font-weight:600; font-size:0.9rem;">${a.name}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${a.startDate || '??-??-??'} ${a.startTime || '??:??'} - ${a.endTime || '??:??'}${a.description ? ' | ' + a.description : ''}</div>
                        </div>
                    </label>`;
            });
            innerHtml += '</div>';
        });

        if (!hasActivities) {
            innerHtml += '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No hay actividades en otros eventos para importar.</div>';
        }

        innerHtml += `
                    <button id="btn-import-acts-confirm" class="btn btn-primary" style="width:100%; margin-top:1rem;">
                        <i class="ph ph-copy"></i> Importar Seleccionadas
                    </button>
                </div>
            </div>
        `;

        overlay.innerHTML = innerHtml;
        document.body.appendChild(overlay);

        document.getElementById('btn-import-acts-confirm').onclick = () => {
            const checks = document.querySelectorAll('.import-act-check:checked');
            if (checks.length === 0) {
                window.app.showToast('Selecciona al menos una actividad');
                return;
            }

            checks.forEach(c => {
                tempActivities.push({
                    id: generateId(),
                    name: c.dataset.name,
                    startDate: c.dataset.startDate,
                    endDate: c.dataset.endDate,
                    startTime: c.dataset.start,
                    endTime: c.dataset.end,
                    description: c.dataset.desc,
                    eventId: ''
                });
            });

            overlay.remove();
            renderModalActivities();
            window.app.showToast(`${checks.length} actividades importadas`);
        };
    });
};

// =========================================
// 7. MODAL ACTIVIDAD (Crear/Editar) DESDE DETALLE
// =========================================
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
                    <label>Fecha Inicio</label>
                    <input type="date" id="act-start-date" value="${act.startDate || ''}">
                </div>
                <div class="form-group">
                    <label>Fecha Fin</label>
                    <input type="date" id="act-end-date" value="${act.endDate || ''}">
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
                id: activityId || generateId(),
                eventId: eventId,
                name: document.getElementById('act-name').value,
                startDate: document.getElementById('act-start-date').value,
                endDate: document.getElementById('act-end-date').value,
                startTime: document.getElementById('act-start').value,
                endTime: document.getElementById('act-end').value,
                description: document.getElementById('act-desc').value
            };

            if (!dbData.activities) dbData.activities = [];
            upsert(dbData.activities, newAct);

            await saveActivities(dbData.activities);
            window.app.showToast("Actividad guardada");
            window.app.closeModal();
            window.viewEventDetail(eventId);
        });
    });
};

// =========================================
// 8. ELIMINAR EVENTO / ACTIVIDAD
// =========================================
window.deleteEvent = (id) => {
    window.app.confirm('¿Eliminar Evento?', 'Se borrará el evento y sus actividades. Los items quedarán libres.', 'Eliminar', 'var(--danger)', async () => {
        import('./app.js').then(async ({ dbData }) => {
            dbData.events = dbData.events.filter(e => e.id !== id);
            if (dbData.activities) {
                dbData.activities = dbData.activities.filter(a => a.eventId !== id);
            }
            let itemsModified = false;
            dbData.items.forEach(i => {
                if(i.eventId === id) {
                    i.eventId = null;
                    i.activityIds = [];
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
            dbData.activities = dbData.activities.filter(a => a.id !== actId);
            let itemsModified = false;
            dbData.items.forEach(i => {
                if((i.activityIds || []).includes(actId)) {
                    i.activityIds = i.activityIds.filter(id => id !== actId);
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

// =========================================
// 9. ASIGNAR RECURSOS RÁPIDO (ya existente)
// =========================================
window.assignItemsToActivity = (eventId, activityId) => {
    import('./app.js').then(({ dbData }) => {
        const availableItems = dbData.items.filter(i =>
            (!i.eventId && i.status === 'disponible') ||
            (i.eventId === eventId && (!i.activityIds || i.activityIds.length === 0))
        );

        if(availableItems.length === 0) return window.app.showToast("No hay items disponibles para asignar");

        const html = `
            <div style="margin-bottom:1rem;">
                <div class="search-group" style="margin-bottom:1rem;">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="assign-search" placeholder="Buscar ítems..." style="border:none; background:transparent; width:100%; outline:none;">
                </div>
                <span style="color:var(--text-muted);">Selecciona items para esta actividad:</span>
            </div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
                ${availableItems.map(item => {
                    const label = item.eventId === eventId ? '<span style="color:var(--primary); font-size:0.75rem;">(En Evento General)</span>' : '';
                    return `
                    <label class="assign-item-label" style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white;" data-name="${item.name.toLowerCase()}" data-brand="${(item.brand || '').toLowerCase()}">
                        <input type="checkbox" class="item-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px; accent-color:var(--primary);">
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

        window.app.openModal('Asignar Recursos', html, async () => {});

        // Búsqueda
        const searchInput = document.getElementById('assign-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.assign-item-label').forEach(label => {
                    const name = label.dataset.name || '';
                    const brand = label.dataset.brand || '';
                    label.style.display = (name.includes(term) || brand.includes(term)) ? '' : 'none';
                });
            });
        }

        document.getElementById('btn-assign-confirm').onclick = async () => {
            const checks = document.querySelectorAll('.item-check:checked');
            const ids = Array.from(checks).map(c => c.value);

            if(ids.length === 0) return;

            dbData.items.forEach(item => {
                if(ids.includes(item.id)) {
                    item.eventId = eventId;
                    const current = item.activityIds || [];
                    item.activityIds = [...new Set([...current, activityId])];
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
// 10. GENERADOR DE PDF (CRONOGRAMA)
// =========================================
window.downloadEventPDF = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === eventId);
        const activities = (dbData.activities || [])
            .filter(a => a.eventId === eventId)
            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
        const generalItems = dbData.items.filter(i => i.eventId === eventId && (!i.activityIds || i.activityIds.length === 0));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(event.name, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Fecha: ${event.startDate} al ${event.endDate}`, 14, 30);
        doc.line(14, 35, 196, 35);

        let finalY = 40;

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

        activities.forEach(act => {
            const actItems = dbData.items.filter(i => (i.activityIds || []).includes(act.id));

            if (finalY > 250) { doc.addPage(); finalY = 20; }

            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
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
                    headStyles: { fillColor: [59, 130, 246] },
                    margin: { left: 14 }
                });
                finalY = doc.lastAutoTable.finalY;
            } else {
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text("(Sin recursos asignados)", 14, finalY + 12);
                finalY += 15;
            }
            finalY += 5;
        });

        doc.save(`Cronograma_${event.name.replace(/\s+/g, '_')}.pdf`);
    });
};
