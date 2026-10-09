# seamusapple.github.io

个人页面，托管在 GitHub Pages。首页是一排单页小应用的卡片，每个应用是一个独立目录，纯静态、无构建步骤。

## 结构

```text
index.html            首页（卡片列表 + 标签筛选）
assets/site.css|js    首页样式与脚本
apps/<slug>/          一个应用一个目录，入口 index.html，资源放在目录内（相对路径）
.nojekyll             关闭 Jekyll 处理，目录和文件名原样发布
```

## 加一个应用

1. 新建 `apps/<slug>/`，放入 `index.html` 和它自己的 css / js / img。
2. 在 `index.html` 的 `.shelf` 里加一张 `<a class="card" data-tags="标签1 标签2">` 卡片，封面、标题、一句话、标签、日期。
3. 标签是新的话，在 `.filters` 里加一个 `<button data-tag="标签">`。
4. push 到 `main`，一两分钟后生效。

## 约定

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
