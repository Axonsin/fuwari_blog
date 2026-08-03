---
title: "Unity Shader 中的 prefer_hlslcc 是什么"
published: 2026-07-22
description: "解释 Unity Shader 中 #pragma prefer_hlslcc gles 的用途、适用平台，以及它和 #pragma target 的关系。"
category: 图形学
tags: [Unity, Shader, HLSL, OpenGL ES, 移动端]
lang: zh-CN
---

在一些 Unity Shader 中，尤其是为 Android 或旧版移动端项目准备的 Shader，常能看到下面这行：

```hlsl
#pragma prefer_hlslcc gles
```

它不是一个运行时开关，也不会改变材质参数或渲染效果本身；它影响的是 **Shader 的编译与转译过程**。

## 它做了什么

Unity 中编写的 Shader 通常使用 HLSL/CG 风格的语法，但不同图形 API 最终需要的着色器语言并不相同。以 OpenGL ES 为例，最终往往需要生成 GLSL ES。

`#pragma prefer_hlslcc gles` 的含义是：当 Unity 为 **OpenGL ES（GLES）** 目标编译当前 Shader 时，优先使用 **HLSLcc** 将 HLSL 代码转译为 GLSL ES。

可以把流程简单理解为：

```text
HLSL 风格 Shader 源码
        ↓
HLSLcc 转译
        ↓
GLSL ES
        ↓
OpenGL ES 驱动编译与运行
```

## 为什么需要它

不同的 HLSL 到 GLSL 转译路径，对语言特性和边界情况的处理可能不同。启用 HLSLcc 通常是为了让 GLES 平台更稳定地处理较复杂的 HLSL 写法，例如：

- 结构体、辅助函数与较复杂的函数调用；
- 条件分支、循环和一些编译器优化场景；
- 对 Shader Model 3.0 级别特性的兼容；
- 从 PC、URP 或其他项目移植到 Android/GLES 时出现的编译差异。

因此，它更多是一项 **跨平台兼容性偏好**，而不是一条“开启某种画面效果”的指令。

## 常见搭配

这条 pragma 经常和 `#pragma target` 一起出现：

```hlsl
CGPROGRAM
#pragma vertex vert
#pragma fragment frag
#pragma target 3.0
#pragma prefer_hlslcc gles

// Shader 代码……
ENDCG
```

两者职责不同：

| 指令 | 作用 |
| --- | --- |
| `#pragma target 3.0` | 指定 Shader 可使用的目标特性级别。 |
| `#pragma prefer_hlslcc gles` | 指定在 GLES 平台上优先采用 HLSLcc 转译路径。 |

`target` 决定“可以使用哪些能力”，`prefer_hlslcc` 决定“面向 GLES 时优先通过哪条路径生成 GLSL ES”。

## 它影响哪些平台

参数中的 `gles` 已经说明了作用范围：它只针对 **OpenGL ES** 相关目标，常见于 Android 的 GLES 渲染路径。

它通常不影响下列平台的编译结果：

- Direct3D；
- Metal；
- Vulkan；
- 非 GLES 的桌面 OpenGL 路径。

如果项目只使用 DirectX、Metal 或 Vulkan，保留这行通常没有副作用，但也往往不会带来实际变化。

## 什么时候该加

可以考虑添加它的情况：

1. Shader 在 Windows Editor 或 DirectX 下正常，但切换 Android/GLES 后出现编译报错、粉色材质或渲染异常；
2. 使用了复杂的自定义 HLSL，并且需要兼容较旧的 GLES 设备；
3. 移植第三方 Shader 时，原作者已经为 GLES 添加了这一兼容设置。

如果当前 Shader 已经能在目标设备上稳定编译和显示，就不必为了“优化”而特意加入它。它并不直接提高帧率；实际性能仍主要取决于 Shader 运算量、纹理采样、带宽、变体数量和设备驱动。

## 排查建议

当 GLES 平台出现问题时，可以按下面的顺序判断：

1. 先检查 `#pragma target` 是否高于目标设备和图形 API 所支持的级别；
2. 查看 Unity Console 中 GLES 相关的具体编译错误；
3. 尝试加入 `#pragma prefer_hlslcc gles`，重新构建到真机验证；
4. 若问题仍存在，再检查精度声明（`half`、`fixed`、`float`）、纹理采样宏和平台条件编译。

## 总结

`#pragma prefer_hlslcc gles` 可以理解为：**让 Unity 在编译 GLES 版本 Shader 时，优先选择 HLSLcc 这条 HLSL 到 GLSL ES 的转译路径。**

它主要服务于 Android/OpenGL ES 的兼容性。遇到“PC 正常、GLES 出错”的 Shader 时值得尝试；如果不面向 GLES，或者现有 Shader 已稳定运行，则通常无需特别处理。
