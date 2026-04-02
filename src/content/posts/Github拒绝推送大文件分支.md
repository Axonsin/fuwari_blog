---
title: Github拒绝推送大文件分支
published: 2025-03-27
category: 朝花夕拾
---

在本地git完后准备推送的时候，有时候会报错Github不接受单个100MB以上的大文件。这时候需要逐步分析大文件并进行逐一排查。
查看该仓库中存在的大文件：

```text
git rev-list --objects --all | git cat-file --batch-check='%(objectname) %(objecttype) %(size)' | sort -k 3 -n -r | head -n 10
```


## 方式1：使用git-lfs


git lfs支持将指定类型的大文件做处理（如指定zip、rar等），但是在对于排查后的项目文件可能难以指定(比如说一般的插件也会过大，但是文件类型并不一致不能简单地写文件类型）

## 方式2：使用git filter-repo


git filter-repo是一个屏蔽/删除工具,可以定向清除指定的文件夹和文件并可以对分支中的所有版本生效。
在git中安装：

```text
pip install git-filter-repo
```


然后指定文件夹/文件并删除（这里以插件文件夹为例）：

```text
git filter-repo --path plugins/large_file.zip --invert-paths
```


此时的历史版本已被修改，需要重写。因此在git push的时候需要指定--force。
对于SourceTree只能回退版本了；当然也是有弊端的，如果这个文件已经在多个提交甚至在一开始就提交过，那么不管回退多少都是没用的，只能用git filter-repo了。