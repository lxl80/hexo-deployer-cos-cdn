'use strict';
const chalk = require('chalk');
const tencentcloud = require("tencentcloud-sdk-nodejs");

// 根据URL地址列表清除缓存
const TeoPurgeUrlsCache = async (secretId, secretKey, refreshUrlList) => {
    // 创建TEO客户端
    const TeoClient = new tencentcloud.teo.v20220901.Client({
        credential: {
            secretId: secretId,
            secretKey: secretKey,
        }
    })
    // 获取域名列表
    const DomainList = await TeoClient.DescribeZones({}).then((res) => {
        // Zoones字段可能不存在或为[]，需要判断
        if (res.Zones == null || res.Zones == undefined) {
            console.log(chalk.red("No domain found"));
        }
        console.log(chalk.green("Get domain list success, total: ", res.Zones.length));
        return res.Zones
    }).catch((err) => {
        console.log(chalk.red("Get domain list failed, please check your secretId and secretKey: ", err));
    })
    console.log(chalk.green("Purge urls: ", refreshUrlList.length));
    // console.log("Purge urls: ", refreshUrlList);
    // 根据urls的host将其分组
    let groups = refreshUrlList.reduce((groups, url) => {
        let host = new URL(url).host;
        if (!groups[host]) {
            groups[host] = [];
        }
        groups[host].push(url);
        return groups;
    }, {});
    // 按组清除缓存
    let puredDomains = [];
    for (const host in groups) {
        let urls = groups[host];
        let zoneId = DomainList.find((domain) => host.endsWith(domain.ZoneName) || domain.ZoneName == host).ZoneId;
        if (zoneId == undefined) {
            console.log(chalk.red(`No domain found for ${host}`));
            continue
        }
        await TeoClient.CreatePurgeTask({
            'ZoneId': zoneId,
            'Type': "purge_url",
            'Targets': refreshUrlList,
        }).then((res) => {
            console.log(chalk.green(`Purge ${refreshUrlList.length} urls cache for ${host}, taskId: ${res.JobId}`))
            puredDomains.push(host)
        }).catch((err) => {
            console.log(chalk.red(`Purge ${refreshUrlList.length} urls cache for ${host} failed, ${err}`))
        })
    }
    return puredDomains.length > 0 ? true : false;
}

module.exports = TeoPurgeUrlsCache;