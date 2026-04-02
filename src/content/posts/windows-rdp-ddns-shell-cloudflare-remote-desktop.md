---
title: Windows RDP+ddns+Shell+CloudFlare 实现远程桌面
published: 2025-07-24
description: Git项目中.gitignore文件的配置方法
category: 朝花夕拾
---

> 其实感觉Gemini讲的很好了，我就没怎么改了，我自己试着对了。就直接放上来了。类似于备忘录吧（  
另：其实还有一个更快的ddns，叫做ddnsgo，不用shell而且是可视化：[https://github.com/jeessy2/ddns-go](https://github.com/jeessy2/ddns-go)
>

#### **第一章：我们的目标与“理想中”的设置**
**最终目标：** 通过一个好记的域名（例如 `rdp.yourdomain.com`），使用微软远程桌面（RDP）稳定连接到一台拥有动态公网IPv6地址的Windows电脑。

**核心技术栈：**

+ **RDP (Remote Desktop Protocol):** 微软强大的远程控制协议。
+ **IPv6:** 新一代互联网协议，它为我们提供了海量的公网IP地址，免去了内网穿透的烦恼。
+ **DDNS (Dynamic DNS):** 动态域名解析服务，当我们的公网IP变化时，它能自动将域名指向新的IP。
+ **Cloudflare:** 全球知名的CDN和DNS服务商，提供免费且强大的API来管理DNS记录，是实现DDNS的绝佳平台。
+ **PowerShell:** Windows上强大的脚本语言，我们将用它来编写DDNS自动更新脚本。

**理想中的初始设置步骤：**

1. **开启Windows远程桌面：**
    - 在目标电脑上，进入 `设置` > `系统` > `远程桌面`，开启此功能。
    - 确保你的Windows版本是专业版、企业版或服务器版。
2. **配置Windows防火墙：**
    - 在目标电脑上，搜索并打开“高级安全的 Windows Defender 防火墙”。
    - 在“入站规则”中，找到并启用“远程桌面 - 用户模式 (TCP-In)”。
3. **准备Cloudflare信息：**
    - 一个托管在Cloudflare上的域名。
    - **区域ID (Zone ID):** 在域名概览页的右下角可以找到。
    - **API令牌 (API Token):** 在 `我的个人资料` > `API令牌` 中创建一个具有“编辑区域DNS”权限的令牌。
4. **创建DDNS脚本与计划任务：**
    - 编写一个PowerShell脚本，用于获取本机IP并调用Cloudflare API更新DNS记录。
    - 在Windows“任务计划程序”中创建一个任务，让这个脚本每隔10分钟或30分钟自动运行一次。

到此为止，一切看起来都很完美。我们运行脚本，它也提示成功。然后，满怀期待地在另一台电脑上输入域名，点击连接...

### **整体流程概览**
1. **Cloudflare 端配置**： 
    - 创建一个有特定权限的 API 令牌（Token），这比使用全局 API 密钥更安全。
    - 获取你的域名的区域 ID (Zone ID)。
    - 在 DNS 中预先创建一个 AAAA 记录指向你的子域名。
2. **Windows 端配置**： 
    - 编写一个 PowerShell 脚本，该脚本可以： 
        * 自动获取本机的公共 IPv6 地址。
        * 通过 Cloudflare API 查询当前 DDNS 记录的 IP。
        * 如果 IP 地址发生变化，则调用 API 更新该记录。
3. **自动化配置**： 
    - 使用 Windows 的“任务计划程序” (Task Scheduler) 来定时自动运行这个 PowerShell 脚本，实现动态更新。

---

### **第一步：在 Cloudflare 进行配置**
在开始之前，请登录你的 Cloudflare 账户。

#### 1. 创建 API 令牌 (API Token)
为安全起见，我们不使用全局 API 密钥，而是创建一个仅拥有 DNS 编辑权限的令牌。

1. 在 Cloudflare 主页，点击右上角你的头像，选择 “我的个人资料 (My Profile)”。
2. 在左侧菜单中，选择 “API 令牌 (API Tokens)”。
3. 点击 “创建令牌 (Create Token)” 按钮。
4. 找到 “编辑区域 DNS (Edit zone DNS)” 模板，点击 “使用模板 (Use template)”。
5. **权限 (Permissions)**: 
    - 第一个下拉框选择 `Zone`。
    - 第二个下拉框选择 `DNS`。
    - 第三个下拉框选择 `Edit`。
6. **区域资源 (Zone Resources)**: 
    - 第一个下拉框选择 `Include`。
    - 第二个下拉框选择 `Specific zone`。
    - 第三个下拉框选择你想要用于 DDNS 的域名 (例如 `yourdomain.com`)。
7. 点击 “继续以显示摘要 (Continue to summary)”。
8. 确认信息无误后，点击 “创建令牌 (Create Token)”。
9. **重要提示**: Cloudflare 现在会显示你的 API 令牌。**请立即复制并妥善保管它**，因为这个令牌只会显示一次。后续脚本中会用到。

#### 2. 获取区域 ID (Zone ID)
1. 返回 Cloudflare 主页，选择你的域名。
2. 在右侧的 “API” 部分，你会看到 “区域 ID (Zone ID)”。点击 “单击以复制 (Click to copy)” 并保存下来。

#### 3. 创建 DNS AAAA 记录
我们需要一个初始记录，以便脚本后续进行更新。

1. 在你的域名管理页面，选择左侧的 “DNS”。
2. 点击 “添加记录 (Add record)”。
3. 填写以下信息： 
    - **类型 (Type)**: `AAAA` (这是用于 IPv6 的记录)
    - **名称 (Name)**: 你想要的子域名 (例如 `rdp`，这样完整地址就是 `rdp.yourdomain.com`)
    - **IPv6 地址 (IPv6 address)**: 可以先随便填一个有效的 IPv6 地址，比如 `::1` 或者 `2001:db8::1`。脚本会自动更新它。
    - **代理状态 (Proxy status)**: **务必关闭**！点击橙色的云朵，使其变为灰色（仅限 DNS）。RDP 协议无法通过 Cloudflare 的代理工作。
4. 点击 “保存 (Save)”。

现在，Cloudflare 这边的准备工作已经完成。

---

### **第二步：编写 Windows PowerShell 脚本**
这个脚本是整个 DDNS 系统的核心。它会自动获取并更新 IP。

1. 在你的电脑上创建一个文件夹，用于存放脚本，例如 `C:\DDNS`。
2. 打开记事本或任何代码编辑器（推荐 VS Code），将下面的 PowerShell 代码粘贴进去。

```powershell
# =================================================================================
# Cloudflare IPv6 DDNS 更新脚本 for Windows PowerShell (最终优化版 v3)
# =================================================================================

# --- 用户配置区域 ---
# 请将下面的值替换为你自己的信息

# 1. 从 Cloudflare 仪表盘获取的 API 令牌
$apiToken = "YOUR_API_TOKEN_HERE"

# 2. 从 Cloudflare 域名概览页面获取的区域 ID
$zoneId = "YOUR_ZONE_ID_HERE"

# 3. 你想要更新的完整 DNS 记录名称 (例如: rdp.yourdomain.com)
$recordName = "rdp.axonsin.software"

# 4. (可选) 日志文件路径。脚本会记录 IP 变化和更新状态。
#    请确保文件夹路径存在，例如 D:\RDP_ddns\
$logFilePath = "D:\RDP_ddns\cloudflare_ddns_log.txt"

# --- 脚本正文 ---
# 通常无需修改以下内容

# 函数：写入日志
function Write-Log {
    param (
        [string]$Message
    )
    $logEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $logEntry
    if ($logFilePath) {
        try {
            Add-Content -Path $logFilePath -Value $logEntry
        } catch {
            Write-Warning "无法写入日志文件: $($_.Exception.Message)"
        }
    }
}

# --- 第1步: 获取本机的公共 IPv6 地址 (优化逻辑) ---
Write-Log "正在获取本机的公共 IPv6 地址..."
$ipv6Address = ""
try {
    # 优先使用 Get-NetIPAddress 获取稳定的非临时、非本地(ULA)的公网地址
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv6 -AddressState Preferred -PrefixOrigin RouterAdvertisement
    
    # 过滤掉本地地址(fe80::)和唯一本地地址(fc00::/fd00::)
    $publicIp = $ipAddresses | Where-Object { $_.IPAddress -notlike "fe80::*" -and $_.IPAddress -notlike "fc00::*" -and $_.IPAddress -notlike "fd00::*" } | Select-Object -First 1
    
    if ($publicIp) {
        $ipv6Address = $publicIp.IPAddress
        Write-Log "通过本地命令获取到公网 IPv6 地址: $ipv6Address"
    }

    # 如果本地方法无法获取到公网IP，则使用外部IPv6-Only API作为备用方案
    if (-not $ipv6Address) {
        Write-Log "警告: 未能通过本地命令获取到公网 IPv6 地址。将使用外部IPv6-Only API服务..."
        try {
            # 关键修改：使用仅限IPv6的API端点，并增加超时
            $ipv6Address = (Invoke-RestMethod -Uri "https://api6.ipify.org" -TimeoutSec 10).Trim()
            
            # 关键修改：验证获取到的是否为IPv6地址
            if ($ipv6Address -like "*:*") {
                Write-Log "通过外部API获取到公网 IPv6 地址: $ipv6Address"
            } else {
                # 如果获取到的不是IPv6地址（例如返回了错误信息或空值），则清空变量
                Write-Log "错误: 外部API返回的不是有效的IPv6地址。内容: '$ipv6Address'"
                $ipv6Address = "" 
            }
        } catch {
            # 如果连API都访问不了，说明IPv6网络不通
            Write-Log "错误: 无法连接到外部IPv6-Only API服务。请检查本机的公网IPv6网络连接。"
            $ipv6Address = ""
        }
    }
    
    if ($ipv6Address) {
        Write-Log "最终确认的本机 IPv6 地址为: $ipv6Address"
    } else {
        throw "未能获取到任何有效的公网 IPv6 地址。"
    }
} catch {
    Write-Log "错误: 获取本机 IPv6 地址失败。脚本终止。错误信息: $($_.Exception.Message)"
    exit
}


# --- 第2步: 通过 Cloudflare API 获取当前的 DNS 记录信息 ---
Write-Log "正在从 Cloudflare 获取 DNS 记录 '$recordName' 的信息..."
$headers = @{
    "Authorization" = "Bearer $apiToken"
    "Content-Type"  = "application/json"
}

$uri_get = "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?type=AAAA&name=$recordName"

try {
    $response_get = Invoke-RestMethod -Uri $uri_get -Method Get -Headers $headers -TimeoutSec 15
    if ($response_get.success -ne $true) {
        throw "API 请求失败: $($response_get.errors | ConvertTo-Json -Depth 5)"
    }
    if ($response_get.result.Count -eq 0) {
        throw "在 Cloudflare 上找不到记录 '$recordName' (类型 AAAA)。请先手动创建它。"
    }
    
    $record = $response_get.result[0]
    $recordId = $record.id
    $currentDnsIp = $record.content
    Write-Log "Cloudflare 上的当前 IP 为: $currentDnsIp"
} catch {
    Write-Log "错误: 获取 Cloudflare DNS 记录失败。脚本终止。错误信息: $($_.Exception.Message)"
    exit
}


# --- 第3步: 比较 IP 地址并按需更新 ---
if ($ipv6Address -eq $currentDnsIp) {
    Write-Log "IP 地址未发生变化。无需更新。"
} else {
    Write-Log "IP 地址已从 '$currentDnsIp' 变为 '$ipv6Address'。正在更新 Cloudflare 记录..."
    
    $uri_update = "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records/$recordId"
    
    $body = @{
        type    = "AAAA"
        name    = $recordName
        content = $ipv6Address
        ttl     = 1 # 1 = Auto
        proxied = $false # RDP 必须为 false
    } | ConvertTo-Json
    
    try {
        $response_update = Invoke-RestMethod -Uri $uri_update -Method Put -Headers $headers -Body $body -TimeoutSec 20
        if ($response_update.success -eq $true) {
            Write-Log "成功! DNS 记录已更新为 '$ipv6Address'。"
        } else {
            throw "API 更新请求失败: $($response_update.errors | ConvertTo-Json -Depth 5)"
        }
    } catch {
        Write-Log "错误: 更新 Cloudflare DNS 记录时发生严重错误。错误信息: $($_.Exception.Message)"
    }
}

Write-Log "脚本执行完毕。"
```

#### **脚本配置与保存**
1. **修改配置**：将脚本中 `--- 用户配置区域 ---` 下的 `$apiToken`、`$zoneId` 和 `$recordName` 替换为你自己的信息。
2. **保存脚本**：将修改后的代码保存到你创建的文件夹中（例如 `C:\DDNS`），文件名为 `update_ddns.ps1`。

---

### **第三步：使用任务计划程序实现自动化**
为了让 DDNS 自动运行，我们需要设置一个定时任务。

1. **打开任务计划程序**：
    - 按 `Win + R` 键，输入 `taskschd.msc`，然后按回车。
2. **创建基本任务**：
    - 在右侧的 “操作” 窗格中，点击 “创建任务...”（不要点“创建基本任务”，我们需要更多高级选项）。
3. **“常规” 选项卡**：
    - **名称**: 给任务起一个名字，例如 `Cloudflare IPv6 DDNS`。
    - **描述**: (可选) 添加一些描述，例如 `每小时更新 RDP 的 IPv6 地址`。
    - **安全选项**: 
        * 选择 “不管用户是否登录都要运行”。
        * 勾选 “使用最高权限运行”。这对于执行网络相关的命令很重要。
4. **“触发器” 选项卡**：
    - 点击 “新建...”。
    - **开始任务**: 选择 “按预定计划”。
    - **设置**: 
        * 选择 “每天”。
        * 在 “高级设置” 中，勾选 “重复任务间隔”，并将其设置为 “1 小时”（或你希望的更新频率）。持续时间设为 “无限期”。
    - 确保 “已启用” 被勾选。
    - 点击 “确定”。
5. **“操作” 选项卡**：
    - 点击 “新建...”。
    - **操作**: 选择 “启动程序”。
    - **程序或脚本**: 输入 `powershell.exe`。
    - **添加参数 (可选)**: 这是**最关键**的一步。在这里输入以下内容（请根据你的脚本路径修改）： 

```plain
-ExecutionPolicy Bypass -File "C:\DDNS\update_ddns.ps1"
```

        * `-ExecutionPolicy Bypass`：绕过执行策略限制，允许脚本运行。
        * `-File "C:\DDNS\update_ddns.ps1"`：指定要运行的脚本文件的完整路径。
6. **“条件” 选项卡**：
    - 在 “网络” 部分，勾选 “只有在以下网络连接可用时才启动”。
    - 选择 “任何连接”。这确保了只有在电脑联网时脚本才会运行。
7. **“设置” 选项卡**：
    - 可以保留默认设置，或者根据需要调整，例如勾选 “如果任务失败，按以下频率重新启动”。
8. **保存任务**：
    - 点击 “确定”。系统会提示你输入当前用户的密码，因为任务需要以你的权限运行。输入密码后，任务就创建好了。

### **第四步：连接和测试**
1. **手动测试**：你可以右键点击刚刚创建的任务，选择 “运行” 来立即执行一次脚本。然后检查 `C:\DDNS` 文件夹下的日志文件，确认脚本是否成功执行。
2. **连接 RDP**： 
    - 在另一台也支持 IPv6 的电脑上，打开 “远程桌面连接” (mstsc.exe)。
    - 在 “计算机” 字段中，输入你的完整子域名，例如 `rdp.yourdomain.com`。
    - 点击 “连接”，然后输入你 Windows 电脑的用户名和密码。

至此，你已经成功配置了基于 Cloudflare 的 IPv6-only DDNS，可以随时通过固定的域名远程访问你的 Windows 电脑了。

---

Related searches:

+ [powershell cloudflare api update AAAA record](https://www.google.com/search?q=powershell+cloudflare+api+update+AAAA+record&client=app-vertex-grounding-quora-poe)
+ [powershell get public ipv6 address](https://www.google.com/search?q=powershell+get+public+ipv6+address&client=app-vertex-grounding-quora-poe)
+ [windows powershell get stable temporary ipv6 address](https://www.google.com/search?q=windows+powershell+get+stable+temporary+ipv6+address&client=app-vertex-grounding-quora-poe)

#### **第二章：第一次失败 - 经典的 **`**0x204**`** 错误**
我们遭遇了第一个拦路虎，一个非常经典的错误提示：

**错误信息摘要：**

+ 远程桌面由于以下原因之一无法连接到远程计算机： 
    1. 未启用对服务器的远程访问
    2. 远程计算机已关闭
    3. 远程计算机在网络上不可用
+ **错误代码: 0x204**

这个错误代码的潜台词是：“**我已经通过域名找到了正确的地址，但我去敲门了，门那边却没有任何回应。**”

这立刻排除了DNS解析本身的问题，说明我们的DDNS脚本至少在“上报地址”这一步是部分成功的。问题出在“连接”这个环节。根据经验，原因通常是防火墙。

**排错行动：**

1. **头号嫌疑人：路由器/光猫的IPv6防火墙**
    - **问题根源：** 出于安全考虑，几乎所有家用网络设备的IPv6防火墙默认都会阻止所有从外部发起的连接请求。即使你的电脑获取了公网IPv6，这道“大门”也是关着的。
    - **解决方案：** 登录路由器或光猫的管理后台，找到“IPv6防火墙”或“安全设置”，添加一条**入站规则**，允许**协议为TCP、目标端口为3389**的流量通过。
2. **二号嫌疑人：Windows防火墙的网络配置文件**
    - **问题根源：** Windows防火墙规则可能只在“专用网络”下生效，而你的网络连接可能被识别为了“公用网络”。
    - **解决方案：** 再次检查“远程桌面”的入站规则，在“高级”选项卡中，确保所有网络配置文件（专用、公用、域）都被勾选。

#### **第三章：深入骨髓 - **`**fc00::**`**，错误的IP地址！**
在我们解决了防火墙的潜在问题后，再次尝试，依旧失败。这时，我们通过与运维的对话，发现了更深层次的问题。我们查看了DDNS脚本的运行日志：

```plain
[2025-07-17 00:40:11] 成功! DNS 记录已更新为 'fc00::d461:da97:9571:809d'。
```

问题一目了然！脚本上报的是一个以 `fc00::` 开头的地址。

+ **这是什么地址？** 这叫做 **唯一本地地址 (Unique Local Address, ULA)**。你可以把它理解为IPv6世界里的“内网IP”，类似于IPv4中的 `192.168.x.x`。这个地址只能在你的局域网内部通信，公网是无法访问的。
+ **为什么会这样？** 因为我们最初的脚本太“天真”了，它只是简单地问操作系统：“给我一个你的IPv6地址”，而操作系统可能因为网络环境（例如路由器开启了某种地址转换）的原因，优先提供了这个本地地址。

**解决方案：让脚本变得“聪明”**

我们需要修改脚本，让它能准确地获取到**公网IPv6地址 (Global Unicast Address, GUA)**，这种地址通常以`2`或`3`开头。

**优化方案 (v2脚本)：**

1. 优先通过本地命令获取IP。
2. **关键：** 明确过滤掉 `fe80::` (链路本地) 和 `fc00::/fd00::` (唯一本地) 的地址。
3. 如果本地找不到合适的公网IP，则启动**备用方案**：访问一个公共的IP查询API（如 `api64.ipify.org`），从外部视角来获取自己的公网IP。

#### **第四章：最后的决战 - IPv4与IPv6的“身份危机”**
我们满怀信心地换上了优化后的v2脚本，再次运行。然而，日志给了我们一个全新的、决定性的错误：

```plain
[2025-07-17 00:48:41] 警告: 未能通过本地命令获取到公网 IPv6 地址。将使用外部API服务...
[2025-07-17 00:48:42] 通过外部API获取到公网 IPv6 地址: 223.65.115.238
...
[2025-07-17 00:48:49] 错误: 更新 Cloudflare DNS 记录时发生严重错误。错误信息: 远程服务器返回错误: (400) 错误的请求。
```

**日志分析揭示了最终的真相：**

1. 脚本在本地确实没找到公网IPv6地址，于是启动了API备用方案。
2. 但我们的电脑在访问API网站时，不知为何**优先走了IPv4通道**。
3. API网站忠实地返回了我们电脑的**公网IPv4地址** (`223.65.115.238`)。
4. 脚本拿着这个IPv4地址，去请求Cloudflare更新一条 **AAAA记录**（这是专门存放IPv6地址的记录）。
5. Cloudflare API发现类型不匹配（想把IPv4塞进IPv6的槽位），于是果断拒绝，返回了 `400 Bad Request` 错误。

**最终解决方案：专一且精准 (v3脚本)**

我们必须杜绝这种模棱两可的情况。

**最终优化方案 (v3脚本)：**

1. 将API地址从 `api64.ipify.org` (双栈，返回你访问时所用的IP类型) 更换为 `**api6.ipify.org**`。
2. 这个 `api6.ipify.org` 端点**只能通过IPv6访问**。这样一来，结果只有两种： 
    - **成功：** 电脑通过IPv6访问了它，并100%获取到了一个正确的公网IPv6地址。
    - **失败：** 电脑的公网IPv6网络不通，连接API直接超时或失败。
3. 这彻底消除了获取到错误IP类型的可能性，让脚本的行为变得可预测且稳定。

在替换为最终版的脚本后，再次运行，日志终于显示一切正常！DNS记录被成功更新为了一个以`2`开头的公网IPv6地址。至此，远程桌面连接成功建立！

#### **第五章：锦上添花 - 让远程桌面更好用**
成功连接只是第一步，我们还可以让体验变得更好。一个最常用的功能就是在远程会话中直接访问本地电脑的硬盘。

**设置方法：**

1. 打开“远程桌面连接”程序 (`mstsc`)。
2. 点击“显示选项”，进入“本地资源”选项卡。
3. 点击“详细信息...”，在弹出的窗口中勾选你想要共享的本地驱动器（如C盘、D盘）。
4. 连接后，在远程电脑的“此电脑”中，你就能看到名为“`C on 本地电脑名`”这样的映射驱动器了，可以自由拖拽文件。

#### **结论与反思**
这次看似简单的DDNS配置，却带我们经历了一场涉及网络协议、防火墙策略、脚本逻辑的完整排错之旅。它告诉我们：

1. **永远不要想当然：** 默认设置往往是为安全而非便利服务的。尤其是路由器的IPv6防火墙，是新手最容易忽略的坑。
2. **理解你使用的工具：** 了解IPv6地址的分类（公网GUA、唯一本地ULA、链路本地LLA）是解决问题的关键。
3. **编写健壮的脚本：** 好的脚本不仅要能完成任务，更要能预见并处理各种异常情况，比如获取到错误的IP类型。增加明确的验证和专用的工具（如IPv6-only API）至关重要。

希望这次详尽的记录，能为你未来的网络探索之路扫清一些障碍。享受随时随地连接的自由吧！

