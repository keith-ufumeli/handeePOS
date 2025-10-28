import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Product from './models/Product';
import Category from './models/Category';
import Order from './models/Order';
import SyncQueue from './models/SyncQueue';

let database: Database;

try {
  // Create the adapter
  const adapter = new SQLiteAdapter({
    schema,
    // Use JSI for better performance (will fallback to JS if not available)
    jsi: true,
    // Optional: Enable FTS (Full Text Search) for better search performance
    onSetUpError: (error) => {
      console.error('Database setup error:', error);
    },
  });

  // Create the database
  database = new Database({
    adapter,
    modelClasses: [
      Product,
      Category,
      Order,
      SyncQueue,
    ],
  });
} catch (error) {
  console.warn('WatermelonDB initialization failed, using mock database:', error);
  
  // Fallback mock database
  database = {
    collections: {
      get: () => ({
        query: () => ({
          fetch: () => Promise.resolve([]),
        }),
        create: () => Promise.resolve(),
      }),
    },
    write: (callback: () => Promise<void>) => callback(),
    adapter: {
      schema: {},
    },
  } as any;
}

export default database;
