---
title: 用Global Hook抓取Steam游戏
published: 2025-07-13
description: 用Global Hook抓取Steam游戏的技术原理和应用
category: Unity相关&随记
---

[https://zhuanlan.zhihu.com/p/534821939](https://zhuanlan.zhihu.com/p/534821939)



Steam在开启RenderDoc之后无法启动，此时我们需要开启globalhook。详情请参见上面的知乎专栏。

RenderDoc 截取的帧文件（`.rdc` 文件）的存放位置有以下几种情况：

1. **默认保存位置：**  
当你成功捕获一帧后，RenderDoc 会自动将 `.rdc` 文件保存到一个默认的临时目录。这个目录通常位于你的用户临时文件夹下，例如：
    - **Windows:**`C:\Users\[你的用户名]\AppData\Local\Temp\RenderDoc\`
    - **Linux:**`/tmp/RenderDoc/` 或 `$XDG_RUNTIME_DIR/RenderDoc/`

这些文件通常以 `[应用程序名称]_[日期]_[时间].rdc` 的格式命名，例如 `MyGame_2024_07_29_10_30_05.rdc`。

2. **在 RenderDoc 界面中查看和保存：**
    - **捕获日志 (Capture Log) 区域：** 当你成功捕获一帧后，RenderDoc 主界面左侧的“**Capture Log**”区域会显示一个条目，其中包含捕获到的帧的缩略图和一些基本信息。
    - **右键点击保存：** 你可以右键点击这个捕获条目，然后选择“**Save Capture As...**”（另存为...）。这将允许你选择一个自定义的目录和文件名来保存这个 `.rdc` 文件。
    - **双击打开：** 双击这个捕获条目会直接在 RenderDoc 中打开并加载该帧进行分析。
3. **配置默认保存路径 (不常见，但可能存在)：**  
虽然 RenderDoc 主要设计为捕获后手动保存，但有些高级设置或自定义脚本可能会影响默认的临时目录。不过，对于大多数用户而言，上述的临时目录是默认行为。

**总结来说：**

+ **临时文件：** RenderDoc 会自动将捕获的帧保存到你的系统临时目录下的 `RenderDoc` 子文件夹中。
+ **手动保存：** 你应该在 RenderDoc 的“Capture Log”区域中，右键点击你想要永久保存的捕获条目，然后选择“Save Capture As...”将其保存到你希望的任何位置。

建议你养成习惯，在捕获到你需要的帧后，立即将其另存为到你指定的项目文件夹中，这样可以避免临时文件被清理或混淆。

