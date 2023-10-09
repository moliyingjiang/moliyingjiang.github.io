---
layout: post
title:  "ElasticSearch Index Settings"
categories: ['ElasticSearch']
tags: ['ElasticSearch'] 
author: Feiyizhan
description: ElasticSearch Index Settings
issueId: 2019-7-26 ElasticSearch Index Settings
---
* TOC
{:toc}

# Index Settings

参考：[index-modules](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/index-modules.html)
索引的配置分为两部分，一部分为静态的，一部分为动态的。
- 静态的（static）
	在创建时指定，之后就不能修改。
- 动态的（dynamic）
	可以通过更新索引配置API修改。

> 注：更改已关闭索引上的静态或动态索引设置可能会导致不正确的设置，如果不删除并重新创建索引，则无法纠正这些设置。

## 静态索引配置
### index.number_of_shards
索引应具有的主分片数。默认为5.此设置只能在索引创建时设置。它不能在关闭的索引上更改。注意：每个索引限制最大1024个分片数量。此限制是一个安全限制，用于防止意外创建可能因资源分配而导致群集不稳定的索引。可以通过`export ES_JAVA_OPTS="-Des.index.max_number_of_shards=128"`在作为群集一部分的每个节点上指定系统属性来修改限制。

关于分片数量设置多少合适
参考：
[elasticsearch - how many shards](https://www.tuicool.com/articles/EZnuQv7)
[Elasticsearch究竟要设置多少分片数？](https://blog.csdn.net/laoyang360/article/details/78080602)


###  index.shard.check_on_startup
是否应在打开之前检查分片是否有损坏。检测到损坏时，它将阻止分片被打开。值列表：
- false
（默认）打开分片时不检查损坏。
- checksum
检查物理损坏。
- true
检查物理和逻辑损坏。就CPU和内存使用而言，这是非常消耗的。
- fix
检查物理和逻辑损坏。报告为已损坏的细分将自动删除。此选项可能会导致数据丢失。使用时要格外小心！

### index.codec
default值使用LZ4压缩压缩存储的数据，但可以将其设置为`best_compression` 使用DEFLATE获得更高的压缩比，但代价是存储的字段性能较慢。如果要更新压缩类型，则在合并段之后将应用新压缩类型。可以使用强制合并强制进行段合并。


### index.routing_partition_size
自定义路由值可以转到的分片数。默认为1，只能在索引创建时设置。`index.number_of_shards`除非`index.number_of_shards`值为1 ，否则此值必须小于1.请参阅[路由到索引分区](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping-routing-field.html#routing-index-partition)以获取有关如何使用此设置的更多详细信息。

### index.analysis.analyzer.default.type
设置索引的默认分词器。

## 动态索引配置
### index.number_of_replicas
每个主分片具有的副本数。默认为1。
### index.auto_expand_replicas
根据群集中的数据节点数自动扩展副本数。
- 中划线格式的下限和上限（例如0-5）或all 用于上限（例如0-all）。
- false（即禁用） 默认值。

请注意，自动扩展的副本数不会考虑任何其他分配规则，例如分片识别， 过滤或每个节点的总分片，YELLOW如果适用的规则阻止所有副本，则可能导致群集运行状况变为被分配。

### index.refresh_interval
执行刷新操作的频率，这会使索引的最近更改对搜索可见。默认为1s。可以设置-1为禁用刷新。
index.refresh_interval的默认值是 1s，这迫使Elasticsearch集群每秒创建一个新的 segment （可以理解为Lucene 的索引文件）。增加这个值，例如30s，可以允许更大的segment写入，减后以后的segment合并压力。
在初始化索引时，可以禁用 refresh 和 replicas 数量

### index.max_result_window
from + size搜索此索引 的最大值。默认为 10000。搜索请求占用堆内存和时间成比例 from + size，受内存限制。请参阅 [Scroll](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/search-request-scroll.html)或[Search After](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/search-request-search-after.html)以获得更有效的替代方案。

### index.max_inner_result_window
from + size内部命中定义 的最大值和顶部命中此索引的聚合。默认为 100。内部命中和顶部命中聚合使堆内存和时间成比例from + size，受内存限制。

### index.max_rescore_window 
The maximum value of window_size for rescore requests in searches of this index. Defaults to index.max_result_window which defaults to 10000. Search requests take heap memory and time proportional to max(window_size, from + size) and this limits that memory.

### index.max_docvalue_fields_search
`docvalue_fields`查询中允许 的最大数量。默认为100。该配置成本很高，因为它们可能会导致每个文档的每个字段的搜索。
### index.max_script_fields
`script_fields`查询中允许 的最大数量。默认为32。

### index.max_ngram_diff
`NGramTokenizer`和`NGramTokenFilter`的`min_gram`和`max_gram`之间允许的最大差异。默认为1。

### index.max_shingle_diff
`ShingleTokenFilter`的`max_shingle_size`和`min_shingle_size`之间允许的最大差异。默认为3。
### index.blocks.read_only
设置为`true`使索引和索引元数据只读，`false`允许写入和元数据更改。
>注：元数据指索引的`settings`,`mappings`,`aliases`。

### index.blocks.read_only_allow_delete
与`index.blocks.read_only`相同但允许删除索引以释放资源。

### index.blocks.read
设置为`true`禁用对索引的读取操作。

### index.blocks.write
设置为`true`禁用对索引的数据写入操作。与`read_only`不同，此设置不会影响元数据。例如，`write `可以使用关闭索引操作，但`read_only`不能使用关闭索引操作。

###  index.blocks.metadata
设置为`true`禁用索引元数据读取和写入。

### index.max_refresh_listeners
索引的每个分片上可用的最大刷新侦听器数(默认为1000)。这些监听器用于实现[refresh=wait_for](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/docs-refresh.html#_literal_refresh_wait_for_literal_can_force_a_refresh)

### index.highlight.max_analyzed_offset
将为高亮显示请求分析的最大字符数。此设置仅在对没有偏移或术语向量的索引的文本上请求突出显示时适用。默认情况下，此设置在6.x中未设置，默认为-1。

### index.max_terms_count
术语查询中可以使用的最大术语数。默认为65536。

### index.routing.allocation.enable
控制此索引的分片分配。它可以设置为：

- all （默认） - 允许为所有分片分配分片。
- primaries - 仅允许分配主分片的分片。
- new_primaries - 仅允许为新创建的主分片分配分片。
- none - 不允许分片分配。

### index.routing.rebalance.enable
为此索引启用分片重新平衡。它可以设置为：

- all （默认） - 允许所有分片的分片重新平衡。
- primaries - 仅允许主分片重新平衡分片。
- replicas - 仅允许对副本分片进行分片重新平衡。
- none - 不允许进行分片重新平衡。

### index.gc_deletes
已删除文档的版本号仍可用于进一步版本化操作 的时间长度。默认为60s。
索引的每个文档都是版本化的。删除文档时，version可以指定以确保我们尝试删除的相关文档实际上已被删除，并且在此期间没有更改。对文档执行的每个写入操作（包括删除）都会导致其版本递增。删除文档的版本号在删除后仍可短时间使用，以便控制并发操作。已删除文档的版本号保持可用的时间长度由index.gc_deletes索引设置决定，默认为60秒。
即，执行删除文档操作后，该文档的id对应的版本号会自增，并保留60秒，如果在这个时间内重新新增了这个id的文档，那么这个id的文档将会继续使用删除后递增的版本号，而不是1。如果在这个时间之外，再新增则版本号是1.

### index.mapping.total_fields.limit
索引中的最大字段数。默认值为1000。

### index.mapping.depth.limit
字段的最大深度，以内部对象的数量来度量。例如，如果所有字段都是在根对象级别定义的，则深度为1。如果有一个对象映射，则深度为 2，等等。默认值为20。

### index.mapping.nested_fields.limit
nested索引中 的最大字段数，默认为50。使用100个嵌套字段索引1个文档实际上索引101个文档，因为每个嵌套文档都被索引为单独的隐藏文档。

### index.mapping.coerce
全局设置是否支持数字型字段接收字符型数字内容。true开启，false关闭。设置为false如果将字符型数字赋值给数字型字段，将会抛出异常并拒绝文档。

>`index.mapping.ignore_malformed` 如果该参数值设置为为`true`，即使`index.mapping.coerce` 设置为`false`，字符型数字仍可以存储到数字型字段。
>```
>"settings": {
    "index.mapping.ignore_malformed":true,
    "index.mapping.coerce":false
  }
>```


### index.mapping.ignore_malformed
全局设置错误的数字是否忽略，默认为false。格式错误的数字会抛出异常并拒绝整个文档。设置为true将忽略错误。

### index.mapping.ignore_malformed
全局设置错误的日期是否忽略，默认为false。格式错误的日期会抛出异常并拒绝整个文档。设置为true将忽略错误。

## analysis 分析器






## 操作

### 新建

```
PUT my_index
{
  "settings": {
    "index.number_of_shards":10,
    "index.shard.check_on_startup":"checksum",
    "index.codec":"best_compression",
    "index.routing_partition_size":1
  }
}
```



### 获取
```bash
#获取指定索引的settings
GET my_index/_settings
#获取多个索引的settings
GET /twitter,kimchy/_settings
#获取全部索引的settings
GET /_all/_settings
#获取匹配的多少个索引的settings
GET /log_2013_*/_settings
#获取匹配的多个索引的配置，并过滤配置。
GET /log_2013_-*/_settings/index.number_*
```

### 修改 
参考：[indices-update-settings](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/indices-update-settings.html)
```
PUT /twitter/_settings
{
    "index" : {
        "number_of_replicas" : 2
    }
}

PUT my_index/_settings
{
  "index.gc_deletes":"60s"
}

```
如果需要重置为默认值
```
PUT /twitter/_settings
{
    "index" : {
        "refresh_interval" : null
    }
}
```

在修改索引配置之前，最好先关闭自动刷新、在修改完成之后再开启自动刷新，并最好执行以下强制分段合并。
```
#关闭自动刷新
PUT /twitter/_settings
{
    "index" : {
        "refresh_interval" : "-1"
    }
}
#开启自动更新
PUT /twitter/_settings
{
    "index" : {
        "refresh_interval" : "1s"
    }
}
#强制分段合并
POST /twitter/_forcemerge?max_num_segments=5
```

如果需要修改索引的分析器，那么需要先关闭索引，再修改索引配置，最后再重新打开索引。
```
POST /twitter/_close

PUT /twitter/_settings
{
  "analysis" : {
    "analyzer":{
      "content":{
        "type":"custom",
        "tokenizer":"whitespace"
      }
    }
  }
}

POST /twitter/_open
```


## 推荐配置

分片数和副本数，通常默认配置够用，后续如果有瓶颈，再花时间研究。
在7.0版本将会要求必须指定`index.number_of_shards` 参数。

```
  "settings": {
    "analysis": {
      "filter": {
        "pinyin_filter": {
          "type": "pinyin"
        }
      },
      "analyzer": {
        "custome_standard": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        },
        "custome_chinese": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        },
        "custome_chinese_search":{
          "type": "custom",
          "tokenizer": "ik_smart",
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        }
      },
      "normalizer": {
        "custome_normalizer": {
          "type": "custom",
          "char_filter": [],
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        }
      }
    },
    "index.mapping.coerce": false,
    "index.mapping.ignore_malformed":false
  }

```

对于记录数超过1万的索引，可以通过修改索引的`index.max_result_window`来达到使用的效果，虽然官方不推荐这个值设置的过大，官方默认值是1万，但实际业务如果真需要，还是推荐修改这个参数值。因为官方推荐的另外两个方式都无法完美支持随机跳页和前后翻滚以及修改每页记录数的操作。实际使用时可以通过限制用户一次能跳转的页数来达到更好的体验的效果。比如禁止直接跳转到尾页，不允许输入页号跳转，一次只展示前后10页的页码。
```json
PUT /my_index/_settings
{
  "index.max_result_window":1000000
}
```


其中定义了四个`analyzer` ,分别是标准分词、中文最大分词、中文智能分词、不分词，并且每个`analyzer`都忽略大小写。
为什么需要这四个分词器，举个实际的例子：
```json
"name": {
              "type": "text",
              "analyzer": "custome_standard",
              "fields": {
                "raw": {
                  "type": "keyword",
                  "normalizer": "custome_normalizer"
                },
                "chinese": {
                  "type": "text",
                  "analyzer": "custome_chinese",
                  "search_analyzer":"custome_chinese_search"
                }
              }
            }
```
上面是一个Index的mapping配置中的`name`字段的mappinng配置。
`name`的类型是`text`，并且是个多`field`的字段，其中：

- `name` 使用标准分词器分词，搜索时也使用标准分词器。
- `name.raw`  不做任何分词，主要用于解决搜索时提高全文匹配的评分的问题。
- `name.chinese`  存储时使用中文最大分词，搜索时使用中文智能分词。为什么不都使用中文最大分词或中文智能分词呢。原因是因为，如果都使用中文最大分词，那么搜索的关键会被拆的过细，导致一些常用字的匹配过高和评分过高，排序的结果和搜索的结果和实际期望的结果差异较大。而如果全部使用中文智能分词又会导致一些词搜索不到结果，因此设置在生成索引时使用最大分词，而对搜索关键字则使用智能分词的处理，这样既能保证搜索的匹配度，又能保证排序的准确性。

下面是搜索时如何提升全文匹配的评分的查询语句，关键是`boost` 参数：
```json
{
                "multi_match": {
                  "query": "系统工程师",
                  "fields": [
                    "baseInfo.name.chinese^1.0",
                    "baseInfo.showName.chinese^1.0"
                  ],
                  "type": "best_fields",
                  "operator": "OR",
                  "slop": 0,
                  "prefix_length": 0,
                  "max_expansions": 50,
                  "zero_terms_query": "NONE",
                  "auto_generate_synonyms_phrase_query": true,
                  "fuzzy_transpositions": true,
                  "boost": 1
                }
              },
              {
                "multi_match": {
                  "query": "系统工程师",
                  "fields": [
                    "baseInfo.name.raw^1.0",
                    "baseInfo.showName.raw^1.0"
                  ],
                  "type": "best_fields",
                  "operator": "OR",
                  "slop": 0,
                  "prefix_length": 0,
                  "max_expansions": 50,
                  "zero_terms_query": "NONE",
                  "auto_generate_synonyms_phrase_query": true,
                  "fuzzy_transpositions": true,
                  "boost": 10
                }
              }

```


