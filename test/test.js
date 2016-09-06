/* eslint-disable
  prefer-arrow-callback,
  max-nested-callbacks,
  no-underscore-dangle,
  max-statements
*/
const documentdb = require('documentdb');
const documentdbSession = require('../documentdb-session');
const session = require('express-session');

const DocumentDBStore = documentdbSession(session);

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
      if (err) fail(err.message);
      done();
    });

  });

  /*
  // Use these when you want to delete and recreate the database during testing
  // Also tests .initialize()
  beforeAll(function beforeTest(done) {

    if (!host) throw new Error('The `host` config variable is required. Please include it in the `host` property of the config object, or in the `DOCUMENTDB_URL` environment variable.');

    if (!key) throw new Error('The `key` config variable is required. Please include it in the `key` property of the config object, or in the `DOCUMENTDB_KEY` environment variable.');

    db.deleteDatabase(databaseLink, err => {

      if (err && err.code != 404) {
        fail(err.message);
      }

      this.store = new DocumentDBStore({
        host,
        key,
        ttl,
      });

      this.store.initialize(err => {
        if (err) fail(err.message);
        done();
      });

    });
  });
  */

  /*
  afterAll(function afterTest(done) {
    db.deleteDatabase(databaseLink, err => {
      if (err) fail(err.message);
      done();
    });
  });
  */

  it('requires the express-session object', function requireExpressSession() {

    let err;

    try {
      documentdbSession();
    } catch (e) {
      err = e;
      expect(err).toBeDefined();
    }

    if (!err) fail('Should have thrown an error when express-session was omitted.');

  });

  it('.initialize()', function initialize(done) {
    expect(this.store.client).toBeDefined();
    expect(this.store.database).toBe(database);
    done();
  });

  it('creates a database', function createDatabase(done) {
    db.readDatabase(databaseLink, (err, res) => {
      if (err) fail(err.body);
      expect(res.id).toBe(database);
      done();
    });
  });

  it('creates a collection', function createCollection(done) {
    db.readCollection(collectionLink, (err, res) => {
      if (err) fail(err.body);
      expect(res.id).toBe(collection);
      done();
    });
  });

  it('expires documents', function expireDocuments(done) {

    const session = {
      id: 'expire-test',
      cookie: {},
      data: 'session data',
      type: 'session',
      lastActive: new Date(),
    };

    this.store.set(session.id, session, err => {
      if (err) fail(err.message);

      setTimeout(() => {
        const documentLink = `${collectionLink}/docs/${session.id}`;

        db.readDocument(documentLink, (err, res) => {
          if (err && err.code == 404) {
            done();
          } else if (res) {
            fail(JSON.stringify(res));
          } else if (err) {
            fail(err.body);
          } else {
            fail('Could not read document during expire test.');
          }
        });
      }, 45000);

    });

  }, 60000);

  it('.all()', function all(done) {

    const session1 = {
      id: 'all-session-1',
      ttl: 15,
      type: 'session',
      lastActive: new Date(),
    };

    const session2 = {
      id: 'all-session-2',
      ttl: 15,
      type: 'session',
      lastActive: new Date(),
    };

    db.upsertDocument(collectionLink, session1, err => {
      if (err) fail(err.body);
      db.upsertDocument(collectionLink, session2, err => {
        if (err) fail(err.body);

        this.store.all((err, sessions) => {
          if (err) fail(err.message);
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
      type: 'session',
      lastActive: new Date(),
    };

    const session2 = {
      id: 'clear-session-2',
      ttl: 15,
      type: 'session',
      lastActive: new Date(),
    };

    db.upsertDocument(collectionLink, session1, err => {
      if (err) fail(err.body);
      db.upsertDocument(collectionLink, session2, err => {
        if (err) fail(err.body);

        this.store.clear(err => {
          if (err) fail(err.message);

          const query = `
            SELECT * FROM d
            WHERE d.type = "session"
          `;

          db.queryDocuments(collectionLink, query).toArray((err, res) => {
            if (err) fail(err.body);
            expect(res instanceof Array).toBe(true);
            expect(res.length).toBe(0);
            done();
          });

        });

      });
    });

  });

  it('.destroy()', function destroy(done) {

    const session = {
      id: 'destroy-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
      type: 'session',
      lastActive: new Date(),
    };

    db.upsertDocument(collectionLink, session, err => {
      if (err) fail(err.body);

      this.store.destroy(session.id, err => {
        if (err) fail(err.message);

        const documentLink = `${collectionLink}/docs/${session.id}`;

        db.readDocument(documentLink, err => {
          if (err && err.code == 404) {
            done();
          } else if (err) {
            fail(err.body);
          } else {
            fail('Document was found after .destroy().');
          }
        });

      });

    });

  });

  it('.get()', function get(done) {

    const session = {
      id: 'get-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
      type: 'session',
      lastActive: new Date(),
    };

    db.upsertDocument(collectionLink, session, err => {
      if (err) fail(err.body);

      this.store.get(session.id, (err, sess) => {
        if (err) fail(err.message);
        expect(sess.id).toBe(session.id);
        done();
      });

    });

  });

  it('.length()', function length(done) {
    this.store.length((err, length) => {
      if (err) fail(err.message);
      expect(typeof length).toBe('number');
      done();
    });
  });

  it('.set()', function set(done) {

    const session = {
      id: 'set-session',
      data: 'session data',
      cookie: {},
      type: 'session',
      lastActive: new Date(),
    };

    this.store.set(session.id, session, err => {
      if (err) fail(err.message);

      const documentLink = `${collectionLink}/docs/${session.id}`;

      db.readDocument(documentLink, (err, res) => {
        if (err) fail(err.body);
        expect(res.id).toBe(session.id);
        done();
      });

    });
  });

  it('.touch()', function touch(done) {

    const session = {
      id: 'touch-session',
      cookie: {},
      data: 'session data',
      ttl: 300,
      type: 'session',
      lastActive: new Date(),
    };

    db.upsertDocument(collectionLink, session, (err, res) => {
      if (err) fail(err.body);

      const originalTimestamp = res._ts;

      setTimeout(() => {

        this.store.touch(session.id, session, err => {
          if (err) fail(err.message);

          const documentLink = `${collectionLink}/docs/${session.id}`;

          db.readDocument(documentLink, (err, res) => {
            if (err) fail(err.body);
            expect(res._ts).toBeGreaterThan(originalTimestamp);
            done();
          });

        });

      }, 5000);

    });

  }, 10000);

});
