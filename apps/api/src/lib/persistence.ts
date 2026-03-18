import { Pool } from "pg";

import type { Project, UserSession } from "../../../../packages/shared/src";

type PersistedDocument = Project[] | UserSession;

const PROJECTS_KEY = "workspace:projects";

let memoryProjects: Project[] = [];
const memorySessions = new Map<string, UserSession>();

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!pool) {
    return;
  }

  if (!schemaReady) {
    schemaReady = pool
      .query(`
        create table if not exists pilot_documents (
          key text primary key,
          payload jsonb not null,
          updated_at timestamptz not null default now()
        )
      `)
      .then(() => undefined);
  }

  await schemaReady;
}

async function readDocument<T extends PersistedDocument>(key: string): Promise<T | null> {
  if (!pool) {
    if (key === PROJECTS_KEY) {
      return structuredClone(memoryProjects) as T;
    }

    return structuredClone(memorySessions.get(key) ?? null) as T | null;
  }

  await ensureSchema();
  const result = await pool.query<{ payload: T }>(
    "select payload from pilot_documents where key = $1 limit 1",
    [key]
  );

  return result.rows[0]?.payload ?? null;
}

async function writeDocument(key: string, payload: PersistedDocument) {
  if (!pool) {
    if (key === PROJECTS_KEY) {
      memoryProjects = structuredClone(payload as Project[]);
      return;
    }

    memorySessions.set(key, structuredClone(payload as UserSession));
    return;
  }

  await ensureSchema();
  await pool.query(
    `
      insert into pilot_documents (key, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key) do update
      set payload = excluded.payload,
          updated_at = now()
    `,
    [key, JSON.stringify(payload)]
  );
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

export function getPersistenceMode() {
  return pool ? "postgres" : "memory";
}

export async function loadProjects() {
  return (await readDocument<Project[]>(PROJECTS_KEY)) ?? [];
}

export async function saveProjects(projects: Project[]) {
  await writeDocument(PROJECTS_KEY, projects);
}

export async function loadSession(sessionId: string) {
  return readDocument<UserSession>(sessionKey(sessionId));
}

export async function saveSession(sessionId: string, session: UserSession) {
  await writeDocument(sessionKey(sessionId), session);
}

export async function resetPersistence() {
  memoryProjects = [];
  memorySessions.clear();

  if (!pool) {
    return;
  }

  await ensureSchema();
  await pool.query("delete from pilot_documents");
}
