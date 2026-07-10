# Content Publishing Workflow

本文说明当前已实现的 content bundle 创建和发布流程。`catalog/content/` 是公开展馆内容的唯一内容来源。

## Flow

```text
content.sh item new / collection new / import apply
  -> catalog/content/drafts/
  -> edit Markdown or HTML note files
  -> content.sh publish
  -> catalog/content/published/
  -> content.sh archive
  -> catalog/content/archived/
  -> content.sh restore
  -> catalog/content/drafts/
```

所有写操作都会加 `.data/catalog-write.lock`。写入或移动后会运行验证；验证失败时脚本会回滚。

## Create Item Draft

AI model:

```sh
./scripts/content.sh item new models ai_model htdemucs-ft-onnx \
  --title "HT-Demucs FT ONNX" \
  --summary "面向音乐四轨分离的 HT-Demucs FT ONNX 模型包。" \
  --source-type huggingface \
  --source-url "https://huggingface.co/StemSplitio/htdemucs-ft-onnx" \
  --provider StemSplitio \
  --input audio \
  --output audio \
  --task source-separation \
  --access download \
  --format onnx \
  --runtime onnxruntime
```

GitHub project:

```sh
./scripts/content.sh item new github github_project gpt-sovits \
  --title "GPT-SoVITS" \
  --summary "支持少样本音色克隆、语音转换和文本转语音实验的 WebUI。" \
  --repo "https://github.com/RVC-Boss/GPT-SoVITS" \
  --category ai \
  --tag audio \
  --maintenance-status unknown
```

The command writes a draft bundle:

```text
catalog/content/drafts/<hall>/items/<id>/
  item.yaml
  index.md
```

## Add Item Note

Markdown note:

```sh
./scripts/content.sh item note add models htdemucs-ft-onnx quick-start \
  --title "快速试用" \
  --summary "记录模型定位、运行入口、输入输出和适用边界。" \
  --format markdown
```

HTML note:

```sh
./scripts/content.sh item note add github gpt-sovits architecture-note \
  --title "架构笔记" \
  --summary "记录架构观察。" \
  --format html \
  --display site
```

Note commands only write to draft items. To edit a published item, archive or restore it first, then publish again after editing.

## Inspect Content

只读查询不会加 `.data/catalog-write.lock`，不会运行验证，也不会触发 build。

```sh
./scripts/content.sh list drafts models
./scripts/content.sh list published github
./scripts/content.sh list models
./scripts/content.sh status models item htdemucs-ft-onnx
./scripts/content.sh show models item htdemucs-ft-onnx
```

`list` 输出 state、hall、type、id 和 title，可以按 publication state、active hall，或二者同时过滤。未知 hall 和 planned hall 会失败，避免把拼写错误误判为空结果。`status` 输出单个 bundle 当前 state 和目录路径。`show` 输出匹配 bundle 的 YAML，并在开头标注 state 和 path。

## Create Collection Draft

```sh
./scripts/content.sh collection new github voice-cloning \
  --title "声音克隆项目" \
  --summary "GitHub 展馆内的声音克隆项目策展。" \
  --item gpt-sovits
```

`collection new` requires at least one item. Draft collections can reference draft or published items in the same hall.

## Publish, Archive, Restore

```sh
./scripts/content.sh publish models item htdemucs-ft-onnx
./scripts/content.sh archive models item htdemucs-ft-onnx
./scripts/content.sh restore models item htdemucs-ft-onnx
```

Rules:

- `publish` moves a bundle from `drafts` to `published` and runs `./scripts/verify.sh release`.
- `archive` moves a bundle from `published` to `archived` and runs `./scripts/verify.sh catalog`.
- `restore` moves a bundle from `archived` to `drafts` and runs `./scripts/verify.sh catalog`.
- `restore` never publishes directly. Publish again after editing.
- Published collections can only reference published items in the same hall.

发布成功后，published content 会生成 canonical routes：

```text
/halls/<hall>/items/<id>/
/halls/<hall>/items/<id>/notes/<note>/
/halls/<hall>/collections/
/halls/<hall>/collections/<id>/
```

发布后的 content 还会进入聚合入口：

- `/` 使用 published content 计算展馆条目数、模型样例和精选专题。
- `/halls/github/` 展示已发布的 `github` hall `github_project` content item 和馆内 collection。
- `/halls/models/` 展示已发布的 `models` hall `ai_model` content item。

## Import Drafts

批量或 AI 生成内容先使用 content import batch 进入 drafts：

```sh
./scripts/content.sh import validate .tmp/import-batches/example-content-batch
./scripts/content.sh import plan .tmp/import-batches/example-content-batch
./scripts/content.sh import diff .tmp/import-batches/example-content-batch
./scripts/content.sh import apply .tmp/import-batches/example-content-batch
```

导入流程见 [`content-import-workflow.md`](./content-import-workflow.md)。导入不会发布内容。

## Boundaries

- Canonical content routes 只读取 `catalog/content/published/`。
