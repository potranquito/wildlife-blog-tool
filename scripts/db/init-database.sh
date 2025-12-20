#!/usr/bin/env bash
set -euo pipefail

# Initialize PostgreSQL database for Wildlife Blogger
# This script creates the schema and optionally seeds sample data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${DATABASE_URL:?DATABASE_URL environment variable is required}"

echo "Initializing Wildlife Blogger database..."

# Run schema creation
echo "Creating tables..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/schema.sql"

# Ask if user wants to seed data
read -p "Seed sample data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Seeding sample data..."
  psql "$DATABASE_URL" -f "$SCRIPT_DIR/seed.sql"
fi

echo "Database initialization complete!"
echo ""
echo "To use PostgreSQL storage, set:"
echo "  STORAGE_PROVIDER=postgres"
echo "  DATABASE_URL=<your-connection-string>"
