---
title: MiniConda:在IDE中也能激活conda环境
published: 2025-10-26
---


> 最近在研究编译RenderDoc的时候,发现RenderDoc还在使用Python3.6环境.所以要用环境管理.venv不能管理python版本,相比之下,还是(mini)conda比较顺手,不仅可以进行包管理还可以自由切换python版本.唯一的问题就是在一般情况下,vscode的终端是不会激活conda的.


具体情况: conda在vscode的powershell中激活后,使用python --version仍然映射的是系统的版本;而在win+R唤起cmd之后,在这里激活并使用python --version之后反而会可以激活到conda中指定的python版本.
这就要讲到conda的hook机制了.

### 问题分析：为什么在VS Code的PowerShell中 python --version 不生效？


当在命令行中执行 conda activate your_env 时，Conda会做两件主要的事情：
为什么在VS Code的PowerShell中可能不生效，而在CMD中可以？
所以,VS Code的Python扩展不完全依赖于终端的 PATH。
对于在VS Code中运行和调试Python脚本，最可靠的方法不是仅仅依赖于终端中激活的环境。VS Code的Python扩展提供了一个更强大的机制，允许您明确选择用于当前工作区或文件的Python解释器。一旦您选择了，VS Code的Linter、调试器、运行器以及其他Python相关功能都会使用这个指定的解释器，而不管您的集成终端中 python --version 显示什么。

### 解决方案：在VS Code中正确配置Conda虚拟环境


#### 步骤一：确保Conda在PowerShell中正确初始化 (可选，但推荐)


这一步是为了让您的VS Code集成终端能够正确地激活Conda环境，即使这不直接影响VS Code的调试器。

#### 步骤二：在VS Code中选择正确的Python解释器 (最关键的一步)


这是确保VS Code的Python扩展使用您的Conda环境的关键。

#### 步骤三：验证和使用


#### 如果VS Code终端报错没有权限...


在第一步的时候,如果尝试使用conda init powershell让conda在初始化powershell的时候,有概率会出现报错.

```powershell
. : 无法加载文件 D:\Documents\WindowsPowerShell\profile.ps1，因为在此系统上禁止运行脚本。有关详细信息，请参阅 https:/go.microsoft.com/fwlink/?LinkID=135170 中的 about_Execution_Policies。所在位置 行:1 字符: 3+ . 'D:\Documents\WindowsPowerShell\profile.ps1'+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    + CategoryInfo          : SecurityError: (:) []，PSSecurityException    + FullyQualifiedErrorId : UnauthorizedAccess
```


UnauthorizedAccess是关键. 一般情况下,为了防止终端在后台静默执行,会禁用其他脚本. PowerShell的执行策略是一种安全功能，旨在防止恶意脚本在计算机上运行。它控制着PowerShell加载和运行脚本的能力。默认情况下，在Windows客户端操作系统上，执行策略通常设置为 Restricted（受限），这意味着不允许运行任何PowerShell脚本，包括Conda的 profile.ps1 文件。
当运行 conda init powershell 命令时，Conda会尝试修改或创建PowerShell配置文件（通常是 profile.ps1），以便在每次启动PowerShell时自动加载Conda的环境初始化脚本。但是，如果执行策略设置为 Restricted，PowerShell就会拒绝加载这个 profile.ps1 文件，从而阻止Conda的初始化逻辑运行。
常见的权限类型有:
在这里,为了让Conda能在VS Code中执行环境初始化, 推荐的策略是 RemoteSigned，并将其作用域设置为 CurrentUser（当前用户）。 这样既能允许	运行自己的脚本，又能对从互联网下载的脚本提供一定的保护。
操作步骤：

```powershell
Get-ExecutionPolicy -List
```


这将显示所有作用域（MachinePolicy, UserPolicy, Process, CurrentUser, LocalMachine）下的执行策略。您会看到 CurrentUser 或 LocalMachine 可能是 Restricted。

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```


现在，当您在VS Code的PowerShell终端中运行 conda activate your_env 时，profile.ps1 应该能够被成功加载，Conda的环境初始化脚本也会随之运行。这意味着：

![image.png](/images/posts/dsf8s7736vfxyz04_image_00.png)


请注意： 即使在终端中 python --version 仍然显示系统版本（这在某些复杂的PATH配置下偶尔会发生），只要按照之前提供的步骤，在VS Code中通过 Python: Select Interpreter 明确选择了Conda环境的Python解释器，VS Code的运行和调试功能仍然会使用您指定的Conda环境。解决执行策略问题主要是为了让终端环境也能够正确地工作，提供一致的体验。

### 总结


这个现象是VS Code集成终端环境配置的一个常见“陷阱”，但它并不会阻碍您在VS Code中利用Conda虚拟环境。最核心的解决方案是：通过 Python: Select Interpreter 命令明确告诉VS Code您想要使用哪个Conda环境的Python解释器。 这样，VS Code的调试器、Linter、运行器等所有Python相关工具都会使用这个指定的版本，完美地支持您执行和调试旧版本Python脚本的需求。
https://github.com/eliemichel/MapsModelsImporter/issues/108