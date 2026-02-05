import { db } from './firebase-config.js';
import { 
    collection, getDocs, doc, writeBatch 
} from "firebase/firestore";

// Nombres de las colecciones en Firestore
const COLLECTIONS = {
    items: 'items',
    areas: 'areas',
    events: 'events',
    people: 'people'
};

// --- LEER DATOS (GET) ---
// Obtiene todas las colecciones y las une en un solo objeto como hacía tu JSON local
export async function getDB() {
    try {
        const [items, areas, events, people] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.items)),
            getDocs(collection(db, COLLECTIONS.areas)),
            getDocs(collection(db, COLLECTIONS.events)),
            getDocs(collection(db, COLLECTIONS.people))
        ]);

        return {
            items: items.docs.map(d => ({ id: d.id, ...d.data() })),
            areas: areas.docs.map(d => ({ id: d.id, ...d.data() })),
            events: events.docs.map(d => ({ id: d.id, ...d.data() })),
            people: people.docs.map(d => ({ id: d.id, ...d.data() }))
        };
    } catch (error) {
        console.error("Error conectando a Firebase:", error);
        alert("Error de conexión. Revisa tu consola.");
        return { items: [], areas: [], events: [], people: [] };
    }
}

// --- GUARDAR DATOS (SYNC) ---
// Función genérica inteligente que sincroniza un array local con una colección de Firestore
async function syncCollection(collectionName, newArray) {
    const batch = writeBatch(db); // Usamos Batch para que sea atómico y rápido
    const colRef = collection(db, collectionName);
    
    // 1. Obtener estado actual de la BD para saber qué borrar
    const snapshot = await getDocs(colRef);
    const dbIds = new Set(snapshot.docs.map(d => d.id));
    const newIds = new Set(newArray.map(item => String(item.id)));

    // 2. Identificar qué borrar (está en BD pero no en el nuevo array)
    snapshot.docs.forEach(docSnap => {
        if (!newIds.has(docSnap.id)) {
            batch.delete(doc(db, collectionName, docSnap.id));
        }
    });

    // 3. Identificar qué agregar o actualizar
    newArray.forEach(item => {
        // Aseguramos que el ID sea string
        const docRef = doc(db, collectionName, String(item.id));
        batch.set(docRef, item); // .set sobreescribe o crea
    });

    // 4. Ejecutar todo junto
    await batch.commit();
}

// Exportamos las funciones con el mismo nombre que antes para no romper el código
export async function saveItems(items) {
    await syncCollection(COLLECTIONS.items, items);
}

export async function saveEvents(events) {
    await syncCollection(COLLECTIONS.events, events);
}

export async function saveAreas(areas) {
    await syncCollection(COLLECTIONS.areas, areas);
}

export async function savePeople(people) {
    await syncCollection(COLLECTIONS.people, people);
}