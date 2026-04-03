---
title: 利用安卓代理为Tortoise SVN配置代理服务器
published: 2025-08-13
---

TortoiseSVN 无法刷新，而浏览器可以访问 SVN 服务器的问题，确实是一个非常常见的现象。这通常是因为：

### 如何为 TortoiseSVN 配置代理


您需要编辑 Subversion 的配置文件，通常是一个名为 servers 的文件。

```Plain Text
[global]# 如果您的Every Proxy提供的是HTTP代理，请使用以下两行http-proxy-host = 192.168.1.3  ; 替换为Every Proxy在电脑上的IP地址http-proxy-port = 8080         ; 替换为Every Proxy监听的端口# 如果您的代理需要用户名和密码（Every Proxy通常不需要，但以防万一）# http-proxy-username = your_username# http-proxy-password = your_password# 如果您不希望某些地址通过代理，可以在这里添加例外# http-proxy-exceptions = localhost,127.0.0.1,*.example.com
```


### 关于 SOCKS5 代理的额外说明


建议：