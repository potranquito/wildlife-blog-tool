# Technical Plan: Storage & Deployment Improvements

**Date**: 2025-12-19
**Priority**: Critical
**Scope**: Storage migration to database + Azure deployment enhancements

---

## 1. Storage & Data Management

### Current State
- File-based JSON/text storage in `data/` directory
- No concurrent edit support
- Difficult to query and scale
- Vulnerable to data loss during deployments

### Target State
- PostgreSQL database as primary storage (production)
- Azure Blob Storage for large text content and uploads
- File-based storage retained for local development
- Database migrations and seeding scripts
- Abstraction layer to support both storage backends

### Implementation Steps

#### 1.1 Database Schema Design
Create tables for:
- `organizations` - org profile data
- `posts` - blog post metadata
- `post_content` - blog post markdown (separate for performance)
- `sources` - knowledge source metadata
- `source_content` - source text content (or Azure Blob reference)
- `watched_sources` - RSS/HTML monitoring config
- `articles` - fetched articles from watched sources

#### 1.2 Storage Abstraction Layer
Create interfaces in `src/lib/storage/`:
- `IStorageProvider` - base interface
- `FileStorageProvider` - current implementation
- `PostgresStorageProvider` - new database implementation
- Factory function to select provider based on env vars

#### 1.3 Database Setup
- Add `pg` (node-postgres) dependency
- Create connection pool management
- Add environment variables:
  - `DATABASE_URL` - PostgreSQL connection string
  - `STORAGE_PROVIDER` - "file" or "postgres"
  - `AZURE_STORAGE_CONNECTION_STRING` - for blob storage

#### 1.4 Migration Scripts
Create `scripts/db/`:
- `init-schema.sql` - table creation
- `migrate-file-to-db.ts` - one-time migration from file storage
- `seed-db.ts` - create starter data

#### 1.5 Azure Blob Integration
For large content (source text, uploads):
- Upload to Azure Blob Storage
- Store blob reference in database
- Implement lazy loading from blob when needed

### Files to Create/Modify
- `src/lib/storage/interfaces.ts` - storage interfaces
- `src/lib/storage/providers/file.ts` - refactor existing code
- `src/lib/storage/providers/postgres.ts` - new database implementation
- `src/lib/storage/providers/azure-blob.ts` - blob storage helper
- `src/lib/storage/factory.ts` - provider selection
- `scripts/db/init-schema.sql` - schema definition
- `scripts/db/migrate-file-to-db.ts` - migration script
- `package.json` - add `pg` and `@azure/storage-blob`

### Testing Strategy
- Unit tests for each storage provider
- Integration tests with real database (Docker container)
- Migration test with sample data
- Performance comparison between file and database

---

## 2. Azure Deployment Enhancements

### Current State
- Basic `az webapp up` deployment
- No persistent storage configuration
- Data stored in app filesystem (lost on redeploy)
- No health monitoring
- No backup strategy

### Target State
- Persistent data storage via Azure File Share or Blob Storage
- Automated database provisioning
- Health monitoring with Application Insights
- Backup and restore procedures
- Zero-downtime deployment strategy

### Implementation Steps

#### 2.1 Azure Resources Setup
Add to deployment script:
- Azure Database for PostgreSQL Flexible Server
- Azure Storage Account (for files/blobs)
- Azure File Share (mount to `/home/wildlife-blogger-data`)
- Application Insights instance

#### 2.2 Deployment Script Improvements
Update `scripts/azure/deploy-webapp.sh`:
- Check for existing resources before creating
- Provision PostgreSQL database
- Create storage account and file share
- Mount file share to Web App
- Run database migrations post-deployment
- Configure Application Insights
- Set up custom domain and SSL (if provided)
- Add deployment slots for staging

#### 2.3 Environment Configuration
Update app settings to include:
- `DATABASE_URL` - PostgreSQL connection string
- `AZURE_STORAGE_CONNECTION_STRING` - blob/file storage
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - monitoring
- `STORAGE_PROVIDER=postgres` - use database in production

#### 2.4 Data Persistence
Two options:

**Option A: Azure File Share (simpler)**
- Mount file share to Web App
- Continue using file storage but on persistent volume
- Easier migration path

**Option B: Full Database + Blob (recommended)**
- Use PostgreSQL for structured data
- Use Blob Storage for large content
- Better scalability and performance

#### 2.5 Health Monitoring
- Add `/api/health` endpoint enhancements:
  - Database connectivity check
  - Blob storage connectivity check
  - AI service availability check
- Configure health check in Azure Web App
- Set up alerts in Application Insights

#### 2.6 Backup Strategy
- Enable automated backups for PostgreSQL
- Implement backup script for blob storage
- Create restore procedure documentation
- Test disaster recovery

### Files to Create/Modify
- `scripts/azure/deploy-webapp.sh` - enhanced deployment
- `scripts/azure/setup-database.sh` - database provisioning
- `scripts/azure/setup-storage.sh` - storage account setup
- `scripts/azure/backup.sh` - backup automation
- `scripts/azure/restore.sh` - restore procedure
- `src/app/api/health/route.ts` - enhanced health checks
- `.azure/config.example` - deployment configuration template

### Azure Resources Created
```
wildlife-blogger-rg/
├── wildlife-blogger-plan (App Service Plan - B1)
├── wildlife-blogger-{random} (Web App)
├── wildlife-blogger-db (PostgreSQL Flexible Server)
├── wildlifebloggerstorage (Storage Account)
│   ├── file-share: app-data
│   └── blob-container: sources
└── wildlife-blogger-insights (Application Insights)
```

### Cost Estimation (USD/month)
- App Service B1: ~$13
- PostgreSQL Flexible Server (Burstable B1ms): ~$12
- Storage Account (LRS, 10GB): ~$0.50
- Application Insights (5GB): Free tier
- **Total: ~$25-30/month**

---

## Implementation Order

### Phase 1: Storage Abstraction (Week 1)
1. Create storage interfaces and factory
2. Refactor existing file storage into provider pattern
3. Add unit tests
4. Verify no breaking changes

### Phase 2: Database Implementation (Week 1-2)
1. Design and create database schema
2. Implement PostgreSQL provider
3. Create migration scripts
4. Test with local PostgreSQL (Docker)

### Phase 3: Azure Blob Integration (Week 2)
1. Implement Azure Blob helper
2. Integrate with storage provider
3. Update upload endpoints
4. Test blob upload/download

### Phase 4: Deployment Script Updates (Week 2-3)
1. Update deploy-webapp.sh with new resources
2. Add database setup script
3. Add storage setup script
4. Test full deployment to Azure

### Phase 5: Monitoring & Backup (Week 3)
1. Enhance health checks
2. Configure Application Insights
3. Create backup/restore scripts
4. Document procedures

### Phase 6: Migration & Cutover (Week 3-4)
1. Test migration from file to database
2. Deploy to staging environment
3. Verify functionality
4. Production cutover
5. Monitor and optimize

---

## Risks & Mitigations

### Risk 1: Data Loss During Migration
**Mitigation**:
- Backup all file-based data before migration
- Test migration script multiple times
- Keep file storage as fallback option

### Risk 2: Increased Costs
**Mitigation**:
- Use minimal SKUs initially (Burstable for DB)
- Monitor costs with Azure Cost Management
- Set up budget alerts

### Risk 3: Breaking Changes
**Mitigation**:
- Use abstraction layer to maintain compatibility
- Comprehensive testing before deployment
- Feature flags for new storage provider

### Risk 4: Deployment Downtime
**Mitigation**:
- Use deployment slots for zero-downtime
- Blue-green deployment strategy
- Quick rollback plan

---

## Success Criteria

1. ✓ Database stores all data reliably
2. ✓ Data persists across deployments
3. ✓ Health checks pass consistently
4. ✓ Backups run automatically
5. ✓ Performance meets or exceeds file storage
6. ✓ No data loss during migration
7. ✓ Deployment script runs without manual intervention
8. ✓ Costs stay within budget ($30/month)

---

## Next Steps

1. Review and approve this plan
2. Set up local development environment with PostgreSQL
3. Begin Phase 1: Storage abstraction
4. Proceed through phases sequentially
