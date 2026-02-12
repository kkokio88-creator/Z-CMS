-- Migration: Update purchases table schema
-- Created: 2026-02-11
-- Description: Add supplier_name column and remove inbound pricing columns
--
-- This migration:
-- 1. Adds supplier_name column (varchar 200, default '')
-- 2. Removes inbound_price column
-- 3. Removes inbound_total column

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_name varchar(200) DEFAULT '';
ALTER TABLE purchases DROP COLUMN IF EXISTS inbound_price;
ALTER TABLE purchases DROP COLUMN IF EXISTS inbound_total;
