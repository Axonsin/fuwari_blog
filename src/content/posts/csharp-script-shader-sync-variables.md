---
title: "C#脚本和Shader中共享同步变量"
published: 2025-03-10
description: "C#脚本和Shader中共享同步变量的解决方案和处理方法"
---

这个博客的起源是我在参考其他人的思路的时候 ，日出日落的天空盒变化需要通过参考灯光向量的y轴进行lerp操作。但是Unity6中似乎无法复现，在日出日落（0.25时间，0.75时间）会出现明显的跳变现象。经过反复~~折磨~~调试发现似乎是Unity采用了投机取巧的方式。

由于我的灯光向量（Rotation）从-90开始计数，根据时间的变化逐渐加满，结果灯光向量在加到360的时候居然会直接归0？方向确实也没有什么变化，灯光的方向也是对的，但是会导致天空盒出现十分明显的跳变（跳个几帧又恢复为原来的情况）。故想到了使用时间控制系统中的Time来控制天空盒的Lerp。我现在使用的方式是 Shader.SetGlobal的方法进行变量共享 。大致原理是：

+ **C# 脚本侧**  
使用 Unity 提供的 API，例如 `Shader.SetGlobalFloat`、`Shader.SetGlobalVector` 等，将值传递给 Shader
+ **Shader 侧**  
在 Shader 中定义与 C# 脚本中对应的全局变量（如 `_TimeOfDay`），然后通过变量的值来动态控制材质的外观或渲染效果
+ **共享机制**  
通过全局变量的方式，Shader 的多个实例（材质）可以共享同一个变量值，避免逐一设置变量值的繁琐

## C#脚本侧
```csharp
public class DayNightCycle : MonoBehaviour
{
    [Header("Time Settings")]
    public float dayDuration = 120f;
    public float maxSunIntensity = 1f; 
    public float minSunIntensity = 0f; 

    [Header("Light Settings")]
    public Light sunLight; 
    public Gradient lightColor; 

    [Range(0, 1)]
    public float timeOfDay = 0f; // 首先在class中声明一个timeOfDay

    private float timeSpeed; 
    
    [Header("Bloom Settings")]
    public Volume postProcessingVolume; 
    private Bloom bloom; 
    public float maxBloomIntensity = 10f; 
    public float minBloomIntensity = 0f; 
}
```

我们先进行声明，然后进入Start中将这个变量共享：

```csharp
void Start()
    {
        // 在这里设置全局 Shader 属性
        Shader.SetGlobalFloat("_TimeOfDay", timeOfDay);
        timeSpeed = 1f / dayDuration;
        //Debug
        if (postProcessingVolume != null)
        {
           
            if (!postProcessingVolume.profile.TryGet(out bloom))
            {
                Debug.LogError("无法获取Bloom组件！请确保Volume中添加了Bloom效果。");
            }
        }
        else
        {
            Debug.LogError("未指定Post Processing Volume！");
        }
    }
```

由于时间是变化的，因此要在Update中持续进行同步：

```csharp
void Update()
    {
        // 广播时间属性，让天空盒可以根据时间变化。前面是Shader中的变量名，后面是C#的变量名
        Shader.SetGlobalFloat("_TimeOfDay", timeOfDay);
        timeOfDay += timeSpeed * Time.deltaTime;
        if (timeOfDay > 1f)
        {
            timeOfDay = 0f; 
        }
        UpdateSunRotation();
        UpdateSunColor();
        UpdateSunIntensity();
        UpdateBloomIntensity();
        //Debug
         if (bloom != null)
         {
             Debug.Log($"Bloom intensity: {bloom.intensity.value}, Time: {timeOfDay}");
         }
         else
         {
             Debug.LogWarning("Bloom is null!");
         }
    }
```

## Shader侧
在struct完appdata和v2f之后的变量声明中进行：

```cpp
float _Test, addSunandMoon, _addHorizon, _addGradient, _addCloud, _addStar, _MirrorMode;

float _SunRadius, _MoonRadius, _MoonOffset, _MoonTexScale, _MoonTexBrightness, _MoonRotation;
float _TimeOfDay;//在这里进行声明，注意要符合类型
float _MaxCloudHeight;
float4 _DayTopColor, _DayBottomColor, _NightBottomColor, _NightTopColor, _StarsSkyColor;
float4 _HorizonLightNight, _HorizonLightDay, _HorizonColorDay, _HorizonColorNight, _SunSet, _SunColor, _MoonColor;
float4 _CloudColorDayMain, _CloudColorDaySec, _CloudColorNightMain, _CloudColorNightSec;
float _HorizonBrightness, _MidLightIntensity, _CloudBrightnessDay, _CloudBrightnessNight, _Fuzziness, _FuzzinessSec, _DistortionSpeed, _CloudNoiseSpeed, _CloudNoiseScale, _DistortScale, _StarsCutoff, _StarsSpeed, _CloudCutoff, _CloudSpeed, _HorizonHeight, _HorizonIntensity, _CloudScale, _StarScale;
sampler2D _Stars, _CloudNoise, _Cloud, _DistortTex, _MoonTex;
```

然后再fragment部分就可以计算了：

```cpp
//...other code
float dayNightTransition;
if (_TimeOfDay < 0.25f || _TimeOfDay > 0.75f)
{
    // 夜晚时段
    dayNightTransition = 0;
}
else
{
    // 白天时段
    dayNightTransition = 1;
}

// 在日出日落时添加平滑过渡
if (_TimeOfDay >= 0.2f && _TimeOfDay <= 0.3f)
{
    // 日出过渡
    dayNightTransition = smoothstep(0.2f, 0.3f, _TimeOfDay);
}
else if (_TimeOfDay >= 0.7f && _TimeOfDay <= 0.8f)
{
    // 日落过渡
    dayNightTransition = smoothstep(0.8f, 0.7f, _TimeOfDay);
}

float3 skyGradients = lerp(gradientNight, gradientDay, dayNightTransition);
//...other code

```

自此变量便可以被共享并同步，根据时间的 变化进行lerp（夜晚、日出日落、白天）。

还有要注意，这个Shader的属性，必须要这个脚本挂在在场景中。

## 还有没有其他的方式进行共享？
有的兄弟有的！

1. `Material.Set*`适合单个材质，简单易用，适合独立材质的变量传递，**但注意会导致材质实例化**
2. `MaterialPropertyBlock`可以作为单个渲染器动态传递变量，**避免材质实例化，适合动态属性设置**
3. `ComputeBuffer`传递数组或结构体；适合**传递大规模数据**，如粒子系统、动态网格等
4. `cbuffer` / `uniform`适用于单个材质，**高效传递简单变量，适合基本场景**
5. 全局关键字/全局范围：用于控制 Shader 的功能开关，**适合启用/禁用特效或功能模块**
6. 全局纹理或 RenderTexture：作用于单个材质或全局，传递动态纹理或图像数据，**适合后处理或实时渲染场景**
7. `Shader.SetGlobal*`：全局范围，作为API可以高效传递全局变量，**适合全局控制（如时间、环境光）**
8. `GraphicsBuffer（GBUFFER）`是更加高级 GPU 数据传输，**具有高性能，适合高级计算场景（如粒子模拟、大规模数据处理）**

