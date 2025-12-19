export type PostStatus = "DRAFT" | "PUBLISHED";

export type SourceType = "UPLOAD" | "PASTE" | "ORG_URL" | "COMPETITOR_URL";

export type OrganizationObjective =
  | "education"
  | "donations"
  | "awareness"
  | "news"
  | "species-info"
  | "habitat-info"
  | "advocacy"
  | "volunteering";

export type OrganizationProfile = {
  name: string;
  website: string;
  tagline: string;
  mission: string;
  focusAreas: string[];
  objectives: OrganizationObjective[];
  voiceGuidelines: string;
  preferredTerms: string[];
  avoidTerms: string[];
  onboardingCompletedAt: string | null;
};

export type BlogPostMeta = {
  id: string;
  slug: string;
  status: PostStatus;
  title: string;
  subtitle?: string;
  summary: string;
  keywords: string[];
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type BlogPost = BlogPostMeta & {
  contentMarkdown: string;
};

export type KnowledgeSourceMeta = {
  id: string;
  type: SourceType;
  title: string;
  url?: string;
  createdAt: string;
  wordCount: number;
  sha256: string;
};

export type KnowledgeSource = KnowledgeSourceMeta & {
  contentText: string;
};

// Sources Monitor types
export type WatchedSourceType = "RSS" | "HTML";

export type WatchedSource = {
  id: string;
  name: string;
  url: string;
  type: WatchedSourceType;
  enabled: boolean;
  lastFetchedAt: string | null;
  fetchIntervalHours: number;
  createdAt: string;
};

export type FetchedArticle = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  excerpt: string;
  matchedKeywords: string[];
  relevanceScore: number;
  savedToKnowledge: boolean;
};
