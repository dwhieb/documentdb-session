/* eslint-disable prefer-arrow-callback, max-nested-callbacks */
const documentdb = require('documentdb');
const DocumentDBStore = require('../documentdb-session');

const database = 'sessionstore';
const collection = 'sessions';
const databaseLink = `dbs/${database}`;
const collectionLink = `${databaseLink}/colls/${collection}`;
const host = process.env.DOCUMENTDB_URL;
const key = process.env.DOCUMENTDB_KEY;
const ttl = 15;

const db = new documentdb.DocumentClient(host, { masterKey: key });

describe('DocumentDBStore', function spec() {

  beforeAll(function beforeTest(done) {
    db.deleteDatabase(databaseLink, err => {

      if (err && err.code != 404) {
        throw new Error('Could not delete database before tests.');
      }

      const store = new DocumentDBStore({
        host,
        key,
        ttl,
      });

      store.initialize(err => {
        if (err) throw new Error('Could not initialize database.');
        done();
      });

    });
  });

  afterAll(function afterTest(done) {
    db.deleteDatabase(databaseLink, err => {
      if (err) throw new Error('Could not delete database after tests.');
      done();
    });
  });

  it('creates a database', function createDatabase(done) {
    db.readDatabase(databaseLink, (err, res) => {
      if (err) fail(err);
      expect(res.id).toBe(database);
      done();
    });
  });

  it('creates a collection', function createCollection(done) {
    db.readCollection(collectionLink, (err, res) => {
      if (err) fail(err);
      expect(res.id).toBe(collection);
      done();
    });
  });

  xit('expires documents', function expireDocuments(done) {
    // create document, set 15s timeout, then attempt to read document
  });

});
