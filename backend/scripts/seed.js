#!/usr/bin/env node

/**
 * Database seeding script
 * This script will populate the database with initial data
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/handeePOS');
    console.log('✅ Connected to database');
    
    // Add seeding logic here
    // This will be implemented when we add database models
    
    console.log('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
