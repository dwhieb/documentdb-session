const documentdb = require('documentdb');
const EventEmitter = require('events');

const defaults = {
  collection:     'sessions',
  database:       'sessionstore',
  discriminator:  { type: 'session' },
  host:           process.env.DOCUMENTDB_URL,
  key:            process.env.DOCUMENTDB_KEY,
  ttl:            null,
};

const init = {
  database:   false,
  collection: false,
  sprocs:     false,
};

const defaultCallback = err => {
  if (err) console.error(err, err.stack);
};

class DocumentDBStore extends EventEmitter {
  constructor(config = {}) {
    super();

    Object.assign(this, defaults, config);

    this.databaseLink = `dbs/${this.database}`;
    this.collectionLink = `${this.databaseLink}/colls/${this.collection}`;
    this.filterOn = Object.keys(this.discriminator)[0];
    this.filterValue = this.discriminator[this.filterOn];

    this.sprocs = {
      clear: require('./sprocs/clear'),
      length: require('./sprocs/length'),
      touch: require('./sprocs/touch'),
    };

    this.client = new documentdb.DocumentClient(this.host, { masterKey: this.key });

  }

  all(cb = defaultCallback) {

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

  clear(cb = defaultCallback) {
    this.client.executeStoredProcedure(this.sprocs.clear.link, err => {
      if (err) return cb(err);
      return cb();
    });
  }

  createCollection() {
    return new Promise((resolve, reject) => {

      const collectionId = this.collection || defaults.collection;

      const body = {
        id: collectionId,
        defaultTtl: -1,
      };

      this.client.createCollection(this.databaseLink, body, err => {
        if (err && err.code != 409) {
          reject(`There was a problem creating the "sessions" collection. Details: ${err}`);
        } else {
          resolve();
        }
      });

    });
  }

  createDatabase() {
    return new Promise((resolve, reject) => {

      const databaseId = this.database || defaults.database;

      this.client.createDatabase({ id: databaseId }, err => {
        if (err && err.code != 409) {
          reject(`There was a problem creating the session store database. Details: ${err}`);
        } else {
          resolve();
        }
      });

    });
  }

  destroy(sid, cb = defaultCallback) {}

  genid() {}

  get(sid, cb = defaultCallback) {}

  initialize(cb = defaultCallback) {

    if (!this.host) throw new Error('The `host` config variable is required. Please include it in the `host` property of the config object, or in the `DOCUMENTDB_URL` environment variable.');

    if (!this.key) throw new Error('The `key` config variable is required. Please include it in the `key` property of the config object, or in the `DOCUMENTDB_KEY` environment variable.');

    if (!init.database) {

      this.createDatabase()
      .then(() => {
        init.database = true;
        this.initialize(cb);
      })
      .catch(err => cb(err));

    } else if (!init.collection) {

      this.createCollection()
      .then(() => {
        init.collection = true;
        this.initialize(cb);
      })
      .catch(err => cb(err));

    } else if (!init.sprocs) {

      this.uploadSprocs()
      .then(() => {
        init.sprocs = true;
        this.initialize(cb);
      })
      .catch(err => cb(err));

    } else {

      return cb();

    }

  }

  length() {}

  makeDatabaseRequest(dbFunction, ...args) {

    if (this.isInitialized) {
      return dbFunction.apply(this.client, args);
    }

    this.initialize(err => {
      if (err) throw new Error(err);
      return dbFunction.apply(this.client, args);
    });

  }

  set(sid, session, cb = defaultCallback) {

    if (sid !== session.id) {
      return cb(new Error('The value for the `sid` parameter is not equal to the value of `session.id`.'));
    }

    const opts = { disableAutomaticIdGeneration: true };

    const doc = Object.assign({}, session);
    if (this.ttl) doc.ttl = this.ttl;

    this.makeDatabaseRequest(this.client.upsertDocument, this.collectionLink, doc, opts, err => {
      if (err) return cb(err);
      return cb();
    });

  }

  touch(sid, session, cb = defaultCallback) {}

  uploadSprocs() {

    const uploadSproc = sproc => new Promise((resolve, reject) => {
      this.client.upsertStoredProcedure(this.collectionLink, this.sprocs[sproc.id], err => {
        if (err) reject(err);
        this.sprocs[sproc.id].link = `${this.collectionLink}/sprocs/${sproc.id}`;
        resolve();
      });
    });

    const sprocs = Object.keys(this.sprocs).map(key => this.sprocs[key]);
    const promises = sprocs.map(uploadSproc);

    return Promise.all(promises);

  }

  get isInitialized() {
    return Object.keys(init).every(component => init[component]);
  }

}

// TODO: return a Proxy on DocumentDBStore rather than the class itself
// (or some other way to hide certain private methods and variables)
// - include validation of config object (`host` and `key` required)
// - make certain fields read-only
module.exports = DocumentDBStore;
