const httpProxy = require('http-proxy');
const https = require('https');

const options = {
    key: fs.readFileSync('./include/ssl/key.cer'),
    cert: fs.readFileSync('./include/ssl/certificate.cer'),
};

var proxy = new httpProxy.createProxyServer({
    target: {
        host: 'localhost',
        port: 9015
    },
    ssl: {
        key: fs.readFileSync('./include/ssl/key.cer', 'utf8'),
        cert: fs.readFileSync('./include/ssl/certificate.cer', 'utf8')
    }
});
var proxyServer = https.createServer(options, function (req, res) {
    proxy.web(req, res);
});

proxyServer.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head);
});

proxyServer.listen(8099);