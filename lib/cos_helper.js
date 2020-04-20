'use strict';
const fs = require('hexo-fs');
const COS = require('cos-nodejs-sdk-v5');
const util = require('./util');
const path = require('path');
const chalk = require('chalk');
const QCSDK = require('./qcloud');
const oss = require('./oss');
const aliyun = require('./aliyun');

/**
 * 腾讯云COS上传及CDN刷新处理主程序。处理逻辑详见 README.md
 */
module.exports = function cosHelper() {
    //配置验证
    let cfgs = checkConfigs(this.config);
    if (!cfgs) { return }

    const publicDir = this.public_dir;
    //本地文件集合，如果图片与文件分别发布到各自的bucket，则此集合不包括图片文件。
    let localFileMap = new Map();
    //本地图片集合
    let localImgsMap = new Map();

    loadLocalFiles(cfgs, publicDir, localFileMap, localImgsMap);

    return deploy(localFileMap, cfgs, false, publicDir)
        .then(() => {
            if (cfgs.imageConfig) {
                return deploy(localImgsMap, cfgs.imageConfig, true, publicDir);
            }
        })
        .then(() => {
            if (cfgs.updatePosts) {
                let postsDir = path.join(this.source_dir, '_posts');
                updatePosts(postsDir, cfgs);
            }
        });
};

/**
 * 替换 markdown 源文中图片相对路径为 CDN 地址
 * @param {*} postsDir 
 * @param {*} cfgs 
 */
function updatePosts(postsDir, cfgs) {
    let strRegExp = '';
    if (cfgs.imageConfig) {
        strRegExp = '(!\\[[^\\]]*\\]\\()([.\\/]*' + cfgs.imageConfig.folder + '\\/)([^\\)]*)';
    } else {
        strRegExp = '(!\\[[^\\]]*\\]\\()([.\\/]*\\/)([^\\)]*)';
    }
    let imgRegExp = new RegExp(strRegExp, 'gi');
    let cdnUrl = cfgs.imageConfig ? cfgs.imageConfig.cdnUrl : cfgs.cdnUrl;

    getFiles(postsDir, (file) => {
        //如果是图片目录，将目录内图片文件列表写入 localImgsMap 对象，将上传到单独的 bucket
        if (!file.match(/\.md$/i) && !file.match(/\.markdown$/i)) {
            return;
        }
        let data = fs.readFileSync(path.join(postsDir, file));
        if (imgRegExp.test(data)) {
            //存在相对路径图片地址，替换相对路径为 CDN 加速路径
            var i = 0;
            data = data.replace(imgRegExp, function (all, before, main, after) {
                i++;
                return before + cdnUrl + after;
            });
            //更新临时目录中图片路径，public目录中文件不做修改，并行发布到github的话，保持相对路径
            fs.writeFileSync(path.join(postsDir, file), data);
            console.log(chalk.green('替换 ' + i + ' 个图片为 CDN 路径，所属博文：' + file));
        }
    });
}

/**
 * 加载本地文件，并同步重新生成包含相对路径图片且内容发生变更博文的缓存
 * @param {*} cfgs 
 * @param {*} publicDir 
 * @param {*} localFileMap
 * @param {*} localImgsMap 
 */
function loadLocalFiles(cfgs, publicDir, localFileMap, localImgsMap) {
    if (!cfgs.imageConfig) {
        //图片未单独配置bucket,获取 publicDir目录中的文件列表，将图片和文件统一加入到 localFileMap 中。
        getFiles(publicDir, (file) => {
            localFileMap.set(getUploadPath(file), path.join(publicDir, file));
        });
    } else {
        getFiles(publicDir, (file) => {
            let uploadDir = path.join(publicDir, '../.coscache');
            let strRegExp = '(src="|content="|href=")([^"]*?\/' + cfgs.imageConfig.folder + '\/)([^"]*?[\.jpg|\.jpeg|\.png|\.gif|\.zip]")';
            let imgRegExp = new RegExp(strRegExp, 'gi');
            //如果是图片目录，将目录内图片文件列表写入 localImgsMap 对象，将上传到单独的 bucket
            if (file.match(cfgs.imageConfig.folder)) {
                localImgsMap.set(getUploadPath(file).replace(cfgs.imageConfig.folder + '\/', ''), path.join(publicDir, file));
            }
            else {
                if (file.match(/\.html$/)) {
                    let data = fs.readFileSync(path.join(publicDir, file));
                    if (imgRegExp.test(data)) {
                        //存在相对路径图片地址，替换相对路径为 CDN 加速路径，然后判读原文是否发生变更
                        var i = 0;
                        data = data.replace(imgRegExp, function (all, before, main, after) {
                            i++;
                            return before + cfgs.imageConfig.cdnUrl + after;
                        });
                        
                        if(fs.existsSync(path.join(uploadDir, file))){
                            let cacheData = fs.readFileSync(path.join(uploadDir, file));
                            if(data !== cacheData){
                                //更新临时目录中图片路径，public目录中文件不做修改，并行发布到github的话，保持相对路径
                                fs.writeFileSync(path.join(uploadDir, file), data);
                                console.log(chalk.green('替换 ' + i + ' 张图片地址为CDN路径，所属文件：' + file));
                            }
                        }else{
                            fs.writeFileSync(path.join(uploadDir, file), data);
                            console.log(chalk.green('替换 ' + i + ' 张图片地址为CDN路径，所属文件：' + file));
                        }
                        
                        localFileMap.set(getUploadPath(file), path.join(uploadDir, file));
                    } else {
                        //如果正则不匹配，不对地址进行替换，直接写入原路径
                        localFileMap.set(getUploadPath(file), path.join(publicDir, file));
                    }
                } else {
                //如果不是 HTML文件，直接写入原路径
                    localFileMap.set(getUploadPath(file), path.join(publicDir, file));
                }
            }
        });
    }
}

/**
 * 对比云端与本地文件，上传更新文件，刷新CDN缓存
 * @param {*} localFileMap 
 * @param {*} cfgs 
 * @param {*} isImageFolder 是否是图片目录
 */
function deploy(localFileMap, cfgs, isImageFolder, publicDir) {
    if (localFileMap.size < 1) {
        if (isImageFolder) {
            console.log(chalk.cyan(cfgs.bucket + ' 没有需要上传的文件！'));
        } else {
            console.log(chalk.red('本地文件加载失败！'));
        }
        return;
    }
    //console.log(chalk.cyan('从 ' + cfgs.bucket + ' 获取远程文件列表..'));
    const cos = new COS({
        SecretId: cfgs.secretId,
        SecretKey: cfgs.secretKey
    });
    return getCosFiles(cos, cfgs)
        .then(cosFileMap => {
            if (cosFileMap.size === 0) {
                console.log(chalk.cyan('远程仓库为空，开始上传全部文件..'));
            }
            //console.log(chalk.cyan('对比本地和远程文件差异..'));
            return diffFileList(localFileMap, cosFileMap, cfgs);
        })
        .then(allFiles => {
            if (!cfgs.deleteExtraFiles || allFiles.extraFiles.length < 1) {
                return allFiles.uploadFiles;
            }
            return deleteFile(cos, cfgs, allFiles.extraFiles)
                .then(() => {
                    console.log(chalk.cyan('成功删除 %s 个云端多余文件:'), allFiles.extraFiles.length, allFiles.extraFiles);
                    return allFiles.uploadFiles;
                })
                .catch(err => {
                    console.log(err);
                })
        })
        .then(uploadFiles => {
            if(!uploadFiles || uploadFiles.size < 1){
                console.log(chalk.cyan('没有文件需要发布到：', cfgs.bucket));
                return;
            }
            console.log('正在上传 %s 个文件：', uploadFiles.size);
            return uploadFile(cos, cfgs, uploadFiles)
                .then((data) => {
                    if (data === 'ok') {
                        console.log(chalk.cyan('全部文件上传完成！'));
                    }
                    return uploadFiles;
                })
                .then((filesMap) => {
                    if (!cfgs.cdnEnable) {
                        return;
                    }
                    return cacheRefresh(cfgs, filesMap)
                        .then((res) => {
                            if (res !== false) {
                                console.log(chalk.cyan('刷新CDN缓存完成！'));
                            }
                        });
                })
                .catch((err) => {
                    console.log(chalk.red('部署期间出现异常'));
                    console.log(err);
                });
        })
        .catch(err => {
            console.log(chalk.red('获取远程文件失败！'));
            console.log(err);
        });
}

/**
 * 遍历目录dir，获取文件路径列表，遍历列表调用回调函数
 * @param {string} dir
 * @param {function}  callback
 */
function getFiles(dir, callback) {
    fs.listDirSync(dir).forEach((filePath) => {
        callback(filePath);
    });
}

/**
 * 获取上传文件的路径
 * @param {string} absPath
 * @return {string}
 */
function getUploadPath(absPath) {
    return absPath.split(path.sep).join('/');
}

/**
 * 更新CDN缓存
 * @param  {[type]} cfgs     [description]
 * @param  {[type]} filesMap [description]
 * @return {[type]}          [description]
 */
function cacheRefresh(cfgs, filesMap) {
    return new Promise((resolve, reject) => {
        if (filesMap.size === 0) {
            resolve(false);
            return;
        }

        if (cfgs.cloud === 'tencent') {
            let i = 0;
            let urls = {};
            filesMap.forEach((fileFullPath, filePath) => {
                filePath=filePath.replace('index.html','')
                console.log(chalk.green('成功刷新: '+cfgs.cdnUrl + filePath));
                urls['urls.' + i] = encodeURI(cfgs.cdnUrl + filePath);
                ++i;
            });

            QCSDK.config({
                secretId: cfgs.secretId,
                secretKey: cfgs.secretKey
            });

            QCSDK.request('RefreshCdnUrl', urls, (res) => {
                res = JSON.parse(res);
                if (res.codeDesc === 'Success') {
                    resolve(true);
                } else {
                    reject(res);
                }
            });
        } else {
            let urls = [];
            for (let filePath of filesMap.keys()) {
                filePath=filePath.replace('index.html','')
                console.log(chalk.green(cfgs.cdnUrl + filePath));
                urls.push(encodeURI(cfgs.cdnUrl + filePath));
            }
            aliyun.cdnRefresh(cfgs, urls).then((result) => {
                resolve(result);
            }, (err) => {
                reject(err);
            });
        }
    });
}

/**
 * 获取云端 Bucket 中的文件数据
 * @param {object} cos
 * @param {object} cfgs
 */
function getCosFiles(cos, cfgs) {
    if (cfgs.cloud === 'tencent') {
        return new Promise((resolve, reject) => {
            cos.getBucket({
                Bucket: cfgs.bucket,
                Region: cfgs.region
            }, (err, data) => {
                let cosFileMap = new Map();
                if (err) {
                    reject(err);
                } else {
                    data.Contents.forEach((item) => {
                        cosFileMap.set(
                            item.Key,
                            item.ETag
                        );
                    });
                    resolve(cosFileMap);
                }
            })
        })
    } else {
        return oss.ossList(cfgs);
    }
}

/**
 * 比较本地文件和远程文件
 * @param  {[type]} localFileMap [本地文件]
 * @param  {[type]} cosFileMap   [远程文件]
 * @return {[type]}              [返回上传文件列表和远程多余文件列表]
 */
function diffFileList(localFileMap, cosFileMap, cfgs) {
    let extraFiles = [];
    return new Promise((resolve, reject) => {
        if (cosFileMap.size < 1) {
            resolve({
                extraFiles: extraFiles,
                uploadFiles: localFileMap
            });
        }
        var i = 0;
        cosFileMap.forEach(async (eTag, key) => {
            if (!localFileMap.has(key)) {
                if (cfgs.cloud === 'tencent') {
                    extraFiles.push({ Key: key });
                } else {
                    extraFiles.push(key);
                }
            } else {
                await diffMd5(localFileMap.get(key)).then((md5) => {
                    if (md5 === eTag.substring(1, 33).toLowerCase()) {
                        localFileMap.delete(key);
                    }
                });
            }
            ++i;
            if (i === cosFileMap.size) {
                resolve({
                    extraFiles: extraFiles,
                    uploadFiles: localFileMap
                });
            }
        });
    });
}

function putObject(cos, config, filePath, fileFullPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(fileFullPath)) {
            reject('File not exist...');
        }
        if (config.cloud === 'tencent') {
            cos.putObject({
                Bucket: config.bucket,
                Region: config.region,
                Key: filePath,
                Body: fs.createReadStream(fileFullPath),
                ContentLength: fs.statSync(fileFullPath).size,
                onProgress: function (progressData) {
                    // console.log(JSON.stringify(progressData));
                },
            }, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        } else {
            oss.ossUpload(config, filePath, fileFullPath).then(({ name, url }) => {
                resolve(url);
            }).catch((err) => {
                reject(err);
            });
        }
    });
}

/**
 * upload file
 * @param {object} cos
 * @param {object} config
 * @param {object} file
 */
function uploadFile(cos, config, files) {
    return new Promise((resolve, reject) => {
        if (!files || files.size < 1) {
            resolve()
        }

        let uploadResult = new Map();
        let uploadSuccessCount = 0;
        files.forEach(async (fileFullPath, filePath) => {
            await putObject(cos, config, filePath, fileFullPath)
                .then((data) => {
                    console.log(chalk.green('成功上传：' + filePath));
                    uploadResult.set(filePath, 1);
                })
                .catch(err => {
                    console.log(chalk.red('上传失败！' + filePath + '，异常信息：'));
                    console.log(err);
                    uploadResult.set(filePath, 0);
                });
        });

        let checkUploadResult = setInterval(() => {
            if (uploadResult.size === files.size) {
                uploadResult.forEach((v) => uploadSuccessCount += v);
                if (uploadSuccessCount === files.size) {
                    resolve('ok')
                } else {
                    reject(uploadResult);
                }
                clearInterval(checkUploadResult);
            }
        }, 3000);
    });
}

/**
 * 从远程仓库删除多余文件
 * @param {object} cos
 * @param {object} config
 * @param {Array} fileList
 */
function deleteFile(cos, config, fileList) {
    return new Promise((resolve, reject) => {
        if (fileList.length < 1) {
            resolve(false)
        }

        if (config.cloud === 'tencent') {
            cos.deleteMultipleObject({
                Bucket: config.bucket,
                Region: config.region,
                Objects: fileList
            }, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            })
        } else {
            oss.ossDeleteMulti(config, fileList).then((deletedFiles) => {
                // console.log(deletedFiles.deleted);
                resolve(deletedFiles);
            }).catch((err) => {
                reject(err);
            });
        }
    })
}

/**
 * 获取文件的 MD5值
 * @param  {[type]} file [文件路径]
 * @return {[type]}      [description]
 */
function diffMd5(file) {
    return new Promise((resolve, reject) => {
        util.getFileMd5(fs.createReadStream(file), (err, md5) => {
            if (err) {
                reject(err)
            } else {
                resolve(md5);
            }
        })
    })
}

/**
 * 检查并处理设置项
 * @param  {[type]} config [hexo设置项]
 * @return {[type]}        [description]
 */
function checkConfigs(config) {
    let cfgs = config.deploy;
    if (cfgs.type !== 'cos-cdn' && cfgs.length > 0) {
        cfgs.forEach((cosConfig) => {
            if (cosConfig.type === 'cos-cdn') {
                cfgs = cosConfig;
            }
        });
    }

    cfgs.cdnUrl = config.url.replace(/([^\/])$/, '$1\/');
    if (!cfgs.cdnUrl || !cfgs.cloud || !cfgs.bucket || !cfgs.region || !cfgs.secretId || !cfgs.secretKey) {
        let tips = [
            chalk.red('配置错误!'),
            '请检查根目录下的 _config.yml 文件中是否设置了以下信息',
            'url: http://yoursite.com',
            'deploy:',
            '  type: cos',
            '  cloud: aliyun or tencent',
            '  bucket: yourBucket',
            '  region: yourRegion',
            '  secretId: yourSecretId',
            '  secretKey: yourSecretKey',
            '  cdnEnable: true',
            '  deleteExtraFiles: true',
            '  updatePosts: false',
            '',
            '您可以访问插件仓库，以获取详细说明： ' + chalk.underline('https://github.com/lxl80/hexo-deployer-cos-cdn')
        ]
        console.log(tips.join('\n'));
        return false;
    }

    cfgs.cdnEnable = cfgs.cdnEnable === undefined ? true : cfgs.cdnEnable;
    cfgs.deleteExtraFiles = cfgs.deleteExtraFiles === undefined ? false : cfgs.deleteExtraFiles;
    cfgs.updatePosts = cfgs.updatePosts === undefined ? false : cfgs.updatePosts;
    if (!cfgs.imageConfig) {
        return cfgs;
    }

    if (!cfgs.imageConfig.cdnUrl || !cfgs.imageConfig.cloud || !cfgs.imageConfig.bucket || !cfgs.imageConfig.region || !cfgs.imageConfig.folder || !cfgs.imageConfig.secretId || !cfgs.imageConfig.secretKey) {
        let tips = [
            chalk.red('您为图片文件开启了单独的bucket，但配置错误！'),
            '请检查根目录下的 _config.yml 文件中是否设置了以下信息',
            'deploy:',
            '  type: cos',
            '  cloud: aliyun or tencent',
            '  bucket: yourBucket',
            '  region: yourRegion',
            '  secretId: yourSecretId',
            '  secretKey: yourSecretKey',
            '  cdnEnable: true',
            '  deleteExtraFiles: true',
            '  updatePosts: false',
            '  imageConfig:',
            '    cloud: aliyun or tencent',
            '    cdnUrl: yourImageUrl',
            '    bucket: yourBucket',
            '    region: yourRegion',
            '    folder: yourImgsFolder',
            '    cdnEnable: true',
            '    deleteExtraFiles: true',
            '    secretId: yourSecretId',
            '    secretKey: yourSecretKey',
            '',
            '您可以访问插件仓库，以获取详细说明： ' + chalk.underline('https://github.com/lxl80/hexo-deployer-cos-cdn')
        ]
        console.log(tips.join('\n'));
        return false;
    }

    cfgs.imageConfig.cdnUrl = cfgs.imageConfig.cdnUrl.replace(/([^\/])$/, '$1\/');
    cfgs.imageConfig.cdnEnable = cfgs.imageConfig.cdnEnable === undefined ? true : cfgs.imageConfig.cdnEnable;
    cfgs.imageConfig.deleteExtraFiles = cfgs.imageConfig.deleteExtraFiles === undefined ? false : cfgs.imageConfig.deleteExtraFiles;
    return cfgs;
}
