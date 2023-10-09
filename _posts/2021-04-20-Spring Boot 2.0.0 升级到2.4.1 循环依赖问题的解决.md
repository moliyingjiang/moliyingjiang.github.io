---
layout: post
title:  "Spring Boot 2.0.0 升级到2.4.1 循环依赖问题的解决"
categories: ['Spring Boot']
tags: ['Spring Boot'] 
author: Feiyizhan
description: Spring Boot 2.0.0 升级到2.4.1 循环依赖问题的解决
issueId: 2021-04-20 Spring Boot 2.0.0 升级到2.4.1 循环依赖问题的解决

---
* TOC
{:toc}

# Spring Boot 2.0.0 升级到2.4.1 循环依赖问题的解决

## 描述
在升级Spring boot 2.0.0到2.4.1时出现了循环依赖的报错，报错内容如下：

`Error creating bean with name 'test1ServiceImpl': Bean with name 'test1ServiceImpl' has been injected into other beans [test2ServiceImpl] in its raw version as part of a circular reference, but has eventually been wrapped. This means that said other beans do not use the final version of the bean. This is often the result of over-eager type matching - consider using 'getBeanNamesForType' with the 'allowEagerInit' flag turned off, for example.`

## 分析
出问题的代码：
```java
@Service
@Log4j2
public class Test1ServiceImpl implements ITest1Service {

    @Autowired
    private ITest2Service test2Service;

    @Cacheable(cacheNames="getNameById")
    @Override public String getNameById(Integer id) {
        Integer newId = test2Service.getId();
        if(id.equals(newId)){
            return "新张三";
        }else{
            return "张三";
        }
    }

    @Override public List<String> getAllNames() {
        return null;
    }
}


@Service
@Log4j2
public class Test2ServiceImpl implements ITest2Service {
    @Autowired
    private ITest1Service test1Service;

    @Transactional
    @Override public Integer getId() {
        return new Random().nextInt(3);
    }

    @Override public List<Integer> getAllIds() {
        System.out.println(test1Service.getAllNames());
        return null;
    }
}

```

表面的问题是`Test1Service `和`Test2Service ` 的互相依赖，导致循环依赖了。实际上这种简单的循环依赖，Spring 通过多级缓存的方法已经解决了，因此正常应该不会出现该问题。

通过追踪相关的代码，发现问题的触发点是在`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#doCreateBean`的方法里，方法的源码如下：

```java
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final @Nullable Object[] args)
			throws BeanCreationException {

		// Instantiate the bean.
		BeanWrapper instanceWrapper = null;
		if (mbd.isSingleton()) {
			instanceWrapper = this.factoryBeanInstanceCache.remove(beanName);
		}
		if (instanceWrapper == null) {
			instanceWrapper = createBeanInstance(beanName, mbd, args);
		}
		final Object bean = instanceWrapper.getWrappedInstance();
		Class<?> beanType = instanceWrapper.getWrappedClass();
		if (beanType != NullBean.class) {
			mbd.resolvedTargetType = beanType;
		}

		// Allow post-processors to modify the merged bean definition.
		synchronized (mbd.postProcessingLock) {
			if (!mbd.postProcessed) {
				try {
					applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
				}
				catch (Throwable ex) {
					throw new BeanCreationException(mbd.getResourceDescription(), beanName,
							"Post-processing of merged bean definition failed", ex);
				}
				mbd.postProcessed = true;
			}
		}

		// Eagerly cache singletons to be able to resolve circular references
		// even when triggered by lifecycle interfaces like BeanFactoryAware.
		boolean earlySingletonExposure = (mbd.isSingleton() && this.allowCircularReferences &&
				isSingletonCurrentlyInCreation(beanName));
		if (earlySingletonExposure) {
			if (logger.isDebugEnabled()) {
				logger.debug("Eagerly caching bean '" + beanName +
						"' to allow for resolving potential circular references");
			}
			addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
		}

		// Initialize the bean instance.
		Object exposedObject = bean;
		try {
			populateBean(beanName, mbd, instanceWrapper);
			exposedObject = initializeBean(beanName, exposedObject, mbd);
		}
		catch (Throwable ex) {
			if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
				throw (BeanCreationException) ex;
			}
			else {
				throw new BeanCreationException(
						mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
			}
		}

		if (earlySingletonExposure) {
			Object earlySingletonReference = getSingleton(beanName, false);
			if (earlySingletonReference != null) {
				if (exposedObject == bean) {
					exposedObject = earlySingletonReference;
				}
				else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
					String[] dependentBeans = getDependentBeans(beanName);
					Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
					for (String dependentBean : dependentBeans) {
						if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
							actualDependentBeans.add(dependentBean);
						}
					}
					if (!actualDependentBeans.isEmpty()) {
						throw new BeanCurrentlyInCreationException(beanName,
								"Bean with name '" + beanName + "' has been injected into other beans [" +
								StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
								"] in its raw version as part of a circular reference, but has eventually been " +
								"wrapped. This means that said other beans do not use the final version of the " +
								"bean. This is often the result of over-eager type matching - consider using " +
								"'getBeanNamesOfType' with the 'allowEagerInit' flag turned off, for example.");
					}
				}
			}
		}

		// Register bean as disposable.
		try {
			registerDisposableBeanIfNecessary(beanName, bean, mbd);
		}
		catch (BeanDefinitionValidationException ex) {
			throw new BeanCreationException(
					mbd.getResourceDescription(), beanName, "Invalid destruction signature", ex);
		}

		return exposedObject;
	}

```

### 第一层原因


分析代码发现是`exposedObject` 和`bean`不是同一个对象导致的。

相关的代码：
```java
		//判断是否需要暴露早期对象
		if (earlySingletonExposure) {
		   //只读方法获取早期对象（false表示不存在就不创建）,从一级缓存和二级缓存获取
		   //到这一步通常bean都存在，获取到的是增强后的Bean对象
			Object earlySingletonReference = getSingleton(beanName, false);
			if (earlySingletonReference != null) {
			    //如果暴露的Bean仍是原始的Bean
				if (exposedObject == bean) {
				    //替换为增强后的Bean对象
					exposedObject = earlySingletonReference;
				}
				//如果在有增强bean后，不允许原始的Bean注入，并且bean又包含了依赖的Bean
				else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
					//获取依赖的Bean列表
					String[] dependentBeans = getDependentBeans(beanName);
					Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
					for (String dependentBean : dependentBeans) {
					    //如果依赖的Bean已创建成功
						if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
						    //增加实际依赖了的Bean
							actualDependentBeans.add(dependentBean);
						}
					}
					//如果实际依赖的Bean不为空，则抛出循环依赖的异常
					if (!actualDependentBeans.isEmpty()) {
						throw new BeanCurrentlyInCreationException(beanName,
								"Bean with name '" + beanName + "' has been injected into other beans [" +
								StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
								"] in its raw version as part of a circular reference, but has eventually been " +
								"wrapped. This means that said other beans do not use the final version of the " +
								"bean. This is often the result of over-eager type matching - consider using " +
								"'getBeanNamesOfType' with the 'allowEagerInit' flag turned off, for example.");
					}
				}
			}
		}
```

2.0.0版本版本的`org.springframework.beans.factory.support.DefaultSingletonBeanRegistry#getSingleton(java.lang.String, boolean)`代码：
```java
	protected Object getSingleton(String beanName, boolean allowEarlyReference) {
		Object singletonObject = this.singletonObjects.get(beanName);
		if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
			synchronized (this.singletonObjects) {
				singletonObject = this.earlySingletonObjects.get(beanName);
				if (singletonObject == null && allowEarlyReference) {
					ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
					if (singletonFactory != null) {
						singletonObject = singletonFactory.getObject();
						this.earlySingletonObjects.put(beanName, singletonObject);
						this.singletonFactories.remove(beanName);
					}
				}
			}
		}
		return singletonObject;
	}
```


2.4.1版本的`org.springframework.beans.factory.support.DefaultSingletonBeanRegistry#getSingleton(java.lang.String, boolean)`代码：
```java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
		// Quick check for existing instance without full singleton lock
		Object singletonObject = this.singletonObjects.get(beanName);
		if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
			singletonObject = this.earlySingletonObjects.get(beanName);
			if (singletonObject == null && allowEarlyReference) {
				synchronized (this.singletonObjects) {
					// Consistent creation of early reference within full singleton lock
					singletonObject = this.singletonObjects.get(beanName);
					if (singletonObject == null) {
						singletonObject = this.earlySingletonObjects.get(beanName);
						if (singletonObject == null) {
							ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
							if (singletonFactory != null) {
								singletonObject = singletonFactory.getObject();
								this.earlySingletonObjects.put(beanName, singletonObject);
								this.singletonFactories.remove(beanName);
							}
						}
					}
				}
			}
		}
		return singletonObject;
	}

```


### 第二层原因

进一步分析`exposedObject` 和`bean`为什么不是同一个对象？

相关代码如下：

```java

// Initialize the bean instance.
		//设置暴露的Bean为原始的Bean
		Object exposedObject = bean;
		try {
		    //完善Bean的信息，包括注入依赖的Bean, 则会递归初始化依赖 bean
			populateBean(beanName, mbd, instanceWrapper);
			//完成Bean的创建（包括增强处理）,此时返回的Bean就不是原始的Bean了，而是增强后的Bean
			exposedObject = initializeBean(beanName, exposedObject, mbd);
		}
		catch (Throwable ex) {
			if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
				throw (BeanCreationException) ex;
			}
			else {
				throw new BeanCreationException(
						mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
			}
		}

```


###  第三层原因

进一步分析`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#initializeBean(java.lang.String, java.lang.Object, org.springframework.beans.factory.support.RootBeanDefinition)` 方法为什么会返回增强后的Bean。发现是`applyBeanPostProcessorsAfterInitialization`方法返回增强后的Bean。

```java
protected Object initializeBean(String beanName, Object bean, @Nullable RootBeanDefinition mbd) {
		if (System.getSecurityManager() != null) {
			AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
				invokeAwareMethods(beanName, bean);
				return null;
			}, getAccessControlContext());
		}
		else {
			//调用 Aware 相关的方法
			invokeAwareMethods(beanName, bean);
		}

		Object wrappedBean = bean;
		if (mbd == null || !mbd.isSynthetic()) {
			// 初始化之前调用的Bean的后置处理器
			wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
		}

		try {
			invokeInitMethods(beanName, wrappedBean, mbd);
		}
		catch (Throwable ex) {
			throw new BeanCreationException(
					(mbd != null ? mbd.getResourceDescription() : null),
					beanName, "Invocation of init method failed", ex);
		}
		if (mbd == null || !mbd.isSynthetic()) {
			//在初始化之后，调用Bean的后置处理器，在这里返回的增强的Bean
			wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
		}

		return wrappedBean;
	}

```

### 第四层原因

进一步追踪`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#applyBeanPostProcessorsAfterInitialization` 方法，判断是那个后置处理器返回的增强Bean。发现是`DefaultAdvisorAutoProxyCreator`这个类的`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#postProcessAfterInitialization` 方法返回了增强的Bean。

```java
	public Object applyBeanPostProcessorsAfterInitialization(Object existingBean, String beanName)
			throws BeansException {

		Object result = existingBean;
		for (BeanPostProcessor processor : getBeanPostProcessors()) {
			//调用所有的后置处理器，对Bean进行叠加的增强处理
			Object current = processor.postProcessAfterInitialization(result, beanName);
			if (current == null) {
				return result;
			}
			result = current;
		}
		return result;
	}

```



### 第五层原因

进一步追踪`DefaultAdvisorAutoProxyCreator`类`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#postProcessAfterInitialization` 方法，发现是因为在二级缓存`earlyProxyReferences`里已经存在了相同BeanName但对象不同的Bean。导致直接返回增强后的Bean。

> 这一点在`2.0.0`版本里只判断BeanName，只要BeanName一致，就不会执行包装Bean的处理。在`2.4.1`版本里必须同时满足`BeanName`和实例对象一致才行。

`2.4.1`版本的代码：
```java
	public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) {
		if (bean != null) {
			Object cacheKey = getCacheKey(bean.getClass(), beanName);
			//移除二级缓存同名的Bean，并判断移除的Bean和当前Bean是否为同一个的Bean
			// 由于循环依赖，当前Bean已经被循环依赖的Bean给初始化到了二级缓存，且初始化到二级缓存的Bean是增强后的Bean
			//因此虽然同名的Bean存在，但Bean的实例不是同一个，因此仍然执行包装Bean并返回包装后的Bean的处理
			if (this.earlyProxyReferences.remove(cacheKey) != bean) {
			   //如果二级缓存里不存在或者存在Bean和当前Bean不是同一个对象，则执行Bean的包装操作，返回包装后的Bean
				return wrapIfNecessary(bean, beanName, cacheKey);
			}
		}
		return bean;
	}
```

`2.0.0`版本的代码：
```java

	@Override
	public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) throws BeansException {
		if (bean != null) {
			Object cacheKey = getCacheKey(bean.getClass(), beanName);
			//判断二级缓存是否存在同名的Bean
			if (!this.earlyProxyReferences.contains(cacheKey)) {
				//如果不存在，则包装Bean并返回包装后的Bean
				return wrapIfNecessary(bean, beanName, cacheKey);
			}
		}
		return bean;
	}
```


### 第六层原因

继续跟踪`test1ServiceImpl` Bean的创建流程，发现因为循环依赖，`test1ServiceImpl` 调用了两次`org.springframework.beans.factory.support.AbstractBeanFactory#doGetBean` 方法。

调用的栈如下：

```
getEarlyBeanReference:240, AbstractAutoProxyCreator (org.springframework.aop.framework.autoproxy)
getEarlyBeanReference:974, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
lambda$doCreateBean$1:602, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
getObject:-1, 393317990 (org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory$$Lambda$279)
getSingleton:194, DefaultSingletonBeanRegistry (org.springframework.beans.factory.support)
getSingleton:168, DefaultSingletonBeanRegistry (org.springframework.beans.factory.support)
doGetBean:256, AbstractBeanFactory (org.springframework.beans.factory.support) [4] -> "test1ServiceImpl"
getBean:208, AbstractBeanFactory (org.springframework.beans.factory.support)
resolveCandidate:276, DependencyDescriptor (org.springframework.beans.factory.config)
doResolveDependency:1367, DefaultListableBeanFactory (org.springframework.beans.factory.support)
resolveDependency:1287, DefaultListableBeanFactory (org.springframework.beans.factory.support)
inject:640, AutowiredAnnotationBeanPostProcessor$AutowiredFieldElement (org.springframework.beans.factory.annotation)
inject:119, InjectionMetadata (org.springframework.beans.factory.annotation)
postProcessProperties:399, AutowiredAnnotationBeanPostProcessor (org.springframework.beans.factory.annotation)
populateBean:1415, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
doCreateBean:608, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
createBean:531, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
lambda$doGetBean$0:335, AbstractBeanFactory (org.springframework.beans.factory.support)
getObject:-1, 275091441 (org.springframework.beans.factory.support.AbstractBeanFactory$$Lambda$278)
getSingleton:234, DefaultSingletonBeanRegistry (org.springframework.beans.factory.support)
doGetBean:333, AbstractBeanFactory (org.springframework.beans.factory.support) [3] -> "test2ServiceImpl"
getBean:208, AbstractBeanFactory (org.springframework.beans.factory.support)
resolveCandidate:276, DependencyDescriptor (org.springframework.beans.factory.config)
doResolveDependency:1367, DefaultListableBeanFactory (org.springframework.beans.factory.support)
resolveDependency:1287, DefaultListableBeanFactory (org.springframework.beans.factory.support)
inject:640, AutowiredAnnotationBeanPostProcessor$AutowiredFieldElement (org.springframework.beans.factory.annotation)
inject:119, InjectionMetadata (org.springframework.beans.factory.annotation)
postProcessProperties:399, AutowiredAnnotationBeanPostProcessor (org.springframework.beans.factory.annotation)
populateBean:1415, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
doCreateBean:608, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
createBean:531, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
lambda$doGetBean$0:335, AbstractBeanFactory (org.springframework.beans.factory.support)
getObject:-1, 275091441 (org.springframework.beans.factory.support.AbstractBeanFactory$$Lambda$278)
getSingleton:234, DefaultSingletonBeanRegistry (org.springframework.beans.factory.support)
doGetBean:333, AbstractBeanFactory (org.springframework.beans.factory.support) [2]  -> "test1ServiceImpl"
getBean:208, AbstractBeanFactory (org.springframework.beans.factory.support)
resolveCandidate:276, DependencyDescriptor (org.springframework.beans.factory.config)
doResolveDependency:1367, DefaultListableBeanFactory (org.springframework.beans.factory.support)
resolveDependency:1287, DefaultListableBeanFactory (org.springframework.beans.factory.support)
inject:640, AutowiredAnnotationBeanPostProcessor$AutowiredFieldElement (org.springframework.beans.factory.annotation)
inject:119, InjectionMetadata (org.springframework.beans.factory.annotation)
postProcessProperties:399, AutowiredAnnotationBeanPostProcessor (org.springframework.beans.factory.annotation)
populateBean:1415, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
doCreateBean:608, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
createBean:531, AbstractAutowireCapableBeanFactory (org.springframework.beans.factory.support)
lambda$doGetBean$0:335, AbstractBeanFactory (org.springframework.beans.factory.support)
getObject:-1, 275091441 (org.springframework.beans.factory.support.AbstractBeanFactory$$Lambda$278)
getSingleton:234, DefaultSingletonBeanRegistry (org.springframework.beans.factory.support)
doGetBean:333, AbstractBeanFactory (org.springframework.beans.factory.support) [1]  -> "testController"
getBean:208, AbstractBeanFactory (org.springframework.beans.factory.support)
preInstantiateSingletons:944, DefaultListableBeanFactory (org.springframework.beans.factory.support)
finishBeanFactoryInitialization:923, AbstractApplicationContext (org.springframework.context.support)
refresh:588, AbstractApplicationContext (org.springframework.context.support)
refresh:144, ServletWebServerApplicationContext (org.springframework.boot.web.servlet.context)
refresh:767, SpringApplication (org.springframework.boot)
refresh:759, SpringApplication (org.springframework.boot)
refreshContext:426, SpringApplication (org.springframework.boot)
run:326, SpringApplication (org.springframework.boot)
run:1309, SpringApplication (org.springframework.boot)
run:1298, SpringApplication (org.springframework.boot)
main:26, DemoApplication (com.example.demo)
invoke0:-1, NativeMethodAccessorImpl (jdk.internal.reflect)
invoke:62, NativeMethodAccessorImpl (jdk.internal.reflect)
invoke:43, DelegatingMethodAccessorImpl (jdk.internal.reflect)
invoke:564, Method (java.lang.reflect)
run:49, RestartLauncher (org.springframework.boot.devtools.restart)
```


`doGetBean`代码如下:

```java
protected <T> T doGetBean(
			String name, @Nullable Class<T> requiredType, @Nullable Object[] args, boolean typeCheckOnly)
			throws BeansException {

		String beanName = transformedBeanName(name);
		Object bean;

		// Eagerly check singleton cache for manually registered singletons.
		//第一次调用时缓存里没有Bean，因此返回null，第二次调用时，根据第一次设置的Bean的构建参数，获取构建好的Bean并放入缓存。
		Object sharedInstance = getSingleton(beanName);
		if (sharedInstance != null && args == null) {
		    //第二次调用时进入
			if (logger.isTraceEnabled()) {
				if (isSingletonCurrentlyInCreation(beanName)) {
					logger.trace("Returning eagerly cached instance of singleton bean '" + beanName +
							"' that is not fully initialized yet - a consequence of a circular reference");
				}
				else {
					logger.trace("Returning cached instance of singleton bean '" + beanName + "'");
				}
			}
			bean = getObjectForBeanInstance(sharedInstance, name, beanName, null);
		}

		else {
			//第一次调用时进入
			// Fail if we're already creating this bean instance:
			// We're assumably within a circular reference.
			if (isPrototypeCurrentlyInCreation(beanName)) {
				throw new BeanCurrentlyInCreationException(beanName);
			}

			// Check if bean definition exists in this factory.
			BeanFactory parentBeanFactory = getParentBeanFactory();
			if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
				// Not found -> check parent.
				String nameToLookup = originalBeanName(name);
				if (parentBeanFactory instanceof AbstractBeanFactory) {
					return ((AbstractBeanFactory) parentBeanFactory).doGetBean(
							nameToLookup, requiredType, args, typeCheckOnly);
				}
				else if (args != null) {
					// Delegation to parent with explicit args.
					return (T) parentBeanFactory.getBean(nameToLookup, args);
				}
				else if (requiredType != null) {
					// No args -> delegate to standard getBean method.
					return parentBeanFactory.getBean(nameToLookup, requiredType);
				}
				else {
					return (T) parentBeanFactory.getBean(nameToLookup);
				}
			}

			if (!typeCheckOnly) {
				markBeanAsCreated(beanName);
			}

			StartupStep beanCreation = this.applicationStartup.start("spring.beans.instantiate")
					.tag("beanName", name);
			try {
				if (requiredType != null) {
					beanCreation.tag("beanType", requiredType::toString);
				}
				RootBeanDefinition mbd = getMergedLocalBeanDefinition(beanName);
				checkMergedBeanDefinition(mbd, beanName, args);

				// Guarantee initialization of beans that the current bean depends on.
				String[] dependsOn = mbd.getDependsOn();
				if (dependsOn != null) {
					for (String dep : dependsOn) {
						if (isDependent(beanName, dep)) {
							throw new BeanCreationException(mbd.getResourceDescription(), beanName,
									"Circular depends-on relationship between '" + beanName + "' and '" + dep + "'");
						}
						registerDependentBean(dep, beanName);
						try {
							getBean(dep);
						}
						catch (NoSuchBeanDefinitionException ex) {
							throw new BeanCreationException(mbd.getResourceDescription(), beanName,
									"'" + beanName + "' depends on missing bean '" + dep + "'", ex);
						}
					}
				}

				// Create bean instance.
				if (mbd.isSingleton()) {
				    //第一次调用时，准备Bean的构建方法和相关的构建参数，创建Bean
					sharedInstance = getSingleton(beanName, () -> {
						try {
							return createBean(beanName, mbd, args);
						}
						catch (BeansException ex) {
							// Explicitly remove instance from singleton cache: It might have been put there
							// eagerly by the creation process, to allow for circular reference resolution.
							// Also remove any beans that received a temporary reference to the bean.
							destroySingleton(beanName);
							throw ex;
						}
					});
					bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
				}

				else if (mbd.isPrototype()) {
					// It's a prototype -> create a new instance.
					Object prototypeInstance = null;
					try {
						beforePrototypeCreation(beanName);
						prototypeInstance = createBean(beanName, mbd, args);
					}
					finally {
						afterPrototypeCreation(beanName);
					}
					bean = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
				}

				else {
					String scopeName = mbd.getScope();
					if (!StringUtils.hasLength(scopeName)) {
						throw new IllegalStateException("No scope name defined for bean ´" + beanName + "'");
					}
					Scope scope = this.scopes.get(scopeName);
					if (scope == null) {
						throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
					}
					try {
						Object scopedInstance = scope.get(beanName, () -> {
							beforePrototypeCreation(beanName);
							try {
								return createBean(beanName, mbd, args);
							}
							finally {
								afterPrototypeCreation(beanName);
							}
						});
						bean = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
					}
					catch (IllegalStateException ex) {
						throw new ScopeNotActiveException(beanName, scopeName, ex);
					}
				}
			}
			catch (BeansException ex) {
				beanCreation.tag("exception", ex.getClass().toString());
				beanCreation.tag("message", String.valueOf(ex.getMessage()));
				cleanupAfterBeanCreationFailure(beanName);
				throw ex;
			}
			finally {
				beanCreation.end();
			}
		}

		// Check if required type matches the type of the actual bean instance.
		if (requiredType != null && !requiredType.isInstance(bean)) {
			try {
				T convertedBean = getTypeConverter().convertIfNecessary(bean, requiredType);
				if (convertedBean == null) {
					throw new BeanNotOfRequiredTypeException(name, requiredType, bean.getClass());
				}
				return convertedBean;
			}
			catch (TypeMismatchException ex) {
				if (logger.isTraceEnabled()) {
					logger.trace("Failed to convert bean '" + name + "' to required type '" +
							ClassUtils.getQualifiedName(requiredType) + "'", ex);
				}
				throw new BeanNotOfRequiredTypeException(name, requiredType, bean.getClass());
			}
		}
		return (T) bean;
	}

```


### 第七层原因


跟踪第二次构建Bean时的`Spring Boot 2.0.0`和 `Spring Boot 2.4.1` 的区别，发现在调用`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#getEarlyBeanReference` 
方法时，由于`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#getEarlyBeanReference` 方法里的缓存策略不同，以及`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#postProcessAfterInitialization`f方法里判断Bean是否已缓存的策略不同，导致相同的代码在` 2.0.0` 不会发生循环依赖的问题但`2.4.1`就会出现循环依赖的问题。

`2.0.0` 版本
`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#getEarlyBeanReference` 
方法:
```java
	protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
		Object exposedObject = bean;
		if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
		    
			for (BeanPostProcessor bp : getBeanPostProcessors()) {
				if (bp instanceof SmartInstantiationAwareBeanPostProcessor) {
					SmartInstantiationAwareBeanPostProcessor ibp = (SmartInstantiationAwareBeanPostProcessor) bp;
					exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);
				}
			}
		}
		return exposedObject;
	}

```

`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#getEarlyBeanReference` 方法:

```java

	@Override
	public Object getEarlyBeanReference(Object bean, String beanName) throws BeansException {
		Object cacheKey = getCacheKey(bean.getClass(), beanName);
		if (!this.earlyProxyReferences.contains(cacheKey)) {
			this.earlyProxyReferences.add(cacheKey);
		}
		return wrapIfNecessary(bean, beanName, cacheKey);
	}
```

`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#postProcessAfterInitialization`方法:

```java
	public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) throws BeansException {
		if (bean != null) {
			Object cacheKey = getCacheKey(bean.getClass(), beanName);
			if (!this.earlyProxyReferences.contains(cacheKey)) {
				return wrapIfNecessary(bean, beanName, cacheKey);
			}
		}
		return bean;
	}
```


`2.4.1` 版本

`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#getEarlyBeanReference` 
方法:
```java
	protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
		Object exposedObject = bean;
		if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
			for (SmartInstantiationAwareBeanPostProcessor bp : getBeanPostProcessorCache().smartInstantiationAware) {
				exposedObject = bp.getEarlyBeanReference(exposedObject, beanName);
			}
		}
		return exposedObject;
	}

```

`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#getEarlyBeanReference` 方法:
```java

	@Override
	public Object getEarlyBeanReference(Object bean, String beanName) {
		Object cacheKey = getCacheKey(bean.getClass(), beanName);
		this.earlyProxyReferences.put(cacheKey, bean);
		return wrapIfNecessary(bean, beanName, cacheKey);
	}
```


`org.springframework.aop.framework.autoproxy.AbstractAutoProxyCreator#postProcessAfterInitialization`方法:

```java
	public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) {
		if (bean != null) {
			Object cacheKey = getCacheKey(bean.getClass(), beanName);
			if (this.earlyProxyReferences.remove(cacheKey) != bean) {
				return wrapIfNecessary(bean, beanName, cacheKey);
			}
		}
		return bean;
	}
```


### 最终原因

#### 在`2.0.0`时，循环依赖的Bean初始化处理的处理过程：

1、第二次初始化时，在`DefaultAdvisorAutoProxyCreator`类调用父类的`getEarlyBeanReference`方法时，完成了增强后的Bean的初始化，并加入了`DefaultAdvisorAutoProxyCreator`类的实例的`earlyProxyReferences`缓存中，缓存的是BeanName，同时将增强后的Bean的实例缓存到`DefaultSingletonBeanRegistry`的`earlySingletonObjects`中。


```java
        //根据BeanName判断Bean是否已缓存
		if (!this.earlyProxyReferences.contains(cacheKey)) {
		    //如果未缓存则缓存BeanName
			this.earlyProxyReferences.add(cacheKey);
		}
```

2、返回第一次的初始化时在`DefaultAdvisorAutoProxyCreator`类调用父类的`postProcessAfterInitialization`方法根据BeanName判断Bean是否已缓存，由于之前第二次初始化已经缓存了该BeanName。所以不会返回增强的Bean。

```java
	//根据BeanName判断Bean是否已缓存
	if (!this.earlyProxyReferences.contains(cacheKey)) {
		//如果未缓存，则返回增强后的Bean
		return wrapIfNecessary(bean, beanName, cacheKey);
	}
```

3、最后在`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#doCreateBean`的方里判断初始化后的Bean和原始的Bean是否一致时，判断结果是一致，最终返回增强后的Bean。而不会触发循环依赖的异常。

```java
// Initialize the bean instance.
		Object exposedObject = bean;
		try {
			//填充依赖的Bean
			populateBean(beanName, mbd, instanceWrapper);
			//获取初始化好的Bean
			exposedObject = initializeBean(beanName, exposedObject, mbd);
		}
		catch (Throwable ex) {
			if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
				throw (BeanCreationException) ex;
			}
			else {
				throw new BeanCreationException(
						mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
			}
		}

		if (earlySingletonExposure) {
			//获取缓存好的增强的Bean
			Object earlySingletonReference = getSingleton(beanName, false);
			if (earlySingletonReference != null) {
				if (exposedObject == bean) {
					//如果原始Bean和初始化好后的Bean一致，则返回增强后的Bean
					exposedObject = earlySingletonReference;
				}
				else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
					//否则触发循环依赖的异常
					String[] dependentBeans = getDependentBeans(beanName);
					Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
					for (String dependentBean : dependentBeans) {
						if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
							actualDependentBeans.add(dependentBean);
						}
					}
					if (!actualDependentBeans.isEmpty()) {
						throw new BeanCurrentlyInCreationException(beanName,
								"Bean with name '" + beanName + "' has been injected into other beans [" +
								StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
								"] in its raw version as part of a circular reference, but has eventually been " +
								"wrapped. This means that said other beans do not use the final version of the " +
								"bean. This is often the result of over-eager type matching - consider using " +
								"'getBeanNamesOfType' with the 'allowEagerInit' flag turned off, for example.");
					}
				}
			}
		}

```


#### 在`2.4.1`时，循环依赖的Bean初始化处理的处理过程：

1、第二次初始化时，在`DefaultAdvisorAutoProxyCreator`类调用父类的`getEarlyBeanReference`方法时，完成了增强后的Bean的初始化，并加入了`DefaultAdvisorAutoProxyCreator`类的实例的`earlyProxyReferences`缓存中，缓存的是BeanName和增强后的Bean，Bean是由`AnnotationAwareAspectJAutoProxyCreator`的实例完成增强的，同时将增强后的Bean的实例缓存到`DefaultSingletonBeanRegistry`的`earlySingletonObjects`中。


```java
       
	public Object getEarlyBeanReference(Object bean, String beanName) {
		Object cacheKey = getCacheKey(bean.getClass(), beanName);
		//不判断，直接缓存BeanName和增强后的Bean
		this.earlyProxyReferences.put(cacheKey, bean);
		return wrapIfNecessary(bean, beanName, cacheKey);
	}
```

2、返回第一次的初始化时在`DefaultAdvisorAutoProxyCreator`类调用父类的`postProcessAfterInitialization`方法根据BeanName和实例对象一起判断判断Bean是否已缓存，由于之前第二次初始化已经缓存了该BeanName和增强后的Bean的实例，虽然BeanName一致，但当前的实例和缓存的增强后的实例不是同一个实例，所以返回增强的Bean。

```java
	
	Object cacheKey = getCacheKey(bean.getClass(), beanName);
	//根据BeanName和实例对象，判断Bean是否已缓存
	if (this.earlyProxyReferences.remove(cacheKey) != bean) {
		return wrapIfNecessary(bean, beanName, cacheKey);
	}
```

3、最后在`org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#doCreateBean`的方里判断初始化后的Bean和原始的Bean是否一致时，判断结果是不一致致，最终触发循环依赖的异常。

```java
// Initialize the bean instance.
		Object exposedObject = bean;
		try {
			//填充依赖的Bean
			populateBean(beanName, mbd, instanceWrapper);
			//获取初始化好的Bean
			exposedObject = initializeBean(beanName, exposedObject, mbd);
		}
		catch (Throwable ex) {
			if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
				throw (BeanCreationException) ex;
			}
			else {
				throw new BeanCreationException(
						mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
			}
		}

		if (earlySingletonExposure) {
			//获取缓存好的增强的Bean
			Object earlySingletonReference = getSingleton(beanName, false);
			if (earlySingletonReference != null) {
				if (exposedObject == bean) {
					//如果原始Bean和初始化好后的Bean一致，则返回增强后的Bean
					exposedObject = earlySingletonReference;
				}
				else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
					//否则触发循环依赖的异常
					String[] dependentBeans = getDependentBeans(beanName);
					Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
					for (String dependentBean : dependentBeans) {
						if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
							actualDependentBeans.add(dependentBean);
						}
					}
					if (!actualDependentBeans.isEmpty()) {
						throw new BeanCurrentlyInCreationException(beanName,
								"Bean with name '" + beanName + "' has been injected into other beans [" +
								StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
								"] in its raw version as part of a circular reference, but has eventually been " +
								"wrapped. This means that said other beans do not use the final version of the " +
								"bean. This is often the result of over-eager type matching - consider using " +
								"'getBeanNamesOfType' with the 'allowEagerInit' flag turned off, for example.");
					}
				}
			}
		}

```


## 解决方案
升级`druid`版本从`1.1.9`到`1.2.5`即可。原因是`1.2.5`版本`DruidSpringAopConfiguration` 类对`DefaultAdvisorAutoProxyCreator`的自动装载的策略做了调整，默认使用Spring 来管理AOP的增强，而不是默认使用`DefaultAdvisorAutoProxyCreator`。相关代码如下:

`1.1.9`代码：
```java
    @Bean
    public DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator() {
        DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator = new DefaultAdvisorAutoProxyCreator();
        advisorAutoProxyCreator.setProxyTargetClass(true);
        return advisorAutoProxyCreator;
    }
```


`1.2.5`代码：
```java

    @Bean
    @ConditionalOnProperty(name = "spring.aop.auto",havingValue = "false")
    public DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator() {
        DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator = new DefaultAdvisorAutoProxyCreator();
        advisorAutoProxyCreator.setProxyTargetClass(true);
        return advisorAutoProxyCreator;
    }

```


## 相关各版本的比对

### Spring Boot 2.0.0.release + Druid 1.19 

没有循环依赖的问题

```
getBeanPostProcessors() = {ArrayList@6940}  size = 19
 0 = {ApplicationContextAwareProcessor@9155} 
 1 = {WebApplicationContextServletContextAwareProcessor@9156} 
 2 = {ConfigurationClassPostProcessor$ImportAwareBeanPostProcessor@9157} 
 3 = {PostProcessorRegistrationDelegate$BeanPostProcessorChecker@9158} 
 4 = {ConfigurationPropertiesBindingPostProcessor@5223} 
 5 = {InfrastructureAdvisorAutoProxyCreator@5357} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 6 = {DataSourceInitializerPostProcessor@5407} 
 7 = {AsyncAnnotationBeanPostProcessor@5318} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 8 = {MethodValidationPostProcessor@5384} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 9 = {DefaultAdvisorAutoProxyCreator@5397} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 10 = {PersistenceExceptionTranslationPostProcessor@5412} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 11 = {ObjectMapperConfigurer@5420} 
 12 = {WebServerFactoryCustomizerBeanPostProcessor@6140} 
 13 = {ErrorPageRegistrarBeanPostProcessor@6144} 
 14 = {CommonAnnotationBeanPostProcessor@5219} 
 15 = {AutowiredAnnotationBeanPostProcessor@5209} 
 16 = {RequiredAnnotationBeanPostProcessor@5213} 
 17 = {ScheduledAnnotationBeanPostProcessor@5282} 
 18 = {ApplicationListenerDetector@9159} 
```




### Spring Boot 2.4.1 + Druid 1.19 

有循环依赖的问题

```
getBeanPostProcessorCache().smartInstantiationAware = {ArrayList@9857}  size = 3
 0 = {AnnotationAwareAspectJAutoProxyCreator@5452} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 1 = {DefaultAdvisorAutoProxyCreator@5547} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 2 = {AutowiredAnnotationBeanPostProcessor@5292} 
 
 
 getBeanPostProcessors() = {AbstractBeanFactory$BeanPostProcessorCacheAwareList@7531}  size = 18
 0 = {ApplicationContextAwareProcessor@10106} 
 1 = {WebApplicationContextServletContextAwareProcessor@10111} 
 2 = {ConfigurationClassPostProcessor$ImportAwareBeanPostProcessor@10112} 
 3 = {PostProcessorRegistrationDelegate$BeanPostProcessorChecker@10113} 
 4 = {ConfigurationPropertiesBindingPostProcessor@5310} 
 5 = {AnnotationAwareAspectJAutoProxyCreator@5452} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 6 = {DataSourceInitializerPostProcessor@5557} 
 7 = {AsyncAnnotationBeanPostProcessor@5402} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 8 = {FilteredMethodValidationPostProcessor@5527} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 9 = {DefaultAdvisorAutoProxyCreator@5547} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 10 = {PersistenceExceptionTranslationPostProcessor@5564} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 11 = {ObjectMapperConfigurer@6603} 
 12 = {WebServerFactoryCustomizerBeanPostProcessor@6609} 
 13 = {ErrorPageRegistrarBeanPostProcessor@6615} 
 14 = {CommonAnnotationBeanPostProcessor@5304} 
 15 = {AutowiredAnnotationBeanPostProcessor@5292} 
 16 = {ScheduledAnnotationBeanPostProcessor@5353} 
 17 = {ApplicationListenerDetector@10114} 
```



### Spring Boot 2.4.1 + Druid 1.2.5 

没有循环依赖的问题

```
getBeanPostProcessorCache().smartInstantiationAware = {ArrayList@9840}  size = 2
 0 = {AnnotationAwareAspectJAutoProxyCreator@5451} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 1 = {AutowiredAnnotationBeanPostProcessor@5291} 
 
 
getBeanPostProcessors() = {AbstractBeanFactory$BeanPostProcessorCacheAwareList@7512}  size = 17
 0 = {ApplicationContextAwareProcessor@10069} 
 1 = {WebApplicationContextServletContextAwareProcessor@10074} 
 2 = {ConfigurationClassPostProcessor$ImportAwareBeanPostProcessor@10075} 
 3 = {PostProcessorRegistrationDelegate$BeanPostProcessorChecker@10076} 
 4 = {ConfigurationPropertiesBindingPostProcessor@5309} 
 5 = {AnnotationAwareAspectJAutoProxyCreator@5451} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 6 = {DataSourceInitializerPostProcessor@5538} 
 7 = {AsyncAnnotationBeanPostProcessor@5401} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 8 = {FilteredMethodValidationPostProcessor@5526} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 9 = {PersistenceExceptionTranslationPostProcessor@5545} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 10 = {ObjectMapperConfigurer@6579} 
 11 = {WebServerFactoryCustomizerBeanPostProcessor@6585} 
 12 = {ErrorPageRegistrarBeanPostProcessor@6591} 
 13 = {CommonAnnotationBeanPostProcessor@5303} 
 14 = {AutowiredAnnotationBeanPostProcessor@5291} 
 15 = {ScheduledAnnotationBeanPostProcessor@5352} 
 16 = {ApplicationListenerDetector@10077}  
```


### Spring Boot 2.4.1 + Druid 1.2.5  + spring.aop.auto=false

有循环依赖的问题

```
getBeanPostProcessorCache().smartInstantiationAware = {ArrayList@9756}  size = 3
 0 = {InfrastructureAdvisorAutoProxyCreator@5446} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 1 = {DefaultAdvisorAutoProxyCreator@5527} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 2 = {AutowiredAnnotationBeanPostProcessor@5288} 
 
getBeanPostProcessors() = {AbstractBeanFactory$BeanPostProcessorCacheAwareList@7457}  size = 18
 0 = {ApplicationContextAwareProcessor@9796} 
 1 = {WebApplicationContextServletContextAwareProcessor@9797} 
 2 = {ConfigurationClassPostProcessor$ImportAwareBeanPostProcessor@9798} 
 3 = {PostProcessorRegistrationDelegate$BeanPostProcessorChecker@9799} 
 4 = {ConfigurationPropertiesBindingPostProcessor@5306} 
 5 = {InfrastructureAdvisorAutoProxyCreator@5446} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 6 = {DataSourceInitializerPostProcessor@5533} 
 7 = {AsyncAnnotationBeanPostProcessor@5398} "proxyTargetClass=false; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 8 = {FilteredMethodValidationPostProcessor@5506} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 9 = {DefaultAdvisorAutoProxyCreator@5527} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 10 = {PersistenceExceptionTranslationPostProcessor@5540} "proxyTargetClass=true; optimize=false; opaque=false; exposeProxy=false; frozen=false"
 11 = {ObjectMapperConfigurer@5550} 
 12 = {WebServerFactoryCustomizerBeanPostProcessor@6522} 
 13 = {ErrorPageRegistrarBeanPostProcessor@6528} 
 14 = {CommonAnnotationBeanPostProcessor@5300} 
 15 = {AutowiredAnnotationBeanPostProcessor@5288} 
 16 = {ScheduledAnnotationBeanPostProcessor@5349} 
 17 = {ApplicationListenerDetector@9800}   
 
```


## 总结

Spring在处理循环依赖的Bean时，由`AnnotationAwareAspectJAutoProxyCreator`类完成Bean的增强，但`AnnotationAwareAspectJAutoProxyCreator`类本身缓存的是原始的Bean，而如果`AnnotationAwareAspectJAutoProxyCreator` 和`DefaultAdvisorAutoProxyCreator` 同时存在，并且`AnnotationAwareAspectJAutoProxyCreator`在`DefaultAdvisorAutoProxyCreator` 之前执行，就会导致`DefaultAdvisorAutoProxyCreator`缓存了被`AnnotationAwareAspectJAutoProxyCreator`增强后的Bean，也就是说Bean被增强了两次，加上`2.4.1`之后的判断是否是缓存的Bean的规则改变了，增加了判断Bean是否为同一个实例的逻辑，最终引起Bean循环依赖的异常。