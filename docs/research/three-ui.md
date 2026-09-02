# ThreeUI 开源组件库调研

> 调研日期：2026-08-30（Asia/Shanghai）
> 调研范围：官方网站、官方 GitHub 仓库、npm 官方包元数据、发布物与许可证；未使用第三方教程作为结论依据。

## 结论

用户所说的“Three UI”最可能是 Meng To / DesignCode 的 **ThreeUI Community**：一个将 Three.js / WebGL 效果包装成 React 组件和交互模板的开源库。官方仓库为 [`MengTo/threeui`](https://github.com/MengTo/threeui)，公开 npm 包为 [`@designcodeio/threeui`](https://www.npmjs.com/package/@designcodeio/threeui)，官网为 [`threeui.com`](https://threeui.com/)。官方定位、包名、仓库和官网能相互印证。[官方 README](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/README.md) [npm 1.1.0 元数据](https://registry.npmjs.org/@designcodeio%2Fthreeui/1.1.0)

**可以接入当前 Astro 项目，且 React / Three.js 版本范围匹配。** 但它是 React-only 组件库，应作为 Astro 里的 React island 使用，不能在 Svelte 组件中直接当作 Svelte 组件导入。建议先接一个免费 Community 组件做视觉与移动端性能验证，不建议立即在多个页面大面积铺开。

## 安装与导入

官方安装命令：

```bash
npm install @designcodeio/threeui
```

当前仓库声明了 `pnpm@9.14.4` 且有 `only-allow pnpm` 预安装限制，因此本项目应使用：

```bash
pnpm add @designcodeio/threeui
```

官方建议同时导入共享样式，并在开发时优先使用组件子路径以缩小导入图。[官方 README 的安装与导入说明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/README.md#install-the-react-package)

```tsx
import { ThreeUIIntro } from "@designcodeio/threeui/components/ThreeUIIntro";
import "@designcodeio/threeui/style.css";
```

Astro 中建议使用 React island，并根据首屏需求选择 `client:visible` 或 `client:load`：

```astro
---
import { ThreeUIIntro } from "@designcodeio/threeui/components/ThreeUIIntro";
import "@designcodeio/threeui/style.css";
---

<ThreeUIIntro client:visible />
```

### 文档范例的已知偏差

官方 README 当前以 `AtTheHorizon` 为导入示例，但对 npm `1.1.0` 发布物的本地核验显示：

- 根导出共 102 个，其中没有 `AtTheHorizon`；
- `@designcodeio/threeui/components/AtTheHorizon` 子路径会触发 `ERR_MODULE_NOT_FOUND`；
- `AmberHalftone` 与 `ThreeUIIntro` 的根导出和子路径导出都存在，可作为实际接入样例。

因此不应盲抄 README 的 `AtTheHorizon` 示例；应先从官网选定 Community 组件，再核对当前发布物的实际导出。这也说明项目目前的文档与发布物同步还不够成熟。

## 版本与当前项目的匹配

`@designcodeio/threeui@1.1.0` 声明的 peer dependencies 如下：[官方 package.json](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/package.json) [npm 1.1.0 元数据](https://registry.npmjs.org/@designcodeio%2Fthreeui/1.1.0)

| 依赖 | ThreeUI 要求 | 当前项目 | 结论 |
| --- | --- | --- | --- |
| React | `>=18 <20` | `^19.2.8` | 匹配 |
| React DOM | `>=18 <20` | `^19.2.8` | 匹配 |
| Three.js | `>=0.149 <1` | `^0.184.0` | 匹配 |
| Astro React integration | ThreeUI 未声明 Astro peer | `@astrojs/react ^6.0.4` | 可通过 React island 接入 |
| Svelte | 无 Svelte 版本 | `svelte ^5.55.5` | 不能直接当作 Svelte 组件使用 |

额外注意：

- 发布包还通过 npm alias 内置了 `three@0.128.0` 和 `three@0.165.0`，用于部分历史实现；这不会把项目的 `three@0.184` 降级，但会增加安装体积。[官方 package.json](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/package.json#L55-L63)
- 本地对 `ThreeUIIntro` 执行 `react-dom/server` 的 `renderToString` 成功，说明该组件至少可通过 Astro SSR 阶段；但未对 102 个导出逐个做 SSR 和浏览器运行验证。
- WebGL 交互需要浏览器水合；若组件不在首屏，优先 `client:visible`，以减少首屏 JavaScript 与 GPU 压力。

## 包体积、资产与运行时约束

npm `1.1.0` 元数据显示发布物有 **684 个文件，解包后约 54.5 MB**，并包含 npm provenance attestation。这个数字是安装体积，不等于单个页面的最终下载体积；页面体积仍需要对具体组件的构建产物实测。[npm 发布元数据](https://registry.npmjs.org/@designcodeio%2Fthreeui/1.1.0) [npm provenance attestation](https://registry.npmjs.org/-/npm/v1/attestations/@designcodeio%2fthreeui@1.1.0)

官方明确提醒：某些“完整 HTML 文档”组件会按固定的根相对 URL 加载运行时文件。接入这类组件时，需要把 `node_modules/@designcodeio/threeui/lib-dist/assets/` 中所需资产复制到 Astro `public/` 目录，或使用组件提供的 `sourceUrl` / `assetBaseUrl` prop 改写路径。[官方 README](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/README.md#install-the-react-package)

部分 Community HTML 场景还会引用公开 CDN 或 ThreeUI 托管的图片/视频端点。如果博客需要严格离线、自托管、CSP 或隐私合规，应对选定组件的网络请求单独审查。[官方资产许可说明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/ASSET-LICENSES.md)

## 许可证

- ThreeUI 应用代码、Community 组件代码和 ThreeUI 自制的 Community 图像为 **MIT License**；需保留版权与许可声明。[官方 LICENSE](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/LICENSE)
- 随包字体为 **SIL Open Font License 1.1**，包含保留字体名等条件。[官方字体许可说明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/FONT-LICENSES.md)
- 随包 Three.js 运行时为 MIT；从 `threeui.com` 远程加载的目录缩略图和预览媒体不由该仓库的 MIT 许可覆盖。[官方资产许可说明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/ASSET-LICENSES.md) [第三方声明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/THIRD_PARTY_NOTICES.md)

结论是：开源 Community 代码可用于商业项目，但引入字体和资产时仍要一并保留对应声明；对远程媒体不能仅依赖仓库 MIT 许可作出授权判断。

## 维护状态与风险

截至 2026-08-30：

- GitHub 公开仓库创建于 2026-08-21，未归档，最近仍有提交和自动同步分支活动。[官方 GitHub 仓库 API](https://api.github.com/repos/MengTo/threeui) [最近提交](https://github.com/MengTo/threeui/commits/main/)
- npm 包于 2026-08-21 创建，在 8 月 21、23、25 日先后发布 `0.3.0`、`1.0.0`、`1.1.0`；目前 `latest` 是 `1.1.0`。[npm 官方 registry](https://registry.npmjs.org/@designcodeio%2Fthreeui)
- npm 元数据仅列出一位维护者 `mengto`；官方 GitHub 目前没有 tag 或 GitHub Release。[npm 官方 registry](https://registry.npmjs.org/@designcodeio%2Fthreeui) [GitHub tags](https://github.com/MengTo/threeui/tags) [GitHub releases](https://github.com/MengTo/threeui/releases)
- 发布流程声称会执行测试、公开边界审计、构建、安装冒烟测试，并通过 npm trusted publishing + provenance 发布。[官方 README 的同步与发布说明](https://github.com/MengTo/threeui/blob/326580429881c2abe7893bee53c62cbb31b6ee49/README.md#synchronization) [npm provenance attestation](https://registry.npmjs.org/-/npm/v1/attestations/@designcodeio%2fthreeui@1.1.0)

综合评估：**正在活跃开发，但是非常新、单维护者、尚无稳定的 GitHub 发布历史，而且已发现 README 示例与 npm `1.1.0` 发布物不一致。** 它适合局部试用和逐组件验证，尚不应被当作无风险的基础设计系统。

## 建议的接入策略

1. 先从官网选定一个 Community 组件，确认它在 npm `1.1.0` 的子路径中真实存在。
2. 使用 `@designcodeio/threeui/components/<ComponentName>` 按组件导入，不优先使用包根入口。
3. 在 Astro 层作为 React island 挂载；非首屏效果默认使用 `client:visible`。
4. 运行 Astro 类型检查和生产构建，再用真实浏览器检查桌面端/移动端的 WebGL、减少动效偏好、资产 404、CSP 和页面性能。
5. 锁定确切版本，升级时重做导出名、字体/资产和视觉回归检查。

## 本地只读核验记录

本次调研未安装或修改项目依赖。调研时仓库的 `package.json` 和 `node_modules` 已能观察到 `@designcodeio/threeui@1.1.0`；本文只对现有发布物执行了以下只读核验：

- npm 版本、peer dependencies、发布时间、文件数、解包体积、校验值和 provenance；
- 根入口实际导出列表与 `AtTheHorizon` / `AmberHalftone` / `ThreeUIIntro` 子路径可用性；
- `ThreeUIIntro` 的 React server render。
