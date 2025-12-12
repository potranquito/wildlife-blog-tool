# Deployment

## GitHub (gh CLI)

From the repo root:

```bash
bash scripts/github/publish.sh
```

## Azure App Service (az CLI)

Prereqs:

- `az login`
- A resource group + Web App name (the script can create them)

From the repo root:

```bash
export WILDLIFE_BLOGGER_ADMIN_PASSWORD='...'
export WILDLIFE_BLOGGER_SESSION_SECRET='...'

# Optional (OpenAI)
export OPENAI_API_KEY='...'
export OPENAI_MODEL='gpt-4.1-mini'

bash scripts/azure/deploy-webapp.sh
```

After deployment:

- Public blog: `https://<app>.azurewebsites.net/blog`
- Admin login: `https://<app>.azurewebsites.net/login`

