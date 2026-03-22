---
title: 关于Da Vinci安装后无法启动的问题
published: 2025-02-24
description: 关于Da Vinci安装后无法启动的问题的解决方案和处理方法
tags: ["色彩", "故障排除", "插件"]
category: 杂谈
---

具体的情况是：在安装了20并且patch了激活证之后，不论是E盘还是C盘，**在打开Davinci都会出现在加载插件部分闪退，但是任务管理器中的后台任务仍然存活**

<font style="color:rgb(24, 25, 28);">原理：直接删掉C:\Program Files\Common Files\OFX\Plugins里面的所有插件，有可能是FilmConvert, RedGiant, iZotope之类的其中某个插件跟达芬奇有冲突，可以一个个排查，我就是整个直接删掉TopazAI插件后达芬奇就能启动了/好吧其实是直接把插件放到了另一个地方</font>

<font style="color:rgb(148, 153, 160);">  
</font>

