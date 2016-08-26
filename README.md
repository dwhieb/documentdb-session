# documentdb-session
[![npm version](https://badge.fury.io/js/documentdb-session.svg)](https://badge.fury.io/js/documentdb-session)
[![Build Status](https://travis-ci.org/dwhieb/documentdb-session.svg?branch=master)](https://travis-ci.org/dwhieb/documentdb-session)
[![Dependencies Status](https://david-dm.org/dwhieb/documentdb-session.svg)](https://travis-ci.org/dwhieb/documentdb-session)
[![GitHub issues](https://img.shields.io/github/issues/dwhieb/documentdb-session.svg)](https://github.com/dwhieb/documentdb-session/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/dwhieb/documentdb-session/master/LICENSE)

An Azure DocumentDB store for `express-session`.

## Overview
Used in conjunction with the [`express-session`](https://www.npmjs.com/package/express-session) package, `documentdb-session` saves and retrieves your session data (`req.session`) to and from [DocumentDB](https://azure.microsoft.com/en-us/services/documentdb/), Microsoft Azure's NoSQL database service.

## Features:
* Works with partitioned or single-partition collections.

* Session data can be stored in an existing collection along with other data, or reside in its own collection.

* Supports an optional TTL (time-to-live / expiration) for session data.

* Supports all required, recommended, and optional methods for a session store, as outlined by [`express-session`'s specification](https://github.com/expressjs/session#session-store-implementation).

* Provides an optional `.genid()` method that makes the document ID the same as the session ID. This makes it easy to look up sessions in your database, and helps with debugging.

* Provides an optional `.initialize()` method if you'd like to initialize your database, collection, and stored procedures before making your first request, allowing you to check for errors before making other requests (otherwise the database will be initialized on the first request).

## Install
```
npm install --save documentdb-session
```

## Typical Usage
```
const DocumentDBStore = require('documentdb-session');
const express = require('express');
const session = require('express-session');

const config = {
  host: `https://mydbaccount.documents.azure.com:443/`,
  key:  '8idtLLsiRJsKvgHLi...vgOJ9YXTTYK61LX15pobbmQ=='
};

const app = express();

app.use(session({ store: new DocumentDBStore(config) }));
```

## Config Options
Option            | Default          | Description
----------------- | ---------------- | -----------
`collection`      | `"sessions"` | The ID of the collection where the session data should be stored. If the collection does not exist, it will be created when the session store initializes. The collection may contain other data, or it may be a dedicated collection just for sessions.
`database`        | `"sessionstore"` | The ID of the database where the session data should be stored. If the database does not exist, it will be creaed when the session store initializes.
`discriminator`   | `{ "type": "session" }` | By default, `documentdb-session` sets a `"type"` attribute on each session document with a value of `"session"`, to distinguish session documents from other documents in the collection. If you would like a different attribute or value to be used to discriminate session documents from other documents, enter that as an attribute-value pair in an object here, e.g. `{ "site": "mysite.com" }` or `{ "_type": "session" }`.
`host` (required) | none | The URL / hostname of your DocumentDB database account, usually of the form `https://mydbaccount.documents.azure.com:443/`.
`key` (required)  | none | The primary key for your DocumentDB account. A primary key is required because `documentdb-session` may create a new database for your account, if none exists.
`ttl`             | none | The TTL (time-to-live or expiration time) for your sessions, in seconds. After this time has elapsed since the last change to the session data, the session will be deleted. A session's TTL is extended each time session data is changed, restarting the timer. See more on **Configuring TTL** below.

**NB:** If you'd like to more fully customize the settings for the collection where your session data is stored (e.g. the connection policy and consistency level), you can create the collection in advance, and simply provide the ID of that collection in the `collection` config parameter. `documentdb-session` will then use that collection's settings.

### Configuring TTL (Time-to-Live or Expiration Time)
Because sessions are generally short-lived, and because your application will be creating new sessions frequently, it is a good idea to automatically delete sessions once they have been inactive for a certain period of time. That period of time is the *time-to-live* or *TTL* for a session, and typically you will want this value to be the same as the `maxAge` value of the session cookie. There are two recommended strategies for using TTL with sessions:

**1. Set a default TTL for the entire collection**

Choose this option if sessions are the only type of document in your collection.

`documentdb-session` only sets the `ttl` attribute on individual documents, not the entire collection. In order for automatic deletion to work, you must have the TTL setting turned on for the collection. If you do not, you will have to delete your sessions in some other way. *It is recommended that you enable TTL.* If you enable TTL and set a default TTL for the collection level, it is not necessary to set the `ttl` property here, since DocumentDB will automatically delete documents. But if you only want your session documents to have a TTL (and not all the documents in the collection), you should turn on TTL for the collection without setting a default, and include your desired TTL time in the `ttl` property here. This will delete your sessions when they expire, but not other documents in the collection. You can read more about DocumentDB's TTL feature [here](https://azure.microsoft.com/en-us/documentation/articles/documentdb-time-to-live/).

### Working with Partitioned Collections
If you use partitioned collections, you can enable partitioning in the same way that you would enable it using the [DocumentDB Node.js SDK](https://github.com/Azure/azure-documentdb-node). The session store instance exposes the DocumentDB SDK's [DocumentClient](http://azure.github.io/azure-documentdb-node/DocumentClient.html) object (as `.client`), which you can use to register your partition resolver. A short example is below, and you can see a more complete example of using partition resolver [here](https://github.com/Azure/azure-documentdb-node/blob/master/samples/Partitioning/app.js).

```
const documentdb = require('documentdb');
const DocumentDBStore = require('documentdb-session');

const store = new DocumentDBStore({ /* config options */ });

const PartitionResolver = documentdb.HashPartitionResolver;

const databaseLink = 'dbs/mysessionsdb';
const coll1 = `${databaseLink}/colls/coll1`;
const coll2 = `${databaseLink}/colls/coll2`;

const partitionFunction = doc => {
  /* your partition function */
};

const resolver = new PartitionResolver(partitionFunction, [coll1, coll2]);

store.client.partitionResolvers[databaseLink] = resolver;
```

## Making the Document ID Match the Session ID
TODO (.genid)

## API
`documentdb-session` follows the [specification for session stores](https://github.com/expressjs/session#session-store-implementation) given by `express-session`. It includes all required, recommended, and optional methods, as well as a few extra convenience methods.

### DocumentDBStore
The `DocumentDBStore` object exposed by `documentdb-session` is used to create a new instance of a session store. This may then be passed to `express-session`. See the [Typical Usage]() above for an example.

### .client
The DocumentDB DocumentClient object from the Node.js SDK (complete documentation [here](http://azure.github.io/azure-documentdb-node/DocumentClient.html)). This provides complete access to the DocumentDB API and all its methods, and can be used to customize collection settings, or make other database calls independent of storing session data.

### .all(cb)
Retrieves all sessions from the collection, by filtering on the session discriminator (usually `"type": "session"`).

`callback(err, sessions = [])`

### .clear(cb)
Deletes all sessions from the collection. Callback is fired once the collection is cleared of all sessions. Other documents in the collection that are not sessions are not affected. This operation uses a stored procedure called `clear`, which is uploaded to the collection on initialization.

`callback(err)`

### .destroy(sid, cb)
Deletes a session with the given session ID (`sid`). Callback is fired once the document is deleted.

`callback(err)`

### .genid()
TODO (callback?)

### .get(sid, cb)
Retrieves a session from the collection using the given session ID (`sid`). The session is returned as an object, and includes its administrative database properties (e.g. `_RID`, `_ETAG`). If the session is not found, the `session` object will be set to `null`.

`callback(err, session)`

### .initialize(cb)
Normally, `documentdb-session` will check for a DocumentDB database and collection the first time a request to the database is made, and will create them if they do not exist. It will also upload a few stored procedures to the collection. If you would like to initialize the database before you start making database calls, you can do so by calling `.initialize()`. This is useful if you want your application to check for database configuration errors before attempting to write sessions, and for testing.

`callback(err)`

**Example**

```
...

const app = express();
const store = new DocumentDBStore(config);

app.use(session({ store }));

store.initialize((err, db) => {
  if (err) throw new Error('Could not initialize database');
  console.log(`Database ${db.id} successfully initialized.`);
});
```

### .length(cb)
Retrieves a count of the number of sessions in the collection, filtering on the session discriminator (usually `"type": "session"`). This operation uses a stored procedure called `length`, which is uploaded to the collection on initialization.

`callback(err, len)`

### .set(sid, session, cb)
Upserts the session into the collection given a session ID (`sid`) and session object (`session`). The callback fires once the session has been added to the collection.

`callback(err)`

### .touch(sid, session, cb)
Resets the TTL (time-to-live) for the session (see the `ttl` config option above). The callback fires onces the document has been updated. This operation uses a stored procedure called `touch`, which is uploaded to the collection on initialization.

`callback(err)`


## Tests
Testing is done using [Jasmine](http://jasmine.github.io/), and tests are run automatically using [Travis CI](https://travis-ci.org/dwhieb/documentdb-session). To run the tests yourself:

1. Make sure Jasmine is installed (`npm install --save-dev Jasmine`).

2. Set the following environment variables using the settings for the DocumentDB database account you'd like to test with:
  - `DOCUMENTDB_URL`: The URL/hostname of your database account, e.g. `https://mydbaccount.documents.azure.com:443/`.

  - `DOCUMENTDB_KEY`: The primary/master key for your account, e.g. `8idtLLsiRJsKvgHLizvuKDVBlsTswCT5fOzR7jIYwN0k7tINMQpgkwXAiSzJX4UvgOJ9YXTTYK61LX15pobbmQ==`. A primary key is required because this package creates a new database if one doesn't already exist.

3. Run `npm test`.

**NB:** The tests will create and then delete a single test database and collection. This means you will be charged a very small amount for the time the collection existed. You can read more about DocumentDB's pricing [here](https://azure.microsoft.com/en-us/pricing/details/documentdb/).

## Issues & Contributing
[Issues](https://github.com/dwhieb/documentdb-session/issues), [feature requests](https://github.com/dwhieb/documentdb-session/issues), & pull requests welcome!
