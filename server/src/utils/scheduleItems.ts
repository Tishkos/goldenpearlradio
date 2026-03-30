import { prisma } from '../../../lib/prisma';

export type ScheduleKind = 'programme' | 'podcast';

export type ScheduleItemRow = {
  id: number;
  kind: ScheduleKind;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startAt: string;
  interestedCount: number;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: any): ScheduleItemRow {
  return {
    id: Number(row.id),
    kind: row.kind,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    startAt: new Date(row.start_at).toISOString(),
    interestedCount: Number(row.interested_count || 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

let ensured = false;

export async function ensureScheduleTables() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS schedule_items (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('programme', 'podcast')),
      title TEXT NOT NULL,
      description TEXT NULL,
      image_url TEXT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      interested_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS schedule_item_interests (
      id SERIAL PRIMARY KEY,
      schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (schedule_item_id, device_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_schedule_items_kind_start_at
    ON schedule_items(kind, start_at);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_schedule_items_is_active_start_at
    ON schedule_items(is_active, start_at);
  `);

  ensured = true;
}

export async function cleanupExpiredScheduleItems() {
  await ensureScheduleTables();
  await prisma.$executeRawUnsafe(`
    DELETE FROM schedule_items
    WHERE is_active = TRUE AND start_at < NOW();
  `);
}

export async function listScheduleItems(kind?: ScheduleKind): Promise<ScheduleItemRow[]> {
  await ensureScheduleTables();
  await cleanupExpiredScheduleItems();

  const rows = kind
    ? await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT *
          FROM schedule_items
          WHERE is_active = TRUE AND kind = $1
          ORDER BY start_at ASC;
        `,
        kind
      )
    : await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT *
          FROM schedule_items
          WHERE is_active = TRUE
          ORDER BY start_at ASC;
        `
      );

  return rows.map(mapRow);
}

export async function getScheduleItemById(id: number): Promise<ScheduleItemRow | null> {
  await ensureScheduleTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT *
      FROM schedule_items
      WHERE id = $1 AND is_active = TRUE
      LIMIT 1;
    `,
    id
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function createScheduleItem(input: {
  kind: ScheduleKind;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startAt: string;
}): Promise<ScheduleItemRow> {
  await ensureScheduleTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      INSERT INTO schedule_items (kind, title, description, image_url, start_at)
      VALUES ($1, $2, $3, $4, $5::timestamptz)
      RETURNING *;
    `,
    input.kind,
    input.title,
    input.description ?? null,
    input.imageUrl ?? null,
    input.startAt
  );
  return mapRow(rows[0]);
}

export async function updateScheduleItem(
  id: number,
  input: {
    kind: ScheduleKind;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    startAt: string;
  }
): Promise<ScheduleItemRow | null> {
  await ensureScheduleTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      UPDATE schedule_items
      SET
        kind = $2,
        title = $3,
        description = $4,
        image_url = $5,
        start_at = $6::timestamptz,
        updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE
      RETURNING *;
    `,
    id,
    input.kind,
    input.title,
    input.description ?? null,
    input.imageUrl ?? null,
    input.startAt
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function softDeleteScheduleItem(id: number): Promise<boolean> {
  await ensureScheduleTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      UPDATE schedule_items
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE
      RETURNING id;
    `,
    id
  );
  return rows.length > 0;
}

export async function markScheduleItemInterested(
  id: number,
  deviceId: string
): Promise<ScheduleItemRow | null> {
  await ensureScheduleTables();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      WITH inserted AS (
        INSERT INTO schedule_item_interests (schedule_item_id, device_id)
        VALUES ($1, $2)
        ON CONFLICT (schedule_item_id, device_id) DO NOTHING
        RETURNING id
      )
      UPDATE schedule_items
      SET
        interested_count = interested_count + (SELECT COUNT(*) FROM inserted),
        updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE
      RETURNING *;
    `,
    id,
    deviceId
  );

  return rows.length ? mapRow(rows[0]) : null;
}
