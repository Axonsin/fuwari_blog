---
title: Conda常用命令
published: 2025-11-03
category: 依旧AI
---


### 🧪 一、基础信息


```bash
conda --version          # 查看 Conda 版本conda info               # 查看 Conda 和当前环境详细信息conda config --show      # 查看所有配置项
```


### 🌐 二、环境管理


```bash
# 创建环境conda create -n myenv python=3.9           # 创建指定 Python 版本的环境conda create -n myenv numpy pandas         # 创建时安装包conda env create -f environment.yml        # 从 YAML 文件创建环境# 激活/退出环境conda activate myenv      # 激活环境（Windows/Linux/macOS 通用）conda deactivate          # 退出当前环境# 查看环境conda env list            # 列出所有环境（带 * 的是当前激活的）conda info --envs         # 同上# 删除环境conda remove -n myenv --all   # 删除整个环境# 克隆环境conda create -n new_env --clone old_env# 导出环境conda env export > environment.yml                 # 完整导出（含平台信息）conda env export --no-builds | grep -v "^prefix:" > environment.yml  # 跨平台友好版
```


### 📦 三、包管理（在当前激活环境中操作）


```bash
# 安装包conda install numpyconda install numpy=1.21            # 指定版本conda install -c conda-forge scipy  # 从指定 channel 安装# 查看包conda list                # 列出当前环境所有包conda list numpy          # 查看特定包是否安装及版本# 更新包conda update numpy        # 更新单个包conda update --all        # 更新所有包conda update conda        # 更新 Conda 自身# 删除包conda remove numpy# 搜索包conda search numpyconda search "numpy>=1.20"
```


> 💡 提示：在 Conda 环境中也可以用 pip install，但优先用 conda install，避免依赖冲突。


### 🔄 四、环境迁移与分享


```bash
# 导出（见上文）conda env export > environment.yml# 从文件创建环境conda env create -f environment.yml
```


### 🧹 五、清理缓存（释放磁盘空间）


```bash
conda clean -a            # 删除所有未使用的包、tarballs、索引缓存等conda clean --packages    # 仅删除未使用的包conda clean --tarballs    # 仅删除下载的压缩包conda clean -i            # 清除索引缓存（切换镜像源后建议执行）
```


### 🪞 六、镜像源管理（国内加速推荐）


```bash
# 添加清华源（推荐）conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/mainconda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/freeconda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge# 显示安装来源conda config --set show_channel_urls yes# 查看当前 channelsconda config --show channels# 恢复默认源conda config --remove-key channels
```


### ✅ 小贴士
