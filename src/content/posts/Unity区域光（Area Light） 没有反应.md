---
title: Unity区域光（Area Light） 没有反应
published: 2025-02-09
description: Unity区域光（Area Light） 没有反应的技术原理和应用
tags: ["Unity", "渲染", "材质", "光照", "色彩"]
category: 杂谈
---

<font style="color:rgb(44, 44, 54);">确认被照射的物体是否勾选了</font>`<font style="color:rgb(44, 44, 54);">static</font>`<font style="color:rgb(44, 44, 54);">属性。</font>

<font style="color:rgb(44, 44, 54);">如果还是没有反应，可以检查</font>`<font style="color:rgb(44, 44, 54);">LightSettings</font>`<font style="color:rgb(44, 44, 54);">面板，确保已经勾选了</font>`<font style="color:rgb(44, 44, 54);">Auto Generate</font>`<font style="color:rgb(44, 44, 54);">选项。</font>

  
勾选 Static 的物体会告诉 Unity 这个物体可以用于特定的优化或功能。Static 选项下包含多个具体的静态属性，你可以单独启用它们，或者通过勾选 Static 启用所有静态属性。

Static 的具体优化作用：

1. Lightmapping（光照贴图）  
如果物体被标记为静态，Unity 会将它包括在光照贴图（Lightmap）的计算中。  
光照贴图是一种预计算的光照技术，用于烘焙全局光照、阴影等效果，使运行时无需实时计算。  
作用：  
提高性能：光照贴图的渲染开销低，适合静态场景。  
提供全局光照和间接光照：静态物体可以参与全局光的反射计算。
2. Occlusion Culling（遮挡剔除）  
静态物体会被包括在 Unity 的遮挡剔除计算中。  
遮挡剔除会自动剔除被其他物体遮挡的物体，从而减少渲染工作。  
作用：  
提高性能：避免渲染玩家不可见的物体。  
静态物体更适合参与遮挡剔除，因为它们的位置不会改变。

      但是请注意一下不要背面一剔除那么就会有些不合适的观感（

3. Batching（批处理优化）  
勾选 Static 后，静态物体可以参与以下两种批处理优化：

**Static Batching（静态批处理）：**  
静态物体会被合并为一个大网格（Mesh），减少绘制调用（Draw Calls）。  
要求：静态物体必须使用相同的材质。  
作用：  
显著减少 Draw Calls，提高性能。  
适用于数量多、变化少的静态物体。  
动态物体无法使用静态批处理，即使它们共享材质。



Navigation（导航网格计算）  
静态物体会被包括在导航网格（NavMesh）计算中。  
作用：  
如果物体是静态的，则在生成导航网格时，Unity 会将其视为障碍物，供导航 AI 使用。  
适用于地形、墙壁等不会移动的物体。  
5. **Reflection Probes（反射探针）**  
静态物体会被包括在反射探针（Reflection Probe）数据中。  
作用：  
提供更准确的反射效果。  
静态物体在反射探针中的数据是预计算的，提高性能。  
6. **Light Probes（光照探针）**  
静态物体会影响光照探针（Light Probe）的预计算。  
作用：  
静态物体可用于影响动态物体的间接光照和反射。  
提供更精确的光照环境。  
7. Off-Mesh Links（导航链接）  
如果启用 Navigation Static，静态物体可以作为导航网格的起点或终点，用于创建导航链接。  
8.** Contribute GI（参与全局光照）**  
勾选 Static 后，物体可以参与全局光照（Global Illumination）的预计算。  
作用：  
静态物体会反射全局光，为其他物体提供间接光照。  
提供更逼真的光照效果。

