---
title: 利用安卓代理为Tortoise SVN配置代理服务器
published: 2025-07-23
description: 利用安卓代理为Tortoise SVN配置代理服务器的详细介绍和使用方法
tags: ["配置"]
category: 杂谈
---

 TortoiseSVN 无法刷新，而浏览器可以访问 SVN 服务器的问题，确实是一个非常常见的现象。这通常是因为：

1. **应用程序代理设置的差异：** 您的浏览器（如 Chrome, Edge, Firefox 等）默认会遵循 Windows 系统的代理设置（也就是您刚才配置的“Internet 选项”里的代理）。但是，很多其他应用程序，尤其是开发工具、命令行工具或者一些独立的客户端，**并不会自动使用 Windows 的系统代理设置**。它们需要单独配置代理，或者有自己的代理设置逻辑。
2. **TortoiseSVN 的代理配置：** TortoiseSVN 是 Subversion 的一个 GUI 客户端，它底层使用的是 Subversion 库。Subversion 有自己的配置文件来管理代理设置，而不是依赖操作系统的全局代理。

### 如何为 TortoiseSVN 配置代理
您需要编辑 Subversion 的配置文件，通常是一个名为 `servers` 的文件。

1. **找到 Subversion 配置文件目录：**
    - 打开文件资源管理器。
    - 在地址栏输入 `%APPDATA%\Subversion` 并按回车。
    - 这会带您到 Subversion 的用户配置文件目录，通常是 `C:\Users\您的用户名\AppData\Roaming\Subversion`。
2. **编辑 **`**servers**`** 文件：**
    - 在这个目录下，您会找到一个名为 `servers` 的文件。
    - 用记事本（Notepad）或任何文本编辑器打开它。
3. **配置代理设置：**
    - 在 `servers` 文件中，找到 `[global]` 部分。如果找不到，您可以在文件末尾添加。
    - 在该部分下，添加或修改以下行来设置您的代理服务器信息：

```plain
[global]
# 如果您的Every Proxy提供的是HTTP代理，请使用以下两行
http-proxy-host = 192.168.1.3  ; 替换为Every Proxy在电脑上的IP地址
http-proxy-port = 8080         ; 替换为Every Proxy监听的端口

# 如果您的代理需要用户名和密码（Every Proxy通常不需要，但以防万一）
# http-proxy-username = your_username
# http-proxy-password = your_password

# 如果您不希望某些地址通过代理，可以在这里添加例外
# http-proxy-exceptions = localhost,127.0.0.1,*.example.com
```

    - **重要提示：**
        * `http-proxy-host` 和 `http-proxy-port` 应该填写您在 Windows 系统代理设置中填写的 Every Proxy 的 IP 地址和端口。
        * Subversion 的 `servers` 文件主要支持 **HTTP/HTTPS 代理**。如果您的 Every Proxy 提供的是 SOCKS5 代理，并且您希望 TortoiseSVN 使用 SOCKS5，那么仅通过 `servers` 文件可能无法直接实现。
4. **保存并关闭文件。**
5. **重启 TortoiseSVN：**
    - 关闭所有正在运行的 TortoiseSVN 实例（包括右键菜单）。
    - 重新打开 TortoiseSVN，尝试刷新或执行 SVN 操作。

### 关于 SOCKS5 代理的额外说明
+ **Every Proxy 的能力：** Every Proxy 通常可以同时提供 HTTP/HTTPS 代理和 SOCKS5 代理。 
    - 如果您在手机上配置 Every Proxy 时，同时开启了 HTTP/HTTPS 代理功能，并且您电脑的 Windows 系统代理设置连接的是 Every Proxy 的 HTTP 端口，那么 TortoiseSVN 也可以通过上述方法连接到这个 HTTP 代理。
    - 如果 Every Proxy **只**提供了 SOCKS5 代理，而您的公司 SVN 服务器必须通过 SOCKS5 才能访问，那么 TortoiseSVN 自身通过 `servers` 文件配置 SOCKS5 的支持是有限的。在这种情况下，您可能需要使用一个 **SOCKSifier** 软件（例如 Proxifier, SocksCap64 等）。这些软件可以在系统层面强制特定应用程序的所有网络流量都通过 SOCKS5 代理。

**建议：**

1. **首先确认 Every Proxy 是否提供了 HTTP 代理。** 如果有，直接在 `servers` 文件中配置该 HTTP 代理的 IP 和端口是最简单的方法。
2. 如果确认必须使用 SOCKS5，并且 TortoiseSVN 无法直接通过 `servers` 文件工作，再考虑使用 SOCKSifier 软件。

