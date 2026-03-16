/**
 * Entity cache manager for GitHubAgent Durable Objects.
 *
 * Stores frequently-accessed GitHub entity lists (org repos, org teams) in
 * the DO's SQLite storage so subsequent calls avoid blocking on GitHub API
 * round-trips.
 *
 * Cache strategy:
 *  - Cache-on-first-use: data is fetched from GitHub on miss and stored.
 *  - Freshness threshold: cached data older than CACHE_FRESHNESS_THRESHOLD_MS
 *    is considered stale; callers should re-fetch from the API and refresh.
 *  - Write-through: mutations (create/delete/update repo) update the cache
 *    immediately rather than invalidating it.
 *  - Per-user isolation: each GitHubAgent DO has its own SQLite database.
 */

/** Freshness threshold in milliseconds (15 minutes). */
export const CACHE_FRESHNESS_THRESHOLD_MS = 15 * 60 * 1_000;

/** A repository entry as stored in the cache. */
export type CachedRepoEntry = {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
};

/** A team entry as stored in the cache. */
export type CachedTeamEntry = {
  name: string;
  slug: string;
  description: string | null;
  privacy: string | null;
  permission: string;
};

/** Result returned from a cache read, including the sync timestamp. */
export type CachedOrgRepos = {
  repos: CachedRepoEntry[];
  cachedAt: number;
};

/** Result returned from a cache read, including the sync timestamp. */
export type CachedOrgTeams = {
  teams: CachedTeamEntry[];
  cachedAt: number;
};

/** Freshness metadata for a cache entry. */
export type CacheFreshness = {
  cachedAt: number;
  ageMs: number;
  isFresh: boolean;
};

// ── SQL row types ───────────────────────────────────────────────────────────

type RepoCacheRow = {
  org: string;
  name: string;
  full_name: string;
  private: number;
  description: string | null;
  html_url: string;
  cached_at: number;
};

type TeamCacheRow = {
  org: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string | null;
  permission: string;
  cached_at: number;
};

type MetaCacheRow = {
  cache_key: string;
  last_synced_at: number;
  entity_count: number;
};

// ── SqlExecutor type ────────────────────────────────────────────────────────

/**
 * Tagged-template SQL executor as exposed by `AIChatAgent.sql` /
 * `DurableObject.ctx.storage.sql`.  Executes a parameterised SQL statement
 * and returns a typed array of rows.
 */
export type SqlExecutor = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null | undefined)[]
) => T[];

// ── CacheManager ────────────────────────────────────────────────────────────

/**
 * Manages GitHub entity caches stored in the GitHubAgent DO's SQLite database.
 *
 * Consumers call `getCachedOrgRepos` / `setCachedOrgRepos` and the equivalent
 * team methods.  Write-through helpers (`addCachedRepo`, `removeCachedRepos`,
 * `updateCachedRepo`) keep the cache consistent after mutation operations
 * without requiring a full re-fetch.
 */
export class CacheManager {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  // ── Schema initialisation ─────────────────────────────────────────────

  /**
   * Creates the three cache tables if they do not already exist.
   * Must be called inside `blockConcurrencyWhile` in the DO constructor.
   */
  initSchema(): void {
    this.#sql`
      CREATE TABLE IF NOT EXISTS entity_cache_repos (
        org         TEXT    NOT NULL,
        name        TEXT    NOT NULL,
        full_name   TEXT    NOT NULL,
        private     INTEGER NOT NULL,
        description TEXT,
        html_url    TEXT    NOT NULL,
        cached_at   INTEGER NOT NULL,
        PRIMARY KEY (org, name)
      )
    `;

    this.#sql`
      CREATE TABLE IF NOT EXISTS entity_cache_teams (
        org         TEXT    NOT NULL,
        name        TEXT    NOT NULL,
        slug        TEXT    NOT NULL,
        description TEXT,
        privacy     TEXT,
        permission  TEXT    NOT NULL,
        cached_at   INTEGER NOT NULL,
        PRIMARY KEY (org, slug)
      )
    `;

    this.#sql`
      CREATE TABLE IF NOT EXISTS entity_cache_meta (
        cache_key      TEXT    PRIMARY KEY,
        last_synced_at INTEGER NOT NULL,
        entity_count   INTEGER NOT NULL
      )
    `;
  }

  /** Drop all cache tables. Used during full data wipe. */
  dropTables(): void {
    this.#sql`DROP TABLE IF EXISTS entity_cache_repos`;
    this.#sql`DROP TABLE IF EXISTS entity_cache_teams`;
    this.#sql`DROP TABLE IF EXISTS entity_cache_meta`;
  }

  // ── Org repos cache ───────────────────────────────────────────────────

  /**
   * Returns cached repositories for the given org, or `null` if no cache
   * entry exists yet.
   */
  getCachedOrgRepos(org: string): CachedOrgRepos | null {
    const meta = this.#sql<MetaCacheRow>`
      SELECT cache_key, last_synced_at, entity_count
      FROM entity_cache_meta
      WHERE cache_key = ${`repos:${org}`}
      LIMIT 1
    `;

    if (!meta[0]) return null;

    const rows = this.#sql<RepoCacheRow>`
      SELECT org, name, full_name, private, description, html_url, cached_at
      FROM entity_cache_repos
      WHERE org = ${org}
      ORDER BY name ASC
    `;

    return {
      repos: rows.map((r) => ({
        name: r.name,
        full_name: r.full_name,
        private: r.private === 1,
        description: r.description,
        html_url: r.html_url,
      })),
      cachedAt: meta[0].last_synced_at,
    };
  }

  /**
   * Replaces the entire org repo cache with the provided list and updates
   * the meta table with the current timestamp.
   */
  setCachedOrgRepos(org: string, repos: CachedRepoEntry[]): void {
    const now = Date.now();

    // Clear existing rows for this org then bulk-insert new ones.
    this.#sql`DELETE FROM entity_cache_repos WHERE org = ${org}`;

    for (const repo of repos) {
      this.#sql`
        INSERT INTO entity_cache_repos
          (org, name, full_name, private, description, html_url, cached_at)
        VALUES (
          ${org},
          ${repo.name},
          ${repo.full_name},
          ${repo.private ? 1 : 0},
          ${repo.description ?? null},
          ${repo.html_url},
          ${now}
        )
      `;
    }

    this.#sql`
      INSERT OR REPLACE INTO entity_cache_meta (cache_key, last_synced_at, entity_count)
      VALUES (${`repos:${org}`}, ${now}, ${repos.length})
    `;
  }

  /**
   * Adds a single repo to the cache (write-through after creation).
   * No-op if no cache exists for the org yet — the cache will be populated
   * on the next read.
   */
  addCachedRepo(org: string, repo: CachedRepoEntry): void {
    const meta = this.#sql<MetaCacheRow>`
      SELECT cache_key, last_synced_at, entity_count
      FROM entity_cache_meta
      WHERE cache_key = ${`repos:${org}`}
      LIMIT 1
    `;

    if (!meta[0]) return; // No cache yet — will be populated on next read.

    const now = Date.now();

    this.#sql`
      INSERT OR REPLACE INTO entity_cache_repos
        (org, name, full_name, private, description, html_url, cached_at)
      VALUES (
        ${org},
        ${repo.name},
        ${repo.full_name},
        ${repo.private ? 1 : 0},
        ${repo.description ?? null},
        ${repo.html_url},
        ${now}
      )
    `;

    this.#sql`
      UPDATE entity_cache_meta
      SET entity_count = entity_count + 1
      WHERE cache_key = ${`repos:${org}`}
    `;
  }

  /**
   * Removes the given repo names from the cache (write-through after deletion).
   * No-op if no cache exists.
   */
  removeCachedRepos(org: string, repoNames: string[]): void {
    if (repoNames.length === 0) return;

    for (const name of repoNames) {
      this.#sql`
        DELETE FROM entity_cache_repos
        WHERE org = ${org} AND name = ${name}
      `;
    }

    // Recount to keep meta in sync.
    const count = this.#sql<{ cnt: number }>`
      SELECT COUNT(*) AS cnt FROM entity_cache_repos WHERE org = ${org}
    `;

    if (count[0]) {
      this.#sql`
        UPDATE entity_cache_meta
        SET entity_count = ${count[0].cnt}
        WHERE cache_key = ${`repos:${org}`}
      `;
    }
  }

  /**
   * Updates metadata fields of a cached repo entry (write-through after updates).
   * Only updates fields that are provided; the `name` field identifies the row.
   * If the repo is renamed, the old row is removed and a new one is inserted.
   */
  updateCachedRepo(
    org: string,
    oldName: string,
    updates: Partial<CachedRepoEntry>,
  ): void {
    const existing = this.#sql<RepoCacheRow>`
      SELECT org, name, full_name, private, description, html_url, cached_at
      FROM entity_cache_repos
      WHERE org = ${org} AND name = ${oldName}
      LIMIT 1
    `;

    if (!existing[0]) return; // Not in cache — nothing to update.

    const row = existing[0];
    const newName = updates.name ?? row.name;
    const now = Date.now();

    if (updates.name && updates.name !== oldName) {
      // Renamed: delete old row, insert new one.
      this.#sql`
        DELETE FROM entity_cache_repos WHERE org = ${org} AND name = ${oldName}
      `;
    }

    this.#sql`
      INSERT OR REPLACE INTO entity_cache_repos
        (org, name, full_name, private, description, html_url, cached_at)
      VALUES (
        ${org},
        ${newName},
        ${updates.full_name ?? row.full_name},
        ${(updates.private ?? row.private === 1) ? 1 : 0},
        ${updates.description !== undefined ? updates.description : row.description},
        ${updates.html_url ?? row.html_url},
        ${now}
      )
    `;
  }

  // ── Org teams cache ───────────────────────────────────────────────────

  /**
   * Returns cached teams for the given org, or `null` if no cache entry exists.
   */
  getCachedOrgTeams(org: string): CachedOrgTeams | null {
    const meta = this.#sql<MetaCacheRow>`
      SELECT cache_key, last_synced_at, entity_count
      FROM entity_cache_meta
      WHERE cache_key = ${`teams:${org}`}
      LIMIT 1
    `;

    if (!meta[0]) return null;

    const rows = this.#sql<TeamCacheRow>`
      SELECT org, name, slug, description, privacy, permission, cached_at
      FROM entity_cache_teams
      WHERE org = ${org}
      ORDER BY name ASC
    `;

    return {
      teams: rows.map((r) => ({
        name: r.name,
        slug: r.slug,
        description: r.description,
        privacy: r.privacy,
        permission: r.permission,
      })),
      cachedAt: meta[0].last_synced_at,
    };
  }

  /**
   * Replaces the entire org team cache with the provided list and updates
   * the meta table with the current timestamp.
   */
  setCachedOrgTeams(org: string, teams: CachedTeamEntry[]): void {
    const now = Date.now();

    this.#sql`DELETE FROM entity_cache_teams WHERE org = ${org}`;

    for (const team of teams) {
      this.#sql`
        INSERT INTO entity_cache_teams
          (org, name, slug, description, privacy, permission, cached_at)
        VALUES (
          ${org},
          ${team.name},
          ${team.slug},
          ${team.description ?? null},
          ${team.privacy ?? null},
          ${team.permission},
          ${now}
        )
      `;
    }

    this.#sql`
      INSERT OR REPLACE INTO entity_cache_meta (cache_key, last_synced_at, entity_count)
      VALUES (${`teams:${org}`}, ${now}, ${teams.length})
    `;
  }

  // ── Generic invalidation / freshness ─────────────────────────────────

  /**
   * Removes all cached entries and meta for the given org and entity type.
   * `entityType` must be `'repos'` or `'teams'`.
   */
  invalidateOrgCache(org: string, entityType: 'repos' | 'teams'): void {
    const cacheKey = `${entityType}:${org}`;

    if (entityType === 'repos') {
      this.#sql`DELETE FROM entity_cache_repos WHERE org = ${org}`;
    } else {
      this.#sql`DELETE FROM entity_cache_teams WHERE org = ${org}`;
    }

    this.#sql`DELETE FROM entity_cache_meta WHERE cache_key = ${cacheKey}`;
  }

  /**
   * Returns freshness metadata for the given cache key, or `null` if no
   * entry exists.  `cacheKey` format is `'repos:{org}'` or `'teams:{org}'`.
   */
  getCacheFreshness(cacheKey: string): CacheFreshness | null {
    const meta = this.#sql<MetaCacheRow>`
      SELECT cache_key, last_synced_at, entity_count
      FROM entity_cache_meta
      WHERE cache_key = ${cacheKey}
      LIMIT 1
    `;

    if (!meta[0]) return null;

    const cachedAt = meta[0].last_synced_at;
    const ageMs = Date.now() - cachedAt;

    return {
      cachedAt,
      ageMs,
      isFresh: ageMs < CACHE_FRESHNESS_THRESHOLD_MS,
    };
  }
}
