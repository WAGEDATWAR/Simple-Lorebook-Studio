export const DATABASE_NAME = "lorebook-studio";
export const DATABASE_VERSION = 1;
export const STORE_NAME = "keyval";

export function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

export function openDatabase(name = DATABASE_NAME, version = DATABASE_VERSION) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onblocked = () => reject(new Error("IndexedDB open was blocked by another tab."));
  });
}

export function createIndexedDbBackend(database, storeName = STORE_NAME) {
  function run(mode, operation) {
    return new Promise((resolve, reject) => {
      let result;

      try {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
        }

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
      } catch (error) {
        reject(error);
      }
    });
  }

  return {
    name: "indexeddb",
    async get(key) {
      const value = await run("readonly", (store) => store.get(key));
      return value === undefined ? null : value;
    },
    set(key, value) {
      return run("readwrite", (store) => store.put(value, key));
    },
    remove(key) {
      return run("readwrite", (store) => store.delete(key));
    },
    keys() {
      return run("readonly", (store) => store.getAllKeys());
    }
  };
}
