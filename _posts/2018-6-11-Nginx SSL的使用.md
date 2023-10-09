---
layout: post
title:  "Nginx SSL的使用"
categories: ['Nginx','SSL','HTTP','HTTPS']
tags: ['Nginx','SSL','HTTP','HTTPS']
author: Feiyizhan
description: Nginx SSL的使用
issueId: 2018-6-11 The use of Nginx SSL

---
* TOC
{:toc}



# Nginx SSL的使用


## SSL证书

### 主流数字证书都有哪些格式？
一般来说，主流的Web服务软件，通常都基于OpenSSL和Java两种基础密码库。

- Tomcat、Weblogic、JBoss等Web服务软件，一般使用Java提供的密码库。通过Java Development Kit （JDK）工具包中的Keytool工具，生成Java Keystore（JKS）格式的证书文件。

- Apache、Nginx等Web服务软件，一般使用OpenSSL工具提供的密码库，生成PEM、KEY、CRT等格式的证书文件。
IBM的Web服务产品，如Websphere、IBM Http Server（IHS）等，一般使用IBM产品自带的iKeyman工具，生成KDB格式的证书文件。

-  微软Windows Server中的Internet Information Services（IIS）服务，使用Windows自带的证书库生成PFX格式的证书文件。

### 如何判断证书文件是文本格式还是二进制格式？
您可以使用以下方法简单区分带有后缀扩展名的证书文件：

- *.DER或*.CER文件： 这样的证书文件是二进制格式，只含有证书信息，不包含私钥。
- *.CRT文件： 这样的证书文件可以是二进制格式，也可以是文本格式，一般均为文本格式，功能与 *.DER及*.CER证书文件相同。
- *.PEM文件： 这样的证书文件一般是文本格式，可以存放证书或私钥，或者两者都包含。 *.PEM 文件如果只包含私钥，一般用*.KEY文件代替。
- *.PFX或*.P12文件： 这样的证书文件是二进制格式，同时包含证书和私钥，且一般有密码保护。
您也可以使用记事本直接打开证书文件。如果显示的是规则的数字字母，例如：

```
—–BEGIN CERTIFICATE—–
MIIE5zCCA8+gAwIBAgIQN+whYc2BgzAogau0dc3PtzANBgkqh......
—–END CERTIFICATE—–
```
那么，该证书文件是文本格式的。
如果存在`——BEGIN CERTIFICATE——`，则说明这是一个证书文件。
如果存在`—–BEGIN RSA PRIVATE KEY—–`，则说明这是一个私钥文件。

### 证书格式转换
以下证书格式之间是可以互相转换的。 

![Alt text]({{ site.baseurl }}/assets/images/nginx/1528686626603.png)

- 将JKS格式证书转换成PFX格式
您可以使用JDK中自带的Keytool工具，将JKS格式证书文件转换成PFX格式。例如，您可以执行以下命令将 server.jks证书文件转换成 server.pfx证书文件：
`keytool -importkeystore -srckeystore D:\server.jks -destkeystore D:\server.pfx -srcstoretype JKS -deststoretype PKCS12`

- 将PFX格式证书转换为JKS格式
您可以使用JDK中自带的Keytool工具，将PFX格式证书文件转换成JKS格式。例如，您可以执行以下命令将 server.pfx证书文件转换成 server.jks证书文件：
`keytool -importkeystore -srckeystore D:\server.pfx -destkeystore D:\server.jks -srcstoretype PKCS12 -deststoretype JKS`

- 将PEM/KEY/CRT格式证书转换为PFX格式
您可以使用 OpenSSL工具，将KEY格式密钥文件和CRT格式公钥文件转换成PFX格式证书文件。例如，将您的KEY格式密钥文件（server.key）和CRT格式公钥文件（server.crt）拷贝至OpenSSL工具安装目录，使用OpenSSL工具执行以下命令将证书转换成 server.pfx证书文件：
`openssl pkcs12 -export -out server.pfx -inkey server.key -in server.crt`

- 将PFX转换为PEM/KEY/CRT
您可以使用 OpenSSL工具，将PFX格式证书文件转化为KEY格式密钥文件和CRT格式公钥文件。例如，将您的PFX格式证书文件拷贝至OpenSSL安装目录，使用OpenSSL工具执行以下命令将证书转换成server.pem证书文件KEY格式密钥文件（server.key）和CRT格式公钥文件（server.crt）：
`openssl pkcs12 -in server.pfx -nodes -out server.pem`
`openssl rsa -in server.pem -out server.key`
`openssl x509 -in server.pem -out server.crt`


## 启用SSL
### Nginx如果未开启SSL模块，配置Https时提示错误
`nginx: [emerg] the "ssl" parameter requires ngx_http_ssl_module in /usr/local/nginx/conf/nginx.conf:37`

原因也很简单，nginx缺少http_ssl_module模块，编译安装的时候带上--with-http_ssl_module配置就行了，但是现在的情况是我的nginx已经安装过了，怎么添加模块，其实也很简单，往下看： 做个说明：我的nginx的安装目录是/usr/local/nginx这个目录，我的源码包在/usr/local/src/nginx-1.6.2目录

### Nginx开启SSL模块
切换到源码包：

`cd /usr/local/src/nginx-1.11.3`
查看nginx原有的模块

`/usr/local/nginx/sbin/nginx -V`
在configure arguments:后面显示的原有的configure参数如下：

`--prefix=/usr/local/nginx --with-http_stub_status_module`
那么我们的新配置信息就应该这样写，如果原参数为空，则直接将https模块的参数追加到后面即可：

`./configure --prefix=/usr/local/nginx --with-http_stub_status_module --with-http_ssl_module`
运行上面的命令即可，等配置完

配置完成后，运行命令

`make`

这里不要进行`make install`，否则就是覆盖安装

然后备份原有已安装好的nginx

`cp /usr/local/nginx/sbin/nginx /usr/local/nginx/sbin/nginx.bak`

然后将刚刚编译好的nginx覆盖掉原有的nginx（这个时候nginx要停止状态）
先关闭Nginx

` /usr/local/nginx/sbin/nginx -s stop`

再拷贝新的Nginx到安装目录。

`cp ./objs/nginx /usr/local/nginx/sbin/`

然后启动nginx，仍可以通过命令查看是否已经加入成功
`/usr/local/nginx/sbin/nginx`

查看版本参数：
`/usr/local/nginx/sbin/nginx -V　`


### Nginx 配置SSL安全证书

- 在Nginx 目录下创建cert目录，将证书的所有文件拷贝到该目录。
- 修改nginx.conf文件，增加或者修改监听443端口的Server，配置如下：   

```
	server{
        #监听的443端口
        listen 443;
		#域名可以有多个，用空格隔开
        server_name localhost;
        
        ssl on;
        #证书路径 星号替换成自己的就ok
        ssl_certificate   ../cert/xxxx.pem;
        #私钥路径
        ssl_certificate_key   ../cert/xxxx.key;
        #缓存有效期
        ssl_session_timeout 30m;
        #可选的加密算法,顺序很重要,越靠前的优先级越高.
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
        #安全链接可选的加密协议
        ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
		
        ssl_prefer_server_ciphers on;
		
		#后续配置省略
		#...
         
   }
```

- 让Nginx重新加载配置，如果失败，重启Nginx即可。

## HTTP转HTTPS
需要Nginx Server同时侦听80和443端口，并处理Nginx 497错误。配置如下：

```
        #监听的443端口
        listen 443;
		listen 80;

		#让http请求重定向到https请求   
       error_page 497  https://$host$uri?$args; 

```




## 坑点

- 直接将80端口转发给443端口也可以，但配置会比较麻烦，同样需要处理`497`错误，否则会报错`400 bad Request`。
