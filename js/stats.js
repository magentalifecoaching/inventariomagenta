import { todayISO } from './utils.js';

// Cache de instancias de Chart para destruirlas antes de re-crear
let chartInstances = [];

function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
}

export function renderStatsModule(container, data) {
    destroyCharts();

    const items = data.items || [];
    const events = data.events || [];
    const areas = data.areas || [];
    const people = data.people || [];
    const suppliers = data.suppliers || [];

    // Single-pass: calcular todas las métricas en una sola iteración
    const byStatus = { disponible: 0, 'en uso': 0, mantenimiento: 0 };
    const byTracking = { conseguido: 0, en_proceso: 0, por_conseguir: 0 };
    const areaCounts = {};
    const personCounts = {};
    let totalStock = 0;

    items.forEach(i => {
        // Status
        if (byStatus.hasOwnProperty(i.status)) byStatus[i.status]++;
        // Tracking
        if (byTracking.hasOwnProperty(i.tracking)) byTracking[i.tracking]++;
        // Area
        if (i.areaId) areaCounts[i.areaId] = (areaCounts[i.areaId] || 0) + 1;
        // Person
        if (i.personId) personCounts[i.personId] = (personCounts[i.personId] || 0) + 1;
        // Stock total
        totalStock += (i.stock || 0);
    });

    // Items por área (con nombre)
    const itemsByArea = {};
    areas.forEach(a => {
        itemsByArea[a.name] = areaCounts[a.id] || 0;
    });

    // Top encargados
    const topPeople = Object.entries(personCounts)
        .map(([id, count]) => ({
            name: people.find(p => p.id === id)?.name || 'Desconocido',
            count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Eventos activos
    const today = todayISO();
    const activeEvents = events.filter(e => e.startDate <= today && e.endDate >= today).length;

    const totalItems = items.length;

    const html = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú Principal
                </button>
                <div>
                    <h1><i class="ph ph-chart-pie" style="color:var(--primary);"></i> Dashboard de Estadísticas</h1>
                    <p>Resumen general del sistema</p>
                </div>
            </div>
        </div>

        <!-- Cards de Resumen -->
        <div class="stats-cards-grid">
            <div class="stats-card">
                <div class="stats-icon" style="background:#eff6ff; color:#3b82f6;">
                    <i class="ph ph-package"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${totalItems}</span>
                    <span class="stats-label">Total Ítems (${totalStock} unidades)</span>
                </div>
            </div>

            <div class="stats-card">
                <div class="stats-icon" style="background:#f0fdf4; color:#22c55e;">
                    <i class="ph ph-check-circle"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${byStatus.disponible}</span>
                    <span class="stats-label">Disponibles</span>
                </div>
            </div>

            <div class="stats-card">
                <div class="stats-icon" style="background:#fefce8; color:#eab308;">
                    <i class="ph ph-clock"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${byStatus['en uso']}</span>
                    <span class="stats-label">En Uso</span>
                </div>
            </div>

            <div class="stats-card">
                <div class="stats-icon" style="background:#fef2f2; color:#ef4444;">
                    <i class="ph ph-wrench"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${byStatus.mantenimiento}</span>
                    <span class="stats-label">Mantenimiento</span>
                </div>
            </div>

            <div class="stats-card">
                <div class="stats-icon" style="background:#faf5ff; color:#a855f7;">
                    <i class="ph ph-calendar-check"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${activeEvents}</span>
                    <span class="stats-label">Eventos Activos</span>
                </div>
            </div>

            <div class="stats-card">
                <div class="stats-icon" style="background:#ecfdf5; color:#10b981;">
                    <i class="ph ph-factory"></i>
                </div>
                <div class="stats-info">
                    <span class="stats-value">${suppliers.length}</span>
                    <span class="stats-label">Proveedores</span>
                </div>
            </div>
        </div>

        <!-- Gráficos -->
        <div class="stats-charts-grid">
            <div class="stats-chart-card">
                <h3><i class="ph ph-chart-donut"></i> Estado de Ítems</h3>
                <div class="chart-container">
                    <canvas id="chart-status"></canvas>
                </div>
            </div>

            <div class="stats-chart-card">
                <h3><i class="ph ph-chart-bar"></i> Ítems por Área</h3>
                <div class="chart-container">
                    <canvas id="chart-areas"></canvas>
                </div>
            </div>

            <div class="stats-chart-card">
                <h3><i class="ph ph-chart-bar-horizontal"></i> Top 5 Encargados</h3>
                <div class="chart-container">
                    <canvas id="chart-people"></canvas>
                </div>
            </div>

            <div class="stats-chart-card">
                <h3><i class="ph ph-magnifying-glass"></i> Seguimiento</h3>
                <div class="chart-container">
                    <canvas id="chart-tracking"></canvas>
                </div>
            </div>
        </div>
    </div>
    `;

    container.innerHTML = html;

    // Renderizar gráficos después de insertar el HTML
    setTimeout(() => {
        renderCharts(byStatus, byTracking, itemsByArea, topPeople);
    }, 100);
}

function renderCharts(byStatus, byTracking, itemsByArea, topPeople) {
    // Chart 1: Estado de ítems (Donut)
    const ctxStatus = document.getElementById('chart-status');
    if (ctxStatus) {
        chartInstances.push(new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Disponible', 'En Uso', 'Mantenimiento'],
                datasets: [{
                    data: [byStatus.disponible, byStatus['en uso'], byStatus.mantenimiento],
                    backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        }));
    }

    // Chart 2: Ítems por Área (Barras)
    const ctxAreas = document.getElementById('chart-areas');
    if (ctxAreas) {
        const areaLabels = Object.keys(itemsByArea);
        const areaValues = Object.values(itemsByArea);

        chartInstances.push(new Chart(ctxAreas, {
            type: 'bar',
            data: {
                labels: areaLabels,
                datasets: [{
                    label: 'Ítems',
                    data: areaValues,
                    backgroundColor: '#3b82f6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        }));
    }

    // Chart 3: Top Encargados (Barras Horizontales)
    const ctxPeople = document.getElementById('chart-people');
    if (ctxPeople) {
        chartInstances.push(new Chart(ctxPeople, {
            type: 'bar',
            data: {
                labels: topPeople.map(p => p.name),
                datasets: [{
                    label: 'Ítems asignados',
                    data: topPeople.map(p => p.count),
                    backgroundColor: '#a855f7',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        }));
    }

    // Chart 4: Seguimiento (Donut)
    const ctxTracking = document.getElementById('chart-tracking');
    if (ctxTracking) {
        chartInstances.push(new Chart(ctxTracking, {
            type: 'doughnut',
            data: {
                labels: ['Conseguido', 'En Proceso', 'Por Conseguir'],
                datasets: [{
                    data: [byTracking.conseguido, byTracking.en_proceso, byTracking.por_conseguir],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        }));
    }
}
