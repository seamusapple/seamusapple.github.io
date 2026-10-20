# seamusapple.github.io

个人页面，托管在 GitHub Pages。首页是一本横向翻阅的画册：封面一屏（总数、目录），之后每件作品一屏，从左往右翻；窄于 880px 时改为竖向堆叠。每个应用是一个独立目录，纯静态、无构建步骤。

## 结构

```text
index.html            首页（<main class="book"> 里一排 .panel：封面 / 作品 / 文章 / 版权）
assets/site.css       首页样式：骨白 #EFE9E1 · 腮红 #E8C4B8 · 牛血 #5A1A1D · 黑 #0D0D0D；Bodoni Moda 拉丁、宋体中文、10px 字距拉开的标签
assets/site.js        滚轮纵向 → 横向翻页（带缓动）、方向键翻页、锚点横移、页眉的 01 / 07 计数；`?flat=1` 把整条展开用于截图
blog/                 2017 年的旧博客（Hexo 静态产物，原样挂在 /blog/）
apps/<slug>/          一个应用一个目录，入口 index.html，资源放在目录内（相对路径）
.nojekyll             关闭 Jekyll 处理，目录和文件名原样发布
```

## 加一个应用

1. 新建 `apps/<slug>/`，放入 `index.html` 和它自己的 css / js / img。
2. 在 `index.html` 的 `.book` 里加一个 `<section class="panel look" data-n="NN">`：幽灵编号 `.ghost-n`、竖图 `.plate`（任意比例原图，CSS 裁成 3:4 并转黑白）、`.cap` 里是拉丁名、中文标题、一句事实、`.meta`。教程类加 `dark` 类走黑底。
3. 同步改四处计数：页眉的「手账 03」、封面的 `No. 07` 和大数字 `07`、封面目录 `.toc` 的编号区间，以及后面各屏的 `data-n` 和文章列表的编号。页眉的 `01 / 07` 由脚本读封面大数字，不用改。
4. 条目多起来按 B7 的规则收：每栏一屏最多 6 条，多的进栏目页；文章只放最新 5 篇，其余进 `blog/` 归档。
5. push 到 `main`，一两分钟后生效。

## 约定

- 文案克制：只写名字、地点、天数、章节数这类事实，不写口号和推销句。
- 页面状态（清单、选项、日期）只用 `localStorage`，记在访客自己的设备上；读写都包 try/catch，存不了也要能正常用。
- 没有 JS 也要能读完：面板默认可见，由脚本再收起。
- 图片控制在单张 300 KB 以内，手机优先。
- 魔方应用的纯逻辑（`apps/cube/js/cube-model.js`、`solver.js`）在 Node 里也能跑：`node apps/cube/test/engine.test.js`、`node apps/cube/test/content.test.js`。

## 应用

| 目录 | 内容 | 标签 |
| --- | --- | --- |
| `apps/jiuzhaigou/` | 九寨沟黄龙四日手账：西安出发、不租车的 4 天 3 晚手绘攻略 | 旅行攻略 · 手绘 |
| `apps/chongqing/` | 重庆山城三日手账：西安出发的 2–3 天主城 + 可选武隆 | 旅行攻略 · 手绘 |
| `apps/shudao/` | 蜀道三星堆三日手账：广元 → 昭化 → 剑门关 → 三星堆 | 旅行攻略 · 手绘 · 人文 |
| `apps/cube/` | 三阶魔方硬核指南：12 章交互式 3D 教学，层先法，出题 / 提示 / 自动讲解 | 教程 · 交互 |
