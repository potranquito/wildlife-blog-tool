/**
 * Readability scoring utilities
 *
 * Implements Flesch Reading Ease and Flesch-Kincaid Grade Level
 * to help users write more accessible content.
 */

export interface ReadabilityScore {
  fleschReadingEase: number;      // 0-100 (higher = easier to read)
  fleschKincaidGrade: number;     // U.S. grade level
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
  level: 'very-easy' | 'easy' | 'fairly-easy' | 'standard' | 'fairly-difficult' | 'difficult' | 'very-difficult';
  recommendation: string;
}

/**
 * Count syllables in a word using heuristic approach
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();

  if (word.length <= 3) return 1;

  // Remove common suffixes that don't add syllables
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]{1,2}/g);
  return vowelGroups ? vowelGroups.length : 1;
}

/**
 * Split text into sentences
 */
function getSentences(text: string): string[] {
  // Remove markdown syntax
  text = text.replace(/#{1,6}\s/g, ''); // Headers
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
  text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1'); // Bold/italic
  text = text.replace(/```[\s\S]*?```/g, ''); // Code blocks
  text = text.replace(/`[^`]+`/g, ''); // Inline code

  // Split on sentence boundaries
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Get words from text
 */
function getWords(text: string): string[] {
  // Remove markdown and special characters
  text = text.replace(/#{1,6}\s/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  const words = text
    .toLowerCase()
    .split(/[\s\n\r]+/)
    .filter(w => /[a-z]/.test(w));

  return words;
}

/**
 * Calculate readability score for content
 */
export function calculateReadability(content: string): ReadabilityScore {
  const sentences = getSentences(content);
  const words = getWords(content);

  const totalSentences = Math.max(sentences.length, 1);
  const totalWords = Math.max(words.length, 1);
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const avgSentenceLength = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;

  // Flesch Reading Ease: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  const fleschReadingEase = Math.max(
    0,
    Math.min(
      100,
      206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord
    )
  );

  // Flesch-Kincaid Grade Level: 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
  const fleschKincaidGrade = Math.max(
    0,
    0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59
  );

  // Determine difficulty level
  let level: ReadabilityScore['level'];
  let recommendation: string;

  if (fleschReadingEase >= 90) {
    level = 'very-easy';
    recommendation = 'Excellent! Very easy to read, suitable for all audiences.';
  } else if (fleschReadingEase >= 80) {
    level = 'easy';
    recommendation = 'Great! Easy to read, suitable for most readers.';
  } else if (fleschReadingEase >= 70) {
    level = 'fairly-easy';
    recommendation = 'Good! Fairly easy to read, accessible to general audiences.';
  } else if (fleschReadingEase >= 60) {
    level = 'standard';
    recommendation = 'Standard readability. Consider simplifying some sentences.';
  } else if (fleschReadingEase >= 50) {
    level = 'fairly-difficult';
    recommendation = 'Fairly difficult. Try using shorter sentences and simpler words.';
  } else if (fleschReadingEase >= 30) {
    level = 'difficult';
    recommendation = 'Difficult to read. Simplify your writing for better accessibility.';
  } else {
    level = 'very-difficult';
    recommendation = 'Very difficult. This may be too complex for most readers.';
  }

  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    totalWords,
    totalSentences,
    totalSyllables,
    level,
    recommendation
  };
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(content: string): number {
  const words = getWords(content);
  const wordsPerMinute = 200; // Average reading speed
  return Math.ceil(words.length / wordsPerMinute);
}
