// Why this exists: registers the exercise files with Astro, so pages can read
// them with types. The schema is shared with the CI validator.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import {
  articleSchema,
  dailySchema,
  exerciseSchema,
  functionSchema,
  mockSchema,
} from "./content/schema.ts";

const exercises = defineCollection({
  loader: glob({ base: "./content/exercises", pattern: "*.yaml" }),
  schema: exerciseSchema,
});

const daily = defineCollection({
  loader: glob({ base: "./content/daily", pattern: "*.yaml" }),
  schema: dailySchema,
});

const mocks = defineCollection({
  loader: glob({ base: "./content/mocks", pattern: "*.yaml" }),
  schema: mockSchema,
});

const functions = defineCollection({
  loader: glob({ base: "./content/functions", pattern: "*.yaml" }),
  schema: functionSchema,
});

const articles = defineCollection({
  loader: glob({ base: "./content/articles", pattern: "*.md" }),
  schema: articleSchema,
});

export const collections = { exercises, daily, mocks, functions, articles };
