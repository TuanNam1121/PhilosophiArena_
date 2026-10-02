import conceptData from "@/content/mln111/concepts.json";

export interface MlnConcept {
  id: string;
  title: string;
  definition: string;
  source: string;
  sourceSectionIds: string[];
  sourceUnitTitles?: string[];
  searchTerms: string[];
  matchGuidance: string;
}

// Client-safe lookup data only. The source index stays inside server modules.
export const MLN_CONCEPTS = conceptData as MlnConcept[];

export const MLN_CONCEPTS_BY_ID = Object.fromEntries(
  MLN_CONCEPTS.map((concept) => [concept.id, concept]),
) as Record<string, MlnConcept>;
