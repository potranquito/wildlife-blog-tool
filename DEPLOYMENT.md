# Deployment

## Azure App Service + PostgreSQL (Recommended)

This is the recommended production deployment. It provisions:
- Azure Web App (Node.js 22)
- Azure Database for PostgreSQL Flexible Server
- Automatic database initialization

### Prerequisites

- Azure CLI installed (`az`)
- Logged in: `az login`
- PostgreSQL client (optional, for manual schema migration)

### Deploy

From the repo root:

```bash
# Required
export WILDLIFE_BLOGGER_ADMIN_PASSWORD='your-secure-password'
export WILDLIFE_BLOGGER_SESSION_SECRET='your-secret-key-min-32-chars'

# Optional (OpenAI)
export OPENAI_API_KEY='sk-...'
export OPENAI_MODEL='gpt-4.1-mini'

# Optional (Azure OpenAI)
export AZURE_OPENAI_ENDPOINT='https://...'
export AZURE_OPENAI_API_KEY='...'
export AZURE_OPENAI_DEPLOYMENT='...'

# Deploy
bash scripts/azure/deploy-webapp.sh
```

The script will:
1. Create resource group
2. Provision PostgreSQL Flexible Server (takes 5-10 min)
3. Create App Service plan
4. Deploy web app
5. Configure environment variables
6. Initialize database schema

After deployment:
- Public blog: `https://<app>.azurewebsites.net/blog`
- Admin login: `https://<app>.azurewebsites.net/login`
- Health check: `https://<app>.azurewebsites.net/api/health`

**Save the database credentials** shown at the end of deployment!

### Custom Configuration

Override defaults with environment variables:

```bash
export AZURE_RESOURCE_GROUP='my-rg'
export AZURE_LOCATION='westus2'
export AZURE_WEBAPP_NAME='my-wildlife-blog'
export AZURE_DB_SERVER_NAME='my-db-server'
export AZURE_SKU='B2'  # Web App SKU
export AZURE_DB_SKU='Standard_B2s'  # Database SKU
```

### Use File Storage Instead

To deploy without PostgreSQL (uses file storage):

```bash
export USE_DATABASE=false
export STORAGE_PROVIDER=file
bash scripts/azure/deploy-webapp.sh
```

**Note**: File storage data is lost on redeployment. Not recommended for production.

---

## Local Database Setup

For local development with PostgreSQL:

1. Install PostgreSQL 14+
2. Create database:
   ```bash
   createdb wildlife_blogger
   ```
3. Initialize schema:
   ```bash
   export DATABASE_URL='postgresql://localhost/wildlife_blogger'
   bash scripts/db/init-database.sh
   ```
4. Configure environment:
   ```bash
   # .env.local
   STORAGE_PROVIDER=postgres
   DATABASE_URL=postgresql://localhost/wildlife_blogger
   ```

## Migrate from File to Database

If you have existing data in file storage:

```bash
# 1. Set up database (see above)

# 2. Run migration
export DATABASE_URL='postgresql://...'
pnpm tsx scripts/db/migrate-file-to-db.ts

# 3. Update environment
STORAGE_PROVIDER=postgres
```

---

## GitHub Pages (Static Export)

For static site deployment:

```bash
bash scripts/github/publish.sh
```

**Note**: This exports the public blog only. Dashboard functionality requires a server.
