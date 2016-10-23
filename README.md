# documentdb-session
[![npm](https://img.shields.io/npm/v/documentdb-session.svg?maxAge=2592000)](https://www.npmjs.com/package/documentdb-session)
[![Build Status](https://travis-ci.org/dwhieb/documentdb-session.svg?branch=master)](https://travis-ci.org/dwhieb/documentdb-session)
[![npm](https://img.shields.io/npm/dt/documentdb-session.svg?maxAge=2592000)](https://www.npmjs.com/package/documentdb-session)
[![David](https://img.shields.io/david/dwhieb/documentdb-session.svg?maxAge=2592000)](https://github.com/dwhieb/documentdb-session)
[![GitHub issues](https://img.shields.io/github/issues/dwhieb/documentdb-session.svg)](https://github.com/dwhieb/documentdb-session/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/dwhieb/documentdb-session/master/LICENSE)

[![GitHub forks](https://img.shields.io/github/forks/dwhieb/documentdb-session.svg?style=social&label=Fork&maxAge=2592000)](https://github.com/dwhieb/documentdb-session)
[![GitHub stars](https://img.shields.io/github/stars/dwhieb/documentdb-session.svg?style=social&label=Star&maxAge=2592000)](https://github.com/dwhieb/documentdb-session)

An Azure DocumentDB store for `express-session`.

## Overview
Used in conjunction with the [`express-session`](https://www.npmjs.com/package/express-session) package, `documentdb-session` saves and retrieves your session data (`req.session`) to and from [DocumentDB](https://azure.microsoft.com/en-us/services/documentdb/), Microsoft Azure's NoSQL database service.

## Features:
* Works with partitioned or single-partition collections.

* Session data can be stored in an existing collection along with other data, or reside in its own collection.

* Supports an optional TTL (time-to-live / expiration) for session data.

* Supports all required, recommended, and optional methods for a session store, as outlined by [`express-session`'s specification](https://github.com/expressjs/session#session-store-implementation).

* Makes the DocumentDB document ID for the session the same as the session ID. This makes it easy to look up sessions in your database, and helps with debugging.

* Provides an optional `.initialize()` method if you'd like to initialize your database, collection, and stored procedures before making your first request, allowing you to check for errors before making other requests (otherwise the database will be initialized on the first request).

## Install
```bash
npm install --save documentdb-session
```

## Typical Usage
```js
const DocumentDBSession = require('documentdb-session');
const express = require('express');
const session = require('express-session');

// pass the express-session object to documentdb-session
const DocumentDBStore = DocumentDBSession(session);

// you could pass the express-session object when you require the module if you'd prefer:
// const DocumentDBStore = require('documentdb-session')(session);

const config = {
  host: `https://mydbaccount.documents.azure.com:443/`,
  key:  '8idtLLsiRJsKvgHLi...vgOJ9YXTTYK61LX15pobbmQ==',
  ttl:  28800 // expire document in 8 hours (in seconds)
};

const app = express();

app.use(session({
  cookie: {
    maxAge: 28800000, // expire cookie in 8 hours (in milliseconds),
  },
  resave: false,
  saveUninitialized: false,
  secret: 'mycookiesecret',
  store: new DocumentDBStore(config) // pass the DocumentDB session store to express-session
}));
```

## Config Options
Option            | Default          | Description
----------------- | ---------------- | :----------
`collection`      | `"sessions"` | The ID of the collection where the session data should be stored. If the collection does not exist, it will be created when the session store initializes. The collection may contain other data, or it may be a dedicated collection just for sessions.
`database`        | `"sessionstore"` | The ID of the database where the session data should be stored. If the database does not exist, it will be creaed when the session store initializes.
`discriminator`   | `{ type: "session" }` | By default, `documentdb-session` sets a `"type"` attribute on each session document with a value of `"session"`, to distinguish session documents from other documents in the collection. If you would like a different attribute or value to be used to discriminate session documents from other documents, enter that as an attribute-value pair in an object here, e.g. `{ site: "mysite.com" }` or `{ _type: "session" }`.
`host` (required) | none | The URL / hostname of your DocumentDB database account, usually of the form `https://mydbaccount.documents.azure.com:443/`. You can also provide this in an environment variable, (`DOCUMENTDB_URL`) instead.
`key` (required)  | none | The primary key for your DocumentDB account. A primary key is required because `documentdb-session` may create a new database for your account, if none exists. You can also provide this in an environment variable (`DOCUMENTDB_KEY`) instead.
`ttl`             | none | The TTL (time-to-live or expiration time) for your sessions, in seconds. After this time has elapsed since the last change to the session data, the session will be deleted. A session's TTL is extended each time session data is changed, restarting the timer. See more on [**Configuring TTL**](https://github.com/dwhieb/documentdb-session#configuring-ttl-time-to-live-or-expiration-time) below. *Enabling TTL is strongly recommended.*

**NB:** If you'd like to more fully customize the settings for the collection where your session data is stored (e.g. the connection policy and consistency level), you can create the collection in advance, and simply provide the ID of that collection in the `collection` config parameter. `documentdb-session` will then use that collection's settings.

### Configuring TTL (Time-to-Live or Expiration Time)
Because sessions are generally short-lived, and because your application will be creating new sessions frequently, it is a good idea to automatically delete sessions once they have been inactive for a certain period of time. That period of time is the *time-to-live* or *TTL* for a session, and typically you will want this value to be the same as the `maxAge` value of the session cookie. There are two recommended strategies for using TTL with sessions:

**1. Set a default TTL for the entire collection**

Choose this option if sessions are the only type of document in your collection. This will automatically delete every document in the collection once it has been inactive (not changed or updated) for the time specified by the TTL. If you choose this option, you do not need to set the `ttl` config property in `documentdb-session`.

**Important:** *If you have other, non-session data in your collection, do **not** set a default TTL for the collection, or ALL your documents will be deleted once they expire.*

You can set a default TTL for the collection either by calling the `.replaceCollection()` method of the DocumentDB Node.js SDK and including an attribute `"defaultTtl": {your TTL, in seconds}`, or by going to the Settings blade for the collection in the [Azure Portal](https://portal.azure.com/) and choosing `On` and providing a default value.

**2. Only set a TTL for session documents**

Choose this option if you will be storing other kinds of data besides just sessions in your collection. With this option, each session document will be given a `ttl` attribute with the value you specify in the `documentdb-session` config object (see the config options [above](https://github.com/dwhieb/documentdb-session#config-options)). The session documents will be deleted after they expire, but not the other documents in your collection (unless they also have a `ttl` property on them).

To configure TTL for session documents, include a value for `ttl` in the `documentdb-session` config object, and make sure that your collection has TTL enabled, but without a default expiration time. `documentdb-session` will not enable TTL on the collection unless it creates the collection during initialization; if you created your own collection, you will need to enable TTL manually.

To enable TTL without a default expiration, either call the `.replaceCollection()` method of the DocumentDB Node.js SDK and include an attribute `"defaultTtl": -1`, or go to the Settings blade for the collection in the [Azure Portal](https://portal.azure.com/) and select `On (no default)`.

(You can read more about DocumentDB's TTL feature [here](https://azure.microsoft.com/en-us/documentation/articles/documentdb-time-to-live/).)

### Working with Partitioned Collections
If you use partitioned collections, you can enable partitioning in the same way that you would enable it using the [DocumentDB Node.js SDK](https://github.com/Azure/azure-documentdb-node). The session store instance exposes the DocumentDB SDK's [DocumentClient](http://azure.github.io/azure-documentdb-node/DocumentClient.html) object (as `.client`), which you can use to register your partition resolver. A short example is below, and you can see a more complete example of using a partition resolver [here](https://github.com/Azure/azure-documentdb-node/blob/master/samples/Partitioning/app.js).

```js
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

## API
`documentdb-session` follows the [specification for session stores](https://github.com/expressjs/session#session-store-implementation) given by `express-session`. It includes all required, recommended, and optional methods, as well as a few extra convenience methods.

### DocumentDBSession
The `DocumentDBSession` method is exposed by requiring `documentdb-session`. Calling this function and passing it the `express-session` instance will return the [DocumentDBStore constructor](https://github.com/dwhieb/documentdb-session#documentdbstore). Example use:

```js
const session = require('express-session');
const DocumentDBStore = require('documentdb-session')(session);
const store = new DocumentDBStore({ /* config options */ });
```

### DocumentDBStore
The `DocumentDBStore` constructor exposed by `documentdb-session` is used to create a new instance of a session `store` object. Calling this function and passing it an object with config options will return the new DocumentDB store object. This may then be passed to `express-session`. See the [Typical Usage](https://github.com/dwhieb/documentdb-session#typical-usage) and [DocumentDBSession](https://github.com/dwhieb/documentdb-session#documentdbsession) sections above for examples.

### store.client
The DocumentDB DocumentClient object from the Node.js SDK (complete documentation [here](http://azure.github.io/azure-documentdb-node/DocumentClient.html)). This provides complete access to the DocumentDB API and all its methods, and can be used to customize collection settings, or make other database calls independent of storing session data.

### store.all(cb)
Retrieves all sessions from the collection, by filtering on the session discriminator (usually `"type": "session"`).

```js
callback(err, sessions = [])
```

### store.clear(cb)
Deletes all sessions from the collection. Callback is fired once the collection is cleared of all sessions. Other documents in the collection that are not sessions are not affected. This operation uses a stored procedure called `clear`, which is uploaded to the collection on initialization.

```js
callback(err)
```

### store.destroy(sid, cb)
Deletes a session with the given session ID (`sid`). Callback is fired once the document is deleted.

```js
callback(err)
```

### store.get(sid, cb)
Retrieves a session from the collection using the given session ID (`sid`). The session is returned as an object, and includes its administrative database properties (e.g. `_RID`, `_ETAG`). If the session is not found, the `session` object will be set to `null`.

```js
callback(err, session)
```

### store.initialize(cb)
Normally, `documentdb-session` will check for a DocumentDB database and collection the first time a request to the database is made, and will create them if they do not exist. It will also upload a few stored procedures to the collection. If you would like to initialize the database before you start making database calls, you can do so by calling `.initialize()`. This is useful if you want your application to check for database configuration errors before attempting to write sessions, and for testing.

```js
callback(err)
```

**Example**

```js
const app = express();
const store = new DocumentDBStore(config);

app.use(session({ store }));

store.initialize((err, db) => {
  if (err) throw new Error('Could not initialize database');
  console.log(`Database ${db.id} successfully initialized.`);
});
```

### store.length(cb)
Retrieves a count of the number of sessions in the collection, filtering on the session discriminator (usually `"type": "session"`). This operation uses a stored procedure called `length`, which is uploaded to the collection on initialization.

```js
callback(err, len)
```

### store.set(sid, session, cb)
Upserts the session into the collection given a session ID (`sid`) and session object (`session`). The callback fires once the session has been added to the collection.

```js
callback(err)
```

### store.touch(sid, session, cb)
Resets the TTL (time-to-live) for the session (see the [`ttl` config option](https://github.com/dwhieb/documentdb-session#config-options) above). The callback fires onces the document has been updated. This operation works by updating the `lastActive` field on the document.

```js
callback(err)
```


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

### Git Workflow
* `master` - Only contains stable, tested code. New versions are published to npm from here. Pull requests to `master` must pass all required Travis-CI checks, and use a squash commit.
* `dev` - Contains code for the next version. Prerelease versions are published to npm from here.

Pull requests can be made to either `dev` or `master`.
