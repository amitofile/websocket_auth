const app = require('express')();
const httpProxy = require('http-proxy');
const http = require('http');
const bodyParser = require('body-parser');
const config = require('config');
const fs = require('fs');
const check = require('./include/middleware');
const auth = require('./include/auth');
const response = require('./include/response');
const params = config.get('default');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var proxy = new httpProxy.createProxyServer({
    target: "ws://localhost:3000/feeds",
    //ssl: options //uncomment this only if backend require https i.e. wss
});

app.all('/*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, accesstoken");
    next();
});

app.post(`${params.feed_path}${params.register_path}`, check.credentials, check.authenticationAdmin, check.newuser, function (req, res) {
    try {
        auth.register(req.body.newuser, (result) => {
            if (result) {
                response.setResult(req, res, result);
            } else {
                response.setError(req, res, "Failed to register new application");
            }
        });
    } catch (err) {
        console.error(err);
        response.setError(req, res, "Failed to register new application");
    }
});

app.post(`${params.feed_path}${params.token_path}`, check.credentials, check.authentication, function (req, res) {
    try {
        auth.getToken(req.body.authentication, (req.body.platforms || null), req.body.userplatforms, params.expiry, (result) => {
            if (result) {
                response.setResult(req, res, result);
            } else {
                response.setError(req, res, "Failed to generate token");
            }
        });
    } catch (err) {
        console.error(err);
        response.setError(req, res, "Failed to generate token");
    }
});

app.post(`${params.feed_path}${params.verify_path}`, check.credentials, check.authentication, function (req, res) {
    try {
        auth.getVerify(req.body.authentication, (req.body.token || null), req.body.userdata, (result) => {
            if (result) {
                response.setResult(req, res, result);
            } else {
                response.setError(req, res, "Token invalid or expired");
            }
        });
    } catch (err) {
        console.error(err);
        response.setError(req, res, "Failed to verify token");
    }
});

app.all('*', function (req, res) {
    console.error("Service unavailable");
    response.setError(req, res, "Service unavailable");
});

var proxyHttpServer = http.createServer(app).listen(params.http_port, () => {
    console.log("WSAM server listening on port " + params.http_port);
});

proxyHttpServer.on('upgrade', function (req, socket, head) {
    proxyAuthentication(req, socket, head);
});

function proxyAuthentication(req, socket, head) {
    try {
        let token = check.accessToken(req);
        if (token) {
            auth.checkToken(token, (decoded) => {
                if (decoded && typeof decoded.sub !== 'undefined') {
                    auth.verifyToken(decoded, token, (status) => {
                        if (status) {
                            proxy.ws(req, socket, head);
                        }
                    });
                } else {
                    socket.close();
                }
            });
        } else {
            socket.close();
        }
    } catch (err) {
        socket.close();
    }
}

if (params.use_ssl) {
    const https = require('https');

    const options = {
        key: fs.readFileSync('./include/ssl/key.cer'),
        cert: fs.readFileSync('./include/ssl/certificate.cer'),
    };

    var proxyHttpsServer = https.createServer(options, app).listen(params.https_port, () => {
        console.log("WSAM SSL server listening on port " + params.https_port);
    });

    proxyHttpsServer.on('upgrade', function (req, socket, head) {
        proxyAuthentication(req, socket, head);
    });
}
