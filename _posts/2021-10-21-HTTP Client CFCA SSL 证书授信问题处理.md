---
layout: post
title:  "HTTP Client CFCA SSL证书授信问题处理"
categories: ['Java','SSL','HTTPS']
tags: ['Java','SSL','HTTPS'] 
author: YJ-MoLi
description: HTTP Client CFCA SSL证书授信问题处理
issueId: 2021-10-21 HTTP Client CFCA SSL证书授信问题处理

---
* TOC
{:toc}


# HTTP Client CFCA SSL证书授信问题处理

##  问题描述

通过HTTP Client 访问CFCA 签发的SSL证书的域名时出错，异常信息:

```
javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
	at java.base/sun.security.ssl.Alerts.getSSLException(Alerts.java:198)
	at java.base/sun.security.ssl.SSLSocketImpl.fatal(SSLSocketImpl.java:1969)
	at java.base/sun.security.ssl.Handshaker.fatalSE(Handshaker.java:345)
	at java.base/sun.security.ssl.Handshaker.fatalSE(Handshaker.java:339)
	at java.base/sun.security.ssl.ClientHandshaker.checkServerCerts(ClientHandshaker.java:1968)
	at java.base/sun.security.ssl.ClientHandshaker.serverCertificate(ClientHandshaker.java:1777)
	at java.base/sun.security.ssl.ClientHandshaker.processMessage(ClientHandshaker.java:264)
	at java.base/sun.security.ssl.Handshaker.processLoop(Handshaker.java:1092)
	at java.base/sun.security.ssl.Handshaker.processRecord(Handshaker.java:1026)
	at java.base/sun.security.ssl.SSLSocketImpl.processInputRecord(SSLSocketImpl.java:1137)
	at java.base/sun.security.ssl.SSLSocketImpl.readRecord(SSLSocketImpl.java:1074)
	at java.base/sun.security.ssl.SSLSocketImpl.readRecord(SSLSocketImpl.java:973)
	at java.base/sun.security.ssl.SSLSocketImpl.performInitialHandshake(SSLSocketImpl.java:1402)
	at java.base/sun.security.ssl.SSLSocketImpl.startHandshake(SSLSocketImpl.java:1429)
	at java.base/sun.security.ssl.SSLSocketImpl.startHandshake(SSLSocketImpl.java:1413)
	at org.apache.http.conn.ssl.SSLConnectionSocketFactory.createLayeredSocket(SSLConnectionSocketFactory.java:396)
	at org.apache.http.conn.ssl.SSLConnectionSocketFactory.connectSocket(SSLConnectionSocketFactory.java:355)
	at org.apache.http.impl.conn.DefaultHttpClientConnectionOperator.connect(DefaultHttpClientConnectionOperator.java:142)
	at org.apache.http.impl.conn.PoolingHttpClientConnectionManager.connect(PoolingHttpClientConnectionManager.java:373)
	at org.apache.http.impl.execchain.MainClientExec.establishRoute(MainClientExec.java:381)
	at org.apache.http.impl.execchain.MainClientExec.execute(MainClientExec.java:237)
	at org.apache.http.impl.execchain.ProtocolExec.execute(ProtocolExec.java:185)
	at org.apache.http.impl.execchain.RetryExec.execute(RetryExec.java:89)
	at org.apache.http.impl.execchain.RedirectExec.execute(RedirectExec.java:111)
	at org.apache.http.impl.client.InternalHttpClient.doExecute(InternalHttpClient.java:185)
	at org.apache.http.impl.client.CloseableHttpClient.execute(CloseableHttpClient.java:83)
	at org.apache.http.impl.client.CloseableHttpClient.execute(CloseableHttpClient.java:108)

```


证书信息：

![Alt text]({{ site.baseurl }}/assets/images/java/1630997758912.png)


## 调研

因为JDK 没有把CFCA的根证书加入的授信的库列表里，但市面上主流的浏览器基本都加入，因此导致浏览器可以正常方法，但通过HTTP Client 访问就会提示SSL证书检查不通过。


## 解决方案

###  方案1： 将根证书或当前证书导入到JDK的授信库
略

> 该方案实现难度较大，需要在所有代码执行的地方都执行导入的动作

###  方案2： HTTP Client  忽略所有SSL证书的验证


构建一个信任所有证书的`SSLContext`

```java
public static SSLContext getSSLIgnoreContext(){
    try {
        return SSLContexts.custom().loadTrustMaterial(new TrustAllStrategy()).build();
    } catch (NoSuchAlgorithmException e) {
        log.warn(e);
    } catch (KeyManagementException e) {
        log.warn(e);
    } catch (KeyStoreException e) {
        log.warn(e);
    }
    return null;
}

```

创建HTTP Client，指定SSLContext
```java
public static CloseableHttpClient getSSLIgnoreCheckHttpClient(){
    return HttpClientBuilder.create()
		.setSSLContext(getSSLIgnoreContext())
		.build();
}

```

> 该方案的风险较大，会导致所有SSL证书都不验证。

###  方案3： HTTP Client  只忽略CFCA签发的SSL证书的验证

创建一个CFCA免验证的授信策略类`TrustStrategy`

```java
public class CFCATrustStrategy implements TrustStrategy {

    /**
     * Determines whether the certificate chain can be trusted without consulting the trust manager
     * configured in the actual SSL context. This method can be used to override the standard JSSE
     * certificate verification process.
     * <p>
     * Please note that, if this method returns {@code false}, the trust manager configured
     * in the actual SSL context can still clear the certificate as trusted.
     *
     * @param chain    the peer certificate chain
     * @param authType the authentication type based on the client certificate
     * @return {@code true} if the certificate can be trusted without verification by
     * the trust manager, {@code false} otherwise.
     * @throws CertificateException thrown if the certificate is not trusted or invalid.
     */
    @Override public boolean isTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        if(chain!=null && chain.length > 0){
            for(X509Certificate certificate:chain){
                if("CN=CFCA EV ROOT, O=China Financial Certification Authority, C=CN".equals(certificate.getSubjectDN().getName())){
                    return true;
                }
            }
        }
        return false;
    }
}
```


构建一个只忽略CFCA签发的证书的`SSLContext`

```java
public static SSLContext getCFCASSLIgnoreContext(){
    try {
        return SSLContexts.custom().loadTrustMaterial(new CFCATrustStrategy()).build();
    } catch (NoSuchAlgorithmException e) {
        log.warn(e);
    } catch (KeyManagementException e) {
        log.warn(e);
    } catch (KeyStoreException e) {
        log.warn(e);
    }
    return null;
}

```

创建HTTP Client，指定SSLContext
```java
public static CloseableHttpClient getSSLIgnoreCheckHttpClient(){
    return HttpClientBuilder.create()
		.setSSLContext(getSSLIgnoreContext())
		.build();
}

```

> 该方案的风险较小，推荐使用。