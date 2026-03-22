---
title: Unity的Post-Processing标准（V1、V2、V3）
published: 2025-03-06
description: Unity的Post-Processing标准（V1、V2、V3）
tags: ["Unity", "Shader", "Git", "渲染", "色彩", "配置", "插件"]
category: 杂谈
---

Post Processing Stack (PPS) 是Unity引擎中的一个模块，用于管理和应用各种后处理效果到渲染的图像上。它允许开发者和艺术家在最终图像输出之前，对场景的渲染结果进行一系列的图像处理操作，从而增强视觉效果或实现特定的艺术风格。对这个专门的后处理模块，我们成为Unity Post Processing Stack（后处理堆栈），因为在这个组件中多个后处理可以按照顺序依次实现，像一个栈的存入弹出，故得名。目前根据实现方法分为V1、V2和V3.

[https://github.com/Unity-Technologies/PostProcessing?tab=readme-ov-file](https://github.com/Unity-Technologies/PostProcessing?tab=readme-ov-file)

(来自Unity Graphic项目的branch。主项目在这里[https://github.com/Unity-Technologies/Graphics](https://github.com/Unity-Technologies/Graphics)）

## PPS V1
类似于启动时的bat/Tags文件，没有明确的「配置文件」概念，所有效果都集中在脚本中控制；基本上通过直接访问 `Camera` 的组件来应用效果。优点是可以快速实现简单的效果，不用考虑override/sealed等覆写和HLSL交互实现。缺点是难以实现高级的后处理效果。

```csharp
var postProcessing = Camera.main.GetComponent<PostProcessingBehaviour>();
postProcessing.profile.bloom.enabled = true; // 启用 Bloom 效果

```

## PPS V2
是目前使用较多的后处理标准。因为Unity在PPS V2采用**模块化设计**，效果分离为独立模块，易于扩展和控制；对应的代码/模块被储存在存储在 `PostProcessingProfile` 中，便于共享和编辑 。 （如 PostProcessEffectSettings和PostProcessEffectRenderer 和Shader之间互相隔离）

核心功能是利用`PostProcessEffectSettings` 和 `PostProcessEffectRenderer`实现自定义的扩展效果。

**在 V2 中，自定义效果需要继承以下两个核心类：**

1. `**PostProcessEffectSettings**`  
用于定义自定义效果的参数和设置。
2. `**PostProcessEffectRenderer**`  
用于实现效果的渲染逻辑。

```csharp
using UnityEngine;
using UnityEngine.Rendering.PostProcessing;

// 定义自定义效果的参数
[System.Serializable]
[PostProcess(typeof(CustomEffectRenderer), PostProcessEvent.AfterStack, "Custom/CustomEffect")]
public class CustomEffect : PostProcessEffectSettings
{
    public FloatParameter intensity = new FloatParameter { value = 1.0f }; // 参数1
    public ColorParameter tint = new ColorParameter { value = Color.white }; // 参数2
}

```

```csharp
using UnityEngine;
using UnityEngine.Rendering.PostProcessing;

public class CustomEffectRenderer : PostProcessEffectRenderer<CustomEffect>
{
    public override void Render(PostProcessRenderContext context)
    {
        var sheet = context.propertySheets.Get(Shader.Find("Hidden/CustomEffectShader"));
        sheet.properties.SetFloat("_Intensity", settings.intensity);
        sheet.properties.SetColor("_Tint", settings.tint);
        
        // 应用 Shader 效果
        context.command.BlitFullscreenTriangle(context.source, context.destination, sheet, 0);
    }
}

```

#### **工作原理**
+ `PostProcessEffectSettings` 类描述了效果的配置，包括所有参数（如强度、颜色等）。
+ `PostProcessEffectRenderer` 类负责渲染这些效果，通常需要使用 Shader 实现具体的视觉效果。

[https://www.youtube.com/watch?v=ehyMwVnnnTg](https://www.youtube.com/watch?v=ehyMwVnnnTg) 讲述了如何使用V2标准实现角色描边。

## PPS V3
PPS V3将特性完全集成到 Unity 的 **URP（Universal Render Pipeline）** 和 **HDRP（High Definition Render Pipeline）**，不再作为独立插件，而是作为渲染管线的一部分。<u>后处理效果将完全通过 Volume Profile 管理</u>

 效果参数不再通过 `PostProcessVolume` 调整，而是直接访问 Volume 组件。  

```csharp
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public class URPPostProcessingExample : MonoBehaviour
{
    public Volume volume;

    void Start()
    {
        // 获取 Volume Profile 中的 Bloom 设置
        if (volume.profile.TryGet<Bloom>(out var bloom))
        {
            bloom.intensity.value = 3f; // 修改强度
        }
    }
}

```

