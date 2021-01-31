const config = require('config');
const url = require('url');

const response = require('./response');
const auth = require('./auth');

const params = config.get('default');

module.exports.credentials = (req, res, next) => {
    if (params.DEBUG) console.log('Authenticating request...');
    if (typeof req.body.authentication === "string") {
        if (params.DEBUG) console.log('Received authentication header', req.body.authentication);
        let credentials = Buffer.from(req.body.authentication, "base64").toString("utf8").split(":");
        if (typeof credentials === "object" && credentials.length == 2 && credentials[0].length >= 16 && credentials[1].length >= 16) {
            req.body.authentication = credentials;
            next();
        } else {
            console.error('Authentication credentials are invalid', credentials);
            response.setError(req, res, "Authentication credentials are invalid");
        }
    } else {
        console.error('Authentication header is missing');
        response.setError(req, res, "Authentication header is missing");
    }
}

module.exports.authentication = async (req, res, next) => {
    let credentials = req.body.authentication;
    auth.authenticate(credentials, (status) => {
        if (status) {
            next();
        } else {
            console.error('Invalid credentials', credentials);
            response.setError(req, res, "Invalid credentials");
        }
    });
}

module.exports.accessToken = (req) => {
    let headers = req.headers;
    if (typeof headers.authorization === 'string') {
        return headers.authorization.split(' ')[1];
    }
    let urlpart = url.parse(req.url, true);
    if (typeof urlpart.query.access_token !== 'undefined') {
        return urlpart.query.access_token;
    }
    return null;
}