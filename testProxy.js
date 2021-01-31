const httpProxy = require('http-proxy');
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('./include/ssl/key.cer'),
    cert: fs.readFileSync('./include/ssl/certificate.cer'),
};

var proxy = new httpProxy.createProxyServer({
    target: 'ws://127.0.0.1:3000',
    secure: false,
    ssl: options
});
var proxyServer = https.createServer(options, function (req, res) {
    proxy.web(req, res);
});

proxyServer.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head);
});

proxyServer.listen(8099);