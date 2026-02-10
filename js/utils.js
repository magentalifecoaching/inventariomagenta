// =========================================
// MÓDULO DE UTILIDADES COMPARTIDAS
// =========================================

/**
 * Genera un ID único usando crypto.randomUUID o fallback
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
}

/**
 * Formatea fecha de "YYYY-MM-DD" a "DD/MM/YYYY"
 */
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

/**
 * Debounce: retrasa la ejecución de fn hasta que pasen ms sin llamadas
 */
export function debounce(fn, ms = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Upsert: inserta o actualiza un elemento en un array por su key
 * Retorna el array modificado (muta el original)
 */
export function upsert(array, item, key = 'id') {
    const idx = array.findIndex(el => el[key] === item[key]);
    if (idx >= 0) {
        array[idx] = item;
    } else {
        array.push(item);
    }
    return array;
}

/**
 * Escapa HTML para prevenir XSS cuando se inyecta en innerHTML
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Deshabilita un botón y muestra estado de carga, retorna función para restaurar
 */
export function setLoading(buttonEl, loadingText = 'Guardando...') {
    if (!buttonEl) return () => {};
    const originalHtml = buttonEl.innerHTML;
    const originalDisabled = buttonEl.disabled;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> ${loadingText}`;
    return () => {
        buttonEl.disabled = originalDisabled;
        buttonEl.innerHTML = originalHtml;
    };
}

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD
 */
export function todayISO() {
    return new Date().toISOString().split('T')[0];
}
