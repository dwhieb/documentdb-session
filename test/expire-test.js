const DocumentDB = require('documentdb');

const db = new DocumentDB.DocumentClient(process.env.DOCUMENTDB_URL, {
  masterKey: process.env.DOCUMENTDB_KEY
});

const collectionLink = 'dbs/sessionstore/colls/sessions';

// the test document to upsert
const body = {
  id: 'expire-test',
  ttl: 5 // set a TTL for 5 seconds
};

// upsert the test document
db.upsertDocument(collectionLink, body, (err, res) => {
  if (err) throw new Error(err.body);

  const readDocument = () => {

    const documentLink = `${collectionLink}/docs/${body.id}`;

    db.readDocument(documentLink, (err, res) => {
      if (err) throw new Error(err.body);

      if (err && err.code == 409) {
        console.log('Document expired successfully!');
      } else if (err) {
        throw new Error(err.body);
      } else {
        console.error('Found a document:');
        console.log(res);
      }

    });

  };

  setTimeout(readDocument, 6000); // after 6 seconds, try to read the document

});
