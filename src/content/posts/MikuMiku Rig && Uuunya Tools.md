---
title: MikuMiku Rig && Uuunya Tools
published: 2025-05-02
description: Blender模型导入Unity的完整工作流程
category: Blender
---

虽然Rigify并没有像Unity那样的骨骼重定向功能，但是还有两个工具可以快速帮助我们将MMD 的骨骼模式调整为Rigify的模式。（因为带了控制器果然还是爽啊 直接薄纱传统k帧）

> 另：其实Blender中是有重定向骨骼并转换为新骨骼组的功能，名叫 autorig pro（付费） 但是骨骼重定向的时候只会允许出现英文字符 也就是说你还要过一遍mmd tools的翻译
>
> 5.14更新：我好像看到了一个新的叫做Bone Animation Copy Tool？
>

## Miku Miku Rig：
国人开发的转换插件，因此对于中文的适配也会更好。[https://github.com/LaoBro/Miku_Miku_Rig](https://github.com/LaoBro/Miku_Miku_Rig)

经过转换后的骨骼将会复制一份作为存在（也就是说两个都可以控制人物），并且不再接受来自VRM的动作文件转换。适合想要快速手k生草动画的时候（



## Uuunya Tools：
[https://github.com/MMD-Blender/blender_mmd_uuunyaa_tools](https://github.com/MMD-Blender/blender_mmd_uuunyaa_tools)

这是MMD Tools的更加复杂的版本，作者的原句是：mmd_uuunyaa_tools is a blender addon for adjust scenes, models and materials in concert with [UuuNyaa/blender_mmd_tools](https://github.com/UuuNyaa/blender_mmd_tools).

需要安装MMD Tools作为前置安装环境。

教程【Rigify: 导入VMD动作并修改，导出VMD，使用FBX动作】 [https://www.bilibili.com/video/BV16V4y1q7dh](https://www.bilibili.com/video/BV16V4y1q7dh/?share_source=copy_web&vd_source=b52e07b2a7f0f2a330cbc0df9dbb2a8f)

需要注意的是，虽然和MMR相比，Uuunya允许使用VRM的动作文件，但是由于某些不可抗力（其实这个插件的VRM动作文件最后也是嵌套到Rigify中去了，而Rigify的权重，IK，蒙皮等配置一般都会是有默认的配置的），会导致从VRM导入到控制器后会出现一些比例失调的问题。



看了好久还是感叹maya确实不可撼动（暂时的） 毕竟Blender可以操作的地方太多了 对于对齐工作流绝对是一大弊端

