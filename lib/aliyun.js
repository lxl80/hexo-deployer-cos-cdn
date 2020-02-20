'use strict';
const Core = require('@alicloud/pop-core');

let client = null;

const initClient = (config) => {
    if (client !== null && client.accessKeyId === config.accessKeyId && client.accessKeySecret === config.accessKeySecret) {
        return;
    }
    return new Promise((resolve, reject) => {
        client = new Core({
            accessKeyId: config.secretId,
            accessKeySecret: config.secretKey,
            endpoint: 'http://cdn.aliyuncs.com',
            apiVersion: '2018-05-10'
        });
        resolve(true);
    }).catch((err) => {
        console.log(err);
    });
}

/**
 * 刷新CDN缓存
 * @param {*} config 
 * @param {*} pathList  需要刷新的文件url列表
 */
function cdnRefresh(config, pathList) {
    return new Promise((resolve, reject) => {
        initClient(config).then(() => {
            client.request('RefreshObjectCaches', {
                'RegionId': config.region,
                'ObjectPath': pathList.join('\n')
            }, {
                method: 'POST'
            }).then((result) => {
                // console.log(JSON.stringify(result));
                resolve(result);
            }, (ex) => {
                console.log(ex);
                reject(ex);
            })
        }).catch(err => {
            reject(err);
        });
    });
}

module.exports.cdnRefresh = cdnRefresh;