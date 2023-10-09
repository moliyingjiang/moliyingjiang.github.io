---
layout: post
title:  "ElasticSearch Index Mappings"
categories: ['ElasticSearch']
tags: ['ElasticSearch'] 
author: Feiyizhan
description: ElasticSearch Index Mappings
issueId: 2019-7-26 ElasticSearch Index Mappings
---
* TOC
{:toc}

# Index Mappings

参考:[mapping](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping.html)

Mapping的具体类型：

- Meta-fields （元字段）
- Fields or properties （字段或属性）

> `_default_` mapping 在6.0版本移除。


## Meta-fields  元字段
元字段用于自定义文档的元数据关联的处理方式。例如文档中的元字段有` _index`，`_type`，` _id`，和`_source`领域。

## Fields or properties 字段或属性

### 字段数据类型

## 动态Mapping
在使用之前不需要定义字段和映射类型。由于动态映射，只需索引文档即可自动添加新的字段名称。新字段既可以添加到顶级映射类型，也可以添加到内部`object `和`nested`字段。

通过配置[动态映射](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-mapping.html)，可以定制用于新字段的映射处理。

- [动态字段映射](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html)
管理动态字段检测的规则。
- [动态模板](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-templates.html)
自定义规则，用于配置动态添加字段的映射。
- [索引模版](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-templates.html)
允许您配置新索引的默认映射，设置和别名，无论是自动创建还是显式创建。


### 动态字段映射
默认情况下，当在文档中找到以前未见过的字段时，Elasticsearch会将新字段添加到类型映射中。`object `通过将`dynamic`参数设置为`false`（忽略新字段）或`strict`（如果遇到未知字段，则抛出异常），可以在文档和级别禁用此行为。

假设`dynamic`启用了字段映射，则使用一些简单的规则来确定字段应具有的数据类型：

| JSON数据类型     |   Elasticsearch数据类型 | 
| :--------: | :--------:| 
| null | 没有添加任何字段。|  
| true 或 false | boolean |  
|浮点数| float|
|整数| long|
|object | object|
|数组|类型取决于数组中第一个非null的值的类型|
|字符串|如果通过了日期检测，那么设置为`date`类型，如果通过了数字检测，那么设置为数字类型，否则设置为`text`类型，并增加`keyword`子字段，类型为`keyword`，且`ignore_above`值设置为256|


#### 日期检测
如果`date_detection`启用（默认），则检查新字符串字段以查看其内容是否与指定的任何日期模式匹配 `dynamic_date_formats`。如果找到匹配项，date则添加具有相应格式的新字段。
默认值为`dynamic_date_formats`：
`[ "strict_date_optional_time"，"yyyy/MM/dd HH:mm:ss Z||yyyy/MM/dd Z"]`

##### 禁用日期检测
可以通过设置`date_detection`为false：禁用动态日期检测：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "date_detection": false
    }
  }
}

```

##### 自定义日期检测格式
`dynamic_date_formats`可以自定义以支持您自己的日期格式：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "date_detection": true,
      "dynamic_date_formats": ["yyyy-MM-dd","yyyy/MM/dd","yyyy-MM-dd HH:mm:ss","yyyy/MM/dd HH:mm:ss"]
    }
  }
} 
```


#### 数字检测
虽然JSON支持本地浮点和整数数据类型，但某些应用程序或语言有时可能将数字呈现为字符串。通常正确的解决方案是显式映射这些字段，但可以启用数字检测（默认情况下禁用）以自动执行此操作，设置参数`numeric_detection` 为`true`
默认该参数值为`false`
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "numeric_detection": true
    }
  }
}
```

### 动态模版
动态模板允许您定义可应用于动态添加字段的自定义映射，具体取决于：

- Elasticsearch检测到 的数据类型match_mapping_type。
- 字段的名称，带match和unmatch或match_pattern。
- 字段的完整点路径，带path_match和path_unmatch。
- 原始字段名称{name}和检测到的数据类型 {dynamic_type} 模板变量可以在映射规范中用作占位符。

> 仅当字段包含具体值时才会添加动态字段映射 - 不包含`null`或空数组。这意味着如果`null`值在一个使用该选项`dynamic_template`的索引中，则仅在具有该字段的具体值的第一个文档已被索引之后才应用该动态模版选项。

#### match_mapping_type
先对数据类型按照动态映射检测规则检测，如果Elasticsearch认为该字段应具备的数据类型，那么将按照`match_mapping_type`的规则进行处理。只有以下数据类型可自动检测：`boolean`，`date`，`double`，`long`，`object`， `string`。它还接受*匹配所有数据类型。

例如，如果我们想映射所有整数字段为`integer`，而不是` long`。和所有string字段类型`text`和子字段名为`raw`而不是`keyword`，我们可以使用下面的模板：

```
PUT my_index
{
  "mappings": {
    "_doc": {
      "dynamic_templates": [
        {
          "integers": {
            "match_mapping_type": "long",
            "mapping": {
              "type": "integer"
            }
          }
        },
        {
          "strings": {
            "match_mapping_type": "string",
            "mapping": {
              "type": "text",
              "fields": {
                "raw": {
                  "type":  "keyword",
                  "ignore_above": 256
                }
              }
            }
          }
        }
      ]
    }
  }
}

PUT my_index/_doc/1
{
  "my_integer": 5, 
  "my_string": "Some string" 
}
```


#### match 和 unmatch
`match` 匹配字段名称
` unmatch` 不匹配字段名称

以下示例匹配string类型，且名称以`long_`开头,以不是`_text`结尾的所有字段， 并将它们映射为`long` 字段：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "dynamic_templates": [
        {
          "longs_as_strings": {
            "match_mapping_type": "string",
            "match":   "long_*",
            "unmatch": "*_text",
            "mapping": {
              "type": "long"
            }
          }
        }
      ]
    }
  }
}

PUT my_index/_doc/1
{
  "long_num": "5", 
  "long_text": "foo" 
}
```

#### match_pattern
`match_pattern`参数调整`match`参数的行为，使其支持字段名称上的完整Java正则表达式匹配，而不是简单的通配符，例如：
```
"match_pattern": "regex",
"match": "^profit_\d+$"
```

#### path_match 和 path_unmatch
在`path_match`与`path_unmatch`参数的工作方式类似于`match` 和`unmatch`，但匹配完整的字段点路径，而不仅仅是最终的名称，例如上操作`some_object.*.some_field`。

此示例将`name`对象中任何字段的值复制到顶级`full_name`字段，但字段除外`middle`：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "dynamic_templates": [
        {
          "full_name": {
            "path_match":   "name.*",
            "path_unmatch": "*.middle",
            "mapping": {
              "type":       "text",
              "copy_to":    "full_name"
            }
          }
        }
      ]
    }
  }
}

PUT my_index/_doc/1
{
  "name": {
    "first":  "Alice",
    "middle": "Mary",
    "last":   "White"
  }
}

GET my_index/_search
{
  "query": {
    "match": {
      "full_name": { 
        "query": "Alice White",
        "operator": "and"
      }
    }
  }
}
```


#### {name} 和 {dynamic_type}
`{name}`和`{dynamic_type}`占位符用于替换在`mapping` 与字段名称和检测到的动态类型匹配的字段。
以下示例将所有字符串字段的`analyzer`设置为使用与该字段名同名的字符串，并禁用所有非字符串字段的`doc_values`：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "dynamic_templates": [
        {
          "named_analyzers": {
            "match_mapping_type": "string",
            "match": "*",
            "mapping": {
              "type": "text",
              "analyzer": "{name}"
            }
          }
        },
        {
          "no_doc_values": {
            "match_mapping_type":"*",
            "mapping": {
              "type": "{dynamic_type}",
              "doc_values": false
            }
          }
        }
      ]
    }
  }
}

PUT my_index/_doc/1
{
  "english": "Some English text", 
  "count":   5 
}

```



## 显式Mapping
显式Mapping是指在创建索引时，明确指定该索引的Mapping属性。其中关于搜索部分的属性，可以在通过修改索引Mapping API进行修改，但核心的数据类型不能修改，字段不支持删除，但支持新增，对于`object`和`nested`字段支持添加子字段。

### 字段数据类型

支持多字段，即一个字段可以定义多个子字段，用于满足不同场景的使用，详情参考[fields](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/multi-fields.html)


#### 字符型

##### text
参考：[text](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/text.html)
用于索引全文值的字段，例如电子邮件正文或产品说明。这些字段需要通过解析器做解析，以在被索引之前将字符串转换为单个术语的列表。分析过程允许Elasticsearch搜索单个单词中每个完整的文本字段。文本字段不用于排序，很少用于聚合（尽管 [重要的文本聚合](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/search-aggregations-bucket-significanttext-aggregation.html) 是一个值得注意的例外）。

如果您需要索引结构化内容（如电子邮件地址，主机名，状态代码或标记），则可能应该使用keyword字段。

文本字段支持如下参数

-  analyzer 分析器
指定`text`字段使用哪些分析器做分析，默认值为默认分析器或者[standard分析器](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-standard-analyzer.html)
- boost
提升term查询时，该字段的评分的权重，默认为1.0。官方不推荐使用。
- eager_global_ordinals 预构建序号
是否启用预加载全局序号，接受true或false （默认），对于经常用于（重要）术语聚合的字段，建议启用此功能。
- fielddata
该字段是否可以使用内存中的fielddata进行排序，聚合或脚本编写？接受true或false（默认）。
- fielddata_frequency_filter
专家设置，允许在fielddata 启用时决定在内存中加载哪些值。默认情况下，将加载所有值。
- fields
多字段允许以多种方式为不同目的索引相同的字符串值，例如用于搜索的一个字段和用于排序和聚合的多字段，或者由不同分析器分析的相同字符串值。
- index
该index选项控制是否索引字段值。它接受true 或false默认为true。未编制索引的字段不可查询。
- index_options
应该在索引中存储哪些信息，以用于搜索和突出显示。默认为positions。
- index_prefixes
如果启用，则将2到5个字符之间的术语前缀索引到单独的字段中。这允许前缀搜索更有效地运行，但代价是更大的索引。接受一个 index-prefix configuration block
- norms
在对查询进行评分时是否应考虑字段长度。接受true（默认）或false。
- position_increment_gap
在短语搜索的时候，在连续多少个
- store
字段值是否应该与_source字段分开存储和检索。接受true或false （默认）。
- search_analyzer
在搜索时应该使用的分析器。默认为`analyzer`设置。
- search_quote_analyzer
搜索时遇到一个短语时使用的分析器。默认为search_analyzer设置。
- similarity
应使用 哪种评分算法或相似度算法。默认为BM25。
- term_vector
是否应为analyzed 字段存储术语向量。默认为no。


##### keyword
参考：[keyword](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/keyword.html)
用于索引结构化内容的字段，例如电子邮件地址，主机名，状态代码，邮政编码或标签。
它们通常用于过滤（找到我的所有博客文章，其中 status为published），排序，和聚合。关键字字段只能按其确切值进行搜索。
如果您需要索引电子邮件正文或产品说明等全文内容，则可能应该使用text字段。

`keyword`字段接受以下参数：
- boost
- doc_values
- eager_global_ordinals
- fields
- ignore_above
不要索引长于此值的任何字符串。默认为2147483647 以便接受所有值。但请注意，默认动态映射规则会创建一个子keyword字段，通过设置覆盖此默认值ignore_above: 256。
- index
- index_options
- norms
- null_value
接受替换任何显式null 值的字符串值。默认为null，表示该字段被视为缺失。
- store
- similarity
- normalizer
 在编制索引之前如何预处理关键字。默认为null，表示关键字保持原样。

#### 数字型

-  long	
带符号的64位整数，其最小值为，最大值为。 -263263-1
-  integer
带符号的32位整数，其最小值为，最大值为。 -231231-1
- short
带符号的16位整数，其最小值为-32,768，最大值为32,767。
- byte
带符号的8位整数，其最小值为-128，最大值为127。
- double
双精度64位IEEE 754浮点数，限制为有限值。
- float
单精度32位IEEE 754浮点数，限制为有限值。
- half_float
半精度16位IEEE 754浮点数，限制为有限值。
- scald_float
支持的有限浮点数long，由固定double比例因子缩放。
定义一个有两位小数的浮点数，但数据本身存储为long。类似于Java中 BigDecimal。
```
"price": {
          "type": "scaled_float",
          "scaling_factor": 100
        }
```

数字类型接受以下参数：
- coerce
是否支持字符型数字数据，默认true。
- boost
- doc_values
该字段是否应以列步长方式存储在磁盘上，以便以后可用于排序，聚合或脚本编写？接受true （默认）或false。
- ignore_malformed
如果true，错误的数字被忽略。如果false（默认），格式错误的数字会抛出异常并拒绝整个文档。
- index
- null_value
- store


#### date日期类型

支持的参数：
- boost
- doc_values
- format 
可以解析的日期格式。默认为 strict_date_optional_time||epoch_millis。支持"yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"方式设置日期格式。
- locale
解析自几个月以来的日期时使用的语言环境在所有语言中都没有相同的名称和/或缩写。默认是 ROOT语言环境，
- ignore_malformed
如果true，错误的日期被忽略。如果false（默认），格式错误的日期会抛出异常并拒绝整个文档。
- index
- null_value
- store

####  boolean布尔类型
值支持`true` or `"true"`, `false` Or `"false"`

支持的参数：
 - boost
 - doc_values
 - index
 - null_value
 - store

#### binary 二进制类型
接受二进制值以 Base64编码的字符串。默认情况下不存储该字段，并且不可搜索。

支持的参数：
- doc_values
- store

#### 区间类型
参考：[range](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/range.html)
-  integer_range
带符号的32位整数，最小值为和最大值。 -231231-1
-  float_range
单精度32位IEEE 754浮点值。
-  long_range
带符号的64位整数，最小值为和最大值。 -263263-1
-  double_range
双精度64位IEEE 754浮点值。
-  date_range
日期值，表示为自系统纪元以来经过的无符号64位整数毫秒。
- ip_range
支持IPv4或 IPv6（或混合）地址的一系列ip值。

值设置方法:
```
PUT range_index
{
  "settings": {
    "number_of_shards": 2
  },
  "mappings": {
    "_doc": {
      "properties": {
        "expected_attendees": {
          "type": "integer_range"
        },
        "time_frame": {
          "type": "date_range", 
          "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"
        }
      }
    }
  }
}

PUT range_index/_doc/1?refresh
{
  "expected_attendees" : { 
    "gte" : 10,
    "lte" : 20
  },
  "time_frame" : { 
    "gte" : "2015-10-31 12:00:00", 
    "lte" : "2015-11-01"
  }
}

PUT range_index/_mapping/_doc
{
  "properties": {
    "ip_whitelist": {
      "type": "ip_range"
    }
  }
}

PUT range_index/_doc/2
{
  "ip_whitelist" : "192.168.0.0/16"
}
```

支持的参数：
- coerce
- boost
- index
- store

#### 复杂类型

##### 数组数据类型
数组类型不需要专门指定数组元素的type，例如：
- 字符型数组: [ "one", "two" ]
- 整型数组：[ 1, 2 ]
- 数组型数组：[ 1, [ 2, 3 ]] 等价于[ 1, 2, 3 ]
- 对象数组：[ { "name": "Mary", "age": 12 }, { "name": "John", "age": 10 }]

> 所有字段支持数组方式使用。

##### object 
定义方式，可以多层嵌套。
```
"manager": { 
          "properties": {
            "age":  { "type": "integer" },
            "name": { 
              "properties": {
                "first": { "type": "text" },
                "last":  { "type": "text" }
              }
            }
          }
        }
```

支持的参数：
- dynamic
 是否允许动态的添加字段，true（默认），false 和strict。
- enabled
是否应该为对象字段指定的JSON值进行解析和索引（true，默认）或完全忽略（false）。
- properties
对象中的字段，可以是任何 数据类型，包括object。可以将新属性添加到现有对象。

> 对象数组使用`nested`
> 对象属性方法通过点路径方式访问，例如`object1.field1.subfield1`

##### nested
参考：[nested](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/nested.html)
对象数组,和多字段有区别。
对于下面的数据
```
PUT my_index/_doc/1
{
  "group" : "fans",
  "user" : [ 
    {
      "first" : "John",
      "last" :  "Smith"
    },
    {
      "first" : "Alice",
      "last" :  "White"
    }
  ]
}
```

如果`user`字段的结构是多字段还是`nested`,在表面看起来一样，实际上查询时，效果是不同的。
多字段的结构
```json
     "user": {
       "properties": {
         "first": {
           "type": "text",
           "fields": {
             "keyword": {
               "type": "keyword",
               "ignore_above": 256
             }
           }
         },
         "last": {
           "type": "text",
           "fields": {
             "keyword": {
               "type": "keyword",
               "ignore_above": 256
             }
           }
         }
       }
     }
```
多字段，数据更类似于
```json
"user.first" : [ "alice", "john" ],
"user.last" :  [ "smith", "white" ]
```
使用以下`must`查询不到结果
```json
GET my_index/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "user.first": "Alice" }},
        { "match": { "user.last":  "Smith" }}
      ]
    }
  }
}

```

而`nested`的Mapping为:
```json
     "user": {
       "type": "nested",
       "properties": {
         "first": {
           "type": "text",
           "fields": {
             "keyword": {
               "type": "keyword",
               "ignore_above": 256
             }
           }
         },
         "last": {
           "type": "text",
           "fields": {
             "keyword": {
               "type": "keyword",
               "ignore_above": 256
             }
           }
         }
       }
     }
```

使用以下查询查不到数据
```json

#请求
GET my_index/_search
{
  "query": {
    "nested": {
      "path": "user",
      "query": {
        "bool": {
          "must": [
            { "match": { "user.first": "Alice" }},
            { "match": { "user.last":  "Smith" }} 
          ]
        }
      }
    }
  }
}
```

使用以下查询
```json
#请求
GET my_index/_search
{
  "query": {
    "nested": {
      "path": "user",
      "query": {
        "bool": {
          "must": [
            { "match": { "user.first": "Alice" }},
            { "match": { "user.last":  "White" }} 
          ]
        }
      },
      "inner_hits": { 
        "highlight": {
          "fields": {
            "user.first": {}
          }
        }
      }
    }
  }
}

#响应
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 5,
    "successful": 5,
    "skipped": 0,
    "failed": 0
  },
  "hits": {
    "total": 1,
    "max_score": 1.3862944,
    "hits": [
      {
        "_index": "my_index",
        "_type": "_doc",
        "_id": "1",
        "_score": 1.3862944,
        "_source": {
          "group": "fans",
          "user": [
            {
              "first": "John",
              "last": "Smith"
            },
            {
              "first": "Alice",
              "last": "White"
            }
          ]
        },
        "inner_hits": {
          "user": {
            "hits": {
              "total": 1,
              "max_score": 1.3862944,
              "hits": [
                {
                  "_index": "my_index",
                  "_type": "_doc",
                  "_id": "1",
                  "_nested": {
                    "field": "user",
                    "offset": 1
                  },
                  "_score": 1.3862944,
                  "_source": {
                    "first": "Alice",
                    "last": "White"
                  },
                  "highlight": {
                    "user.first": [
                      "<em>Alice</em>"
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    ]
  }
}

```




支持的参数：
- dynamic
- properties

#### 特殊类型

##### IP 

##### completion 补全

##### token_count 令牌计数
统计字段内容中token的数目
使用:
```
"properties": {
        "name": { 
          "type": "text",
          "fields": {
            "length": { 
              "type":     "token_count",
              "analyzer": "standard"
            }
          }
        }
      }
```



##### murmur3

##### percolator 过滤器类型

##### join 关联类型

## Mapping 参数

#### analyzer分析器
参考[analyzer](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analyzer.html)
字符串字段的值通过分析器处理， 以将字符串转换为token或terms流。例如，"The quick Brown Foxes." 可能被分析成`quick`，`brown`，`fox`这些Token，具体Token取决于所使用的分析器。这些是该字段索引的term，这使得它可以有效地搜索单个单词的该字段的位置。

分析过程不只发生在索引建立时，在查询时，同样需要对查询字符串进行相同或类似的分析器处理，以便于查询出相同的Term。

Elasticsearch附带了许多[预定义的分析器](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-analyzers.html)，无需进一步配置即可使用。它还附带了许多 [字符过滤器](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-charfilters.html)，[标记器](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-tokenizers.html)和[令牌过滤器](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-tokenfilters.html)，可以组合起来为每个索引配置自定义分析器。

可以按查询，按字段或按索引指定分析器。在索引时，Elasticsearch将按以下顺序查找分析器：
- 在字段映射中定义的 `analyzer`。
- 在索引设置中命名为`default`的分析器。
- `standard`分析器。

在查询时：
- 在full-text query.全文查询中定义的`analyzer`。
- 在字段映射中定义的`search_analyzer` 。
- 在字段映射中定义的 `analyzer`。
- 在索引设置中命名为`default_search `的分析器。
- 在索引设置中命名为`default`的分析器。
- `standard`分析器。

为特定字段指定分析器的最简单方法是在字段映射中定义它，如下所示：
```
PUT /my_index
{
  "mappings": {
    "_doc": {
      "properties": {
        "text": { 
          "type": "text",
          "fields": {
            "english": { 
              "type":     "text",
              "analyzer": "english"
            }
          }
        }
      }
    }
  }
}

GET my_index/_analyze 
{
  "field": "text",
  "text": "The quick Brown Foxes."
}

GET my_index/_analyze 
{
  "field": "text.english",
  "text": "The quick Brown Foxes."
}
```
####  boost
参考：[boost](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping-boost.html)
提升term查询时，该字段的评分的权重，默认为1.0。官方不推荐使用。

#### eager_global_ordinals 全局序号
参考：[eager_global_ordinals](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/eager-global-ordinals.html)
是否预先加载字段分析后的每个Term的序号。
设置为true将提升该字段在聚合搜索时的效率，但会降低索引时的效率。

#### fielddata 字段数据
参考：[fielddata](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/fielddata.html)
默认情况下，大多数字段都被编入索引，这使得它们可以搜索。但是，对脚本中的字段值进行排序，聚合和访问需要使用不同的搜索访问模式。

`text`默认情况下，在字段上禁用`Fielddata `
`Fielddata`可能会消耗大量的堆空间，尤其是在加载高基数`text`字段时。一旦`fielddata`已加载到堆中，它将在该段的生命周期内保留。此外，加载`fielddata`是一个昂贵的过程，可能会导致用户遇到延迟命中。这就是默认情况下禁用`fielddata`的原因。

如果您尝试对text 字段上的脚本进行排序，聚合或访问，您将看到以下异常：
>Fielddata is disabled on text fields by default. Set fielddata=true on [your_field_name] in order to load fielddata in memory by uninverting the inverted index. Note that this can however use significant memory.

####  fields 多字段
参考：[fields](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/multi-fields.html)
为不同目的以不同方式索引相同字段通常很有用。这是多字段的目的。例如，string 字段可以映射为text全文搜索字段，也可以映射keyword为排序或聚合字段：
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "properties": {
        "city": {
          "type": "text",
          "fields": {
            "raw": { 
              "type":  "keyword"
            }
          }
        }
      }
    }
  }
}

PUT my_index/_doc/1
{
  "city": "New York"
}

PUT my_index/_doc/2
{
  "city": "York"
}

GET my_index/_search
{
  "query": {
    "match": {
      "city": "york" 
    }
  },
  "sort": {
    "city.raw": "asc" 
  },
  "aggs": {
    "Cities": {
      "terms": {
        "field": "city.raw" 
      }
    }
  }
}
```

#### index_options

该index_options参数控制将哪些信息添加到倒排索引，以用于搜索和突出显示。它接受以下设置：
- docs
仅索引文档编号。可以回答这个问题这个术语是否存在于该字段？
- freqs
Doc编号和术语频率被编入索引。术语频率用于对重复术语进行高于单个术语的评分。
- positions
默认值，文档编号，术语频率和术语位置（或顺序）被编入索引。位置可用于 邻近或短语查询。
- offsets
文档编号，术语频率，位置以及开始和结束字符偏移（将术语映射回原始字符串）都被编入索引。高亮搜索使用偏移来加速突出显示。

> 6.0版本数字字段将不支持该参数
文本字段还可以索引术语前缀以加速前缀搜索。该`index_prefixes` 参数被配置如下。
- `min_chars`
最小字符数，不输入为2
- `max_chars`
最大字符数，不输入为5

#### index_prefixes
```
PUT my_index
{
  "mappings": {
    "_doc": {
      "properties": {
        "full_name": {
          "type":  "text",
          "index_prefixes" : {
            "min_chars" : 1,    
            "max_chars" : 10    
          }
        }
      }
    }
  }
}

PUT my_index
{
  "mappings": {
    "_doc": {
      "properties": {
        "full_name": {
          "type":  "text",
          "index_prefixes" : {
          }
        }
      }
    }
  }
}

```

#### norms
可以使用修改索引MappingAPI禁用，但不能重新打开
```
PUT my_index/_mapping/_doc
{
  "properties": {
    "title": {
      "type": "text",
      "norms": false
    }
  }
}
```

#### ignore_above
超过`ignore_above`设置的字符串将不会被索引或存储。对于字符串数组，`ignore_above`将分别应用于每个数组元素。
如果启用了_source，那么所有字符串/数组元素仍将出现在字段中，这是Elasticsearch中的默认值。

该参数可以通过修改索引Mapping API修改。


#### normalizer
参考：[normalizer](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/normalizer.html)
[Normalizers](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-normalizers.html)
对于`keyword`字段来说，`normalizer`作用类似`analyzer`。

设置`foo`字段`token`中所有ascii字符转换为小写，这样查询时就不区分大小写了。
```
PUT index
{
  "settings": {
    "analysis": {
      "normalizer": {
        "my_normalizer": {
          "type": "custom",
          "char_filter": [],
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  },
  "mappings": {
    "_doc": {
      "properties": {
        "foo": {
          "type": "keyword",
          "normalizer": "my_normalizer"
        }
      }
    }
  }
}

PUT index/_doc/1
{
  "foo": "BÀR"
}

PUT index/_doc/2
{
  "foo": "bar"
}

PUT index/_doc/3
{
  "foo": "baz"
}

POST index/_refresh

GET index/_search
{
  "query": {
    "term": {
      "foo": "BAR"
    }
  }
}

GET index/_search
{
  "query": {
    "match": {
      "foo": "BAR"
    }
  }
}

```

#### coerce
是否支持数字型字段接受字符型数字内容，true（默认）和false。
支持全局设置
```
 "settings": {
    "index.mapping.coerce": false
  }
```

####  doc_values
禁用`doc_values`字段将不支持排序和聚合，默认所有支持`doc_value`的字段都是`true`开启的。
如果明确不需要排序和聚合的字段，可以设置为`fales`，这个可以降低存储空间。

#### dynamic

- true
新检测到的字段将添加到映射中。（默认）
- false
新检测到的字段将被忽略。这些字段不会被编入索引，因此无法搜索，但仍会出现在_source返回的匹配字段中。这些字段不会添加到映射中，必须显式添加新字段。
- strict
如果检测到新字段，则抛出异常并拒绝该文档。必须将新字段显式添加到映射中。 


> 该参数支持通过修改索引Mapping API修改。
> 对象内部的对象将自动继承该配置。

#### enabled

对于对象类型，是否解析索引时提供的json对象字符串。如果设置为`false`将不解析，索引时将存储JSON原始值。默认为`true`
```
PUT index
{
  
   "mappings":{
     "_doc":{
       "properties":{
         "object1":{
           "type":"object",
           "enabled":false
         }
       }
     }
   }
  
}

PUT index/_doc/1
{
  "object1":{
    "field1":"text"
  }
}
GET index/_search
{
  "query":{
    "match":{
      "object1.field1":"text"
    }
  }
}
```