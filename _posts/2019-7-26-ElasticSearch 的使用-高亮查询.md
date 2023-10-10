---
layout: post
title:  "ElasticSearch 的使用-高亮查询"
categories: ['ElasticSearch']
tags: ['ElasticSearch'] 
author: YJ-MoLi
description: ElasticSearch 的使用-高亮查询
issueId: 2019-7-26 ElasticSearch 的使用-高亮查询
---
* TOC
{:toc}

# ElasticSearch 的使用 - 高亮查询


## 高亮匹配关键字的实现
官方文档：[highlighter](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-highlighting.html)
通常参考官方文档就能实现效果，只是在这里有一些坑做提前告知。

### 坑点
1. `nested` 类型的字段的高亮处理和非`nested`的处理是不同的。
2. 高亮的时候最好设置高亮类型`highlighterType`为`plan`,`number_of_fragments`为`0`。

### 生成和调用高亮查询语句的实现
```java
public OrderAllInfoResult getOrderAllInfo(Integer id, OrderSearchParameter searchParameter) {
        if (searchParameter != null && (StringUtils.isNotBlank(searchParameter.getKeyword()) ||
            searchParameter.getSearchParameterId()!=null)) {
            SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
            BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
            //完成查询语句
            completeQuery(boolQueryBuilder,getRefineSearchParameter(searchParameter),true);
            //组合过滤条件
            boolQueryBuilder.filter(QueryBuilders.idsQuery().addIds(String.valueOf(id)));
            //获取非嵌套对象的高亮处理
            HighlightBuilder highlightBuilder = getOrderNotNestHighlightBuilder(OrderSearchParameter .ALL);
            searchSourceBuilder.highlighter(highlightBuilder);
            searchSourceBuilder.query(boolQueryBuilder);
            // 获取钉单全部信息
            return orderEsService.searchOrderAllInfo(searchSourceBuilder);
        } else {
            return orderEsService.getOrderById(id);

        }

    }

private void completeQuery(BoolQueryBuilder boolQueryBuilder,
        List<OrderSearchParameter > searchParameterList,boolean isHighLight){
        searchParameterList.forEach(r->{
            BoolQueryBuilder currentBoolQueryBuilder = getOrderBoolQueryBuilder(r,isHighLight);
            boolQueryBuilder.must(currentBoolQueryBuilder);
        });
    }

private BoolQueryBuilder getOrderBoolQueryBuilder(OrderSearchParameter  searchParameter, boolean isHighLight) {

        BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
        // 有关键字才生成关键字搜索条件
        if (StringUtils.isNotBlank(searchParameter.getKeyword())) {
            completeKeyWordBoolQueryBuilder(boolQueryBuilder, searchParameter, isHighLight);
        }
        return boolQueryBuilder;
    }


private void completeKeyWordBoolQueryBuilder(BoolQueryBuilder boolQueryBuilder,
        OrderSearchParameter  searchParameter, boolean isHighLight) {
        String keyword = StringUtils.trimToEmpty(searchParameter.getKeyword());
        // 产品信息嵌套查询
        BoolQueryBuilder skuListBoolQueryBuilder = new BoolQueryBuilder();
        MatchQueryBuilder skuListDescriptionChineseMatchQueryBuilder = new MatchQueryBuilder("skuList.description.chinese",keyword);
        skuListBoolQueryBuilder .should(industryDomainListFullNameChineseMatchQueryBuilder);
        //全匹配有优先级提升
        MatchQueryBuilder skuListDescriptionRawMatchQueryBuilder = new MatchQueryBuilder("skuList.description.raw",keyword);
        skuListDescriptionRawMatchQueryBuilder .boost(10f);
        skuListBoolQueryBuilder.should(industryDomainListFullNameRawMatchQueryBuilder);
        NestedQueryBuilder skuListNestedQueryBuilder = new NestedQueryBuilder("skuList",
            skuListBoolQueryBuilder,ScoreMode.Avg);

        // 名称信息匹配查询
        MultiMatchQueryBuilder nameMultiMatchQueryBuilder = QueryBuilders.multiMatchQuery(keyword,
            "baseInfo.name.chinese",  "baseInfo.showName.chinese");
        MultiMatchQueryBuilder nameRawMultiMatchQueryBuilder = QueryBuilders.multiMatchQuery(keyword,
            "baseInfo.name.raw", "baseInfo.showName.raw");
        nameRawMultiMatchQueryBuilder.boost(10f);

        // 编号匹配查询
        MatchQueryBuilder codeMatchQueryBuilder =
            QueryBuilders.matchQuery("baseInfo.code.chinese",keyword);
        MatchQueryBuilder codeRawMatchQueryBuilder =
            QueryBuilders.matchQuery( "baseInfo.code.raw",keyword);
        codeRawMatchQueryBuilder.boost(10f);

        if (isHighLight) {
            //由于嵌套字段的高亮查询参数需要在嵌套的查询语句里的，因此必须在生成查询语句时处理
            skuListBoolQueryBuilder .innerHit(getOrderNestHighlightBuilder(
                Arrays.asList("skuList.description.chinese")
            ));
        }
         boolQueryBuilder.should(skuListNestedQueryBuilder );
         boolQueryBuilder.should(nameMultiMatchQueryBuilder);
         boolQueryBuilder.should(nameRawMultiMatchQueryBuilder);
         boolQueryBuilder.should(codeMatchQueryBuilder);
         boolQueryBuilder.should(codeRawMatchQueryBuilder);

    }
```



生成高亮处理语句：
```java

private HighlightBuilder getOrderNotNestHighlightBuilder() {
        HighlightBuilder highlightBuilder = new HighlightBuilder();
        highlightBuilder.preTags("<em>").postTags("</em>");
        //设置高亮的方法
        highlightBuilder.highlighterType("plain");
        //设置分段的数量不做限制
        highlightBuilder.numOfFragments(0);

        highlightBuilder.field("baseInfo.name.chinese");
        highlightBuilder.field("baseInfo.code.chinese");
     
        return highlightBuilder;
    }
    
 private InnerHitBuilder getOrderNestHighlightBuilder(List<String> fieldList) {
        if(CollectionUtils.isEmpty(fieldList)){
            return null;
        }
        InnerHitBuilder innerHitBuilder = new InnerHitBuilder();
        HighlightBuilder highlightBuilder = new HighlightBuilder();
        highlightBuilder.preTags("<em>").postTags("</em>");
        //设置高亮的方法
        highlightBuilder.highlighterType("plain");
        //设置分段的数量不做限制
        highlightBuilder.numOfFragments(0);
        for(String field:fieldList){
            highlightBuilder.field(field);
        }
        innerHitBuilder.setHighlightBuilder(highlightBuilder);
        return innerHitBuilder;
    }

```

### 对查询的结果进行高亮处理的实现

ES 查询结果中高亮的内容是独立在一个字段类，并且`nested`字段的高亮内容是存放在`nested`字段内的高亮字段。因此如果需要对返回的结果做高亮标识，需要做一些特殊处理。

- 高亮参数中的`highlighterType` 设置为`plain`的目的是保证高亮字段里的字段值和原始的值是一致的，而不是仅是原始字段的子集。

- `fragmentSize` 参数用于控制返回的高亮字段的最大字符数（默认值为 100 ），如果高亮结果的字段长度大于该设置的值，则大于的部分不返回。
- `number_of_fragments` ,如果 `number_of_fragments` 值设置为 0，则不会生成片段，而是返回字段的整个内容，当然它会突出显示。如果短文本（例如文档标题或地址）需要高亮显示，但不需要分段，这可能非常方便。请注意，在这种情况下会忽略 `fragment_size`。

```java
public OrderAllInfoResult searchOrderAllInfo(SearchSourceBuilder searchSourceBuilder) {
        SearchResult searchResult = esClient.highlightDocument(OrderConstant.ORDER_INDEX_NAME, searchSourceBuilder);
        JsonArray jsonArray = searchResult.getJsonObject().get("hits").getAsJsonObject().get("hits").getAsJsonArray();
        if(jsonArray == null || jsonArray.size() == 0) {
            return null;
        }
        OrderAllInfoResult orderAllInfoResult = JsonUtils.JsonToObject(jsonArray.get(0).getAsJsonObject().get("_source").toString(),
            ORDER_ALL_INFO_RESULT_TYPE);
        //替换非嵌套的高亮的结果   
        if(jsonArray.get(0).getAsJsonObject().get("highlight") != null) {
            //替换基本信息
            Map<String, BiConsumer<OrderBaseInfoResult,String>> baseInfoFunMap = new HashMap<>();
            baseInfoFunMap.put("baseInfo.name.chinese",(t,v)->t.setName(v));
            baseInfoFunMap.put("baseInfo.showName.chinese",(t,v)->t.setShowName(v));
            baseInfoFunMap.put("baseInfo.code.chinese",(t,v)->t.setCode(v));
            replaceHighlight(jsonArray.get(0).getAsJsonObject().get("highlight"),
                orderAllInfoResult::getBaseInfo,baseInfoFunMap);
            
        }
        //替换为嵌套高亮的结果
        if(jsonArray.get(0).getAsJsonObject().get("inner_hits") != null) {
            JsonObject innerHitsJsonObject = jsonArray.get(0).getAsJsonObject().get("inner_hits").getAsJsonObject();
            if(innerHitsJsonObject .get("skuList") != null) {
                //处理SKU List
	            Map<String, BiConsumer<SkuInfoResult,String>> replaceFieldFunMap = new HashMap<>();
                replaceFieldFunMap.put("skuList.description.chinese",(t,v)->t.setDescription(v));
                replaceInnerHitsHighlight(innerHitsJsonObject.get("skuList"),
                    orderAllInfoResult::getSkuList, SkuInfoResult::getId, replaceFieldFunMap,
                    new TypeReference<SkuInfoResult>() {}); 
            }
        }

        return orderAllInfoResult ;
    }

	/**
     * 替换非嵌套的高亮部分
     * @param fieldInnerHitsJsonElement
     * @param dataFun
     * @param replaceFieldFunMap
     * @return void
     */
    private <T>  void replaceHighlight(JsonElement fieldInnerHitsJsonElement,
        Supplier<T> dataFun,Map<String, BiConsumer<T,String>> replaceFieldFunMap){
        if(fieldInnerHitsJsonElement != null) {
            T data = dataFun.get();
            JsonObject highlightJsonObject = fieldInnerHitsJsonElement.getAsJsonObject();
            if(!Objects.isNull(data)){
                replaceFieldFunMap.forEach((k,v)->{
                    if(highlightJsonObject.get(k) != null) {
                        v.accept(data,highlightJsonObject.get(k).getAsString());
                    }
                });
            }
        }
    }

    /**
     * 替换嵌套的高亮部分
     * @param fieldInnerHitsJsonElement
     * @param getListFun
     * @param getKeyFun
     * @param replaceFieldFunMap
     * @return void
     */
    private <T,K>  void replaceInnerHitsHighlight(JsonElement fieldInnerHitsJsonElement,
        Supplier<List<T>> getListFun,
        Function<T,K> getKeyFun,
        Map<String, BiConsumer<T,String>> replaceFieldFunMap,
        TypeReference<T> type){
        if(fieldInnerHitsJsonElement != null) {
            JsonArray hitsJsonArray = fieldInnerHitsJsonElement.getAsJsonObject().get("hits").getAsJsonObject().get("hits").getAsJsonArray();
            List<T> list = getListFun.get();
            if(CollectionUtils.isNotEmpty(list)){
                //转换为id为key，value为对象的Map
                Map<K,T> map = list.stream()
                    .collect(Collectors.toMap(getKeyFun, Function.identity()));
                for (JsonElement jsonElement : hitsJsonArray) {
                    if(jsonElement.getAsJsonObject().get("highlight")!=null){
                        String sourceJson = jsonElement.getAsJsonObject().get("_source").toString();
                        T t = JsonUtils.JsonToObject(sourceJson, type);
                        T t2 = map.get(getKeyFun.apply(t));
                        JsonObject hightJsonObject = jsonElement.getAsJsonObject().get("highlight").getAsJsonObject();
                        replaceFieldFunMap.forEach((k,v)->{
                            if(hightJsonObject.get(k) != null) {
                                v.accept(t2,hightJsonObject.get(k).getAsJsonArray().get(0).getAsString());
                            }
                        });
                    }
                }
            }
        }
    }

```




## 其他相关笔记

- [ElasticSearch 的使用-整体方向和调研笔记](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B4%E4%BD%93%E6%96%B9%E5%90%91%E5%92%8C%E8%B0%83%E7%A0%94%E7%AC%94%E8%AE%B0.html)

- [ElasticSearch Index Settings](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-Index-Settings.html)

- [ElasticSearch Index Mappings](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-Index-Mappings.html)

- [ElasticSearch 的使用-查询](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-高亮查询](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E9%AB%98%E4%BA%AE%E6%9F%A5%E8%AF%A2.html)

- [ElasticSearch 的使用-数据导入](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%85%A5.html)

- [ElasticSearch 的使用-关键字补全](https://moliyingjiang.github.io/elasticsearch/2019/07/26/ElasticSearch-%E7%9A%84%E4%BD%BF%E7%94%A8-%E5%85%B3%E9%94%AE%E5%AD%97%E8%A1%A5%E5%85%A8.html)