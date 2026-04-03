---
title: Code Review
published: 2024-12-03
category: Unity相关&随记
---


## 在这个文档里我会放各种代码的解析思路，还有一些项目解析。因为看懂渲染的代码确实有些难以解释...也可能是我自己的水平不足吧(


### 标准库BSDF：


这里说的是C++。实际上是HLSL（没有这个语言选项，将就着看吧）

```cpp
Shader "Unlit/Sample Shader"{Properties//来自于被渲染物体的数据选择属性。可以引用或者指定{_MainTex ("Texture", 2D) = "white" {}}SubShader    //来自shader组的可选shader。根据设备性能的不同，可以选择其中一个subshader。    {    Tags { "RenderType"="Opaque" }//Tags可以指定渲染的时候的rendertype。比如这里指定为不透明渲染    //光线不会穿过物体    LOD 100//Level of detail，指定纹理材质压缩率，1-100.指定了原生渲染    Pass    //passing渲染队列组    {    CGPROGRAM    #pragma vertex vert//vertex顶点组    #pragma fragment frag//fragment片元组    // make fog work    #pragma multi_compile_fog    #include "UnityCG.cginc"//来自unity内置的库。内含有物体的多个properties，减少编写的复杂度    struct appdata//元数据    {        float4 vertex : POSITION;        float2 uv : TEXCOORD0;    };    struct v2f    //vertex shader to fragment shader,在顶点着色器和片元着色器之间传递信息。    //其中还有一个常见的命名称为a2v    //a2v全程称为applicate to vertex shader。将数据从应用阶段传递给顶点着色器中    {    float2 uv : TEXCOORD0;    UNITY_FOG_COORDS(1)    float4 vertex : SV_POSITION;};    sampler2D _MainTex;    float4 _MainTex_ST;    v2f vert (appdata v)    //vert函数顶点着色器是用于处理3D模型中的每个顶点的程序。    //它们的主要任务是将顶点从对象空间转换到裁剪空间，并可能执行一些额外的计算，如光照、纹理坐标变换等。    //vert()函数就是用来定义这些转换和计算过程的。    {        v2f o;        o.vertex = UnityObjectToClipPos(v.vertex);        o.uv = TRANSFORM_TEX(v.uv, _MainTex);        UNITY_TRANSFER_FOG(o,o.vertex);        return o;    }    fixed4 frag (v2f i) : SV_Target//来自裁剪空间的坐标值        //像素着色器是用于处理屏幕上每个像素的程序。它们的主要任务是根据顶点着色器传递的数据和纹理信息，计算最终的颜色值。        //SV_TARGET变量就是用来存储这些颜色值的。        //SV_TARGET变量通常与特定的渲染目标相关联，例如颜色缓冲区、深度缓冲区或模板缓冲区。        //在实际应用中，像素着色器会根据不同的渲染目标进行相应的操作，以生成正确的输出。        {        // sample the texture        fixed4 col = tex2D(_MainTex, i.uv);    // apply fog    UNITY_APPLY_FOG(i.fogCoord, col);    return col;}ENDCG}}}
```


这是一个最简单的片元BSDF shader。它通过获取目标物体的textcord（被设置为白色），赋予目标2D UV。

## 透明度圆环实例


圆环内的

```cpp
Shader "CS02/Blending" //Shader的真正名字  可以是路径式的格式{    /*材质球参数及UI面板    https://docs.unity3d.com/cn/current/Manual/SL-Properties.html    https://docs.unity3d.com/cn/current/ScriptReference/MaterialPropertyDrawer.html    */    Properties         {        _MainTex ("Texture", 2D) = "" {}    _MainColor("Main Color",Color) = (1,1,1,1)        _Emiss("Emiss", Float) = 1.0        _Speed("Speed", Vector) = (.34, .85, .92, 1)        }/*    这是为了让你可以在一个Shader文件中写多种版本的Shader，但只有一个会被使用。    提供多个版本的SubShader，Unity可以根据对应平台选择最合适的Shader    或者配合LOD机制一起使用。    一般写一个即可    */SubShader    {    /*        标签属性，有两种：一种是SubShader层级，一种在Pass层级        https://docs.unity3d.com/cn/current/Manual/SL-SubShaderTags.html        https://docs.unity3d.com/cn/current/Manual/SL-PassTags.html        */    Tags { "Queue" = "Transparent" }    /*        Pass里面的内容Shader代码真正起作用的地方，        一个Pass对应一个真正意义上运行在GPU上的完整着色器(Vertex-Fragment Shader)        一个SubShader里面可以包含多个Pass，每个Pass会被按顺序执行        */    Pass     {    //Blending:https://docs.unity3d.com/Manual/SL-Blend.html    ZWrite Off    //Blend SrcAlpha OneMinusSrcAlpha     Blend One OneMinusSrcAlpha    //Blend SrcAlpha One    //Blend DstColor Zero    CGPROGRAM  // Shader代码从这里开始     #pragma vertex vert //指定一个名为"vert"的函数为顶点Shader    #pragma fragment frag //指定一个名为"frag"函数为片元Shader    #include "UnityCG.cginc"  //引用Unity内置的文件，很方便，有很多现成的函数提供使用    //https://docs.unity3d.com/Manual/SL-VertexProgramInputs.html    struct appdata  //CPU向顶点Shader提供的模型数据    {    //冒号后面的是特定语义词，告诉CPU需要哪些类似的数据    float4 vertex : POSITION; //模型空间顶点坐标    half2 texcoord0 : TEXCOORD0; //第一套UV    half2 texcoord1 : TEXCOORD1; //第二套UV    half2 texcoord2 : TEXCOORD2; //第二套UV    half2 texcoord4 : TEXCOORD3;  //模型最多只能有4套UV    half4 color : COLOR; //顶点颜色    half3 normal : NORMAL; //顶点法线    half4 tangent : TANGENT; //顶点切线(模型导入Unity后自动计算得到)};    struct v2f  //自定义数据结构体，顶点着色器输出的数据，也是片元着色器输入数据    {    float4 pos : SV_POSITION; //输出裁剪空间下的顶点坐标数据，给光栅化使用，必须要写的数据
```


这是一个很有意思的alpha通道测试shader。在vert顶点转换为片元着色器的时候还是正常的，转换为裁剪坐标空间讲裁剪位置坐标和纹理坐标/缩放大小重新对齐至裁剪空间。

> sampler2D与texture2D函数结合使用时，可以实现从纹理图像中提取像素值的功能。例如，在片元着色器中，可以通过调用texture2D(sampler, coord)来获取指定坐标上的纹理颜色，其中sampler是一个sampler2D类型的变量，而coord是一个vec2类型的变量，表示纹理坐标.


在片元着色器输出的时候，tex2D()函数负责进行渲染的纹理映射和重新采样。tex2D (HLSL 参考) - Win32 apps | Microsoft Learn。伪代码如下所示：

```cpp
sampler2D _MainTex;float2 speed;tex2D(_MainTex, speed);float4 ret;ret = tex2D;return ret;
```


tex2D中的重采样步骤选择使用时间进行偏移重采样；通过将纹理坐标与这个偏移量相加，可以得到一个新的纹理坐标，然后使用tex2D()函数来获取该坐标处的颜色值。这样可以实现纹理的动态变化，例如移动、闪烁或扭曲等效果。
最后是乘以主色彩和emiss透明度。这些在开头有了声明，因此finalcolor可以有主色彩，并可以有时间/速度偏移量。

## URP外描边处理（边缘检测描边）


https://www.bilibili.com/opus/743259329311801348

## 对SRP渲染管线进行添加的功能处理


![](/images/posts/image_00.png)


URP | 后处理-自定义后处理 - 哔哩哔哩