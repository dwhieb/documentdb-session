const DocumentDBStore = require('../documentdb-session');

const host = process.env.DOCUMENTDB_URL;
const key = process.env.DOCUMENTDB_KEY;

const store = new DocumentDBStore({
  host,
  key,
});
