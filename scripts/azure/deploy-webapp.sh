#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli" >&2
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Not logged into Azure. Run: az login" >&2
  exit 1
fi

# Configuration
: "${AZURE_RESOURCE_GROUP:=wildlife-blogger-rg}"
: "${AZURE_LOCATION:=eastus}"
: "${AZURE_WEBAPP_NAME:=wildlife-blogger-$RANDOM$RANDOM}"
: "${AZURE_PLAN_NAME:=wildlife-blogger-plan}"
: "${AZURE_RUNTIME:=NODE|22-lts}"
: "${AZURE_SKU:=B1}"

# Database configuration
: "${AZURE_DB_NAME:=wildlife-blogger-db}"
: "${AZURE_DB_SERVER_NAME:=wildlife-blogger-db-$RANDOM$RANDOM}"
: "${AZURE_DB_USERNAME:=wildlifeblogger}"
: "${AZURE_DB_PASSWORD:=$(openssl rand -base64 32)}"
: "${AZURE_DB_SKU:=Standard_B1ms}"
: "${USE_DATABASE:=true}"

# Storage configuration
: "${STORAGE_PROVIDER:=postgres}"
: "${WILDLIFE_BLOGGER_DATA_DIR:=/home/wildlife-blogger-data}"

# Required variables
: "${WILDLIFE_BLOGGER_ADMIN_PASSWORD:?Set WILDLIFE_BLOGGER_ADMIN_PASSWORD}"
: "${WILDLIFE_BLOGGER_SESSION_SECRET:?Set WILDLIFE_BLOGGER_SESSION_SECRET}"

echo "=== Wildlife Blogger Azure Deployment ==="
echo "Resource Group: $AZURE_RESOURCE_GROUP"
echo "Location: $AZURE_LOCATION"
echo "Web App: $AZURE_WEBAPP_NAME"
echo "Storage: $STORAGE_PROVIDER"
if [ "$USE_DATABASE" = "true" ]; then
  echo "Database: $AZURE_DB_SERVER_NAME"
fi
echo ""

# Create resource group
echo "[1/6] Creating resource group: $AZURE_RESOURCE_GROUP"
az group create \
  --name "$AZURE_RESOURCE_GROUP" \
  --location "$AZURE_LOCATION" \
  --output none

# Create PostgreSQL database if enabled
DATABASE_URL=""
if [ "$USE_DATABASE" = "true" ]; then
  echo "[2/6] Creating PostgreSQL Flexible Server: $AZURE_DB_SERVER_NAME"
  echo "  (This may take 5-10 minutes...)"

  # Create PostgreSQL server
  az postgres flexible-server create \
    --name "$AZURE_DB_SERVER_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --location "$AZURE_LOCATION" \
    --admin-user "$AZURE_DB_USERNAME" \
    --admin-password "$AZURE_DB_PASSWORD" \
    --sku-name "$AZURE_DB_SKU" \
    --tier Burstable \
    --version 14 \
    --storage-size 32 \
    --public-access 0.0.0.0 \
    --output none

  # Create database
  echo "  Creating database: $AZURE_DB_NAME"
  az postgres flexible-server db create \
    --server-name "$AZURE_DB_SERVER_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --database-name "$AZURE_DB_NAME" \
    --output none

  # Get connection string
  DB_HOST=$(az postgres flexible-server show \
    --name "$AZURE_DB_SERVER_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query "fullyQualifiedDomainName" -o tsv)

  DATABASE_URL="postgresql://${AZURE_DB_USERNAME}:${AZURE_DB_PASSWORD}@${DB_HOST}:5432/${AZURE_DB_NAME}?sslmode=require"

  echo "  Database ready: $DB_HOST"
else
  echo "[2/6] Skipping database creation (USE_DATABASE=false)"
fi

# Create App Service plan
echo "[3/6] Creating App Service plan: $AZURE_PLAN_NAME"
az appservice plan create \
  --name "$AZURE_PLAN_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --location "$AZURE_LOCATION" \
  --sku "$AZURE_SKU" \
  --is-linux \
  --output none

# Deploy Web App
echo "[4/6] Deploying Web App: $AZURE_WEBAPP_NAME"
az webapp up \
  --name "$AZURE_WEBAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --location "$AZURE_LOCATION" \
  --plan "$AZURE_PLAN_NAME" \
  --runtime "$AZURE_RUNTIME" \
  --sku "$AZURE_SKU" \
  --output none

BASE_URL="https://${AZURE_WEBAPP_NAME}.azurewebsites.net"

# Configure app settings
echo "[5/6] Configuring application settings"
SETTINGS=(
  "SCM_DO_BUILD_DURING_DEPLOYMENT=true"
  "WILDLIFE_BLOGGER_BASE_URL=$BASE_URL"
  "WILDLIFE_BLOGGER_ADMIN_PASSWORD=$WILDLIFE_BLOGGER_ADMIN_PASSWORD"
  "WILDLIFE_BLOGGER_SESSION_SECRET=$WILDLIFE_BLOGGER_SESSION_SECRET"
  "STORAGE_PROVIDER=$STORAGE_PROVIDER"
)

if [ "$USE_DATABASE" = "true" ]; then
  SETTINGS+=("DATABASE_URL=$DATABASE_URL")
else
  SETTINGS+=("WILDLIFE_BLOGGER_DATA_DIR=$WILDLIFE_BLOGGER_DATA_DIR")
fi

# Add optional API keys
if [ -n "${OPENAI_API_KEY:-}" ]; then
  SETTINGS+=("OPENAI_API_KEY=$OPENAI_API_KEY")
fi
if [ -n "${OPENAI_MODEL:-}" ]; then
  SETTINGS+=("OPENAI_MODEL=$OPENAI_MODEL")
fi
if [ -n "${AZURE_OPENAI_ENDPOINT:-}" ]; then
  SETTINGS+=("AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT")
fi
if [ -n "${AZURE_OPENAI_API_KEY:-}" ]; then
  SETTINGS+=("AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY")
fi
if [ -n "${AZURE_OPENAI_DEPLOYMENT:-}" ]; then
  SETTINGS+=("AZURE_OPENAI_DEPLOYMENT=$AZURE_OPENAI_DEPLOYMENT")
fi
if [ -n "${AZURE_OPENAI_API_VERSION:-}" ]; then
  SETTINGS+=("AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION")
fi

az webapp config appsettings set \
  --name "$AZURE_WEBAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --settings "${SETTINGS[@]}" \
  --output none

# Initialize database if enabled
if [ "$USE_DATABASE" = "true" ]; then
  echo "[6/6] Initializing database schema"
  echo "  Running schema migration..."

  # Use psql if available, otherwise skip with warning
  if command -v psql >/dev/null 2>&1; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    psql "$DATABASE_URL" -f "$SCRIPT_DIR/../db/schema.sql" -q
    psql "$DATABASE_URL" -f "$SCRIPT_DIR/../db/seed.sql" -q
    echo "  ✓ Database initialized"
  else
    echo "  ⚠ psql not found - database schema not initialized"
    echo "  Run manually: psql \"\$DATABASE_URL\" -f scripts/db/schema.sql"
  fi
else
  echo "[6/6] Skipping database initialization"
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "URLs:"
echo "  App:         $BASE_URL"
echo "  Admin:       $BASE_URL/login"
echo "  Blog:        $BASE_URL/blog"
echo "  Health:      $BASE_URL/api/health"
echo ""
if [ "$USE_DATABASE" = "true" ]; then
  echo "Database:"
  echo "  Server:      $DB_HOST"
  echo "  Database:    $AZURE_DB_NAME"
  echo "  Username:    $AZURE_DB_USERNAME"
  echo "  Password:    $AZURE_DB_PASSWORD"
  echo ""
  echo "  Connection:  $DATABASE_URL"
  echo ""
  echo "⚠ Save these credentials securely!"
fi
echo ""
echo "Resources created in: $AZURE_RESOURCE_GROUP"
echo ""
