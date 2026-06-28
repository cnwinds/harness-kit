const searchNoisePattern = /帮我|帮忙|麻烦|请问|请|一下|一下子|给我|我想知道|我想了解|我想问|想知道|想了解|想问|能不能|可以|有没有|怎么|怎样|如何|怎么样|是什么|说说|讲讲|看看|查一下|搜一下|搜一搜|推荐|分析|介绍|总结/gi;

const normalizeWhitespace = (input: string) => input.replace(/\n{3,}/g, '\n\n').trim();

export const buildSearchQueries = (rawQuery: string, limit = 4) => {
  const compact = normalizeWhitespace(rawQuery.replace(/\s+/g, ' '));
  const core = normalizeWhitespace(
    compact
      .replace(/[?？!！,，。；;：“”"'`~·（）()【】\[\]]/g, ' ')
      .replace(searchNoisePattern, ' ')
      .replace(/\s+/g, ' '),
  );

  const queries = [
    compact,
    core && core !== compact ? core : '',
  ];

  return queries
    .map((query) => normalizeWhitespace(query))
    .filter((query, index, array) => query.length >= 2 && array.indexOf(query) === index)
    .slice(0, limit);
};
