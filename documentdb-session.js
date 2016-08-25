const documentdb = require('documentdb');
const EventEmitter = require('events');

const defaults = {
  collection: 'sessions',
  database: 'sessionstore',
  discriminator: { type: 'session' },
};

class DocumentDBStore extends EventEmitter {
  constructor(config = {}) {
    super();

    const { collection, database, discriminator, host, key, ttl } = config;

    this.config = {
      collection,
      database,
      discriminator,
      host,
      key,
      ttl,
    };

    this.discriminator = this.config.discriminator || defaults.discriminator;
    this.filterOn = Object.keys(this.discriminator)[0];
    this.filterValue = this.discriminator[this.filterOn];

    this.client = new documentdb.DocumentClient(this.config.host, { masterKey: this.config.key });

  }

  all(cb) {

    const querySpec = {
      query: 'SELECT * FROM d WHERE d[@attr] = @value',
      parameters: [
        {
          name: '@attr',
          value: this.filterOn,
        },
        {
          name: '@value',
          value: this.filterValue,
        },
      ],
    };

    this.client.queryDocuments(this.collectionLink, querySpec).toArray((err, res) => {
      if (err) return cb(err);
      return cb(null, res);
    });
  }

  clear(cb) {}

  createCollection() {
    return new Promise((resolve, reject) => {

      const collectionId = this.config.collection || defaults.collection;

      const body = {
        id: collectionId,
        defaultTtl: -1,
      };

      this.client.createCollection(this.databaseLink, body, err => {

        if (err && err.code != 409) {

          reject(`There was a problem creating the "sessions" collection. Details: ${err}`);

        } else {

          this.collection = collectionId;
          this.collectionLink = `${this.databaseLink}/colls/${this.collection}`;
          resolve();

        }

      });
    });
  }

  createDatabase() {
    return new Promise((resolve, reject) => {

      const databaseId = this.config.database || defaults.database;

      this.client.createDatabase({ id: databaseId }, err => {

        if (err && err.code != 409) {

          reject(`There was a problem creating the session store database. Details: ${err}`);

        } else {

          this.database = databaseId;
          this.databaseLink = `dbs/${this.database}`;
          resolve();

        }

      });
    });
  }

  destroy(sid, cb) {}

  genid() {}

  get(sid, cb) {}

  initialize(cb) {

    const databaseId = this.config.database || defaults.database;
    const databaseLink = `dbs/${databaseId}`;

    this.makeDatabaseRequest(this.client.readDatabase, databaseLink, (err, res) => {
      if (err) return cb(err);
      cb(null, res);
    });

  }

  length() {}

  makeDatabaseRequest(dbFunction, ...args) {

    if (!this.database) {

      this.createDatabase()
      .then(() => this.makeDatabaseRequest(dbFunction, ...args))
      .catch(err => { throw new Error(err); });

    } else if (!this.collection) {

      this.createCollection()
      .then(() => this.makeDatabaseRequest(dbFunction, ...args))
      .catch(err => { throw new Error(err); });

    } else {

      return dbFunction.apply(this.client, args);

    }

  }

  set(sid, session, cb) {

    if (sid !== session.id) {
      return cb(new Error('The value for the `sid` parameter is not equal to the value of `session.id`.'));
    }

    const opts = { disableAutomaticIdGeneration: true };

    const doc = Object.assign({}, session);
    if (this.config.ttl) doc.ttl = this.config.ttl;

    this.makeDatabaseRequest(this.client.upsertDocument, this.collectionLink, doc, opts, err => {
      if (err) return cb(err);
      return cb();
    });

  }

  touch(sid, session, cb) {}

}

// TODO: return a Proxy on DocumentDBStore rather than the class itself
// (or some other way to hide certain private methods and variables)
// - include validation of config object (`host` and `key` required)
// - make certain fields read-only
module.exports = DocumentDBStore;
