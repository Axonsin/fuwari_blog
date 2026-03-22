---
title: "C#：委托和异步回调"
published: 2025-07-09
description: "C#：委托和异步回调的详细介绍和使用方法"
tags: ["技术"]
category: 杂谈
---

# 委托和回调
## 🎯 什么是委托？—— 用“外卖订单”来比喻
想象一下，你开了一家外卖店，顾客下单后，你需要通知不同的“执行人”去完成任务：

+ 有人负责**做菜**（厨师）
+ 有人负责**打包**（打包员）
+ 有人负责**送外卖**（骑手）

但你不想每次都硬编码（写死）让“张三”做菜、“李四”打包。你希望更灵活：**谁有空，就让谁干！**

这就需要一个“通知机制”——你不知道具体是谁干活，但你知道“该叫人来做这件事了”。

在 C# 中，**委托就是这个“通知机制”**。

---

## 🧱 第一步：定义“任务类型”—— 委托的声明
你先要定义一个“岗位职责说明书”，比如“做饭的人必须会做菜”。

```csharp
// 委托声明：定义一种“能做饭”的岗位
public delegate void CookDelegate(string dishName);
```

👉 解释：

+ `delegate`：关键词，表示这是一个委托。
+ `void`：表示这个岗位完成任务后不返回结果（比如不需要返回“菜好不好吃”）。
+ `CookDelegate`：这是这个岗位的名字。
+ `string dishName`：表示这个岗位需要一个参数，比如“宫保鸡丁”。

✅ 这就像你说：“所有应聘‘厨师’岗位的人，必须会接收一个菜名，并能做出来。”

---

## 🧍 第二步：创建“应聘者”—— 具体的方法
现在，有两位厨师来应聘：

```csharp
public class Chef
{
    public static void ZhangSanCook(string dish)
    {
        Console.WriteLine($"张三正在做：{dish}");
    }

    public static void LiSiCook(string dish)
    {
        Console.WriteLine($"李四正在做：{dish}");
    }
}
```

👉 这两个方法都符合 `CookDelegate` 的要求：接受一个字符串，返回 void。

---

## 📞 第三步：发布“招聘通知”—— 创建委托实例
现在你开始招人：

```csharp
// 创建一个委托变量，表示“当前负责做饭的人”
CookDelegate cookJob = null;

// 张三来应聘，你把他安排上
cookJob = Chef.ZhangSanCook;

// 或者你也可以换李四
// cookJob = Chef.LiSiCook;
```

👉 这就像你说：“现在让张三来做饭。”

---

## 🔔 第四步：下达任务 —— 调用委托
当顾客下单“宫保鸡丁”时，你不需要关心是谁在做，你只管“通知做饭的人”：

```csharp
if (cookJob != null)
{
    cookJob("宫保鸡丁"); // 调用委托
}
```

输出：

```plain
张三正在做：宫保鸡丁
```

✅ 你没有写死“张三来做”，而是通过委托“间接调用”了方法。

---

## 🚀 更强大的功能：多个人一起干！—— 多播委托（Multicast Delegate）
委托还能“通知多人”！比如，做菜的同时，还要通知打包员和骑手。

我们再定义两个委托：

```csharp
public delegate void PackDelegate(string dish);
public delegate void DeliverDelegate(string address);
```

然后创建方法：

```csharp
public class Staff
{
    public static void PackFood(string dish)
    {
        Console.WriteLine($"打包员正在打包：{dish}");
    }

    public static void DeliverFood(string address)
    {
        Console.WriteLine($"骑手正在送往：{address}");
    }
}
```

现在，你可以把多个任务“串”起来，像流水线一样：

```csharp
// 使用内置的 Action 委托（更简单）
Action<string> workflow = null;

workflow += Chef.ZhangSanCook;     // 第一步：做饭
workflow += Staff.PackFood;        // 第二步：打包
workflow += (address) => Staff.DeliverFood("北京市朝阳区"); // 第三步：送外卖

// 一键触发整个流程！
workflow?.Invoke("宫保鸡丁");
```

输出：

```plain
张三正在做：宫保鸡丁
打包员正在打包：宫保鸡丁
骑手正在送往：北京市朝阳区
```

👉 `+=` 表示“再加一个人来干活”，这就是**多播委托**，像一条流水线，一个任务接一个任务执行。

---

## 🌟 委托的真正用途：解耦 + 回调
### 1. 解耦（Decoupling）
你写一个“下单系统”，但你不需要知道谁来做饭、谁来送外卖。你只关心：“有订单时，调用这个委托就行。”  
这样，厨师换了、骑手换了，你的主逻辑完全不用改！

### 2. 回调（Callback）
比如你调用一个“异步做饭”方法，做完后要通知你：

```csharp
public void StartCookingAsync(string dish, Action onComplete)
{
    // 模拟做饭耗时
    Task.Delay(2000).Wait();
    Console.WriteLine($"{dish} 做好了！");
    
    // 做完后，回调通知你
    onComplete?.Invoke();
}

// 使用时：
StartCookingAsync("红烧肉", () => {
    Console.WriteLine("可以开饭啦！");
});
```

👉 这就是“你先去做饭，做完了告诉我一声”。

---

## ✅ 总结：委托到底是什么？
| 比喻 | 编程概念 |
| --- | --- |
| 岗位招聘说明书 | `delegate void CookDelegate(string dish);` |
| 应聘的厨师 | `ZhangSanCook`, `LiSiCook` 方法 |
| 安排谁上岗 | `cookJob = ZhangSanCook;` |
| 下达任务 | `cookJob("宫保鸡丁");` |
| 流水线作业 | 多播委托 `+=` |
| 做完通知我 | 回调（Callback） |


---

🎯 **一句话总结**：

> 委托就是“把方法当作变量来传递”，让你的代码更灵活、可扩展、可维护。
>

就像你不需要知道谁在干活，你只负责“按按钮”，系统就会自动让正确的人完成任务。

# invoke和C#中的lambda表达式


## 🧩 代码回顾：
```csharp
onComplete?.Invoke();
```

和

```csharp
StartCookingAsync("红烧肉", () => {
    Console.WriteLine("可以开饭啦！");
});
```

我们要理解的是：**这两个部分是如何配合工作的？为什么这样写？**

---

## 🎯 场景设定：做饭需要时间
想象一下，你让厨师去做一道“红烧肉”，但做饭要花 2 秒钟。你不想傻等，而是说：

> “你去做好了红烧肉之后，**记得告诉我一声**，我好去吃饭。”
>

这个“告诉我一声”，就是所谓的 **回调（Callback）**，而 `Action onComplete` 就是“告诉我”的那个方式。

---

### ✅ 第一部分：`onComplete?.Invoke();`
我们先看定义这个方法的地方：

```csharp
public void StartCookingAsync(string dish, Action onComplete)
{
    // 模拟做饭耗时
    Task.Delay(2000).Wait();  // 等2秒，假装在做饭
    Console.WriteLine($"{dish} 做好了！");

    // 做完后，回调通知你
    onComplete?.Invoke();
}
```

#### 🔍 逐行解释：
1. `Action onComplete`：
    - 这是一个**委托参数**，意思是：“请告诉我，做完饭后要执行哪个方法？”
    - `Action` 是 C# 内置的一个委托类型，表示“一个没有参数、没有返回值的方法”。
2. `onComplete?.Invoke();`：
    - 这是关键！我们来拆开看：

| 部分 | 含义 |
| --- | --- |
| `onComplete` | 就是你传进来的“完成后要执行的方法” |
| `?.` | **空值条件运算符**：意思是“如果 `onComplete` 不是 null，才继续调用” |
| `Invoke()` | 调用这个委托指向的方法（也就是执行它） |


✅ 所以这行代码的意思是：

> “如果有人告诉我‘做完要做什么’，那我现在就执行那个操作；如果没人告诉我，那就算了。”
>

👉 防止空指针错误！如果不加 `?`，而你又没传回调，程序就会报错：“你试图调用一个 null 的方法”。

---

### ✅ 第二部分：`() => { ... }` 是什么？
再看调用的地方：

```csharp
StartCookingAsync("红烧肉", () => {
    Console.WriteLine("可以开饭啦！");
});
```

#### 🔍 拆解这个调用：
+ `"红烧肉"`：这是第一个参数，表示要做哪道菜。
+ `() => { ... }`：这是第二个参数，就是那个 `Action onComplete`！

#### 那 `() => { ... }` 到底是什么？
这是 C# 的 **Lambda 表达式**，你可以把它理解为：

> “一个匿名的方法（没有名字的方法），它没有参数，执行的时候就打印一句话。”
>

等价于：

```csharp
void OnCookingFinished()
{
    Console.WriteLine("可以开饭啦！");
}
```

但我们不想专门去定义一个方法，所以用 `() => { }` 来“现场写一个临时方法”。

| 写法 | 含义 |
| --- | --- |
| `()` | 这个方法不需要任何参数 |
| `=>` | “指向”要执行的代码，读作“goes to” |
| `{ ... }` | 要执行的具体操作 |


所以：

```csharp
() => {
    Console.WriteLine("可以开饭啦！");
}
```

意思就是：

> “当做饭做完时，请执行：打印‘可以开饭啦！’”
>

---

## 🔄 两个部分如何配合？—— 完整流程
我们把整个流程串起来：

```csharp
// 你调用这个方法
StartCookingAsync("红烧肉", () => {
    Console.WriteLine("可以开饭啦！");
});
```

1. 程序开始做饭，等 2 秒。
2. 打印：`红烧肉 做好了！`
3. 然后执行：`onComplete?.Invoke();`
    - 此时 `onComplete` 指向的是你传进来的那个 `() => { ... }`
    - 所以就会执行里面的代码：`Console.WriteLine("可以开饭啦！");`

🎯 最终输出：

```plain
红烧肉 做好了！
可以开饭啦！
```

---

## 🧠 类比理解：打电话预约
想象你打电话给餐厅：

> 你：“帮我做份红烧肉，做好了**打电话通知我**。”
>

+ “打电话通知我” → 就是 `Action onComplete`
+ 你留的电话号码 → 就是 `() => { Console.WriteLine("可以开饭啦！"); }`
+ 餐厅做完菜后打电话 → 就是 `onComplete?.Invoke();`

如果没留电话（`onComplete` 是 null），那餐厅当然没法通知你，所以加个 `?.` 防止出错。

---

## ✅ 总结：一句话讲清楚
+ `onComplete?.Invoke();`：  
“如果有人留了‘事后要做的事’，现在就去做那件事。”
+ `() => { ... }`：  
“这是我留的‘事后要做的事’——打印一句话。”

👉 它们配合起来，就实现了“**异步完成后的通知机制**”，这就是委托最常用的场景之一。



