# AUDIT.md — iTrack fork 基线审计

> 审计日期：2026-10-24 · 分支：dev/m0-audit · 上游：xaxoman/iTrack-open-source-workout-app @ main（pushedAt 2026-10-02）
> 审计原则：只记录、不大改。所有结论基于实际读取的文件与真实运行的命令。

---

## 1. 许可证审计（P0 前置项）

| 来源 | 声明 | 证据 |
|------|------|------|
| `LICENSE` 文件 | **MIT License**, Copyright (c) 2023 iTrack | 已读全文，标准 MIT 文本 |
| GitHub API `licenseInfo` | MIT (`key: "mit"`) | `gh repo view` 实测 |
| `README.md` §License | "**Apache License 2.0** — see LICENSE" | README.md:165 |

**结论：冲突属实。** 授权文本（LICENSE 文件 + GitHub 标签）一致指向 MIT，README 文字声称 Apache-2.0，属文档矛盾。

**处置决策（已与大虾确认）**：照样 fork，保留全部上游文件。以 LICENSE 文件（MIT）为准，同时按更严格习惯保留所有版权声明；**不得**在任何文档中写"已确认 MIT 无争议"，审计记录冲突事实。后续在 README 修正许可证表述（列入 Phase B）。

**第三方素材**：
- `project/src/components/bodyPaths.ts`：MuscleMap（Melih Colpan，MIT）身体轮廓图，README 有声明，**保留 notice**。
- `docs/images/`：README 截图，仅文档用途。
- 动作媒体：本仓库**不含**任何内置动作图/视频库（见 §4），Free Exercise DB 媒体未进入本仓库，授权核验在 M3 另行进行。

## 2. 基线构建命令与真实结果

环境：托管 Node 22.22.2 / npm 10.9.7 / Windows 11。

| 命令 | 结果 | 证据 |
|------|------|------|
| `npm ci`（project/） | ✅ 通过（约 60s） | 无错误输出 |
| `npm run lint` | ❌ **崩溃** | ESLint 9.39.5 加载 `@typescript-eslint/no-unused-expressions` 时 TypeError（`allowShortCircuit` undefined）——eslint 9.39 与 typescript-eslint 8.3 版本不兼容 |
| `npm run build` | ✅ 通过（5.62s） | dist 产出正常；PWA generateSW 预缓存 8 项；警告：主 chunk 1,151 kB |
| 测试 | ⚠️ **未运行（无 runner）** | 唯一测试 `src/__tests__/helloWorld.test.ts` 引用**不存在**的 `../helloWorld`，且 package.json 无 test 脚本、无 vitest/jest 依赖——死测试 |
| `tsc` 类型检查 | ⚠️ **未接入** | build 脚本仅 `vite build`，不做类型检查 |

## 3. 架构现状

- **技术栈**：React 18.3 + TS 5.5 + Vite 6 + Tailwind 3.4 + Zustand 4.5（persist → localStorage，key `workout-storage`，version 3，含 migrate）+ React Router 6.22 + Recharts + Lucide + Capacitor 7 + vite-plugin-pwa 0.21（generateSW / autoUpdate）。
- **路由**（App.tsx）：`/`（Home）、`/workouts`、`/progress`、`/coach`、`/settings`。
- **数据模型**（types/workout.ts）：`Workout → Exercise → Set{reps,weight,completed}`；`WorkoutTemplate`；另有 WeightEntry / EquipmentItem / RoutineBookmark。Exercise 无"目标次数区间/休息时长/肌群分类"字段——需扩展。
- **持久化**：单一 Zustand store（251 行），localStorage。导入导出已有雏形：`Settings.exportData`（JSON 下载）+ `store.importData`（字段级 `|| state.x` 回退合并，**无 schemaVersion、无校验、无预览**）。
- **Android**：`project/android`，applicationId `com.iTrack.app`，minSdk 23 / targetSdk **35**；CI `.github/workflows/build-apk.yml`（Node 22 + **Java 21** + assembleDebug）可用。
- **i18n**：仅 `en.ts` / `it.ts`，**无中文**。

## 4. KEEP / REFACTOR / REMOVE

### KEEP（保留）
- Vite + React + TS + Tailwind + Zustand 底座与 persist 迁移框架（符合"保留优先"决策，未踩迁移红线）
- React Router v6 路由骨架
- vite-plugin-pwa 离线能力（generateSW + autoUpdate）
- Capacitor 7 Android 工程 + CI APK 流水线
- JSON 导出/导入入口、Zustand persist version/migrate 机制
- `wakeLock.ts`（自研屏幕常亮，AGENTS.md 明确禁用插件方案）
- RestTimer / 离线休息音效（sound.ts 内置音频）
- i18n 框架结构（加中文语言包即可）

### REFACTOR（重构）
- **数据模型扩展**：Exercise 增加目标次数区间（min/max reps）、休息时长、器材/肌群分类、与动作库条目的关联 id
- **会话引擎**：ActiveWorkout（431 行）重做移动端输入流——上次数据预填、完成组先写库再反馈、撤销/编辑/删组、会话恢复
- **导入安全**：importData 增加 schemaVersion 校验 + 导入前预览 + 失败回滚（当前裸 `JSON.parse` 后直接 set）
- **打卡统计**：Progress（409 行）现有 streak 逻辑改为完全由训练日志派生，支持每周目标连胜
- **视觉**：全站重做极简黑白、移动端优先（当前品牌色 `#4f46e5`）
- **store 拆分**：单 store 按领域拆分（session / library / settings）
- **main.tsx SW 注册**：手动 `register('/sw.js')` 与 PWA 插件注入注册并存，需统一为一处

### REMOVE（移除）
- **Gemini AI 教练**：`pages/Coach.tsx`、`lib/gemini.ts`（433 行）、`components/AICoachOnboardingModal.tsx`、store 中 aiCoach/equipment/exerciseWeights/aiOnboarded 字段
- **Supabase 云同步**：`lib/cloudSync.ts`、`lib/supabase.ts`、`store/useAuthStore.ts`、`components/AuthModal.tsx`、`project/supabase/`、Settings 中存储模式切换
- **死代码**：`public/sw.js`（手写旧 SW，cache 名 `fittrack-v1`，硬编码过期资源 hash）、`src/__tests__/helloWorld.test.ts`（引用不存在模块）
- **根目录残留**：根 `package.json`（仅 react-hot-toast 一个依赖）+ 根 `node_modules/`（9.2MB 被提交进仓库）——加入 .gitignore 并停止跟踪
- **复杂体重管理**（体脂/围度/用户画像）：UserProfile 中 neckCm/waistCm/bmi/bodyFat 等字段与 LogWeightSheet 相关入口；简单体重记录是否保留在 M1 设计时定
- Coach 路由与导航入口

## 5. 风险与未决项

| # | 风险 | 等级 | 处置 |
|---|------|------|------|
| R1 | **无内置动作库**：动作是用户自由文本 + 可选 YouTube 链接，120+ 离线中文动作库是全新开发而非改造 | 高 | M3 主战场，AI 生成 + schema 校验 + 抽查（已定） |
| R2 | ESLint 崩溃，lint 门禁失效 | 高 | Phase B 第一项修复 |
| R3 | build 不含 tsc，类型错误可混入构建 | 中 | Phase B 修 |
| R4 | 无测试 runner，方案要求的 11 类测试无处落地 | 高 | Phase B 引入 vitest |
| R5 | 本机 JDK 17 < CI/Capacitor 7 要求的 JDK 21 | 中 | M5 前安装 JDK 21 |
| R6 | 沙箱内 git push/clone 直连 GitHub 不稳定 | 中 | 远端同步走 `gh api`；本地开发不受影响 |
| R7 | localStorage 容量（~5MB）：纯文本训练记录量级下充足，按决策保留并监控 | 低 | M2 加容量护栏 |
| R8 | `public/sw.js` 与 PWA 生成 SW 可能双注册/覆盖顺序问题 | 低 | Phase B 删除死 SW 后消失 |
| R9 | 主 chunk 1.15MB（Recharts 等），移动端首屏可优化 | 低 | M1 后按需 code-split |

## 6. M0 通过标准核对

- [x] Fork 完成：Anchundan6/iTrack-open-source-workout-app
- [x] 本地可构建：`npm ci && npm run build` 通过（真实运行）
- [x] 许可证冲突已记录，处置策略已定
- [x] KEEP/REFACTOR/REMOVE 已标记
- [x] 基线 commit：`d807a9c`（dev/m0-audit 分支）
- [ ] ~~新机器按 README 能启动~~ — README 启动步骤本身正确（cd project && npm install && npm run dev），lint 除外（已记录 R2）
