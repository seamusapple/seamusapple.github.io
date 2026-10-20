#!/usr/bin/env python3
"""把 blog/ 下 Hexo 产物里的三篇旧文抽出正文，套站内文章模板，生成 posts/<slug>/index.html。
只依赖标准库；改了模板或 POSTS 后重新运行即可。用法：python3 tools/build-posts.py"""
import re, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS = [
    dict(src="blog/2017/01/09/iOS-Runtime/index.html", slug="ios-runtime", n="05",
         title="iOS Runtime 机制", latin="Objective-C Runtime", date="2017-01-09", tags="Objective-C · Runtime · iOS"),
    dict(src="blog/2017/01/05/iOS中的Runtime-Swift/index.html", slug="runtime-swift", n="06",
         title="iOS 中的 Runtime（使用篇）", latin="Runtime in Swift", date="2017-01-05", tags="Swift · Runtime · iOS"),
    dict(src="blog/2017/01/04/ARC-in-Swift/index.html", slug="arc-swift", n="07",
         title="iOS 中的内存管理（ARC）", latin="ARC in Swift", date="2017-01-04", tags="Swift · ARC · iOS"),
]
FONTS = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Noto+Sans+SC:wght@400;500&family=Noto+Serif+SC:wght@400;600&family=JetBrains+Mono:wght@400&display=swap"

def strip_tags(s): return re.sub(r"<[^>]+>", "", s)

def convert_figure(m):
    block = m.group(0)
    lang = re.search(r'class="highlight ([a-z0-9+-]+)"', block)
    td = re.search(r'<td class="code"><pre>(.*?)</pre></td>', block, re.S)
    lines = re.findall(r'<div class="line">(.*?)</div>', td.group(1) if td else "", re.S)
    lines = [re.sub(r'<span class="([a-z_-]+)">', lambda k: '<span class="hl-%s">' % k.group(1), l) for l in lines]
    # highlight.js 按行输出时，多行 /* … */ 只有首行带 comment 类：把区间内其余行整体标成注释
    out, in_comment = [], False
    for l in lines:
        text = html.unescape(strip_tags(l))
        if in_comment:
            l = '<span class="hl-comment">%s</span>' % strip_tags(l)
            if "*/" in text: in_comment = False
        elif "/*" in text and "*/" not in text[text.index("/*") + 2:]:
            in_comment = True
        out.append(l)
    return '<pre><code class="lang-%s">%s</code></pre>' % (lang.group(1) if lang else "text", "\n".join(out))

def body_of(src_html):
    body = re.search(r'<div class="post-body"[^>]*>(.*?)<footer class="post-footer">', src_html, re.S).group(1)
    body = re.sub(r'<figure class="highlight[^"]*">.*?</figure>', convert_figure, body, flags=re.S)
    body = re.sub(r'<a href="#[^"]*" class="headerlink"[^>]*></a>', "", body)
    body = body.replace('<a id="more"></a>', "")
    body = re.sub(r'\s+target="_blank" rel="external"', "", body)
    body = re.sub(r'<img ', '<img loading="lazy" ', body)
    return body.strip()

def localize_images(body, slug):
    def swap(m):
        url = m.group(1); name = url.rsplit("/", 1)[1]
        return 'src="img/%s"' % name if (ROOT / "posts" / slug / "img" / name).exists() else m.group(0)
    return re.sub(r'src="(https?://[^"]+)"', swap, body)

def reading(body):
    prose = strip_tags(re.sub(r"<pre>.*?</pre>", " ", body, flags=re.S))
    cjk = len(re.findall(r"[\u4e00-\u9fff]", prose))
    words = len(re.findall(r"[A-Za-z][A-Za-z0-9_+.-]*", prose))
    total = cjk + words
    rounded = int(round(total, -2))
    minutes = max(1, round(cjk / 400 + words / 200))
    return "约 %s 字 · 读 %d 分钟" % (f"{rounded:,}".replace(",", " "), minutes)

def page(p, body, prev_p, next_p):
    toc = "".join('<li><a href="#%s">%s</a></li>' % (i, strip_tags(t)) for i, t in re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body))
    pager = []
    pager.append('<li><span class="lab">较新 · %s</span><a class="t" href="../%s/">%s</a></li>' % (prev_p["n"], prev_p["slug"], prev_p["title"]) if prev_p else '<li><span class="lab">较新</span><a class="t" href="../../#posts">回到文章列表</a></li>')
    pager.append('<li><span class="lab">较早 · %s</span><a class="t" href="../%s/">%s</a></li>' % (next_p["n"], next_p["slug"], next_p["title"]) if next_p else '<li><span class="lab">较早</span><a class="t" href="../../blog/">更早的归档</a></li>')
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="{p['title']} · {p['latin']} · {p['date']}">
<title>{p['title']} · Ramsey</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="../../assets/post.css">
</head>
<body>
<header class="bar"><a class="wm" href="../../">Ramsey</a><nav><a class="lab" href="../../#notes">手账 03</a><a class="lab" href="../../#guides">教程 01</a><a class="lab" href="../../#posts">文章 03</a></nav><a class="lab" href="../../blog/">归档</a></header>
<section class="hero">
  <span class="n" aria-hidden="true">{p['n']}</span>
  <div><div class="kick lab"><span>文章 · {p['n']} / 07</span><i aria-hidden="true"></i><time datetime="{p['date']}">{p['date']}</time></div><h1>{p['title']}</h1><span class="latin">{p['latin']}</span></div>
  <dl class="side"><div><dt class="lab">标签</dt><dd>{p['tags']}</dd></div><div><dt class="lab">字数</dt><dd>{reading(body)}</dd></div><div><dt class="lab">原载</dt><dd>Ramsey&#39;s Blog · 2017</dd></div></dl>
</section>
<div class="wrap">
  <nav class="toc" aria-label="目录"><span class="lab">目录</span><ol>{toc}</ol></nav>
  <article>
{body}
  </article>
</div>
<nav class="pager" aria-label="前后文章"><ul>{''.join(pager)}</ul></nav>
<footer class="foot lab"><span>© 2026 Ramsey</span><a href="../../">← 返回首页</a></footer>
</body>
</html>
'''

for i, p in enumerate(POSTS):
    src = (ROOT / p["src"]).read_text(encoding="utf-8")
    body = localize_images(body_of(src), p["slug"])
    out = ROOT / "posts" / p["slug"] / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(p, body, POSTS[i - 1] if i > 0 else None, POSTS[i + 1] if i + 1 < len(POSTS) else None), encoding="utf-8")
    print(out.relative_to(ROOT), len(body), "chars,", body.count("<pre><code"), "code blocks,", reading(body))
