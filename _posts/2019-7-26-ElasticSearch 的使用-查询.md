---
layout: post
title:  "ElasticSearch 的使用-查询"
categories: ['ElasticSearch']
tags: ['ElasticSearch'] 
author: Feiyizhan
description: ElasticSearch 的使用-查询
issueId: 2019-7-26 ElasticSearch 的使用-查询
---
* TOC
{:toc}


# ElasticSearch 的使用 - 查询

官方的查询文档：[Query](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-query.html)
ES查询工作主要是生成Query语句，日常使用中基本只会用到`match`匹配。如果多个字段最多加上`multi_match`，然后就是通过`bool`查询的`should` 或`must`来组合。
Java后端推荐使用[Jest](https://github.com/searchbox-io/Jest) 来操作ES。

## Spring Boot 集成Jest

在`application.properties`文件中增加如下配置
```
es.server.url=http://xxxx:9200
es.user=xxx
es.password=xxx
```

增加加载ES配置的配置Bean，并初始化自定义的ES Clietn类，`EsClient`类为自己封装的`Jest`对ES的操作工具类，代码相关代码会在使用的时候列出来。
```java
/**
 * ElasticSearch 配置文件
 */
@Configuration
public class EsConfig {
    /**
     * ES服务器URL
     */
    private String esServerUrl;
    
    /**
     * ES用户
     */
    private String esUser;
    /**
     * ES用户密码
     */
    private String esPassword;
    
    /**
     * URL
     * @param esServerUrl
     */
    @Value(value="${es.server.url}")
    public void setEsServerUrl(String esServerUrl) {
        this.esServerUrl = esServerUrl;
    }
    
    /**
     * ES用户
     * @param esUser
     */
    @Value(value="${es.user}")
    public void setEsUser(String esUser) {
        this.esUser = esUser;
    }
    
    /**
     * ES用户密码
     * @param esPassword
     */
    @Value(value="${es.password}")
    public void setEsPassword(String esPassword) {
        this.esPassword = esPassword;
    }
    
    /**
     * 获取Ealstic Search客户端
     * @return
     */
    @Bean
    public EsClient getEsClient() {
        return EsClient.getInstance(esServerUrl, esUser, esPassword);
    }

}
```

使用时指定通过`@Autowired`注入即可。
```java

@RunWith(SpringRunner.class)
@SpringBootTest
@Log4j2
public class EsClietnTests {

    @Autowired
    EsClient esClient;
    
    @Test
    public void testCount() {
        esClient.getIndexCount("order");
    }
}
```

## 分页查询

分页查询主要使用`from`和`size`参数，参考官方文档：[From/Size](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-from-size.html)

手动分页查询的语句：
```json
GET test/_search
{
  "from": 0,
  "size": 10,
  "query": {}
}
```
通过`Jest`查询:
先构建一个`SearchSourceBuilder` 对象
```java
 @Test
    public void testSearchByPage(){
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
		// 编号匹配查询
        MatchQueryBuilder codeMatchQueryBuilder = QueryBuilders.matchQuery("baseInfo.code.chinese", "查询关键字");
        boolQueryBuilder.should(codeMatchQueryBuilder);
        
        // 从第几页开始
        searchSourceBuilder.from(0);
        // 每页显示多少条
        searchSourceBuilder.size(10);
        // 设置查询条件
        searchSourceBuilder.query(boolQueryBuilder);
        // 设置按照匹配度评分排序
        searchSourceBuilder.sort("_score");
        // 设置按照创建日期倒序
        searchSourceBuilder.sort("baseInfo.createDate", SortOrder.DESC);
        log.info(JsonUtils.objectToJson(esService.searchByPage(searchSourceBuilder)));
    }
```

`esService.searchWithPage`的实现:
```java
@Override
 public List<OrderAllInfoDTO> searchByPage(SearchSourceBuilder searchSourceBuilder) {
     //设置查询返回的结果字段列表和忽略的字段列表
     searchSourceBuilder.fetchSource(ALL_INFO_FIELD_LIST, null);
     //调用客户端的分页搜索功能，传入索引名称，查询语句，返回的结果类型
     List<OrderAllInfoDTO> list = esClient.searchByPage(
         OrderConstant.INDEX_NAME,
         searchSourceBuilder, ORDER_ALL_INFO_DTO_TYPE);
     return list;
 }
```

`ORDER_ALL_INFO_DTO_TYPE`的内容为：
```java
private static final TypeReference<OrderAllInfoDTO> ORDER_ALL_INFO_DTO_TYPE=
        new TypeReference<OrderAllInfoDTO>() {};
```

`esClient.searchByPage`的实现:
```java
public <T> List<T> searchByPage(String index, SearchSourceBuilder searchSourceBuilder,TypeReference<T> type) {
        String searchStr = searchSourceBuilder.toString();
        log.debug("ES查询字符串:{}", searchStr);
        // typeName 固定为默认的Type名称'_doc'
        Search search = new Search.Builder(searchStr).addIndex(index).addType(typeName).build();
        return searchByPage(search,type);
    }

public <T> List<T> searchByPage(Action clientRequest,TypeReference<T> type){
        try {
            JestResult result = client.execute(clientRequest);
            if(result.isSucceeded()) {
                List<String> sourceList =  result.getSourceAsStringList();
                if(CollectionUtils.isNotEmpty(sourceList)) {
                    List<T> list = new ArrayList<>();
                    for(String str:sourceList) {
                        list.add(JsonUtils.JsonToObject(str, type));
                    }
                    return list;
                }
            }
        } catch (IOException ex) {
            log.warn("分页搜索失败",ex);
        }
        return Collections.emptyList();
    }
```

`JsonUtils.JsonToObject`是一个自定义的Jackson包装后的工具类。实现内容如下：
```java
    public static <T> T JsonToObject(String json, TypeReference<T> javaType) {
        try {
            return OM.readValue(json, javaType);
        } catch (Exception e) {
            log.error("转换JSON字符串为对象失败",e);
        } 
        return null;
    }
```


注意的是`from + size` 不能超过`index.max_result_window` 参数的值，否则之后的数据取不到，`index.max_result_window` 参数的默认值为1万。虽然官方不推荐这个值设置的过大，但实际业务如果真需要，还是推荐修改这个参数值。因为官方推荐的另外两个方式都无法完美支持随机跳页和前后翻滚以及修改每页记录数的操作。实际使用时可以通过限制用户一次能跳转的页数来达到更好的体验的效果。比如禁止直接跳转到尾页，不允许输入页号跳转，一次只展示前后10页的页码。修改方法：

```json
PUT /my_index/_settings
{
  "index.max_result_window":1000000
}
```


## 排序和评分优化
通常排序使用`_score` 排序即可，即ES按照指定的评分算法，计算每个`doc`对于本次搜索的评分情况，然后按照评分大小从大到小排序。评分的规则参考：[elasticSearch(5.3.0)的评分机制的研究](https://www.cnblogs.com/wangjiuyong/articles/7055724.html)，

排序的官方文档：[Sort](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-sort.html)


### 全字段匹配评分最高的实现
ES的计算评分的算法不是全字匹配优先级最高，而是按照多个维度统计汇总一个评分，因此如果想实现关键字完全匹配的优先级最高的排序，需要对索引的`Mapping`做一些修改，并且查询语句也要做一些修改，修改内容如下：

**Mapping**:
增加一个`raw`的子字段，数据类型为`keyword`，并且使用不分词的规划器。

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

**搜索**:
搜索时除了正常的搜索条件，再额外增加一个对`raw`字段的搜索条件，并设置该条件的权重是普通的搜索条件的`10`倍

```java

@Test
    public void testSearchByPage(){
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
        //编号匹配
		MatchQueryBuilder codeMatchQueryBuilder = QueryBuilders.matchQuery("baseInfo.code.chinese", keyword);
        MatchQueryBuilder codeRawMatchQueryBuilder = QueryBuilders.matchQuery("baseInfo.code.raw", keyword);
        codeRawMatchQueryBuilder.boost(10f);
        
        // 从第几页开始
        searchSourceBuilder.from(0);
        // 每页显示多少条
        searchSourceBuilder.size(10);
        // 设置查询条件
        searchSourceBuilder.query(boolQueryBuilder);
        // 设置按照匹配度评分排序
        searchSourceBuilder.sort("_score");
        // 设置按照创建日期倒序
        searchSourceBuilder.sort("baseInfo.createDate", SortOrder.DESC);
        log.info(JsonUtils.objectToJson(esService.searchByPage(searchSourceBuilder)));
    }

```

### 中文搜索关键字分词的优化

常用的中文分析器器是`IK analyzer`, 官网[elasticsearch-analysis-ik](https://github.com/medcl/elasticsearch-analysis-ik),该分析器有两种分词器`ik_smart` , `ik_max_word` 其中`ik_max_word`为尽可能多的拆成多个词，而`ik_smart`是会做一些语意分析后的拆词。实际效果如下：

**ik_smart**测试：
```json
POST _analyze
{
  "analyzer": "ik_smart",
  "text":     "中华人民共和国"
}

```

测试结果：

```json
{
  "tokens": [
    {
      "token": "中华人民共和国",
      "start_offset": 0,
      "end_offset": 7,
      "type": "CN_WORD",
      "position": 0
    }
  ]
}
```

**ik_max_word**测试：
```json
POST _analyze
{
  "analyzer": "ik_max_word",
  "text":     "中华人民共和国"
}

```

```json
{
  "tokens": [
    {
      "token": "中华人民共和国",
      "start_offset": 0,
      "end_offset": 7,
      "type": "CN_WORD",
      "position": 0
    },
    {
      "token": "中华人民",
      "start_offset": 0,
      "end_offset": 4,
      "type": "CN_WORD",
      "position": 1
    },
    {
      "token": "中华",
      "start_offset": 0,
      "end_offset": 2,
      "type": "CN_WORD",
      "position": 2
    },
    {
      "token": "华人",
      "start_offset": 1,
      "end_offset": 3,
      "type": "CN_WORD",
      "position": 3
    },
    {
      "token": "人民共和国",
      "start_offset": 2,
      "end_offset": 7,
      "type": "CN_WORD",
      "position": 4
    },
    {
      "token": "人民",
      "start_offset": 2,
      "end_offset": 4,
      "type": "CN_WORD",
      "position": 5
    },
    {
      "token": "共和国",
      "start_offset": 4,
      "end_offset": 7,
      "type": "CN_WORD",
      "position": 6
    },
    {
      "token": "共和",
      "start_offset": 4,
      "end_offset": 6,
      "type": "CN_WORD",
      "position": 7
    },
    {
      "token": "国",
      "start_offset": 6,
      "end_offset": 7,
      "type": "CN_CHAR",
      "position": 8
    }
  ]
}
```

因此如果只使用`ik_max_word` 会导致当搜索关键字`中华人民共和国`时，会按照分词后的每个关键字都去匹配，导致匹配出来的结果过多和匹配结果的排序不是期望的，例如某个doc含有非常多的`国`字，那么它在搜索结果中的评分可能会只含有一次`人民共和国`的评分高。特别是当搜索关键字中有一些`的`,`是`等常用介词时，这个的差异会更大。但是如果只使用`ik_smart`,又会导致搜索关键字`共和国`等词时匹配不到任何内容。因此建议索引时使用`ik_max_word`,而搜索时使用`ik_smart`，这样既能保证关键字拆的够细，又能保证搜索时匹配的够准确。

```json
PUT test
{
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
    "index.mapping.ignore_malformed":false,
    "index.gc_deletes":"0s"
  },
  "mappings": {
    "_doc": {
      "properties": {

        "id": {
          "type": "long"
        },
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
      }
    }
  }
}
```


## 大数据记录的分页查询处理

大数据(超过百万)的分页查询，官方不推荐`from + size` 方式查询，因为`from + size`受索引的`index.max_result_window` 参数的限制，`from + size`不能超过`index.max_result_window`，并且`from + size`查询时实际是需要先对结果进行排序，而如果一个查询跨多个分片，每个分片排序后，还需要再合并后再排序。我们可以假设在一个有 5 个主分片的索引中搜索。当我们请求结果的第一页（结果从 1 到 10 ），每一个分片产生前 10 的结果，并且返回给 协调节点 ，协调节点对 50 个结果排序得到全部结果的前 10 个。

现在假设我们请求第 1000 页—​结果从 10001 到 10010 。所有都以相同的方式工作除了每个分片不得不产生前10010个结果以外。然后协调节点对全部 50050 个结果排序最后丢弃掉这些结果中的 50040 个结果。

可以看到，在分布式系统中，对结果排序的成本随分页的深度成分片的倍数上升。这就是 web 搜索引擎对任何查询都不要返回超过 1000 个结果的原因。

虽然官方提供了[Scroll](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-scroll.html)和[Search After](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-search-after.html)两个方案，但`Scroll`实际是一个固定步长的只能往前移动的游标，不能改变步长，不能后移。而Search After可以改变步长，但同样不能后移。因此需要根据实际的场景来选择方案，并且也需要需求方的配合。

- 标准的分页，支持随机跳页，可以修改修改步长
 - 这个只能选择`from + size`了，通过修改`index.max_result_window`的参数值大小来达到最终效果。最好产品设计时限制用户不能只能在限定的范围内跳页，比如只能在当前页的正负5页范围内跳页，一页的最大记录数不能超过50条等。否则用户直接翻到最后一页，比如会触发性能问题。

-  如果是**加载更多**的模式，那么使用`Search After` 比较合适。
-  如果是**数据导出**的模式，那么使用`Scroll` 会比较方便处理。


## 二次搜索的处理

在上一次的搜索结果中使用新的查询条件再次搜索，实现方案：
1. 后端在收到搜索请求时，判断是否输入了关键字搜索，如果有记录下本次搜索条件，通过`json`系列化后存入到数据库，并生成一个唯一的搜索条件id给前端。
2. 前端在用户明确是二次搜索的情况下，将新的查询条件+之前收到的搜索条件的id一起提交给后端。如果不是二次搜索，则设置搜索id为空。
3. 后端收到查询时，判断是否有搜索条件id，有则取出保存的搜索条件id对应的搜索条件，将新的条件通过`must`查询追加到旧的查询条件中，并将最后的追加好的查询条件再次通过`json`系列化存储到数据库。将新生成的搜索条件id和搜索结果一起返回给前端。

```java
public PageResult<OrderPageInfoResult> orderSearchList(OrderSearchParameter searchParameter,
        SystemUser user) {
        PageResult<OrderPageInfoResult> result = PageResult.empty();
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
        //获取查询条件列表
        List<OrderSearchParameter> searchParameterList = getRefineSearchParameter(searchParameter);
        //完成查询语句
        completeQuery(boolQueryBuilder,searchParameterList);
        // 高级搜索(过滤）
        completeFilter(boolQueryBuilder,searchParameterList);
        searchSourceBuilder.query(boolQueryBuilder);
        // 获取总条数
        Integer total = orderEsService.countBySearch(searchSourceBuilder);
        searchSourceBuilder.sort("_score");
        searchSourceBuilder.sort("baseInfo.createDate", SortOrder.DESC);

        if (total > 0) {
            // 根据总记录数调整分页参数
            searchParameter.correctPageParams(total);
            result = new PageResult<>(searchParameter.getOffset(), searchParameter.getLimit(), total);
            // 从第几页开始
            searchSourceBuilder.from(searchParameter.getOffset());
            // 每页显示多少条
            searchSourceBuilder.size(searchParameter.getLimit());
			//设置返回结果
            result.setItems(orderEsService.searchByPage(searchSourceBuilder));
        }
        //保存新的查询条件
        if(StringUtils.isNotBlank(searchParameter.getKeyword()) || searchParameter.getSearchParameterId()!=null){
            result.setSearchParameterId(saveSearchParameterList(searchParameterList,user));
        }
        return result;
    }


private List<OrderSearchParameter> getRefineSearchParameter(OrderSearchParameter searchParameter){
        if(searchParameter==null){
            return Collections.emptyList();
        }
        Integer searchParameterId = searchParameter.getSearchParameterId();
        List<OrderSearchParameter> list = null;
        if(searchParameterId!=null){
            SystemSearchParameter refineSearchParameter = systemSearchParameterService.getById(searchParameterId);
            if(refineSearchParameter!=null){
                list = JsonUtils.JsonToObject(refineSearchParameter.getValue(),
                    new TypeReference<List<OrderSearchParameter>>() {});
            }
        }
        if(CollectionUtils.isEmpty(list)){
            list = new ArrayList<>();
        }
        //之前的查询条件拼上本次的查询条件
        list.add(searchParameter);
        return list;

    }

 private Integer saveSearchParameterList(List<OrderSearchParameter> searchParameterList,SystemUser user){
        SystemSearchParameterForm form = new SystemSearchParameterForm();
        form.setType(SystemSearchTypeEnum.ORDER_SEARCH.value());
        form.setValue(JsonUtils.objectToJson(searchParameterList));
        return systemSearchParameterService.insert(form,user,now());
    }

```


## 其他相关笔记

- [ElasticSearch 的使用-整体方向和调研笔记](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B4%E4%BD%93%E6%96%B9%E5%90%91%E5%92%8C%E8%B0%83%E7%A0%94%E7%AC%94%E8%AE%B0.html)

- [ElasticSearch Index Settings](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-Index-Settings.html)

- [ElasticSearch Index Mappings](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-Index-Mappings.html)

- [ElasticSearch 的使用-查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-高亮查询](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E9%AB%98%E4%BA%AE%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-数据导入](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%85%A5.html)

- [ElasticSearch 的使用-关键字补全](https://feiyizhan.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E5%85%B3%E9%94%AE%E5%AD%97%E8%A1%A5%E5%85%A8.html)