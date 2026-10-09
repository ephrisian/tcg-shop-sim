// --- DATABASE LAYER (IndexedDB) ---
export const DB_NAME = 'TCG_Sim_DB';
export const DB_VERSION = 1;
export const STORE_CARDS = 'cards';
export const STORE_SETS = 'sets';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        const cardStore = db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
        cardStore.createIndex('setId', 'setId', { unique: false });
        cardStore.createIndex('rarity', 'rarity', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETS)) {
        db.createObjectStore(STORE_SETS, { keyPath: 'id' });
      }
    };
  });
};

export const idbPutAll = async (storeName: string, items: any[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const idbPutSetPackage = async (set: { id: string }, cards: { id: string }[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SETS, STORE_CARDS], 'readwrite');
    const setStore = tx.objectStore(STORE_SETS);
    const existingRequest = setStore.get(set.id);
    let immutableSetError: Error | null = null;
    existingRequest.onsuccess = () => {
      if (existingRequest.result) {
        immutableSetError = new Error('This set package has already been imported; set definitions are immutable.');
        tx.abort();
        return;
      }
      setStore.add(set);
      const cardStore = tx.objectStore(STORE_CARDS);
      cards.forEach(card => cardStore.put(card));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(immutableSetError || tx.error || new Error('Set package import was cancelled.'));
  });
};

export const idbUpdateSetProducts = async (setId: string, products: unknown[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETS, 'readwrite');
    const store = tx.objectStore(STORE_SETS);
    const request = store.get(setId);
    let updateError: Error | null = null;
    request.onsuccess = () => {
      if (!request.result) {
        updateError = new Error(`Cannot update packaging: set "${setId}" is no longer available.`);
        tx.abort();
        return;
      }
      store.put({ ...request.result, products });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(updateError || tx.error || new Error('Packaging update was cancelled.'));
  });
};

export const idbGetAllByIndex = async (storeName: string, indexName: string, value: string): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbGetAll = async (storeName: string): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbResetCatalog = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SETS, STORE_CARDS], 'readwrite');
    tx.objectStore(STORE_SETS).clear();
    tx.objectStore(STORE_CARDS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Catalog reset was cancelled.'));
  });
};
