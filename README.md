# hexo-deployer-cos-cdn

Hexo部署插件，支持将静态博客发布到腾讯云、阿里云对象存储中，并同步刷新被更新文件的CDN缓存。

详见博文：[hexo-deployer-cos-cdn 插件安装使用指南](https://www.lixl.cn/2020/020936412.html)。

![hexo-deployer-cos-cdn 插件运行流程](https://pic.lixl.cn/2020/20200212145243.png/w1280)

## 特点

1. 全站 CDN 加速，速度超快，成本几乎为零。
2. 支持同时使用阿里云和腾讯云对象存储服务。
3. 支持将网站和图片发布到各自的 bucket 中。
4. 每次上传时会对比本地与云端文件MD5值，只发布变更内容。
5. 支持同步部署到到多个博客托管服务，如 `COS` + `Github Pages`
6. 支持将 Markdown 源文件中图片路径替换为 CDN 地址，便于直接粘贴/导入到第三方平台。
7. 支持自动清理远程 bucket 中的多余文件，默认不启用。

## 理想的 Markdown 博文写作及发布体验

1. `Ctrl + v` 一键粘贴包括多张图片和文本组成的混合内容并实时预览，内容编辑所见即所得。
2. `hexo g -d` 一键发布到多个托管平台（如Github+COS）。
3. 自建的博客平台拥有超快的访问速度且几乎零成本。
4. 直接粘贴/导入 Markdown 博文到第三方平台（如知乎、简书、CSDN）。

推荐使用 [Typora](https://www.typora.io/) + 本插件 实现如上体验。`Typora` 配置参照下图：

![Typora图像配置](https://pic.lixl.cn/2020/20200209161415.png/w1440)

经过以上配置以后，在 `Typora` 中编辑 MarkDown 文档时，截图后直接 `Ctrl + v` 即可粘贴并实时预览。尤其是一键粘贴包括多张图片及文本的混合内容，并保留原格式非常方便。`hexo d` 部署以后，网站及图片会自动上传到云对象存储中。

## 安装

``` bash
npm install hexo-deployer-cos-cdn --save
```

## 配置

### 最简单配置

```yaml
deploy:
  type: cos-cdn
  cloud: tencent
  bucket: blog-1234567890
  region: ap-shanghai
  secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
  secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

如上配置，图片和文件将发布到 腾讯云的 同一个 bucket 中，默认开启CDN加速，CDN加速域名为 `_config.yml` 中配置的 `url`，图片上传后，Markdown 源文件中图片依然是相对路径。

### 网站与图片放在不同的bucket中

```yaml
deploy:
  type: cos-cdn
  cloud: tencent
  bucket: blog-1234567890
  region: ap-shanghai
  secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
  secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
  imageConfig:
    cloud: aliyun
    cdnUrl: https://pic.lixl.cn
    bucket: lxl80
    region: oss-cn-beijing
    folder: static
    cdnEnable: false
    deleteExtraFiles: false #谨慎开启
    secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
    secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

如上配置，文件将发布到 腾讯云 的 bucket 中，图片发布到阿里云的 bucket 中。图片使用单独的 CDN 加速域名。图片cdn没有开启CDN换新及删除多余文件功能。

### 免备案部署

```yaml
deploy:
  - type: git
    repo: https://github.com/lxl80/blog.git
    branch: gh-pages
    ignore_hidden: false
  - type: cos-cdn
    cloud: tencent
    bucket: blog-1234567890
    region: ap-shanghai
    cdnEnable: true
    deleteExtraFiles: true
    updatePosts: true
    secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
    secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
    imageConfig:
      cloud: aliyun
      cdnUrl: https://cdn.jsdelivr.net/gh/lxl80/blog@gh-pages/static
      bucket: lxl80
      region: oss-cn-beijing
      folder: static
      cdnEnable: false
      deleteExtraFiles: true #谨慎开启
      secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
      secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

如上配置，需要安装 [hexo-deployer-git](https://www.npmjs.com/package/hexo-deployer-git) 插件。会同步将网站发布到 Github Pages 及 云对象存储 中；如果 bucket 中有多余文件会删除；图片上传成功后，会将 Markdown 源文件中图片路径替换为 CDN 地址。

如果嫌 `Github Pages` 国内访问导致html页面加载太慢，可以通过 [netlify](https://app.netlify.com/) 来提速。在 netlify 中基于 git 创建站点，关联 github 仓库，以后通过 `hexo g -d`一键部署时，netlify 中的内容也会自动更新。示例站点: <https://netlify.lixl.cn/>

![基于Github仓库创建站点](https://pic.lixl.cn/2020/image-20200309142734992.png)

也可以使用请免费的 [jsDelivr CDN](https://www.jsdelivr.com/) 来加速，如上面示例的 `cdnUrl` 配置成了 jsDelivr CDN 加速地址，这样配置的话，图片在阿里云OSS中只保存备份，用户访问的是基于免费的 jsDelivr CDN 来加速 Github 图床的效果，全球访问速度都很快，还省去了占网站流量大头的图片流量 CDN 加速成本。 详情可参见博文：[使用Typora + PicGo 图床 + jsDelivr CDN实现高效 Markdown 创作](https://www.lixl.cn/2019/120114500.html#toc-heading-6)。

> 补充： jsDelivr是唯一具有中国政府颁发的有效ICP许可证的全球公共CDN，其直接在中国大陆设有数百个节点。

### 参数说明

- `type`： 固定填: cos-cdn

- `cloud`： 指定云服务商，目前支持阿里云 `aliyun` 和腾讯云 `tencent`
  
- `bucket` 和 `region`： 以腾讯云为例，进入控制台 - 对象存储 - 存储桶列表 页面，存储桶名称即: `bucket` ，所属地域代号即: region，参照下图红框圈住的部分:
  
![腾讯云存储桶列表](https://pic.lixl.cn/2020/20200208200709.png/w1280)

- `secretId` 和 `secretKey`：以腾讯云为例，进入控制台 - 访问管理 - 访问秘钥 - API秘钥管理，参照下图红框圈住的部分:

![腾讯云API秘钥管理](https://pic.lixl.cn/2020/20200208201510.png/w1280)

- `cdnEnable`: 是否启用CDN加速，默认为 `true`，如果为 `false` ，将不会刷新 CDN 缓存。

- `deleteExtraFiles`: 是否删除云端多余文件(本地不包含的文件)，默认为 `false`，请谨慎选择。

- `updatePosts`：是否更新 Markdown 源文中的图片地址为CDN路径。默认为 `false` ，如果设置为 `true` ，之后再次修改 `imageConfig.cdnUrl`时，需要手动将 Markdown 源文中的图片地址批量替换为相对路径，否则不生效。

- `imageConfig.cdnUrl`： 用于存储图片的 bucket 绑定的 CDN 加速域名。对费用敏感的话，可以参考与其它部署插件共存的配置示例，采用 jsDelivr CDN 节省流量成本。
  
- `imageConfig.folder`：本地博客 `hexo/source/` 目录内，用户存放本地图片文件的目录。

## 注意事项

1. 使用云对象存储及 CDN 服务，网站需要先备案。
2. 超出免费额度要付费，记得开启防盗链。
3. 更新 CDN 缓存需要授权，如果使用子账号，请同时赋予该账号此权限。
4. 如果想将 markdown 源文直接导入/粘贴到第三方平台，记得在图片 CDN 防盗链配置中增加白名单。

## 贡献者

- 感谢 @Doradx 发现 CDN 刷新存在的问题并提供解决方案。

## License

MIT

## 参考

- [hexo-deployer-cos-enhanced](https://github.com/75k/hexo-deployer-cos-enhanced)
- [openapi-core-nodejs-sdk](https://github.com/aliyun/openapi-core-nodejs-sdk)
- [oss-js-sdk](https://www.npmjs.com/package/ali-oss)
  