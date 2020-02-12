'use strict';

const crypto = require('crypto');

let md5 = function (str, encoding) {
    return crypto.createHash('md5').update(str).digest(encoding || 'hex');
};

let getFileMd5 = function (readStream, callback) {
    let md5 = crypto.createHash('md5');
    readStream.on('data', function (chunk) {
        md5.update(chunk);
    });
    readStream.on('error', function (err) {
        callback(err);
    });
    readStream.on('end', function () {
        let hash = md5.digest('hex');
        callback(null, hash);
    });
};

let util = {
    md5: md5,
    getFileMd5: getFileMd5,
};

module.exports = util;
