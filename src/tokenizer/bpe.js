const LETTER = "\\p{L}";
const NUMBER = "\\p{N}";
const UPPER = "\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}";
const LOWER = "\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}";
const CONTRACTION = "'(?:[sS\u2019]|[dD]|[mM]|[tT]|[lL][lL]|[vV][eE]|[rR][eE])";
const OPTIONAL_CONTRACTION = `(?:${CONTRACTION})?`;

// cl100k_base pre-tokenization pattern (tiktoken / gpt-tokenizer compatible).
export const CL100K_PATTERN = [
  CONTRACTION,
  `[^\\r\\n${LETTER}${NUMBER}]?[${LETTER}]+`,
  `[${NUMBER}]{1,3}`,
  ` ?[^\\p{White_Space}${LETTER}${NUMBER}]+[\\r\\n]*`,
  `\\p{White_Space}+$`,
  `\\p{White_Space}*[\\r\\n]`,
  `\\p{White_Space}+(?!\\P{White_Space})`,
  `\\p{White_Space}`
].join("|");

// o200k_base pre-tokenization pattern (tiktoken / gpt-tokenizer compatible).
export const O200K_PATTERN = [
  `[^\\r\\n${LETTER}${NUMBER}]?[${UPPER}]*[${LOWER}]+${OPTIONAL_CONTRACTION}`,
  `[^\\r\\n${LETTER}${NUMBER}]?[${UPPER}]+[${LOWER}]*${OPTIONAL_CONTRACTION}`,
  `[${NUMBER}]{1,3}`,
  ` ?[^\\p{White_Space}${LETTER}${NUMBER}]+[\\r\\n\\/]*`,
  `\\p{White_Space}*[\\r\\n]+`,
  `\\p{White_Space}+(?!\\P{White_Space})`,
  `\\p{White_Space}+`
].join("|");

const textEncoder = new TextEncoder();
const MERGE_CACHE_LIMIT = 100000;

export function parseRanks(text) {
  const ranks = new Map();

  for (const line of String(text).split("\n")) {
    if (!line) {
      continue;
    }

    const space = line.indexOf(" ");

    if (space === -1) {
      continue;
    }

    const rank = Number(line.slice(space + 1));

    if (!Number.isFinite(rank)) {
      continue;
    }

    ranks.set(atob(line.slice(0, space)), rank);
  }

  return ranks;
}

function byteString(bytes) {
  let result = "";

  for (let index = 0; index < bytes.length; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }

  return result;
}

export function createEncoder(ranks, pattern = CL100K_PATTERN) {
  const regex = new RegExp(pattern, "gu");
  const cache = new Map();

  function countPiece(piece) {
    const cached = cache.get(piece);

    if (cached !== undefined) {
      return cached;
    }

    const bytes = textEncoder.encode(piece);
    let parts = [];

    for (let index = 0; index < bytes.length; index += 1) {
      parts.push(String.fromCharCode(bytes[index]));
    }

    while (parts.length > 1) {
      let minRank = Infinity;
      let minIndex = -1;

      for (let index = 0; index < parts.length - 1; index += 1) {
        const rank = ranks.get(parts[index] + parts[index + 1]);

        if (rank !== undefined && rank < minRank) {
          minRank = rank;
          minIndex = index;
        }
      }

      if (minIndex === -1) {
        break;
      }

      parts.splice(minIndex, 2, parts[minIndex] + parts[minIndex + 1]);
    }

    const count = parts.length;

    if (cache.size < MERGE_CACHE_LIMIT) {
      cache.set(piece, count);
    }

    return count;
  }

  function count(text) {
    const value = String(text ?? "");

    if (!value) {
      return 0;
    }

    const pieces = value.match(regex);

    if (!pieces) {
      return 0;
    }

    let total = 0;

    for (const piece of pieces) {
      total += countPiece(piece);
    }

    return total;
  }

  return {
    count,
    countPiece,
    size: ranks.size,
    byteString
  };
}
