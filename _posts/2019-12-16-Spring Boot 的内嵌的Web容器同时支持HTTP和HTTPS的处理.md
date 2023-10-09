---
layout: post
title:  "Spring Boot 的内嵌的Web容器同时支持HTTP和HTTPS的处理"
categories: ['Spring Boot']
tags: ['Spring Boot'] 
author: Feiyizhan
description: Spring Boot 的内嵌的Web容器同时支持HTTP和HTTPS的处理
issueId: 2019-12-16 Spring Boot 的内嵌的Web容器同时支持HTTP和HTTPS的处理

---
* TOC
{:toc}

# Spring Boot 的内嵌的Web容器同时支持HTTP和HTTPS的处理


## tomcat

## 只支持HTTP
默认只支持HTTP，如果需要指定http的端口，则在配置文件增加如下配置：
```
server.port=81
```

## 只支持HTTPS
在配置文件增加如下配置：
```
# HTTPS
server.ssl.key-store-type=PKCS12
server.ssl.key-store=classpath:ssl/xxxxx/xxxxx.pfx
server.ssl.key-store-password=xxxxx
server.ssl.enabled=true
server.port=443
```


## 同时支持HTTP和HTTPS

默认只支持HTTP或HTTPS，如果需要同时支持HTTP + HTTPS，则需要增加额外的代码配置，来启用HTTP或者HTTPS。
由于HTTP配置相对简单，因此建议HTTPS走配置文件，HTTP走代码配置。

### 对于HTTPS的配置：
在配置文件增加如下配置：
```
# HTTPS
server.ssl.key-store-type=PKCS12
server.ssl.key-store=classpath:ssl/xxxxx/xxxxx.pfx
server.ssl.key-store-password=xxxxx
server.ssl.enabled=true
server.port=443
```

### 对于HTTP的配置

增加配置代码
```java
@Configuration
public class HttpsConfiguration {
    /**
     * HTTP端口
     */
    @Value("${http.port}")
    private int httpPort;

    @Bean
    public ServletWebServerFactory servletContainer() {
        TomcatServletWebServerFactory tomcat = new TomcatServletWebServerFactory();
        tomcat.addAdditionalTomcatConnectors(createStandardConnector());
        return tomcat;
    }

    private Connector createStandardConnector() {
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        connector.setPort(httpPort);
        return connector;
    }

}

```

在配置文件增加如下配置：

```
# HTTP
http.port=80
```


## jetty

## 只支持HTTP
默认只支持HTTP，如果需要指定http的端口，则在配置文件增加如下配置：
```
server.port=81
```


## 只支持HTTPS

在配置文件增加如下配置：
```
# HTTPS
server.ssl.key-store-type=PKCS12
server.ssl.key-store=classpath:ssl/xxxxx/xxxxx.pfx
server.ssl.key-store-password=xxxxx
server.ssl.enabled=true
server.port=443
```

## 同时支持HTTP和HTTPS

默认只支持HTTP或HTTPS，如果需要同时支持HTTP + HTTPS，则需要增加额外的代码配置，来启用HTTP或者HTTPS。
由于HTTP配置相对简单，因此建议HTTPS走配置文件，HTTP走代码配置。也可以都走代码方式配置。

全部走代码方式的配置如下：

在配置文件增加如下配置：
```
#http
http.port=8081

#https
https.port=8444
https.ssl.key-store-type=PKCS12
https.ssl.key-store-password=xxxxx
https.ssl.key-store-file=ssl/xxxxx/xxxxx.pfx

```


增加配置代码
```java
@Configuration
public class HttpsConfiguration {
    
    /** HTTP端口 */
    @Value("${http.port}")
    private int httpPort;
    
    /** HTTPS端口 */
    @Value("${https.port}")
    private int httpsPort;
    
    /** HTTPS ssl密码 */
    @Value("${https.ssl.key-store-password}")
    private String httpsPassword;
    
    /** HTTPS ssl加密文件 */
    @Value("${https.ssl.key-store-file}")
    private String httpsFile;
    
    /** HTTPS ssl加密类型 */
    @Value("${https.ssl.key-store-type}")
    private String httpsType;
    
    @Bean
    public WebServerFactoryCustomizer<WebServerFactory> servletContainerCustomizer() {
        return new WebServerFactoryCustomizer<WebServerFactory>() {

            @Override
            public void customize(WebServerFactory container) {
                //自定义jetty容器
                if (container instanceof JettyServletWebServerFactory) {
                    customizeJetty((JettyServletWebServerFactory) container);
                }
            }
            /**
             * 修改jetty容器配置，同时开放http和https两个端口
             *
             * @author wangpeipei 
             * @createDate 2018-09-19 
             * @param container
             */
            private void customizeJetty(JettyServletWebServerFactory container) {
                
                container.addServerCustomizers((Server server) -> {
                    //默认jetty连接器是http
                    ServerConnector connector = new ServerConnector(server);
                    //设置jetty连接器端口号
                    connector.setPort(httpPort);
                    log.info("HTTP配置端口号：【{}】", httpPort);
                    
                    // HTTPS配置
                    //获取加密文件
                    URL httpsFileUrl  = HttpsConfiguration.class.getClassLoader().getResource(httpsFile);
                    
                    //通过ssl工厂分别设置加密文件、密码和加密类型
                    SslContextFactory sslContextFactory = new SslContextFactory();
                    sslContextFactory.setKeyStorePath(httpsFileUrl.toString());
                    sslContextFactory.setKeyStorePassword(httpsPassword);
                    sslContextFactory.setKeyStoreType(httpsType);

                    //设置http配置为https
                    HttpConfiguration config = new HttpConfiguration();
                    config.setSecureScheme(HttpScheme.HTTPS.asString());
                    config.addCustomizer(new SecureRequestCustomizer());

                    //设置jetty连接器为https
                    ServerConnector sslConnector = new ServerConnector(
                            server,
                            new SslConnectionFactory(sslContextFactory, HttpVersion.HTTP_1_1.asString()),
                            new HttpConnectionFactory(config));
                    sslConnector.setPort(httpsPort);
                    
                    //将两个不同端口的连接器设置到jetty server中
                    server.setConnectors(new Connector[]{connector, sslConnector});
                    
                    log.info("HTTPS配置端口号【{}】", httpsPort);
                    log.info("证书：【{}】", httpsFile);
                });
            }
        };
    }
}

```
