const documentdb = require('documentdb');
const EventEmitter = require('events');

const defaults = {
  database: 'sessionstore',
  collection: 'sessions',
};

class DocumentDBStore extends EventEmitter {
  constructor(config = {}) {
    super();

    const { host, key, database, collection, ttl } = config;

    this.client = new documentdb.DocumentClient(config.host, { masterKey: config.key });

    this.config = {
      host,
      key,
      database,
      collection,
      ttl,
    };

  }

  createCollection() {
    return new Promise((resolve, reject) => {

      const collectionId = this.config.collection || defaults.collection;

      const body = {
        id: collectionId,
        defaultTtl: this.config.ttl,
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

  makeDatabaseRequest(dbFunction, ...args) {
    return new Promise((resolve, reject) => {

      if (!this.database) {

        this.createDatabase()
        .then(() => this.makeDatabaseRequest(dbFunction, ...args))
        .catch(reject);

      } else if (!this.collection) {

        this.createCollection()
        .then(() => this.makeDatabaseRequest(dbFunction, ...args))
        .catch(reject);

      } else {

        resolve(dbFunction.apply(this.client, args));

      }

    });
  }
}

// TODO: return a Proxy on DocumentDBStore rather than the class itself
// (or some other way to hide certain private methods and variables)
// - include validation of config object (`host` and `key` required)
// - make certain fields read-only
module.exports = DocumentDBStore;
