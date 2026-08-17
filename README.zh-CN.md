<div align="center">
  <h1>Codex DSH Bridge</h1>
  <p><strong>让 Codex 把本机项目任务派发给 DeepSeek Harness 会话。</strong></p>
  <p>
    <a href="./README.md">English</a>
    ·
    <strong>简体中文</strong>
  </p>
  <p><strong>本仓库全部代码均由 Codex 生成。</strong></p>
  <img
    src="./assets/codex-dsh-bridge-settings.png"
    alt="DeepSeek Harness 中的 Codex DSH Bridge 设置"
    width="780"
  />
</div>

---

## 项目简介

`codex-dsh-bridge` 通过 DeepSeek Harness WebUI 的本机 HTTP RPC API，将 Codex 与 Harness 会话连接起来。

它为 Codex 提供了一组专注于本机协作的工具：

- 查看当前 DSH 主机状态；
- 列出并筛选 DSH 会话；
- 为项目创建新会话；
- 排队发送消息或干预正在执行的任务；
- 读取精简后的用户消息和最终回复；
- 在限定时间内等待任务完成；
- 取消或分支会话；
- 通过一个便捷工具直接派发任务。

## 组成部分

| 组件 | 位置 | 用途 |
| --- | --- | --- |
| Codex 插件 | `.codex-plugin/`、`.mcp.json` | 注册插件及本机 MCP 服务 |
| MCP 桥接服务 | `scripts/` | 将 Codex 工具连接到 DSH HTTP RPC API |
| 协作 Skill | `skills/` | 指导 Codex 如何向 DSH 派发和跟进任务 |
| Harness 配套插件 | `dsh-plugin/` | 在 Harness 设置中加入桥接控制项 |

## 环境要求

- Node.js 18 或更高版本。
- 本机已运行 DeepSeek Harness WebUI，通常使用：

  ```powershell
  npx @deepseek-ai/dsh web
  ```

- 默认服务地址：`http://127.0.0.1:3080`。

Codex 桥接服务没有运行时 npm 依赖，也不会额外启动新的网络服务器。

## Harness 设置

仓库内的 `dsh-plugin` 会在以下位置加入设置卡片：

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

MCP 进程会在每次工具调用时读取该文件，因此修改地址或启用状态后不需要重启 Codex。

可选环境变量 `DSH_BASE_URL` 可以覆盖设置中保存的地址。但 Harness 内的启用开关优先级更高，关闭后会阻止所有桥接请求。

## 本机安全边界

桥接只接受带明确端口的本机 HTTP 地址：

- `127.0.0.1`
- `localhost`
- `::1`

HTTPS、局域网地址、账号凭据、URL 路径、查询参数和片段都会被拒绝。

## 开发与测试

在仓库根目录运行完整测试：

```powershell
npm test
```

测试覆盖桥接配置、地址校验、Harness 设置接口、版本冲突处理和客户端模块注册。
