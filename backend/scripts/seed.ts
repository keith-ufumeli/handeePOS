import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Store from '../src/models/Store';
import authService from '../src/services/authService';

// Load environment variables
const envFile = process.env['NODE_ENV'] === 'production' ? '.env.prod' : '.env.local';
dotenv.config({ path: envFile });

const seedData = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/handeepos';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Store.deleteMany({});
    console.log('Cleared existing data');

    // Create a test store
    const store = new Store({
      name: 'HandeePOS Demo Store',
      address: {
        street: '123 Main Street',
        city: 'Harare',
        country: 'Zimbabwe',
        postalCode: '00000'
      },
      phoneNumber: '+263 4 123 4567',
      email: 'demo@handeepos.com',
      taxId: 'TAX123456',
      currency: 'USD',
      timezone: 'Africa/Harare',
      receiptSettings: {
        header: 'Thank you for shopping with us!',
        footer: 'Visit us again soon!',
        showLogo: false
      }
    });

    await store.save();
    console.log('Created demo store');

    // Create admin user
    const adminPassword = await authService.hashPassword('Admin123!');
    const admin = new User({
      email: 'admin@handeepos.com',
      passwordHash: adminPassword,
      fullName: 'Admin User',
      phoneNumber: '+263 77 123 4567',
      role: 'admin',
      storeId: store._id
    });

    await admin.save();
    console.log('Created admin user');

    // Create manager user
    const managerPassword = await authService.hashPassword('Manager123!');
    const manager = new User({
      email: 'manager@handeepos.com',
      passwordHash: managerPassword,
      fullName: 'Manager User',
      phoneNumber: '+263 77 234 5678',
      role: 'manager',
      storeId: store._id
    });

    await manager.save();
    console.log('Created manager user');

    // Create cashier user
    const cashierPassword = await authService.hashPassword('Cashier123!');
    const cashier = new User({
      email: 'cashier@handeepos.com',
      passwordHash: cashierPassword,
      fullName: 'Cashier User',
      phoneNumber: '+263 77 345 6789',
      role: 'cashier',
      storeId: store._id
    });

    await cashier.save();
    console.log('Created cashier user');

    // Create inventory user
    const inventoryPassword = await authService.hashPassword('Inventory123!');
    const inventory = new User({
      email: 'inventory@handeepos.com',
      passwordHash: inventoryPassword,
      fullName: 'Inventory User',
      phoneNumber: '+263 77 456 7890',
      role: 'inventory',
      storeId: store._id
    });

    await inventory.save();
    console.log('Created inventory user');

    console.log('\n=== SEED DATA CREATED ===');
    console.log('Store:', store.name);
    console.log('Users created:');
    console.log('- Admin: admin@handeepos.com / Admin123!');
    console.log('- Manager: manager@handeepos.com / Manager123!');
    console.log('- Cashier: cashier@handeepos.com / Cashier123!');
    console.log('- Inventory: inventory@handeepos.com / Inventory123!');
    console.log('\nYou can now test the authentication endpoints!');

  } catch (error) {
    console.error('Seed data creation failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run seed if this file is executed directly
if (require.main === module) {
  seedData();
}

export default seedData;
