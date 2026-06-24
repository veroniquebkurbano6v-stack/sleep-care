const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs({
    locateFile: f => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f)
  });
  const dbPath = path.resolve(__dirname, '..', '..', 'sleep_care.db');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // Clean all authorization records for clean test
  db.run("DELETE FROM doctor_authorizations");
  console.log('Cleaned all auth records, remaining:', db.exec('SELECT COUNT(*) as c FROM doctor_authorizations')[0].values[0][0]);

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();
  console.log('Done');
})().catch(err => { console.error(err); process.exit(1); });
