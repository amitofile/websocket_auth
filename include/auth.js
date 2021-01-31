const config = require('config');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

const params = config.get('default');
const redis = new Redis(config.get('redis_config'));

redis.client('setname', 'feed_locker', (err) => {
    if (err) {
        console.error(err);
    }
    console.log("Redis connection established");
});

module.exports.authenticate = (credentials, status) => {
    if (params.DEBUG) console.log('Authenticating credentials', credentials);
    redis.hget(credentials[0], 'secret', (err, val) => {
        if (err) console.error(err);
        if (params.DEBUG) console.log('Received value', val);
        if (val == credentials[1]) {
            status(true);
        } else {
            status(false);
        }
    });
}

module.exports.getToken = (credentials, expiry, result) => {
    let data = {
        sub: credentials[0],
    };
    let token = jwt.sign(data, params.secret, { expiresIn: 60 * (expiry || params.expiry) });
    if (params.DEBUG) console.log(token);
    redis.hset(credentials[0], 'token', token, 'expiry', expiry, (err) => {
        if (err) console.error(err);
        result(token);
    });
}

module.exports.checkToken = (token, result) => {
    jwt.verify(token, params.secret, (err, decoded) => {
        if (err) {
            console.error(err);
            result(null);
        };
        result(decoded);
    });
}

module.exports.verifyToken = (consumerKey, token, status) => {
    if (params.DEBUG) console.log('Verifying token', token, 'against', consumerKey);
    redis.hget(consumerKey, 'token', (err, val) => {
        if (err) console.error(err);
        if (params.DEBUG) console.log('Received value', val);
        if (val == token) {
            status(true);
        } else {
            status(false);
        }
    });
}

