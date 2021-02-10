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
            let msg = 'Authentication credentials are invalid';
            console.error(msg, credentials);
            response.setError(req, res, msg);
        }
    } else {
        let msg = 'Authentication header is missing';
        console.error(msg);
        response.setError(req, res, msg);
    }
}

module.exports.authenticationAdmin = async (req, res, next) => {
    let credentials = req.body.authentication;
    if (credentials[0] == params.admin_key && credentials[1] == params.admin_secret) {
        next();
    } else {
        let msg = 'Invalid admin credentials';
        console.error(msg, credentials);
        response.setError(req, res, msg);
    }
}

module.exports.authentication = async (req, res, next) => {
    let credentials = req.body.authentication;
    auth.authenticate(credentials, (result) => {
        if (result) {
            req.body.userdata = result;
            req.body.userplatforms = (Object.keys(result)).map(v => { return v.replace(`${params.platform_prefix}_`, ''); });
            next();
        } else {
            let msg = 'Invalid credentials';
            console.error(msg, credentials);
            response.setError(req, res, msg);
        }
    });
}

module.exports.newuser = async (req, res, next) => {
    if (req.body.newuser) {
        let newuser = req.body.newuser;
        if (typeof newuser.key !== 'undefined'
            && typeof newuser.secret !== 'undefined'
            && newuser.key != ""
            && newuser.secret != ""
            && newuser.key.length >= 16
            && newuser.secret.length >= 16) {
            next();
        } else {
            let msg = 'New user information invalid or missing';
            console.error(msg);
            response.setError(req, res, msg);
        }
    } else {
        let msg = 'New user information missing';
        console.error(msg);
        response.setError(req, res, msg);
    }
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