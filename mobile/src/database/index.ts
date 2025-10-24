import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Product from './models/Product';
import Category from './models/Category';
import Order from './models/Order';
import SyncQueue from './models/SyncQueue';

// Create the adapter
const adapter = new SQLiteAdapter({
  schema,
  // Optional: Enable JSI for better performance
  jsi: true,
  // Optional: Enable FTS (Full Text Search) for better search performance
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

// Create the database
const database = new Database({
  adapter,
  modelClasses: [
    Product,
    Category,
    Order,
    SyncQueue,
  ],
});

export default database;
