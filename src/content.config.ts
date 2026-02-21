import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string().default('Taylor Brooks'),
    date: z.string(),
    readTime: z.string().default('4 min read'),
    category: z.string(),
    image: z.string(),
    imageAlt: z.string().optional(),
  }),
});

export const collections = { blog };
