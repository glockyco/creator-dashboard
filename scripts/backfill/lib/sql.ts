import type { MetricPoint } from '../../../src/lib/types/domain';

export function metricInsertSql(rows: MetricPoint[]): string {
  if (rows.length === 0) return '';
  const values = rows.map(
    (row) =>
      `(${sqlString(row.source_id)}, ${sqlString(row.metric)}, ${row.ts}, ${row.value}, ${row.dimensions ? sqlString(JSON.stringify(row.dimensions)) : 'NULL'})`
  );
  return `INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions)\nVALUES\n${values.join(',\n')};`;
}

export function transaction(chunks: string[]): string {
  const body = chunks.filter((chunk) => chunk.trim().length > 0).join('\n');
  return `BEGIN;\n${body}\nCOMMIT;\n`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
