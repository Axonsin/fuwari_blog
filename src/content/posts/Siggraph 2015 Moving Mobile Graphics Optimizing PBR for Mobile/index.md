---
title: SIGGRAPH 2015 Moving Mobile Graphics：Optimizing PBR for Mobile
published: 2026-07-23
description: 从数学推导到源码实现，讲清楚 URP/移动端那套「一坨」高光公式到底怎么来的、为什么这么算、和标准 Cook-Torrance 有什么区别
category: 图形学
tags: [Unity, Shader, PBR, 移动端, BRDF]
---

# 起因

在读BoatAttack的海洋 shader 的高光计算时，看到这样一段代码和注释：

```hlsl
half d = NoH * NoH * (roughness2 - 1.h) + 1.0001h;
half LoH2 = LoH * LoH;
half specularTerm = roughness2 / ((d * d) * max(0.1h, LoH2) * (roughness + 0.5h) * 4);
// 参考 Siggraph 2015 Moving Mobile Graphics 课程中的 "Optimizing PBR for Mobile"
```

这段代码几乎是 URP 内置 `DirectBRDFSpecular` 的原样搬运。

但是镜面反射(或者说高光)不是应该有 D、F、G 三项吗？怎么这里就一个除法糊在一起了？`roughness + 0.5`、`max(0.1, LoH2)`、`+ 1.0001` 又是啥

所以可以参考注释里给出的网页连接并把把公式拆开，讲清楚三件事：

1. **为什么这么算** —— 标准 Cook-Torrance 到这个近似式的完整推导；
2. **如何使用这个移动端优化建议** —— 结合 URP 源码逐行对应；
3. **和平常计算的区别** —— 它省了什么、牺牲了什么、什么场景能用。

> https://community.arm.com/c/e/40

---

# 一、标准 Cook-Torrance 镜面项

基于微表面理论的镜面 BRDF 是：

$$
f_{spec} = \frac{D(h)\;F(l,h)\;G(l,v,h)}{4\,(n\cdot l)(n\cdot v)}
$$

- **D（Normal Distribution Function，法线分布项）**：描述微表面法线朝向 $h$ 的概率密度，决定高光的形状和亮度。现代实时渲染几乎统一用 **GGX / Trowbridge-Reitz**：

$$
D_{GGX}(h) = \frac{\alpha^2}{\pi\big((n\cdot h)^2(\alpha^2-1)+1\big)^2}
$$

其中 $\alpha = roughness^2$（感知粗糙度的平方，这是 Disney BRDF或者UE 的约定）。

- **G（Geometry / Visibility，几何遮蔽项）**：描述微表面之间的自遮挡与自阴影。常和分母的 $4(n\cdot l)(n\cdot v)$ 合并成 **Visibility 项** $V$：

$$
V = \frac{G}{4(n\cdot l)(n\cdot v)}
$$

- **F（Fresnel，菲涅尔项）**：掠射角反射增强，标准用 Schlick 近似：

$$
F = F_0 + (1-F_0)(1-l\cdot h)^5
$$

老老实实算，这三项在移动端 GPU 上是相当昂贵的：一个 `pow(x,5)`、多个除法、多次点乘。所以需要**在视觉可接受的前提下把这三项塞进更少的指令里**。

---

# 二、移动端优化

这套近似的思路来源可以追溯到 the tenth planet 的「Minimalist Cook-Torrance BRDF」（URP 注释里也写http://www.thetenthplanet.de/archives/255>），将它系统化并针对移动 GPU 做了落地。核心是三步替换。

## 2.1 Visibility 项：用 $\frac{1}{L\cdot H}$ 近似

标准 Smith-GGX 的 Visibility 需要 $n\cdot l$、$n\cdot v$、开方等操作。课程采用的是 **Kelemen / Szirmay-Kalos 近似**，其结论是 Visibility 项可以近似正比于：

$$
V \approx \frac{1}{(L\cdot H)^2}
$$

这一步的物理依据是：$L\cdot H = V\cdot H$（因为 $H$ 是 $L$ 和 $V$ 的半角向量），而这个量与几何遮蔽高度相关。用它替代 $n\cdot l$、$n\cdot v$ 后，**省掉了两个点乘和一次开方**，且分母不会在掠射角处nan。

## 2.2 Fresnel 项和Visibility合并

标准 Schlick 的 $(1-l\cdot h)^5$ 需要一个五次幂。移动端优化里，**Fresnel 的角度增强被并入了 Visibility 的近似**——也就是说不再单独算 F，而是让 $\frac{1}{L\cdot H}$ 这一族项同时承担 V 和 F 的角度响应。

> 这里说的是**高光的角度形状项**里省掉了 pow(x,5)；$F_0$（基础反射率/镜面颜色）仍然作为 `specular` 颜色在外层相乘，并没有丢。

所以,  V·F 可以合并近似成：

$$
V \cdot F \approx \frac{1}{(L\cdot H)^2 \cdot (roughness+0.5)}
$$

而 $(roughness+0.5)$ 是给出的**经验归一化因子**，用来在整个粗糙度区间让能量大致守恒, 也就是说纯粹是拟合出来的常数.

> 依旧如果看起来是对的那就是对的

## 2.3 合并得到最终式

把 D 和 V·F 乘起来，再带上 Cook-Torrance 的 $\frac{1}{4}$：

$$
f_{spec} \approx \frac{\alpha^2}{\big((n\cdot h)^2(\alpha^2-1)+1\big)^2 \cdot (L\cdot H)^2 \cdot (roughness+0.5)\cdot 4}
$$

这正是文章开头的shader 代码：

- 分子 `roughness2` = $\alpha^2$
- `d = NoH*NoH*(roughness2-1)+1` = GGX 分母的括号项
- `d*d` = 那个平方
- `LoH2` = $(L\cdot H)^2$
- `(roughness+0.5)*4` = 经验归一化 + Cook-Torrance 的 4

三项 BRDF，最终简化为成一个乘方 + 一个除法

---

# 三、结合 URP 源码逐行对应

URP 内置的 `DirectBRDFSpecular`（`BRDF.hlsl`）就是这套公式的工业级实现，注释写得非常直白：

```hlsl
// GGX Distribution multiplied by combined approximation of Visibility and Fresnel
// BRDFspec = (D * V * F) / 4.0
// D = roughness^2 / ( NoH^2 * (roughness^2 - 1) + 1 )^2
// V * F = 1.0 / ( LoH^2 * (roughness + 0.5) )
// See "Optimizing PBR for Mobile" from Siggraph 2015 moving mobile graphics course
float d = NoH * NoH * brdfData.roughness2MinusOne + 1.00001f;
half LoH2 = LoH * LoH;
half specularTerm = brdfData.roughness2 / ((d * d) * max(0.1h, LoH2) * brdfData.normalizationTerm);
```

这里有几个值得注意的工程化细节：

## 3.1 光照无关项预计算

URP 把与光照方向无关的项提前算好，塞进 `BRDFData`：

```hlsl
outBRDFData.normalizationTerm  = outBRDFData.roughness * half(4.0) + half(2.0);
outBRDFData.roughness2MinusOne = outBRDFData.roughness2 - half(1.0);
```

注意这里的巧思：$(roughness+0.5)\times 4$ 被改写成 $roughness\times 4 + 2$。为什么？因为后者能被编译成**一条 MAD（乘加）指令**，而前者是「加法再乘法」两步。数学上完全等价，指令上省一条。

## 3.2 `+ 1.00001` 而不是 `+ 1.0`

GGX 分母的括号项理论上是 `+1.0`。但当 $roughness \to 0$（完全光滑）、$n\cdot h \to 1$ 时，`NoH*NoH*(roughness2-1)+1` 会趋近于 0，`d*d` 做分母就会**除零 / 溢出**。加一个极小偏置 `1.00001` 把分母抬离 0，避免镜面高光中心出现 NaN 亮点。海洋 shader 里写的是 `1.0001h`（偏置更大一点，因为 half 精度下需要更大的余量）。

## 3.3 `max(0.1h, LoH2)`

同理，$(L\cdot H)^2$ 在掠射角会趋近 0，直接做分母会爆。用 `max(0.1, LoH2)` 给它一个下限，等价于给高光一个「最大亮度上限」，防止边缘出现过曝的白点。

## 3.4 FP16 溢出的兜底

这是移动端最容易踩的坑，也是这段代码最「脏」的部分：

```hlsl
#if REAL_IS_HALF
    specularTerm = specularTerm - HALF_MIN;
    specularTerm = clamp(specularTerm, 0.0, 1000.0); // Prevent FP16 overflow on mobiles
#endif
```

在桌面端 `float` 下这段被跳过；但移动端 `half`（FP16）最大值只有 **65504**，而上面那个分母在极端角度可能非常小，导致 `specularTerm` 冲到几万甚至溢出成 `inf`，配合 Bloom 就会出现满屏闪烁的白点（Mali GPU 上尤其常见）。所以要 `clamp` 一个上限。

注释里还藏了个 DX 编译器的坑：`specularTerm - HALF_MIN` 是故意先减一个极小值，因为「先减再 clamp(0,...)」能骗过 DX→Metal/GLES 的字节码转换器，让它保留 `max(0,..)` 那半边——否则编译器会推断 `specularTerm` 恒非负而把下限裁剪优化掉。

---

# 四、海洋 shader 里的实际应用与差异

回到最初的海洋 shader，它基本照搬了 URP，但有两处**有意为之的偏离**，值得记录：

```hlsl
half d = NoH * NoH * (roughness2 - 1.h) + 1.0001h;          // 偏置 1.0001（而URP 是 1.00001）
half specularTerm = roughness2 / ((d * d) * max(0.1h, LoH2) * (roughness + 0.5h) * 4);
#if defined (SHADER_API_MOBILE)
    specularTerm = specularTerm - HALF_MIN;
    specularTerm = clamp(specularTerm, 0.0, 5.0);           // 上限 5.0（URP 是 1000.0）
#endif
```

| 项 | URP 原版 | 海洋 shader | 说明 |
|---|---|---|---|
| GGX 偏置 | `1.00001f` | `1.0001h` | half 精度下加大偏置，避免光滑水面高光中心 NaN |
| 归一化写法 | `roughness*4+2`（MAD） | `(roughness+0.5)*4` | 数学等价，海洋版没做 MAD 改写 |
| FP16 clamp 上限 | `1000.0` | `5.0` | **关键差异**：海面高光被强能量截断 |

第三点是重点：URP 把上限设成 1000 是为了「尽量贴近 full-float 的高光观感」；而海洋 shader 把它压到 **5.0**，是因为水面是大面积高反光平面，配合 Bloom 极易过曝闪烁，所以主动做了更激进的截断。这是**场景化的取舍**，代价是牺牲了物理正确的高动态范围高光——但对水面来说，稳定不闪比物理准确更重要。

---

# 五、和平常计算的区别，什么时候该用

最后总结一下这套近似相对标准 PBR 的取舍：

**省了什么**

- Fresnel 的 `pow(x,5)`（省 log2+exp2，约 2~4 个cycle/像素）；
- Smith Visibility 的两个点乘 + 一次开方；
- 三项独立计算合并为「一乘方一除法」。

**牺牲了什么**
- 掠射角的 Fresnel 增强只是近似，边缘高光没有标准 Schlick 那么「亮得有层次」；
- 归一化靠经验常数 `roughness+0.5`，不是严格能量守恒；
- half 精度 + clamp 会在极端角度截断高动态范围。

**什么时候用**
-  移动端 / TBDR GPU、Forward 渲染、大量像素着色——这是它的主场，URP 默认就是它；
-  水面、大面积高反光表面，配合更激进的 clamp 控制闪烁；
- 主机 / PC 的离线级画质、需要精确掠射角表现的金属材质，应回退到完整的 D·V·F 分离计算.

---

# 参考

- SIGGRAPH 2015 Moving Mobile Graphics course, "Optimizing PBR for Mobile" (ARM): <https://community.arm.com/events/1155>
- Minimalist Cook-Torrance BRDF, the tenth planet: <http://www.thetenthplanet.de/archives/255>
- URP `BRDF.hlsl` 中的 `DirectBRDFSpecular` 实现（本文源码引用来源）
