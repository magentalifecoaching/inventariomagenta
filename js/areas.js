import { saveAreas, saveItems } from './api.js';
import { renderInventory } from './inventory.js';

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

        <div class="grid-dashboard">
            ${data.areas.map((area, index) => {
                const color = colors[index % colors.length];
                const count = data.items.filter(i => i.areaId === area.id).length;
                
                return `
                <div class="dashboard-card" style="border-top: 4px solid ${color}; position: relative;">
                    
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px;">
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

// 2. Modal Crear / Editar (Diseño Amplio)
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
                id: document.getElementById('area-id').value || Date.now().toString(),
                name: document.getElementById('area-name').value
            };

            const index = dbData.areas.findIndex(a => a.id === newArea.id);
            if (index >= 0) dbData.areas[index] = newArea;
            else dbData.areas.push(newArea);

            await saveAreas(dbData.areas);
            
            // Recargar vista actual (sin ir al inicio)
            window.app.reloadCurrentView();
        });
    });
};

// 3. Eliminar Área (Con Alerta Bonita)
window.deleteArea = (id) => {
    window.app.confirm(
        '¿Eliminar esta Área?', 
        'Los items asignados NO se borrarán, pero quedarán marcados como "Sin Área".', 
        'Sí, eliminar', 
        'var(--danger)', 
        async () => {
            import('./app.js').then(async ({ dbData }) => {
                // Borrar área
                dbData.areas = dbData.areas.filter(a => a.id !== id);
                await saveAreas(dbData.areas);

                // Limpiar items en cascada
                let modified = false;
                dbData.items.forEach(item => {
                    if (item.areaId === id) {
                        item.areaId = ""; // Dejar vacío
                        modified = true;
                    }
                });

                if (modified) await saveItems(dbData.items);

                window.app.reloadCurrentView();
            });
        }
    );
};

// 4. Ver Detalle (Entrar a la carpeta)
window.viewAreaDetail = (id) => {
    import('./app.js').then(({ dbData }) => {
        const area = dbData.areas.find(a => a.id === id);
        if (!area) return;

        // Cambiamos la vista actual a "detalle de área" para que el botón volver funcione
        // Nota: app.showModule maneja la inyección, aquí personalizamos el contenedor
        
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
            </div>
            
            <div id="area-inventory-wrapper"></div>
        </div>
        `;

        // Renderizar la tabla filtrada
        renderInventory(
            document.getElementById('area-inventory-wrapper'), 
            dbData, 
            (item) => item.areaId === id
        );
        
        // Limpieza visual
        setTimeout(() => {
            const innerHeader = document.querySelector('#area-inventory-wrapper .header-bar');
            if(innerHeader) innerHeader.style.display = 'none';
        }, 0);
    });
};