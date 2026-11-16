// @vitest-environment node
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

it('replaces beta samples while preserving volumes and enforcing ownership and cascade rules', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    db.exec(`
      CREATE TABLE App (id TEXT PRIMARY KEY);
      CREATE TABLE AppMonitoringSample (id TEXT PRIMARY KEY);
      CREATE TABLE NodeMonitoringSample (id TEXT PRIMARY KEY);
      CREATE TABLE AppVolumeMonitoringSample (id TEXT PRIMARY KEY);
      INSERT INTO App VALUES ('app');
      INSERT INTO AppMonitoringSample VALUES ('old-app');
      INSERT INTO NodeMonitoringSample VALUES ('old-node');
      INSERT INTO AppVolumeMonitoringSample VALUES ('volume');
    `);
    db.exec(readFileSync('prisma/migrations/20261116130000_unify_monitoring_samples/migration.sql', 'utf8'));
    expect(db.prepare('SELECT count(*) AS n FROM MonitoringSample').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM AppVolumeMonitoringSample').get()).toEqual({ n: 1 });
    const insert = db.prepare('INSERT INTO MonitoringSample (id, sampledAt, appId, nodeName, nodeFilesystemUsedBytes) VALUES (?, ?, ?, ?, ?)');
    insert.run('app-sample', 1, 'app', null, null);
    insert.run('node-sample', 1, null, 'node', 5);
    expect(() => insert.run('none', 1, null, null, null)).toThrow();
    expect(() => insert.run('both', 1, 'app', 'node', null)).toThrow();
    expect(() => insert.run('storage-on-app', 1, 'app', null, 5)).toThrow();
    expect(() => insert.run('missing-app', 1, 'missing', null, null)).toThrow();
    db.prepare('DELETE FROM App WHERE id = ?').run('app');
    expect(db.prepare('SELECT id FROM MonitoringSample').all()).toEqual([{ id: 'node-sample' }]);
  } finally {
    db.close();
  }
});
