import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

// --- REFERENCIAS A COLECCIONES ---
const peopleRef = collection(db, "people");
const itemsRef = collection(db, "items");
const areasRef = collection(db, "areas");
const eventsRef = collection(db, "events");
const activitiesRef = collection(db, "activities");
const suppliersRef = collection(db, "suppliers");

// --- CACHE DE IDS POR COLECCIÓN (para detectar eliminados) ---
const knownIds = {
    people: new Set(),
    items: new Set(),
    areas: new Set(),
    events: new Set(),
    activities: new Set(),
    suppliers: new Set()
};

// --- LEER TODO (GET) ---
export async function getDB() {
    try {
        const [pSnap, iSnap, aSnap, eSnap, acSnap, sSnap] = await Promise.all([
            getDocs(peopleRef),
            getDocs(itemsRef),
            getDocs(areasRef),
            getDocs(eventsRef),
            getDocs(activitiesRef),
            getDocs(suppliersRef)
        ]);

        const result = {
            people: pSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            items: iSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            areas: aSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            events: eSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            activities: acSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            suppliers: sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        // Registrar IDs conocidos para poder detectar eliminaciones futuras
        Object.keys(knownIds).forEach(key => {
            knownIds[key] = new Set(result[key].map(item => item.id));
        });

        return result;
    } catch (error) {
        console.error("Error cargando DB:", error);
        return { people: [], items: [], areas: [], events: [], activities: [], suppliers: [] };
    }
}

// --- SYNC: GUARDA Y ELIMINA DOCUMENTOS HUÉRFANOS ---
async function syncCollection(collectionRef, collectionName, dataArray) {
    const currentIds = new Set(dataArray.map(item => item.id));
    const previousIds = knownIds[collectionName];

    const promises = [];

    // Guardar/actualizar documentos actuales
    dataArray.forEach(item => {
        promises.push(setDoc(doc(collectionRef, item.id), item));
    });

    // Eliminar documentos que ya no existen en el array local
    previousIds.forEach(id => {
        if (!currentIds.has(id)) {
            promises.push(deleteDoc(doc(collectionRef, id)));
        }
    });

    await Promise.all(promises);

    // Actualizar cache de IDs
    knownIds[collectionName] = currentIds;
}

// --- GUARDADO COMPLETO (SYNC) - Detecta y elimina huérfanos ---
export async function savePeople(data) { await syncCollection(peopleRef, 'people', data); }
export async function saveItems(data) { await syncCollection(itemsRef, 'items', data); }
export async function saveAreas(data) { await syncCollection(areasRef, 'areas', data); }
export async function saveEvents(data) { await syncCollection(eventsRef, 'events', data); }
export async function saveActivities(data) { await syncCollection(activitiesRef, 'activities', data); }
export async function saveSuppliers(data) { await syncCollection(suppliersRef, 'suppliers', data); }

// --- OPERACIONES ATÓMICAS (un solo documento) ---
export async function saveOneItem(item) {
    await setDoc(doc(itemsRef, item.id), item);
}

export async function deleteOneItem(id) {
    await deleteDoc(doc(itemsRef, id));
    knownIds.items.delete(id);
}

export async function saveOneEvent(event) {
    await setDoc(doc(eventsRef, event.id), event);
}

export async function deleteOneEvent(id) {
    await deleteDoc(doc(eventsRef, id));
    knownIds.events.delete(id);
}

export async function saveOneArea(area) {
    await setDoc(doc(areasRef, area.id), area);
}

export async function deleteOneArea(id) {
    await deleteDoc(doc(areasRef, id));
    knownIds.areas.delete(id);
}

export async function saveOneActivity(activity) {
    await setDoc(doc(activitiesRef, activity.id), activity);
}

export async function deleteOneActivity(id) {
    await deleteDoc(doc(activitiesRef, id));
    knownIds.activities.delete(id);
}

export async function saveOneSupplier(supplier) {
    await setDoc(doc(suppliersRef, supplier.id), supplier);
}

export async function deleteOneSupplier(id) {
    await deleteDoc(doc(suppliersRef, id));
    knownIds.suppliers.delete(id);
}

export async function saveOnePerson(person) {
    await setDoc(doc(peopleRef, person.id), person);
}

export async function deleteOnePerson(id) {
    await deleteDoc(doc(peopleRef, id));
    knownIds.people.delete(id);
}
