---
title: 为Snapdragon Profiler添加Vulkan支持
published: 2026-04-01
category: Unity相关&随记
---


![image.png](/images/posts/yuque-temp/image_00.png)


需要Vulkan SDK. 如果不安装的话, Vulkan API下, 是看不到Shader Analysis的, 甚至看不到任何的图形操作
https://docs.qualcomm.com/doc/80-71528-1/topic/Alldocs.html?product=1601111740010426&query=Vulkan#List 这里列出来了, 需要手动安装.

![image.png](/images/posts/yuque-temp/image_01.png)


https://www.vulkan.org/tools#download-these-essential-development-tools
然后在这里下载即可, 默认安装到C:\VulkanSDK\1.4.341.1

![image.png](/images/posts/yuque-temp/image_02.png)


放这里这个目录本身，不要再加 bin 子目录。
也就是截图里的这种填法：

```text
C:\VulkanSDK\1.4.341.1
```


而不是：

```text
C:\VulkanSDK\1.4.341.1\Bin
```


原因是这个字段叫 Vulkan SDK path，通常要的是 SDK 根目录。LunarG 官方文档也说明：安装 Vulkan SDK 后，系统环境变量 VULKAN_SDK 指向的是安装目录根路径，而 %VULKAN_SDK%\Bin 只是被额外加入到 PATH 里，用来找可执行文件。(vulkan.lunarg.com)
另外，LunarG 的目录结构里也明确把 Bin 说明为“64 位可执行文件和相关清单所在目录”，说明它是 SDK 根目录下面的一个子目录，不是 SDK 路径本身。(vulkan.lunarg.com)

![image.png](/images/posts/yuque-temp/image_03.png)


如果填了根目录还是不行，再检查这几个点：

```
echo %VULKAN_SDK%vulkaninfoSDK
```


如果 vulkaninfoSDK 能跑，通常说明 PC 侧 Vulkan SDK 安装是正常的。LunarG 也把 vulkaninfoSDK 列为验证安装的方法之一。(vulkan.lunarg.com)
Learn more: