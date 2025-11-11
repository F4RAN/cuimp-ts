# 使用 GitHub Release 版本

## 安装方法

### 方式 1: 直接从 GitHub 安装（最简单）

```bash
npm install github:ma-joel/cuimp-ts#v1.3.0
```

或者在 `package.json` 中添加：

```json
{
  "dependencies": {
    "cuimp": "github:ma-joel/cuimp-ts#v1.3.0"
  }
}
```

然后运行：
```bash
npm install
```

### 方式 2: 使用 Release 压缩包

1. 从 [Releases 页面](https://github.com/ma-joel/cuimp-ts/releases) 下载 `cuimp-ts-dist.tar.gz`
2. 解压到本地目录
3. 安装：

```bash
npm install ./path/to/cuimp-ts
```

### 方式 3: 使用最新版本（不推荐生产环境）

```bash
npm install github:ma-joel/cuimp-ts
```

这会安装 main 分支的最新代码。

## 在你的项目中使用

安装后，你的 `batch_download.js` 可以这样引用：

```javascript
import { createCuimpHttp } from 'cuimp';

const cuimp = createCuimpHttp({
  extraCurlArgs: [
    '-b', 'cookies.txt',
    '-c', 'cookies.txt'
  ]
});

// 使用 cuimp...
```

## 新功能

### 1. Raw Buffer 支持（GBK 编码）

```javascript
const response = await cuimp.get('https://example.com');
const rawBody = response.data.rawBody; // Buffer
const text = iconv.decode(rawBody, 'gbk'); // 正确解码 GBK
```

### 2. extraCurlArgs 支持

```javascript
// 全局配置
const cuimp = createCuimpHttp({
  extraCurlArgs: ['-b', 'cookies.txt', '-c', 'cookies.txt']
});

// 单次请求配置
await cuimp.get(url, {
  extraCurlArgs: ['--connect-timeout', '30']
});
```

### 3. 改进的响应解析

现在可以正确处理：
- 多次重定向
- 压缩响应（自动解压）
- 响应体中包含 `\r\n\r\n` 的情况

## 切换回官方版本

当官方 cuimp 合并了你的 PR 后，切换回官方版本：

```bash
npm uninstall cuimp
npm install cuimp@latest
```

或修改 `package.json`：

```json
{
  "dependencies": {
    "cuimp": "^1.3.0"  // 假设官方版本号
  }
}
```

## 验证安装

```bash
node -e "import('cuimp').then(m => console.log('cuimp loaded successfully'))"
```

## GitHub Actions 工作流

每次推送新的 tag（如 `v1.3.0`）时，GitHub Actions 会自动：

1. 运行所有测试
2. 构建 dist 目录
3. 创建 Release
4. 上传两个压缩包：
   - `cuimp-ts-dist.tar.gz` - 完整包（包含 src, dist, package.json 等）
   - `cuimp-ts-dist-only.tar.gz` - 仅 dist 目录

## 故障排查

### 安装失败

如果从 GitHub 安装失败，可能需要配置 Git 认证：

```bash
git config --global url."https://github.com/".insteadOf git://github.com/
```

### 找不到模块

确保 `package.json` 中的引用正确：

```json
{
  "type": "module",
  "dependencies": {
    "cuimp": "github:ma-joel/cuimp-ts#v1.3.0"
  }
}
```
