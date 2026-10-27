// In-process per-key serialization. Stands in for the row locks (SELECT ... FOR UPDATE,
// partial unique indexes) Postgres used to provide — fine as long as this runs as one
// Node process. ponytail: a single shared lock per key, not a distributed lock service;
// revisit if this ever runs as more than one process.
const locks = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const mine = prior.then(fn, fn);
  locks.set(key, mine);
  try {
    return await mine;
  } finally {
    if (locks.get(key) === mine) locks.delete(key);
  }
}
