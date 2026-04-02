---
title: Houdini&Unity同步刷新工程文件结构
published: 2025-07-17
description: Houdini&Unity同步刷新工程文件结构的详细介绍和使用方法
category: Houdini
---

在Houdini中对HDA（Houdini数字资产）进行更改后，可以通过以下几种方式在Unity中刷新它：

1. **会话同步 (Session Sync)**：  
这是最推荐和最集成的工作流程，尤其适用于实时开发。通过会话同步，您在Houdini中对HDA所做的更改可以自动实时地反映在Unity中。它甚至支持Unity和Houdini视口的同步，提供无缝的创作体验。 [[1]](https://www.reddit.com/r/Houdini/comments/hc5377/the_new_houdini_engine_for_unity_update_is/)[[2]](https://www.sidefx.com/docs/houdini/unity/about.html)
2. **重新烹饪资产 (Recook Asset)**：  
在Unity中，当您在场景中选择HDA的实例时，通常可以在其Inspector窗口中找到一个名为“Recook Asset”（重新烹饪资产）的按钮。这个操作会将Unity中HDA参数的更改上传到Houdini Engine，并强制HDA在Houdini中重新计算和生成输出。这适用于您只更改了HDA参数的情况。 [[3]](https://www.sidefx.com/docs/unity19.0/_assets.html)[[4]](https://www.sidefx.com/forum/topic/67677/)
3. **重建资产 (Rebuild Asset)**：  
如果HDA文件本身在Houdini中被修改并重新保存（例如，修改了节点网络、添加或删除了参数），那么建议使用“Rebuild Asset”（重建资产）功能。这个操作会确保Unity加载HDA的最新版本，重新创建所有内容，然后尝试重新应用之前设置的参数值。 [[3]](https://www.sidefx.com/docs/unity19.0/_assets.html)[[4]](https://www.sidefx.com/forum/topic/67677/)
4. **保存HDA定义**：  
在Houdini中对HDA进行任何更改后，请务必保存HDA的定义。这通常通过Houdini菜单中的 `File > Save Asset` 或 `Asset > Save Asset` 来完成。保存后，Unity才能检测到HDA文件的更新。
5. **自动烹饪参数更改 (Auto-Cook On Parameter Change)**：  
默认情况下，当您在Unity UI中更改HDA的参数时，HDA会自动重新烹饪。如果HDA的烹饪过程耗时较长，您可以在HDA的选项中关闭此功能，然后手动点击“Recook Asset”按钮来控制刷新。 [[3]](https://www.sidefx.com/docs/unity19.0/_assets.html)
6. **关闭所有会话 (Close All Sessions)**：  
如果HDA在Unity中没有按预期更新，特别是当您遇到会话冲突时，可以尝试在Unity中导航到 `HoudiniEngine` 菜单，然后选择 `Session > Close All Sessions`。关闭所有会话后，您可以再次尝试加载或重新烹饪/重建HDA。 [[4]](https://www.sidefx.com/forum/topic/67677/)[[5]](https://www.sidefx.com/forum/post/332045/)

通常情况下，如果您在Houdini中修改了HDA的内部逻辑或结构，保存HDA文件后，回到Unity并选择HDA实例，点击“Rebuild Asset”即可刷新。如果您只是修改了HDA的参数，那么“Recook Asset”就足够了，或者如果开启了自动烹饪，更改参数后会自动刷新。

---

Learn more:

1. [The new Houdini Engine for Unity update is amazing. It could be a complete game-changer! (Session Sync) - Reddit](https://www.reddit.com/r/Houdini/comments/hc5377/the_new_houdini_engine_for_unity_update_is/)
2. [Introduction to Houdini Engine for Unity - SideFX](https://www.sidefx.com/docs/houdini/unity/about.html)
3. [Houdini Engine for Unity: Houdini Assets - SideFX](https://www.sidefx.com/docs/unity19.0/_assets.html)
4. [HDA not updating inside Unity | Forums - SideFX](https://www.sidefx.com/forum/topic/67677/)
5. [HDA not updating inside Unity | Forums - SideFX](https://www.sidefx.com/forum/post/332045/)

