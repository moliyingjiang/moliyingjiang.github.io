---
layout: post
title:  "Spring Boot全局处理"
categories: ['Spring','Spring Boot']
tags: ['Spring','Spring Boot'] 
author: Feiyizhan
description: Spring Boot全局处理
issueId: 2018-6-5 Spring Boot Global Process

---
* TOC
{:toc}

# Spring Boot全局处理

## Spring Boot全局异常处理
异常指：
1. 在执行@RequestMapping时，进入逻辑处理阶段前。如传的参数类型错误。
2. 在controller里执行逻辑代码时出的异常。如NullPointerException。 

使用`@ControllerAdvice`注解，代码如下:

```java
/**
 * 全局异常处理
 */
@ControllerAdvice
@Log4j2
public class GlobalExceptionHandler {

    
    /**
     * 请求参数转换异常
     * @param req
     * @param e
     * @return
     * @throws Exception
     */
    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    @ResponseBody
    public ResponseEntity<ResponseObject<?>> httpMessageNotReadableHandler(HttpServletRequest req, HttpMessageNotReadableException e) throws Exception {
        log.error("参数转换异常：", e);
        return ResponseEntity.unprocessableEntity().body(ResponseObject.requestVerifyFailed());
    }
    
    /**
     * 无权访问异常
     * @param req
     * @param e
     * @return
     * @throws Exception
     */
    @ExceptionHandler(value = UnauthorizedException.class)
    @ResponseBody
    public ResponseEntity<ResponseObject<?>> unauthorizedExceptionHandler(HttpServletRequest req, UnauthorizedException e) throws Exception {
        log.error("无权访问异常：", e);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ResponseObject.unauthorized());
    }
    
    /**
     * 未登录异常
     * @param req
     * @param e
     * @return
     * @throws Exception
     */
    @ExceptionHandler(value = UnLoginException.class)
    @ResponseBody
    public ResponseEntity<ResponseObject<?>> unloginExceptionHandler(HttpServletRequest req, UnLoginException e) throws Exception {
        log.error("未登录异常：", e);
        return ResponseEntity.ok(ResponseObject.unlogin());
    }
    
    /**
     * 默认异常处理
     * <br/> 默认返回500消息头，消息体为系统内部错误
     * @param req
     * @param e
     * @return
     * @throws Exception
     */
    @ExceptionHandler(value = Exception.class)
    @ResponseBody
    public ResponseEntity<ResponseObject<?>> defaultErrorHandler(HttpServletRequest req, Exception e) throws Exception {
        log.error("系统异常：", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ResponseObject.systemError());
    }
    
    
    /**
     * 默认异常处理
     * @createDate 2018-04-13 
     * @param req
     * @param e
     * @return
     * @throws Exception
     */
    @ExceptionHandler(value = RuntimeException.class)
    @ResponseBody
    public ResponseEntity<ResponseObject<?>> defaultErrorHandler(HttpServletRequest req, RuntimeException e) throws Exception {
        log.error("系统异常：", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ResponseObject.systemError());
    }
    


}
```


## Spring Boot全局错误处理
全局错误处理是指：
1. 在进入Controller之前，如请求一个不存在的地址，404错误。

实现`ErrorController`接口，代码如下：
```java
/**
 * 自定义错误处理
 */
@Controller
@Log4j2
@ApiIgnore
public class GlobalErrorController implements ErrorController {
    private static final String ERROR_PATH = "/error"; 
    /* (non-Javadoc)
     * @see org.springframework.boot.web.servlet.error.ErrorController#getErrorPath()
     */
    @Override 
    public String getErrorPath() { 
      return ERROR_PATH; 
    } 
    
    
    @RequestMapping(value = ERROR_PATH)
    public ResponseEntity<ResponseObject<?>> error(HttpServletRequest request,
            HttpServletResponse response){ 
        HttpStatus status = getStatus(request);
        switch (status) {
            case NOT_FOUND: //404
                log.info("资源不存在");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ResponseObject.notFound());
                

            default:
                log.info("系统出错{}",status);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ResponseObject.systemError());
        }
       
    } 
    
    /**
     * 获取错误编码
     * @param request
     * @return
     */
    private HttpStatus getStatus(HttpServletRequest request) {
        Integer statusCode = (Integer) request
                .getAttribute("javax.servlet.error.status_code");
        if (statusCode == null) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        try {
            return HttpStatus.valueOf(statusCode);
        }
        catch (Exception ex) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
    }
    
}
```


## Spring Boot全局输入和输出参数转换
全局输入参数转换是指在Sping 将请求的参数绑定到Controller方法的参数之前做的参数对象反系列化操作。如：
1. 将请求中的字符串日期按照指定的日期格式和时区，构建为指定类型的日期对象。
2. 将请求中的字符串进行HTML编码。

Spring Boot是使用Jackson进行参数的反系列化和响应的系列化处理的。
方法：
1. 使用`@JsonComponent`注解构建一个指定目标类型的Json系列化和反系列化处理组件。参考官方文档：[Custom JSON Serializers and Deserializers](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#boot-features-json-components)

2. 使用`@Configuration`注解构建一个配置类，创建一个方法返回`com.fasterxml.jackson.databind.Module` ，并使用`@Bean`注解该方法。参考[Customize the Jackson ObjectMapper](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#howto-customize-the-jackson-objectmapper)，代码如下:

```java
@Bean
public com.fasterxml.jackson.databind.Module customeJackSonModule() {
    SimpleModule bean = new SimpleModule();
    //LocalDateTime的反系列化使用自定义的处理器，用于适应多种自定义日期格式的转换处理
    bean.addDeserializer(LocalDateTime.class, MyLocalDateTimeDeserializer.INSTANCE);
    //String的反系列化使用自定义的处理器，用于XSS攻击
    bean.addDeserializer(String.class, MyStringDeserializer.INSTANCE);
    //LocalDateTime的系列化替换默认的ISO日期格式为自定义的日期格式
    bean.addSerializer(LocalDateTime.class, new LocalDateTimeSerializer(SystemConstant.FORMAT_TIMESTAMP));
    return bean;
}

```

以上的配置仅对RequestBody的参数转换有效，对于在URL Parameter上的参数绑定，则不会执行这个处理。因此对于这块的参数反系列化处理需要使用Spring Boot的`Formatter`。代码如下：
继承`WebMvcConfigurerAdapter`并覆盖`addFormatters`方法，在方法中增加类型对应的Formatter处理器。
```java
public class CustomWebMvcConfigurerAdapter extends WebMvcConfigurerAdapter  {

    /* (non-Javadoc)
     * @see org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter#addFormatters(org.springframework.format.FormatterRegistry)
     */
    @Override
    public void addFormatters(FormatterRegistry registry) {
        //仅对Path方式传入的参数生效
        registry.addFormatterForFieldType(String.class, new StringFormatter());
        registry.addFormatterForFieldType(LocalDateTime.class, new LocalDateTimeFormatter());
        
    }
}    
```


### 自定义的LocalDateTime反系列化处理器，可以参考Jackson自带的LocalDateTime反系列化处理器。
```java
/**
 * 自定义的LocalDateTime反系列化处理器
 */
public class MyLocalDateTimeDeserializer extends JSR310DateTimeDeserializerBase<LocalDateTime> {
    private static final long serialVersionUID = 1L;

    private static final DateTimeFormatter DEFAULT_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public static final MyLocalDateTimeDeserializer INSTANCE = new MyLocalDateTimeDeserializer();

    private MyLocalDateTimeDeserializer() {
        this(DEFAULT_FORMATTER);
    }

    public MyLocalDateTimeDeserializer(DateTimeFormatter formatter) {
        super(LocalDateTime.class, formatter);
    }

    @Override
    protected JsonDeserializer<LocalDateTime> withDateFormat(DateTimeFormatter formatter) {
        return new LocalDateTimeDeserializer(formatter);
    }

    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.hasTokenId(JsonTokenId.ID_STRING)) {
            String string = parser.getText().trim();
            if (string.length() == 0) {
                return null;
            }

            try {
                if (_formatter == DEFAULT_FORMATTER) {
                    // JavaScript by default includes time and zone in JSON serialized Dates (UTC/ISO instant format).
                    if (string.length() > 10 && string.charAt(10) == 'T') {
                        if (string.endsWith("Z")) {
                            return LocalDateTime.ofInstant(Instant.parse(string), ZoneOffset.UTC);
                        } else {
                            return LocalDateTime.parse(string, DEFAULT_FORMATTER);
                        }
                    }
                }
                //在这里增加自定义的字符串反系列化为LocalDateTime的处理。
                int length = string.length();
                switch (length) {
                    case 10:
                        return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE);
                    case 16:
                        return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE_SHORT_TIME);
                    case 19:
                        return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE_TIME);
                    case 23:
                        return LocalDateTime.parse(string, SystemConstant.FORMAT_TIMESTAMP);
                    default:
                        return LocalDateTime.parse(string, SystemConstant.FORMAT_TIMESTAMP_ALL);
                }
    
//                return LocalDateTime.parse(string, _formatter);
            } catch (DateTimeException e) {
                _rethrowDateTimeException(parser, context, e, string);
            }
        }
        if (parser.isExpectedStartArrayToken()) {
            JsonToken t = parser.nextToken();
            if (t == JsonToken.END_ARRAY) {
                return null;
            }
            if ((t == JsonToken.VALUE_STRING || t == JsonToken.VALUE_EMBEDDED_OBJECT)
                    && context.isEnabled(DeserializationFeature.UNWRAP_SINGLE_VALUE_ARRAYS)) {
                final LocalDateTime parsed = deserialize(parser, context);
                if (parser.nextToken() != JsonToken.END_ARRAY) {
                    handleMissingEndArrayForSingle(parser, context);
                }
                return parsed;
            }
            if (t == JsonToken.VALUE_NUMBER_INT) {
                LocalDateTime result;

                int year = parser.getIntValue();
                int month = parser.nextIntValue(-1);
                int day = parser.nextIntValue(-1);
                int hour = parser.nextIntValue(-1);
                int minute = parser.nextIntValue(-1);

                t = parser.nextToken();
                if (t == JsonToken.END_ARRAY) {
                    result = LocalDateTime.of(year, month, day, hour, minute);
                } else {
                    int second = parser.getIntValue();
                    t = parser.nextToken();
                    if (t == JsonToken.END_ARRAY) {
                        result = LocalDateTime.of(year, month, day, hour, minute, second);
                    } else {
                        int partialSecond = parser.getIntValue();
                        if (partialSecond < 1_000
                                && !context.isEnabled(DeserializationFeature.READ_DATE_TIMESTAMPS_AS_NANOSECONDS))
                            partialSecond *= 1_000_000; // value is milliseconds, convert it to nanoseconds
                        if (parser.nextToken() != JsonToken.END_ARRAY) {
                            throw context.wrongTokenException(parser, handledType(), JsonToken.END_ARRAY,
                                    "Expected array to end");
                        }
                        result = LocalDateTime.of(year, month, day, hour, minute, second, partialSecond);
                    }
                }
                return result;
            }
            context.reportInputMismatch(handledType(), "Unexpected token (%s) within Array, expected VALUE_NUMBER_INT",
                    t);
        }
        if (parser.hasToken(JsonToken.VALUE_EMBEDDED_OBJECT)) {
            return (LocalDateTime) parser.getEmbeddedObject();
        }
        //在这里增加long类型的毫秒转LocalDateTime的处理
        if (parser.hasToken(JsonToken.VALUE_NUMBER_INT)) { //支持毫秒转LocalDateTime
            long longValue = parser.getLongValue();
            return LocalDateTime.ofInstant(Instant.ofEpochMilli(longValue), SystemConstant.UTC_8);
//            _throwNoNumericTimestampNeedTimeZone(parser, context);
        }
        throw context.wrongTokenException(parser, handledType(), JsonToken.VALUE_STRING, "Expected array or string.");
    }
}

```

### 自定义的字符串反系列化处理器，通用可以参考Jackson自带的字符串反系列化处理器。
```java
/**
 * 自定义的String的反系列化处理器。
 */
public class MyStringDeserializer extends StdScalarDeserializer<String> {// non-final since 2.9
    private static final long serialVersionUID = 1L;

    /**
     * @since 2.2
     */
    public final static MyStringDeserializer INSTANCE = new MyStringDeserializer();

    public MyStringDeserializer() {
        super(String.class);
    }

    // since 2.6, slightly faster lookups for this very common type
    @Override
    public boolean isCachable() {
        return true;
    }

    @Override // since 2.9
    public Object getEmptyValue(DeserializationContext ctxt) throws JsonMappingException {
        return "";
    }
    
    private String escape(String str) {
        return HtmlUtils.htmlEscape(HtmlUtils.htmlUnescape(str));
    }

    @Override
    public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        if (p.hasToken(JsonToken.VALUE_STRING)) {
            //先做html解码再编码，保证后台收到的数据始终是一次编码后的内容
            return escape(p.getText());
        }
        JsonToken t = p.getCurrentToken();
        // [databind#381]
        if (t == JsonToken.START_ARRAY) {
            return escape(_deserializeFromArray(p, ctxt));
        }
        // need to gracefully handle byte[] data, as base64
        if (t == JsonToken.VALUE_EMBEDDED_OBJECT) {
            Object ob = p.getEmbeddedObject();
            if (ob == null) {
                return null;
            }
            if (ob instanceof byte[]) {
                return escape(ctxt.getBase64Variant().encode((byte[]) ob, false));
            }
            // otherwise, try conversion using toString()...
            return escape(ob.toString());
        }
        // allow coercions for other scalar types
        // 17-Jan-2018, tatu: Related to [databind#1853] avoid FIELD_NAME by ensuring it's
        // "real" scalar
        if (t.isScalarValue()) {
            String text = p.getValueAsString();
            if (text != null) {
                return text;
            }
        }
        return escape((String) ctxt.handleUnexpectedToken(_valueClass, p));
    }

    // Since we can never have type info ("natural type"; String, Boolean, Integer, Double):
    // (is it an error to even call this version?)
    @Override
    public String deserializeWithType(JsonParser p, DeserializationContext ctxt, TypeDeserializer typeDeserializer)
            throws IOException {
        return deserialize(p, ctxt);
    }
}

```


### 自定义的LocalDateTime的系列化处理器，参考Jackson自带的处理器。
```java
/**
 * Serializer for Java 8 temporal {@link LocalDateTime}s.
 *
 * @author Nick Williams
 * @since 2.2
 */
public class LocalDateTimeSerializer extends JSR310FormattedSerializerBase<LocalDateTime>
{
    private static final long serialVersionUID = 1L;

    public static final LocalDateTimeSerializer INSTANCE = new LocalDateTimeSerializer();
    
    protected LocalDateTimeSerializer() {
        this(null);
    }

    public LocalDateTimeSerializer(DateTimeFormatter f) {
        super(LocalDateTime.class, f);
    }

    private LocalDateTimeSerializer(LocalDateTimeSerializer base, Boolean useTimestamp, DateTimeFormatter f) {
        super(base, useTimestamp, f, null);
    }

    @Override
    protected JSR310FormattedSerializerBase<LocalDateTime> withFormat(Boolean useTimestamp, DateTimeFormatter f, JsonFormat.Shape shape) {
        return new LocalDateTimeSerializer(this, useTimestamp, f);
    }

    protected DateTimeFormatter _defaultFormatter() {
        return DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    }

    @Override
    public void serialize(LocalDateTime value, JsonGenerator g, SerializerProvider provider)
        throws IOException
    {
        if (useTimestamp(provider)) {
            g.writeStartArray();
            _serializeAsArrayContents(value, g, provider);
            g.writeEndArray();
        } else {
            DateTimeFormatter dtf = _formatter;
            if (dtf == null) {
                dtf = _defaultFormatter();
            }
            g.writeString(value.format(dtf));
        }
    }

    @Override
    public void serializeWithType(LocalDateTime value, JsonGenerator g, SerializerProvider provider,
            TypeSerializer typeSer) throws IOException
    {
        WritableTypeId typeIdDef = typeSer.writeTypePrefix(g,
                typeSer.typeId(value, serializationShape(provider)));
        // need to write out to avoid double-writing array markers
        if (typeIdDef.valueShape == JsonToken.START_ARRAY) {
            _serializeAsArrayContents(value, g, provider);
        } else {
            DateTimeFormatter dtf = _formatter;
            if (dtf == null) {
                dtf = _defaultFormatter();
            }
            g.writeString(value.format(dtf));
        }
        typeSer.writeTypeSuffix(g, typeIdDef);
    }

    private final void _serializeAsArrayContents(LocalDateTime value, JsonGenerator g,
            SerializerProvider provider) throws IOException
    {
        g.writeNumber(value.getYear());
        g.writeNumber(value.getMonthValue());
        g.writeNumber(value.getDayOfMonth());
        g.writeNumber(value.getHour());
        g.writeNumber(value.getMinute());
        final int secs = value.getSecond();
        final int nanos = value.getNano();
        if ((secs > 0) || (nanos > 0)) {
            g.writeNumber(secs);
            if (nanos > 0) {
                if (provider.isEnabled(SerializationFeature.WRITE_DATE_TIMESTAMPS_AS_NANOSECONDS)) {
                    g.writeNumber(nanos);
                } else {
                    g.writeNumber(value.get(ChronoField.MILLI_OF_SECOND));
                }
            }
        }
    }
    
    @Override // since 2.9
    protected JsonToken serializationShape(SerializerProvider provider) {
        return useTimestamp(provider) ? JsonToken.START_ARRAY : JsonToken.VALUE_STRING;
    }
}

```

### 自定义的LocalDateTime Formatter处理器，需要实现`Formatter`接口。代码如下：
```java
/**
 * 自定义的LocalDateTime字符串格式化处理器（用于Path路径参数处理）
 */
public class LocalDateTimeFormatter implements Formatter<LocalDateTime>{

    /* (non-Javadoc)
     * @see org.springframework.format.Printer#print(java.lang.Object, java.util.Locale)
     */
    @Override
    public String print(LocalDateTime object, Locale locale) {
        return object.format(SystemConstant.FORMAT_TIMESTAMP);
    }

    /* (non-Javadoc)
     * @see org.springframework.format.Parser#parse(java.lang.String, java.util.Locale)
     */
    @Override
    public LocalDateTime parse(String string, Locale locale) throws ParseException {
        if(StringUtils.isBlank(string)) {
            return null;
        }
        int length = string.length();
        switch (length) {
            case 10:
                return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE);
            case 16:
                return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE_SHORT_TIME);
            case 19:
                return LocalDateTime.parse(string, SystemConstant.FORMAT_DATE_TIME);
            case 23:
                return LocalDateTime.parse(string, SystemConstant.FORMAT_TIMESTAMP);
            default:
                return LocalDateTime.parse(string, SystemConstant.FORMAT_TIMESTAMP_ALL);
        }
    }

}

```

### 自定义的字符串格式化处理器，需要实现`Formatter`接口。代码如下：
```java
/**
 * 自定义的字符串格式化处理器（用于Path路径参数处理）
 */
public class StringFormatter implements Formatter<String>{

    /* (non-Javadoc)
     * @see org.springframework.format.Printer#print(java.lang.Object, java.util.Locale)
     */
    @Override
    public String print(String object, Locale locale) {
        return object;
    }

    /* (non-Javadoc)
     * @see org.springframework.format.Parser#parse(java.lang.String, java.util.Locale)
     */
    @Override
    public String parse(String text, Locale locale) throws ParseException {
        if (StringUtils.isBlank(text)) {
            return null;
        } else {
            //先做html解码再编码，保证后台收到的数据始终是一次编码后的内容
            return HtmlUtils.htmlEscape(HtmlUtils.htmlUnescape(text));
        }
    }

}
```

# 一些坑点

## 1. Spring Boot继承WebMvcConfigurerAdapter 和WebMvcConfigurationSupport的区别
继承WebMvcConfigurationSupport会导致Spring Boot的默认配置失效，一些基于默认配置的处理就不会生效，比如自定义Jackson系列化和反系列化处理。静态资源绑定等。

