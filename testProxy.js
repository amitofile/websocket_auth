const httpProxy = require('http-proxy');
const http = require('http');

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
var proxyServer = http.createServer(function (req, res) {
    proxy.web(req, res);
});

proxyServer.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head);
});

proxyServer.listen(8099);