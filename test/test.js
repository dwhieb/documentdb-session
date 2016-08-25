/* eslint-disable
  prefer-arrow-callback,
  max-nested-callbacks,
  no-underscore-dangle,
  max-statements
*/
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

  // Use when you want to use an existing database and collection for testing
  // Also tests .initialize()
  beforeAll(function beforeTest(done) {

    this.store = new DocumentDBStore({
      host,
      key,
      ttl,
    });

    this.store.initialize(err => {
      if (err) throw new Error('Could not initialize database.');
      done();
    });

  });

  /*
  // Use when you want to delete and recreate the database during testing
  // Also tests .initialize()
  beforeAll(function beforeTest(done) {
    db.deleteDatabase(databaseLink, err => {

      if (err && err.code != 404) {
        console.log(err, err.stack);
        throw new Error('Could not delete database before tests.');
      }

      this.store = new DocumentDBStore({
        host,
        key,
        ttl,
      });

      this.store.initialize(err => {
        if (err) throw new Error('Could not initialize database.');
        done();
      });

    });
  });
  */

  /*
  afterAll(function afterTest(done) {
    db.deleteDatabase(databaseLink, err => {
      if (err) throw new Error('Could not delete database after tests.');
      done();
    });
  });
  */

  xit('.initialize()', function initialize(done) {
    expect(this.store.client).toBeDefined();
    expect(this.store.database).toBe(database);
    done();
  });

  xit('creates a database', function createDatabase(done) {
    db.readDatabase(databaseLink, (err, res) => {
      if (err) fail(err);
      expect(res.id).toBe(database);
      done();
    });
  });

  xit('creates a collection', function createCollection(done) {
    db.readCollection(collectionLink, (err, res) => {
      if (err) fail(err);
      expect(res.id).toBe(collection);
      done();
    });
  });


  xit('expires documents', function expireDocuments(done) {

    const session = {
      id: 'expire-test',
      cookie: {},
      data: 'session data',
    };

    this.store.set(session.id, session, err => {
      if (err) fail(err);

      setTimeout(() => {
        const documentLink = `${collectionLink}/docs/${session.id}`;

        db.readDocument(documentLink, (err, res) => {
          if (err && err.code == 404) {
            done();
          } else {
            fail(err || res);
          }
        });
      }, 16000);

    });

  }, 20000);

  xit('.all()', function all(done) {

    const session1 = {
      id: 'all-session-1',
      ttl: 15,
      type: 'session',
    };

    const session2 = {
      id: 'all-session-2',
      ttl: 15,
      type: 'session',
    };

    db.upsertDocument(collectionLink, session1, err => {
      if (err) fail(err);
      db.upsertDocument(collectionLink, session2, err => {
        if (err) fail(err);

        this.store.all((err, sessions) => {
          if (err) fail(err);
          expect(sessions instanceof Array).toBe(true);
          expect(sessions.length >= 2).toBe(true);
          const ids = sessions.map(session => session.id);
          expect(ids.includes('all-session-1')).toBe(true);
          expect(ids.includes('all-session-2')).toBe(true);
          done();
        });

      });
    });

  });

  it('.clear()', function clear(done) {

    const session1 = {
      id: 'clear-session-1',
      ttl: 15,
    };

    const session2 = {
      id: 'clear-session-2',
      ttl: 15,
    };

    db.upsertDocument(collectionLink, session1, err => {
      if (err) fail(err);
      db.upsertDocument(collectionLink, session2, err => {
        if (err) fail(err);

        this.store.clear(err => {
          if (err) fail(err);

          const query = `
            SELECT * FROM d
            WHERE d.type = "session"
          `;

          db.queryDocuments(collectionLink, query).toArray((err, res) => {
            if (err) fail(err);
            expect(res instanceof Array).toBe(true);
            expect(res.length).toBe(0);
            done();
          });

        });

      });
    });

  });

  xit('.destroy()', function destroy(done) {

    const session = {
      id: 'destroy-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
    };

    db.upsertDocument(collectionLink, session, err => {
      if (err) fail(err);

      this.store.destroy(session.id, err => {
        if (err) fail(err);

        const documentLink = `${collectionLink}/docs/${session.id}`;

        db.readDocument(documentLink, err => {
          if (err && err.code == 404) {
            done();
          } else {
            fail(err);
          }
        });

      });

    });

  });

  xit('.genid()', function genid(done) {

    const id = this.store.genid();

    const documentLink = `${collectionLink}/docs/${id}`;

    db.readDocument(documentLink, (err, res) => {
      if (err) fail(err);
      if (res) expect(res.id).toBe(id);
      done();
    });

  });

  xit('.get()', function get(done) {

    const session = {
      id: 'get-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
    };

    db.upsertDocument(collectionLink, session, err => {
      if (err) fail(err);

      this.store.get(session.id, (err, sess) => {
        if (err) fail(err);
        expect(sess.id).toBe(session.id);
        done();
      });

    });

  });

  xit('.length()', function length(done) {
    this.store.length((err, length) => {
      if (err) fail(err);
      expect(typeof length).toBe('number');
      done();
    });
  });

  xit('.set()', function set(done) {

    const session = {
      id: 'set-session',
      data: 'session data',
      cookie: {},
    };

    this.store.set(session.id, session, err => {
      if (err) fail(err);

      const documentLink = `${collectionLink}/docs/${session.id}`;

      db.readDocument(documentLink, (err, res) => {
        if (err) fail(err);
        expect(res.id).toBe(session.id);
        done();
      });

    });
  });

  xit('.touch()', function touch(done) {

    const session = {
      id: 'touch-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
    };

    db.upsertDocument(collectionLink, session, (err, res) => {
      if (err) fail(err);

      const originalTimestamp = res._ts;

      setTimeout(() => {

        this.store.touch(session.id, session, err => {
          if (err) fail(err);

          const documentLink = `${collectionLink}/docs/${session.id}`;

          db.readDocument(documentLink, (err, res) => {
            if (err) fail(err);
            expect(res._ts).toBeGreaterThan(originalTimestamp);
            done();
          });

        });

      }, 5000);

    });

  });

});
