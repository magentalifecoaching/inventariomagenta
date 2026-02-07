import { saveEvents } from './api.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

let currentYear, currentMonth;

export function renderCalendarModule(container, data) {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();

    renderCalendar(container, data);
}

function renderCalendar(container, data) {
    const events = data.events || [];

    const html = `
    <div class="container">
        <div class="header-bar">
            <div class="title-group">
                <button onclick="app.showModule('menu')" class="btn btn-white">
                    <i class="ph ph-caret-left"></i> Menú Principal
                </button>
                <div>
                    <h1><i class="ph ph-calendar" style="color:var(--purple);"></i> Calendario de Eventos</h1>
                    <p>${events.length} eventos registrados</p>
                </div>
            </div>
            <button onclick="window.calendarQuickEvent()" class="btn btn-purple">
                <i class="ph ph-plus-circle"></i> Nuevo Evento
            </button>
        </div>

        <div class="calendar-container">
            <div class="calendar-header">
                <button onclick="window.calendarPrevMonth()" class="btn btn-white">
                    <i class="ph ph-caret-left"></i>
                </button>
                <h2 id="calendar-title">${MONTHS[currentMonth]} ${currentYear}</h2>
                <button onclick="window.calendarNextMonth()" class="btn btn-white">
                    <i class="ph ph-caret-right"></i>
                </button>
            </div>

            <div class="calendar-days-header">
                ${DAYS.map(d => `<div class="calendar-day-name">${d}</div>`).join('')}
            </div>

            <div class="calendar-grid" id="calendar-grid">
                ${generateCalendarGrid(currentYear, currentMonth, events)}
            </div>
        </div>

        <div class="calendar-legend">
            <span><i class="ph ph-circle-fill" style="color:#a855f7;"></i> Eventos</span>
            <span><i class="ph ph-circle-fill" style="color:#22c55e;"></i> Hoy</span>
        </div>
    </div>
    `;

    container.innerHTML = html;
}

function generateCalendarGrid(year, month, events) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Ajustar para que Lunes sea 0
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let html = '';

    // Días vacíos antes del primer día
    for (let i = 0; i < startDay; i++) {
        html += `<div class="calendar-cell empty"></div>`;
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayEvents = getEventsForDay(dateStr, events);

        html += `
        <div class="calendar-cell ${isToday ? 'today' : ''}" onclick="window.calendarDayClick('${dateStr}')">
            <span class="calendar-day-number">${day}</span>
            <div class="calendar-events">
                ${dayEvents.map(e => `
                    <div class="calendar-event-bar" style="background:${e.color || '#a855f7'};"
                         onclick="event.stopPropagation(); window.calendarEventClick('${e.id}')"
                         title="${e.name}">
                        ${e.name.length > 12 ? e.name.substring(0, 12) + '...' : e.name}
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }

    // Días vacíos al final para completar la semana
    const totalCells = startDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remainingCells; i++) {
        html += `<div class="calendar-cell empty"></div>`;
    }

    return html;
}

function getEventsForDay(dateStr, events) {
    return events.filter(e => {
        const start = e.startDate;
        const end = e.endDate;
        return dateStr >= start && dateStr <= end;
    });
}

window.calendarPrevMonth = () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateCalendarView();
};

window.calendarNextMonth = () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateCalendarView();
};

function updateCalendarView() {
    import('./app.js').then(({ dbData }) => {
        const events = dbData.events || [];
        document.getElementById('calendar-title').textContent = `${MONTHS[currentMonth]} ${currentYear}`;
        document.getElementById('calendar-grid').innerHTML = generateCalendarGrid(currentYear, currentMonth, events);
    });
}

window.calendarDayClick = (dateStr) => {
    import('./app.js').then(({ dbData }) => {
        const html = `
            <form id="dynamic-form" class="form-grid">
                <div class="form-group full-width">
                    <label>Nombre del Evento</label>
                    <input type="text" id="event-name" required placeholder="Ej: Conferencia Anual">
                </div>

                <div class="form-group">
                    <label>Fecha Inicio</label>
                    <input type="date" id="event-start" value="${dateStr}" required>
                </div>

                <div class="form-group">
                    <label>Fecha Fin</label>
                    <input type="date" id="event-end" value="${dateStr}" required>
                </div>

                <div class="form-group">
                    <label>Color</label>
                    <input type="color" id="event-color" value="#a855f7">
                </div>

                <div class="form-group full-width" style="margin-top:1rem;">
                    <button type="submit" class="btn btn-purple" style="width:100%; padding:1rem;">
                        Crear Evento
                    </button>
                </div>
            </form>
        `;

        window.app.openModal('Nuevo Evento', html, async () => {
            const newEvent = {
                id: Date.now().toString(),
                name: document.getElementById('event-name').value,
                startDate: document.getElementById('event-start').value,
                endDate: document.getElementById('event-end').value,
                color: document.getElementById('event-color').value
            };

            dbData.events.push(newEvent);
            await saveEvents(dbData.events);

            window.app.showToast("Evento creado exitosamente");
            window.app.closeModal();
            updateCalendarView();
        });
    });
};

window.calendarEventClick = (eventId) => {
    import('./app.js').then(({ dbData }) => {
        const event = dbData.events.find(e => e.id === eventId);
        if (!event) return;

        const html = `
            <div style="text-align:center; padding:1rem;">
                <div style="width:60px; height:60px; background:${event.color || '#a855f7'}; border-radius:12px; margin:0 auto 1rem; display:flex; align-items:center; justify-content:center;">
                    <i class="ph ph-calendar-check" style="font-size:2rem; color:white;"></i>
                </div>
                <h2 style="margin:0 0 0.5rem;">${event.name}</h2>
                <p style="color:var(--text-muted);">
                    <i class="ph ph-calendar"></i> ${formatDate(event.startDate)} - ${formatDate(event.endDate)}
                </p>
                <div style="display:flex; gap:10px; margin-top:1.5rem; justify-content:center;">
                    <button onclick="app.showModule('events')" class="btn btn-primary">
                        <i class="ph ph-eye"></i> Ver Detalles
                    </button>
                    <button onclick="app.closeModal()" class="btn btn-white">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        window.app.openModal('Evento', html, () => {});
    });
};

window.calendarQuickEvent = () => {
    const today = new Date().toISOString().split('T')[0];
    window.calendarDayClick(today);
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}
