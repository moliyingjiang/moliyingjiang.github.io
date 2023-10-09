---
layout: post
title:  "修复Redisson SortedSet不支持Lambda表达式的构造的Comparator的问题"
categories: ['Java']
tags: ['Java','Redis','Redisson'] 
author: Feiyizhan
description: 修复Redisson SortedSet不支持Lambda表达式的构造的Comparator的问题
issueId: 修复Redisson SortedSet Lambda Comparator问题

---
* TOC
{:toc}

# 修复Redisson SortedSet不支持Lambda表达式的构造的Comparator的问题



## 背景
版本号:
```xml
        <!-- https://mvnrepository.com/artifact/org.redisson/redisson -->
        <dependency>
            <groupId>org.redisson</groupId>
            <artifactId>redisson</artifactId>
            <version>3.16.8</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.redisson/redisson-spring-boot-starter -->
        <dependency>
            <groupId>org.redisson</groupId>
            <artifactId>redisson-spring-boot-starter</artifactId>
            <version>3.16.8</version>
        </dependency>
```

## 问题重现
测试代码：
```java
@Data @NoArgsConstructor @AllArgsConstructor
public class Vo implements Serializable {
    Integer id;
    String value;
}
```

```java
        //指定编码器的Bucket
        RSortedSet<Vo> jsonSet = redissonClient.getSortedSet("testJsonObjVoZSet", JsonJacksonCodec.INSTANCE);
        if(jsonSet.isEmpty()){
            //在集合没有元素的时候，设置元素比对规则
            jsonSet.trySetComparator(Comparator.nullsFirst((Comparator<Vo> & Serializable)(x,y)->Integer.compare(x.id,y.id)));
        }
        jsonSet.add(new Vo(1,"测试1"));
        jsonSet.add(new Vo(1,"测试1"));
        jsonSet.add(new Vo(3,"测试3"));
        jsonSet.add(new Vo(2,"测试2"));
        System.out.println(jsonSet.readAll());
```

在第一次运行测试代码之后，redis保存了如下数据：
![image](https://user-images.githubusercontent.com/13580706/154387850-30a17e9b-9465-4a19-94a2-aa67d5cb4360.png)

![image](https://user-images.githubusercontent.com/13580706/154387874-bb3b9de7-af34-435a-8aff-4ebb7103ece4.png)

在第二次运行测试代码之后，出现了以下异常：
```
java.lang.IllegalStateException: java.lang.InstantiationException: java.util.Comparators$NullComparator

	at org.redisson.RedissonSortedSet.loadComparator(RedissonSortedSet.java:126)
	at org.redisson.RedissonSortedSet.checkComparator(RedissonSortedSet.java:226)
	at org.redisson.RedissonSortedSet.add(RedissonSortedSet.java:195)
```

## 问题原因

在执行` jsonSet.add(new Vo(1,"测试1"));` 代码时，执行到`org.redisson.RedissonSortedSet#loadComparator`方法的`comparator = (Comparator<V>) clazz.newInstance();` 语句时，出现了异常，该方法的代码如下：

```java
private void loadComparator() {
        try {
            String comparatorSign = comparatorHolder.get();
            if (comparatorSign != null) {
                String[] parts = comparatorSign.split(":");
                String className = parts[0];
                String sign = parts[1];

                String result = calcClassSign(className);
                if (!result.equals(sign)) {
                    throw new IllegalStateException("Local class signature of " + className + " differs from used by this SortedSet!");
                }

                Class<?> clazz = Class.forName(className);
                comparator = (Comparator<V>) clazz.newInstance();
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
```

表面原因是`java.util.Comparators.NullComparator`  无法通过`(Comparator<V>) clazz.newInstance()` 来构建一个实例，因为它没有空的构造方法。

实际原因是在设计`org.redisson.RedissonSortedSet`时，假设所有的Comparator 都可以通过`(Comparator<V>) clazz.newInstance()` 来构建一个新的`Comparator` ，从而没有真实的保存下`Comparator` 的实例，导致在需要从Redis中取出`Comparator`时，无法完全恢复`Comparator`。

## 解决方案

建议修改`org.redisson.RedissonSortedSet`，将`Comparator` 的校验、储藏和恢复使用序列化和反序列化方式来处理，从而避免`Comparator` 的不能储藏和不能恢复问题。

### 改造`org.redisson.RedissonSortedSet`
- 1、 增加`private RBucket<Comparator<? super V>> comparatorInstance;` 用于管理Comparator的实例
- 2、新增`getComparatorInstanceKeyName`方法，用于配置 comparatorInstance的Redis的Bucket

```java
    private String getComparatorInstanceKeyName() {
        return "redisson_sortedset_comparator_instance:{" + getRawName() + "}";
    }
```

- 3、修改构造方法，增加`comparatorInstance`的初始化代码
```java
    protected RedissonSortedSet(CommandAsyncExecutor commandExecutor, String name, RedissonClient redisson) {
        super(commandExecutor, name);
        this.commandExecutor = commandExecutor;
        this.redisson = redisson;
        comparatorHolder = redisson.getBucket(getComparatorKeyName(), StringCodec.INSTANCE);
        comparatorInstance = redisson.getBucket(getComparatorInstanceKeyName(), new SerializationCodec());
        lock = redisson.getLock("redisson_sortedset_lock:{" + getRawName() + "}");
        list = (RedissonList<V>) redisson.<V>getList(getRawName());
    }

    public RedissonSortedSet(Codec codec, CommandAsyncExecutor commandExecutor, String name, Redisson redisson) {
        super(codec, commandExecutor, name);
        this.commandExecutor = commandExecutor;

        comparatorHolder = redisson.getBucket(getComparatorKeyName(), StringCodec.INSTANCE);
        comparatorInstance = redisson.getBucket(getComparatorInstanceKeyName(), new SerializationCodec());
        lock = redisson.getLock("redisson_sortedset_lock:{" + getRawName() + "}");
        list = (RedissonList<V>) redisson.<V>getList(getRawName(), codec);
    }
```

- 4、修改`loadComparator`方法，替换原代码的构造`comparator`的处理代码
```java
private void loadComparator() {
        try {
            String comparatorSign = comparatorHolder.get();
            if (comparatorSign != null) {
                String[] parts = comparatorSign.split(":");
                String className = parts[0];
                String sign = parts[1];

                String result = calcClassSign(className);
                if (!result.equals(sign)) {
                    throw new IllegalStateException("Local class signature of " + className + " differs from used by this SortedSet!");
                }
                comparator = comparatorInstance.get();
                if(comparator==null){
                    Class<?> clazz = Class.forName(className);
                    comparator = (Comparator<V>) clazz.newInstance();
                }
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
```
- 5、修改`trySetComparator`方法，在保存`comparator`的签名成功之后，将`comparator`的实例也保存到Redis
```java
    @Override
    public boolean trySetComparator(Comparator<? super V> comparator) {
        String className = comparator.getClass().getName();
        final String comparatorSign = className + ":" + calcClassSign(className);
        Boolean res = commandExecutor.get(commandExecutor.evalWriteAsync(getRawName(), StringCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
                "if redis.call('llen', KEYS[1]) == 0 then "
                + "redis.call('set', KEYS[2], ARGV[1]); "
                + "return 1; "
                + "else "
                + "return 0; "
                + "end",
                Arrays.<Object>asList(getRawName(), getComparatorKeyName()), comparatorSign));
        if (res) {
            this.comparator = comparator;
            if(comparator instanceof Serializable){
                comparatorInstance.set(comparator);
            }
        }
        return res;
    }
```


完整代码如下：

```java
/**
 * Copyright (c) 2013-2021 Nikita Koksharov
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.redisson;

import io.netty.buffer.ByteBuf;
import org.redisson.api.*;
import org.redisson.api.mapreduce.RCollectionMapReduce;
import org.redisson.client.RedisClient;
import org.redisson.client.codec.Codec;
import org.redisson.client.codec.StringCodec;
import org.redisson.client.protocol.RedisCommands;
import org.redisson.codec.SerializationCodec;
import org.redisson.command.CommandAsyncExecutor;
import org.redisson.iterator.RedissonBaseIterator;
import org.redisson.mapreduce.RedissonCollectionMapReduce;
import org.redisson.misc.RPromise;
import org.redisson.misc.RedissonPromise;

import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.*;

import static org.redisson.client.protocol.RedisCommands.EVAL_LIST_SCAN;

/**
 *
 * @author Nikita Koksharov
 *
 * @param <V> value type
 */
public class RedissonSortedSet<V> extends RedissonObject implements RSortedSet<V> {

    public static class BinarySearchResult<V> {

        private V value;
        private Integer index;

        public BinarySearchResult(V value) {
            super();
            this.value = value;
        }

        public BinarySearchResult() {
        }

        public void setIndex(Integer index) {
            this.index = index;
        }
        public Integer getIndex() {
            return index;
        }

        public V getValue() {
            return value;
        }


    }

    private Comparator comparator = Comparator.naturalOrder();

    CommandAsyncExecutor commandExecutor;
    
    private RLock lock;
    private RedissonList<V> list;
    private RBucket<String> comparatorHolder;
    private RBucket<Comparator<? super V>> comparatorInstance;
    private RedissonClient redisson;

    protected RedissonSortedSet(CommandAsyncExecutor commandExecutor, String name, RedissonClient redisson) {
        super(commandExecutor, name);
        this.commandExecutor = commandExecutor;
        this.redisson = redisson;
        comparatorHolder = redisson.getBucket(getComparatorKeyName(), StringCodec.INSTANCE);
        comparatorInstance = redisson.getBucket(getComparatorInstanceKeyName(), new SerializationCodec());
        lock = redisson.getLock("redisson_sortedset_lock:{" + getRawName() + "}");
        list = (RedissonList<V>) redisson.<V>getList(getRawName());
    }

    public RedissonSortedSet(Codec codec, CommandAsyncExecutor commandExecutor, String name, Redisson redisson) {
        super(codec, commandExecutor, name);
        this.commandExecutor = commandExecutor;

        comparatorHolder = redisson.getBucket(getComparatorKeyName(), StringCodec.INSTANCE);
        comparatorInstance = redisson.getBucket(getComparatorInstanceKeyName(), new SerializationCodec());
        lock = redisson.getLock("redisson_sortedset_lock:{" + getRawName() + "}");
        list = (RedissonList<V>) redisson.<V>getList(getRawName(), codec);
    }
    
    @Override
    public <KOut, VOut> RCollectionMapReduce<V, KOut, VOut> mapReduce() {
        return new RedissonCollectionMapReduce<V, KOut, VOut>(this, redisson, commandExecutor);
    }

    private void loadComparator() {
        try {
            String comparatorSign = comparatorHolder.get();
            if (comparatorSign != null) {
                String[] parts = comparatorSign.split(":");
                String className = parts[0];
                String sign = parts[1];

                String result = calcClassSign(className);
                if (!result.equals(sign)) {
                    throw new IllegalStateException("Local class signature of " + className + " differs from used by this SortedSet!");
                }
                comparator = comparatorInstance.get();
                if(comparator==null){
                    Class<?> clazz = Class.forName(className);
                    comparator = (Comparator<V>) clazz.newInstance();
                }
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // TODO cache result
    private static String calcClassSign(String name) {
        try {
            Class<?> clazz = Class.forName(name);

            ByteArrayOutputStream result = new ByteArrayOutputStream();
            ObjectOutputStream outputStream = new ObjectOutputStream(result);
            outputStream.writeObject(clazz);
            outputStream.close();

            MessageDigest crypt = MessageDigest.getInstance("SHA-1");
            crypt.reset();
            crypt.update(result.toByteArray());

            return new BigInteger(1, crypt.digest()).toString(16);
        } catch (Exception e) {
            throw new IllegalStateException("Can't calculate sign of " + name, e);
        }
    }

    @Override
    public Collection<V> readAll() {
        return get(readAllAsync());
    }

    @Override
    public RFuture<Collection<V>> readAllAsync() {
        return commandExecutor.readAsync(getRawName(), codec, RedisCommands.LRANGE_SET, getRawName(), 0, -1);
    }
    
    @Override
    public int size() {
        return list.size();
    }

    @Override
    public boolean isEmpty() {
        return list.isEmpty();
    }

    @Override
    public boolean contains(final Object o) {
        return binarySearch((V) o, codec).getIndex() >= 0;
    }

    @Override
    public Iterator<V> iterator() {
        return list.iterator();
    }

    @Override
    public Object[] toArray() {
        return list.toArray();
    }

    @Override
    public <T> T[] toArray(T[] a) {
        return list.toArray(a);
    }

    @Override
    public boolean add(V value) {
        lock.lock();
        
        try {
            checkComparator();
    
            BinarySearchResult<V> res = binarySearch(value, codec);
            if (res.getIndex() < 0) {
                int index = -(res.getIndex() + 1);
                
                ByteBuf encodedValue = encode(value);
                
                commandExecutor.get(commandExecutor.evalWriteNoRetryAsync(getRawName(), codec, RedisCommands.EVAL_VOID,
                   "local len = redis.call('llen', KEYS[1]);"
                    + "if tonumber(ARGV[1]) < len then "
                        + "local pivot = redis.call('lindex', KEYS[1], ARGV[1]);"
                        + "redis.call('linsert', KEYS[1], 'before', pivot, ARGV[2]);"
                        + "return;"
                    + "end;"
                    + "redis.call('rpush', KEYS[1], ARGV[2]);", Arrays.<Object>asList(getRawName()), index, encodedValue));
                return true;
            } else {
                return false;
            }
        } finally {
            lock.unlock();
        }
    }

    private void checkComparator() {
        String comparatorSign = comparatorHolder.get();
        if (comparatorSign != null) {
            String[] vals = comparatorSign.split(":");
            String className = vals[0];
            if (!comparator.getClass().getName().equals(className)) {
                loadComparator();
            }
        }
    }

    public RFuture<Boolean> addAsync(final V value) {
        final RPromise<Boolean> promise = new RedissonPromise<Boolean>();
        commandExecutor.getConnectionManager().getExecutor().execute(new Runnable() {
            public void run() {
                try {
                    boolean res = add(value);
                    promise.trySuccess(res);
                } catch (Exception e) {
                    promise.tryFailure(e);
                }
            }
        });
        return promise;
    }

    @Override
    public RFuture<Boolean> removeAsync(final Object value) {
        final RPromise<Boolean> promise = new RedissonPromise<Boolean>();
        commandExecutor.getConnectionManager().getExecutor().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    boolean result = remove(value);
                    promise.trySuccess(result);
                } catch (Exception e) {
                    promise.tryFailure(e);
                }
            }
        });

        return promise;
    }

    @Override
    public boolean remove(Object value) {
        lock.lock();

        try {
            checkComparator();
            
            BinarySearchResult<V> res = binarySearch((V) value, codec);
            if (res.getIndex() < 0) {
                return false;
            }

            list.remove((int) res.getIndex());
            return true;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public boolean containsAll(Collection<?> c) {
        for (Object object : c) {
            if (!contains(object)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public boolean addAll(Collection<? extends V> c) {
        boolean changed = false;
        for (V v : c) {
            if (add(v)) {
                changed = true;
            }
        }
        return changed;
    }

    @Override
    public boolean retainAll(Collection<?> c) {
        boolean changed = false;
        for (Iterator<?> iterator = iterator(); iterator.hasNext();) {
            Object object = (Object) iterator.next();
            if (!c.contains(object)) {
                iterator.remove();
                changed = true;
            }
        }
        return changed;
    }

    @Override
    public boolean removeAll(Collection<?> c) {
        boolean changed = false;
        for (Object obj : c) {
            if (remove(obj)) {
                changed = true;
            }
        }
        return changed;
    }

    @Override
    public void clear() {
        delete();
    }

    @Override
    public Comparator<? super V> comparator() {
        return comparator;
    }

    @Override
    public SortedSet<V> subSet(V fromElement, V toElement) {
        throw new UnsupportedOperationException();
//        return new RedissonSubSortedSet<V>(this, connectionManager, fromElement, toElement);
    }

    @Override
    public SortedSet<V> headSet(V toElement) {
        return subSet(null, toElement);
    }

    @Override
    public SortedSet<V> tailSet(V fromElement) {
        return subSet(fromElement, null);
    }

    @Override
    public V first() {
        V res = list.getValue(0);
        if (res == null) {
            throw new NoSuchElementException();
        }
        return res;
    }

    @Override
    public V last() {
        V res = list.getValue(-1);
        if (res == null) {
            throw new NoSuchElementException();
        }
        return res;
    }

    private String getComparatorKeyName() {
        return "redisson_sortedset_comparator:{" + getRawName() + "}";
    }

    private String getComparatorInstanceKeyName() {
        return "redisson_sortedset_comparator_instance:{" + getRawName() + "}";
    }

    @Override
    public boolean trySetComparator(Comparator<? super V> comparator) {
        String className = comparator.getClass().getName();
        final String comparatorSign = className + ":" + calcClassSign(className);
        Boolean res = commandExecutor.get(commandExecutor.evalWriteAsync(getRawName(), StringCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
                "if redis.call('llen', KEYS[1]) == 0 then "
                + "redis.call('set', KEYS[2], ARGV[1]); "
                + "return 1; "
                + "else "
                + "return 0; "
                + "end",
                Arrays.<Object>asList(getRawName(), getComparatorKeyName()), comparatorSign));
        if (res) {
            this.comparator = comparator;
            if(comparator instanceof Serializable){
                comparatorInstance.set(comparator);
            }
        }
        return res;
    }

    @Override
    public Iterator<V> distributedIterator(final int count) {
        String iteratorName = "__redisson_sorted_set_cursor_{" + getRawName() + "}";
        return distributedIterator(iteratorName, count);
    }

    @Override
    public Iterator<V> distributedIterator(final String iteratorName, final int count) {
        return new RedissonBaseIterator<V>() {

            @Override
            protected ScanResult<Object> iterator(RedisClient client, long nextIterPos) {
                return distributedScanIterator(iteratorName, count);
            }

            @Override
            protected void remove(Object value) {
                RedissonSortedSet.this.remove((V) value);
            }
        };
    }

    private ScanResult<Object> distributedScanIterator(String iteratorName, int count) {
        return get(distributedScanIteratorAsync(iteratorName, count));
    }

    private RFuture<ScanResult<Object>> distributedScanIteratorAsync(String iteratorName, int count) {
        return commandExecutor.evalWriteAsync(getRawName(), codec, EVAL_LIST_SCAN,
                "local start_index = redis.call('get', KEYS[2]); "
                + "if start_index ~= false then "
                    + "start_index = tonumber(start_index); "
                + "else "
                    + "start_index = 0;"
                + "end;"
                + "if start_index == -1 then "
                    + "return {0, {}}; "
                + "end;"
                + "local end_index = start_index + ARGV[1];"
                + "local result; "
                + "result = redis.call('lrange', KEYS[1], start_index, end_index - 1); "
                + "if end_index > redis.call('llen', KEYS[1]) then "
                    + "end_index = -1;"
                + "end; "
                + "redis.call('setex', KEYS[2], 3600, end_index);"
                + "return {end_index, result};",
                Arrays.<Object>asList(getRawName(), iteratorName), count);
    }

    // TODO optimize: get three values each time instead of single
    public BinarySearchResult<V> binarySearch(V value, Codec codec) {
        int size = list.size();
        int upperIndex = size - 1;
        int lowerIndex = 0;
        while (lowerIndex <= upperIndex) {
            int index = lowerIndex + (upperIndex - lowerIndex) / 2;

            V res = list.getValue(index);
            if (res == null) {
                return new BinarySearchResult<V>();
            }
            int cmp = comparator.compare(value, res);

            if (cmp == 0) {
                BinarySearchResult<V> indexRes = new BinarySearchResult<V>();
                indexRes.setIndex(index);
                return indexRes;
            } else if (cmp < 0) {
                upperIndex = index - 1;
            } else {
                lowerIndex = index + 1;
            }
        }

        BinarySearchResult<V> indexRes = new BinarySearchResult<V>();
        indexRes.setIndex(-(lowerIndex + 1));
        return indexRes;
    }

    @SuppressWarnings("AvoidInlineConditionals")
    public String toString() {
        Iterator<V> it = iterator();
        if (! it.hasNext())
            return "[]";

        StringBuilder sb = new StringBuilder();
        sb.append('[');
        for (;;) {
            V e = it.next();
            sb.append(e == this ? "(this Collection)" : e);
            if (! it.hasNext())
                return sb.append(']').toString();
            sb.append(',').append(' ');
        }
    }

}


```


## 测试验证

- 1、下载`Redisson 3.16.8`的源码到本地
- 2、将源码导入项目
- 3、按照上面的修改方案修改代码
- 4、修改`Redisson `的版本号为`3.16.9-SNAPSHOT`
- 5、执行`install -Dpmd.skip=true -Dcheckstyle.skip=true -f pom.xml`命令安装到本地
- 6、替换项目的导入的`Redisson`
```xml
		<!-- https://mvnrepository.com/artifact/org.redisson/redisson -->
        <dependency>
            <groupId>org.redisson</groupId>
            <artifactId>redisson</artifactId>
            <version>3.16.9-SNAPSHOT</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.redisson/redisson-spring-boot-starter -->
        <dependency>
            <groupId>org.redisson</groupId>
            <artifactId>redisson-spring-boot-starter</artifactId>
            <version>3.16.8</version>
            <exclusions>
                <exclusion>
                    <artifactId>redisson</artifactId>
                    <groupId>org.redisson</groupId>
                </exclusion>
            </exclusions>
        </dependency>
```

- 7、 重新执行测试代码


