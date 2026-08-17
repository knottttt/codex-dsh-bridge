<div align="left">
  <h1>Codex DeepSeekHarness Bridge</h1>
  <p><strong>让 Codex 把本机项目任务派发给 DeepSeek Harness 会话,本仓库全部代码均由 Codex 生成。</strong></p>
  <img
    src="./assets/codex-dsh-bridge-settings.png"
    alt="DeepSeek Harness 中的 Codex DSH Bridge 设置"
    width="780"
  />
</div>

---

## 项目简介

`codex-dsh-bridge` 通过 DeepSeek Harness WebUI 的本机 HTTP RPC API，将 Codex 与 Harness 会话连接起来。

仓库同时包含协作链路的两端：

- 提供 MCP 工具和协作 Skill 的 Codex 插件；
- 在 Harness 设置中加入桥接控制项的 DSH 配套插件。

## 新手一键安装

环境要求：

- Windows PowerShell 5.1 或 PowerShell 7；
- Node.js 18 或更高版本；
- 支持插件功能的 Codex CLI；
- 已安装 DeepSeek Harness，并且终端可以使用 `dsh` 命令。

下载并运行安装脚本：

```powershell
$installer = Join-Path $env:TEMP "codex-dsh-bridge-install.ps1"
Invoke-WebRequest "https://raw.githubusercontent.com/knottttt/codex-dsh-bridge/main/install.ps1" -OutFile $installer
powershell -ExecutionPolicy Bypass -File $installer
```

安装脚本会自动：

1. 添加或刷新 Codex Marketplace；
2. 安装 Codex 插件；
3. 将 Harness 配套插件安装到 `web` profile；
4. 输出安装完成后的重启提示。

安装完成后：

1. 重启 DeepSeek Harness WebUI；
2. 新建一个 Codex 任务；
3. 在 Harness 中打开 `设置 → 插件 → 插件配置`；
4. 确认 **Codex DSH Bridge** 已启用。

## 手动安装

如果希望逐条确认安装动作，可以运行：

```powershell
codex plugin marketplace add knottttt/codex-dsh-bridge --ref main
codex plugin add codex-dsh-bridge@codex-dsh-bridge
dsh plugin --profile web add github:knottttt/codex-dsh-bridge#main
```

命令执行完成后，需要重启 Harness，并新建一个 Codex 任务。

## 更新

重新运行安装脚本即可。脚本会刷新 Marketplace、重新安装 Codex 插件并更新 Harness 配套包：

```powershell
powershell -ExecutionPolicy Bypass -File $installer
```

## 卸载

下载并运行卸载脚本：

```powershell
$uninstaller = Join-Path $env:TEMP "codex-dsh-bridge-uninstall.ps1"
Invoke-WebRequest "https://raw.githubusercontent.com/knottttt/codex-dsh-bridge/main/uninstall.ps1" -OutFile $uninstaller
powershell -ExecutionPolicy Bypass -File $uninstaller
```

默认保留桥接设置。如果也要删除设置文件，请增加 `-RemoveSettings` 参数。

## 组成部分

| 组件 | 位置 | 用途 |
| --- | --- | --- |
| Codex 插件 | `.codex-plugin/`、`.mcp.json` | 注册插件及本机 MCP 服务 |
| MCP 桥接服务 | `scripts/` | 将 Codex 工具连接到 DSH HTTP RPC API |
| 协作 Skill | `skills/` | 指导 Codex 如何向 DSH 派发和跟进任务 |
| Harness 配套插件 | `dsh-plugin/` | 在 Harness 设置中加入桥接控制项 |
| Marketplace | `.agents/plugins/marketplace.json` | 让 Codex 可以直接从 GitHub 安装插件 |
| 安装脚本 | `install.ps1` | 一次安装或更新桥接两端 |

## Codex 可用工具

- 查看当前 DSH 主机状态；
- 列出并筛选 DSH 会话；
- 为项目创建新会话；
- 排队发送消息或干预正在执行的任务；
- 读取精简后的用户消息和最终回复；
- 在限定时间内等待任务完成；
- 取消或分支会话；
- 通过便捷工具直接派发任务。

## Harness 设置

配套插件会在以下位置加入设置卡片：

```text
设置 → 插件 → 插件配置 → Codex DSH Bridge
```

设置卡片可以控制：

- 是否启用 Codex 桥接；
- 桥接使用哪个本机 Harness 地址。

设置会同步到：

```text
%DSH_HOME%\codex-dsh-bridge.json
```

如果没有设置 `DSH_HOME`，则使用：

```text
%USERPROFILE%\.dsh\codex-dsh-bridge.json
```

MCP 进程会在每次工具调用时读取该文件，因此修改地址或启用状态后不需要重启 Codex。可选环境变量 `DSH_BASE_URL` 可以覆盖保存的地址，但 Harness 内的启用开关优先级更高。

## 本机安全边界

桥接只接受带明确端口的本机 HTTP 地址：

- `127.0.0.1`
- `localhost`
- `::1`

HTTPS、局域网地址、账号凭据、URL 路径、查询参数和片段都会被拒绝。

## 常见问题

### Codex 中没有出现桥接工具

请新建一个 Codex 任务。插件和 MCP 工具会在任务启动时加载。

### Harness 中没有出现设置卡片

重启 Harness WebUI，然后检查配套包：

```powershell
dsh plugin --profile web list --depth 0
```

列表中应当包含 `codex-dsh-bridge-companion`。

### 提示缺少命令

分别检查：

```powershell
node --version
codex --version
dsh --version
```

### 只安装其中一端

安装脚本支持：

```powershell
.\install.ps1 -SkipDsh
.\install.ps1 -SkipCodex
```

## 开发与测试

在仓库根目录运行完整测试和打包检查：

```powershell
npm test
npm run pack:check
```

测试覆盖桥接配置、地址校验、Harness 设置、版本冲突、客户端模块注册和发行配置。
