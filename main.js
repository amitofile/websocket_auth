const app = require('express')();
const httpProxy = require('http-proxy');
const http = require('http');
const bodyParser = require('body-parser');
const config = require('config');


const check = require('./include/middleware');
const auth = require('./include/auth');
const response = require('./include/response');


const params = config.get('default');

// Encode URL/Requests for entire application
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

var proxyServer = http.createServer(app).listen(params.port);

proxyServer.on('upgrade', function (req, socket, head) {
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

proxy.on('open', function (proxySocket) {
    console.log(proxySocket.id);
});