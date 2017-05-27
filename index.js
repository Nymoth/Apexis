const http = require('http');
const https = require('https');
const Datastore = require('nedb');

const db = new Datastore({ filename: './data', autoload: true });

const server = http.createServer((req, res) => {
  const url = req.url.replace(/^\/\?p=/, '');
  const ssl = /^https:/.test(url);
  const host = url.replace(/^https?:\/\//, '');
  
  const method = req.method;
  const hostname = host.split('/')[0];
  const path = host.replace(hostname, '');

  const rawRequestString = `${method} http${ssl ? 's' : ''}://${hostname}${path}`;

  console.log(`Apexis | Request: ${rawRequestString}`);

  const protocol = ssl ? https : http;
  const agentOptions = { method, hostname, path };
  const agent = protocol.request(agentOptions, r => {
    const chunks = [];
    r.on('data', chunk => chunks.push(chunk));
    r.on('end', () => {
      const data = Buffer.concat(chunks).toString();

      console.log(`Apexis | Request: OK`);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.write(data);
      res.end();

      console.log('Apexis | Saving request');
      const dbData = {
        _id: rawRequestString,
        res: data
      }
      db.update({ _id: rawRequestString }, dbData, { upsert: true }, (err, newDoc) => {
        if (err) {
          console.log(`Apexis | Database error when trying to save request: ${err.message}`);
        } else {
          console.log('Apexis | Request saved!');
        }
      });
    });
  });
  agent.on('error', err => {
    console.log(`Apexis | Request: Error: ${err.message}`);
    console.log(`Apexis | Searching in database`);

    db.findOne({ _id: rawRequestString }, (err, doc) => {
      if (err) {
        console.log(`Apexis | Database error: ${err.message}`);
        res.writeHead(500);
        res.end();
      } else {
        if (doc === null) {
          console.log('Apexis | Request was not saved');
          res.writeHead(404);
          res.end();
        } else {
          console.log('Apexis | Request found!');
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.write(JSON.stringify(doc.res));
          res.end();
        }
      }
    });  
  });

  agent.end();
});

server.listen('40000');
console.log('Apexis | ON at localhost:40000');
