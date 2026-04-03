---
title: Raw Depth, Linear Depth, Normalized Depth(归一化深度)
published: 2025-11-18
category: 渲染
---

最近在为正交相机的shader做深度适配的时候遇到了这么一段

```cpp
float RawDepthToLinear(float rawDepth)  {      #if _ORTHO_ON          float persp = LinearEyeDepth(rawDepth, _ZBufferParams);          float orthoLinearDepth = _ProjectionParams.x > 0 ? rawDepth : 1 - rawDepth;          return lerp(_ProjectionParams.y, _ProjectionParams.z, orthoLinearDepth);      #else          return LinearEyeDepth(rawDepth, _ZBufferParams);      #endif  }
```


# 作用


是一个在3D图形渲染中常用的深度值转换函数，主要用于将原始深度缓冲区中的非线性深度值转换为线性深度值。这个转换在实现各种后期处理效果、阴影计算和深度相关技术时非常重要。

## 函数功能


该函数接收一个原始深度值，根据当前使用的投影类型（正交投影或透视投影）返回对应的线性深度值。

## 工作原理


函数通过条件编译指令 #if _ORTHO_ON 区分两种投影模式：

### 1. 正交投影模式（当定义了 _ORTHO_ON 时）


### 2. 透视投影模式（默认情况）


## 变量说明


这个函数在游戏引擎（如Unity）的着色器代码中很常见，用于确保在不同投影类型下都能获得正确的线性深度值，以便进行精确的深度计算和视觉效果处理。
越靠近相机, 越接近1

# 原始深度值、线性深度值和归一化深度值的关系


## 基本概念


### 原始深度值 (Raw Depth)


### 线性深度值 (Linear Depth)


### 归一化深度值 (Normalized Device Coordinate Depth)


## 三者之间的关系


## 为什么需要转换？


在您提供的代码中，正是为了适应这两种不同的投影模式（透视/正交）而提供了不同的深度转换路径，确保在任何投影方式下都能获得正确的线性深度值。