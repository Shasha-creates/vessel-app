const { Client } = require('pg');
(async () => {
  const client = new Client({ host: 'postgresql-godlyme-u57058.vm.elestio.app', port: 25432, user: 'postgres', password: 'TRcvMYUvzEs-2-7YR-gb', database: 'postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT id, handle, email FROM users WHERE handle IN ('phiwokuhlezulu','testuser123')");
  console.log(res.rows);
  await client.end();
})();
