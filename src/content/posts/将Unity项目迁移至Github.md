---
title: 将Unity项目迁移至Github
published: 2025-03-28
category: Unity相关&随记
---

我这里用的是SourceTree，是git的可视化版本。
Unity准备工作：
GitHub 准备工作：
SourceTree操作步骤：
添加本地仓库：
在右上角的仓库设置中，对仓库使用的gitignore进行编辑（这里用的是Unity的推荐的gitignore）

```cpp
# Unity generated[Ll]ibrary/[Tt]emp/[Oo]bj/[Bb]uild/[Bb]uilds/[Ll]ogs/[Uu]ser[Ss]ettings/# Unity3D generated meta files*.pidb.meta*.pdb.meta*.mdb.meta# Unity3D generated file on crash reportssysinfo.txt# Visual Studio files.vs/*.csproj*.sln*.suo*.tmp*.user*.userprefs*.pidb*.booproj*.svd# OS generated.DS_Store.DS_Store?
```


注意事项：