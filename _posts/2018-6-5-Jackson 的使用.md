---
layout: post
title:  "Jackson 的使用"
categories: ['java','Jackson']
tags: ['java','Jackson'] 
author: YJ-MoLi
description: Jackson 的使用
issueId: 2018-6-5 The use of Jackson

---
* TOC
{:toc}



# Jackson 的使用

## 一些转换参数设置
###  设置对象不存在不报错和处理long格式日期

```java
-     /**
-      * 返回mapper，忽略未知参数、使用long解析时间
-      *
-      * @return
-      */
-     public static ObjectMapper om() {
-         ObjectMapper mapper = new ObjectMapper();
-         mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
-                 false);
-         mapper.configure(
-                 DeserializationFeature.READ_DATE_TIMESTAMPS_AS_NANOSECONDS,
-                 true);
-         return mapper;
-     }
```

### 不返回null值对象属性
使用`@JsonInclude(Include.NON_NULL)`注解或者全局配置`spring.jackson.default-property-inclusion=non-null`

### 指定属性绑定关系
使用注解`@JsonProperty(value = "Created")` ,可以将json字符串中的属性名和java对象中的成员名不一致的进行绑定。


## 简单的泛型对象反系列化
jackson处理一般的JavaBean和Json之间的转换只要使用ObjectMapper 对象的readValue和writeValueAsString两个方法就能实现。但是如果要转换复杂类型Collection如 List<YourBean>，那么就需要先反序列化复杂类型 为泛型的Collection Type。

如果是`ArrayList<YourBean>`那么使用`ObjectMapper 的getTypeFactory().constructParametricType(collectionClass, elementClasses)`;
如果是`HashMap<String,YourBean>`那么 ObjectMapper 的`getTypeFactory().constructParametricType(HashMap.class,String.class, YourBean.class)`;

```java
 public final ObjectMapper mapper = new ObjectMapper();

 public static void main(String[] args) throws Exception{
	 JavaType javaType = getCollectionType(ArrayList.class, YourBean.class);
	 List<YourBean> lst = (List<YourBean>)mapper.readValue(jsonString, javaType);
 }
 /**
 * 获取泛型的Collection Type
 * @param collectionClass 泛型的Collection
 * @param elementClasses 元素类
 * @return JavaType Java类型
 * @since 1.0
 */
 public static JavaType getCollectionType(Class<?> collectionClass, Class<?>... elementClasses) {
	 return mapper.getTypeFactory().constructParametricType(collectionClass, elementClasses);
 }

```
注： 2.5版本以后，使用
`JavaType javaType = mapper.getTypeFactory().constructParametrizedType(ArrayList.class,List.class, Sidebar.class);`


## 多层嵌套的泛型对象的反系列化
对于一些多层嵌套的泛型对象，例如`TianYanChaResponse<TianYanChaListResult<TianYanChaResultItem190>> response`，无法通过下面的方法，通过Class构建JavaType转换。

```java
JavaType javaType = OM.getTypeFactory().constructParametrizedType(objClass, superObjClass,elementClasses);
return OM.readValue(json, javaType);
```

这个时候可以通过构建`com.fasterxml.jackson.core.type.TypeReference`对象，再调用readValue方法，传入构建好的TypeReference对象。

```java
TypeReference<TianYanChaResponse<TianYanChaListResult<TianYanChaResultItem190>>> RESPONSE_TYPE_SERARCHV2=new TypeReference<TianYanChaResponse<TianYanChaListResult<TianYanChaResultItem190>>>() {};

 public static <T> T JsonToObject(String json,TypeReference<T> javaType){
     try {
         return OM.readValue(json, javaType);
     } catch (JsonParseException e) {
         // TODO Auto-generated catch block
         e.printStackTrace();
     } catch (JsonMappingException e) {
         // TODO Auto-generated catch block
         e.printStackTrace();
     } catch (IOException e) {
         // TODO Auto-generated catch block
         e.printStackTrace();
     }
     return null;
 }

```



## 一些坑点
1. Jackson反系列化时，内部类需要定义为static，否则无法系列化。
2. Spring配置的Dateformat对LocalDateTime等JDK8新增加的日期类型无效，仅对Date类型有效。
