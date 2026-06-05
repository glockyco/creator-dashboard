import { z } from 'zod';
import type { EventRow } from '$lib/types/domain';
import { fetchJson } from '../http';

const CommentPage = z.object({
  success: z.boolean(),
  start: z.number().int().optional(),
  pagesize: z.union([z.string(), z.number()]),
  total_count: z.number().int(),
  comments_html: z.string()
});

export type SteamGuideCommentsResult = {
  totalCount: number;
  comments: EventRow[];
};

export async function fetchSteamGuideComments({
  creator,
  publishedfileid,
  pageSize = 50,
  maxPages = 20
}: {
  creator: string;
  publishedfileid: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<SteamGuideCommentsResult> {
  const comments: EventRow[] = [];
  let totalCount = 0;
  let start = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const body = new URLSearchParams({ start: String(start), totalcount: String(totalCount), count: String(pageSize) });
    const data = await fetchJson(
      `https://steamcommunity.com/comment/PublishedFile_Public/render/${creator}/${publishedfileid}/`,
      { method: 'POST', body, schema: CommentPage }
    );
    if (!data.success) throw new Error(`Steam comments for guide ${publishedfileid} were not returned successfully`);

    totalCount = data.total_count;
    const parsedPageSize = Number(data.pagesize);
    const step = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : pageSize;
    const expectedPageCount = Math.max(0, Math.min(step, totalCount - start));
    const pageCommentBlocks = commentStarts(data.comments_html).length;
    const pageComments = parseSteamGuideComments(data.comments_html, publishedfileid);
    if (expectedPageCount > 0 && pageCommentBlocks === 0)
      throw new Error(`Steam comments for guide ${publishedfileid} could not be parsed`);
    if (pageComments.length !== pageCommentBlocks || pageComments.length !== expectedPageCount)
      throw new Error(`Steam comments for guide ${publishedfileid} could not be parsed`);
    comments.push(...pageComments);

    start += step;
    if (totalCount === 0 || start >= totalCount) return { totalCount, comments };
  }

  throw new Error(`Steam comments for guide ${publishedfileid} exceeded ${maxPages} pages`);
}

export function parseSteamGuideComments(html: string, publishedfileid: string): EventRow[] {
  const starts = commentStarts(html);

  return starts.flatMap((start, index) => {
    const block = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const timestamp = /data-timestamp="(\d+)"/.exec(block)?.[1];
    const bodyMatch = /<div\b(?=[^>]*\bclass="[^"]*\bcommentthread_comment_text\b[^"]*")[^>]*>([\s\S]*?)<\/div>/.exec(
      block
    );
    if (!timestamp || !bodyMatch) return [];

    const authorMatch =
      /<a\b(?=[^>]*\bclass="[^"]*\bcommentthread_author_link\b[^"]*")(?=[^>]*\bhref="([^"]+)")[^>]*>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/.exec(
        block
      );
    const authorUrl = authorMatch ? decodeHtml(authorMatch[1]) : null;

    return [
      {
        source_id: '',
        external_id: start.id,
        ts: Number(timestamp) * 1000,
        kind: 'steam_guide_comment',
        author: authorMatch ? normalizePlainText(authorMatch[2]) : null,
        title: 'Steam guide comment',
        body: normalizePlainText(bodyMatch[1]),
        url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedfileid}#comment_${start.id}`,
        metadata: authorUrl ? { author_url: authorUrl, publishedfileid } : { publishedfileid }
      }
    ];
  });
}

function commentStarts(html: string): { index: number; id: string }[] {
  return [
    ...html.matchAll(/<div\b(?=[^>]*\bclass="[^"]*\bcommentthread_comment\b[^"]*")(?=[^>]*\bid="comment_(\d+)")[^>]*>/g)
  ].map((match) => ({ index: match.index ?? 0, id: match[1] }));
}

function normalizePlainText(html: string): string {
  return decodeHtml(html.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos') return "'";
    if (code === 'nbsp') return ' ';

    const lower = code.toLowerCase();
    const radix = lower.startsWith('#x') ? 16 : 10;
    const numeric = lower.startsWith('#x') ? code.slice(2) : code.slice(1);
    const point = Number.parseInt(numeric, radix);
    if (!Number.isFinite(point)) return entity;

    try {
      return String.fromCodePoint(point);
    } catch {
      return entity;
    }
  });
}
