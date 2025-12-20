-- Wildlife Blogger Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organization profile (single row table)
CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    website VARCHAR(500) DEFAULT '',
    tagline VARCHAR(200) NOT NULL,
    mission TEXT NOT NULL,
    focus_areas JSONB DEFAULT '[]'::jsonb,
    objectives JSONB DEFAULT '[]'::jsonb,
    voice_guidelines TEXT NOT NULL,
    preferred_terms JSONB DEFAULT '[]'::jsonb,
    avoid_terms JSONB DEFAULT '[]'::jsonb,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one organization profile exists
CREATE UNIQUE INDEX organization_singleton ON organization ((id IS NOT NULL));

-- Blog posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    summary TEXT NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    seo_title VARCHAR(100),
    seo_description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_published_at CHECK (
        (status = 'PUBLISHED' AND published_at IS NOT NULL) OR
        (status = 'DRAFT')
    )
);

-- Post content (separate table for performance)
CREATE TABLE post_content (
    post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    content_markdown TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for posts
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_slug ON posts(slug);

-- Knowledge sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('UPLOAD', 'PASTE', 'ORG_URL', 'COMPETITOR_URL')),
    title VARCHAR(500) NOT NULL,
    url VARCHAR(2000),
    word_count INTEGER NOT NULL DEFAULT 0,
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source content (separate table for performance)
CREATE TABLE source_content (
    source_id UUID PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sources
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_created_at ON sources(created_at DESC);
CREATE INDEX idx_sources_sha256 ON sources(sha256);

-- Watched sources (RSS/HTML monitoring)
CREATE TABLE watched_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2000) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('RSS', 'HTML')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    fetch_interval_hours INTEGER NOT NULL DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for watched sources
CREATE INDEX idx_watched_sources_enabled ON watched_sources(enabled);
CREATE INDEX idx_watched_sources_last_fetched ON watched_sources(last_fetched_at);

-- Fetched articles
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES watched_sources(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(2000) NOT NULL UNIQUE,
    published_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    excerpt TEXT,
    matched_keywords JSONB DEFAULT '[]'::jsonb,
    relevance_score DECIMAL(3, 2) NOT NULL DEFAULT 0.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
    saved_to_knowledge BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for articles
CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX idx_articles_relevance_score ON articles(relevance_score DESC);
CREATE INDEX idx_articles_saved ON articles(saved_to_knowledge);
CREATE INDEX idx_articles_url ON articles(url);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON organization
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_content_updated_at BEFORE UPDATE ON post_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_content_updated_at BEFORE UPDATE ON source_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE organization IS 'Organization profile (singleton table - only one row allowed)';
COMMENT ON TABLE posts IS 'Blog posts metadata';
COMMENT ON TABLE post_content IS 'Blog posts content (separated for performance)';
COMMENT ON TABLE sources IS 'Knowledge sources metadata';
COMMENT ON TABLE source_content IS 'Knowledge sources content (separated for performance)';
COMMENT ON TABLE watched_sources IS 'RSS/HTML sources being monitored';
COMMENT ON TABLE articles IS 'Articles fetched from watched sources';
