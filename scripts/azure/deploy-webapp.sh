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

: "${AZURE_RESOURCE_GROUP:=wildlife-blogger-rg}"
: "${AZURE_LOCATION:=eastus}"
: "${AZURE_WEBAPP_NAME:=wildlife-blogger-$RANDOM$RANDOM}"
: "${AZURE_RUNTIME:=NODE|22-lts}"
: "${AZURE_SKU:=B1}"

: "${WILDLIFE_BLOGGER_ADMIN_PASSWORD:?Set WILDLIFE_BLOGGER_ADMIN_PASSWORD}"
: "${WILDLIFE_BLOGGER_SESSION_SECRET:?Set WILDLIFE_BLOGGER_SESSION_SECRET}"

echo "Creating resource group: $AZURE_RESOURCE_GROUP ($AZURE_LOCATION)"
az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION" 1>/dev/null

echo "Deploying Web App: $AZURE_WEBAPP_NAME"
az webapp up \
  --name "$AZURE_WEBAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --location "$AZURE_LOCATION" \
  --runtime "$AZURE_RUNTIME" \
  --sku "$AZURE_SKU"

BASE_URL="https://${AZURE_WEBAPP_NAME}.azurewebsites.net"

echo "Setting app settings"
az webapp config appsettings set \
  --name "$AZURE_WEBAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --settings \
  WILDLIFE_BLOGGER_BASE_URL="$BASE_URL" \
  WILDLIFE_BLOGGER_ADMIN_PASSWORD="$WILDLIFE_BLOGGER_ADMIN_PASSWORD" \
  WILDLIFE_BLOGGER_SESSION_SECRET="$WILDLIFE_BLOGGER_SESSION_SECRET" \
  OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
  OPENAI_MODEL="${OPENAI_MODEL:-}" \
  AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-}" \
  AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-}" \
  AZURE_OPENAI_DEPLOYMENT="${AZURE_OPENAI_DEPLOYMENT:-}" \
  AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-}"

echo "Deployed:"
echo "  $BASE_URL"
echo "  Admin login: $BASE_URL/login"
echo "  Blog:        $BASE_URL/blog"

