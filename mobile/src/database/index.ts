import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;
let initPromise: Promise<ReturnType<typeof drizzle>> | null = null;

export async function getDatabase() {
  if (db) {
    return db;
  }

  // If initialization is already in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    try {
      // Open SQLite database
      // Use a unique name to avoid conflicts with previous installations
      const dbName = 'handeepos_v2.db';
      let sqlite: SQLite.SQLiteDatabase;
      
      try {
        sqlite = await SQLite.openDatabaseAsync(dbName);
      } catch (openError: any) {
        // If opening fails due to path issues, try to clean up and retry
        if (openError?.message?.includes('non-normal file') || 
            openError?.message?.includes('Could not open database')) {
          console.warn('[DATABASE] Path conflict detected, attempting cleanup...');
          try {
            // Try to delete the problematic database
            await SQLite.deleteDatabaseAsync('handeepos.db');
            // Retry with original name after cleanup
            sqlite = await SQLite.openDatabaseAsync('handeepos.db');
          } catch {
            // If cleanup fails, use a new database name
            console.warn('[DATABASE] Using fallback database name');
            sqlite = await SQLite.openDatabaseAsync(dbName);
          }
        } else {
          throw openError;
        }
      }
      
      // Enable foreign keys
      await sqlite.execAsync('PRAGMA foreign_keys = ON;');
      
      // Create Drizzle instance
      db = drizzle(sqlite, { schema });
      
      // Initialize tables
      await initializeTables(sqlite);
      
      console.log('[DATABASE] Database initialized successfully');
      return db;
    } catch (error) {
      console.error('[DATABASE] Failed to initialize database:', error);
      // Reset promise on error so we can retry
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

async function initializeTables(sqlite: SQLite.SQLiteDatabase) {
  try {
    // Create products table
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        barcode TEXT,
        category_id TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        tax_rate REAL NOT NULL DEFAULT 0,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        unit TEXT NOT NULL DEFAULT 'pcs',
        images TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_synced_at INTEGER,
        server_id TEXT,
        sync_version INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    `);
    // Add sync_version for existing DBs created before this column existed
    try {
      await sqlite.execAsync('ALTER TABLE products ADD COLUMN sync_version INTEGER');
    } catch (alterErr: any) {
      if (!alterErr?.message?.includes('duplicate column')) throw alterErr;
    }

    // Create categories table
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_synced_at INTEGER,
        server_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create orders table
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        cashier_id TEXT NOT NULL,
        customer_id TEXT,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        payments TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        custom_note TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_synced_at INTEGER,
        server_id TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `);

    // Create customers table
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone_number TEXT,
        address TEXT,
        total_spent REAL NOT NULL DEFAULT 0,
        total_orders INTEGER NOT NULL DEFAULT 0,
        last_visit INTEGER,
        notes TEXT,
        loyalty_points INTEGER NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'bronze',
        is_active INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_synced_at INTEGER,
        server_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_customers_server_id ON customers(server_id);
    `);

    // Create sync_queue table
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        collection TEXT NOT NULL,
        document_id TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        timestamp INTEGER NOT NULL,
        device_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_collection ON sync_queue(collection);
    `);
    // Add device_id column for existing DBs that were created before this column existed
    try {
      await sqlite.execAsync('ALTER TABLE sync_queue ADD COLUMN device_id TEXT');
    } catch (alterErr: any) {
      if (!alterErr?.message?.includes('duplicate column')) throw alterErr;
    }

    console.log('[DATABASE] Tables initialized successfully');
  } catch (error) {
    console.error('[DATABASE] Failed to initialize tables:', error);
    throw error;
  }
}

// Helper functions for common database operations
export async function generateId(): Promise<string> {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default getDatabase;
