---
layout: post
title:  "Spring Boot 拦截器记录请求详细日志"
categories: ['java','Spring','Spring Boot']
tags: ['java','Spring','Spring Boot'] 
author: Feiyizhan
description: Spring Boot 拦截器记录请求详细日志
issueId: 2018-6-6 Get Request Body In Interceptor

---
* TOC
{:toc}


# Spring Boot 拦截器记录请求详细日志
需求：在拦截器中获取请求的URL及请求的参数，并不影响后续Controller中获取请求参数。
问题：StringMVC中@RequestBody是读取的流的方式, 如果在之前有读取过流后, 发现就没有了。因此必须要做到在拦截器中读取了RequestBody的流内容之后，还能不影响后续Controller的@RequestBody参数绑定的处理。

## 实现
1. 用自定义的Request覆盖默认的HTTPServletRequest，自定义的Request需要支持可以重复读取流内容。

```java
public class BodyReaderHttpServletRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;

    public BodyReaderHttpServletRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        body = HttpHelper.getBody(request) ;
    }

    @Override
    public BufferedReader getReader() throws IOException {
        return new BufferedReader(new InputStreamReader(getInputStream()));
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {

        final ByteArrayInputStream bais = new ByteArrayInputStream(body);

        return new ServletInputStream() {

            @Override
            public int read() throws IOException {
                return bais.read();
            }

            @Override
            public boolean isFinished() {
                return false;
            }

            @Override
            public boolean isReady() {
                return false;
            }

            @Override
            public void setReadListener(ReadListener readListener) {

            }
        };
    }
}

```

``` java
public class HttpHelper {
    
    /**
     * 获取请求内容
     * @param request
     * @return
     */
    public static byte[] getBody(ServletRequest request) {
        try {
            InputStream inputStream = request.getInputStream();
            return inputStream.readAllBytes();
        } catch (IOException ex) {
            // TODO Auto-generated catch block
            ex.printStackTrace();
        }
        return new byte[0];
    }

}
```

2. 自定义过滤器，用于拦截所有请求，覆盖所有请求中的Request对象为自定义的Request对象。

```java
public class HttpServletRequestReplacedFilter implements Filter {

    /* (non-Javadoc)
     * @see javax.servlet.Filter#init(javax.servlet.FilterConfig)
     */
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // TODO Auto-generated method stub

    }

    /* (non-Javadoc)
     * @see javax.servlet.Filter#doFilter(javax.servlet.ServletRequest, javax.servlet.ServletResponse, javax.servlet.FilterChain)
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        ServletRequest requestWrapper = null;  
        if(request instanceof HttpServletRequest) {  
            requestWrapper = new BodyReaderHttpServletRequestWrapper((HttpServletRequest) request);  
        }  
        if(requestWrapper == null) {  
            chain.doFilter(request, response);  
        } else {  
            //用自定义的Request覆盖默认的Request
            chain.doFilter(requestWrapper, response);  
        }  

    }

    /* (non-Javadoc)
     * @see javax.servlet.Filter#destroy()
     */
    @Override
    public void destroy() {
        // TODO Auto-generated method stub

    }

}

```

3. 将自定义的过滤器加到Spring Boot的过滤器链中，并设置过滤所有请求。

```java
  @SuppressWarnings({"rawtypes", "unchecked"})
  @Bean  
  public FilterRegistrationBean  filterRegistrationBean() {  
      FilterRegistrationBean registration = new FilterRegistrationBean();
      registration.setFilter(sessionFilter());
      registration.addUrlPatterns("/*");
      registration.setName("sessionFilter");
      return registration; 
  } 
  
  /**
   * 创建一个bean
   * @return
   */
  @Bean(name = "sessionFilter")
  public Filter sessionFilter() {
      return new HttpServletRequestReplacedFilter();
  }
```

4. 自定义拦截器

```java
public class SecurityInterceptor extends HandlerInterceptorAdapter {
    /* (non-Javadoc)
     * @see org.springframework.web.servlet.handler.HandlerInterceptorAdapter#preHandle(javax.servlet.http.HttpServletRequest, javax.servlet.http.HttpServletResponse, java.lang.Object)
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        //请求之前拦截
 
        String uri = getPathWithinApplication(request);
        String sessionId = request.getSession().getId();
        String sessionAccessToken = getToken(request);
        String method = request.getMethod();
        String ip = getIpAddr(request);
        String urlParameters =JsonUtils.objectToJson(request.getParameterMap());
        String requetBody = new String(HttpHelper.getBody(request),"UTF-8");
                
        log.info("接收到请求URL【{}】,请求的ip【{}】,请求的sessionId【{}】,请求的Token【{}】,请求的类型【{}】",uri,ip,sessionId,sessionAccessToken,method);
        log.info("请求的URL参数【{}】",urlParameters);
        log.info("请求的Body【{}】",requetBody);
     }
}
```

5. 配置拦截器拦截的URL

```java
public class CustomWebMvcConfigurerAdapter extends WebMvcConfigurerAdapter  {
    @Bean
    public SecurityInterceptor getSecurityInterceptor() {
        return new SecurityInterceptor();
    }
    

    /* (non-Javadoc)
     * @see org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter#addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry)
     */
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(getSecurityInterceptor())
                // 拦截配置
                .addPathPatterns("/**")
                // 排除配置
                .excludePathPatterns(
                        //过滤Swagger相关URL
                        ,"/swagger**/**","/webjars**/**","/v2/api-docs"
                        //Spring Boot 出错页面
                        ,"/error"
                        )
                ;

    }
}

```
