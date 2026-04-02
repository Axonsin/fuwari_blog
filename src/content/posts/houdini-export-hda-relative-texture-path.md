---
title: Houdini导出hda时，纹理调用使用相对路径
published: 2025-08-11
description: Houdini中使用相对路径的最佳实践
category: Houdini
---

一般来说，Houdini在拖入纹理的时候会直接调取绝对路径(C://Users//......)

如果把这个玩意导出到hda的时候，Unity/UE读取的时候就会报错。因为它本身没有访问这些外部文件的权限。

在 Houdini 中使用纹理路径时，当前是用的类似于：

```plain
$JOB/Desktop/works/Houdini/GIt_Houdini_ProjectFiles/Wave_Function_Collapse_Tiles/Grid_Source/Grid_Demo_$F2.png
```

这种路径，实际上还是**绝对路径**（虽然带了 `$JOB`），这样在导出为 HDA（Houdini Digital Asset）或者跨项目/跨平台时容易出现纹理丢失问题。

## **推荐的做法：使用相对路径**
### 1. 放置纹理于项目目录下
假设你的项目结构大致如下：

```plain
GIt_Houdini_ProjectFiles/
  |-- Wave_Function_Collapse_Tiles/
      |-- Grid_Source/
          |-- Grid_Demo_01.png
      |-- houdini_project.hip
      |-- my_hda.hda
```

### 2. 设置 `$HIP` 或 `$JOB`
+ **$HIP**：指的是当前打开的 Houdini 工程文件所在的文件夹。
+ **JOB∗∗：可以自定义为项目根目录（建议你在File>SetProject或直接设置JOB**：可以自定义为项目根目录（建议你在 File > Set Project 或直接设置 JOB∗∗：可以自定义为项目根目录（建议你在File>SetProject或直接设置JOB 环境变量）；

### 3. 使用相对路径（推荐）
**写法一：$HIP 相对路径**

```plain
$HIP/Wave_Function_Collapse_Tiles/Grid_Source/Grid_Demo_$F2.png
```

+ 如果你的 hip 文件和资源目录都在项目文件夹下，这样路径就是相对的，HDA 在别的机器上打开时也能找到。

**写法二：$JOB 相对路径**

```plain
$JOB/Wave_Function_Collapse_Tiles/Grid_Source/Grid_Demo_$F2.png
```

+ 只要你在别的电脑上设置了同样的 $JOB 环境变量，路径就不会丢失。

**写法三：纯相对路径**

```plain
Grid_Source/Grid_Demo_$F2.png
```

+ 如果 HDA 和贴图在同一目录下，或者你把贴图文件夹与 HDA 一起打包分发，直接用纯相对路径即可。

### 4. HDA打包贴图（可选）
+ 在 HDA Type Properties 里可以把贴图文件“嵌入”到 HDA（如 Extra Files），这样分发最安全，但贴图不能太大，否则 HDA 文件体积会暴增。

---

## **实际建议**
+ **开发时**：用 `$HIP` 或 `$JOB` 路径，保持工程和贴图结构一致。
+ **发布时**：可以把贴图和 HDA 文件一起放一个文件夹或者子目录里，用相对路径引用。
+ **多机环境**：务必同步项目文件夹结构和 $JOB 环境变量。

---

### **示例：相对路径的写法**
如果你的 HDA 和贴图都在同一目录下：

```plain
./Grid_Demo_$F2.png
```

如果贴图在 HDA 的子目录 `textures` 下：

```plain
./textures/Grid_Demo_$F2.png
```

或者

```plain
textures/Grid_Demo_$F2.png
```

---

## **总结**
+ 尽量避免硬编码绝对路径。
+ 多用 `$HIP`、`$JOB` 或纯相对路径。
+ 打包 HDA 时可以用 Extra Files 嵌入资源，但注意体积和引用方式。

![](/images/posts/5d6de560.png)

