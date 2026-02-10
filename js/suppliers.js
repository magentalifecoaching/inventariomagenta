import { saveSuppliers, saveOneSupplier, deleteOneSupplier } from './api.js';
import { generateId, debounce, upsert } from './utils.js';

const CATEGORIES = ['Audio', 'Video', 'Iluminación', 'Mobiliario', 'Catering', 'Transporte', 'Personal', 'Otro'];

export function renderSuppliersModule(container, data) {
    const suppliers = data.suppliers || [];

    const categoryOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

    const html = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú Principal
                </button>
                <div>
                    <h1><i class="ph ph-factory" style="color:var(--primary);"></i> Proveedores</h1>
                    <p>${suppliers.length} proveedores registrados</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.downloadSuppliersExcel()" class="btn btn-success">
                    <i class="ph ph-microsoft-excel-logo"></i> Excel
                </button>
                <button onclick="window.modalAddSupplier()" class="btn btn-primary">
                    <i class="ph ph-plus-circle"></i> Nuevo Proveedor
                </button>
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-group">
                <i class="ph ph-magnifying-glass"></i>
                <input type="text" id="filter-supplier-search" placeholder="Buscar por nombre, contacto...">
            </div>

            <select id="filter-supplier-category" class="filter-select">
                <option value="">Todas las Categorías</option>
                ${categoryOptions}
            </select>
        </div>

        <div class="suppliers-grid" id="suppliers-grid">
            ${suppliers.length === 0 ?
                '<div class="empty-state"><i class="ph ph-factory" style="font-size:3rem; color:var(--text-muted);"></i><p>No hay proveedores registrados</p></div>' :
                suppliers.map(s => renderSupplierCard(s)).join('')
            }
        </div>
    </div>
    `;

    container.innerHTML = html;
    setupSupplierFilters();
}

function renderSupplierCard(supplier) {
    const categoryColors = {
        'Audio': '#3b82f6',
        'Video': '#8b5cf6',
        'Iluminación': '#f59e0b',
        'Mobiliario': '#10b981',
        'Catering': '#ef4444',
        'Transporte': '#6366f1',
        'Personal': '#ec4899',
        'Otro': '#64748b'
    };

    const color = categoryColors[supplier.category] || '#64748b';

    return `
    <div class="supplier-card"
         data-name="${(supplier.name || '').toLowerCase()}"
         data-contact="${(supplier.contact || '').toLowerCase()}"
         data-category="${supplier.category || ''}">
        <div class="supplier-card-header" style="border-left: 4px solid ${color};">
            <div class="supplier-category-badge" style="background: ${color}20; color: ${color};">
                ${supplier.category || 'Sin categoría'}
            </div>
            <div class="supplier-actions">
                <button onclick="window.modalAddSupplier('${supplier.id}')" class="btn-icon" title="Editar">
                    <i class="ph ph-pencil-simple" style="color:var(--primary)"></i>
                </button>
                <button onclick="window.deleteSupplier('${supplier.id}')" class="btn-icon" title="Eliminar">
                    <i class="ph ph-trash" style="color:var(--danger)"></i>
                </button>
            </div>
        </div>
        <h3 class="supplier-name">${supplier.name}</h3>
        ${supplier.contact ? `<p class="supplier-contact"><i class="ph ph-user"></i> ${supplier.contact}</p>` : ''}
        ${supplier.phone ? `<p class="supplier-info"><i class="ph ph-phone"></i> ${supplier.phone}</p>` : ''}
        ${supplier.email ? `<p class="supplier-info"><i class="ph ph-envelope"></i> ${supplier.email}</p>` : ''}
        ${supplier.notes ? `<p class="supplier-notes">${supplier.notes}</p>` : ''}
    </div>
    `;
}

function setupSupplierFilters() {
    const searchInput = document.getElementById('filter-supplier-search');
    const categorySelect = document.getElementById('filter-supplier-category');
    const cards = document.querySelectorAll('.supplier-card');

    const filterFn = () => {
        const term = searchInput.value.toLowerCase();
        const category = categorySelect.value;

        cards.forEach(card => {
            const name = card.dataset.name;
            const contact = card.dataset.contact;
            const cardCategory = card.dataset.category;

            const matchText = name.includes(term) || contact.includes(term);
            const matchCategory = category === "" || cardCategory === category;

            card.style.display = (matchText && matchCategory) ? '' : 'none';
        });
    };

    searchInput.addEventListener('keyup', debounce(filterFn, 150));
    categorySelect.addEventListener('change', filterFn);
}

window.modalAddSupplier = (supplierId = null) => {
    import('./app.js').then(({ dbData }) => {
        const supplier = supplierId ? (dbData.suppliers || []).find(s => s.id === supplierId) : {};

        const categoryOptions = CATEGORIES.map(c =>
            `<option value="${c}" ${supplier.category === c ? 'selected' : ''}>${c}</option>`
        ).join('');

        const html = `
            <form id="dynamic-form" class="form-grid">
                <input type="hidden" id="supplier-id" value="${supplier.id || ''}">

                <div class="form-group">
                    <label>Nombre de la Empresa</label>
                    <input type="text" id="supplier-name" value="${supplier.name || ''}" required placeholder="Ej: Sonido Pro S.A.">
                </div>

                <div class="form-group">
                    <label>Persona de Contacto</label>
                    <input type="text" id="supplier-contact" value="${supplier.contact || ''}" placeholder="Ej: Juan Pérez">
                </div>

                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="tel" id="supplier-phone" value="${supplier.phone || ''}" placeholder="Ej: +52 55 1234 5678">
                </div>

                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="supplier-email" value="${supplier.email || ''}" placeholder="Ej: contacto@empresa.com">
                </div>

                <div class="form-group">
                    <label>Categoría</label>
                    <select id="supplier-category">
                        <option value="">-- Seleccionar --</option>
                        ${categoryOptions}
                    </select>
                </div>

                <div class="form-group full-width">
                    <label>Notas</label>
                    <textarea id="supplier-notes" rows="3" style="width:100%; padding:0.75rem; border:1px solid var(--border); border-radius:8px; resize:vertical;">${supplier.notes || ''}</textarea>
                </div>

                <div class="full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">
                        Guardar Proveedor
                    </button>
                </div>
            </form>
        `;

        window.app.openModal(supplierId ? 'Editar Proveedor' : 'Nuevo Proveedor', html, async () => {
            const newSupplier = {
                id: document.getElementById('supplier-id').value || generateId(),
                name: document.getElementById('supplier-name').value,
                contact: document.getElementById('supplier-contact').value,
                phone: document.getElementById('supplier-phone').value,
                email: document.getElementById('supplier-email').value,
                category: document.getElementById('supplier-category').value,
                notes: document.getElementById('supplier-notes').value
            };

            if (!dbData.suppliers) dbData.suppliers = [];

            upsert(dbData.suppliers, newSupplier);
            await saveOneSupplier(newSupplier);

            window.app.showToast("Proveedor guardado exitosamente");
            window.app.closeModal();
            window.app.reloadCurrentView();
        });
    });
};

window.deleteSupplier = (id) => {
    window.app.confirm('¿Eliminar proveedor?', 'No podrás recuperarlo.', 'Eliminar', 'var(--danger)', async () => {
        import('./app.js').then(async ({ dbData }) => {
            dbData.suppliers = (dbData.suppliers || []).filter(s => s.id !== id);
            await deleteOneSupplier(id);
            window.app.showToast("Proveedor eliminado");
            window.app.reloadCurrentView();
        });
    });
};

window.downloadSuppliersExcel = () => {
    import('./app.js').then(({ dbData }) => {
        const exportData = (dbData.suppliers || []).map(s => ({
            Nombre: s.name,
            Contacto: s.contact || '',
            Teléfono: s.phone || '',
            Email: s.email || '',
            Categoría: s.category || '',
            Notas: s.notes || ''
        }));
        window.app.exportToExcel(exportData, 'Proveedores');
    });
};
