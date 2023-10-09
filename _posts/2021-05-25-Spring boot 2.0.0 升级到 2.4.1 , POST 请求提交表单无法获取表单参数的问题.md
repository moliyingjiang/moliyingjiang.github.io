---
layout: post
title:  "Spring boot 2.0.0 升级到 2.4.1 , POST 请求提交表单无法获取表单参数的问题"
categories: ['Spring Boot']
tags: ['Spring Boot'] 
author: YJ-MoLi
description: Spring boot 2.0.0 升级到 2.4.1 , POST 请求提交表单无法获取表单参数的问题
issueId: 2021-05-25 Spring Boot2.0.0升级到2.4.1POST表单参数的问题


---
* TOC
{:toc}


# Spring boot 2.0.0 升级到 2.4.1 , POST 请求提交表单无法获取表单参数的问题

## 描述

在通过`POST`请求提交`Form Data`的表单参数，并且`Content-Type: application/x-www-form-urlencoded; charset=UTF-8`时，在请求处理器中，在Request 中无法获取对应的参数对象。

请求样例：

![Alt text](/assets/images/springboot/1621913220468.png)

请求处理器获取的代码：
```java
if ("/submitLogin".equals(path)) {
     String usernameParam = request.getParameter(PARAM_NAME_USERNAME);
     String passwordParam = request.getParameter(PARAM_NAME_PASSWORD);
     if (username.equals(usernameParam) && password.equals(passwordParam)) {
         request.getSession().setAttribute(SESSION_USER_KEY, username);
         response.getWriter().print("success");
     } else {
         response.getWriter().print("error");
     }
     return;
 }
```


## 分析

### 1、 调研`request.getParameter(PARAM_NAME_USERNAME)` 的参数从哪里来

通过跟踪调用栈，发现是从`org.apache.coyote.Request#getParameters`中获取参数集合，调用栈如下：
```
getParameter:1130, Request (org.apache.catalina.connector)
getParameter:381, RequestFacade (org.apache.catalina.connector)
getParameter:158, ServletRequestWrapper (javax.servlet)
service:305, ResourceServlet$ResourceHandler (com.alibaba.druid.support.http)
service:130, ResourceServlet (com.alibaba.druid.support.http)
service:223, StatViewServlet (com.alibaba.druid.support.http)
service:733, HttpServlet (javax.servlet.http)
```

跟踪发现`org.apache.tomcat.util.http.Parameters#paramHashValues`的值为空。



### 2、 调研`org.apache.tomcat.util.http.Parameters#paramHashValues` 的值在什么地方设置

调研后发现，值的设置只有`org.apache.tomcat.util.http.Parameters#addParameter`  这个一个方法。继续跟踪该方法的调用链

发现了两个地方调用了该方法，分别是：`org.apache.tomcat.util.http.Parameters#processParameters(byte[], int, int, java.nio.charset.Charset)`和`org.apache.catalina.connector.Request#parseParts`


`org.apache.tomcat.util.http.Parameters#processParameters(byte[], int, int, java.nio.charset.Charset)`的调用链:
`org.apache.catalina.connector.Request#getParameter` 
	->`org.apache.catalina.connector.Request#parseParameters` 
	   ->`org.apache.tomcat.util.http.Parameters#processParameters(byte[], int, int)`

`org.apache.catalina.connector.Request#parseParameters`
->`org.apache.tomcat.util.http.Parameters#handleQueryParameters`
->`org.apache.tomcat.util.http.Parameters#processParameters(org.apache.tomcat.util.buf.MessageBytes, java.nio.charset.Charset)`

> 从调用链反推的调研效率较差，因此该方法先搁置。

### 3、 通过比对Spring Boot 的不同版本对POST提交Form表单的请求的处理
经过调研发现，`Request`中的`Parameter`是在`Filter`中被加工好了参数值，通过对吧`2.0.0`版本和`2.4.1`版本的`Filter Chain`,发现了问题。

Spring Boot 2.0.0 版本的`Filter Chain`:
```
0 = {ApplicationFilterConfig@11758} "ApplicationFilterConfig[name=characterEncodingFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedCharacterEncodingFilter]"
1 = {ApplicationFilterConfig@11747} "ApplicationFilterConfig[name=hiddenHttpMethodFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter]"
2 = {ApplicationFilterConfig@11790} "ApplicationFilterConfig[name=httpPutFormContentFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedHttpPutFormContentFilter]"
3 = {ApplicationFilterConfig@11791} "ApplicationFilterConfig[name=requestContextFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedRequestContextFilter]"
4 = {ApplicationFilterConfig@11792} "ApplicationFilterConfig[name=sessionFilter, filterClass=com.abc.springboot.frame.filter.HttpServletRequestReplacedFilter]"
5 = {ApplicationFilterConfig@11793} "ApplicationFilterConfig[name=webStatFilter, filterClass=com.alibaba.druid.support.http.WebStatFilter]"
6 = {ApplicationFilterConfig@11794} "ApplicationFilterConfig[name=corsFilter, filterClass=org.springframework.web.filter.CorsFilter]"
7 = {ApplicationFilterConfig@11795} "ApplicationFilterConfig[name=Tomcat WebSocket (JSR356) Filter, filterClass=org.apache.tomcat.websocket.server.WsFilter]"
```


Spring Boot 2.4.1 版本的`Filter Chain`:
```
0 = {ApplicationFilterConfig@14146} "ApplicationFilterConfig[name=characterEncodingFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedCharacterEncodingFilter]"
1 = {ApplicationFilterConfig@14199} "ApplicationFilterConfig[name=webMvcMetricsFilter, filterClass=org.springframework.boot.actuate.metrics.web.servlet.WebMvcMetricsFilter]"
2 = {ApplicationFilterConfig@14221} "ApplicationFilterConfig[name=formContentFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedFormContentFilter]"
3 = {ApplicationFilterConfig@14222} "ApplicationFilterConfig[name=requestContextFilter, filterClass=org.springframework.boot.web.servlet.filter.OrderedRequestContextFilter]"
4 = {ApplicationFilterConfig@14223} "ApplicationFilterConfig[name=sessionFilter, filterClass=com.abc.springboot.frame.filter.HttpServletRequestReplacedFilter]"
5 = {ApplicationFilterConfig@14224} "ApplicationFilterConfig[name=webStatFilter, filterClass=com.alibaba.druid.support.http.WebStatFilter]"
6 = {ApplicationFilterConfig@14225} "ApplicationFilterConfig[name=corsFilter, filterClass=org.springframework.web.filter.CorsFilter]"
7 = {ApplicationFilterConfig@14226} "ApplicationFilterConfig[name=Tomcat WebSocket (JSR356) Filter, filterClass=org.apache.tomcat.websocket.server.WsFilter]"
```

通过跟踪`Filter Chain`的执行，最终发现Form 参数的解析处理是在`org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter` 完成的。

### 4、调研`org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter`实现 

`org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter`  继承了`org.springframework.web.filter.HiddenHttpMethodFilter`

> 注意和`org.springframework.boot.web.reactive.filter`下的`OrderedHiddenHttpMethodFilter`类区分。


在`HiddenHttpMethodFilter#doFilterInternal`的方法中，调用了实际的方法处理代码

```java
	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {

		HttpServletRequest requestToUse = request;

		if ("POST".equals(request.getMethod()) && request.getAttribute(WebUtils.ERROR_EXCEPTION_ATTRIBUTE) == null) {
			//调用了解析Form data参数的处理
			String paramValue = request.getParameter(this.methodParam);
			if (StringUtils.hasLength(paramValue)) {
				String method = paramValue.toUpperCase(Locale.ENGLISH);
				if (ALLOWED_METHODS.contains(method)) {
					requestToUse = new HttpMethodRequestWrapper(request, method);
				}
			}
		}

		filterChain.doFilter(requestToUse, response);
	}

```

### 5、调研`org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter` 为什么没有加入`Filter Chain`

调研后发现，是由`org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration`配置类完成自动引入`org.springframework.boot.web.servlet.filter.OrderedHiddenHttpMethodFilter`的。
通过对比`Spring Boot 2.0.0` 和`2.4.1`版本的该类的代码，发现了问题所在。

`2.0.0`的代码:
```java
	@Bean
	@ConditionalOnMissingBean(HiddenHttpMethodFilter.class)
	public OrderedHiddenHttpMethodFilter hiddenHttpMethodFilter() {
		return new OrderedHiddenHttpMethodFilter();
	}

```

`2.4.1`的代码:
```java
	@Bean
	@ConditionalOnMissingBean(HiddenHttpMethodFilter.class)
	@ConditionalOnProperty(prefix = "spring.mvc.hiddenmethod.filter", name = "enabled", matchIfMissing = false)
	public OrderedHiddenHttpMethodFilter hiddenHttpMethodFilter() {
		return new OrderedHiddenHttpMethodFilter();
	}
```

在`2.0.0`版本中默认是启用了`OrderedHiddenHttpMethodFilter`,但在`2.4.1`版本中默认是不启用，需要通过配置`spring.mvc.hiddenmethod.filter.enabled=true` 来启用。

## 解决方案

增加配置：`spring.mvc.hiddenmethod.filter.enabled=true`


## 总结

该问题影响到所有通过`POST` 请求发送`Content-Type: application/x-www-form-urlencoded`的请求，比如`Druid `数据源的监控登录。