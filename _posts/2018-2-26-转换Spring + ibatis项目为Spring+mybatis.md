---
layout: post
title:  "转换Spring + ibatis项目为Spring+mybatis"
categories: ['java','spring','ibaits','mybatis','maven']
tags: ['java','spring','ibaits','mybatis','maven'] 
author: Feiyizhan
description: 转换Spring + ibatis项目为Spring+mybatis
issueId: 2018-2-26 Convert Spring+ibaits to Spring+mybatis
---
* TOC
{:toc}

# 转换Spring + ibatis项目为Spring+mybatis
源项目介绍：   
	JDK：1.6   
	Web Server: JBoss5.1   
	Spring：3.2.10   
	ibatis：2.3.4   
	maven：不支持   

转换后：   
	JDK：1.8   
	Web Server: WildFly 11   
	Spring：3.2.10   
	mybatis：3.3.1   
	maven：支持   

## 环境搭建
略

## 项目转换

### 创建空白的Maven Web项目
1. 创建空白的Maven项目   
![Alt text](/assets/images/java/1519462957419.png)
   
![Alt text](/assets/images/java/1519462981895.png)
   
![Alt text](/assets/images/java/1519463217495.png)
   

2. 修改项目为Web项目   
![Alt text](/assets/images/java/1519463892347.png)
   
![Alt text](/assets/images/java/1519463924361.png)
   
![Alt text](/assets/images/java/1519464153091.png)
   
3. 在构建路径上增加Web服务器Library   
![Alt text](/assets/images/java/1519614780677.png)
   


### 配置pom.xml文件
1. 引入Spring   
``` xml
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-aop</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-aspects</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>

		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-beans</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>

		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-context</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-context-support</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-core</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-expression</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-framework-bom</artifactId>
			<version>${version.spring.framework}</version>
			<type>pom</type>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-jms</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-orm</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-oxm</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-tx</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-test</artifactId>
			<version>${version.spring.framework}</version>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-web</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-webmvc</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-webmvc-portlet</artifactId>
			<version>${version.spring.framework}</version>
		</dependency>
```

2. 引入数据库驱动包
``` xml
		<!-- MSSQL JDBC -->
		<dependency>
			<groupId>com.microsoft.sqlserver</groupId>
			<artifactId>sqljdbc4</artifactId>
			<version>4.0</version>
			<scope>test</scope>

		</dependency>
```
3. 引入mybatis和mybatis-spring
``` xml
		<dependency>
			<groupId>org.mybatis</groupId>
			<artifactId>mybatis</artifactId>
			<version>3.3.1</version>
		</dependency>

		<dependency>
			<groupId>org.mybatis</groupId>
			<artifactId>mybatis-spring</artifactId>
			<version>1.1.1</version>
		</dependency>
```

4. 设置bulid参数
``` xml
	<build>
		<finalName>demo</finalName>
		<resources>
			<resource>
				<directory>src/main/java</directory>
				<includes>
					<include>**/*</include>
				</includes>
			</resource>
			<resource>
				<directory>src/main/resources</directory>
				<includes>
					<include>**/*</include>
				</includes>
			</resource>
		</resources>

		<plugins>
			<!-- Force Java 8 -->
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-compiler-plugin</artifactId>
				<version>3.1</version>

				<configuration>
					<source>1.8</source>
					<target>1.8</target>
          			<encoding>UTF-8</encoding>
					<excludes>
						<exclude>
							**/TestJobService.java
						</exclude>
					</excludes>
				</configuration>
			</plugin>
			<plugin>
				<artifactId>maven-war-plugin</artifactId>
				<version>2.4</version>
				<configuration>
					<warSourceDirectory>WebContent</warSourceDirectory>
				</configuration>
			</plugin>

		</plugins>
	</build>
```



### 拷贝源项目的代码到新项目
略

### 编写数据库操作转换适配器
由于ibatis和Mybatis使用了不同的SqlTemplate，同时源项目所有数据库操作的Service都是继承了一个BaseService类，SqlTemplate是注入到BaseService类成员中。因此只需要修改BaseService，并增加适配器，将mybatis的数据库操作方法封装为ibatis等同的方法。

1. 修改`import com.ibatis.sqlmap.client.SqlMapClient;`的引入为`import org.mybatis.spring.SqlSessionTemplate;`

2. 增加`IbatisSqlMapClient`适配器   

```java
    /**
     * Mybatis和Ibatis转换器，用于Mybatis兼容Ibatis代码
     * @author 
     *
     */
    class IbatisSqlMapClient {
        private SqlSessionTemplate sqlSessionTemplate;
        public IbatisSqlMapClient(SqlSessionTemplate sqlSessionTemplate) {
            this.sqlSessionTemplate=sqlSessionTemplate;
        }

        /**
         * @param statement
         * @return
         */
        public List queryForList(String statement) {
            return this.sqlSessionTemplate.selectList(statement);
        }
        
        /**
         * @param statement
         * @param parameter 
         * @return
         */
        public List queryForList(String statement,Object parameter) {
            return this.sqlSessionTemplate.selectList(statement,parameter);
        }
        /**
         * @param statement
         * @param parameter
         * @return
         */
        public <T> T queryForObject(String statement, Object parameter) {
            return this.sqlSessionTemplate.selectOne(statement, parameter);
        }
        
        /**
         * @param statement
         * @return
         */
        public <T> T queryForObject(String statement) {
            return this.sqlSessionTemplate.selectOne(statement);
        }
        
        /**
         * @param statement
         * @param parameter
         */
        public int insert(String statement, Object parameter) {
            return this.sqlSessionTemplate.insert(statement, parameter);
        }
        
        /**
         * @param statement
         */
        public int insert(String statement) {
            return this.sqlSessionTemplate.insert(statement);
        }
        
        
        /**
         * @param statement
         * @param parameter
         */
        public int update(String statement, Object parameter) {
            return this.sqlSessionTemplate.update(statement, parameter);
        }
        
        /**
         * @param statement
         * @return
         */
        public int update(String statement) {
            return this.sqlSessionTemplate.update(statement);
        }
        
        /**
         * 删除方法
         * @param statement
         */
        public int delete(String statement) {
           return this.sqlSessionTemplate.delete(statement);
        }
        
        /**
         * 删除方法
         * @param statement
         * @param parameter
         */
        public int delete(String statement, Object parameter) {
            return this.sqlSessionTemplate.delete(statement, parameter);
        }
        
    }
```

3. 修改成员变量、注入的方式和获取的方式
修改
``` java
	@Autowired
    private SqlMapClientTemplate sqlMapClientTemplate;
```
为
```java
	private IbatisSqlMapClient sqlMapClientTemplate; 
	                         
    @Autowired
    public void setSqlMapClientTemplate(SqlSessionTemplate sqlMapClientTemplate) {
        this.sqlMapClientTemplate = new IbatisSqlMapClient(sqlMapClientTemplate);
    }
	
	public IbatisSqlMapClient getSqlMapClientTemplate() {
        return sqlMapClientTemplate;
    }
```


### 相关配置修改
1. web.xml   
修改display-name   
``` xml
 <display-name>demo</display-name>
```
2. 删除ibatis Config文件，并增加mybatis Config文件   
/WEB-INF/mybatis/mybatis-config.xml 内容如下：   
``` xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE configuration PUBLIC "-//mybatis.org//DTD Config 3.0//EN" "http://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
	<!-- 全局参数 -->
	<settings>
		<!-- 打印查询语句 -->
		<!-- mybatis的日志打印方式比较多，SLF4J | LOG4J | LOG4J2 | JDK_LOGGING | COMMONS_LOGGING | STDOUT_LOGGING | NO_LOGGING， -->
		<!-- 可以根据自己的需要进行配置 -->
        <setting name="logImpl" value="STDOUT_LOGGING" />
		<!-- 使全局的映射器启用或禁用缓存。 -->
		<setting name="cacheEnabled" value="true" />
		<!-- 全局启用或禁用延迟加载。当禁用时，所有关联对象都会即时加载。 -->
		<setting name="lazyLoadingEnabled" value="true" />
		<!-- 当启用时，有延迟加载属性的对象在被调用时将会完全加载任意属性。否则，每种属性将会按需要加载。 -->
		<setting name="aggressiveLazyLoading" value="true" />
		<!-- 是否允许单条sql 返回多个数据集 (取决于驱动的兼容性) default:true -->
		<setting name="multipleResultSetsEnabled" value="true" />
		<!-- 是否可以使用列的别名 (取决于驱动的兼容性) default:true -->
		<setting name="useColumnLabel" value="true" />
		<!-- 允许JDBC 生成主键。需要驱动器支持。如果设为了true，这个设置将强制使用被生成的主键，有一些驱动器不兼容不过仍然可以执行。 default:false -->
		<setting name="useGeneratedKeys" value="false" />
		<!-- 指定 MyBatis 如何自动映射 数据基表的列 NONE：不隐射 PARTIAL:部分 FULL:全部 -->
		<setting name="autoMappingBehavior" value="PARTIAL" />
		<!-- 这是默认的执行类型 （SIMPLE: 简单； REUSE: 执行器可能重复使用prepared statements语句；BATCH: 执行器可以重复执行语句和批量更新） -->
		<setting name="defaultExecutorType" value="SIMPLE" />
		<!-- 使用驼峰命名法转换字段。 -->
		<setting name="mapUnderscoreToCamelCase" value="true" />
		<!-- 设置本地缓存范围 session:就会有数据的共享 statement:语句范围 (这样就不会有数据的共享 ) defalut:session -->
		<setting name="localCacheScope" value="SESSION" />
		<!-- 设置但JDBC类型为空时,某些驱动程序 要指定值,default:OTHER，插入空值时不需要指定类型 -->
		<setting name="jdbcTypeForNull" value="NULL" />
		
	</settings>
	<!-- 类型别名 -->
	<typeAliases>
		<!-- 自动扫描package指定的包下的所有类，别名为首字母小写的类名 -->
		<package name="com.xxx.yyy.valueobject"/>
		<package name="com.xxx.yyy.bean"/>
	</typeAliases>

</configuration>

```


3. spring/applicationContext.xml   
修改数据源和数据库操作相关配置   
源：   
``` xml
	 <!-- 定义Ibatis SqlMapClientFactoryBean 并Load Sql Map 配置文件 -->
	<bean id="sqlMapClient" class="org.springframework.orm.ibatis.SqlMapClientFactoryBean">
		<property name="dataSource" ref="dataSource" />
		<property name="configLocations">
		  <list>
		      <value>classpath:ibatis/sqlMapConfig.xml</value>
		      <value>classpath:ibatis/viewSqlMapConfig.xml</value>
		  </list>
		 </property>
	</bean>

	<!-- 封装为SqlMapClientTemplate -->
	<bean id="sqlMapClientTemplate"  
         class="org.springframework.orm.ibatis.SqlMapClientTemplate">  
        <property name="sqlMapClient" ref="sqlMapClient"></property>  
    </bean> 
```
   
修改为：   
``` xml
	  <!-- spring和MyBatis完美整合，不需要mybatis的配置映射文件 -->
	<bean id="sqlMapClient" class="org.mybatis.spring.SqlSessionFactoryBean">
		<property name="dataSource" ref="dataSource" />
		<!-- 数据库操作映射配置 -->
		<property name="mapperLocations">
        	<list>
				<!-- 具体的每个sqlmap文件-->
            </list>
        </property> 
       	<!--  Mybatis的配置 -->
		<property name="configLocation" value="/WEB-INF/mybatis/mybatis-config.xml"/> 	
	</bean>

	<!-- 封装为SqlMapClientTemplate -->
	<bean id="sqlMapClientTemplate"  
         class="org.mybatis.spring.SqlSessionTemplate">  
         <constructor-arg index="0" ref="sqlMapClient"></constructor-arg>
    </bean> 
```

### ibatis SQLMAP 转换 mybatis SQLMAP
使用[ibatis2mybatis](https://github.com/Feiyizhan/ibatis2mybatis)工具转换。


