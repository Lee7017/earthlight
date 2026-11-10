# Earthlight · 此刻的昼与夜

**一个真正根据当前太阳位置计算昼夜的纯前端 3D 地球，支持 2K、4K、8K 自适应地图精度。**

- [GitHub Pages 在线地址](https://lee7017.github.io/earthlight/)（首次使用前，需要在仓库设置中启用 Pages）
- [部署日志](https://github.com/Lee7017/earthlight/actions)
- [GitHub Pages 设置](https://github.com/Lee7017/earthlight/settings/pages)

## 你会看到什么？

- 🌍 **面向中国的默认视角**：相机初始对准北京（39.9042°N, 116.4074°E），可拖动旋转、滚轮/手势缩放，并一键重置。右侧说明面板已移除，地球获得更宽的显示区域。
- 📍 **只保留北京**：地球上只显示北京定位点，不再有城市切换栏；「回到北京」按钮可随时将镜头对准北京，光照、自转、公转及两种预演保持不变。
- 🟠 **左侧水平圆桌光照模型**：地表地图沿倾斜的地轴真正自转；金色半透明带标出南北回归线之间的纬度区域，独立于地表自转；青绿色水平圆圈位于公转轨道平面，表示太阳直射方向一年中在空间中的轨迹；金色箭头标记当下阳光的入射方向，晨昏线与光照半球由这一方向确定，不再每天独立绕球扫动。水平圆圈不是整圈同时受到太阳直射，任何时刻只有一个直射点。
- 🪐 **地球公转 + 自转 3D 轨道总览**：太阳固定在轨道焦点，地球围绕太阳公转，同时沿倾斜约 23.44° 的地轴自转。地轴在公转中朝向近似固定的空间方向，轨道包含椭圆离心率，显示四季位置与当前 UTC 日期。
- 🔭 **三种视图**：地表、轨道、双视图（默认）。主地球与轨道总览使用同一个天文时间；地表视图中的地图实际自转，太阳来光在公转轨道平面内缓慢改变方向，晨昏线在空间中随来光决定，轨道视图解释造成它变化的自转与公转。
- 🌸 **365 天 · 四季预演**：将一个**回归年（约 365.2422 日）**压缩为 **720 秒（12 分钟）**；每经过一个太阳日约 **1.97 秒**，地球沿太阳轨道运行一周、自转、地轴基本保持原方向，同时主地球的晨昏线与直射点随季节变化；可提前退出，播完自动恢复当前 UTC。
- ☀️ **实时太阳方向**：使用当前 UTC 时间和近似太阳星历计算太阳直射点，光照随时间连续变化。
- 🌗 **准确的几何晨昏线**：晨昏线是与太阳方向垂直、穿过地球球心的平面和地球球面的交线；可单独隐藏或显示。
- 🌃 **白昼和夜晚**：白天显示地表贴图、夜晚显示城市灯光。大气光晕仅是装饰，不影响昼夜几何计算。
- 🔎 **更高清的全球纹理**：太阳白昼地图和夜间城市灯光均使用 8192×4096 的 8K 原始素材，构建时生成 4K 与 2K 版本。桌面设备默认 4K，内存足够且宽屏的设备可自动使用 8K，手机默认 2K，兼顾画质、速度与显存。地球球面从 128×96 细分提升为 192×128，并使用 16× 各向异性过滤上限与 mipmap。
- ⏩ **24 小时预演**：点击地球下方的「24 小时预演」按钮，将从点击瞬间起未来 24 小时的太阳位置、昼夜光影与晨昏线压缩成 **24 秒**播放。界面同时显示预演时间和进度，可按「退出预演」随时回到实时模式，播放完毕也自动返回实时状态。地球视角仍可自由旋转，地表地图自身也会实际转动。轨道总览同步显示自转，水平参考圈不会随着地表自转。
- 🕒 **中国标准时间与 UTC**：每秒自动更新，不需要后端、账号、API 密钥或位置权限。

## GitHub Pages 首次部署

当前 GitHub Actions 已配置好 **每次推送 main 自动部署**，但**新仓库需要先在 GitHub 网页开启 Pages**：

1. 打开 [Settings → Pages](https://github.com/Lee7017/earthlight/settings/pages)。
2. 找到 **Build and deployment → Source**，选择 **GitHub Actions**（不要选择 Deploy from a branch）。
3. 打开 [Actions → Deploy Earthlight to GitHub Pages](https://github.com/Lee7017/earthlight/actions/workflows/deploy.yml)，重新运行最近失败的任务：**Re-run jobs → Re-run all jobs**。
4. 工作流成功后访问 **https://lee7017.github.io/earthlight/**。

> 工作流需要的 `contents: read`、`pages: write`、`id-token: write` 权限已在 `.github/workflows/deploy.yml` 中配置好。首次启用 Pages 是仓库管理设置，不能仅靠默认的 `GITHUB_TOKEN` 自动完成。

## 在本地运行

项目是一个纯静态网站。为了避免用户浏览器被第三方 CDN 阻断，发布时会把 Three.js 打包进 JavaScript，并把地球的 2K/4K/8K 昼夜贴图放进站点目录。**最终页面不需要后端，也不会从 CDN 加载 JS 或地球贴图。**

需要 Node.js 20+，本地运行：

```bash
git clone https://github.com/Lee7017/earthlight.git
cd earthlight
npm install
npm start
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
- **实际运动机制**：在日心黄道坐标中，太阳固定在原点、地球在椭圆轨道上公转；地轴倾角取太阳历算得到的黄赤交角，地球自转角根据太阳直射点反推，确保地表视图和轨道视图的日期、地理日照方向一致。
- **季节、地轴倾斜、春秋分和冬夏至**：通过太阳赤纬自然体现，并不需要读取中国农历。
- **精度范围**：适合当代日期的通用教育/可视化用途，不是 NASA JPL 高精度天文历表。没有考虑地形遮挡、大气折射、太阳视半径、岁差的全部高阶修正等；实际肉眼可见的日出日落与几何晨昏线可能略有差异。
- **渲染与实际尺度**：地表贴图和夜间城市灯光是静态图像；轨道图中地球和太阳的球体大小刻意放大以便看清，日地真实距离与球体大小不按比例；轨道位置及光照方向遵循天文近似计算，也没有实时卫星云图。

## 技术栈与资源

- Vanilla HTML / CSS / JavaScript（静态页面）
- Three.js r180 + esbuild：构建时本地打包，包括 OrbitControls
- Three.js 示例地球日间纹理和夜间灯光纹理（构建时下载，发布后由本站同源加载）
- GitHub Actions + GitHub Pages（免费静态托管，公共仓库）

网页运行时不依赖第三方 JavaScript CDN 或第三方地球贴图 CDN（字体可以回退到系统字体）；构建时由 GitHub Actions 下载所需资源并打包。不会上传用户位置数据。

### 高精度地图素材署名与授权

昼夜 8K 贴图由 **Solar System Scope** 制作，素材使用 CC BY 4.0 授权，基于 NASA 的公开影像进行了拼接与色彩处理。所有 4K、2K 图片均从原始 8K 图片缩小生成，项目网站页脚保留署名。

- [Solar System Scope 地图素材](https://www.solarsystemscope.com/textures/)
- [CC BY 4.0 授权说明](https://creativecommons.org/licenses/by/4.0/)
- [Wikimedia 昼间贴图](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg)
- [Wikimedia 夜间贴图](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_nightmap.jpg)

注意：8K 是全地球纹理分辨率，并不代表能够看到街道级细节，纹理也不是实时卫星画面。不同设备会根据显存和屏幕宽度自动选择较合适的纹理档位。

## 结构

```text
earthlight/
├── index.html                 # 仪表盘布局
├── favicon.svg
├── scripts/build.mjs         # 打包静态资源和地球贴图
├── tests/browser-smoke.mjs   # 在真实 Chrome 中点击预演并测试
├── src/
│   ├── main.js               # Three.js 场景、纹理、交互、实时更新
│   ├── styles.css            # 响应式页面样式
│   ├── cities.js             # 北京的固定坐标与默认视角
│   ├── cities.test.js        # 北京坐标与唯一定位点的测试
│   ├── illuminationFrame.js    # 水平来光圈与倾斜回归带的数学关系\n│   ├── illuminationFrame.test.js # 光照几何单元测试\n│   ├── illuminationScene.js    # 左图自转地球、斜带、水平圈和阳光箭头\n│   ├── orbitPhysics.js       # 日心轨道、公转、自转、地轴与季节（纯数学）
│   ├── orbitPhysics.test.js  # 公转与自转的物理一致性测试
│   ├── orbitViewer.js        # 3D 太阳系局部轨道渲染
│   ├── solar.js              # 天文计算，不依赖 Three.js
│   ├── solar.test.js         # 天文计算单元测试
│   ├── preview.js            # 24 小时预演的时间推进逻辑
│   └── preview.test.js       # 预演时间/边界测试
└── .github/workflows/
    └── deploy.yml            # CI 校验并发布 GitHub Pages
```
