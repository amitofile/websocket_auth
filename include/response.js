module.exports.setResult = (req, res, result, code) => {
    let _code = code || 200;
    res.setHeader('Content-Type', 'application/json');
    return res
        .status(_code)
        .json({ "status": "success", "result": result })
        .end();
}

module.exports.setError = (req, res, error, code) => {
    let _code = code || 401;
    res.setHeader('Content-Type', 'application/json');
    return res
        .status(_code)
        .json({ "status": "error", "error": error })
        .end();
}
