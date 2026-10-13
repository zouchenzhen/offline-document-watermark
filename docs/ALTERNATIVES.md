# 同类工具比较与核查依据

[返回 README](../README.md#与同类工具比较)

核查日期：**2026-10-14**。范围为公开 GitHub 项目检索、各项目官方源码、许可和官方文档，选取证件图片、PDF 水印、离线桌面和隐藏水印的代表工具；不是全网穷尽清单。下列第三方工具没有在本次逐一安装运行，也未进行同设备、同素材的耗时、内存、画质或抗攻击对测。

GitHub 的许可识别字段仅用于筛选，最终核对许可文件或项目声明。固定提交链接用于复查，不意味着该版本经过安全认证，也不意味着作者在线站点始终与该提交一致。开源许可主要约束复用和分发，不能单独证明隐私或水印强度。

## 如何理解比较

- **图片像素合成：** 原图与文字在 Canvas 或图像编辑器中合成，再导出 PNG/JPEG 等。水印不再是独立文字图层，但可以被裁剪或修图。
- **PDF 对象水印：** 在原 PDF 中追加文字、图像或 Form XObject。通常保留原文和矢量内容，也可能被编辑器或专门接口移除。
- **图片型 PDF：** 逐页渲染后将合成图像写入新的 PDF。避免独立删除水印文字，代价是丢失原文本/表单等结构，并可能增大文件。
- **本地处理：** 文件内容由浏览器或本机程序处理；不等于页面没有统计、外部字体或更新请求。外联的存在也不等于已有证据证明证件图片被上传。
- **离线部署：** 需要区分单个自包含 HTML、必须保留 JS/worker 等文件的静态目录，以及本地服务器/桌面 App。首次下载软件或加载在线网页仍可能联网。
- **隐藏标记：** 能检测出编号不等于文件未被改动，也不等于确定传播者。必须说明参数、失效情况、可伪造性和实际测试范围。

## 本项目的比较基线

版本为 **v0.3.0**，核查的主分支提交为 `4ed70952681040e1b960cc2c8b77ac5f5ba82c4f`。原创代码 MIT；PDF.js、字体、解码资源和演示素材各自保留许可。

- 单个自包含 HTML 约 6 MiB，可由 GitHub Pages 提供，也可保存到本地。不含上传接口、广告、统计、远程字体或运行时 CDN；不持久保存导入文件和水印文字。
- PNG/JPEG/WebP 图片输入；PNG/JPEG 当前页输出；多页 PDF 输入和图片型 PDF 输出。PDF 可选择页码、150/200/300/400 dpi、最长边及 JPEG 质量。
- 重复多行文字、密度和覆盖范围；仅合成发送版；PNG/JPEG/PDF 元信息、实验性隐藏编号、本地检测、JSON 追踪记录。
- 最多 30 张图片或一个 100 页 PDF，PDF 单次最多输出 30 页；累计输入和单个输出/验证文件上限 160 MiB；单页最多 2400 万像素。不支持加密 PDF、OCR、表单编辑或数字签名。
- 图片型 PDF 不保留原 OCR/文本/表单/签名。实验性标记公开且无密钥，CRC 是误码校验，不是数字签名；缩放等操作可能破坏标记，PDF 像素验证仅覆盖本工具格式的第一页。

依据：[许可](../LICENSE)、[隐私说明](../PRIVACY.md)、[验收范围](ACCEPTANCE.md)、[发布构建](https://github.com/zouchenzhen/offline-document-watermark/blob/4ed70952681040e1b960cc2c8b77ac5f5ba82c4f/scripts/build.mjs)、[应用流程](https://github.com/zouchenzhen/offline-document-watermark/blob/4ed70952681040e1b960cc2c8b77ac5f5ba82c4f/src/app.mjs)、[像素/元信息/PDF 实现](https://github.com/zouchenzhen/offline-document-watermark/blob/4ed70952681040e1b960cc2c8b77ac5f5ba82c4f/src/core.mjs)。

## README 中的代表工具

### 1. joyqi/sfz

源码提交：`32523c3b9189bb73a831ee962cbd85dab1c51025`；许可声明 **GPL-3.0-only**。

单张 PNG/JPEG/GIF 输入，PNG 输出。FileReader 读取、Canvas 绘制重复文字，再编码为 PNG；可调颜色、透明度、角度、间距和大小。界面文字输入最多 30 字符，未见 PDF、多行输入、范围控制或隐藏追踪流程。

适合简单单图水印。本项目的图片可见水印属于同类像素合成，不能据此声称更抗去水印。自行构建需保存 HTML 和本地脚本，并非现成的自包含单文件发布。

源码处理链未发现文件上传或持久存储调用，但部署工作流会注入 `STATS_SCRIPT`。官方 `gh-pages` 提交 `6924ebfa1960eaed6c5f77d76e0c1ca57af77746` 的 HTML 确有 Google Analytics。这不证明当前 markimg.com 响应完全相同，也不证明图片被上传。

依据：[处理及导出](https://github.com/joyqi/sfz/blob/32523c3b9189bb73a831ee962cbd85dab1c51025/src/script.coffee)、[界面](https://github.com/joyqi/sfz/blob/32523c3b9189bb73a831ee962cbd85dab1c51025/public/index.html)、[许可声明](https://github.com/joyqi/sfz/blob/32523c3b9189bb73a831ee962cbd85dab1c51025/package.json)、[发布工作流](https://github.com/joyqi/sfz/blob/32523c3b9189bb73a831ee962cbd85dab1c51025/.github/workflows/gh-pages.yml)、[发布分支统计脚本](https://github.com/joyqi/sfz/blob/6924ebfa1960eaed6c5f77d76e0c1ca57af77746/index.html#L64-L72)。

### 2. Efrice/watermark

提交：`6453d75bec78a97f5e109d39ca93376c0bab42e3`；**MIT**。

图片和多页 PDF 输入；多行文字、行列数、起点、间距、角度和压缩参数可调。PDF 经 PDF.js 逐页 Canvas 渲染，加水印后编码 JPEG，再由 PDFKit 写入新的 PDF。因此它**已经具备像素合成的图片型 PDF**，本项目不能把这种工作流说成独有。

该版本 PDF 渲染使用固定 `scale: 1`，没有可选 DPI、导出页码或追踪检测流程。图片下载实际编码为 PNG，但在此之前使用了 JPEG 中间图像；保留输入文件名不能说明输出仍是原编码。本项目则提供明确 PNG/JPEG 编码选项和输出尺寸控制。

发布目录含本地 JS、PDF worker、PDFKit 和 blob-stream，适合自行静态部署；不是单 HTML。可选 `saveConfig` 会把含水印文字的配置写入 localStorage；默认关闭，主题也有本地保存逻辑。所查入口未见广告/统计脚本，但本次未实测完整离线兼容性。

依据：[MIT 许可](https://github.com/Efrice/watermark/blob/6453d75bec78a97f5e109d39ca93376c0bab42e3/LICENSE)、[渲染/编码/PDF 合成](https://github.com/Efrice/watermark/blob/6453d75bec78a97f5e109d39ca93376c0bab42e3/src/util.ts)、[本地文件选择](https://github.com/Efrice/watermark/blob/6453d75bec78a97f5e109d39ca93376c0bab42e3/src/components/TheMain.vue)、[配置保存](https://github.com/Efrice/watermark/blob/6453d75bec78a97f5e109d39ca93376c0bab42e3/src/pages/index.vue)、[发布入口](https://github.com/Efrice/watermark/blob/6453d75bec78a97f5e109d39ca93376c0bab42e3/docs/index.html)。

### 3. TransparentLC/watermarker（水印姬）

提交：`a7d001e9da9a9c89a4f7868c02b570c287613096`；**AGPL-3.0**。

浏览器可解码的单张图片输入，PNG/JPEG/WebP 输出，也可单独导出水印 PNG。支持文字、图片、浮雕、叠加/柔光、字体设置、拖拽及粘贴；可见水印合入 Canvas 像素。它的图片样式和 WebP 导出比本项目丰富，没有 PDF 流程；FAQ 明确不提供暗水印。

选择部分字体时会动态载入外部字体 CSS，关于页也引用外部徽章。源码读取图片的流程未发现文件上传。README 宣称 PWA 离线使用，但所查提交未见 Service Worker/离线缓存注册，本次未运行验证；不能把该声明等同已经验证的冷启动离线能力。

依据：[AGPL 许可](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/LICENSE)、[输出](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/src/components/image-editor.vue#L330-L344)、[像素合成](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/src/components/image-editor.vue#L389-L433)、[字体加载](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/src/components/watermark-editor.vue#L540-L567)、[字体资源列表](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/src/webfont.json)、[FAQ](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/src/app.vue)、[PWA 声明](https://github.com/TransparentLC/watermarker/blob/a7d001e9da9a9c89a4f7868c02b570c287613096/README.md)。

### 4. turkyden/watermark-pro

提交：`ca2d92d0686d6931cc410fab3434bd9f425af394`；**MIT**。

React/Umi 网页，支持多图切换、重复文字水印和批量 ZIP。读取文件后在 Canvas 绘图，`toBlob()` 默认编码 PNG；文件名沿用输入文件名，扩展名不能证明输出编码。未见 PDF 处理流程。README 勾选的其他功能不自动等于本次全部验证过。

批量图片 ZIP 是本项目尚未提供的便利。该版本 Canvas 宽度会按 `window.innerWidth - 100` 缩小较宽输入，导出的就是这个画布，因此输出分辨率可能受窗口大小影响。

生产构建默认把资源地址设到 jsDelivr，并配置百度统计、Hotjar 和远程图标/徽章。不能把项目的“纯前端、不上传”宣传等同零外联；使用敏感文件前应审查自行部署的配置。本次没有对在线站点抓包，也没有证据证明图片被上传。

依据：[MIT 许可](https://github.com/turkyden/watermark-pro/blob/ca2d92d0686d6931cc410fab3434bd9f425af394/LICENSE)、[导出及 ZIP](https://github.com/turkyden/watermark-pro/blob/ca2d92d0686d6931cc410fab3434bd9f425af394/src/pages/index.tsx)、[绘图和缩放](https://github.com/turkyden/watermark-pro/blob/ca2d92d0686d6931cc410fab3434bd9f425af394/src/components/Watermark/Watermark.ts)、[构建/统计配置](https://github.com/turkyden/watermark-pro/blob/ca2d92d0686d6931cc410fab3434bd9f425af394/.umirc.ts)。

### 5. Bank-Exit/filigrane

提交：`711bf322503edb99747fac9526a4c5f3b1f7906f`；README 声明 **GPLv3**，未找到完整独立 LICENSE 文件。GitHub 未识别许可不能直接当成“无许可”，但复用时应核实作者声明及第三方许可范围。

面向 PDF 的单 HTML 工具，有重复水印、小字 ID/日期和元信息；另有验证页面。PDF-lib 从原 PDF 加载后 `drawText`，保留原页面结构。水印与小字仍是 PDF 文字内容，未成为页面像素；它的验证也不是密码学完整性认证。

适合简单 PDF 叠字并保留原文。虽然项目强调离线，所查 HTML 的 PDF.js worker 地址仍指向 cdnjs，不能当作完全自包含、首次断网即可运行的单文件。本项目则将 worker 和字体/解码资源一起内置，并输出新的图片型 PDF。

依据：[许可声明](https://github.com/Bank-Exit/filigrane/blob/711bf322503edb99747fac9526a4c5f3b1f7906f/README.md#L46-L49)、[CDN worker](https://github.com/Bank-Exit/filigrane/blob/711bf322503edb99747fac9526a4c5f3b1f7906f/filigrane_pdf_official_V1.html#L624)、[原 PDF 与文字水印](https://github.com/Bank-Exit/filigrane/blob/711bf322503edb99747fac9526a4c5f3b1f7906f/filigrane_pdf_official_V1.html#L991-L1116)、[验证实现](https://github.com/Bank-Exit/filigrane/blob/711bf322503edb99747fac9526a4c5f3b1f7906f/verif_filigrane_v1.html#L365-L414)。

### 6. pdfcpu/pdfcpu

提交：`b41a41d5323f6119ff6a183ad3f287eb4a20a617`；**Apache-2.0**。

本地命令行和 Go 库，支持文字/图片/PDF 水印、页码选择、批处理和多种 PDF 操作。水印使用 OCG 和 Form XObject，官方明确提供移除接口；适合保留可搜索文字、矢量及原内容结构，不是本项目的页面像素合成方案。扫描件上还要区分背景 watermark 与前景 stamp，否则水印可能被原有页面图像覆盖。

其优势是自动化和 PDF 功能范围；本项目则提供免命令行的证件发送流程。没有做公平的性能测试，不能由“Go”或“浏览器”直接推断速度高低。

依据：[Apache 许可](https://github.com/pdfcpu/pdfcpu/blob/b41a41d5323f6119ff6a183ad3f287eb4a20a617/LICENSE.txt)、[水印模式及前后景](https://github.com/pdfcpu/pdfcpu/blob/b41a41d5323f6119ff6a183ad3f287eb4a20a617/pkg/pdfcpu/model/watermark.go#L43-L75)、[对象结构](https://github.com/pdfcpu/pdfcpu/blob/b41a41d5323f6119ff6a183ad3f287eb4a20a617/pkg/pdfcpu/stamp.go#L1475-L1498)、[移除 API](https://github.com/pdfcpu/pdfcpu/blob/b41a41d5323f6119ff6a183ad3f287eb4a20a617/pkg/api/stamp.go#L380-L403)。

### 7. Stirling-Tools/Stirling-PDF

提交：`51d5ee759a10bb34bc81937794a92c88edfb3ff8`；**MIT 开源核心＋专有目录**。根 LICENSE 列出例外范围，专有目录另有 User License，限制生产使用、修改和分发。不能把整个仓库称为全 MIT/全部开源，也不能把整个项目一概称为无开源核心。

综合 PDF 工具箱，包括合并、拆分、转换、OCR 等，具体功能受安装组件、环境及授权范围影响。自托管 Web 模式的水印流程将文件交给部署的后端；服务器在本机时可由本机处理，与向第三方服务器上传不同，但仍不是单 HTML 的纯浏览器处理。

默认水印向 PDF 追加内容，接口可选 `convertPDFToImage=true`；整页 flatten 也会渲染页面并写入新的 PDF。它**同样能生成像素合成发送版**，不能把它仅列为可删的文字水印工具。本项目的优势是专用、部署步骤少、可保存自包含网页；它的优势是通用 PDF 功能更多。

依据：[MIT 与例外目录](https://github.com/Stirling-Tools/Stirling-PDF/blob/51d5ee759a10bb34bc81937794a92c88edfb3ff8/LICENSE#L5-L26)、[专有条款](https://github.com/Stirling-Tools/Stirling-PDF/blob/51d5ee759a10bb34bc81937794a92c88edfb3ff8/app/proprietary/LICENSE#L7-L39)、[水印转图片选项](https://github.com/Stirling-Tools/Stirling-PDF/blob/51d5ee759a10bb34bc81937794a92c88edfb3ff8/app/core/src/main/java/stirling/software/SPDF/controller/api/security/WatermarkController.java#L116-L171)、[页面渲染及新 PDF](https://github.com/Stirling-Tools/Stirling-PDF/blob/51d5ee759a10bb34bc81937794a92c88edfb3ff8/app/common/src/main/java/stirling/software/common/util/PdfUtils.java#L370-L423)、[前端交给后端处理](https://github.com/Stirling-Tools/Stirling-PDF/blob/51d5ee759a10bb34bc81937794a92c88edfb3ff8/frontend/editor/src/core/hooks/tools/addWatermark/useAddWatermarkOperation.ts#L79-L97)。

### 8. GIMP

**GPL-3.0-or-later**。官方离线桌面图像编辑器，可编辑文字、图层、选区、透明度及修图；PDF 页面可经 Poppler 渲染导入。适合精细处理，比本项目的固定水印设置自由。

文字工具创建可编辑图层，保存 XCF 工程不能达到“水印不能单独删除”的发送目的；应合并并导出 PNG/JPEG 等结果。重复水印、多页处理通常需要手工操作或脚本，本项目则集成分页导出和编号读取。没有据此比较两者的整体安全性或去水印难度。

依据：[官方许可 FAQ](https://www.gimp.org/docs/userfaq.html)、[文字图层](https://docs.gimp.org/3.0/en/gimp-tool-text.html)、[合并图层](https://docs.gimp.org/3.0/en/gimp-image-flatten.html)、[导出](https://docs.gimp.org/3.0/en/gimp-file-export-as.html)。固定源码提交 `f8b0d37a2fda9d1c2d7cdf9af15b50fdadbda39c`：[许可声明](https://gitlab.gnome.org/GNOME/gimp/-/blob/f8b0d37a2fda9d1c2d7cdf9af15b50fdadbda39c/app/main.c)、[PDF 导入](https://gitlab.gnome.org/GNOME/gimp/-/blob/f8b0d37a2fda9d1c2d7cdf9af15b50fdadbda39c/plug-ins/common/file-pdf-load.c)。

## 补充项目

### unilei/image-watermark-tool

提交 `66e46b858d7e7f1c5cacd2675573656f38dfbfca`，**MIT**。Nuxt 网页，图片经 FileReader/Canvas 在本地加单个或重复、多行文字水印，提供中英界面与 Vercel/Docker 部署说明；未见 PDF。下载默认 `toDataURL()` 编码 PNG，沿用输入文件名/类型不能视为可靠的 JPEG 输出。

默认配置包含 Google Analytics、Google 广告和 Cloudflare Turnstile 外部脚本，不能按 README 的“无需联网”概括整个默认页面。下载函数里的 XHR 读取的是 Canvas 的 data URL，本身不是远程图片上传证据。自行部署可以审查和调整配置，但本次未实测。

依据：[MIT 许可](https://github.com/unilei/image-watermark-tool/blob/66e46b858d7e7f1c5cacd2675573656f38dfbfca/LICENSE)、[图片及下载实现](https://github.com/unilei/image-watermark-tool/blob/66e46b858d7e7f1c5cacd2675573656f38dfbfca/pages/index.vue)、[外部脚本配置](https://github.com/unilei/image-watermark-tool/blob/66e46b858d7e7f1c5cacd2675573656f38dfbfca/nuxt.config.ts)、[统计初始化](https://github.com/unilei/image-watermark-tool/blob/66e46b858d7e7f1c5cacd2675573656f38dfbfca/public/ga.js)。

### isharmla233/fullscreen-id-watermark

提交 `9e1ff4c6a976e59a88e94b21e18656c60825f530`，**GPL-3.0**。单 HTML，批量图片输入，经 Canvas 合成后输出 JPEG（质量 0.92）；支持日期/时间/文件名变量、字体和横纵间距。无 PDF、PNG 输出或隐藏编号验证。

默认引用 BootCDN MiSans 字体 CSS，并将水印文字草稿存入 localStorage；图片本地处理未发现上传逻辑。它的批量图片与变量更方便，但不能把默认文件称为“零外联、零持久保存”。

依据：[GPL 许可](https://github.com/isharmla233/fullscreen-id-watermark/blob/9e1ff4c6a976e59a88e94b21e18656c60825f530/LICENSE)、[远程字体](https://github.com/isharmla233/fullscreen-id-watermark/blob/9e1ff4c6a976e59a88e94b21e18656c60825f530/index.html#L20-L22)、[JPEG 导出](https://github.com/isharmla233/fullscreen-id-watermark/blob/9e1ff4c6a976e59a88e94b21e18656c60825f530/index.html#L1744-L1789)、[文字持久保存](https://github.com/isharmla233/fullscreen-id-watermark/blob/9e1ff4c6a976e59a88e94b21e18656c60825f530/index.html#L2143-L2175)。

### Rajendra0309/morphdrop-android

提交 `80f082d20ad46d094f7e1732384a04e76b4f3693`，**Apache-2.0**。Android 综合文档 App，提供转换、水印、OCR、压缩等功能，可作为手机工具的补充选择，但本次未在手机运行。

PDF 水印实现使用 PDFBox 的追加内容流及 `showText`/`drawImage`，不做本项目的页面像素合成。所查文字过滤函数中，汉字等未覆盖字符会替换为 `?`，不适合作为未经实测的中文证件 PDF 默认方案。Manifest 申请 INTERNET，README 列 GitHub 更新器；“转换流程设计为离线”不等于整个 App 无联网能力。

依据：[Apache 许可](https://github.com/Rajendra0309/morphdrop-android/blob/80f082d20ad46d094f7e1732384a04e76b4f3693/LICENSE)、[功能说明](https://github.com/Rajendra0309/morphdrop-android/blob/80f082d20ad46d094f7e1732384a04e76b4f3693/README.md)、[PDF 水印实现](https://github.com/Rajendra0309/morphdrop-android/blob/80f082d20ad46d094f7e1732384a04e76b4f3693/app/src/main/java/com/morphdrop/app/domain/usecase/conversion/WatermarkPdfUseCase.kt)、[文字过滤](https://github.com/Rajendra0309/morphdrop-android/blob/80f082d20ad46d094f7e1732384a04e76b4f3693/app/src/main/java/com/morphdrop/app/util/FileHelper.kt#L41)、[联网权限](https://github.com/Rajendra0309/morphdrop-android/blob/80f082d20ad46d094f7e1732384a04e76b4f3693/app/src/main/AndroidManifest.xml)。

### guofei9987/blind_watermark（算法对照）

提交 `322c90dc02d45644692095b34d3a6b735b6edbd8`，**MIT**。Python 库/CLI 使用 DWT＋DCT＋SVD，支持隐藏文字、图像、比特及提取；需要安装环境和依赖，不是直接打开的网页或 PDF 工具。

它有比本项目更丰富的攻击与恢复示例，值得研究；提取仍需密码参数和水印长度/形状。密码用于伪随机排列，不等于数字签名。旋转和缩放示例包含恢复步骤，部分裁剪示例还使用原标记图帮助定位，不能解读成任意裁剪后都能自动溯源。没有对它与本项目进行同条件鲁棒性测试，不能给出强弱排名。

依据：[MIT 许可](https://github.com/guofei9987/blind_watermark/blob/322c90dc02d45644692095b34d3a6b735b6edbd8/LICENSE)、[中文使用说明](https://github.com/guofei9987/blind_watermark/blob/322c90dc02d45644692095b34d3a6b735b6edbd8/README_cn.md)、[算法实现](https://github.com/guofei9987/blind_watermark/blob/322c90dc02d45644692095b34d3a6b735b6edbd8/blind_watermark/bwm_core.py)、[攻击及恢复示例](https://github.com/guofei9987/blind_watermark/blob/322c90dc02d45644692095b34d3a6b735b6edbd8/examples/example_str.py)。

### 许可未明确：yanyaoli/SafeMark

所查提交 `4e9cabb32b62346195bc678c31f645f288fe95cb` 仅含 README、示例图和单 HTML，未找到许可文件或 HTML 中的许可声明。提供批量图片/拖放/粘贴、重复文字和 PNG 导出，源码处理链未发现远程脚本、上传、统计或持久存储调用；不代表已完成安全审计。

可以称“源码公开的相关工具”，但不能默认拥有修改/再分发/商用授权，因此不列入 README 的已确认许可比较表。以后作者增加许可证，应按新版本重新核查。

依据：[固定仓库树](https://github.com/yanyaoli/SafeMark/tree/4e9cabb32b62346195bc678c31f645f288fe95cb)、[README](https://github.com/yanyaoli/SafeMark/blob/4e9cabb32b62346195bc678c31f645f288fe95cb/README.md)、[HTML](https://github.com/yanyaoli/SafeMark/blob/4e9cabb32b62346195bc678c31f645f288fe95cb/index.html)。

## 如何选择

- 只处理一张图片、基础用途水印：sfz；需要图片水印、浮雕、混合模式或 WebP：水印姬。
- 希望本地浏览器直接处理图片与 PDF：本项目；愿意部署静态目录且需要行列/坐标控制：Efrice/watermark。
- 希望保留 PDF 原文和矢量、自动化批处理：pdfcpu；简单网页 PDF 叠字可看 filigrane，但需解决 worker 外部依赖及许可文件范围。
- 需要综合 PDF 工具箱：核对许可范围后使用自托管 Stirling-PDF；需要精细修图：GIMP。
- 需要研究隐藏水印算法：blind_watermark；它与本项目的编号都不能单独作为身份或传播证明。

上述选择依据功能和部署方式，不是安全、性能或项目质量排名。本项目仍需完善实机兼容验证、批量图片 ZIP 导出和隐藏标记的可重复鲁棒性实验；没有依据宣称它能阻止有意去水印或保证隐私不受浏览器、操作系统和收件人影响。
