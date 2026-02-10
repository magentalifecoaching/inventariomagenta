import { saveAreas, saveItems, saveOneArea, deleteOneArea } from './api.js';
import { renderInventory } from './inventory.js';
import { generateId, debounce, upsert } from './utils.js';

export function renderAreasModule(container, data) {
    const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444'];

    container.innerHTML = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú
                </button>
                <div>
                    <h1>Áreas</h1>
                    <p>Gestión de departamentos</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.downloadAreasExcel()" class="btn btn-success">
                    <i class="ph ph-microsoft-excel-logo"></i> Excel
                </button>
                <button onclick="window.modalArea()" class="btn btn-primary">
                    <i class="ph ph-plus-circle"></i> Nueva Área
                </button>
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-group">
                <i class="ph ph-magnifying-glass"></i>
                <input type="text" id="areas-search" placeholder="Buscar áreas por nombre...">
            </div>
        </div>

        <div class="grid-dashboard" id="areas-grid">
            ${data.areas.map((area, index) => {
                const color = colors[index % colors.length];
                const count = data.items.filter(i => i.areaId === area.id).length;

                return `
                <div class="dashboard-card" style="border-top: 4px solid ${color}; position: relative;" data-area-name="${area.name.toLowerCase()}">

                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px;">
                        <button onclick="event.stopPropagation(); window.downloadAreaPDF('${area.id}')" class="btn-icon" title="Descargar PDF" style="color:var(--danger)">
                            <i class="ph ph-file-pdf"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.downloadAreaExcel('${area.id}')" class="btn-icon" title="Descargar Excel" style="color:var(--success)">
                            <i class="ph ph-microsoft-excel-logo"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.modalArea('${area.id}')" class="btn-icon" title="Editar">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteArea('${area.id}')" class="btn-icon" title="Eliminar" style="color:var(--danger)">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>

                    <div onclick="window.viewAreaDetail('${area.id}')" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; padding-top:1rem;">
                        <div class="icon-box" style="background:${color}15; color:${color};">
                            <i class="ph ph-briefcase"></i>
                        </div>
                        <h2 style="font-size:1.3rem; margin-bottom:0.5rem; color:var(--text-main);">${area.name}</h2>
                        <span class="badge" style="background:${color}15; color:${color}; border:1px solid ${color}30;">
                            ${count} items asignados
                        </span>
                    </div>
                </div>
                `;
            }).join('')}
        </div>

        <div id="area-detail-container"></div>
    </div>
    `;

    // Search filter for areas
    const searchInput = document.getElementById('areas-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#areas-grid .dashboard-card').forEach(card => {
                const name = card.dataset.areaName || '';
                card.style.display = name.includes(term) ? '' : 'none';
            });
        }, 150));
    }
}

/* =========================================
   LÓGICA
   ========================================= */

// 1. Descargar Excel
window.downloadAreasExcel = () => {
    import('./app.js').then(({ dbData }) => {
        const dataToExport = dbData.items.filter(i => i.areaId).map(i => ({
            Area: dbData.areas.find(a => a.id === i.areaId)?.name || 'Desconocida',
            Item: i.name,
            Stock: i.stock,
            Estado: i.status,
            Encargado: dbData.people.find(p => p.id === i.personId)?.name || 'N/A'
        }));

        if(dataToExport.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }
        window.app.exportToExcel(dataToExport, 'Reporte_Areas');
    });
};

// 2. Modal Crear / Editar
window.modalArea = (id = null) => {
    import('./app.js').then(({ dbData }) => {
        const area = id ? dbData.areas.find(a => a.id === id) : {};

        const html = `
            <form id="dynamic-form">
                <input type="hidden" id="area-id" value="${area.id || ''}">

                <div class="form-group">
                    <label style="font-size:1rem; margin-bottom:0.5rem;">Nombre del Área</label>
                    <input type="text" id="area-name" value="${area.name || ''}" required
                           placeholder="Ej: Logística, Cocina, Audiovisuales..."
                           style="padding:1rem; font-size:1.1rem;">
                </div>

                <div style="margin-top:2rem;">
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Área
                    </button>
                </div>
            </form>
        `;

        window.app.openModal(id ? 'Editar Área' : 'Nueva Área', html, async () => {
            const newArea = {
                id: document.getElementById('area-id').value || generateId(),
                name: document.getElementById('area-name').value
            };

            upsert(dbData.areas, newArea);
            await saveOneArea(newArea);

            window.app.reloadCurrentView();
        });
    });
};

// 3. Eliminar Área
window.deleteArea = (id) => {
    window.app.confirm(
        '¿Eliminar esta Área?',
        'Los items asignados NO se borrarán, pero quedarán marcados como "Sin Área".',
        'Sí, eliminar',
        'var(--danger)',
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                dbData.areas = dbData.areas.filter(a => a.id !== id);
                await deleteOneArea(id);

                let modified = false;
                dbData.items.forEach(item => {
                    if (item.areaId === id) {
                        item.areaId = "";
                        modified = true;
                    }
                });

                if (modified) await saveItems(dbData.items);

                window.app.reloadCurrentView();
            });
        }
    );
};

// 4. Ver Detalle con botón de importar
window.viewAreaDetail = (id) => {
    import('./app.js').then(({ dbData }) => {
        const area = dbData.areas.find(a => a.id === id);
        if (!area) return;

        const container = document.getElementById('main-layout');

        container.innerHTML = `
        <div class="container">
            <div class="header-bar">
                <div class="title-group">
                    <button onclick="app.showModule('areas')" class="btn btn-white">
                        <i class="ph ph-caret-left"></i> Volver a Áreas
                    </button>
                    <div>
                        <h1>${area.name}</h1>
                        <p>Items: ${dbData.items.filter(i => i.areaId === id).length}</p>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.downloadAreaPDF('${id}')" class="btn btn-white" style="color:var(--danger);">
                        <i class="ph ph-file-pdf"></i> PDF
                    </button>
                    <button onclick="window.downloadAreaExcel('${id}')" class="btn btn-success">
                        <i class="ph ph-microsoft-excel-logo"></i> Excel
                    </button>
                    <button onclick="window.importItemsToArea('${id}')" class="btn btn-white">
                        <i class="ph ph-download-simple"></i> Importar del Inventario
                    </button>
                </div>
            </div>

            <div id="area-inventory-wrapper"></div>
        </div>
        `;

        renderInventory(
            document.getElementById('area-inventory-wrapper'),
            dbData,
            (item) => item.areaId === id
        );

        setTimeout(() => {
            const innerHeader = document.querySelector('#area-inventory-wrapper .header-bar');
            if(innerHeader) innerHeader.style.display = 'none';
        }, 0);
    });
};

// 5. Descargar PDF del inventario de un área
window.downloadAreaPDF = (areaId) => {
    import('./app.js').then(({ dbData }) => {
        const area = dbData.areas.find(a => a.id === areaId);
        if (!area) return;

        const areaItems = dbData.items.filter(i => i.areaId === areaId);
        if (areaItems.length === 0) {
            return window.app.showToast('No hay ítems en esta área para exportar');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(area.name, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Inventario del área - ${areaItems.length} ítems`, 14, 30);
        doc.line(14, 35, 196, 35);

        const rows = areaItems.map(i => [
            i.name,
            i.brand || '-',
            i.stock.toString(),
            i.status || '-',
            i.tracking ? i.tracking.replace('_', ' ') : '-',
            dbData.people.find(p => p.id === i.personId)?.name || '-'
        ]);

        doc.autoTable({
            startY: 40,
            head: [['Ítem', 'Marca', 'Stock', 'Estado', 'Seguimiento', 'Encargado']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 10 }
        });

        doc.save(`Area_${area.name.replace(/\s+/g, '_')}.pdf`);
    });
};

// 6. Descargar Excel del inventario de un área
window.downloadAreaExcel = (areaId) => {
    import('./app.js').then(({ dbData }) => {
        const area = dbData.areas.find(a => a.id === areaId);
        if (!area) return;

        const areaItems = dbData.items.filter(i => i.areaId === areaId);
        if (areaItems.length === 0) {
            return window.app.showToast('No hay ítems en esta área para exportar');
        }

        const exportData = areaItems.map(i => ({
            Nombre: i.name,
            Marca: i.brand || '',
            Stock: i.stock,
            Estado: i.status || '',
            Seguimiento: i.tracking ? i.tracking.replace('_', ' ') : '',
            Encargado: dbData.people.find(p => p.id === i.personId)?.name || ''
        }));

        window.app.exportToExcel(exportData, `Area_${area.name.replace(/\s+/g, '_')}`);
    });
};

// 7. Importar ítems del inventario general a un área
window.importItemsToArea = (areaId) => {
    import('./app.js').then(({ dbData }) => {
        const area = dbData.areas.find(a => a.id === areaId);
        // Ítems sin área asignada
        const availableItems = dbData.items.filter(i => !i.areaId);

        if (availableItems.length === 0) {
            return window.app.showToast('No hay ítems sin área para importar');
        }

        const html = `
            <div style="margin-bottom:1rem;">
                <div class="search-group" style="margin-bottom:1rem;">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="area-import-search" placeholder="Buscar ítems..." style="border:none; background:transparent; width:100%; outline:none;">
                </div>
                <span style="color:var(--text-muted);">Selecciona ítems para asignar a <strong>${area.name}</strong>:</span>
            </div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
                ${availableItems.map(item => `
                    <label class="area-import-label" style="display:flex; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; background:white; transition:background 0.15s;" data-name="${item.name.toLowerCase()}" data-brand="${(item.brand || '').toLowerCase()}">
                        <input type="checkbox" class="area-import-check" value="${item.id}" style="width:1.2rem; height:1.2rem; margin-right:15px; accent-color:var(--primary);">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${item.name}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Stock: ${item.stock} | Marca: ${item.brand || '-'} | Estado: ${item.status}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div style="margin-top:1.5rem;">
                <button id="btn-area-import" class="btn btn-primary" style="width:100%;">
                    <i class="ph ph-download-simple"></i> Asignar al Área
                </button>
            </div>
        `;

        window.app.openModal('Importar al Área', html, () => {});

        // Búsqueda
        const searchInput = document.getElementById('area-import-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.area-import-label').forEach(label => {
                    const name = label.dataset.name || '';
                    const brand = label.dataset.brand || '';
                    label.style.display = (name.includes(term) || brand.includes(term)) ? '' : 'none';
                });
            });
        }

        document.getElementById('btn-area-import').onclick = async () => {
            const checks = document.querySelectorAll('.area-import-check:checked');
            const ids = Array.from(checks).map(c => c.value);
            if (ids.length === 0) return window.app.showToast('Selecciona al menos un ítem');

            dbData.items.forEach(item => {
                if (ids.includes(item.id)) {
                    item.areaId = areaId;
                }
            });

            await saveItems(dbData.items);
            window.app.closeModal();
            window.app.showToast(`${ids.length} ítems asignados al área`);
            window.viewAreaDetail(areaId);
        };
    });
};
