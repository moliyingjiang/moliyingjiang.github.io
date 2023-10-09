---
layout: post
title:  "Glowroot 性能监控工具"
categories: ['Glowroot']
tags: ['Glowroot'] 
author: YJ-MoLi
description: Glowroot 性能监控工具的使用
issueId: 2018-2-22 Glowroot
---
* TOC
{:toc}


# Glowroot 性能监控工具
Glowroot 是一个快速，干净和简单的 APM 工具。它可以跟踪捕获缓慢的请求和错误，能够记录每个用户的操作时间，以及 SQL 捕获和聚合。该工具还可保留汇总所有历史数据。

它通过图表的方式显示响应时间分布和响应时间百分比，并允许用户通过移动设备监控应用程序性能。
官网：[https://glowroot.org/](https://glowroot.org/)

## 使用

Glowroot  是通过java Agent方式嵌入到Java 进程中，即通过添加`-javaagent:path/glowroot.jar`到JVM启动参数中完成嵌入。在启动成功之后会在` glowroot.jar`所在的目录产生如下内容，之后可以通过访问`http://localhost:4000`进入。
![Alt text](/assets/images/glowroot/1518140796960.png)


### 下载zip包
访问官网或者以下链接下载：
[glowroot-0.10.2-dist.zip](https://github.com/glowroot/glowroot/releases/download/v0.10.2/glowroot-0.10.2-dist.zip)

### 解压到本地目录
将下载好的zip包解压到本地目录。

 
### 嵌入到JBOSS 5
JBOSS不同的启动方式需要修改的地方不同

#### 通过Run.bat方式手动启动
修改Run.bat 在Java命令参数中增加`-javaagent:path/glowroot.jar`
```bash
rem # Add Glowroot Agent
set "JAVA_OPTS=%JAVA_OPTS% -javaagent:../plugins/glowroot.jar"
```

#### 通过Windows Service 方式启动
JBoss Windows Service 方式启动调用的是`%JBOSS_HOME%\bin`目录下的`servcie.bat`文件，执行的命令是`service.bat start`，因此修改该文件中`start`参数的处理部分，增加`-javaagent:path/glowroot.jar` JVM参数。

#### Eclipse等IDE中启动
在JBOSS的Launch configuration配置里，增加`-javaagent:path/glowroot.jar` JVM启动参数。
![Alt text](/assets/images/glowroot/1518141370388.png)

![Alt text](/assets/images/glowroot/1518141354143.png)


## Glowroot  参数调整
对应的配置文件存放在`golwroot.jar`目录下的`admin.json`和`config.json`文件中.

### 增加登录验证
Glowroot   默认是不需要登录，直接访问`http://localhost:4000`就可以使用，如果需要开启登录验证，则需要先增加管理员用户，并删除`Anonymous`用户。操作如下：
![Alt text](/assets/images/glowroot/1518142128758.png)
删除`Anonymous`,并增加管理员，最终效果如下：
![Alt text](/assets/images/glowroot/1518142198245.png)
重新访问后提示登录：
![Alt text](/assets/images/glowroot/1518141831943.png)

### 修改默认端口和访问URL
Glowroot   的默认端口是`4000`,同样可以修改，注意不要和已有的端口冲突，否则无法访问
![Alt text](/assets/images/glowroot/1518142737804.png)



## 参考：
1. [https://glowroot.org/](https://glowroot.org/)
2. [javaAgent 参数](http://blog.csdn.net/scorpio3k/article/details/6745443)
3. [手动从注册表中删除服务项](http://blog.csdn.net/thanklife/article/details/53896135)


