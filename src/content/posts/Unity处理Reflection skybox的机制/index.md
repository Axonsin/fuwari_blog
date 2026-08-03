---
title: Unity URP 中环境反射（Reflection / Skybox）的完整机制 —— 从 Shader 调用到底层采样
published: 2026-07-23
description: 逐行追踪 URP 的 GlossyEnvironmentReflection、CalculateIrradianceFromReflectionProbes、PerceptualRoughnessToMipmapLevel、DecodeHDREnvironment 等核心函数，理解 Skybox、Reflection Probe、自定义 Cubemap 三种反射源的优先级与采样流程
category: Unity相关&随记
---

## 起因

在项目 `SceneCausticSpecial.shader` 中，有这样一段环境反射逻辑：

```hlsl
#if defined(_ENV_REFLECTION_ON)
{
    half perceptualRoughness = 1.0 - _Smoothness;
    half3 reflectVector = reflect(-viewDirWS, normalWS);
    #if defined(_ENV_REFLECTION_CUBEMAP_OVERRIDE)
        // 路径 A：开发者手动指定一张 Cubemap
        half mip = PerceptualRoughnessToMipmapLevel(perceptualRoughness);
        half3 envSpecular = SAMPLE_TEXTURECUBE_LOD(
            _EnvReflectionCube, sampler_EnvReflectionCube, reflectVector, mip
        ).rgb;
    #else
        // 路径 B：交给 URP 内置函数自动处理
        half3 envSpecular = GlossyEnvironmentReflection(
            reflectVector, input.positionWS, perceptualRoughness, 1.0h
        );
    #endif
    color.rgb += envSpecular * _SpecularColor.rgb * _EnvReflectionIntensity;
}
#endif
```

**路径 A 很直观**：在面板给一张 Cube 贴图，我按 roughness 选 mipmap 层级直接采样。

**路径B则是使用URP自带的reflection来处理**, 

但是URP 怎么知道该去采 Skybox 还是 Reflection Probe？mipmap 怎么算？HDR 解码怎么做的？Box Projection 又是什么？

so 要从 `GlossyEnvironmentReflection` 一路追到 GPU 上的纹理采样指令。

---

## 调用链总览

```
Shader 调用:
  GlossyEnvironmentReflection(reflectVector, positionWS, perceptualRoughness, occlusion)
      │
      ▼
┌─ GlobalIllumination.hlsl ─────────────────────────────────────┐
│                                                                │
│  ① 检查 _ENVIRONMENTREFLECTIONS_OFF 关键字                    │
│     ├── 开了 → 直接返回 _GlossyEnvironmentColor（纯色Fallback） │
│     └── 没开 → 继续往下                                       │
│                                                                │
│  ② 检查 _REFLECTION_PROBE_BLENDING                            │
│     ├── 开了 → CalculateIrradianceFromReflectionProbes()       │
│     │            （支持双探针混合 + Box Projection）           │
│     └── 没开 → 直接采 unity_SpecCube0（主探针）               │
│                                                                │
│  ③ PerceptualRoughnessToMipmapLevel()                         │
│     将 [0,1] 的粗糙度映射到 mipmap 层级 [0, 6]                 │
│                                                                │
│ ④ SAMPLE_TEXTURECUBE_LOD()                                    │
│    按 (方向向量, mipmap层级) 采样 Cubemap 纹理                  │
│                                                                │
│  ⑤ DecodeHDREnvironment()                                     │
│    将 HDR 编码的纹理数据解码回线性颜色空间                      │
│                                                                │
│  ⑥ 返回结果 × occlusion（环境光遮蔽）                          │
└────────────────────────────────────────────────────────────────┘
```

下面逐层展开。

---

## 第一层：GlossyEnvironmentReflection 入口

**源码位置**：`Packages/com.unity.render-pipelines.universal/ShaderLibrary/GlobalIllumination.hlsl` 第 280~307 行

```hlsl
// 完整签名版本（带屏幕空间 UV，用于 Forward+）
half3 GlossyEnvironmentReflection(
    half3  reflectVector,          // 反射方向向量（世界空间）
    float3 positionWS,             // 像素世界坐标（用于 Box Projection）
    half   perceptualRoughness,    // 感知粗糙度 = 1 - Smoothness
    half   occlusion,              // 环境光遮蔽 (AO)
    float2 normalizedScreenSpaceUV // 屏幕空间 UV（Forward+ 探针簇用）
)
```

### 1.1 第一个分叉：_ENVIRONMENTREFLECTIONS_OFF

```hlsl
half3 GlossyEnvironmentReflection(...)
{
#if !defined(_ENVIRONMENTREFLECTIONS_OFF)
    // ... 正常反射计算 ...
    return irradiance * occlusion;
#else
    // ❌ 反射被全局关闭！直接返回一个预设的环境色
    return _GlossyEnvironmentColor.rgb * occlusion;
#endif
}
```

> **对应 Editor 操作**：URP Asset → Lighting → **Environment Reflections** → 取消勾选。
>
> 关闭后所有 Shader 里的 `GlossyEnvironmentReflection()` 都会直接返回 `_GlossyEnvironmentColor` 这个纯色 uniform，零纹理采样开销。这是全场景级别的总开关。

### 1.2 第二个分叉：_REFLECTION_PROBE_BLENDING

如果反射没被全局关掉，下一个关键判断是 **是否开启探针混合**：

```hlsl
#if defined(_REFLECTION_PROBE_BLENDING) || USE_FORWARD_PLUS
    // 路径 1：完整版 — 支持双探针混合 + Box Projection
    irradiance = CalculateIrradianceFromReflectionProbes(
        reflectVector, positionWS, perceptualRoughness, normalizedScreenSpaceUV
    );
#else
    // 路径 2：简化版 — 只采 unity_SpecCube0 一个探针
    #ifdef _REFLECTION_PROBE_BOX_PROJECTION
        reflectVector = BoxProjectedCubemapDirection(
            reflectVector, positionWS,
            unity_SpecCube0_ProbePosition, unity_SpecCube0_BoxMin, unity_SpecCube0_BoxMax
        );
    #endif
    half mip = PerceptualRoughnessToMipmapLevel(perceptualRoughness);
    half4 encodedIrradiance = SAMPLE_TEXTURECUBE_LOD(
        unity_SpecCube0, samplerunity_SpecCube0, reflectVector, mip
    );
    irradiance = DecodeHDREnvironment(encodedIrradiance, unity_SpecCube0_HDR);
#endif
return irradiance * occlusion;
```

> **对应 Editor 操作**：URP Asset → Lighting → **Reflection Probes**：
> - **Blend**（混合）：编译时定义 `_REFLECTION_PROBE_BLENDING`，走路径 1
> - **Individual Only**（仅独立）：走路径 2

---

## 第二层：CalculateIrradianceFromReflectionProbes —— 双探针混合

**源码位置**：`GlobalIllumination.hlsl` 第 175~278 行

这是最复杂的部分。URP 在运行时最多同时传 **两个** Reflection Probe 给 Shader：`unity_SpecCube0` 和 `unity_SpecCube1`。

### 2.1 核心流程

```hlsl
half3 CalculateIrradianceFromReflectionProbes(
    half3 reflectVector, float3 positionWS,
    half perceptualRoughness, float2 normalizedScreenSpaceUV)
{
    half3 irradiance = half3(0, 0, 0);
    half mip = PerceptualRoughnessToMipmapLevel(perceptualRoughness);

    // ════════════════════════════════════════
    // Step 1: 计算两个探针各自的权重
    // ════════════════════════════════════════
    half probe0Volume = CalculateProbeVolumeSqrMagnitude(
        unity_SpecCube0_BoxMin, unity_SpecCube0_BoxMax);
    half probe1Volume = CalculateProbeVolumeSqrMagnitude(
        unity_SpecCube1_BoxMin, unity_SpecCube1_BoxMax);

    half volumeDiff = probe0Volume - probe1Volume;
    float importanceSign = unity_SpecCube1_BoxMin.w; // 引擎写入的重要性标志

    // 判断哪个探针"占主导"
    bool probe0Dominant = importanceSign > 0.0f ||
        (importanceSign == 0.0f && volumeDiff < -0.0001h);
    bool probe1Dominant = importanceSign < 0.0f ||
        (importanceSign == 0.0f && volumeDiff > 0.0001h);

    // 基于位置计算每个探针的影响范围权重
    float desiredWeightProbe0 = CalculateProbeWeight(
        positionWS, unity_SpecCube0_BoxMin, unity_SpecCube0_BoxMax);
    float desiredWeightProbe1 = CalculateProbeWeight(
        positionWS, unity_SpecCube1_BoxMin, unity_SpecCube1_BoxMax);

    // 如果对方占主导，压制自己的权重（两者之和不超过 1）
    float weightProbe0 = probe1Dominant
        ? min(desiredWeightProbe0, 1.0f - desiredWeightProbe1)
        :  desiredWeightProbe0;
    float weightProbe1 = probe0Dominant
        ? min(desiredWeightProbe1, 1.0f - desiredWeightProbe0)
        :  desiredWeightProbe1;

    // ... 采样两个探针并按权重混合 ...

    // ════════════════════════════════════════
    // Step 2: 如果两个探针权重都不够 0.99，
    //         剩余权重交给 Skybox（Fallback）
    // ════════════════════════════════════════
    if (totalWeight < 0.99f)
    {
        half4 encodedIrradiance = SAMPLE_TEXTURECUBE_LOD(
            _GlossyEnvironmentCubeMap, sampler_GlossyEnvironmentCubeMap,
            reflectVector, mip
        );
        irradiance += (1.0f - totalWeight) *
            DecodeHDREnvironment(encodedIrradiance, _GlossyEnvironmentCubeMap_HDR);
    }
    return irradiance;
}
```

### 2.2 权重计算：CalculateProbeWeight

```hlsl
// GlobalIllumination.hlsl 第 162~167 行
float CalculateProbeWeight(float3 positionWS, float4 probeBoxMin, float4 probeBoxMax)
{
    float blendDistance = probeBoxMax.w;  // 探针的 Blend Distance
    float3 weightDir = min(
        positionWS - probeBoxMin.xyz,
        probeBoxMax.xyz - positionWS
    ) / blendDistance;
    return saturate(min(weightDir.x, min(weightDir.y, weightDir.z)));
}
```

**含义**：对每个轴向，计算像素位置到探针影响盒边界的距离，除以 Blend Distance 归一化。取三个轴的最小值作为最终权重。

- 像素在探针中心 → weight ≈ 1.0
- 像素在边界外 → weight 渐变到 0
- **Blend Distance 越大，过渡越柔和**

### 2.3 Box Projection（盒子投影）

这是 Reflection Probe 最关键的特性之一：

```hlsl
// GlobalIllumination.hlsl 第 141~160 行
half3 BoxProjectedCubemapDirection(
    half3 reflectionWS,      // 原始反射方向
    float3 positionWS,        // 像素世界坐标
    float4 cubemapPositionWS, // 探针位置 (.w > 0 表示启用 Box Projection)
    float4 boxMin,            // 影响盒最小角
    float4 boxMax)            // 影响盒最大角
{
    if (cubemapPositionWS.w > 0.0f)  // 启用了 Box Projection？
    {
        // 沿反射方向找到与盒子的交点
        float3 boxMinMax = (reflectionWS > 0.0f) ? boxMax.xyz : boxMin.xyz;
        half3 rbMinMax = half3(boxMinMax - positionWS) / reflectionWS;

        // 取最近交点的距离
        half fa = half(min(min(rbMinMax.x, rbMinMax.y), rbMinMax.z));

        // 修正后的反射方向 = 从探针位置指向交点的方向
        half3 worldPos = half3(positionWS - cubemapPositionWS.xyz);
        return worldPos + reflectionWS * fa;
    }
    else
    {
        return reflectionWS;  // 未启用，原样返回
    }
}
```

**为什么需要这个？**

普通 Cubemap 假设反射来自"无限远"（像天空）。但室内场景中，墙面就在你旁边——如果你站在房间中央看地板反射，反射光线应该打到墙上而不是穿墙看到天空。

Box Projection 通过把反射方向"折弯"到探针的包围盒内来模拟这个效果：

```
无 Box Projection:          有 Box Projection:

   天空 ☀️                     ┌─── 墙 ───┐
    \  |                        │         │
     \ |    Cubemap             │  折弯!   │
      \|    在无穷远            │    ↘     │
       V                        │     ● ← 采样方向
   (反射穿到天空去了)            └─────────┘
```

> **对应 Editor 操作**：Reflection Probe 组件 → **Box Projection** 勾选（默认对于 **Realtime** 类型的探针自动启用）。

---

## 第三层：PerceptualRoughnessToMipmapLevel —— 粗糙度转 Mipmap

**源码位置**：`Packages/com.unity.render-pipelines.core/ShaderLibrary/ImageBasedLighting.hlsl` 第 27~37 行

```hlsl
// 非线性映射：感知粗糙度 → Mipmap 层级
real PerceptualRoughnessToMipmapLevel(real perceptualRoughness, uint maxMipLevel)
{
    // ① 先做一个非线性重映射
    perceptualRoughness = perceptualRoughness * (1.7 - 0.7 * perceptualRoughness);

    // ② 再线性映射到 mipmap 层级范围
    return perceptualRoughness * maxMipLevel;
}

// 默认 maxMipLevel = 6（UNITY_SPECCUBE_LOD_STEPS）
real PerceptualRoughnessToMipmapLevel(real perceptualRoughness)
{
    return PerceptualRoughnessToMipmapLevel(perceptualRoughness, UNITY_SPECCUBE_LOD_STEPS);
}
```

### 数学分析

$$
\text{mip} = r \times (1.7 - 0.7r) \times 6
$$

其中 $r = \text{perceptualRoughness} = 1 - \text{Smoothness}$

| Smoothness | Roughness (r) | 重映射后 | Mip Level | 视觉效果 |
|---|---|---|---|---|
| **1.0** (镜面) | 0.0 | 0.0 | **0** | 采最顶层 mipmap，反射清晰锐利 |
| **0.8** | 0.2 | 0.31 | **1.86** | 轻微模糊 |
| **0.5** | 0.5 | 0.65 | **3.9** | 明显模糊 |
| **0.2** | 0.8 | 0.91 | **5.46** | 高度模糊，接近漫反射 |
| **0.0** (完全粗糙) | 1.0 | 1.0 | **6** | 采最底层 mipmap，完全弥散 |

**为什么要非线性重映射 $r(1.7 - 0.7r)$？**

因为人眼对光滑度的变化在"比较光滑"的区域更敏感。这个曲线让低粗糙度区域（高光滑度）占用更多的 mipmap 层数，高粗糙度区域被压缩——符合人的视觉感知。

> 还有一个 **精确版**（第 44~58 行）额外考虑了视角 NdotV，用于实现 **Reflection Hardening**（反射硬化），但 URP 默认用的是上面的近似版。

---

## 第四层：SAMPLE_TEXTURECUBE_LOD —— GPU 纹理采样

到了这一步，就是纯粹的 GPU 硬件操作了：

```hlsl
half4 encodedIrradiance = SAMPLE_TEXTURECUBE_LOD(
    unity_SpecCube0,        // Cubemap 纹理（由引擎绑定）
    samplerunity_SpecCube0, // 采样器状态（滤波模式等）
    reflectVector,          // 3D 方向向量
    mip                     // mipmap 层级（上一步算出来的）
);
```

**GPU 内部做了什么**：

1. 将 `reflectVector`（3D 方向向量）映射到 Cubemap 的某个面（+X/-X/+Y/-Y/+Z/-Z）
2. 在该面上做 2D UV 映射
3. 根据 `mip` 值选择对应的 mipmap 层级
4. 执行三线性滤波（Trilinear Filtering）：在相邻两层之间插值
5. 返回编码后的 HDR 颜色值

---

## 第五层：DecodeHDREnvironment —— HDR 解码

**源码位置**：`Packages/com.unity.render-pipelines.core/ShaderLibrary/EntityLighting.hlsl` 第 197~204 行

```hlsl
real3 DecodeHDREnvironment(real4 encodedIrradiance, real4 decodeInstructions)
{
    // decodeInstructions 由 CPU 端根据纹理的 HDR 编码方式填入
    // 典型值示例: (2.0, 2.2, 0, 0) 用于 RGBM 编码

    // 处理 Alpha 通道对 RGB 的影响（某些编码格式需要）
    real alpha = max(
        decodeInstructions.w * (encodedIrradiance.a - 1.0) + 1.0,
        0.0
    );

    // HDR 解码公式: multiplier × alpha^exponent × rgb
    return (decodeInstructions.x * PositivePow(alpha, decodeInstructions.y))
           * encodedIrradiance.rgb;
}
```

### 为什么需要解码？

Unity 的 Reflection Probe/Cubemap 存储的颜色值通常不是最终的线性颜色，而是经过 **HDR 编码** 压缩过的。常见编码方式：

| 编码方式 | decodeInstructions 典型值 | 说明 |
|---|---|---|
| **RGBM** | `(2.0, 2.2, 0, 0)` | 用 M（Multiplier）通道存共享指数，RGB 存尾数 |
| **RGBE** | 类似但用 E 通道 | 共享指数编码 |
| **Full HDR** | `(1.0, 1.0, 0, 0)` | 无压缩，直接存储（32-bit 浮点纹理） |

解码公式本质上是：**将压缩表示还原为真实的物理辐照度值**。

---

## 第六层：Skybox 作为最终 Fallback

回到 `CalculateIrradianceFromReflectionProbes` 的最后一段（第 263~268 行）：

```hlsl
// 如果两个 Reflection Probe 的总权重还不到 0.99
if (totalWeight < 0.99f)
{
    // 剩余权重交给 Skybox（或 Custom Environment）
    half4 encodedIrradiance = SAMPLE_TEXTURECUBE_LOD(
        _GlossyEnvironmentCubeMap,      // ← 这就是 Skybox！
        sampler_GlossyEnvironmentCubeMap,
        reflectVector, mip
    );
    irradiance += (1.0f - totalWeight) *
        DecodeHDREnvironment(encodedIrradiance, _GlossyEnvironmentCubeMap_HDR);
}
```

这就是 **Skybox 参与环境反射的方式**——它不是单独的逻辑分支，而是 **Reflection Probe 体系的 Fallback**：

```
像素位置在 Probe A 影响范围内？
  ├─ 是 → 采 Probe A（权重 wA）
  │        像素位置也在 Probe B 范围内？
  │          ├─ 是 → 采 Probe B（权重 wB），与 A 混合
  │          └─ 否 → 只用 A
  │
  └─ 否 → 总权重 < 1.0？
             ├─ 是 → 剩余 (1 - wA - wB) 的权重给 Skybox
             └─ 否（理论上不会发生）→ 全黑
```

> **对应 Editor 操作**：
> - **Window → Rendering → Lighting → Environment** → **Skybox** 设置的是 `_GlossyEnvironmentCubeMap`
> - 如果 Source 设为 **Custom**，则 `_GlossyEnvironmentCubeMap` 指向你指定的 Cubemap，而非场景 Skybox
> - URP Asset → Lighting → **Source**：
>   - `Skybox` → 使用场景设置的 Skybox 作为 Fallback
>   - `Custom` → 使用指定的 Cubemap 作为 Fallback
>   - `Probe Only` → 不设 Fallback，探针外的区域无反射

---

## 完整优先级总结

当调用 `GlossyEnvironmentReflection()` 时，URP 按以下优先级决定采哪张图：

```
优先级从高到低：
┌─────────────────────────────────────────────────────────────┐
│ 1. _ENVIRONMENTREFLECTIONS_OFF 开关                          │
│    └─ 如果开了 → 返回纯色 _GlossyEnvironmentColor，结束      │
│                                                             │
│ 2. _REFLECTION_PROBE_BLENDING 开启？                        │
│    ├─ 是 → 进入双探针混合流程                                │
│    │   ├─ 2a. unity_SpecCube0（场景中最重要的 Reflection Probe）│
│    │   ├─ 2b. unity_SpecCube1（第二重要的 Probe）            │
│    │   └─ 2c. _GlossyEnvironmentCubeMap（Skybox Fallback）   │
│    │                                                             │
│    └─ 否 → 只采 unity_SpecCube0                              │
│        （可能经过 Box Projection 修正）                       │
│                                                             │
│ 3. Shader 里手动指定 _EnvReflectionCubemapOverride           │
│    └─ 完全绕过以上所有逻辑，只采你给的 Cube 贴图              │
└─────────────────────────────────────────────────────────────┘
```

---

## 对应 Shader 代码

现在回头看这段代码就完全清晰了：

```hlsl
#if defined(_ENV_REFLECTION_CUBEMAP_OVERRIDE)
    // 【完全绕过 URP 探针系统】
    // 直接采材质槽位里绑定的 Cubemap
    half mip = PerceptualRoughnessToMipmapLevel(perceptualRoughness);
    half3 envSpecular = SAMPLE_TEXTURECUBE_LOD(
        _EnvReflectionCube, sampler_EnvReflectionCube, reflectVector, mip
    ).rgb;
    // 注意：这里没有 DecodeHDREnvironment！
    // 因为我们假设用户传入的是普通 LDR Cubemap（如一张 JPG/PNG 导入的 Skybox）
#else
    // 【走 URP 标准流程】
    // GlossyEnvironmentReflection 内部会：
    //   1. 判断是否开了 _REFLECTION_PROBE_BLENDING
    //   2. 计算 SpecCube0 / SpecCube1 的混合权重
    //   3. 必要时做 Box Projection
    //   4. 权重不足时 fallback 到 Skybox
    //   5. PerceptualRoughnessToMipmapLevel() 选 mipmap
    //   6. SAMPLE_TEXTURECUBE_LOD() 采样
    //   7. DecodeHDREnvironment() 解码 HDR
    //   8. 结果 × occlusion
    half3 envSpecular = GlossyEnvironmentReflection(
        reflectVector, input.positionWS, perceptualRoughness, 1.0h
    );
#endif
```

**两种路径的选择建议**：

| 场景 | 推荐路径 | 原因 |
|---|---|---|
| 场景中有 Reflection Probe，希望物体正确反射周围环境 | **路径 B（URP 自动）** | 自动处理探针混合、Box Projection、Skybox Fallback |
| 需要一张固定的天空/环境贴图做反射，不关心场景中的 Probe | **路径 A（自定义 Override）** | 更可控、性能更好（省去探针权重计算） |
| 室内场景，需要高质量反射 | **路径 B + Realtime Reflection Probe** | Box Projection 让室内反射正确 |
| 移动端/性能敏感 | **路径 A + 预烘焙的低分辨率 Cubemap** | 一次采样，无额外计算 |

---

## 关键 Uniform 变量速查表

这些变量由 URP 引擎在 C# 端每帧注入，在 Shader 中可以直接使用.

| 变量名 | 类型 | 来源 | 含义 |
|---|---|---|---|
| `unity_SpecCube0` | `TEXTURECUBE` | 主 Reflection Probe 的 Cubemap 纹理 |
| `samplerunity_SpecCube0` | `SAMPLER` | 主 Probe 的采样器 |
| `unity_SpecCube0_HDR` | `float4` | 主 Probe 的 HDR 解码参数 `(multiplier, exponent, 0, 0)` |
| `unity_SpecCube0_ProbePosition` | `float4` | 主 Probe 世界位置 `.w` 表示是否启用 Box Projection |
| `unity_SpecCube0_BoxMin` | `float4` | 主 Probe 影响盒最小角 `.w` 是 Blend Distance |
| `unity_SpecCube0_BoxMax` | `float4` | 主 Probe 影响盒最大角 |
| `unity_SpecCube1` ~ `unity_SpecCube1_BoxMax` | 同上 | 第二 Reflection Probe（同结构） |
| `_GlossyEnvironmentCubeMap` | `TEXTURECUBE` | Skybox / Custom Environment 的 Cubemap |
| `_GlossyEnvironmentCubeMap_HDR` | `float4` | Skybox 的 HDR 解码参数 |
| `_GlossyEnvironmentColor` | `half4` | 反射关闭时的Fallback 纯色 |

---

## 参考资料

- [URP 源码 - GlobalIllumination.hlsl](https://github.com/Unity-Technologies/UniversalRenderingExamples/blob/master/com.unity.render-pipelines.universal/ShaderLibrary/GlobalIllumination.hlsl)
- [Core RP 源码 - ImageBasedLighting.hlsl](https://github.com/Unity-Technologies/Graphics/blob/master/com.unity.render-pipelines.core/ShaderLibrary/ImageBasedLighting.hlsl)
- [Moving Frostbite to PBR - SIGGRAPH 2014](www.selfshadow.com/s2014/shading/course/)（IBL 理论基础）
- [Real Shading in Unreal Engine 4 - Brian Karis](blog.selfshadow.com/publications/s2012-shading-course/)（ Importance Sampling）
- Unity 手册 - [Reflection Probes](https://docs.unity3d.com/cn/2022.3/Manual/RefProbes.html)
- Unity 手册 - [Environment Lighting in URP](https://docs.unity3d.com/cn/6000.0/Documentation/universalrp/lighting-of-environment-lights.html)
