---
layout: post
title:  "ElasticSearch 的使用-整体方向和调研笔记"
categories: ['ElasticSearch']
tags: ['ElasticSearch'] 
author: Feiyizhan
description: ElasticSearch 的使用-整体方向和调研笔记
issueId: 2019-7-26 ElasticSearch 的使用-整体方向和调研笔记
---
* TOC
{:toc}


# ElasticSearch 的使用-整体方向和调研笔记


## 介绍

[官网](www.elastic.co)

中文手册:https://elasticsearch.cn
**ElasticSearch**  搜索引擎及索引建立引擎
**kibana**  可视化管理工具


## ElasticSearch  

### 安装
下载：[5.5.3版本](https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-5.5.3.zip)
解压即可。

### 启动
执行`bin/elasticsearch` 即可。如果想后端运行，那么执行`bin/elasticserach -d`。


### 

### 创建索引

让我们在集群中唯一一个空节点上创建一个叫做blogs的索引。默认情况下，一个索引被分配5个主分片，但是为了演示的目的，我们只分配3个主分片和一个复制分片（每个主分片都有一个复制分片）：
```
PUT /blogs
{
   "settings" : {
      "number_of_shards" : 3,
      "number_of_replicas" : 1
   }
}
```




### 插件管理

- 中文分词插件 IK analyzer
   [插件官网](https://github.com/medcl/elasticsearch-analysis-ik)
   安装步骤：
   `./bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v6.3.0/elasticsearch-analysis-ik-6.3.0.zip`
   参考：[Elasticsearch5.x安装IK分词器以及使用](https://blog.csdn.net/wwd0501/article/details/78258274)

- 拼音分词器插件 
	[插件官网](https://github.com/medcl/elasticsearch-analysis-pinyin/releases?after=v6.1.1)
	安装步骤：
	`./bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-pinyin/releases/download/v5.5.3/elasticsearch-analysis-pinyin-5.5.3.zip`

测试：
5.X版本：
```
POST http://localhost:9200/_analyze?analyzer=pinyin&pretty=true
BOYD {"text":"这里是好记性不如烂笔头感叹号的博客们"}
```
6.x版本：6.0版本移除了_analyze的analyzer参数支持，analyzer测试需要在Body中关键字指定
参考：[6.3 Testing analyzers](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/_testing_analyzers.html)
```
POST http://localhost:9200/_analyze
BOYD 
{
  "analyzer": "pinyin",
  "text":     "这里是好记性不如烂笔头感叹号的博客们"
}
```


测试结果：
```json
{
    "tokens": [
        {
            "token": "zhe",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 0
        },
        {
            "token": "zlshjxbrlbtgthdb",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 0
        },
        {
            "token": "li",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 1
        },
        {
            "token": "shi",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 2
        },
        {
            "token": "hao",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 3
        },
        {
            "token": "ji",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 4
        },
        {
            "token": "xing",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 5
        },
        {
            "token": "bu",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 6
        },
        {
            "token": "ru",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 7
        },
        {
            "token": "lan",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 8
        },
        {
            "token": "bi",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 9
        },
        {
            "token": "tou",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 10
        },
        {
            "token": "gan",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 11
        },
        {
            "token": "tan",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 12
        },
        {
            "token": "hao",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 13
        },
        {
            "token": "de",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 14
        },
        {
            "token": "bo",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 15
        },
        {
            "token": "ke",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 16
        },
        {
            "token": "men",
            "start_offset": 0,
            "end_offset": 0,
            "type": "word",
            "position": 17
        }
    ]
}
```

### 使用

#### 索引
##### 创建索引
- 创建默认配置的索引
```
#请求
PUT twitter
#响应
{
    "acknowledged": true,
    "shards_acknowledged": true,
    "index": "test-base"
}
#默认配置的索引的配置如下
{
  "twitter": {
    "aliases": {},
    "mappings": {},
    "settings": {
      "index": {
        "creation_date": "1539050228177",
        "number_of_shards": "5",
        "number_of_replicas": "1",
        "uuid": "x-yRLPprS_mMqe_yXcoibQ",
        "version": {
          "created": "6030299"
        },
        "provided_name": "twitter"
      }
    }
  }
}
```




- 使用指定配置创建索引
```
#请求
PUT twitter
{
    "settings" : {
        "index" : {
            "number_of_shards" : 3, 
            "number_of_replicas" : 2 
        }
    }
}
#响应
{
  "acknowledged": true,
  "shards_acknowledged": true,
  "index": "twitter"
}
```

- 配置可以使用简单配置方式
```
#请求
PUT twitter
{
    "settings" : {
        "number_of_shards" : 3,
        "number_of_replicas" : 2
    }
}
```

- Mappings（映射）
Mapping为限定在索引中存储的数据的结构，只有符合Mapping的数据才能存储到Index中，在创建索引时也可可以指定索引的映射。
```
#请求
PUT test
{
    "settings" : {
        "number_of_shards" : 1
    },
    "mappings" : {
        "type1" : {
            "properties" : {
                "field1" : { "type" : "text" }
            }
        }
    }
}
#结果
{
  "test": {
    "aliases": {},
    "mappings": {
      "type1": {
        "properties": {
          "field1": {
            "type": "text"
          }
        }
      }
    },
    "settings": {
      "index": {
        "creation_date": "1539051572751",
        "number_of_shards": "1",
        "number_of_replicas": "1",
        "uuid": "ioXgmR5ISiy76HLrZCjc0w",
        "version": {
          "created": "6030299"
        },
        "provided_name": "test"
      }
    }
  }
}
```



##### 查询索引
```
#请求
GET twitter
#响应
{
  "twitter": {
    "aliases": {},
    "mappings": {},
    "settings": {
      "index": {
        "creation_date": "1539050228177",
        "number_of_shards": "5",
        "number_of_replicas": "1",
        "uuid": "x-yRLPprS_mMqe_yXcoibQ",
        "version": {
          "created": "6030299"
        },
        "provided_name": "twitter"
      }
    }
  }
}
```

##### 删除索引
```
#请求
DELETE twitter
#响应
{
  "acknowledged": true
}
```

##### 检测索引是否存在
```
#请求
HEAD twitter
#响应
##存在
200 - OK
##不存在
404 - Not Found

```

#####  关闭/打开索引
- 打开索引
```
#请求
POST /my_index/_open
#响应
{
  "acknowledged": true,
  "shards_acknowledged": true
}
```
- 关闭索引
```
#请求
POST /my_index/_close
#响应
{
  "acknowledged": true
}
```

> 对于已经关闭的索引在集群上基本没有开销（除了维护元数据），已经关闭的索引不允许进行读写操作。

可以打开或关闭多个索引，如果有索引不存在，则会报错，可以通过使用`ignore_unavailable=true`参数忽略索引不存在的异常。
```
#请求
POST /my_index2,my_index/_close?ignore_unavailable=true
```

##### 修改索引
- 设置索引为只读
```
PUT /my_source_index/_settings
{
  "settings": {
    "index.blocks.write": true 
  }
}
# 之后的写请求的返回
{
  "error": {
    "root_cause": [
      {
        "type": "cluster_block_exception",
        "reason": "blocked by: [FORBIDDEN/8/index write (api)];"
      }
    ],
    "type": "cluster_block_exception",
    "reason": "blocked by: [FORBIDDEN/8/index write (api)];"
  },
  "status": 403
}
```
- 取消索引为只读
```
PUT /test/_settings
{
  "settings": {
    "index.blocks.write": false 
  }
}
```

- 收缩索引
   参考：[Shrink Index](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-shrink-index.html)

- 拆分索引
	参考： [Split Index](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-split-index.html)

- 索引自动归档
	将别名指定的索引按照序号或日期格式，在满足指定条件时，自动创建新的索引，并将别名关联到新的索引。类似于日志文件自动归档。参考[Rollover Index](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-rollover-index.html)


##### 设置索引的Mappings
只允许新增字段到索引Mappings或者修改已有的字段的搜索设置。

> 对于Object类型的字段，可以添加新的子字段。

参考：
[PUT Mappings](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-put-mapping.html)
[properties](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/properties.html)
[Mapping parameters](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping-params.html)
[Field datatypes](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping-types.html)
	
##### 索引的配置信息
参考：[index-modules](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/index-modules.html)
索引的配置分为两部分，一部分为静态的，一部分为动态的。
- 静态的（static）
	在创建时指定，之后就不能修改。
- 动态的（dynamic）
	可以通过更新索引配置API修改。

> 注：更改已关闭索引上的静态或动态索引设置可能会导致不正确的设置，如果不删除并重新创建索引，则无法纠正这些设置。

- 静态索引配置：
	- index.number_of_shards
	- index.shard.check_on_startup
	- index.codec
	- index.routing_partition_size

- 动态索引配置：
	- index.number_of_replicas
	- index.auto_expand_replicas
	- index.refresh_interval
	- index.max_result_window
	- index.max_inner_result_window
	- index.max_rescore_window
	- index.max_docvalue_fields_search
	- index.max_script_fields
	- index.max_ngram_diff
	- index.max_shingle_diff
	- index.blocks.read_only
	- index.blocks.read_only_allow_delete
	- index.blocks.read
	- index.blocks.write
	- index.blocks.metadata
	- index.max_refresh_listeners
	- index.highlight.max_analyzed_offset
	- index.max_terms_count
	- index.routing.allocation.enable
	- index.routing.rebalance.enable
	- index.gc_deletes






## Kibana

### 下载

[Kibana官网下载地址](https://www.elastic.co/downloads/kibana)
[5.5.3版本](https://artifacts.elastic.co/downloads/kibana/kibana-5.5.3-windows-x86.zip)

### 启动

执行安装目录下的`bin/kibana`命令即可。

> 注意：必须在ElasticSearch  启动之后才能正常访问Kibana，否则提示无法登录。

访问：[http://localhost:5601](http://localhost:5601)

### 汉化
 
 - 先下载Python2.7 [官网下载地址](https://www.python.org/downloads/)
 - 从Github下载汉化项目[Kibana_Hanization](https://github.com/anbai-inc/Kibana_Hanization)
 - 在Kibana_Hanization项目的根目录执行命令`python main.py Kibana目录`
 - 重新打开Kibana
 

## 实际运用的思考




### ElasticSearch 架构

#### 调研问题列表
- [x] Mysql 数据迁移到ES 的方案？
	- 编写程序手动执行，详情见笔记：[ElasticSearch 的使用-数据导入](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%85%A5.html)

- [x] ES 索引配置多环境同步的处理方案。
	- [x] 手动在Kibana上执行命令。
		- [x] 新增索引
			- 直接使用新增索引API
		- [x] 删除索引
			- 直接使用删除索引API
		- [x] 修改索引
			- [x] 新增字段
				- 使用更新字段Mapping API。 参考[updating-field-mappings](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-put-mapping.html#updating-field-mappings)
			- [x] 修改字段
				- [x] 修改字段数据类型
					-  使用新增索引API建立新的索引
					- 使用修改索引配置API，暂停索引写入操作。
					- 使用Reindex API 将旧数据拷贝到新数据。参考[ReIndex API](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/docs-reindex.html)
					- 使用修改索引别名关系API，更改原索引的别名指向新的索引。 
			 - [x] 修改字段Mapping参数
				- 除了修改搜索参数，其他修改都必须重建索引。

			- [x] 删除字段
				- 必须重建索引。

- [x] 关键字补全的方案
	- 使用`Suggestion` 实现，参考[search-suggesters-completion](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-suggesters-completion.html)，详情见笔记：[ElasticSearch 的使用-关键字补全](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E5%85%B3%E9%94%AE%E5%AD%97%E8%A1%A5%E5%85%A8.html)

- [x] 查询语法
	- [x] 查询单个doc记录
		- 使用指定id值的方式查询
	- [x] 关联查询
		- 不推荐使用关联查询
	- [x] 分页查询
		- 使用from+size查询参数,详情见笔记：[ElasticSearch 的使用-查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%9F%A5%E8%AF%A2.html)
	- [x] 统计查询
		- 暂不使用
	- [x] 高亮查询
		- 使用`Highlighter` 实现，参考[search-request-highlighting](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-highlighting.html)，详情见笔记：[ElasticSearch 的使用-高亮查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E9%AB%98%E4%BA%AE%E6%9F%A5%E8%AF%A2.html)。
- [x] 修改索引数据
	- [x] 修改字段值
		- [x] 非嵌套字段
			- 支持部分字段值的修改。参考[Update API](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/docs-update.html)
		- [x] 嵌套字段
			- 只能整个字段值全部替换，不能做部分修改。
	> 目前采用修改前先读取doc的全部数据，再在程序里更新为最终的数据，最后通过新增/替换命令更新整个doc。		
- [x] 删除索引数据
	- 直接通过id删除即可。参考[DELETE API](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/docs-delete.html)。

- [x] 字段数据类型选择的方案 
	- [x] 数据类型的选择
		- 整数类型  -> `long`
		- 小数类型 - >`scaled_float` 并设置`scaling_factor` 值为`100` 即保留2位小数。
		- 文本类型 -> 需要分词使用`text`，不分词使用`keyword`
		- 一对多的关系 -> `nested`
		- 日期类型 -> `date`
		- 一对一的关系 ->`object`
	- [x] 数据类型参数如何选择
		- [x] 解析器
			- `字段本身` 使用标准解析器分词
			- `字段.raw` 不分词
			- `字段.chinese` 索引使用中文最大分词，查询使用中文智能分词
		- [x] 多字段
			- 所有的需要被查询的文本字段都必须设置为多字段，并且都要有`raw`和`chinese`子字段。
- [x] 数据类型转换问题
	- 禁止数字型接收字符型数字，必须严格要求字段对应的类型。
	- 日期格式支持`"yyyy/MM/dd HH:mm:ss.SSSSSS||yyyy/MM/dd||yyyy/MM/dd HH:mm:ss||yyyy/MM/dd HH:mm:ss.SSS||epoch_millis"` 格式。

- [x] 创建索引时的参数问题
	- [x] settings  
		- 见下面的**推荐的Index配置**
	- [x] mappings
		- 见下面的**推荐的mappings配置**
	- [x] aliases
		- 所有的索引操作都必须强制使用别名访问。

### 总结
- 所有的索引都必须使用别名访问。
- keyword 字段长度通过ignore_above参数控制，超过这个参数值的字符将不会被索引。
- ReIndex 操作源Index和目标Index的字段类型不是所有类型直接都可以互转。
- 尽量将ElasticSearch作为一个只读数据，用于解决多关键分词模糊匹配的分页查询效率问题，而不是把他作为一个主数据库使用。
- ElasticSearch 集群如果只有两个节点，在某个节点崩溃时，会导致数据丢失。


### ElasticSearch Server端


#### 调研问题列表

- [x] ES Server是自己搭建还是购买阿里云ES服务器
	- ES不自己搭建，使用阿里云提供的ES服务器，参考[阿里云ElasticSearch介绍](https://help.aliyun.com/document_detail/57770.html?spm=a2c4g.11186623.6.542.2992189cTKXVzz)
- [x] 阿里云ES服务器如何选择？
	- 开发使用1核2G，2节点，50G云盘
	- 其他使用2核4G，3节点，50G本地SSD
- [x] 阿里云ES服务器版本？
	-	阿里云ES版本为6.3.1
- [x] 阿里云ES服务器要怎么管理，包括账号密码、VPC、权限、ES Server本身的配置等
	- 除了开发的ES服务器开启外网访问，其他只允许内网访问。同时Kibana开启IP白名单访问。

### ElasticSearch Client 端

- 客户端最好有程序使用的客户端和手动操作的客户端，其中程序使用的客户端用于在后端应用中使用，手动操作的客户端用于对ES数据进行手动干预，比如索引建立，配置更改，等等手动操作。
	- Java版本客户端，按照官方建议最好使用REST版本，而不是Transport版本。参考[客户端访问](https://help.aliyun.com/document_detail/69194.html?spm=a2c4g.11186623.6.552.61db483eXu74nV)，[jest](https://github.com/searchbox-io/Jest)

	- 手动操作使用`Kibana`。


#### 调研问题列表

- [x] Index能否关联查询
	- [x] 参考[Elasticsearch6.X 新类型Join深入详解](https://blog.csdn.net/laoyang360/article/details/79774481)



## 问题记录

- 聚合查询报错，错误内容如下：
```
Fielddata is disabled on text fields by default. Set fielddata=true on [interests] in order to load
```

>问题原因，是indeed的mapping字段没有设置`fielddata=true`。处理方法如下：
>执行以下请求：
```
		PUT megacorp/_mapping/employee
		{
		   "employee": {
		      "properties": {
		        "interests": {
		          "type": "text",
		          "fielddata": true
		        }
		      }
		   }
		}
```
>参考[how to set fielddata=true in kibana](https://stackoverflow.com/questions/38145991/how-to-set-fielddata-true-in-kibana)		

- 在Linux上不允许以root用户启动

- Linux启动失败的一些问题
	- [centos7下elasticSearch安装配置](http://www.cnblogs.com/xxoome/p/6663993.html)

- 6.x版本移除了type（映射类型）
	- 对应6.x版本，每个Index只允许有一个类型，即只允许单一类型，类型名称可以自定义，但只能有一个。推荐的类型名称是`_doc`，参考[删除映射类型](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/removal-of-types.html)

- 良好的ES性能的关键是将数据去规范化为文档。JOIN字段会带来额外的性能开销。参考[parent_join_and_performance](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/parent-join.html#_parent_join_and_performance)

- Mapping创建好之后不能修改，但可以通过别名方式变相修改。即创建设置Index和Index的别名。操作的时候使用Index的别名，需要修改的时候，建一个新的Index，然后修改别名关联新的Index即可。参考[elasticsearch 修改 mapping](https://blog.csdn.net/lengfeng92/article/details/38230521)

## 其他相关笔记

- [ElasticSearch 的使用-查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-高亮查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E9%AB%98%E4%BA%AE%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-数据导入](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%85%A5.html)

- [ElasticSearch 的使用-关键字补全](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E5%85%B3%E9%94%AE%E5%AD%97%E8%A1%A5%E5%85%A8.html)
