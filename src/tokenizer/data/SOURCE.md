# Tokenizer data

`cl100k_base.tiktoken` is the cl100k_base byte-pair-encoding vocabulary used by OpenAI's
`tiktoken` (MIT License, https://github.com/openai/tiktoken), redistributed here via the
`gpt-tokenizer` package (MIT License, https://github.com/niieani/gpt-tokenizer).

Each line is `<base64 token bytes> <rank>`.

The runtime BPE implementation in `../bpe.js` is original code in this repository. The
`gpt-tokenizer` npm package is a **dev-only** dependency used to validate token counts in
`test/tokenizer.test.js`; it is not loaded by the application.
