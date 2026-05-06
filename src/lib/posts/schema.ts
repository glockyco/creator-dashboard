import { z } from 'zod';
import { Identity } from '$lib/identities';

export const PostFrontmatter = z.object({
  posted_at: z.string().datetime(),
  author: Identity,
  platform: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  related_sources: z.array(z.string()).default([])
});

export type PostFrontmatter = z.infer<typeof PostFrontmatter>;
