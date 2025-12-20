/**
 * SEO analysis utilities
 *
 * Analyzes content for search engine optimization
 * and provides actionable recommendations.
 */

export interface SEOAnalysis {
  titleScore: number;           // 0-100
  metaDescriptionScore: number; // 0-100
  contentScore: number;         // 0-100
  keywordScore: number;         // 0-100
  structureScore: number;       // 0-100
  overallScore: number;         // 0-100
  recommendations: string[];
  warnings: string[];
  passed: string[];
  details: {
    title: TitleAnalysis;
    metaDescription: MetaDescriptionAnalysis;
    keywords: KeywordAnalysis;
    structure: ContentStructure;
    links: LinkAnalysis;
  };
}

interface TitleAnalysis {
  length: number;
  score: number;
  optimal: boolean;
  issues: string[];
}

interface MetaDescriptionAnalysis {
  length: number;
  score: number;
  optimal: boolean;
  issues: string[];
}

interface KeywordAnalysis {
  primary: string[];
  density: Map<string, number>;
  overused: string[];
  underused: string[];
  score: number;
}

interface ContentStructure {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
  averageParagraphLength: number;
  hasImages: boolean;
  imageCount: number;
  score: number;
  issues: string[];
}

interface LinkAnalysis {
  internalLinks: number;
  externalLinks: number;
  totalLinks: number;
  score: number;
  issues: string[];
}

/**
 * Extract headings from markdown
 */
function extractHeadings(content: string): { h1: string[]; h2: string[]; h3: string[] } {
  const h1 = content.match(/^# (.+)$/gm)?.map(h => h.replace(/^# /, '')) || [];
  const h2 = content.match(/^## (.+)$/gm)?.map(h => h.replace(/^## /, '')) || [];
  const h3 = content.match(/^### (.+)$/gm)?.map(h => h.replace(/^### /, '')) || [];
  return { h1, h2, h3 };
}

/**
 * Extract links from markdown
 */
function extractLinks(content: string): { text: string; url: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: { text: string; url: string }[] = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }

  return links;
}

/**
 * Get word frequency
 */
function getWordFrequency(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3); // Ignore short words

  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return frequency;
}

/**
 * Analyze title
 */
function analyzeTitle(title: string, keywords: string[]): TitleAnalysis {
  const length = title.length;
  const issues: string[] = [];
  let score = 100;

  // Optimal length: 50-60 characters
  if (length < 30) {
    issues.push('Title is too short (< 30 chars)');
    score -= 20;
  } else if (length < 50) {
    issues.push('Title could be longer (optimal: 50-60 chars)');
    score -= 10;
  } else if (length > 70) {
    issues.push('Title may be truncated in search results (> 70 chars)');
    score -= 20;
  } else if (length > 60) {
    issues.push('Title is slightly long (optimal: 50-60 chars)');
    score -= 5;
  }

  // Check for primary keyword
  const titleLower = title.toLowerCase();
  const hasKeyword = keywords.some(kw => titleLower.includes(kw.toLowerCase()));
  if (!hasKeyword && keywords.length > 0) {
    issues.push('Title should include primary keyword');
    score -= 30;
  }

  const optimal = length >= 50 && length <= 60 && hasKeyword;

  return { length, score: Math.max(0, score), optimal, issues };
}

/**
 * Analyze meta description
 */
function analyzeMetaDescription(description: string | undefined, keywords: string[]): MetaDescriptionAnalysis {
  const issues: string[] = [];
  let score = 100;

  if (!description) {
    return {
      length: 0,
      score: 0,
      optimal: false,
      issues: ['Missing meta description']
    };
  }

  const length = description.length;

  // Optimal length: 150-160 characters
  if (length < 120) {
    issues.push('Meta description is too short (< 120 chars)');
    score -= 20;
  } else if (length < 150) {
    issues.push('Meta description could be longer (optimal: 150-160 chars)');
    score -= 10;
  } else if (length > 170) {
    issues.push('Meta description may be truncated (> 170 chars)');
    score -= 20;
  } else if (length > 160) {
    issues.push('Meta description is slightly long (optimal: 150-160 chars)');
    score -= 5;
  }

  // Check for primary keyword
  const descLower = description.toLowerCase();
  const hasKeyword = keywords.some(kw => descLower.includes(kw.toLowerCase()));
  if (!hasKeyword && keywords.length > 0) {
    issues.push('Meta description should include primary keyword');
    score -= 30;
  }

  const optimal = length >= 150 && length <= 160 && hasKeyword;

  return { length, score: Math.max(0, score), optimal, issues };
}

/**
 * Analyze content structure
 */
function analyzeStructure(content: string): ContentStructure {
  const headings = extractHeadings(content);
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const images = content.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  const issues: string[] = [];
  let score = 100;

  // Check H1 count (should have exactly 1)
  if (headings.h1.length === 0) {
    issues.push('Missing H1 heading');
    score -= 30;
  } else if (headings.h1.length > 1) {
    issues.push('Multiple H1 headings found (should have only 1)');
    score -= 20;
  }

  // Check for H2 headings
  if (headings.h2.length === 0) {
    issues.push('No H2 headings found (add section headings)');
    score -= 20;
  } else if (headings.h2.length < 3) {
    issues.push('Consider adding more H2 headings to structure content');
    score -= 10;
  }

  // Check paragraph length
  const avgParaLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / Math.max(paragraphs.length, 1);
  if (avgParaLength > 500) {
    issues.push('Paragraphs are too long (consider breaking them up)');
    score -= 15;
  }

  // Check for images
  if (images.length === 0) {
    issues.push('No images found (add visual content)');
    score -= 10;
  }

  return {
    h1Count: headings.h1.length,
    h2Count: headings.h2.length,
    h3Count: headings.h3.length,
    paragraphCount: paragraphs.length,
    averageParagraphLength: Math.round(avgParaLength),
    hasImages: images.length > 0,
    imageCount: images.length,
    score: Math.max(0, score),
    issues
  };
}

/**
 * Analyze keywords
 */
function analyzeKeywords(content: string, targetKeywords: string[]): KeywordAnalysis {
  const contentLower = content.toLowerCase();
  const wordFreq = getWordFrequency(contentLower);
  const totalWords = content.split(/\s+/).length;

  const density = new Map<string, number>();
  const overused: string[] = [];
  const underused: string[] = [];

  for (const keyword of targetKeywords) {
    const keywordLower = keyword.toLowerCase();
    const count = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
    const densityPercent = (count / totalWords) * 100;

    density.set(keyword, densityPercent);

    // Optimal density: 0.5% - 2.5%
    if (densityPercent > 3) {
      overused.push(keyword);
    } else if (densityPercent < 0.3 && count > 0) {
      underused.push(keyword);
    }
  }

  let score = 100;
  if (overused.length > 0) score -= 20;
  if (underused.length > 0) score -= 10;
  if (targetKeywords.length > 0 && Array.from(density.values()).every(d => d === 0)) {
    score -= 50; // No target keywords found
  }

  return {
    primary: targetKeywords,
    density,
    overused,
    underused,
    score: Math.max(0, score)
  };
}

/**
 * Analyze links
 */
function analyzeLinks(content: string, baseUrl?: string): LinkAnalysis {
  const links = extractLinks(content);
  const issues: string[] = [];
  let score = 100;

  const internalLinks = links.filter(l =>
    l.url.startsWith('/') ||
    l.url.startsWith('#') ||
    (baseUrl && l.url.startsWith(baseUrl))
  ).length;

  const externalLinks = links.length - internalLinks;

  // Check for sufficient internal linking
  if (internalLinks === 0) {
    issues.push('Add internal links to other pages');
    score -= 20;
  } else if (internalLinks < 2) {
    issues.push('Consider adding more internal links');
    score -= 10;
  }

  // Check for external links
  if (externalLinks === 0) {
    issues.push('Consider adding authoritative external links');
    score -= 10;
  }

  return {
    internalLinks,
    externalLinks,
    totalLinks: links.length,
    score: Math.max(0, score),
    issues
  };
}

/**
 * Perform complete SEO analysis
 */
export function analyzeSEO(
  title: string,
  summary: string,
  seoDescription: string | undefined,
  content: string,
  keywords: string[],
  baseUrl?: string
): SEOAnalysis {
  const titleAnalysis = analyzeTitle(title, keywords);
  const metaAnalysis = analyzeMetaDescription(seoDescription, keywords);
  const structureAnalysis = analyzeStructure(content);
  const keywordAnalysis = analyzeKeywords(content, keywords);
  const linkAnalysis = analyzeLinks(content, baseUrl);

  // Calculate scores
  const titleScore = titleAnalysis.score;
  const metaDescriptionScore = metaAnalysis.score;
  const structureScore = structureAnalysis.score;
  const keywordScore = keywordAnalysis.score;
  const contentScore = (structureScore + keywordScore) / 2;

  // Overall score (weighted average)
  const overallScore = Math.round(
    titleScore * 0.25 +
    metaDescriptionScore * 0.15 +
    contentScore * 0.35 +
    keywordScore * 0.15 +
    linkAnalysis.score * 0.10
  );

  // Collect recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];
  const passed: string[] = [];

  // Title recommendations
  if (titleAnalysis.optimal) {
    passed.push('Title length is optimal');
  } else {
    recommendations.push(...titleAnalysis.issues);
  }

  // Meta description recommendations
  if (metaAnalysis.optimal) {
    passed.push('Meta description length is optimal');
  } else {
    recommendations.push(...metaAnalysis.issues);
  }

  // Structure recommendations
  recommendations.push(...structureAnalysis.issues);

  // Keyword recommendations
  if (keywordAnalysis.overused.length > 0) {
    warnings.push(`Keyword stuffing detected: ${keywordAnalysis.overused.join(', ')}`);
  }
  if (keywordAnalysis.underused.length > 0) {
    recommendations.push(`Consider using these keywords more: ${keywordAnalysis.underused.join(', ')}`);
  }

  // Link recommendations
  recommendations.push(...linkAnalysis.issues);

  return {
    titleScore,
    metaDescriptionScore,
    contentScore,
    keywordScore,
    structureScore,
    overallScore,
    recommendations: recommendations.filter(Boolean),
    warnings: warnings.filter(Boolean),
    passed: passed.filter(Boolean),
    details: {
      title: titleAnalysis,
      metaDescription: metaAnalysis,
      keywords: keywordAnalysis,
      structure: structureAnalysis,
      links: linkAnalysis
    }
  };
}
