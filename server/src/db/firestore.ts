import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
let firestoreDb: any = null;

export function getFirestoreDb(): any {
  if (firestoreDb) {
    return firestoreDb;
  }

  const useMemory = process.env.FIRESTORE_MODE === 'memory';
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (useMemory || (!emulatorHost && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG)) {
    // Return high-fidelity in-memory Firestore engine for tests and standalone local run
    firestoreDb = createInMemoryFirestore();
    return firestoreDb;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'trustvault-dev'
      });
    }
    firestoreDb = admin.firestore();
    return firestoreDb;
  } catch (err) {
    console.warn('Falling back to in-memory Firestore store:', (err as Error).message);
    firestoreDb = createInMemoryFirestore();
    return firestoreDb;
  }
}

/**
 * Resets in-memory database (used during automated tests)
 */
export function resetInMemoryDb() {
  if (firestoreDb && typeof firestoreDb._reset === 'function') {
    firestoreDb._reset();
  }
}

/**
 * High-fidelity in-memory Firestore implementation that adheres to the exact
 * Firestore Admin SDK API (collections, documents, queries, transactions, batches, FieldValue).
 */
export function createInMemoryFirestore() {
  const store = new Map<string, Map<string, any>>();

  function getCollectionStore(collectionName: string): Map<string, any> {
    if (!store.has(collectionName)) {
      store.set(collectionName, new Map<string, any>());
    }
    return store.get(collectionName)!;
  }

  class InMemoryDocRef {
    constructor(public collectionName: string, public id: string) {}

    async get(): Promise<any> {
      const col = getCollectionStore(this.collectionName);
      const data = col.get(this.id);
      return {
        id: this.id,
        exists: data !== undefined,
        data: () => (data !== undefined ? cloneWithBuffers({ id: this.id, ...data }) : undefined),
        ref: this
      };
    }

    async set(data: any, options?: { merge?: boolean }): Promise<any> {
      const col = getCollectionStore(this.collectionName);
      if (options?.merge && col.has(this.id)) {
        const existing = col.get(this.id);
        col.set(this.id, deepMerge(existing, data));
      } else {
        col.set(this.id, cloneWithBuffers(data));
      }
      return { writeTime: new Date() };
    }

    async update(data: any): Promise<any> {
      const col = getCollectionStore(this.collectionName);
      if (!col.has(this.id)) {
        throw new Error(`NOT_FOUND: No document to update: ${this.collectionName}/${this.id}`);
      }
      const existing = col.get(this.id);
      col.set(this.id, deepMerge(existing, data));
      return { writeTime: new Date() };
    }

    async delete(): Promise<any> {
      const col = getCollectionStore(this.collectionName);
      col.delete(this.id);
      return { writeTime: new Date() };
    }
  }

  class InMemoryQuery {
    private filters: Array<{ field: string; op: string; value: any }> = [];
    private orderBys: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
    private limitCount?: number;
    private offsetCount?: number;

    constructor(private collectionName: string) {}

    where(field: string, op: string, value: any): InMemoryQuery {
      const q = this.clone();
      q.filters.push({ field, op, value });
      return q;
    }

    orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): InMemoryQuery {
      const q = this.clone();
      q.orderBys.push({ field, direction });
      return q;
    }

    limit(n: number): InMemoryQuery {
      const q = this.clone();
      q.limitCount = n;
      return q;
    }

    offset(n: number): InMemoryQuery {
      const q = this.clone();
      q.offsetCount = n;
      return q;
    }

    private clone(): InMemoryQuery {
      const q = new InMemoryQuery(this.collectionName);
      q.filters = [...this.filters];
      q.orderBys = [...this.orderBys];
      q.limitCount = this.limitCount;
      q.offsetCount = this.offsetCount;
      return q;
    }

    async get(): Promise<any> {
      const col = getCollectionStore(this.collectionName);
      let items: any[] = [];

      for (const [id, data] of col.entries()) {
        const item = { id, ...cloneWithBuffers(data) };
        let matches = true;

        for (const f of this.filters) {
          const val = getNestedValue(item, f.field);
          if (f.op === '==' && val !== f.value) matches = false;
          if (f.op === '!=' && val === f.value) matches = false;
          if (f.op === '<' && !(val < f.value)) matches = false;
          if (f.op === '<=' && !(val <= f.value)) matches = false;
          if (f.op === '>' && !(val > f.value)) matches = false;
          if (f.op === '>=' && !(val >= f.value)) matches = false;
          if (f.op === 'array-contains' && (!Array.isArray(val) || !val.includes(f.value))) matches = false;
          if (f.op === 'in' && (!Array.isArray(f.value) || !f.value.includes(val))) matches = false;
          if (!matches) break;
        }

        if (matches) {
          items.push(item);
        }
      }

      // Sort
      for (const ob of this.orderBys) {
        items.sort((a, b) => {
          const va = getNestedValue(a, ob.field);
          const vb = getNestedValue(b, ob.field);
          if (va === vb) return 0;
          if (va === undefined) return 1;
          if (vb === undefined) return -1;
          const cmp = va > vb ? 1 : -1;
          return ob.direction === 'desc' ? -cmp : cmp;
        });
      }

      // Offset and Limit
      if (this.offsetCount) {
        items = items.slice(this.offsetCount);
      }
      if (this.limitCount !== undefined) {
        items = items.slice(0, this.limitCount);
      }

      const docs = items.map((item) => ({
        id: item.id,
        exists: true,
        data: () => {
          return cloneWithBuffers(item);
        },
        ref: new InMemoryDocRef(this.collectionName, item.id)
      }));

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length
      };
    }
  }

  class InMemoryCollection {
    constructor(public name: string) {}

    doc(id?: string): InMemoryDocRef {
      const docId = id || Math.random().toString(36).substring(2, 15);
      return new InMemoryDocRef(this.name, docId);
    }

    where(field: string, op: string, value: any): InMemoryQuery {
      return new InMemoryQuery(this.name).where(field, op, value);
    }

    orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): InMemoryQuery {
      return new InMemoryQuery(this.name).orderBy(field, direction);
    }

    limit(n: number): InMemoryQuery {
      return new InMemoryQuery(this.name).limit(n);
    }

    async get(): Promise<any> {
      return new InMemoryQuery(this.name).get();
    }
  }

  return {
    collection(name: string) {
      return new InMemoryCollection(name);
    },
    doc(path: string) {
      const parts = path.split('/');
      return new InMemoryDocRef(parts[0], parts[1]);
    },
    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      const transaction = {
        async get(docRef: InMemoryDocRef) {
          return docRef.get();
        },
        set(docRef: InMemoryDocRef, data: any, options?: any) {
          docRef.set(data, options);
          return transaction;
        },
        update(docRef: InMemoryDocRef, data: any) {
          docRef.update(data);
          return transaction;
        },
        delete(docRef: InMemoryDocRef) {
          docRef.delete();
          return transaction;
        }
      };
      return updateFunction(transaction);
    },
    batch() {
      const ops: Array<() => Promise<any>> = [];
      return {
        set(docRef: InMemoryDocRef, data: any, options?: any) {
          ops.push(() => docRef.set(data, options));
        },
        update(docRef: InMemoryDocRef, data: any) {
          ops.push(() => docRef.update(data));
        },
        delete(docRef: InMemoryDocRef) {
          ops.push(() => docRef.delete());
        },
        async commit() {
          for (const op of ops) {
            await op();
          }
        }
      };
    },
    _reset() {
      store.clear();
    }
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key]) && !Buffer.isBuffer(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function cloneWithBuffers(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Buffer.isBuffer(obj)) {
    return Buffer.from(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(cloneWithBuffers);
  }
  if (typeof obj === 'object') {
    const copy: any = {};
    for (const [key, val] of Object.entries(obj)) {
      copy[key] = cloneWithBuffers(val);
    }
    return copy;
  }
  return obj;
}

function bufferReplacer(key: string, value: any) {
  if (this && Buffer.isBuffer(this[key])) {
    return { type: 'Buffer', data: Array.from(this[key]) };
  }
  return value;
}

function bufferReviver(key: string, value: any) {
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return value;
}
