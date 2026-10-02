import "server-only";
import conceptData from "@/content/mln111/concepts.json";
import { z } from "zod";
import { MLN_BOOK_INDEX } from "@/lib/mln111-book";
import { resolveMlnConceptSources } from "@/lib/mln111-xray.mjs";

const MlnConceptSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  definition: z.string().trim().min(1).max(800),
  source: z.string().trim().min(1).max(300),
  sourceSectionIds: z.array(z.string().min(1)).min(1),
  sourceUnitTitles: z.array(z.string().min(1)).min(1).optional(),
  searchTerms: z.array(z.string().trim().min(1).max(160)).min(1),
  matchGuidance: z.string().trim().min(1).max(800),
}).strict();

export const MLN_CONCEPTS = resolveMlnConceptSources(z.array(MlnConceptSchema).min(1).parse(conceptData), MLN_BOOK_INDEX);
