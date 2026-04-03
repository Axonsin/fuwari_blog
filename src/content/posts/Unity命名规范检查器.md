---
title: Unity命名规范检查器
published: 2025-08-13
---

为美术团队在 Unity 中创建一个自动化的命名规范检查器是一个非常棒的主意，这能极大地提升工作流的规范性和效率。
我们将使用 Unity 的 AssetPostprocessor API 来实现这个功能。这是一个特殊的编辑器脚本，它可以在资源被导入或重新导入时自动执行代码。
以下是实现这个检查器的详细步骤和代码。

### 核心概念


### 步骤一：创建基础检查器脚本


首先，我们来创建一个简单的脚本，先针对你提供的 模型 (FBX) 和 贴图 (PNG) 命名规范进行检查。

```csharp
// 放置在 Assets/Editor/ 文件夹下using UnityEngine;using UnityEditor;using System.IO;using System.Text.RegularExpressions;public class AssetNamingChecker : AssetPostprocessor{    // 定义模型命名的正则表达式规则    // 示例: SM_Wall_01_Var01, SM_Floor_Buff00_Var01, SM_Prop_Bookshelf_Var01_LOD0    private const string ModelNamePattern = @"^SM_(Wall|Floor|Prop)_.+";    // 定义贴图命名的正则表达式规则    // 示例: T_SM_Wall_01_Var01_diffuse.png, T_SM_Prop_Bookshelf_Var01_LOD0_roughness.png    private const string TextureNamePattern = @"^T_SM_.+_(diffuse|normal|roughness)";    // 定义材质命名的正则表达式规则    // 示例: M_SM_Wall_01_Var01.mat    private const string MaterialNamePattern = @"^M_SM_.+";    // 当任何资源被导入、删除、移动后都会调用此方法    // 我们用这个通用方法来检查所有关心的资源类型    static void OnPostprocessAllAssets(string[] importedAssets, string[] deletedAssets, string[] movedAssets, string[] movedFromAssetPaths)    {        foreach (string path in importedAssets)        {            CheckAssetName(path);        }        // 如果需要，也可以对移动的资源进行检查        // foreach (string path in movedAssets)        // {        //     CheckAssetName(path);        // }    }    private static void CheckAssetName(string path)    {        // 获取不带扩展名的文件名        string filename = Path.GetFileNameWithoutExtension(path);        // 获取文件扩展名        string extension = Path.GetExtension(path).ToLower();        bool isNameValid = true;        string expectedPattern = "N/A";        // 根据文件类型选择不同的规则进行检查        switch (extension)        {            // 模型文件            case ".fbx":                isNameValid = Regex.IsMatch(filename, ModelNamePattern);                expectedPattern = "SM_[Type]_[Detail]...";                break;            // 贴图文件            case ".png":            case ".exr": // 根据你的文档，贴图也可能是 .exr                // UI贴图和模型贴图规则不同，需要区分                if (path.Contains("/Art/UI/")) // 假设UI资源在特定路径                {                    // 在这里添加UI资源的命名检查逻辑                    // 比如: isNameValid = Regex.IsMatch(filename, UINamePattern);                }                else                {                    isNameValid = Regex.IsMatch(filename, TextureNamePattern);                    expectedPattern = "T_SM_[ModelName]_[Channel]";                }                break;            // 材质文件            case ".mat":                isNameValid = Regex.IsMatch(filename, MaterialNamePattern);                expectedPattern = "M_SM_[ModelName]";                break;            // 如果有其他需要检查的类型，在这里添加 case
```


#### 代码解释：


### 步骤二：扩展检查器以支持UI资源


现在，我们把上一份你确认的《UI资源工作流标准》中的命名规则也加进去。
我们将修改上面的脚本，使其更加完善和灵活。

```csharp
// 放置在 Assets/Editor/ 文件夹下using UnityEngine;using UnityEditor;using System.IO;using System.Text.RegularExpressions;public class AssetNamingChecker : AssetPostprocessor{    // === 模型资源规则 ===    private const string ModelNamePattern = @"^SM_(Wall|Floor|Prop)_.+";    private const string ModelTextureNamePattern = @"^T_SM_.+_(diffuse|normal|roughness)";    private const string ModelMaterialNamePattern = @"^M_SM_.+";    // === UI 资源规则 ===    // 示例: UI_MainMenu_Btn_Start_Normal    private const string UISpriteNamePattern = @"^UI_([A-Za-z0-9]+)_(Icon|Btn|Panel|Bg|Img|Bar)_.+";    // 示例: Wall_01_Var01.prefab, Prop_Bookshelf_Var01_LOD0.prefab    private const string PrefabNamePattern = @"^(Wall|Floor|Prop|Common|MainMenu|Shop|HUD)_.+";    static void OnPostprocessAllAssets(string[] importedAssets, string[] deletedAssets, string[] movedAssets, string[] movedFromAssetPaths)    {        foreach (string path in importedAssets)        {            CheckAssetName(path);        }    }    private static void CheckAssetName(string path)    {        // 忽略对文件夹和Unity内置资源的检查        if (Directory.Exists(path) || path.StartsWith("Packages/"))        {            return;        }        string filename = Path.GetFileNameWithoutExtension(path);        string extension = Path.GetExtension(path).ToLower();        bool isNameValid = true;        string expectedPattern = "N/A";        bool shouldCheck = true;        switch (extension)        {            case ".fbx":                isNameValid = Regex.IsMatch(filename, ModelNamePattern);                expectedPattern = "SM_[Type]_[Detail]...";                break;            case ".png":            case ".jpg":            case ".tga":            case ".exr":                // 根据路径区分是模型贴图还是UI贴图                if (path.Contains("/Art/UI/"))                {                    isNameValid = Regex.IsMatch(filename, UISpriteNamePattern);                    expectedPattern = "UI_[Module]_[Type]_[Description]_[State]";                }                else                {                    isNameValid = Regex.IsMatch(filename, ModelTextureNamePattern);                    expectedPattern = "T_SM_[ModelName]_[Channel]";                }                break;            case ".mat":                isNameValid = Regex.IsMatch(filename, ModelMaterialNamePattern);                expectedPattern = "M_SM_[ModelName]";                break;            case ".prefab":                isNameValid = Regex.IsMatch(filename, PrefabNamePattern);                expectedPattern = "[Module]_[Type]_[Description]";                break;                        default:                // 对于不关心的文件类型，不进行检查                shouldCheck = false;                break;        }
```


### 如何使用


(这是一个模拟截图，展示了警告信息在Unity Console中的样子)

### 进阶建议：使用 ScriptableObject 管理规则


如果你的团队很大，规则可能需要调整，硬编码在脚本里不方便。你可以创建一个 ScriptableObject 来在 Unity Inspector 中直接编辑命名规则，这样非程序员（如主美或项目经理）也能轻松修改。但这会使系统变得更复杂，对于起步阶段，上面的脚本已经完全足够了。
这个自动化检查器将成为你们团队工作流中一个非常有价值的工具，能从源头上保证项目资源的整洁和一致性。