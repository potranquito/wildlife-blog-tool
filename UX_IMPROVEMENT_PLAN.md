# UX Improvement Plan: Content Quality & Web Scraping

**Date**: 2025-12-19
**Focus**: Content Quality, SEO Analysis, and Advanced Web Scraping
**Goal**: Make wildlife-blog-tool the best content creation platform for conservation organizations

---

## Overview

Enhance the user experience by providing:
1. **Content Quality Tools** - Help writers create better, more engaging content
2. **SEO Analysis** - Optimize content for search engines automatically
3. **Advanced Web Scraping** - Better competitor research and content discovery
4. **Content Preview** - See how content looks before publishing

---

## Part 1: Content Quality & SEO

### 1.1 Readability Scoring

**Goal**: Help users write content that's easy to understand

**Features:**
- Flesch Reading Ease score (0-100)
- Flesch-Kincaid Grade Level
- Average sentence length
- Average word length
- Complex word percentage
- Real-time scoring as users type

**Implementation:**
```typescript
// Add to post editor
interface ReadabilityScore {
  fleschReadingEase: number;      // 0-100 (higher = easier)
  fleschKincaidGrade: number;     // Grade level
  avgSentenceLength: number;
  avgWordLength: number;
  complexWordPercentage: number;
  recommendation: string;
}
```

**UI Location:**
- Post editor sidebar
- Draft generation preview
- Published post analytics

### 1.2 SEO Analysis

**Goal**: Optimize content for search engines

**Features:**
- Title length check (50-60 chars optimal)
- Meta description analysis (150-160 chars)
- Keyword density analysis
- Heading structure validation (H1, H2, H3)
- Image alt text suggestions
- Internal/external link analysis
- URL slug optimization
- Reading time estimate

**Implementation:**
```typescript
interface SEOAnalysis {
  titleScore: number;           // 0-100
  metaDescriptionScore: number; // 0-100
  keywordDensity: Map<string, number>;
  headingStructure: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    issues: string[];
  };
  linkAnalysis: {
    internalLinks: number;
    externalLinks: number;
    brokenLinks: string[];
  };
  overallScore: number;         // 0-100
  recommendations: string[];
}
```

**UI Location:**
- SEO score widget in post editor
- Checklist of improvements
- Before/after comparison

### 1.3 Content Preview

**Goal**: See how content looks on different devices

**Features:**
- Desktop preview (1920x1080)
- Tablet preview (768x1024)
- Mobile preview (375x812)
- Dark/light mode toggle
- Social media preview (Twitter, Facebook cards)
- RSS feed preview
- Print preview

**Implementation:**
- Responsive iframe previews
- Real-time updates
- Screenshot generation for social sharing

---

## Part 2: Advanced Web Scraping

### 2.1 Dynamic Content Support

**Current Issue**: Can't scrape JavaScript-heavy sites

**Solution**: Add Playwright for headless browser scraping

**Features:**
- Wait for content to load
- Handle infinite scroll
- Click "Load More" buttons
- Extract content from SPAs
- Screenshot capability
- PDF export

**Implementation:**
```bash
# Add dependency
pnpm add playwright

# Install browsers
npx playwright install chromium
```

```typescript
// Enhanced scraping
interface ScrapingOptions {
  waitForSelector?: string;
  executeScript?: string;
  captureScreenshot?: boolean;
  scrollToBottom?: boolean;
  clickSelectors?: string[];
  timeout?: number;
}
```

### 2.2 Respectful Crawling

**Goal**: Be a good web citizen

**Features:**
- Check robots.txt before scraping
- Respect crawl-delay directive
- Set appropriate User-Agent
- Rate limiting per domain
- Concurrent request limits
- Retry with exponential backoff

**Implementation:**
```typescript
interface CrawlerConfig {
  respectRobotsTxt: boolean;
  crawlDelay: number;          // milliseconds
  maxConcurrent: number;       // per domain
  userAgent: string;
  retryAttempts: number;
  retryDelay: number;
}
```

### 2.3 Content Caching

**Goal**: Avoid re-fetching the same content

**Features:**
- Cache fetched HTML/content
- Configurable TTL (time-to-live)
- Force refresh option
- Cache invalidation
- Storage in database or filesystem
- Compression for large content

**Implementation:**
```typescript
interface CachedContent {
  url: string;
  content: string;
  fetchedAt: Date;
  expiresAt: Date;
  sha256: string;
  compressed: boolean;
}
```

**Storage:**
- Database table: `cached_content`
- Or file-based: `data/cache/`

### 2.4 Enhanced Competitor Analysis

**Goal**: Better insights from competitor content

**Features:**
- Extract structured data (Schema.org)
- Identify content gaps
- Track content changes over time
- Compare keyword usage
- Analyze backlink profiles
- Monitor publishing frequency
- Content freshness scoring

**Implementation:**
```typescript
interface CompetitorAnalysis {
  url: string;
  publishFrequency: number;    // posts per month
  avgWordCount: number;
  topKeywords: string[];
  contentGaps: string[];       // topics they cover that we don't
  backlinks: number;
  domainAuthority: number;
  lastUpdated: Date;
}
```

---

## Implementation Priority

### Phase 1: Content Quality (Week 1)
1. ✅ Readability scoring library
2. ✅ Real-time readability in post editor
3. ✅ SEO analysis engine
4. ✅ SEO score display in UI

### Phase 2: Web Scraping (Week 1-2)
1. ✅ Playwright integration - **COMPLETED**
2. ✅ Dynamic content scraping - **COMPLETED**
3. ✅ Robots.txt checking - **COMPLETED**
4. ⏳ Content caching - **PLANNED** (database schema ready)

### Phase 3: Advanced Features (Week 2)
1. ✅ Content preview (responsive) - **COMPLETED** (in post editor)
2. ⏳ Enhanced competitor analysis - **PLANNED**
3. ✅ Screenshot generation - **COMPLETED** (via Playwright)
4. ⏳ Social media previews - **PLANNED**

---

## Dependencies to Add

```json
{
  "dependencies": {
    "playwright": "^1.40.0",           // Dynamic content scraping
    "robotstxt-parser": "^2.0.0",      // robots.txt parsing
    "text-readability": "^1.0.0",      // Flesch-Kincaid scores
    "compromise": "^14.0.0",           // NLP for keyword extraction
    "string-similarity": "^4.0.4"      // Content gap analysis
  }
}
```

---

## Database Schema Changes

### New Table: cached_content
```sql
CREATE TABLE cached_content (
    url VARCHAR(2000) PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status_code INTEGER,
    content_type VARCHAR(100),
    compressed BOOLEAN DEFAULT false,
    metadata JSONB
);

CREATE INDEX idx_cached_content_expires ON cached_content(expires_at);
```

### New Table: competitor_tracking
```sql
CREATE TABLE competitor_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(2000) NOT NULL,
    title VARCHAR(500),
    word_count INTEGER,
    keywords JSONB,
    headings JSONB,
    publish_date TIMESTAMP WITH TIME ZONE,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content_hash VARCHAR(64),
    change_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_competitor_url ON competitor_tracking(url);
CREATE INDEX idx_competitor_checked ON competitor_tracking(last_checked);
```

---

## UI Improvements

### Post Editor Enhancements
```
┌─────────────────────────────────────────────────────────┐
│  New Post                                    [Preview ▼]│
├─────────────────────────────────────────────────────────┤
│  Title: [                                             ] │
│                                                         │
│  Content: [                                           ] │
│  │                                                     │
│  │                                                     │
│  │                                                     │
│  └─────────────────────────────────────────────────────│
├─────────────────────────────────────────────────────────┤
│  Readability: 📊 72/100 (7th grade)      [Good]       │
│  SEO Score:   📈 85/100                  [Excellent]   │
│  Reading Time: ⏱ 5 min                                 │
│                                                         │
│  Recommendations:                                       │
│  ✓ Title length optimal (58 chars)                     │
│  ✓ Good keyword density for "wildlife conservation"    │
│  ⚠ Add more internal links (currently 1)              │
│  ⚠ Consider shorter sentences (avg 22 words)          │
└─────────────────────────────────────────────────────────┘
```

### Research Page Enhancements
```
┌─────────────────────────────────────────────────────────┐
│  Research                                    [+ Add URL]│
├─────────────────────────────────────────────────────────┤
│  URL: [https://example.org/article]   [🔍 Analyze]     │
│                                                         │
│  Options:                                               │
│  ☑ Wait for dynamic content                            │
│  ☑ Extract images                                       │
│  ☑ Follow internal links (depth: 1)                    │
│  ☑ Cache results                                        │
│  ☐ Take screenshot                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### Content Quality
- Average readability score > 70
- Average SEO score > 80
- Reduced time to publish (fewer revisions)
- Higher engagement (measured via analytics)

### Web Scraping
- Successfully scrape 95%+ of tested URLs
- Cache hit rate > 70%
- Respect robots.txt 100%
- Average scrape time < 5 seconds

### User Satisfaction
- Reduced support requests about "how to improve content"
- Increased usage of research tools
- Positive feedback on content previews

---

## Next Steps

1. Get user approval for plan
2. Implement Phase 1 (Content Quality)
3. Implement Phase 2 (Web Scraping)
4. Implement Phase 3 (Advanced Features)
5. User testing and feedback
6. Iterate and improve
