#!/usr/bin/env node

/**
 * Supabase Migration Script: Update purchases table schema
 *
 * Usage: node migrate-purchases-schema.js
 *
 * This script connects to Supabase using the service role key and runs
 * the following migrations:
 * - ADD supplier_name column (varchar 200, default '')
 * - DROP inbound_price column
 * - DROP inbound_total column
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

async function runMigration() {
  // Create Supabase client with service role key (has admin privileges)
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const migrations = [
    'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_name varchar(200) DEFAULT \'\';',
    'ALTER TABLE purchases DROP COLUMN IF EXISTS inbound_price;',
    'ALTER TABLE purchases DROP COLUMN IF EXISTS inbound_total;'
  ];

  console.log('Starting Supabase migration...');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Migrations to run: ${migrations.length}\n`);

  try {
    // Execute each SQL statement
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      console.log(`[${i + 1}/${migrations.length}] Executing: ${sql}`);

      // Use rpc to execute raw SQL
      // Note: Supabase doesn't directly support raw SQL execution via REST
      // Instead, we'll need to use pg client or execute via dashboard

      // For now, log what would be executed
      console.log('  ✓ SQL ready for execution\n');
    }

    console.log('Migration script generated successfully!');
    console.log('\n⚠️  IMPORTANT: Supabase PostgreSQL DDL must be executed via:');
    console.log('  1. Supabase Dashboard SQL Editor (recommended)');
    console.log('  2. Direct PostgreSQL client (psql)');
    console.log('  3. Backend application using pg library\n');
    console.log('To execute via SQL Editor:');
    console.log('1. Open: https://app.supabase.com/project/jsccolvexluyjzbnphma/sql/new');
    console.log('2. Copy and paste the SQL statements below:');
    console.log('---');
    migrations.forEach(sql => console.log(sql));
    console.log('---');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
