const config = require('config');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const moment = require('moment');
const params = config.get('default');
const redis = new Redis(config.get('redis_config'));

redis.client('setname', 'feed_locker', (err) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Redis connection established");
    }
});

module.exports.register = (newuser, result) => {
    if (params.DEBUG) console.log('Resistering newuser...');
    try {
        let status = {};
        let key = newuser.key;
        redis.del(key, (err) => {
            if (err) {
                console.error(err);
                result(null);
            } else {
                if (params.DEBUG) console.log(`Key deleted [${key}]`);
                redis.hset(key, 'secret', newuser.secret, (err) => {
                    if (err) {
                        console.error(err);
                        result(null);
                    } else {
                        if (params.DEBUG) console.log(`Key created [${key}]`);
                        status[key] = "registered!";
                        if (newuser.platforms) {
                            newuser.platforms.forEach(app => {
                                //if (params.DEBUG) console.log('Platform', app);
                                if (typeof app === 'string' && app.length <= 16) {
                                    redis.hset(key, `${params.platform_prefix}_${app}`, '{}', (err) => {
                                        if (err) {
                                            console.error(err);
                                            status[app] = "failed";
                                        } else {
                                            if (params.DEBUG) console.log(`Platform created [${app}]`);
                                            status[app] = "created!";
                                        }
                                    });
                                } else {
                                    if (params.DEBUG) console.log(`Platform failed [${app}]`);
                                    status[app] = "failed";
                                }
                            });
                            status['platforms'] = JSON.stringify(newuser.platforms);
                            result(status);
                        } else {
                            redis.hset(key, `${params.platform_prefix}_default`, '{}', (err) => {
                                if (err) {
                                    console.error(err);
                                    result(status);
                                } else {
                                    if (params.DEBUG) console.log(`Platform created [default]`);
                                    status['platforms'] = "default";
                                    result(status);
                                }
                            });
                        }
                    }
                });
            }
        });
    } catch (err) {
        console.error(err);
        result(null);
    }
}

module.exports.authenticate = (credentials, result) => {
    if (params.DEBUG) console.log('Authenticating credentials', credentials);
    try {
        redis.hgetall(credentials[0], (err, data) => {
            if (err) {
                console.error(err);
                result(false);
            } else {
                if (params.DEBUG) console.log('Received user data', data);
                if (data.secret && data.secret == credentials[1]) {
                    delete data.secret;
                    //let userplatforms = (Object.keys(data)).map(v => { return v.replace(`${params.platform_prefix}_`, ''); });
                    //result(userplatforms);
                    result(data);
                } else {
                    result(false);
                }
            }
        });
    } catch (err) {
        console.error(err);
        status(false);
    }
}

function generateJWT(key, pltfrm, expiry) {
    let platforms = {};
    let data = {
        sub: key,
        scope: pltfrm
    };
    let token = jwt.sign(data, params.secret, { expiresIn: 60 * (expiry || params.expiry) });
    platforms[pltfrm] = {};
    platforms[pltfrm]['token'] = token;
    platforms[pltfrm]['expiry'] = expiry;
    redis.hset(key, `${params.platform_prefix}_${pltfrm}`, JSON.stringify(platforms[pltfrm]), (err) => {
        if (err) {
            console.error(err);
            platforms[pltfrm]['status'] = 'error';
        }
        else {
            platforms[pltfrm]['status'] = 'active';
            platforms[pltfrm];
        }
    });
    return platforms[pltfrm]
}

module.exports.getToken = (credentials, requested_platforms, userplatforms, expiry, result) => {
    if (params.DEBUG) console.log('Generating token...');
    try {
        let platforms = {};
        if (requested_platforms) {
            requested_platforms.forEach(pltfrm => {
                platforms[pltfrm] = {};
                if ((userplatforms).includes(pltfrm)) {
                    platforms[pltfrm] = generateJWT(credentials[0], pltfrm, expiry);
                } else {
                    platforms[pltfrm]['status'] = 'Platform unavailable';
                }
            });
        } else {
            if (userplatforms && userplatforms.length == 1 && userplatforms[0] == 'default') {
                platforms['default'] = generateJWT(credentials[0], 'default', expiry);
            } else {
                platforms['default'] = 'Platform unavailable';
            }
        }
        result(platforms);
    } catch (err) {
        console.error(err);
        result(null);
    }
}

function miliToHrs(ms) {
    let h, m, s;
    h = Math.floor(ms / 1000 / 60 / 60);
    m = Math.floor((ms / 1000 / 60 / 60 - h) * 60);
    s = Math.floor(((ms / 1000 / 60 / 60 - h) * 60 - m) * 60);
    s < 10 ? s = `0${s}` : s = `${s}`
    m < 10 ? m = `0${m}` : m = `${m}`
    h < 10 ? h = `0${h}` : h = `${h}`
    return `${h} hrs ${m} mins ${s} secs`;
}

module.exports.getVerify = (credentials, token, userdata, result) => {
    if (params.DEBUG) console.log('Verifying token...');
    try {
        jwt.verify(token, params.secret, (err, decoded) => {
            if (err) {
                console.error(err);
                result(null);
            } else {
                if (credentials[0] == decoded.sub) {
                    let data = {};
                    if (decoded.sub) {
                        data['consumer_key'] = decoded.sub;
                        data['platform'] = decoded.scope;
                        data['create_time'] = moment.unix(decoded.iat).format("DD-MM-YYYY HH:mm:ss");
                        data['expiry_time'] = moment.unix(decoded.exp).format("DD-MM-YYYY HH:mm:ss");
                        data['expire_in'] = miliToHrs(moment.unix(decoded.exp) - moment());
                        let _token = null;
                        if (typeof userdata[`${params.platform_prefix}_${decoded.scope}`] !== 'undefined') {
                            _token = JSON.parse(userdata[`${params.platform_prefix}_${decoded.scope}`])['token'];
                        }
                        data['status'] = token == _token ? 'active' : 'inactive';
                        result(data);
                    } else {
                        console.error("Invalid token");
                        result(null);
                    }
                }
                else {
                    console.error("Token owner and verifier do not match");
                    result(null);
                }
            }
        });
    } catch (err) {
        console.error(err);
        result(null);
    }
}

module.exports.checkToken = (token, result) => {
    if (params.DEBUG) console.log('Verifying token...');
    try {
        jwt.verify(token, params.secret, (err, decoded) => {
            if (err) {
                console.error(err);
                result(null);
            } else {
                result(decoded);
            }
        });
    } catch (err) {
        console.error(err);
        result(null);
    }
}

module.exports.verifyToken = (jwtData, token, status) => {
    if (params.DEBUG) console.log('Checking token', token, 'against', jwtData.sub);
    try {
        redis.hget(jwtData.sub, `${params.platform_prefix}_${jwtData.scope}`, (err, val) => {
            if (err) {
                console.error(err);
                status(false);
            } else {
                if (val && token == JSON.parse(val)['token']) {
                    status(true);
                } else {
                    console.error("Invalid token");
                    status(false);
                }

            }
        });
    } catch (err) {
        console.error(err);
        status(false);
    }
}

