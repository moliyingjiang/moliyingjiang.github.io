---
layout: post
title:  "Spring Tool Suite使用"
categories: ['java','Spring','STS']
tags: ['java','Spring','STS','Spring Boot'] 
author: YJ-MoLi
description: Spring Tool Suite使用
issueId: 2018-6-6 The used for Spring Tool Suite

---
* TOC
{:toc}



# Spring Tool Suite使用 

## 创建Spring Boot项目

1. new -> Spring Starter Project

![Alt text]({{ site.baseurl }}/assets/images/spring/1522138521772.png)

2.设置好项目参数

![Alt text]({{ site.baseurl }}/assets/images/spring/1522139059179.png)

3.点击完成

![Alt text]({{ site.baseurl }}/assets/images/spring/1522139126024.png)



## 异常及处理
### 创建Spring  Boot项目时报错
1. 报错内容：`JSONException: A JSONObject text must begin with '{' at character 0`

![Alt text]({{ site.baseurl }}/assets/images/spring/1522138648939.png)

后续还可能报错

![Alt text]({{ site.baseurl }}/assets/images/spring/1522138876991.png)


- **问题原因**：STS无法访问http://start.spring.io，因此会报错。可能时网络问题，可能时代理问题，如果本地开了VPN（例如蓝灯），那么如果STS没有的网络设置没有设置为手动代理模式，将会导致这个问题。

- **解决方案**：Window -> Preferences -> Network Connections Change mode to Manual,

![Alt text]({{ site.baseurl }}/assets/images/spring/1522138920551.png)





