'use strict';
const path = require('path')
const OSS = require('ali-oss')
const crypto = require('crypto');
const fs = require('fs');

let client = null

const initClient = (config) => {
    return new Promise((resolve, reject) => {
        client = new OSS({
            region: config.region,
            accessKeyId: config.secretId,
            accessKeySecret: config.secretKey,
            bucket: config.bucket
        });
        resolve(true);
    })
}

const getMD5 = (file) => {
    return new Promise((resolve, reject) => {
        var rs = fs.createReadStream(file);
        var hash = crypto.createHash('md5');
        rs.on('data', hash.update.bind(hash));
        rs.on('end', function () {
          resolve(hash.digest('hex'));
        });
        rs.on('error', function(err) {
            reject(err);
        });
    });
}

function ossUpload(config, filePath, fileFullPath) {
    return new Promise((resolve, reject) => {
        let localFile = fileFullPath;
        if (/^".+"$/.test(localFile)) {
            localFile = fileFullPath.substring(1, filePath.length - 1)
        }

        if(client && client.bucket === config.bucket) {
            client.put(filePath, localFile).then(data => {
                data.name = path.basename(localFile, '.png');
                resolve(data);
            }).catch(err => {
                reject(err);
            });
        } else {
            initClient(config).then(() => {
                client.put(filePath, localFile).then(data => {
                    data.name = path.basename(localFile, '.png');
                    resolve(data);
                }).catch(err => {
                    reject(err);
                });
            }).catch(err => {
                reject(err);
            });
        }
    })
}

function ossList(config) {
    return new Promise((resolve, reject) => {
        if(client && client.bucket === config.bucket) {
            client.list({'max-keys':1000}).then((data) => {
                let cosFileMap = new Map();
                if(data.objects === undefined || data.objects.length === 0){
                    resolve(cosFileMap);
                }
                data.objects.forEach((item) => {
                    cosFileMap.set(
                        item.name,
                        item.etag
                    );
                });
                resolve(cosFileMap);
            }).catch(err => {
                reject(err);
            });
        } else {
            initClient(config).then(() => {
                client.list({'max-keys':1000}).then((data) => {
                    let cosFileMap = new Map();
                    if(data.objects === undefined || data.objects.length === 0){
                        resolve(cosFileMap);
                    }
                    data.objects.forEach((item) => {
                        cosFileMap.set(
                            item.name,
                            item.etag
                        );
                    });
                    resolve(cosFileMap);
                }).catch(err => {
                    reject(err);
                });
            }).catch(err => {
                reject(err);
            });
        }
    });
}

function ossDeleteMulti(config, files) {
    return new Promise(async (resolve, reject) => {
        if(files === undefined || files.length === 0){
            reject('files is null');
        }

        if(client && client.bucket === config.bucket) {
            let result = await client.deleteMulti(files);
            resolve(result);
        } else {
            initClient(config).then(async () => {
                let result = await client.deleteMulti(files);
                resolve(result);
            }).catch(err => {
                reject(err);
            });
        }
    });
}

module.exports.ossUpload = ossUpload;
module.exports.ossList = ossList;
module.exports.ossDeleteMulti = ossDeleteMulti;