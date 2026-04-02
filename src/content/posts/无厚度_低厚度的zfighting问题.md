---
title: 无厚度_低厚度的zfighting问题
published: 2025-01-06
description: Blender模型导入Unity的完整工作流程
category: 图形学
---

最近在水qq群的时候遇到了一个问题：无厚度的披风zfighting问题。

好的，我们来分析一下这个关于Unity中双面材质披风Z-fighting（Z冲突，也常被称作深度冲突）的问题。

对话中的核心问题：

1. 为什么一个两面颜色不同的披风，`Cull Back` (背面剔除) 可以缓解Z-fighting？
2. Z-fighting不是精度问题吗？怎么能用剔除来解决？
3. 为什么有些角色两边颜色不同的披风就不会出现这种情况？

让我们一步步来解释。

## 理解Z-fighting
首先，我们要明白什么是Z-fighting。当两个或多个多边形（模型面片）在屏幕上的同一像素位置，并且它们的深度值（Z值，表示离摄像机的远近）非常接近甚至相同时，在光栅化阶段的ztest时，显卡就难以通过深度图来判断哪个面应该显示在前面。这会导致这些面片在该像素上交替闪烁，或者出现“缝合”一样的破碎效果，尤其在摄像机或物体移动时更为明显。这就是Z-fighting。 具体参见基本渲染管线：ztest发生在光栅化的片元着色后。

[基本渲染管线](https://www.yuque.com/shuangfeidu/txwa8w/ixp5ze7hg1infbbm)

主要原因有两个：

1. **深度缓冲精度有限**：深度缓冲区（Z-buffer）用来存储每个像素的深度值，它的精度是有限的（比如16位、24位、32位浮点数）。当物体离摄像机非常远，或者摄像机的近裁剪面（Near Clip Plane）和远裁剪面（Far Clip Plane）设置的范围过大时，深度值的精度会下降，导致原本不同深度的表面被量化到相同的深度值。 
2. **共面或几乎共面**：如果两个面片在几何上就是重叠的，或者非常非常接近，那么它们的深度值自然也会非常接近，容易引发Z-fighting。

## 为什么`Cull Back`可以缓解特定情况下的Z-fighting？
现在来解释这个情况：一个两面颜色不同的披风。

1. **双面渲染与Z-fighting**：
    - 如果这个披风是用**单个面片**（thin geometry/single-sided mesh）建模的，为了让它两面都显示不同颜色（或者都能被看见），你可能会在Shader中设置 `Cull Off`（关闭剔除）。 [[4]](https://blog.csdn.net/qq_51603875/article/details/132585634)[[5]](https://docs.unity.cn/cn/2021.2/ScriptReference/Rendering.CullMode.html)
    - 当设置为 `Cull Off` 时，同一个面片的“正面”和“背面”都会被尝试渲染。关键在于，对于一个无限薄的单个面片来说，它的“正面”和“背面”在空间中的位置是**完全相同的**。这意味着它们的深度值也是完全相同的。
    - 此时，GPU在渲染这个面片时，正面和背面都在争抢同一个像素的写入权，因为它们的深度值一样。这就直接导致了Z-fighting。
2. `Cull Back`**的作用**：
    - `Cull Back` 的意思是“剔除背面”。在Unity（以及大多数3D引擎）中，默认情况下，多边形的顶点是按特定顺序（通常是顺时针或逆时针，称为Winding Order）定义的，这个顺序决定了哪个是正面，哪个是背面。
    - 当你将剔除模式设置为 `Cull Back` 时，只有面片的正面会朝向摄像机时才会被渲染，背面则会被丢弃不渲染。 [[4]](https://blog.csdn.net/qq_51603875/article/details/132585634)[[5]](https://docs.unity.cn/cn/2021.2/ScriptReference/Rendering.CullMode.html)
    - 对于你那个单面建模的披风，如果开启了 `Cull Back`，那么当摄像机看到披风的“正面”时，只有正面被渲染；当摄像机转到能看到披风“背面”的角度时（此时原来的“正面”就成了背向摄像机的面），这个面片因为是“背面”（相对于其法线方向和剔除设置）而不会被渲染。
    - **所以，**`Cull Back`** 实际上是阻止了同一个面片的两个“虚拟”的、在同一深度的面（正面和背面）同时参与渲染竞争。它并没有改变深度缓冲区的精度，而是通过只渲染一面，直接消除了冲突的根源。**
3. **精度问题怎么能用剔除解决的？**
    - 严格来说，剔除并没有“解决”深度缓冲区的精度问题本身。深度缓冲区的精度依然是那么多。
    - 但是，对于由 `Cull Off` 导致的、**同一个几何体的正反两面在完全相同深度上竞争**所引发的Z-fighting，剔除（比如`Cull Back`或`Cull Front`）通过只允许其中一个面参与渲染，从而避免了这场“战斗”。如果只有一个参与者，自然就没有战斗了。
    - 所以，这里的“解决”更应该理解为“规避”了导致Z-fighting的特定条件。

## 为什么有些角色两边颜色不同的披风就不会出现这种情况？
这种情况通常有以下几种原因：

1. **不同的建模方式**：
    - **使用两个独立的、略微分开的面片（Shell/Double Mesh）**：最常见的做法是，披风不是一个无限薄的单面片，而是由两层略有间距的面片组成，或者是一个有实际厚度的“壳”状模型。一层代表披风的外面，另一层代表披风的内面。这两层有各自的法线方向，并且在空间上有微小的物理分离。这样，它们的深度值本身就有差异，不容易发生Z-fighting。每一层都可以使用标准的 `Cull Back`。
    - 这种情况下，你可以给外面和内面的材质分别指定不同的颜色或纹理。
2. **更高级的Shader技巧（即使是单面片）**：
    - **使用 **`VFACE`** 或 **`gl_FrontFacing`：现代Shader语言（如HLSL, GLSL）提供了一个语义（如 `VFACE` 在ShaderLab/HLSL中，或 `gl_FrontFacing` 在GLSL中），它可以在片元着色器（Fragment Shader/Pixel Shader）中判断当前正在处理的片元是属于正面还是背面。 [[7]](https://blender.stackexchange.com/questions/230199/how-do-i-get-double-sided-normals-without-adding-vertices)
    - 通过这个判断，即使设置了 `Cull Off`，也可以在同一个Shader Pass里，根据是正面还是背面，来采样不同的颜色或纹理，或者执行不同的光照计算。这样只渲染一次，但根据朝向选择不同的外观，避免了两个pass在相同深度上的竞争。
    - 例如，在Shader中可以这样写（伪代码）：

```plain
Cull Off // 关闭剔除，让两面都进入渲染管线

float4 fragment_shader(VertexOutput input, fixed facing : VFACE) : SV_Target {
    float4 color;
    if (facing > 0) { // 或者 facing > 0 对于某些平台表示正面
        color = SampleTextureForFrontFace(input.uv);
    } else {
        color = SampleTextureForBackFace(input.uv);
        // 对于背面，法线可能需要反转才能正确光照
        input.normal = -input.normal;
    }
    // ... 进行光照计算等
    return color;
}
```

3. **不同的摄像机或场景设置**：
    - 如果其他披风距离摄像机非常近，或者摄像机的近裁剪面和远裁剪面之间的范围（`far/near` ratio）设置得比较合理（比例较小），那么深度缓冲的精度在那个距离上可能足够高，即使是微小的深度差异也能被区分开。

## 总结
对于你的问题：

+ 披风很可能是用**单层非常薄的几何体**制作的。
+ 当你使用一个希望两面都显示（可能用了 `Cull Off` 或者一个强制双面渲染的Shader）的材质时，这个几何体的“正面”和“背面”在完全相同的深度上，导致Z-fighting。
+ 设置 `Cull Back` 后，只渲染了其中一面（通常是法线朝外的那一面），另一面被剔除，冲突消失，所以Z-fighting“缓解”了。但代价是，如果你的披风需要从反面看也有不同的颜色，那么 `Cull Back` 会导致反面不可见或者显示的是正面的颜色（取决于你如何处理法线和光照）。

**解决方案建议**：

1. **最佳实践：模型层面处理**
    - 如果希望披风内外两侧有不同材质且稳定显示，最好的方法是在3D建模软件中就将披风做成**两层独立的网格**，或者给予它一定的厚度。然后给内外两层分别赋予不同的材质，并都使用默认的 `Cull Back`。
2. **Shader层面处理 (如果必须用单层网格)**
    - 使用一个支持 `VFACE` (或等效功能) 的自定义Shader。在Shader中设置 `Cull Off`，然后在片元着色器中根据 `VFACE` 的值来判断是正面还是背面，并据此应用不同的颜色/纹理和光照逻辑。这样可以只用一个渲染遍（Pass）就实现双面不同材质的效果，且能有效避免Z-fighting。
3. **调整深度偏移 (Polygon Offset / Shader Offset)**
    - 在某些情况下，可以通过在Shader中对其中一个“面”（比如背面）的深度值进行微小的偏移（Polygon Offset，在Unity ShaderLab中可以用 `Offset` 命令）来尝试解决Z-fighting。但这需要小心调整，且可能在某些角度或距离下仍然出现问题或产生其他视觉瑕疵。

对话中提到的 "shadowmap" 和 "shadow acne" 是与阴影渲染相关的深度问题，虽然也和深度精度有关，但和你描述的披风自身两面Z-fighting是略有不同的问题。不过，解决Z-fighting的很多原则是相通的，即确保深度值能够被正确区分。

---

Reference:

1. [Z-Fighting - 博客](https://blog.pig1024.me/posts/616975d01225572af327c122)
2. [Z-fighting 緩和措施- Azure Remote Rendering - Learn Microsoft](https://learn.microsoft.com/zh-tw/azure/remote-rendering/overview/features/z-fighting-mitigation)
3. [Z-Fighting 权威指南 - BimAnt](http://www.bimant.com/blog/z-fighting-definitive-guide/)
4. [Unity中Shader的面剔除Cull_cull front cull back-CSDN博客](https://blog.csdn.net/qq_51603875/article/details/132585634)
5. [CullMode - Unity 脚本API](https://docs.unity.cn/cn/2021.2/ScriptReference/Rendering.CullMode.html)
6. [Unity Basics: Triangle Winding, Culling Modes & Double Sided Materials ✔️ 2020.3 | Game Dev Tutorial - YouTube](https://www.youtube.com/watch?v=3WWKHt92XKQ)
7. [How do I get double sided normals without adding vertices? - Blender Stack Exchange](https://blender.stackexchange.com/questions/230199/how-do-i-get-double-sided-normals-without-adding-vertices)
8. [Unity解决同材质物体重叠产生Z-Fighting的问题 - 稀土掘金](https://juejin.cn/post/7124879046684442632)

