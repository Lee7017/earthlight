# Earthlight · 此刻的昼与夜

**一个真正根据当前太阳位置计算昼夜的纯前端 3D 地球。**

- [GitHub Pages 在线地址](https://lee7017.github.io/earthlight/)（首次使用前，需要在仓库设置中启用 Pages）
- [部署日志](https://github.com/Lee7017/earthlight/actions)
- [GitHub Pages 设置](https://github.com/Lee7017/earthlight/settings/pages)

## 你会看到什么？

- 🌍 **面向中国的默认视角**：相机初始正对北纬 35°、东经 105°，可拖动旋转、滚轮/手势缩放，并一键重置。
- ☀️ **实时太阳方向**：使用当前 UTC 时间和近似太阳星历计算太阳直射点，光照随时间连续变化。
- 🌗 **准确的几何晨昏线**：晨昏线是与太阳方向垂直、穿过地球球心的平面和地球球面的交线；可单独隐藏或显示。
- 🌃 **白昼和夜晚**：白天显示地表贴图、夜晚显示城市灯光。大气光晕仅是装饰，不影响昼夜几何计算。
- ⏩ **24 小时预演**：点击地球下方的「24 小时预演」按钮，将从点击瞬间起未来 24 小时的太阳位置、昼夜光影与晨昏线压缩成 **24 秒**播放。界面同时显示预演时间和进度，可按「退出预演」随时回到实时模式，播放完毕也自动返回实时状态。地球视角仍可自由旋转。
- 🕒 **中国标准时间与 UTC**：每秒自动更新，不需要后端、账号、API 密钥或位置权限。

## GitHub Pages 首次部署

当前 GitHub Actions 已配置好 **每次推送 main 自动部署**，但**新仓库需要先在 GitHub 网页开启 Pages**：

1. 打开 [Settings → Pages](https://github.com/Lee7017/earthlight/settings/pages)。
2. 找到 **Build and deployment → Source**，选择 **GitHub Actions**（不要选择 Deploy from a branch）。
3. 打开 [Actions → Deploy Earthlight to GitHub Pages](https://github.com/Lee7017/earthlight/actions/workflows/deploy.yml)，重新运行最近失败的任务：**Re-run jobs → Re-run all jobs**。
4. 工作流成功后访问 **https://lee7017.github.io/earthlight/**。

> 工作流需要的 `contents: read`、`pages: write`、`id-token: write` 权限已在 `.github/workflows/deploy.yml` 中配置好。首次启用 Pages 是仓库管理设置，不能仅靠默认的 `GITHUB_TOKEN` 自动完成。

## 在本地运行

项目采用浏览器原生 ES Modules + Three.js；**不需要 npm install 或构建步骤**。由于浏览器限制，不能直接双击打开 HTML，需要从本地 HTTP 服务器访问：

```bash
git clone https://github.com/Lee7017/earthlight.git
cd earthlight
python3 -m http.server 8000
```

然后打开 http://localhost:8000/。

也可以运行天文计算单元测试（Node.js 20+）：

```bash
node --test src/*.test.js
node --check src/main.js
```

## 技术说明：是真实天文数据还是动画？

太阳直射点根据浏览器当前 UTC 日期计算，依据 NOAA/Meeus 近似公式：儒略日、儒略世纪、太阳平均黄经和近点角、轨道离心率、黄经修正、黄赤交角、太阳赤纬和均时差。经纬度与太阳方向的转换经过专门的单元测试。

- **昼夜判断**：地表法向量与太阳方向的点积大于零为白昼，小于零为黑夜，等于零为理论晨昏线。
- **太阳高度角**：中国参考点取北纬 35°、东经 105°，以地平面为零度。
- **季节、地轴倾斜、春秋分和冬夏至**：通过太阳赤纬自然体现，并不需要读取中国农历。
- **精度范围**：适合当代日期的通用教育/可视化用途，不是 NASA JPL 高精度天文历表。没有考虑地形遮挡、大气折射、太阳视半径、岁差的全部高阶修正等；实际肉眼可见的日出日落与几何晨昏线可能略有差异。
- **渲染与实际尺度**：地表贴图和夜间城市灯光是静态图像；太阳标记只表示太阳方向，不按实际太阳大小和日地距离缩放。也没有实时卫星云图。

## 技术栈与资源

- Vanilla HTML / CSS / JavaScript（静态页面）
- Three.js r180（通过 jsDelivr CDN 导入），包括 OrbitControls
- Three.js 示例地球日间纹理和夜间灯光纹理（通过 jsDelivr CDN 加载）
- GitHub Actions + GitHub Pages（免费静态托管，公共仓库）

项目运行时**依赖网络下载 Three.js 和公开纹理**，但不会请求后端业务服务或向服务器上传位置数据。站点托管在 GitHub Pages 上，本身是纯静态的。

## 结构

```text
earthlight/
├── index.html                 # 仪表盘布局
├── favicon.svg
├── src/
│   ├── main.js               # Three.js 场景、纹理、交互、实时更新
│   ├── styles.css            # 响应式页面样式
│   ├── solar.js              # 天文计算，不依赖 Three.js
│   ├── solar.test.js         # 天文计算单元测试
│   ├── preview.js            # 24 小时预演的时间推进逻辑
│   └── preview.test.js       # 预演时间/边界测试
└── .github/workflows/
    └── deploy.yml            # CI 校验并发布 GitHub Pages
```
