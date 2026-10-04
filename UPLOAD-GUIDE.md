# 图片与视频上传

1. 在已配置的 Windows 电脑上，双击配套的「打开作品上传.cmd」，进入本机上传页面。启动文件和本机服务与网站源文件分开保存，不发布到公共仓库。
2. 等待「已就绪 · 免密上传」。程序使用本机已有的 GitHub 授权，无需在页面填写密钥。
3. 多选或拖入文件，修改每件作品的标题、分类、说明与提示词，点击「上传并公开展示」。
4. 保存成功后，点击「查看刚上传的作品」。网站更新可能需要几分钟，直达页面会自动检查发布结果并打开作品详情。

其他设备可打开 `admin.html` 中的「其他设备上传（需要 GitHub 授权）」，使用 fine-grained personal access token，仅授权 `tiechangchu-max/personal-site` 的 Contents → Read and write。密钥只保存在页面内存，不写入网站、仓库或浏览器存储。

图片支持 JPG、PNG、WebP、GIF、AVIF；视频支持 MP4、WebM，推荐 H.264 MP4。本站设置单文件 50 MB、每批 10 个、合计 100 MB 的上传上限。发布到当前公开网站的媒体和提示词将对所有访客可见。

上传失败时，文件与表单保留在当前页面，可以重试；不要刷新页面。此版本支持添加作品，修改或删除已发布作品可通过仓库中的 `data/works.json` 完成。

## 访客浏览

- `index.html#work`：图片、视频、含提示词筛选；分类选择；分批加载作品。
- 点击作品打开详情；视频可播放，提示词可复制。
- 新作品在作品库顶部显示，七天内标记「新上传」；「刷新作品」会恢复全部筛选并获取最新作品。
- 上传后的直达链接使用 `?work=作品ID#work`，可直接分享给访客。
- 原有 `#visual`、`#bunny`、`#video` 链接继续有效。
- 原有作品未提供提示词，目录中保持为空，不补写或冒充原始提示词。

## 数据与发布

`data/works.json` 保存作品信息，媒体位于 `assets/`；新增文件保存到 `assets/uploads/`。本机服务使用独立 Git 缓存与已有系统授权，网页授权模式使用 GitHub Git Database API。两种方式均将媒体和目录放在同一提交中，基于最新内容非强制更新 main；遇到并发修改停止并保留输入。重复提交已保存的同一批次不会重复生成记录。

本站继续使用 GitHub Pages 的原网址，无需额外后端或订阅。网站无构建步骤；将全部源文件提交到 main 后，由原有 GitHub Pages 配置发布。不要把访问密钥写入文件。

## 本地开发与验证

通过静态服务器打开，例如 `python -m http.server 8765`，访问 `http://localhost:8765`。作品库和管理页使用 ES modules 与 fetch，请通过 HTTP 服务访问，不要直接双击 HTML。

```sh
node --test tests/media-store.test.mjs
node --check admin.mjs
node --check gallery.mjs
node --check media-store.mjs
```

参考：[GitHub token 设置](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)、[Git tree API](https://docs.github.com/en/rest/git/trees)、[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。
