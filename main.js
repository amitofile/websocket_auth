const app = require('express')();
const httpProxy = require('http-proxy');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const config = require('config');
const fs = require('fs');

const check = require('./include/middleware');
const auth = require('./include/auth');
const response = require('./include/response');

const params = config.get('default');

const options = {
    key: fs.readFileSync('./include/ssl/key.cer'),
    cert: fs.readFileSync('./include/ssl/certificate.cer'),
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var proxy = new httpProxy.createProxyServer({
    target: {
        host: 'localhost',
        port: 3000
    }
});

app.all('/*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, accesstoken");
    next();
});

app.post(`/feeds/token`, check.credentials, check.authentication, function (req, res) {
    try {
        if (params.DEBUG) console.log('Generating token...');
        auth.getToken(req.body.authentication, params.expiry, (token) => {
            response.setResult(req, res, { token: token, expiry: params.expiry });
        });
    } catch (err) {
        response.setError(req, res, "Authentication failure");
    }
});

var proxyHttpServer = http.createServer(app).listen(params.http_port, () => {
    console.log("Express server listening on port " + params.http_port);
});
var proxyHttpsServer = https.createServer(options, app).listen(params.https_port, () => {
    console.log("Express server listening on port " + params.https_port);
});

proxyHttpServer.on('upgrade', function (req, socket, head) {
    let token = check.accessToken(req);
    if (token !== null) {
        auth.checkToken(token, (decoded) => {
            if (decoded && typeof decoded.sub !== 'undefined') {
                auth.verifyToken(decoded.sub, token, (status) => {
                    if (status) {
                        proxy.ws(req, socket, head);
                    }
                });
            }
        });
    }
});

proxyHttpsServer.on('upgrade', function (req, socket, head) {
    let token = check.accessToken(req);
    if (token !== null) {
        auth.checkToken(token, (decoded) => {
            if (decoded && typeof decoded.sub !== 'undefined') {
                auth.verifyToken(decoded.sub, token, (status) => {
                    if (status) {
                        proxy.ws(req, socket, head);
                    }
                });
            }
        });
    }
});
