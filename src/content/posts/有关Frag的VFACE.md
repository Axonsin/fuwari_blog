---
title: 有关Frag的VFACE
published: 2026-03-26
category: Unity相关&随记
---

这是 HLSL/ShaderLab（Unity HDRP/URP 里常见） 的片元着色器（fragment shader）函数签名。

```text
half4 OceanMainFrag(Varyings input, float facing : VFACE) : SV_Target
```


逐段解释：

## 1) half4 是返回值


## 2) OceanMainFrag 是函数名


随便起的名字，这里是海面（Ocean）主片元函数。

## 3) Varyings input


## 4) float facing : VFACE 是关键：VFACE 语义


### VFACE 做什么？


VFACE 是一种系统语义，用于告诉你当前像素属于三角形的正面还是背面（front face / back face）。
Unity 里常用写法（兼容一些平台差异）是把它当成“是否正面”的标记来用。

### 常见用途


```text
float isFrontFace = (facing > 0.0);float3 N = normalize(input.normalWS);N = isFrontFace ? N : -N;
```


## 5) : SV_Target 是输出语义


表示这个返回值写到渲染目标（Render Target）的颜色缓冲里（即最终像素颜色）。
这不是“某个函数内部的操作”，而是函数参数里声明了一个由 GPU 自动提供的变量：facing : VFACE。
你可以把它理解为：片元着色器额外接收了一个“这个像素当前是正面还是背面”的标记。

## 可能的坑/前提


# 为什么几乎没啥shader用这个vface?


因为 VFACE（或 Unity 里的 SV_IsFrontFace）只在少数需要“正反面区分”的场景里才真正有价值，而大多数材质默认是背面剔除（Cull Back），导致你“看不到它出场”。
下面是常见原因：

## 1) 默认背面剔除，背面根本进不了 Fragment


多数 Shader/材质是 Cull Back（剔除背面）。这样：
只有在 Cull Off（双面渲染）或 Cull Front 时，区分正反面才重要。

## 2) 很多效果不需要“双面不同处理”


常见不透明物体（墙、角色、道具）：
真正需要的通常是：纸片/树叶/布料/薄壳、海面、玻璃薄片、毛发卡片、体积壳等。

## 3) 引擎/管线已经把“两面光照”封装掉了


在 Unity HDRP/URP 里，经常有：
所以你“很少看到”，其实是因为它被藏在 include（ShaderLibrary）里了。

## 4) 跨平台/语义差异让人更倾向用更标准的写法


历史上：
在 Unity 里你会更常见到类似：

```
half4 frag(Varyings i, bool isFrontFace : SV_IsFrontFace) : SV_Target
```


而不是 float facing : VFACE。
（很多人甚至把它用宏包起来，进一步让你“看不见”。）

## 5) 性能/分支与一致性考虑


做双面时你通常会写：

## 6) 还有一条：法线翻转不一定要靠 VFACE “显式写”


有些情况下可以通过其它方式规避：

### 什么时候你反而会经常看到它？


如果你愿意，把你所在管线（URP/HDRP/内置）以及那段 Ocean shader 的 Pass 里 Cull/TwoSided 设置贴出来，我可以告诉你：这份代码用 VFACE 大概率是在做“背面法线翻转”还是“正反面两套着色”。