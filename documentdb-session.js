const documentdb = require('documentdb');

/**
 * The default configuration options for `documentdb-session`
 * @const
 * @type {Object} defaults
 */
const defaults = {
  collection:     'sessions',
  database:       'sessionstore',
  discriminator:  { type: 'session' },
  host:           process.env.DOCUMENTDB_URL,
  key:            process.env.DOCUMENTDB_KEY,
  ttl:            null,
  proxyUrl:       null,
};

/**
 * The default callback for use with store methods, in case one isn't provided
 * @function
 * @param  {Object} err  An error object, if one was thrown
 */
const defaultCallback = err => {
  throw new Error(err);
};

const DocumentDBSession = expressSession => {

  if (!expressSession) {
    throw new Error('documentdb-session must be called by passing it the express-session object.');
  }

  /* A class representing a DocumentDBStore */
  class DocumentDBStore extends expressSession.Store {
    /**
     * Create a new DocumentDBStore
     * @type {Object}
     * @param {Object} [config]       The configuration object
     */
    constructor(config = {}) {

      super();

      // copy configuration options to the Store
      Object.assign(this, defaults, config);

      // if the `host` property is missing from the config, throw an error
      if (!this.host) {
        throw new Error('The `host` config variable is required. Please include it in the `host` property of the config object, or in the `DOCUMENTDB_URL` environment variable.');
      }

      // if the `key` property is missing from the config, throw an error
      if (!this.key) {
        throw new Error('The `key` config variable is required. Please include it in the `key` property of the config object, or in the `DOCUMENTDB_KEY` environment variable.');
      }

      this.databaseLink = `dbs/${this.database}`;
      this.collectionLink = `${this.databaseLink}/colls/${this.collection}`;
      this.filterOn = Object.keys(this.discriminator)[0]; // the key to filter sessions on
      this.filterValue = this.discriminator[this.filterOn]; // the value to filter sessions on
      this.initialized = false;

      // a hash of the stored procedures used by this package
      this.sprocs = {
        clear: {
          id: 'clear',
          serverScript: require('./sprocs/clear'),
        },
        length: {
          id: 'length',
          serverScript: require('./sprocs/length'),
        },
      };

      // create a new DocumentDB client and assign it to Store.client
      let connectionOptions = new documentdb.DocumentBase.ConnectionPolicy();
      connectionOptions.ProxyUrl = this.proxyUrl
      this.client = new documentdb.DocumentClient(this.host, { masterKey: this.key }, connectionOptions);

    }

    /**
     * Retrieve all the sessions in the database.
     * @method
     * @function
     * @type {Function}
     * @param {Function} [cb=defaultCallback]         The callback function to run
     */
    all(cb = defaultCallback) {

      // The DocumentDB query to run
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

      // Runs the .queryDocuments() method from the documentdb SDK
      const queryDocuments = () => {
        this.client.queryDocuments(this.collectionLink, querySpec).toArray((err, sessions) => {
          if (err) return cb(new Error(`Error querying documents: ${err.body}`));
          cb(null, sessions);
        });
      };

      if (this.initialized) {

        // if the database has been initialized, query documents
        queryDocuments();

      } else {

        // if the database hasn't been initialized, initialize it, then query documents
        this.initialize(err => {
          if (err) return cb(err);
          queryDocuments();
        });

      }

    }

    /**
     * Deletes all the sessions from the database
     * @function
     * @method
     * @type {Function}
     * @param {Function} [cb=defaultCallback]       The callback function to run
     */
    clear(cb = defaultCallback) {

      // Run the stored procedure for `.clear()`
      const executeStoredProcedure = () => {

        const sprocLink = `${this.collectionLink}/sprocs/clear`;

        this.client.executeStoredProcedure(sprocLink, (err, res) => {
          if (err) return cb(new Error(`Error executing the stored procedure for '.clear()': ${err.body}`));

          // if a continuation is returned, execute the stored procedure again
          if (res.continuation) {
            this.clear(cb);
          } else {
            cb();
          }

        });
      };

      if (this.initialized) {

        // if the database has been initialized, run the stored procedure
        executeStoredProcedure();

      } else {

        // if the database hasn't been initialized, initialize it, then run the stored procedure
        this.initialize(err => {
          if (err) return cb(err);
          executeStoredProcedure();
        });

      }

    }

    /**
     * Creates the sessions collection
     * @function
     * @method
     * @return {Promise} Returns a Promise that resolves once the collection is created
     */
    createCollection() {
      return new Promise((resolve, reject) => {

        const collectionId = this.collection || defaults.collection;

        const body = {
          id: collectionId,
          defaultTtl: -1,
        };

        this.client.createCollection(this.databaseLink, body, err => {
          if (err && err.code != 409) {
            reject(new Error(`Error creating the "${this.collection}" collection: ${err.body}`));
          } else {
            resolve();
          }
        });

      });
    }

    /**
     * Creates the session store database. If the database already exists, the function simply resolves.
     * @function
     * @method
     * @return {Promise} Returns a Promise that resolves when the database is created
     */
    createDatabase() {
      return new Promise((resolve, reject) => {

        const databaseId = this.database || defaults.database;

        this.client.createDatabase({ id: databaseId }, err => {
          if (err && err.code != 409) {
            reject(new Error(`Error creating the "${this.database}" database: ${err.body}`));
          } else {
            resolve();
          }
        });

      });
    }

    /**
     * Deletes the session with the given session ID
     * @function
     * @method
     * @type  {Function}
     * @param {String} sid                          The ID of the session to delete
     * @param {Function} [cb=defaultCallback]       The callback function to run
     */
    destroy(sid, cb = defaultCallback) {

      const docLink = `${this.collectionLink}/docs/${sid}`;

      // Runs the .deleteDocument() method of the DocumentDB SDK
      const deleteDocument = () => this.client.deleteDocument(docLink, err => {
        if (err) return cb(new Error(`Error deleting document: ${err.body}`));
        cb();
      });

      if (this.initialized) {

        // if the database is initialized, delete the session
        deleteDocument();

      } else {

        // if the database hasn't been initialized, initialize it, then delete the session
        this.initialize(err => {
          if (err) return cb(err);
          deleteDocument();
        });

      }

    }

    /**
     * Retrieves the session with the given session ID
     * @method
     * @function
     * @param  {String} sid                         The ID of the session to retrieve
     * @param  {Function} [cb=defaultCallback]      The callback function to run
     */
    get(sid, cb = defaultCallback) {

      const docLink = `${this.collectionLink}/docs/${sid}`;

      const readDocument = () => this.client.readDocument(docLink, (err, doc) => {
        if (err && err.code == 404) return cb(null, null);
        else if (err) return cb(new Error(`Error reading document: ${err.body}`));
        cb(null, doc);
      });

      if (this.initialized) {

        // if the database is initialized, get the session
        readDocument();

      } else {

        // if the database hasn't been initialized, initialize it, then get the session
        this.initialize(err => {
          if (err) return cb(err);
          readDocument();
        });

      }

    }

    /**
     * Initializes the database by attempting to create both the database and the collection, and then uploading the stored procedures. If either the database or collection already exists, it moves to the next step in the initialization.
     * @function
     * @method
     * @type {Function}
     * @param {Function} [cb = defaultCallback]         The callback function to run
     */
    initialize(cb = defaultCallback) {

      this.createDatabase()
      .then(this.createCollection.bind(this))
      .then(this.uploadSprocs.bind(this))
      .then(() => {
        this.initialized = true;
        cb();
      })
      .catch(err => cb(err));

    }

    /**
     * Counts the number of sessions in the database
     * @method
     * @function
     * @type {Function}
     * @param {Function} [cb = defaultCallback]     The callback function to run
     * @return {Function} cb
     */
    length(cb = defaultCallback) {

      // Execute the stored procedure for `.length()`
      const executeStoredProcedure = continuationToken => {

        const params = [this.filterOn, this.filterValue, continuationToken];
        const sprocLink = `${this.collectionLink}/sprocs/length`;
        let documentsFound = 0;

        this.client.executeStoredProcedure(sprocLink, params, (err, res) => {
          if (err) return cb(new Error(`Error executing the stored procedure for '.length()': ${err.body}`));

          // add the retrieved results to the running total
          documentsFound += res.documentsFound;

          // if a continuation token was returned, run the stored procedure again to get more results
          if (res.continuation) {
            executeStoredProcedure(res.continuation);
          }

          cb(null, documentsFound);

        });
      };

      // if the database is initialized, run the stored procedure
      if (this.initialized) return executeStoredProcedure();

      // if the database isn't initialized, initialize it, then run the stored procedure
      this.initialize(err => {
        if (err) cb(err);
        executeStoredProcedure();
      });

    }

    /**
     * Upserts the provided session to the database
     * @method
     * @function
     * @param  {String} sid                     The ID of the session to update
     * @param  {Object} session                 The session object to upload
     * @param  {Function} [cb=defaultCallback]  The callback function to run
     */
    set(sid, session, cb = defaultCallback) {

      // if the session ID parameter and the session ID property don't match, throw an error
      if (sid === session.id) {

        // create a new session object, to avoid altering the original parameter
        const doc = Object.assign({}, session);

        doc.id = sid;
        doc[this.filterOn] = this.filterValue;
        doc.lastActive = Date.now();
        if (this.ttl) doc.ttl = this.ttl;
        // only add a `ttl` property if one is set in the documentdb-session config
        // an invalid `ttl` property on a document with throw an error in documentdb

        const upsertDocument = () => this.client.upsertDocument(this.collectionLink, doc, err => {
          if (err) {
            return cb(new Error(`Error upserting session data to database: ${err.body}`));
          }
          cb();
        });

        if (this.initialized) {

          // if the database is initialized, upsert the session data
          upsertDocument();

        } else {

          // if the database hasn't been initialized, initialize it, then upsert the session data
          this.initialize(err => {
            if (err) return cb(err);
            upsertDocument();
          });

        }

      } else {
        cb(new Error('The value for the `sid` parameter is not equal to the value of `session.id`.'));
      }

    }

    /**
     * Updates the timestamp of the provided session (by calling the .set() method)
     * @function
     * @method
     * @type {Function}
     * @param {String} sid                            The ID of the session to update
     * @param {Object} session                        The session object
     * @param {Function} [cb = defaultCallback]       The callback to run
     */
    touch(sid, session, cb = defaultCallback) {
      this.set(sid, session, cb);
    }

    /**
     * Upserts the stored procedures to the collection
     * @method
     * @function
     * @return {Promise} Returns a Promise that resolves when the stored procedures are uploaded
     */
    uploadSprocs() {

      const uploadSproc = sproc => new Promise((resolve, reject) => {
        this.client.upsertStoredProcedure(this.collectionLink, this.sprocs[sproc.id], err => {
          if (err) reject(new Error(`Error upserting stored procedure: ${err.body}`));
          resolve();
        });
      });

      const sprocs = Object.keys(this.sprocs).map(key => this.sprocs[key]);
      const promises = sprocs.map(uploadSproc);

      return Promise.all(promises);

    }

  }

  return DocumentDBStore;

};

module.exports = DocumentDBSession;
