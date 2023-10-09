---
layout: post
title:  "Java Websocket 的使用"
categories: ['Websocket','java']
tags: ['Websocket','java']
author: Feiyizhan
description: Java Websocket 的使用
issueId: 2018-2-6 Java Websocket
---
* TOC
{:toc}

# Java Websocket 


## 简介

目前主流的Java webscoket有两个，j2ee websocket, java-websocket。
github:[github](https://github.com/Feiyizhan/pluto.maven.websocket.git)



## j2ee websocket
Server端可以运行在服务端，支持web容器启动


### Server端

POM.xml :
Server端只需要一个依赖就可以
```xml
		<dependency>
			<groupId>javax.websocket</groupId>
			<artifactId>javax.websocket-api</artifactId>
			<version>1.1</version>
		</dependency>
```

java 源码：
```java
import java.io.IOException;
import java.util.concurrent.CopyOnWriteArraySet;
 
import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.ServerEndpoint;
 

/**
 * J2ee webscoket 版本 Server端
 *   
 *
 */
//该注解用来指定一个URI，客户端可以通过这个URI来连接到WebSocket。类似Servlet的注解mapping。无需在web.xml中配置。
@ServerEndpoint("/chat")
public class MyWebSocket {
    //静态变量，用来记录当前在线连接数。应该把它设计成线程安全的。
    private static int onlineCount = 0;
     
    //concurrent包的线程安全Set，用来存放每个客户端对应的MyWebSocket对象。若要实现服务端与单一客户端通信的话，可以使用Map来存放，其中Key可以为用户标识
    private static CopyOnWriteArraySet<MyWebSocket> webSocketSet = new CopyOnWriteArraySet<MyWebSocket>();
     
    //与某个客户端的连接会话，需要通过它来给客户端发送数据
    private Session session;
     
    /**
     * 连接建立成功调用的方法
     * @param session  可选的参数。session为与某个客户端的连接会话，需要通过它来给客户端发送数据
     */
    @OnOpen
    public void onOpen(Session session){
        this.session = session;
        webSocketSet.add(this);     //加入set中
        addOnlineCount();           //在线数加1
        System.out.println("有新连接加入！当前在线人数为" + getOnlineCount());
    }
     
    /**
     * 连接关闭调用的方法
     */
    @OnClose
    public void onClose(){
        webSocketSet.remove(this);  //从set中删除
        subOnlineCount();           //在线数减1    
        System.out.println("有一连接关闭！当前在线人数为" + getOnlineCount());
    }
     
    /**
     * 收到客户端消息后调用的方法
     * @param message 客户端发送过来的消息
     * @param session 可选的参数
     */
    @OnMessage
    public void onMessage(String message, Session session) {
        System.out.println("来自客户端的消息:" + message);
         
        //群发消息
        for(MyWebSocket item: webSocketSet){             
            try {
                item.sendMessage(message);
            } catch (IOException e) {
                e.printStackTrace();
                continue;
            }
        }
    }
     
    /**
     * 发生错误时调用
     * @param session
     * @param error
     */
    @OnError
    public void onError(Session session, Throwable error){
        System.out.println("发生错误");
        error.printStackTrace();
    }
     
    /**
     * 这个方法与上面几个方法不一样。没有用注解，是根据自己需要添加的方法。
     * @param message
     * @throws IOException
     */
    public void sendMessage(String message) throws IOException{
        this.session.getBasicRemote().sendText(message);
        //this.session.getAsyncRemote().sendText(message);
    }
 
    public static synchronized int getOnlineCount() {
        return onlineCount;
    }
 
    public static synchronized void addOnlineCount() {
        MyWebSocket.onlineCount++;
    }
     
    public static synchronized void subOnlineCount() {
        MyWebSocket.onlineCount--;
    }
}
```

### Client :
POM.xml :
Client端需要三个依赖，其中org.glassfish.tyrus的两个依赖是第三方提供的Client的具体实现。
```xml
		<dependency>
			<groupId>javax</groupId>
			<artifactId>javaee-api</artifactId>
			<version>7.0</version>
		</dependency>
		<dependency>
			<groupId>org.glassfish.tyrus</groupId>
			<artifactId>tyrus-client</artifactId>
			<version>1.0-rc3</version>
		</dependency>
		<dependency>
			<groupId>org.glassfish.tyrus</groupId>
			<artifactId>tyrus-container-grizzly</artifactId>
			<version>1.0-rc3</version>
		</dependency>
```

java 源码：

MyClient :
```java
import java.io.IOException;
import javax.websocket.ClientEndpoint;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;

/**
 * j2ee websocket 版本
 *   
 *
 */
@ClientEndpoint
public class MyClient {
    @OnOpen
    public void onOpen(Session session) {
        System.out.println("Connected to endpoint:" + session.getBasicRemote());
        try {
            session.getBasicRemote().sendText("Hello");
        } catch (IOException ex) {
        }
    }

    @OnMessage
    public void onMessage(String message) {
        System.out.println(message);
    }

    @OnError
    public void onError(Throwable t) {
        t.printStackTrace();
    }
}



```


MyClientApp:
```java
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import javax.websocket.ContainerProvider;
import javax.websocket.DeploymentException;
import javax.websocket.Session;
import javax.websocket.WebSocketContainer;

/**
 * j2ee websocket 版本
 *   
 *
 */
public class MyClientApp {

    public Session session;

    protected void start() {

        WebSocketContainer container = ContainerProvider.getWebSocketContainer();

        String uri = "ws://localhost:8080/wsChat/chat";
        System.out.println("Connecting to" + uri);
        try {
            session = container.connectToServer(MyClient.class, URI.create(uri));
        } catch (DeploymentException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

    }

    public static void main(String args[]) {
        MyClientApp client = new MyClientApp();
        client.start();

        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String input = "";
        try {
            do {
                input = br.readLine();
                if (!input.equals("exit"))
                    client.session.getBasicRemote().sendText(input);

            } while (!input.equals("exit"));
            client.session.close();
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }
}
```

### HTML Client
```html
<html>
<head>
	<meta charset="utf-8">
	<title>WebSocket Client</title>
	<script src="http://cdn.bootcss.com/jquery/2.2.2/jquery.js"></script>

</style>
</head>
<body>
    Welcome<br/>
    <input id="text" type="text" /><button onclick="send()">Send</button>    <button onclick="closeWebSocket()">Close</button>
    <div id="message">
    </div>
  </body>
   
  <script type="text/JavaScript">
      var websocket = null;
       
      //判断当前浏览器是否支持WebSocket
      if('WebSocket' in window){
          websocket = new WebSocket("ws://localhost:8080/wsChat/chat");
      }
      else{
          alert('Not support websocket');
      }
       
      //连接发生错误的回调方法
      websocket.onerror = function(){
          setMessageInnerHTML("error");
      };
       
      //连接成功建立的回调方法
      websocket.onopen = function(event){
          setMessageInnerHTML("open");
      };
       
      //接收到消息的回调方法
      websocket.onmessage = function(){
          setMessageInnerHTML(event.data);
      };
       
      //连接关闭的回调方法
      websocket.onclose = function(){
          setMessageInnerHTML("close");
      };
       
      //监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
      window.onbeforeunload = function(){
          websocket.close();
      };
       
      //将消息显示在网页上
      function setMessageInnerHTML(innerHTML){
          document.getElementById('message').innerHTML += innerHTML + '<br/>';
      }
       
      //关闭连接
      function closeWebSocket(){
          websocket.close();
      }
       
      //发送消息
      function send(){
          var message = document.getElementById('text').value;
          websocket.send(message);
      }
  </script>
</html>
```


## java-websocket

可以指定websocket 协议版本。可以作为独立的application启动。

POM.xml :
Server 和Client端的依赖是同一个。
pom.xml
```xml
		<!-- https://mvnrepository.com/artifact/org.java-websocket/Java-WebSocket -->
		<!-- java-websocket 版本 -->
		<dependency>
			<groupId>org.java-websocket</groupId>
			<artifactId>Java-WebSocket</artifactId>
			<version>1.3.4</version>
			<scope>test</scope>
		</dependency>
```

### Server

java代码
MyWebSocketServer .java:
```java
import java.net.InetSocketAddress;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

/**
 * Jave-webscoket 版本
 *   
 *
 */
public class MyWebSocketServer extends WebSocketServer {
    //静态变量，用来记录当前在线连接数。应该把它设计成线程安全的。
    private static int onlineCount = 0;
    
    public MyWebSocketServer(int port){
        super(new InetSocketAddress(port));
    }
    

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        // TODO Auto-generated method stub
        addOnlineCount();           //在线数加1
        System.out.println("有新连接加入！当前在线人数为" + getOnlineCount());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        // TODO Auto-generated method stub
        subOnlineCount();           //在线数减1    
        System.out.println("有一连接关闭！当前在线人数为" + getOnlineCount());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        // TODO Auto-generated method stub
        System.out.println("收到消息:"+message);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        // TODO Auto-generated method stub
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        // TODO Auto-generated method stub
        System.out.println("服务启动");
    }
    public static synchronized int getOnlineCount() {
        return onlineCount;
    }
 
    public static synchronized void addOnlineCount() {
        MyWebSocketServer.onlineCount++;
    }
     
    public static synchronized void subOnlineCount() {
        MyWebSocketServer.onlineCount--;
    }
    

}
```

RunServer.java
```java
public class RunServer {

    public static void main(String[] arags){
        MyWebSocketServer server = new MyWebSocketServer(8080);
        server.start();
    }

}
```



### Client

java 代码：
```java
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

/**
 * Jave-webscoket 版本
 *   
 *
 */
public class MyWebSocketClient extends WebSocketClient {

    public MyWebSocketClient(URI serverUri) {
        super(serverUri);
        // TODO Auto-generated constructor stub
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        // TODO Auto-generated method stub
        System.out.println("open");
    }

    @Override
    public void onMessage(String message) {
        // TODO Auto-generated method stub
        System.out.println(message);
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        // TODO Auto-generated method stub
        System.out.println("close");
    }

    @Override
    public void onError(Exception ex) {
        // TODO Auto-generated method stub
        ex.printStackTrace();
    }
    
    public static void main(String[] args){
        String uri = "ws://localhost:8080/wsChat/chat";
        MyWebSocketClient client = new MyWebSocketClient(URI.create(uri));
        client.connect();
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String input = "";
        try {
            do {
                input = br.readLine();
                if (!input.equals("exit"))
                    client.send(input);

            } while (!input.equals("exit"));
            client.close();

        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }

}
```