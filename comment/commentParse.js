const fs = require('fs');
const path = require('path');

// Get videoId from command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error('❌ 請提供 YouTube 影片 ID 作為參數');
  console.log('使用方法: node commentParse.js <videoId>');
  console.log('範例: node commentParse.js 3PQ29hvRuK4');
  process.exit(1);
}

(async () => {
  // Read and parse the data from rawData folder
  const filePath = path.join(__dirname, 'rawData', `${videoId}.json`);
  const data = fs.readFileSync(filePath, 'utf8');
  const analysisData = JSON.parse(data);

  // console.log("=== 基本統計 ===");
  // console.log(`總獨特作者數: ${analysisData.statistics.uniqueAuthors}`);
  // console.log(`總留言數: ${analysisData.statistics.totalComments}`);
  // console.log(`平均每位作者留言數: ${analysisData.statistics.averageCommentsPerAuthor}`);

  // 分析留言頻率分佈
  const authors = Object.values(analysisData.groupedComments);
  const commentCounts = {};

  authors.forEach(author => {
    const count = author.totalComments;
    commentCounts[count] = (commentCounts[count] || 0) + 1;
  });

  console.log("\n=== 留言頻率分佈 ===");
  Object.keys(commentCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(count => {
    console.log(`${count} 則留言: ${commentCounts[count]} 位作者`);
  });
})();