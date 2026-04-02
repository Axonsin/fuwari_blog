---
title: 为Unity的后端使用OpenGL Debug
published: 2026-03-16
category: Unity相关&随记
---

默认情况下, Unity使用的后端是DirectX (D3D11&12). 但是有时候, 有需要使用切换整个后端api来测试renderfeature和compute shader的可用性.

![image.png](/images/posts/yuque-temp/image_00.png)


在这里即可直接调换渲染api. 整个渲染管线都会被Opengl改变.