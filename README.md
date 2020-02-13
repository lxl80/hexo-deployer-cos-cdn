# hexo-deployer-cos-cdn

Hexo部署插件，支持将静态博客发布到腾讯云对象存储中，并同步刷新被更新文件的CDN缓存。

详见博文：[hexo-deployer-cos-cdn 插件安装使用指南](https://www.lixl.cn/2020/020936412.html)。按量付费，一般访问量不高的话，体验期过后一个月也花不了几块钱。

<img src='https://pic.lixl.cn/2020/20200212145243.png/w1280' alt='hexo-deployer-cos-cdn 插件运行流程' width='70%'>

## 特点

1. 编辑博文时，截图后直接 `Ctrl + v` 粘贴并实时预览。
2. 全站 CDN 加速，速度超快，成本几乎为零。
3. 支持将网站和图片发布到各自的 bucket 中。
4. 每次上传时会对比本地与云端文件MD5值，只发布变更内容。
5. 本地 `hexo s` 时，可以正常查看博文中插入的本地图片。
6. 支持同步部署到到多个博客托管服务，如 `COS` + `Github Pages`
7. 支持将 Markdown 源文件中图片路径替换为 CDN 地址，便于直接粘贴/导入到第三方平台。
8. 支持自动清理远程 bucket 中的多余文件，默认不启用。

## 理想的 Markdown 博文写作及发布体验

1. 截图后一键粘贴（ 如 `Ctrl + v` ） 并实时预览，内容编辑所见即所得。
2. `hexo g -d` 一键发布到多个托管平台（如Github+COS）。
3. 自建的博客平台拥有超快的访问速度且几乎零成本。
4. 直接粘贴/导入 Markdown 博文到第三方平台（如知乎、简书、CSDN）。

推荐使用 [Typora](https://www.typora.io/) + 本插件 实现如上体验。`Typora` 配置参照下图：

<img src='https://pic.lixl.cn/2020/20200209161415.png/w1280' alt='Typora图像配置' width='70%'>

经过以上配置以后，在 `Typora` 中编辑 MarkDown 文档时，截图后直接 `Ctrl + v` 即可粘贴并实时预览图片。`hexo d` 部署以后，网站及图片会自动上传到腾讯云对象存储中。

## 安装

``` bash
npm install hexo-deployer-cos-cdn --save
```

## 配置

### 最简单配置

```yaml
deploy:
  type: cos
  bucket: blog-1234567890
  region: ap-shanghai
  secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
  secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

如上配置，图片和文件将发布到同一个 bucket 中，默认开启CDN加速，CDN加速域名为 `_config.yml` 中配置的 `url`，图片上传后，Markdown 源文件中图片依然是相对路径。

### 网站与图片放在不同的bucket中

```yaml
deploy:
  type: cos
  bucket: blog-1234567890
  region: ap-shanghai
  secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
  secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
  imageConfig:
    cdnUrl: https://static.lixl.cn
    bucket: static-1234567890
    region: ap-shanghai
    folder: static
    secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
    secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

如上配置，图片和文件将发布到各自的 bucket 中，图片使用单独的 CDN 加速域名。支持使用两个腾讯云账号，即配置两套 `secretId` 和 `secretKey`），充分使用免费额度。

### 与其它部署插件共存

```yaml
deploy:
  - type: git
    repo: https://github.com/lxl80/blog.git
    branch: gh-pages
    ignore_hidden: false
  - type: cos
    bucket: blog-1234567890
    region: ap-shanghai
    secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
    secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
    cdnEnable: true
    deleteExtraFiles: true
    updatePosts: true
    imageConfig:
      cdnUrl: https://cdn.jsdelivr.net/gh/lxl80/blog@gh-pages/static
      bucket: static-1234567890
      region: ap-shanghai
      secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
      secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
      folder: static
      cdnEnable: false
      deleteExtraFiles: true
```

如上配置，同步将网站发布到 Github Pages 及 COS 中；如果 bucket 中有多余文件，会删除；图片上传成功后，会将 Markdown 源文件中图片路径替换为 CDN 地址。
请注意 `cdnUrl` 配置成了 [jsDelivr CDN](https://www.jsdelivr.com/) 加速，这样配置将实现基于免费的 jsDelivr CDN 来加速 Github 图床的效果，全球访问速度都很快。省去占网站流量大头的图片流量 CDN 加速成本。 详情可参见博文：[使用Typora + PicGo 图床 + jsDelivr CDN实现高效 Markdown 创作](https://www.lixl.cn/2019/120114500.html#toc-heading-6)。

> 补充： jsDelivr是唯一具有中国政府颁发的有效ICP许可证的全球公共CDN，其直接在中国大陆设有数百个节点。

### 参数说明

- `type`： 固定填: cos
  
- `bucket` 和 `region`： 腾讯云控制台 - 对象存储 - 存储桶列表 页面，存储桶名称即: `bucket` ，所属地域代号即: region，参照下图红框圈住的部分:
  
  <img src='https://pic.lixl.cn/2020/20200208200709.png/w1280' alt='腾讯云存储桶列表' width='70%'>

- `secretId` 和 `secretKey`：腾讯云控制台 - 访问管理 - 访问秘钥 - API秘钥管理，参照下图红框圈住的部分:
  
  <img src='https://pic.lixl.cn/2020/20200208201510.png/w1280' alt='腾讯云API秘钥管理' width='70%'>
  
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

## License

MIT

## 参照

- [hexo-deployer-cos-enhanced](https://github.com/75k/hexo-deployer-cos-enhanced)
  
