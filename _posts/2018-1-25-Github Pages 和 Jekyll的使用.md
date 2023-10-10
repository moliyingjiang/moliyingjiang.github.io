---
layout: post
title:  "Github Pages & Jekyll"
categories: ['Github Pages','Jekyll']
tags: ['Github Pages','Jekyll','markdown']
author: YJ-MoLi
description: Github Pages 和 Jekyll的使用
issueId: 2018-1-25 Github Pages and Jekyll
---
* TOC
{:toc}

# Github Pages 和 Jekyll的使用

## 简介

### Git简介
Git是一个开源的分布式版本控制系统，用以有效、高速的处理从很小到非常大的项目版本管理。
GitHub可以托管各种git库的站点。


### Github Pages
一个在github上托管的免费的静态页面运行空间，支持HTML和MarkDown类型的静态文件。

优点：
1. 搭建简单而且免费；
2. 支持静态脚本；
3. 可以绑定你的域名；
4. DIY自由发挥，支持模版，支持jekll，支持markdown，支持引入第三方评论组件，支持更换主题，支持自定义主题。
5. 理想写博环境，git+github+markdown+jekyll；
6. 使用git做版本管理。

Github pages 可以通过只提交静态HTML、CSS、JS等资源，也可以通过使用自带的Jekyll引擎，来加工提交的文件。

#### 两种pages模式
1. User/Organization Pages 个人或公司站点

	1) 使用自己的用户名，每个用户名下面只能建立一个；
	2) 资源命名必须符合这样的规则username/username.github.io；
	3) 主干上内容被用来构建和发布页面

2. Project Pages 项目站点

	1) gh-pages分支用于构建和发布；
	2) 如果user/org pages使用了独立域名，那么托管在账户下的所有project pages将使用相同的域名进行重定向，除非project pages使用了自己的独立域名；
	3) 如果没有使用独立域名，project pages将通过子路径的形式提供服务username.github.io/projectname；
	4) 自定义404页面只能在独立域名下使用，否则会使用User Pages 404；

**可以通过User/Organization Pages建立主站，而通过Project Pages挂载二级应用页面。**




### Jekyll
Jekyll是一种简单的、适用于博客的、静态网站生成引擎。它使用一个模板目录作为网站布局的基础框架，支持Markdown、Textile等标记语言的解析，提供了模板、变量、插件等功能，最终生成一个完整的静态Web站点。说白了就是，只要安装Jekyll的规范和结构，不用写html，就可以生成网站。
参考：
[jekyll介绍](http://jekyllbootstrap.com/lessons/jekyll-introduction.html)
[jekyll on github](https://github.com/mojombo/jekyll)
[jekyllbootstrap](http://jekyllbootstrap.com/)

Jekyll使用Liquid模板语言，`\{\{page.title\}\}`表示文章标题，`\{\{content\}\}`表示文章内容。我们可以用两种Liquid标记语言：输出标记（output markup）和标签标记 (tag markup)。输出标记会输出文本（如果被引用的变量存在），而标签标记不会。输出标记是用双花括号分隔，而标签标记是用花括号-百分号对分隔。
参考：
[Liquid模板语言](https://github.com/shopify/liquid/wiki/liquid-for-designers)
[Liquid模板变量参考](https://github.com/mojombo/jekyll/wiki/Template-Data)

jekyll与github的关系：GitHub Pages一个由 GitHub 提供的用于托管项目主页或博客的服务，jekyll是后台所运行的引擎。


## 使用

### 安装git工具
git工具非常多，安装和使用教程也非常多，这里略过不写。

### 创建个人站点步骤
参考：
[原通过GitHub Pages建立个人站点（详细步骤）- 雨知](http://www.cnblogs.com/purediy/archive/2013/03/07/2948892.html)


### 使用Jekyll
Jekyll 可以搭建本地Jekyll环境，也可以直接下载一套模版，手动修改，提交github查看效果。

#### Jekll本地环境搭建
参考:
[Jekyll中国](http://jekyllcn.com)

### Jekyll 模版库
[poole/poole · GitHub](https://github.com/poole/poole)
[Jekyll Themes](http://jekyllthemes.org/)


## 实战

站点维护软件：
1. 使用本地MarkDown编辑器（马克飞象）+[notepad++] 编写文章。
2. 使用notepad++修改模版
3. 使用soucetree管理github库。

下载[xixia西夏](http://jekyllthemes.org/themes/xixia/)模版，将模版所有内容覆盖到站点库。将本地内容推送到github，访问http://`username`.github.io即可。


文章发布流程：
 1. 在马克飞象中写好文章。
 2. 导出为Markdown格式的zip包。
 3. 将zip包中文件markdown文件解压到站点在本地的`_post`目录.
 4. 将zip包中图片解压到站点的`assets\images`目录下。
 5. 用notepad++打开导出的markdown文件，修改替换`(./` 为`({{ site.baseurl }}/assets/images/`
 6. 删除一些无法识别的markdown语句，比如`(@)`、`[toc]`。
 7. 替换[`toc]`为：

```markdown
* TOC
{:toc}
```


### xixia 模版介绍
目录结构

参考：
[目录结构](http://jekyllcn.com/docs/structure/)


#### _config.yml
保存配置数据。很多配置选项都可以直接在命令行中进行设置，但是如果你把那些配置写在这儿，你就不用非要去记住那些命令了。
系统的默认值如下：
```yaml
# 目录结构
source:      .
destination: ./_site
plugins:     ./_plugins
layouts:     ./_layouts
data_source: ./_data
collections: null

# 阅读处理
safe:         false
include:      [".htaccess"]
exclude:      []
keep_files:   [".git", ".svn"]
encoding:     "utf-8"
markdown_ext: "markdown,mkdown,mkdn,mkd,md"

# 内容过滤
show_drafts: null
limit_posts: 0
future:      true
unpublished: false

# 插件
whitelist: []
gems:      []

# 转换
markdown:    kramdown
highlighter: rouge
lsi:         false
excerpt_separator: "\n\n"
incremental: false

# 服务器选项
detach:  false
port:    4000
host:    127.0.0.1
baseurl: "" # does not include hostname

# 输出
permalink:     date
paginate_path: /page:num
timezone:      null

quiet:    false
defaults: []

# Markdown 处理器
rdiscount:
  extensions: []

redcarpet:
  extensions: []

kramdown:
  auto_ids:       true
  footnote_nr:    1
  entity_output:  as_char
  toc_levels:     1..6
  smart_quotes:   lsquo,rsquo,ldquo,rdquo
  enable_coderay: false

  coderay:
    coderay_wrap:              div
    coderay_line_numbers:      inline
    coderay_line_number_start: 1
    coderay_tab_width:         4
    coderay_bold_every:        10
    coderay_css:               style

```
可以增加自己自定义配置



#### 新增Category 和tag
Category 和tag可以在文章的头代码块中指定，值可以是多个，也可以是单个。Jekyll将自动处理相同的category和tag无需手动设置规定的值列表。
```yaml
---
layout: post
title:  "Webpack2"
categories: ['web front end','webpack']
tags: ['webpack','source-map','javascript']
author: YJ-MoLi
description: webpack的使用2.
---
```


#### 切换布局
在访问的html活动markdown文件顶部可以增加YAML代码块，用于控制该页面使用什么样的布局，指定的布局值必须是`_layouts`下的具体的文件的basename。例如xixia这个模版自带了两个布局`default.html`和`post.html`
代码块如下:
```
---
layout: default
---
...
```
头信息
正是头信息开始让 Jekyll 变的很酷。任何只要包含 YAML 头信息的文件在 Jekyll 中都能被当做一个特殊的文件来处理。头信息必须在文件的开始部分，并且需要按照 YAML 的格式写在两行三虚线之间。



#### 语言控制
由`_config.yml`中的`lan: "cn" `控制使用何种语言。
目前支持的值有`en`、`cn`。对应的资源文件：
`en` - `C:\github\moliyingjiang.github.io\_data\values\en.yml`
`cn` - `C:\github\moliyingjiang.github.io\_data\values\cn.yml`

`cn`资源文件内容：
```yaml
recent_posts: 最新发表
links: 友情链接
home: 首页
tags: 标签
archive: 归档
categories: 分类
about: 关于
thanks: " ， 自豪的采用"
page: 当前页
newer_post: 前一篇
older_post: 后一篇
top_posts: 置顶文章
```


实现代码在`header.html`和`sidebar.html`:
```
<!-- 定义trans 变量，取值为加载的data.values里的lan的值对应的内容。-->
{% assign trans = site.data.values[site.lan] %}
<!--之后在需要的地方使用trans对象的属性值。-->

```


#### markdown增加目录索引
markdown标签为
```markdown
* TOC
{:toc}
```

`_config.yml` 配置文件内容：
```yaml
highlighter: rouge
markdown: kramdown
kramdown:
  input: GFM
  extensions:
    - autolink
    - footnotes
    - smart
  enable_coderay: true
  syntax_highlighter: rouge
```

#### 分页
`_config.yml` 配置文件内容：
```yaml
paginate: 10
```






