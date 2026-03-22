---
title: VEX：如何沿用上组变量
published: 2025-02-15
description: Houdini VEX编程中的变量使用技巧
tags: ["VEX"]
category: 杂谈
---

偶然在用的时候看到了一行代码

```c
float rotation = radians(@rotation*360);
vector axis = v@axis; 
```

这里在引用属性的时候出现了两种情况：一种是@rotation;一种是v@axis。这之间其实是指定类型和自动查找类型之间的差异：

在VEX中，`v@`和单独的`@`是属性访问的不同语法，区别在于数据类型的明确指定：

## `@` 语法
```plain
@axis  // 自动推断数据类型
```

+ VEX会根据上下文**自动推断**属性的数据类型
+ 如果无法明确推断，可能导致错误或意外结果

## `v@` 语法
```plain
v@axis  // 明确指定为vector类型
```

+ **明确指定**属性为vector类型
+ 即使原始属性是其他类型，也会尝试转换为vector

## 类型前缀列表
+ `i@` - integer (整数)
+ `f@` - float (浮点数)  
+ `v@` - vector (向量)
+ `p@` - vector4 (四维向量)
+ `s@` - string (字符串)
+ `u@` - vector2 (二维向量)

## 实际区别示例
```plain
// 如果axis属性实际是float类型
vector axis1 = @axis;   // 可能报错或产生意外结果
vector axis2 = v@axis;  // 强制转换为vector，如{axis_value, 0, 0}

// 如果axis属性确实是vector类型
vector axis3 = @axis;   // 正常工作
vector axis4 = v@axis;  // 正常工作，等价
```

## 最佳实践
使用类型前缀（如`v@`）更安全、更明确，特别是在复杂场景中，能避免类型推断错误。

