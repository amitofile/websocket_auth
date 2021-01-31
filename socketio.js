const app = require('express')();
const http = require('http').Server(app);
const https = require('https').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.get('/', (req, res) => {
  res.status(200).send("Hello World").end();
});

const options = {
    key: fs.readFileSync('./include/ssl/key.cer'),
    cert: fs.readFileSync('./include/ssl/certificate.cer'),
};


io.on('connection', (socket) => {
  console.log(`${socket.id} connected`);
  socket.on('pageload', (data)=>{
    console.log(data.inputtoken);
    socket.send(JSON.stringify(data.inputtoken));
  })
});

https.createServer(options, app).listen(8099, () => {
    console.log("Express server listening on port 8099");
});