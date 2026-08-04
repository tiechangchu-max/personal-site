# 个人网站

这是一个无需安装任何工具的静态个人网站。直接双击 `index.html` 即可预览。

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
