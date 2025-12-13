import { z } from "zod";
import type { OrganizationProfile } from "@/lib/storage/types";
import { makeSeedProfile } from "@/lib/storage/seed";

export const OrganizationObjectiveSchema = z.enum([
  "education",
  "donations",
  "awareness",
  "news",
  "species-info",
  "habitat-info",
  "advocacy",
  "volunteering"
]);

export const OrgProfileSchema = z.object({
  name: z.string().min(1).max(120),
  website: z.string().trim().url().or(z.literal("")).default(""),
  tagline: z.string().min(1).max(200),
  mission: z.string().min(1).max(2000),
  focusAreas: z.array(z.string().min(1).max(80)).max(30).default([]),
  objectives: z.array(OrganizationObjectiveSchema).max(30).default([]),
  voiceGuidelines: z.string().min(1).max(8000),
  preferredTerms: z.array(z.string().min(1).max(50)).max(100),
  avoidTerms: z.array(z.string().min(1).max(50)).max(100),
  onboardingCompletedAt: z.string().datetime().nullable().default(null)
});

function normalizeStringArray(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function normalizeString(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function looksCustomized(input: Record<string, unknown>, seed: OrganizationProfile) {
  const name = normalizeString(input.name);
  const tagline = normalizeString(input.tagline);
  const mission = normalizeString(input.mission);
  const voiceGuidelines = normalizeString(input.voiceGuidelines);
  const preferredTerms = normalizeStringArray(input.preferredTerms);
  const avoidTerms = normalizeStringArray(input.avoidTerms);

  if (name && name !== seed.name) return true;
  if (tagline && tagline !== seed.tagline) return true;
  if (mission && mission !== seed.mission) return true;
  if (voiceGuidelines && voiceGuidelines !== seed.voiceGuidelines) return true;
  if (preferredTerms.length && !arraysEqual(preferredTerms, seed.preferredTerms)) return true;
  if (avoidTerms.length && !arraysEqual(avoidTerms, seed.avoidTerms)) return true;
  return false;
}

export function normalizeOrgProfile(
  input: unknown,
  opts?: {
    markOnboardingCompleteIfLegacyCustomized?: boolean;
  }
): OrganizationProfile {
  const seed = makeSeedProfile();

  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...seed, ...obj };

  if (obj.onboardingCompletedAt === undefined) {
    merged.onboardingCompletedAt =
      opts?.markOnboardingCompleteIfLegacyCustomized && looksCustomized(obj, seed)
        ? new Date().toISOString()
        : null;
  }

  const parsed = OrgProfileSchema.safeParse(merged);
  return parsed.success ? parsed.data : seed;
}

