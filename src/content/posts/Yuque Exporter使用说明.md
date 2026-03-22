---
title: Yuque Exporter使用说明
published: 2025-03-03
description: Git项目中.gitignore文件的配置方法
---

这个脚本的核心任务是：

1. **遍历**你指定的 Markdown 文件。
2. **查找**文件中所有符合语雀图片格式的 URL。
3. **下载**这些 URL 指向的图片。
4. 将图片**保存**到本地（最好是与 Markdown 文件放在一起，利用 Hugo 的页面捆绑功能）。
5. **替换** Markdown 文件中原来的网络 URL 为新的本地路径。

下面，我将为你提供一个开箱即用的 Python 脚本，并详细解释如何使用它来完美解决你的问题。

---

### 方案：使用 Python 脚本自动化处理
这个方案是目前最灵活、最一劳永逸的。我们将编写一个 Python 脚本，它会自动将你的 Markdown 文件转换为 Hugo 推荐的 **页面捆绑（Page Bundle）** 结构，并将所有图片下载到文章对应的文件夹内。

#### 准备工作
1. **安装 Python**: 如果你的电脑还没有安装 Python，请先从 [python.org](https://www.python.org/downloads/) 下载并安装。
2. **安装 requests 库**: 这是一个用来发送网络请求（如下载图片）的库。在你的终端或命令行中运行：

```bash
pip install requests
```

#### Python 脚本 (`yuque_to_hugo.py`)
请将以下代码保存为一个名为 `yuque_to_hugo.py` 的文件，并将它放在你 **Hugo 项目的根目录**（与 `config.toml` 和 `content` 文件夹同级）。

```python
import os
import re
import requests
import hashlib
from urllib.parse import urlparse
import shutil

# --- 配置区 ---
# 你从语雀导出的 Markdown 文件存放的目录
# 假设你把它们都放在了 content/posts/yuque-import 目录下
MARKDOWN_DIR = "content/posts/yuque-import" 
# 语雀图片链接的特征，用于正则匹配
# 修正点: 使用了非捕获分组 (?:...) 来避免产生额外的捕获结果
YUQUE_CDN_PATTERN = r"https?://(?:cdn\.nlark\.com|aliyuncs\.com)/yuque"
# --- 配置区结束 ---

# 正则表达式，用于匹配 Markdown 中的图片链接
# 现在它会正确地只捕获两个部分：1.alt文本, 2.图片URL
IMG_REGEX = re.compile(r"!\[(.*?)\]\((%s.*?)\)" % YUQUE_CDN_PATTERN)

def process_markdown_file(md_file_path):
    """处理单个 Markdown 文件"""
    print(f"--- 开始处理文件: {md_file_path} ---")

    # 1. 将普通 .md 文件转换为 Page Bundle 结构
    dir_path, file_name = os.path.split(md_file_path)
    base_name, ext = os.path.splitext(file_name)
    
    # 如果已经是 index.md 或 _index.md，则直接使用其所在目录
    if file_name.lower() in ["index.md", "_index.md"]:
        bundle_dir = dir_path
        # 如果是这种情况，md_file_path 已经是正确的路径，不需要移动
    else:
        bundle_dir = os.path.join(dir_path, base_name)
        new_md_path = os.path.join(bundle_dir, "index.md")

        if not os.path.exists(bundle_dir):
            os.makedirs(bundle_dir)
            print(f"创建页面捆绑目录: {bundle_dir}")
        
        # 移动并重命名 md 文件
        shutil.move(md_file_path, new_md_path)
        md_file_path = new_md_path
        print(f"已将 {file_name} 移动到 {new_md_path}")

    # 2. 读取新的 md 文件内容
    with open(md_file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 3. 查找所有匹配的图片链接
    # 修正后的 findall 将只返回 (alt_text, url) 这样的二元组
    images = IMG_REGEX.findall(content)
    if not images:
        print("未找到需要处理的语雀图片。\n")
        return

    print(f"找到 {len(images)} 张语雀图片，开始下载和替换...")
    
    # 4. 遍历所有找到的图片链接
    for alt_text, url in images:
        try:
            # 清理 URL，移除 # 后面的参数
            clean_url = url.split('#')[0]
            
            # 生成一个简短且唯一的文件名，避免中文或特殊字符问题
            # 使用 URL 的 MD5 哈希值前8位作为文件名
            file_ext = os.path.splitext(urlparse(clean_url).path)[1] or '.png' # 如果没有后缀，默认为.png
            file_hash = hashlib.md5(clean_url.encode()).hexdigest()[:8]
            new_filename = f"{file_hash}{file_ext}"
            
            # 图片要保存的本地路径
            local_image_path = os.path.join(bundle_dir, new_filename)
            
            # 下载图片
            if not os.path.exists(local_image_path):
                print(f"  -> 正在下载: {clean_url}")
                headers = {'User-Agent': 'Mozilla/5.0'} # 模拟浏览器，防止被禁
                response = requests.get(clean_url, headers=headers, stream=True)
                response.raise_for_status() # 如果下载失败则抛出异常
                
                with open(local_image_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"     保存成功: {local_image_path}")
            else:
                print(f"  -> 图片已存在，跳过下载: {new_filename}")

            # 替换 Markdown 内容中的旧 URL 为新本地路径
            # 注意：这里我们只替换文件名，因为图片和md文件在同一目录
            original_markdown_link = f"![{alt_text}](/images/posts/{url})"
            new_markdown_link = f"![{alt_text}](/images/posts/{new_filename})"
            content = content.replace(original_markdown_link, new_markdown_link)

        except requests.exceptions.RequestException as e:
            print(f"     下载失败: {url}, 错误: {e}")
        except Exception as e:
            print(f"     处理失败: {url}, 错误: {e}")

    # 5. 将修改后的内容写回文件
    with open(md_file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"文件 {md_file_path} 处理完成。\n")


if __name__ == "__main__":
    if not os.path.isdir(MARKDOWN_DIR):
        print(f"错误: 目录 '{MARKDOWN_DIR}' 不存在。请检查配置。")
    else:
        # 遍历目录下的所有 .md 文件
        for root, _, files in os.walk(MARKDOWN_DIR):
            # 创建一个文件列表的副本进行迭代，因为我们可能会在循环中重命名文件
            for file in list(files):
                if file.endswith(".md"):
                    process_markdown_file(os.path.join(root, file))
        print("所有 Markdown 文件处理完毕！")
```

### 如何使用这个脚本？
1. **导出并放置文件**:
    - 从语雀批量导出你的文章为 Markdown 格式。
    - 在你的 Hugo 项目的 `content/posts/` 目录下，创建一个新文件夹，比如 `yuque-import`。
    - 将所有导出的 `.md` 文件**复制**到 `content/posts/yuque-import/` 目录中。
2. **配置脚本**:
    - 打开 `yuque_to_hugo.py` 文件。
    - 确认 `MARKDOWN_DIR` 变量的值与你上一步创建的文件夹路径一致。默认是 `content/posts/yuque-import`，如果你的路径不同，请修改它。
3. **运行脚本**:
    - 打开你的终端（命令行工具）。
    - 确保你当前位于 Hugo 项目的根目录。
    - 运行脚本：

```bash
python yuque_to_hugo.py
```

4. **查看结果**:
    - 脚本运行后，你会看到一系列处理日志。
    - 完成后，检查你的 `content/posts/yuque-import/` 文件夹。你会发现原来的 `文章名.md` 文件都变成了 `文章名/index.md` 的结构，并且每个文件夹里都包含了该文章下载好的图片。
    - 打开任意一个 `index.md` 文件，你会看到图片链接 `[...](https://cdn.nlark.com/...)` 已经被替换成了 `[...](abcdef12.png)` 这样的本地链接。

### 脚本工作流程详解
+ **转换为页面捆绑**: 脚本首先将 `文章A.md` 这样的文件，转换成 `文章A/index.md` 的目录结构。这是 Hugo 的最佳实践，便于管理与文章相关的资源。
+ **正则匹配**: 使用正则表达式精准地找出所有语雀的图片链接。
+ **生成唯一文件名**: 直接使用 URL 中的文件名可能很长或包含特殊字符。脚本通过计算 URL 的 MD5 哈希值来生成一个简短、唯一且安全的新文件名，如 `abcdef12.png`。
+ **下载与保存**: 模拟浏览器下载图片，并将其保存在与 `index.md` 同一个文件夹下。
+ **路径替换**: 将 Markdown 中的长 URL 替换为新的、简单的本地文件名。因为图片和 `index.md` 在同一目录，所以可以直接引用文件名，非常简洁。

现在，你只需要 `hugo server` 启动本地预览，或者直接 `git add .`, `git commit`, `git push` 部署，你的博客就会完美地显示所有图片，并且这些图片已经成为了你博客项目的一部分，不再依赖语雀的服务器。这个脚本可以反复运行，以后每次从语雀导出新文章，只需重复上述步骤即可。

