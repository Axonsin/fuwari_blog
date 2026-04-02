---
title: 有关结构体初始化的 (Varyings)0
published: 2026-03-26
category: Unity相关&随记
---

这是 HLSL/Shader 中的结构体初始化语法。

```cpp
Varyings Vert(Attributes input){    Varyings output = (Varyings)0;    UNITY_SETUP_INSTANCE_ID(input);    UNITY_TRANSFER_INSTANCE_ID(input, output);    VertexPositionInputs vp = GetVertexPositionInputs(input.positionOS.xyz);    VertexNormalInputs vn = GetVertexNormalInputs(input.normalOS, input.tangentOS);    vp.positionWS = TransformObjectToWorld(input.positionOS.xyz);    vp.positionCS = TransformWorldToHClip(vp.positionWS);    real sign = input.tangentOS.w * GetOddNegativeScale();    output.positionCS = vp.positionCS;    output.uv = TRANSFORM_TEX(input.uv, _BaseMap);    output.positionOS = input.positionOS.xyz;    output.positionWS = vp.positionWS;    output.normalWS = vn.normalWS;    output.tangentWS = half4(vn.tangentWS, sign);    return output;}
```


(Varyings)0 的含义是：将 0 强制转换为 Varyings 结构体类型，这会将结构体的所有成员初始化为
0（或等效的默认值，如 float4 会是 (0,0,0,0)）。
为什么这样写？
// 这两种写法效果类似，但 (Varyings)0 更简洁
Varyings output = (Varyings)0;
// 等价于手动初始化每个成员为 0
Varyings output;
output.positionCS = 0;
output.uv = 0;
output.color = 0;
// ... 其他成员
常见用途：
1. 确保结构体所有字段都有确定的初始值，避免未初始化的垃圾数据
2. 防止某些字段忘记赋值导致渲染异常
3. 是 shader 编程中的惯用写法，简洁高效
这在 Unity 的 URP/HDRP shader 中非常常见，特别是顶点着色器返回 Varyings 结构体时。