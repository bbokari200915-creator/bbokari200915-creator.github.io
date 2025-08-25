const fs = require('fs');
const path = require('path');

// Get videoId from command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error('❌ 請提供 YouTube 影片 ID 作為參數');
  console.log('使用方法: node commentAnalysis.js <videoId>');
  console.log('範例: node commentAnalysis.js 3PQ29hvRuK4');
  process.exit(1);
}

(async () => {
  // Complete analysis of YouTube comments data from rawdata folder
  const filePath = path.join(__dirname, 'rawdata', `${videoId}.json`);
  const data = fs.readFileSync(filePath, 'utf8');
  const analysisData = JSON.parse(data);

  // Basic statistics
  // console.log("=== YouTube 留言分析報告 ===");
  // console.log(`影片ID: ${analysisData.videoId}`);
  // console.log(`分析日期: ${analysisData.analysisDate}`);
  // console.log(`作者數: ${analysisData.statistics.uniqueAuthors}`);
  // console.log(`總留言數: ${analysisData.statistics.totalComments} 則`);
  // console.log(`平均每人留言: ${analysisData.statistics.averageCommentsPerAuthor} 則`);

  // Analyze all authors
  const allAuthors = Object.values(analysisData.groupedComments);
  const suspiciousAccounts = [];
  const normalAccounts = [];

  // Define suspicious behavior criteria
  allAuthors.forEach(author => {
    let suspicionScore = 0;
    let issues = [];

    // High comment count (more than 7 comments is suspicious)
    if (author.totalComments > 7) {
      suspicionScore += 2;
      issues.push(`異常高留言數: ${author.totalComments}`);
    }

    // Check for repetitive content
    const commentTexts = author.comments.map(c => c.text.toLowerCase().replace(/[^\w\s]/g, ''));
    const uniqueContent = new Set(commentTexts);
    const repetitionRate = (author.totalComments - uniqueContent.size) / author.totalComments;

    if (repetitionRate > 0.3 && author.totalComments > 2) {
      suspicionScore += 2;
      issues.push(`重複內容率: ${Math.round(repetitionRate * 100)}%`);
    }

    // Username patterns that might indicate automation
    // const username = author.author;
    // const suspiciousPatterns = [
    //   /user-[a-z0-9]+/i, // user-abc123
    //   /@[a-z]+\d{4,}/i, // @username1234
    //   /-[a-z0-9]{3,}$/i, // ending with -abc123
    //   /^@.*-[a-z]{2}[0-9]/i // @something-ab1
    // ];

    // if (suspiciousPatterns.some(pattern => pattern.test(username))) {
    //   suspicionScore += 1;
    //   issues.push('可疑用戶名格式');
    // }

    // Very rapid commenting (multiple comments within short time)
    if (author.totalComments >= 5) {
      const firstTime = new Date(author.firstCommentDate);
      const lastTime = new Date(author.lastCommentDate);
      const timeSpanMinutes = (lastTime - firstTime) / (1000 * 60);

      if (timeSpanMinutes < 60 && author.totalComments >= 5) {
        suspicionScore += 1;
        issues.push(`快速留言: ${Math.round(timeSpanMinutes)}分鐘內${author.totalComments}則留言`);
      }
    }

    // Classify as suspicious if score >= 2
    if (suspicionScore >= 2) {
      suspiciousAccounts.push({
        username: author.author,
        comments: author.totalComments,
        likes: author.totalLikes,
        score: suspicionScore,
        issues: issues
      });
    } else {
      normalAccounts.push(author);
    }
  });

  // Results summary
  console.log("\n=== 用戶類型分析 ===");
  console.log(`可疑帳戶: ${suspiciousAccounts.length} 個 (${(suspiciousAccounts.length/allAuthors.length*100).toFixed(1)}%)`);
  console.log(`正常用戶: ${normalAccounts.length} 個 (${(normalAccounts.length/allAuthors.length*100).toFixed(1)}%)`);

  console.log("\n=== 最可疑的帳戶 ===");
  suspiciousAccounts
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .forEach((account, i) => {
      console.log(`${i+1}. ${account.username}`);
      console.log(`   留言: ${account.comments}則`);
      // console.log(`   留言: ${account.comments}則, 讚數: ${account.likes}`);
      // console.log(`   可疑分數: ${account.score}`);
      console.log(`   問題: ${account.issues.join('; ')}`);
      console.log('');
    });
})();