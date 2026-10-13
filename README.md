# 离线证件水印 / Offline Document Watermark

在浏览器中给图片和 PDF 添加用途水印，导出适合发送的 PNG、JPEG 或多页图片型 PDF。提供 GitHub Pages 在线版和单文件离线版，处理文件时不上传、不联网。

- **在线使用：** https://zouchenzhen.github.io/offline-document-watermark/
- **下载离线文件：** [Releases](https://github.com/zouchenzhen/offline-document-watermark/releases)，下载对应版本的 HTML 文件后双击打开。
- **源码：** 本仓库 `src/`；原创代码使用 MIT，方便分发、复用和贡献。

## 适合什么场景

身份证样本、申请材料、截图等文件需要写明“仅供某接收方办理某事项使用”，并希望水印与页面图像融合，避免别人用 PDF 编辑器直接选中水印文字删除。

本项目只做这个工作流程，不替代 GIMP 的精细修图、Acrobat 的 OCR、表单、数字签名和 PDF 编辑功能。它不会保证图片无法修图，也不会自动认定某个接收方泄露了材料。

## 示例结果

示例一使用明确标记 SAMPLE 的身份证模板，不是真实身份证；其公共领域状态已用 Commons 官方元数据核实。示例二保留 16Personalities 截图的通用版式，当前演示已将类型、百分比、人物插画及类型色组改成虚构数据和原创中性图形。示例素材不自动适用代码的 MIT 许可，见 [素材说明](docs/examples/ATTRIBUTION.md)。

![身份证样本的重复水印效果](docs/examples/id-card-watermarked.png)

![网页截图的重复水印效果](docs/examples/screenshot-watermarked.png)

可下载 [PNG 示例](docs/examples/id-card-watermarked.png)、[JPEG 示例](docs/examples/id-card-watermarked.jpg) 和 [两页图片型 PDF 示例](docs/examples/two-page-watermarked.pdf)。它们使用公开演示追踪编号 `12AB34CD56EF7890`，不是任何人的私人编号。

## 如何使用

以下是在线版的实际操作界面，使用公开身份证样本和演示追踪编号：

![v0.3 实际操作界面](docs/interface-desktop-v0.3.jpg)

窄屏布局采用单列，并提供设置与预览的快捷跳转。窄屏截图是桌面 Chromium 的尺寸模拟，不是手机实机认证。

<details>
<summary>查看窄屏预览界面</summary>

![v0.3 窄屏预览界面](docs/interface-mobile-v0.3.jpg)

</details>

1. 打开在线版，或下载离线 HTML 后在现代 Chrome、Edge 等浏览器中打开。敏感文件建议断网使用离线版。
2. 选择一个 PDF，或多张 PNG/JPEG/WebP 图片。切换预览页；需要时填写导出页码，例如 `1-3,5`。
3. 输入接收方、用途和日期。调整水印密度、不透明度、字号、角度、颜色和覆盖区域，让材料仍清晰可辨。
4. 选择 PDF 渲染清晰度、输出最长边、JPEG/PDF 图片质量。
5. 按需要开启隐藏追踪标记和元信息，为不同接收方生成不同编号。
6. 保存 PNG、JPEG 或多页 PDF。图片只保存当前预览页；PDF 保存选定页。
7. 下载追踪记录，自己保管接收方与编号的对应关系。关闭页面后，本工具不会替你保存这些记录。

导入已经加了水印的 PDF 时，选择 **“仅合成发送版”**，可以不新增可见文字，保留原页面外观并输出图片型 PDF。此模式不提取或识别原有水印文字；用途说明可留空，仅在勾选元信息时记录补充说明。

## 功能

| 功能 | v0.3.0 |
|---|---|
| PNG/JPEG/WebP 输入 | 支持，最多 30 张 |
| 多页 PDF 输入 | 支持，最多 100 页；加密 PDF 暂不支持 |
| 重复、多行用途水印 | 支持 |
| 仅合成发送版、保留已有页面外观 | 支持，不要求额外水印文字 |
| 水印密度、颜色、角度、字号、不透明度 | 支持 |
| 整页、半页、自定义矩形覆盖 | 支持 |
| PNG/JPEG 图片导出 | 支持，当前页 |
| 多页图片型 PDF 导出 | 支持，单次最多 30 页 |
| 清晰度和文件大小控制 | PDF 150/200/300/400 dpi、最长边限制、JPEG 质量 |
| 输出水印元信息 | PNG iTXt、JPEG COM、PDF Info |
| 隐藏像素标记 | 实验性、公开格式、辅助识别 |
| 本地追踪验证和 JSON 记录 | 支持；PDF 像素验证仅第一页 |
| OCR、编辑原文、表单、数字签名 | 不提供 |

## 与同类工具比较

同类项目已经很多，本项目的定位是 **把离线证件水印、图片型 PDF 发送版和辅助追踪整合进可直接保存的单文件网页**。基础图片水印和 PDF 光栅化都不是本项目独有的技术。

以下选取用途接近的代表项目，按 **2026-10-14** 可见的官方源码、文档和许可核查，不是全网穷尽清单。第三方工具未在本次逐一运行，也没有相同设备和素材的速度、内存或抗攻击对测。固定源码链接和隐私边界见 [详细比较与核查依据](docs/ALTERNATIVES.md)。

### 轻量图片和证件水印工具

| 工具 / 许可 | 已有优势 | PDF 与输出方式 | 相比本项目的取舍 |
|---|---|---|---|
| [sfz](https://github.com/joyqi/sfz) / GPL-3.0-only | 适合简单单图流程，基础重复水印参数齐全 | 图片 → PNG；像素合成；无 PDF | 可自行构建；核查的官方发布分支含 Google Analytics；无 PDF/追踪验证 |
| [Efrice/watermark](https://github.com/Efrice/watermark) / MIT | 多行文字、行列数、位置、间距、压缩；可选保存配置 | 图片 → PNG；多页 PDF → 图片型 PDF | 同样支持像素合成；PDF 固定 `scale: 1`，无 DPI、选页或追踪验证；需静态资源目录 |
| [水印姬](https://github.com/TransparentLC/watermarker) / AGPL-3.0 | 文字/图片/浮雕、混合模式、拖拽/粘贴，样式更丰富 | 图片 → PNG/JPEG/WebP；像素合成 | 无 PDF/隐藏标记；部分字体外联，PWA 离线声明未实测 |
| [WaterMark Pro](https://github.com/turkyden/watermark-pro) / MIT | 多图切换、重复文字水印、批量 ZIP 下载 | 图片 → Canvas 编码的 PNG/ZIP | 本项目尚无图片 ZIP；它未见 PDF 流程，默认含 CDN、百度统计及 Hotjar |

### PDF 和通用图像工具

| 工具 / 许可 | 已有优势 | 水印处理方式 | 相比本项目的取舍 |
|---|---|---|---|
| [filigrane](https://github.com/Bank-Exit/filigrane) / README 声明 GPLv3 | PDF 重复水印、小字 ID/日期、元信息及验证页 | 原 PDF 追加文字对象，保留原结构 | 不等同像素发送版；核查版本仍使用 CDN worker，非完整自包含文件 |
| [pdfcpu](https://github.com/pdfcpu/pdfcpu) / Apache-2.0 | 本地命令行，批量处理，文字/图片/PDF 水印和大量 PDF 操作 | PDF 结构水印；提供添加、更新和移除接口 | 适合自动化及保留原文、矢量；其结构水印可被移除，非本项目的像素发送版 |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) / MIT 核心，专有组件另有条款 | 自托管 PDF 工具箱，合并、拆分、转换、OCR 等 | 可选水印后转图片，支持整页光栅化 | 功能更广；Web 模式需后端处理，非单 HTML；组件能力及许可需核对 |
| [GIMP](https://www.gimp.org/) / GPL-3.0-or-later | 离线桌面精细修图，图层、选区和丰富图像格式 | 导入 PDF 页面，合并图层后导出图片 | 精细编辑更强；分页水印需手工/脚本；工程图层仍可编辑，须发送合成结果 |

外部资源或统计请求不等于图片上传；源码核查也不证明在线站点始终与仓库一致。第三方默认配置的具体证据和本地使用条件见详细比较。

**本项目的优势：** 无需安装服务器或桌面软件；发布的 HTML 内置 PDF 资源，不含广告、统计或远程字体；可统一处理图片和多页 PDF，控制水印密度、覆盖区域、清晰度及导出页码；提供 PNG/JPEG/PDF 元信息、实验性隐藏标记和导出后读回验证。MIT 也便于分发和集成，但不会要求衍生项目继续开源。

**本项目的不足：** 单文件约 6 MiB，比仅处理图片的小网页重；PDF 光栅化耗费计算和内存，输出可能变大，且丢失可搜索文字、表单和数字签名；存在页数、文件大小和像素上限，不支持加密 PDF；尚不能以图片/Logo 作为水印，也未提供 WebP 输出、批量图片 ZIP 或专业修图功能。独立 Chrome/Edge、手机实机和直接双击本地 HTML 的验收仍未完成，不能据桌面预览宣称全平台兼容。

**保护程度：** 本项目、sfz 和其他 Canvas 图片工具都把水印合入像素，避免将水印作为独立文字或图层直接删除；同等画质和覆盖条件下，没有证据说明本项目更抗修图或 AI 去水印。Efrice 的图片型 PDF 和 Stirling 的光栅化模式也具有同类对象删除防护。隐藏编号、元信息及追踪记录只辅助核对，不能保证抗裁剪、缩放或伪造，也不能单独证明谁泄露了材料。

## 隐私和“不可篡改”的实际含义

页面、PDF.js、worker、字体和解码资源全部内置，约 6 MiB。无需后端、CDN、账号、上传接口或运行时包下载。页面策略禁止网络连接，不使用遥测、浏览器持久存储或 Service Worker。

GitHub Pages 会看到首次网页访问的普通日志；这与选入文件的本地处理不同。离线文件在断网后也能运行。输出目录的云同步、浏览器扩展、恶意软件和收件人行为不受本工具控制。详见 [PRIVACY.md](PRIVACY.md)。

可见水印成为图片像素，输出 PDF 不保留独立水印文字和无水印原图。这能阻止普通对象删除，但不能保证抵抗裁剪、修图或 AI 去水印。

隐藏标记使用公开、无密钥的中频 DCT 投影编码，包含追踪编号和 CRC。当前实现限制每个 RGB 通道的改动最多为 10，并在嵌入后即时自检；JPEG/PDF 还会对实际压缩字节读回验证。若不能确认标记，停止下载并提示调整设置，不静默声称成功。它仍不是密码学签名；可被伪造或针对性去除。元信息也可被删除。**不得把检出的编号单独当作传播者身份或法证证明。**

关闭隐藏标记表示“不新增”，不等于删除原文件已有的像素标记。“仅合成发送版”保留已有页面外观，不能保证清除输入文件中的旧追踪信号。

当前两张文档示例在 JPEG 质量 92/80/60 导出后检出了编号；这仅是样本测试结果，不是对所有压缩器、素材或处理方式的保证。缩放测试导致标记丢失。实际结果见 [测试记录](docs/examples/marker-test-results.json)。

## 构建和发布

需要 Node.js 22.13 或更高版本。依赖已保留在 `vendor/pdfjs/`，构建不需要下载 npm 包。

```sh
npm test
npm run test:pdf
npm run build
npm run package
```

输出：

- `dist/offline-watermark-v<版本>.html`：可双击使用的自包含 HTML。
- `dist/offline-watermark-v<版本>.zip`：可复现打包的 HTML、许可和隐私说明。
- `dist/SHA256SUMS.txt`：打包后同时校验 HTML 和 ZIP；ZIP 内部清单只校验 HTML，避免循环。
- `dist/site/`：可部署到 GitHub Pages 的静态内容。

仓库包含 Pages 工作流；main 分支推送后构建并部署。在线页和离线页使用相同实现。下载后可以用系统工具核对 SHA-256。

## 验证情况与限制

纯函数测试涵盖页码范围、尺寸限制、追踪格式、隐藏标记嵌入/检测/缩放失效、PNG/JPEG 元信息、PDF 页结构和密度控制。另用两张示例检查真实 PNG/JPEG 编解码、JPEG 压缩后检测、PDF.js 多页解析，以及严格 PDF 读取器的输出检查。

浏览器与移动端交互验证记录见 [docs/VALIDATION.md](docs/VALIDATION.md)。不能把算法测试当成所有浏览器兼容性已验证。

v0.3.0 的验收状态见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。回归测试覆盖异步文件状态、预览失败、逐页解码、压缩后追踪检查、确定性构建与打包，以及实际 PDF.js 的字体、CMYK ICC、JPEG/JPEG2000资源。真实 Chromium 候选页已通过 Worker、断网渲染、文件下载、编号读回、仅合成和85MB虚构PDF检查；独立Chrome/Edge、手机实机和直接双击本地HTML仍未覆盖。

预览最长边限制约 1100 像素；保存时按设置重新渲染。每页输出最多约 2400 万像素，特别长的页面也受浏览器画布尺寸限制。PNG 无损；JPEG 和图片型 PDF 有损。PDF 输出不保留 OCR、可编辑文本、表单或数字签名。

## 许可

原创代码使用 **MIT**，见 [LICENSE](LICENSE)。允许商业使用和分发，须保留版权及许可声明。详见 [LICENSE_NOTES.md](LICENSE_NOTES.md)。

PDF.js 和字体/解码资源保留各自许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。示例图片另行标注，底图不因加入水印而改变许可。
