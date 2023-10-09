---
layout: post 
title:  "MyBatis TypeHandler的笔记"
categories: ['MyBatis ']
tags: ['MyBatis','Spring Boot'] 
author: Feiyizhan
description: MyBatis TypeHandler的笔记
issueId: 2019-5-29 MyBatis TypeHandler

---
* TOC
{:toc}

# MyBatis TypeHandler的笔记


## 需求
对所有查询结果中的类型为`String` 的属性做一个HTML Decode处理。
 
## 项目背景

Spring Boot 2.0 + MyBatis3.4.6

## 调研
自定义`TypeHandler`  可以实现 `org.apache.ibatis.type.TypeHandler` 接口或者继承一个类`org.apache.ibatis.type.BaseTypeHandler`。之后设置`JavaType`和`JdbcType`来限定这个`TypeHandler` 的范围。



参考：
[mybatis 3官方文档](http://www.mybatis.org/mybatis-3/zh/configuration.html)

## 实现

### 编码

```java
@MappedTypes(String.class)
@MappedJdbcTypes(value = {CLOB,CLOB,VARCHAR,LONGVARCHAR,NVARCHAR,NCHAR,NCLOB},includeNullJdbcType = true)
public class MyStringTypeHandle extends BaseTypeHandler<String> {
    @Override public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType)
        throws SQLException {
        ps.setString(i, parameter);
    }

    @Override public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return StringEscapeUtils.unescapeHtml4(rs.getString(columnName));
    }

    @Override public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return StringEscapeUtils.unescapeHtml4(rs.getString(columnIndex));
    }

    @Override public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return StringEscapeUtils.unescapeHtml4(cs.getString(columnIndex));
    }
}
```


### 配置

#### 启用
启用该`TypeHandler` 可以有以下几种方式：

#####   在`Spring Boot`的配置文件增加`type-handlers-package`的配置
`type-handlers-package`的配置的值为`TypeHandler`的包名即可，即在`application.properties`文件增加以下配置：

```
mybatis.type-handlers-package=com.xxx.typehandler
```

> 该配置会被`org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration`读取，并调用`org.mybatis.spring.SqlSessionFactoryBean`来完成`TypeHandler`的初始化。

#####  在`Spring Boot`指定MyBatisConfig文件的路径，之后在MyBatisConfig中配置`typeHandlers`
配置如下：
-  在`application.properties`文件增加以下配置：

```
mybatis.config-location=classpath:mybatis-config.xml
```

- 在`mybatis-config.xml`文件增加以下配置：

```xml
<configuration>
	<typeHandlers>
		<package name="com.xxx.typehandler"/>
	</typeHandlers>
</configuration>

```

>注：如果在`application.properties`文件指定了`mybatis.configuration` ，又同时配置`mybatis.config-location`,则需要把`application.properties`的`mybatis.configuration`的配置移到`mybatis-config.xml`文件里。否则启用会校验失败。

- 也可以直接在`mybatis-config.xml`配置指定的`typeHandler`类

```xml
<configuration>
	<typeHandlers>
		<typeHandler handler="com.xxx.typehandler.MyStringTypehandler"/>
	</typeHandlers>
</configuration>
```

>  注：无法在`application.properties`文件直接配置`typeHandler`类，因为虽然`org.mybatis.spring.SqlSessionFactoryBean`有`setTypeHandlers(TypeHandler<?>[] typeHandlers)`方法，但`org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration`并没有去`application.properties`读取相关的配置并设置调用该方法。

#### 限定`JavaType` 和 `JdbcType`
在官方文档中有这么一段话：
>使用上述的类型处理器将会覆盖已经存在的处理 Java 的 String 类型属性和 VARCHAR 参数及结果的类型处理器。 要注意 MyBatis 不会通过窥探数据库元信息来决定使用哪种类型，所以你必须在参数和结果映射中指明那是 VARCHAR 类型的字段， 以使其能够绑定到正确的类型处理器上。这是因为 MyBatis 直到语句被执行时才清楚数据类型。

>通过类型处理器的泛型，MyBatis 可以得知该类型处理器处理的 Java 类型，不过这种行为可以通过两种方法改变：
> 
- 在类型处理器的配置元素（typeHandler 元素）上增加一个 javaType 属性（比如：javaType="String"）；
- 在类型处理器的类上（TypeHandler class）增加一个 @MappedTypes 注解来指定与其关联的 Java 类型列表。 如果在 javaType 属性中也同时指定，则注解方式将被忽略。

可以通过两种方式来指定被关联的 JDBC 类型：
> 
- 在类型处理器的配置元素上增加一个 jdbcType 属性（比如：jdbcType="VARCHAR"）；
- 在类型处理器的类上增加一个 @MappedJdbcTypes 注解来指定与其关联的 JDBC 类型列表。 如果在 jdbcType 属性中也同时指定，则注解方式将被忽略。

当在 ResultMap 中决定使用哪种类型处理器时，此时 Java 类型是已知的（从结果类型中获得），但是 JDBC 类型是未知的。 因此 Mybatis 使用 javaType=[Java 类型], jdbcType=null 的组合来选择一个类型处理器。 这意味着使用 @MappedJdbcTypes 注解可以限制类型处理器的范围，同时除非显式的设置，否则类型处理器在 ResultMap 中将是无效的。 如果希望在 ResultMap 中使用类型处理器，那么设置 @MappedJdbcTypes 注解的 includeNullJdbcType=true 即可。 然而从 Mybatis 3.4.0 开始，如果只有一个注册的类型处理器来处理 Java 类型，那么它将是 ResultMap 使用 Java 类型时的默认值（即使没有 includeNullJdbcType=true）。

其中`javaType` 用来限定Java的类型，`jdbcType` 是用来限定JDBC的类型，类型列表见枚举类`org.apache.ibatis.type.JdbcType`。
在查询的时候，对于每个字段在进行转换处理时，会根据先根据字段对应的Java实体类的属性类型获取改类型的对应的`typeHandler` Map，再根据`jdbcType`获取该字段JDBC类型的对应的`typeHandler` 。默认如果`String`没有自定义`typeHandler`，那么它的`typeHandler` Map为：
```java
    register(String.class, new StringTypeHandler());  //对应的是JdbcType.NULL
    register(String.class, JdbcType.CHAR, new StringTypeHandler());
    register(String.class, JdbcType.CLOB, new ClobTypeHandler());
    register(String.class, JdbcType.VARCHAR, new StringTypeHandler());
    register(String.class, JdbcType.LONGVARCHAR, new ClobTypeHandler());
    register(String.class, JdbcType.NVARCHAR, new NStringTypeHandler());
    register(String.class, JdbcType.NCHAR, new NStringTypeHandler());
    register(String.class, JdbcType.NCLOB, new NClobTypeHandler());
```
如果只设置`javaType`，那么`jdbcType`为`JdbcType.NULL`
如果只设置了`jdbcType`，那么`javaType`为`typeHandler`指定的泛型类。
如果`javaType`和`jdbcType`都不设置，那么映射关系为`jdbcType`为`JdbcType.NULL`，`javaType`为`typeHandler`指定的泛型类。

可以通过多种方式设置`javaType`和`jdbcType`

- 通过`@MappedTypes` 和`@MappedJdbcTypes `
```java
@MappedTypes(String.class)
@MappedJdbcTypes(value = {CLOB,CLOB,VARCHAR,LONGVARCHAR,NVARCHAR,NCHAR,NCLOB},includeNullJdbcType = true)
public class MyStringTypeHandle extends BaseTypeHandler<String> {
```
> 注：`@MappedJdbcTypes `的`includeNullJdbcType`属性默认值为`false`,当设置为`true`时，在绑定完`jdbcType`之后，还会额外绑定一个`JdbcType.NULL`的映射。
> 

- 在`mybatis-config.xml`的`<typeHandlers>`的`<typeHandler>`节点的属性上设置

```xml
<configuration>
	<typeHandlers>
		<typeHandler javaType="String" jdbcType="VARCHAR"handler="com.xxx.typehandler.MyStringTypehandler"/>
	</typeHandlers>
</configuration>

```




