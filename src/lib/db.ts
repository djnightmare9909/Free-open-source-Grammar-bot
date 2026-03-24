import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface GrammarDB extends DBSchema {
  history: {
    key: number;
    value: {
      id?: number;
      originalText: string;
      correctedText: string;
      changes: string[];
      timestamp: number;
    };
    indexes: { 'by-date': number };
  };
  settings: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<GrammarDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<GrammarDB>('grammar-ai-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const historyStore = db.createObjectStore('history', {
            keyPath: 'id',
            autoIncrement: true,
          });
          historyStore.createIndex('by-date', 'timestamp');
        }
        if (oldVersion < 2) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveToHistory(entry: Omit<GrammarDB['history']['value'], 'id'>) {
  const db = await getDB();
  return db.add('history', entry);
}

export async function getHistory() {
  const db = await getDB();
  return db.getAllFromIndex('history', 'by-date');
}

export async function deleteHistoryItem(id: number) {
  const db = await getDB();
  return db.delete('history', id);
}

export async function clearHistory() {
  const db = await getDB();
  return db.clear('history');
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('settings', key);
}

export async function setSetting(key: string, value: any) {
  const db = await getDB();
  return db.put('settings', value, key);
}
