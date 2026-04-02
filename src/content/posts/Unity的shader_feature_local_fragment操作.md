---
title: Unity的shader_feature_local_fragment操作
published: 2026-03-26
category: Unity相关&随记
---

shader_feature_local_fragment 是 Unity Shader 中的一个 pragma 指令，它是 shader_feature_local 的更精细化版本。要理解它，可以把它拆解为三个部分：

## 拆解理解


| 部分 | 含义 |
| --- | --- |
| shader_feature | 声明一个 shader 关键字变体（keyword variant），未被任何材质引用的变体会在打包时被剔除 |
| _local | 关键字作用域为局部（local），仅限当前 shader，不占用全局关键字的有限名额 |
| _fragment | 该关键字变体仅作用于片元着色器（Fragment Shader）阶段，不会影响顶点着色器（Vertex Shader） |


## 它和 shader_feature_local 的区别


shader_feature_local 会同时为 顶点阶段和片元阶段 都生成对应的变体，而 shader_feature_local_fragment只在片元阶段生成变体。
这意味着：如果你的某个关键字（比如控制某种光照效果、颜色混合等）只在 frag 函数中使用，而在 vert 函数中完全没用到，那就可以用 _fragment 后缀来避免为顶点阶段编译不必要的变体，减少编译的 shader 变体数量，从而优化编译时间和内存占用。

## 用法示例


```Plain Text
#pragma shader_feature_local_fragment _EFFECT_ON _EFFECT_OFF// 顶点着色器 —— 不会因为上述关键字产生额外变体v2f vert(appdata v){    // ...}// 片元着色器 —— 关键字仅在此生效fixed4 frag(v2f i) : SV_Target{    fixed4 col = tex2D(_MainTex, i.uv);    #if defined(_EFFECT_ON)        col *= _TintColor; // 仅在开启时执行    #endif    return col;}
```


## 类似的后缀变体


Unity 提供了一整套类似的阶段限定后缀：
总结：shader_feature_local_fragment = 局部关键字 + 仅片元阶段生效，是一种更精细的变体控制手段，适合在关键字只影响片元着色器逻辑时使用，以减少不必要的变体编译开销。