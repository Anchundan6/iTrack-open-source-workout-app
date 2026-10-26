# IMPLEMENTATION_PLAN.md — FITNESS LOG 实施计划

> 基于：AUDIT.md（2026-10-24）+ 14 项已锁定决策 + Grill-me 6 项补充决策
> 阶段口径以个性化蓝图（M0-M6）为准，数据安全并入 M2。

## 决策登记（本计划不可违背）

1. 许可证：保留上游 LICENSE（MIT 文本）与全部版权声明；README 冲突记录在案，Phase B 修正表述
2. ~~动作库：AI 批量生成 120+ 中文动作~~ → **变更（2026-10-24 大虾指令）**：动作库保持**英文内容、不汉化**；UI 界面仍为中文。首发数量可按英文内容生产效率调整
3. 存储层：保留 localStorage + Zustand persist；迁移红线 = ①静默丢失风险 ②无 schemaVersion 且无法低成本封装 ③容量/性能实测不达标
4. Android 终点：内部 APK 自用（sideload），有真机验收，不受 Play target API 36 约束
5. ~~数据安全（schemaVersion/迁移/导出导入往返/回滚）并入 M2~~ → **变更（2026-10-24 大虾指令）**：**导出/导入功能首版不做**，降级为 v2 候选。**记录在案的风险**：卸载/换机后训练数据无法迁移。M2 仍保留 persist version/migrate 机制（Zustand 自带），但不建导出导入 UI 与往返测试
6. 里程碑驱动，不设死线；fork 落在 Anchundan6
7. **变更（2026-10-24 大虾指令）**：AI 教练确认移除；同批砍掉的非核心项还包括 Supabase 云同步/Auth、复杂体重管理（体脂/围度/BMI）、Android 自动备份。首版核心 = 训练记录 + 动作库（英文）+ 渐进建议 + 打卡

## Phase B — 基线修复（M0 收尾，进 M1 前必须完成）

| # | 任务 | 验收 |
|---|------|------|
| B1 | 修复 ESLint：对齐 typescript-eslint 与 eslint 9.39 兼容版本 | `npm run lint` 正常跑完（允许有 warning，不允许 crash） |
| B2 | 引入 vitest + 单测脚本；删除死测试 helloWorld | `npm test` 可运行，含 1 个真实冒烟测试 |
| B3 | build 脚本接入 `tsc -b && vite build` | 类型错误能阻断构建 |
| B4 | 删除 `public/sw.js` 死 SW，统一 SW 注册为一处（PWA 插件） | 构建产物只有一个生成的 sw.js |
| B5 | 根目录 `node_modules` 停止 git 跟踪 + 补 .gitignore；根 package.json 处置 | 仓库不再跟踪依赖目录 |
| B6 | README 许可证表述修正（不删版权） | README 与 LICENSE 一致 |
| B7 | 移除 Gemini 教练 / Supabase 云同步 / Auth 相关代码与依赖（含 package.json 依赖卸载） | 构建通过，无残留引用，包体下降 |

## M1 — 最小训练闭环与黑白 UI

- 四主入口（今天/训练/动作/进步）+ 设置次级；中文 i18n 语言包（zh 为默认）
- 首页：开始训练主按钮、本周目标进度、进行中会话恢复入口、空状态
- 训练中：上次数据预填（不写入）、大触控当前组输入、完成组→先存后反馈→休息计时、撤销/编辑/删组、总结页
- 极简黑白 Token 化改造（Lucide 图标已合规；主色从 `#4f46e5` 改黑白系）
- 验收：真机浏览器从首页几步内录完第一组

## M2 — 会话引擎、恢复与数据安全（含原阶段 F）

- 会话状态机 idle/active/paused/completed；"开始新训练"不覆盖未完成会话
- 计时器时间戳化（不靠后台 interval）；刷新/锁屏/杀进程恢复测试
- ~~schemaVersion 封装层 + 版本化导出 + 导入校验/预览/失败回滚 + 新旧环境往返测试~~ → 导出/导入首版不做（决策 5）
- 数据迁移测试（旧 version < 3 数据 → 新模型）
- 验收：中断恢复旅程测试全过

### M2 落地记录（2026-10-24）

- 新增 `ActiveSession` 类型：模板快照 + startedAt + `activeMs`/`lastTickAt` 双段计时 + completedIds + logs + currentId
- 会话状态从组件 `useState` 移入持久化 store（`session`），`sessionOpen` 为纯 UI 态、不落盘（partialize 排除）
- 新增全局 `SessionHost`：刷新/杀进程后先弹「继续/放弃」恢复提示，不自动抢占屏幕；首页「训练进行中」卡片可随时回到会话
- 计时：每 10s 提交一次 + `visibilitychange`/`pagehide`/`beforeunload` 提交；未提交段上限 5 分钟（`MAX_UNCOMMITTED_MS`），防止崩溃后虚报数小时
- 移除遗留 `activeWorkout`/`isWorkoutActive`（persist 升 v6 并剥离）
- 验收：5 个集成用例模拟"重新加载"验证会话/计时/丢弃；中断恢复真机验收待大虾执行

## M3 — 动作库

- ~~动作 schema（id/中文名/…）~~ → 内容不汉化（决策：英文内容 + 中文 UI），schema 去掉中文字段
- AI 生成 120+ 动作种子数据 → CI 校验（唯一 ID/必填/引用完整）→ **已交付 133 个**
- ~~中文/英文/别名搜索~~ → 英文名 + 别名搜索；器材/部位/肌群筛选 + 组合筛选测试
- 自定义动作兜底（搜索无结果时可建自定义动作）；无媒体占位
- 验收：搜索/筛选/加入训练可用；大虾抽查 10-20 个动作质量

### M3 落地记录（2026-10-24）

- 类型 `ExerciseDef`（types/workout.ts）：id/name/aliases/equipment/category/primary/secondary/unilateral/type/defaultReps/steps/tips/substitutions
- 数据：`src/data/exercises.{push,pull,legs}.ts` → `exercises.ts` 汇总，133 个动作，覆盖 8 个部位 × 8 类器材
- 校验：`utils/library.ts::validateLibrary`（唯一 id、kebab-case、肌群名合法、器材/部位枚举、defaultReps 范围、步骤非空、替代动作引用存在且不自指）+ `searchExercises`（别名匹配、多词全匹配、前缀排序、器材/部位/肌群/肌群组筛选）
- UI：`components/ExercisePicker.tsx`（z-[70] 全屏层）：搜索框 + 三排筛选 chips（部位/器材/肌群组）+ 结果列表 → 详情页（目标肌群/默认组次/步骤/要点/可替代动作，替代动作可点击跳转）→ 加入模板；搜索无结果时提供「使用自定义动作」
- 接入：模板编辑器新增「从动作库选择」，选中后自动预填名称/默认次数或秒数/类型/主肌群/步骤摘要
- 测试：库结构 12 例 + 选择器渲染交互 5 例（jsdom + @testing-library/react），vitest 49/49
- 新增 devDeps：jsdom、@testing-library/react（用于组件级验收；本机浏览器 MCP 点击不稳定）

## M4 — 渐进超负荷与打卡

- 纯函数规则引擎（加次数/加重量/保持/零历史四分支）+ 全分支单测；理由可见、用户确认才生效、绝不回写历史
- 打卡由完成日志派生（≥1 完成组才计）；每周目标默认 3 可配置；周目标连胜替代自然日 streak；编辑/删除训练后统计重算
- 验收：规则边界测试全过；打卡防刷一致

### M4 落地记录（2026-10-24）

- 规则引擎 `utils/progression.ts`（纯函数，只读历史）：四分支 `baseline/addReps/addWeight/hold` + 五理由 `noHistory/missedTarget/hitTarget/stalled/bodyweight`
  - 未达目标 → 同重量 +1 次；达标 → 加重（`nextWeight`，只在已是整片重量时吸附片重，永远只增不减）并把次数降到区间下限（目标 −2，最低 1）
  - 停滞（上次比前一次更轻，或同重量次数没涨）→ 保持，先巩固；自重/无重量动作以次数为唯一杠杆
  - 单位感知增量：kg 2.5、lb 2.268（=5 lb）；`Object.freeze` 用例证明不写回历史
- UI：训练页输入卡新增「建议」条（理由 + 目标数字 + 「采用」按钮）。只预填输入框，**必须用户点「完成本组」才写入**本次日志；计时类动作不给建议
- 打卡：`hasCompletedSet`（≥1 完成组，兼容旧数据用 `completedExerciseIds`）；`sessionsInWeek`（周一起算 7 天）；`computeGoalStreak`（连续达标周数，本周未达标不打断）
  - 首页周条只点亮真正计数的日子；本周进度、结算页「本周第 N 次」、进展页「连续达标周数」全部改用同一派生口径
- 周目标可配置：设置页「每周目标」± 步进（1–14，store 已 clamp），默认 3
- 测试：`progression.test.ts` 20 例 + `checkin.test.ts` 18 例（含删除后重算、刷新后重算）+ `progressionUi.test.tsx` 5 例（理由可见、采用才生效、不写回历史）。vitest 92/92，eslint 0 错误，tsc + build 通过
- 已知边界：建议基于「该模板同名动作同组号」的历史，跨模板不共享；导出/导入首版不做，换机数据仍无法迁移（风险已降级记录）

## M5 — Android 真机交付（已完成，commit 见 git log）

**环境**
- Temurin JDK 21.0.9+10 便携版 → `D:\devtools\jdk21\jdk-21.0.9+10`（Capacitor 7 的 `capacitor.build.gradle` 要求 `VERSION_21`，原机 JDK 17 编不过）
- Android SDK 已在 `D:\devtools\android-sdk`（platforms 只有 android-36/37，AGP 8.7.3 自动补下 android-35）
- Gradle wrapper 8.11.1 首次构建自动下载，之后增量 30s 左右

**应用身份**
- applicationId / namespace：`com.fitnesslog.app`（原 `com.iTrack.app`），`MainActivity` 迁到 `com/fitnesslog/app`
- 应用名：`Fitness Log`（strings.xml / capacitor.config / manifest.json / index.html / vite PWA 全部统一）
- versionCode 1 / versionName 1.0.0；minSdk 23、targetSdk 35
- 权限只留必要项：INTERNET、POST_NOTIFICATIONS、SCHEDULE_EXACT_ALARM、RECEIVE_BOOT_COMPLETED、WAKE_LOCK、VIBRATE；**删掉读写外部存储**（导出功能已砍，WebView/localStorage 不需要）

**图标与启动屏（纯黑白）**
- 图形：黑底 + 三根递增圆角白柱（渐进超负荷的几何化），`tools/gen_icons.py` 一次性生成
- 全密度 legacy `ic_launcher(.round).webp` 48/72/96/144/192 + 自适应前景 108/162/216/324/432
- 自适应背景改为纯黑矢量；新增 `drawable/ic_launcher_monochrome.xml` + `mipmap-anydpi-v33` 支持 Android 13 主题图标
- 启动屏：白底 + 黑色柱状 `drawable/splash_logo.xml`，主题走 `windowSplashScreenBackground/AnimatedIcon` + `postSplashScreenTheme`
- 补齐缺失的 `values/colors.xml`（模板里 `@color/colorPrimary` 一直是悬空引用，AGP 会直接报错）

**签名与产物**
- `android/keystore/fitnesslog-release.jks`（RSA 2048，30 年），口令在 `android/keystore.properties`，二者均 gitignore
- `app/build.gradle` 读 `keystore.properties` 装配 `signingConfigs.release`；文件不存在时仍能出未签名包
- 产物：`release/FitnessLog-1.0.0-release.apk`（3.54 MB，v1+v2 签名，证书 CN=Fitness Log）

**踩坑**
- `npx cap sync android` 被沙箱 safe-delete 的批量删除阈值挡住（54 个文件 > 50），改用 `npx cap copy android` 只同步 Web 资源
- 遗留的 `capacitor-filesystem` 模块声明（M0 已从 npm 移除，但 `capacitor.settings.gradle` / `capacitor.build.gradle` 未重新生成）导致 `No matching variant` 构建失败 → 手工删掉这两处引用

**真机验收清单（待用户执行）**
1. 安装：`adb install -r release/FitnessLog-1.0.0-release.apk`，桌面图标应为黑底白柱
2. 冷启动：白底启动屏 → 首页，无闪白/黑屏跳变
3. 离线：断网/飞行模式走完「选模板 → 记录 → 完成」，进度与连胜正常
4. 锁屏恢复：训练中锁屏 5 分钟以上，回到 App 计时应继续累计而非跳变（`MAX_UNCOMMITTED_MS` 封顶 5 分钟）
5. 杀进程恢复：训练中从最近任务划掉，重开应弹「继续/放弃」
6. 通知：休息计时结束的本地通知与震动（Android 13+ 首次需授权通知权限）
7. 横竖屏切换、深色模式切换后颜色仍为黑白
8. 卸载重装：数据会清空（首版无导出导入，属已知边界）；`allowBackup=true` 依赖系统云备份，不保证

## M6 — Beta（大虾自用 2-3 周）

- 每周成功训练次数（北极星）、首组耗时、建议可信度主观记录
- P0 问题清零后才讨论 v2（云同步/手表/相机均不在首版范围）

## 工作约束

- 小而可审查的提交；每阶段结束汇报：变更摘要/文件/命令/真实测试结果/风险/下一步
- 没运行的测试明确标"未运行"；不谎称通过
- 推送 GitHub 走 `gh api`（沙箱直连 git 不稳定）
