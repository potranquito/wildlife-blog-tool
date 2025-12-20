-- Seed data for Wildlife Blogger
-- This creates initial sample data for a new installation

-- Insert default organization profile
INSERT INTO organization (
    name,
    website,
    tagline,
    mission,
    focus_areas,
    objectives,
    voice_guidelines,
    preferred_terms,
    avoid_terms,
    onboarding_completed_at
) VALUES (
    'Wildlife Conservation Project',
    '',
    'Protecting nature for future generations',
    'We work to conserve wildlife and wild places through science, education, and community engagement.',
    '["wildlife protection", "habitat conservation", "community education"]'::jsonb,
    '["education", "awareness"]'::jsonb,
    'Write in a calm, hopeful, and action-oriented tone. Avoid sensationalism. Focus on solutions and positive impact. Use clear, accessible language suitable for a general audience.',
    '["wildlife", "habitat", "ecosystem", "biodiversity", "conservation"]'::jsonb,
    '["save", "rescue", "crisis", "disaster"]'::jsonb,
    NULL
)
ON CONFLICT DO NOTHING;

-- Insert sample blog post (seed-welcome)
DO $$
DECLARE
    post_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    INSERT INTO posts (
        id,
        slug,
        status,
        title,
        subtitle,
        summary,
        keywords,
        seo_title,
        seo_description,
        published_at
    ) VALUES (
        post_id,
        'welcome-to-wildlife-blogger',
        'PUBLISHED',
        'Welcome to Wildlife Blogger',
        'Your AI-assisted content platform for conservation',
        'Get started with Wildlife Blogger: research, write, and publish compelling conservation stories.',
        '["wildlife blogging", "conservation content", "AI writing"]'::jsonb,
        'Welcome to Wildlife Blogger',
        'AI-assisted content platform for wildlife conservation organizations',
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO post_content (
        post_id,
        content_markdown
    ) VALUES (
        post_id,
        E'# Welcome to Wildlife Blogger

Wildlife Blogger helps you research, draft, and publish high-quality conservation content with AI assistance.

## Getting Started

Use the **Dashboard** to:

1. **Research** competitor content and discover keywords
2. Build a **knowledge base** from your organization''s resources
3. **Generate drafts** using AI (or local templates)
4. **Edit & publish** directly to your blog

## What''s Included

- SEO-optimized blog engine
- Competitor research tools
- Knowledge base management
- AI-powered draft generation
- RSS feed monitoring

Your public blog is available at `/blog`.

## Next Steps

Head to the **Dashboard** to customize your organization profile and start building content.

---

### About Wildlife Blogger

This platform is designed specifically for wildlife conservation organizations. It combines AI assistance with your expertise to create compelling, accurate content that engages supporters and raises awareness.'
    )
    ON CONFLICT (post_id) DO NOTHING;
END $$;
