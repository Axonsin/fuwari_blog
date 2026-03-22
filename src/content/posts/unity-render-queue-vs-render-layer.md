---
title: Unity渲染队列和渲染层级的区别
published: 2025-08-05
description: Unity渲染队列和渲染层级的区别的技术原理和应用
---

## Render Queue（渲染队列）
**目的：控制渲染顺序**

+ 决定"谁先画，谁后画"
+ 主要解决透明物体混合、性能优化等问题
+ 数值越小越早渲染

```csharp
Background (1000) → Geometry (2000) → Transparent (3000) → Overlay (4000)
```

## Rendering Layers（渲染层级）
**目的：控制光照分组**

+ 决定"谁被什么光照亮"
+ 主要用于光照优化和视觉分层
+ 是位掩码，可以多选

```csharp
Light组件设置：Culling Mask = Layer 8 + Layer 10
// 这个光源只照亮Layer 8和Layer 10的物体
```

## 具体区别：
| 特性 | Render Queue | Rendering Layers |
| --- | --- | --- |
| **作用范围** | 整个渲染管线 | 光照计算 |
| **解决问题** | 渲染顺序、透明混合 | 光源分组、性能优化 |
| **设置位置** | 材质的Queue属性 | 物体的Rendering Layer Mask |
| **数值类型** | 整数（越小越早） | 位掩码（可多选） |


## 例子：
```csharp
// 同一个角色物体可以同时设置：
角色Renderer：Rendering Layer = 10    // 只被角色专用光源照亮
角色材质：Render Queue = 2050         // 在环境之后渲染，确保描边效果

// 两者互不影响，各司其职
```

简单记忆：**Rendering Layers管"灯光"，Render Queue管"顺序"**。

