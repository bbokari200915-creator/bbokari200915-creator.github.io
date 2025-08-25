const YouTubeCommentAnalyzer = require('./commentScraping.js');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

async function main() {
  // Get videoId from command line arguments
  const videoId = process.argv[2];

  if (!videoId) {
    console.error('❌ 請提供 YouTube 影片 ID 作為參數');
    console.log('使用方法: node comment.js <videoId>');
    console.log('範例: node comment.js XTfBy-muNH8');
    process.exit(1);
  }

  console.log(`🚀 開始分析影片: ${videoId}`);

  try {
    // Initialize analyzer with API key from config
    const analyzer = new YouTubeCommentAnalyzer(config.YOUTUBE_API_KEY);

    // Analyze the video
    const result = await analyzer.analyzeVideo(videoId, 5000); // 最多獲取5000條留言

    if (result) {
      // Export data to rawdata folder with videoId as filename
      analyzer.exportData(result);

      console.log('\n📋 處理完成！數據已保存到 rawdata 資料夾');
      // console.log('你可以使用以下數據進行進一步分析：');
      // console.log('- result.allComments: 所有留言數據');
      // console.log('- result.groupedComments: 按作者分組的留言');
      // console.log('- result.statistics: 統計資料');
    }

  } catch (error) {
    console.error('❌ 分析失敗:', error.message);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  main();
}