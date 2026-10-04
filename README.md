# 个人网站

这是一个保留原有图片、视频案例的静态个人作品集，现支持分类筛选、作品详情、提示词与上传管理。通过静态服务器打开，例如 `python -m http.server 8765`，访问 `http://localhost:8765`。新版使用 ES modules 与 fetch，请不要直接双击 HTML。

上传操作与运行检查见 [UPLOAD-GUIDE.md](UPLOAD-GUIDE.md)。

## 完整项目案例

`trainer.html` 展示 GALAKU 训练器的一套 21 张产品视觉，按核心功能、互动场景与产品细节分章编排。电脑三列、平板两列、手机单列；图片可放大、连续翻页，并打开原图。首页作品区已加入案例入口。

`data/trainer-case.json` 记录图片编号、章节、尺寸与原图校验值。网页预览采用 WebP 和响应式尺寸，PNG 原图保存在 `assets/images/trainer/originals/`。案例样式与浏览逻辑位于 `trainer.css` 和 `trainer.mjs`。

## 最快的定制方法

打开 `index.html`，全局搜索并替换下面这些占位内容：

- `你的名字`、`YOUR NAME`、`YN`：姓名与姓名缩写
- `中国 · 杭州`：所在城市
- `hello@yourname.com`：联系邮箱
- `某某科技`、`创意工作室`：工作经历
- 三个作品名称、年份和简介：真实项目资料
- 页尾的小红书、即刻、GitHub、LinkedIn 链接

颜色、间距和响应式规则都在 `styles.css` 顶部的变量与媒体查询中。主题切换、移动菜单和滚动动效在 `script.js` 中。

## 发布上线

将整个 `personal-site` 文件夹上传到任意静态托管服务即可，例如 GitHub Pages、Cloudflare Pages、Vercel 或 Netlify。入口文件必须保持为 `index.html`。
