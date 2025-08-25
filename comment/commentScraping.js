const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const YOUTUBE_API_KEY = config.YOUTUBE_API_KEY;

class YouTubeCommentAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  // 1. 獲取所有留言 (含分頁處理)
  async getAllComments(videoId, maxComments = 1000) {
    let allComments = [];
    let nextPageToken = null;
    let requestCount = 0;
    const maxRequestsPerPage = 100; // YouTube API每次最多返回100條

    try {
      do {
        console.log(`正在獲取第 ${requestCount + 1} 頁留言...`);

        const params = {
          part: 'snippet,replies',
          videoId: videoId,
          maxResults: Math.min(maxRequestsPerPage, maxComments - allComments.length),
          key: this.apiKey,
          order: 'time', // 按時間排序
          textFormat: 'plainText'
        };

        if (nextPageToken) {
          params.pageToken = nextPageToken;
        }

        const response = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
          params: params
        });

        const items = response.data.items || [];

        // 處理主留言和回覆
        for (const item of items) {
          const topComment = item.snippet.topLevelComment.snippet;

          // 添加主留言
          allComments.push({
            id: item.snippet.topLevelComment.id,
            author: topComment.authorDisplayName,
            text: topComment.textDisplay,
            publishedAt: topComment.publishedAt,
            likeCount: topComment.likeCount,
            type: 'main'
          });

          // 添加回覆留言
          if (item.replies && item.replies.comments) {
            for (const reply of item.replies.comments) {
              allComments.push({
                id: reply.id,
                author: reply.snippet.authorDisplayName,
                text: reply.snippet.textDisplay,
                publishedAt: reply.snippet.publishedAt,
                likeCount: reply.snippet.likeCount,
                type: 'reply',
                parentId: item.snippet.topLevelComment.id
              });
            }
          }
        }

        nextPageToken = response.data.nextPageToken;
        requestCount++;

        // console.log(`已獲取 ${allComments.length} 條留言`);

        // 避免超過配額，添加延遲
        if (nextPageToken && allComments.length < maxComments) {
          await this.delay(100); // 延遲100毫秒
        }

      } while (nextPageToken && allComments.length < maxComments);

      console.log(`✅ 總共獲取了 ${allComments.length} 條留言`);
      return allComments;

    } catch (error) {
      console.error('獲取留言時發生錯誤:', error.response ? error.response.data || error.message : error.message);
      return allComments; // 返回已獲取的留言
    }
  }

  // 2. 按作者分組留言
  groupCommentsByAuthor(comments) {
    const groupedComments = {};

    comments.forEach(comment => {
      const author = comment.author;

      if (!groupedComments[author]) {
        groupedComments[author] = {
          author: author,
          comments: [],
          totalComments: 0,
          totalLikes: 0,
          firstCommentDate: comment.publishedAt,
          lastCommentDate: comment.publishedAt
        };
      }

      groupedComments[author].comments.push(comment);
      groupedComments[author].totalComments += 1;
      groupedComments[author].totalLikes += comment.likeCount || 0;

      // 更新最早和最晚留言時間
      if (new Date(comment.publishedAt) < new Date(groupedComments[author].firstCommentDate)) {
        groupedComments[author].firstCommentDate = comment.publishedAt;
      }
      if (new Date(comment.publishedAt) > new Date(groupedComments[author].lastCommentDate)) {
        groupedComments[author].lastCommentDate = comment.publishedAt;
      }
    });

    return groupedComments;
  }

  // 3. 計算統計資料
  calculateStatistics(comments, groupedComments) {
    const uniqueAuthors = Object.keys(groupedComments).length;
    const totalComments = comments.length;
    const totalLikes = comments.reduce((sum, comment) => sum + (comment.likeCount || 0), 0);

    // 找出最活躍的用戶
    const sortedAuthors = Object.values(groupedComments).sort((a, b) => b.totalComments - a.totalComments);
    const topCommenters = sortedAuthors.slice(0, 10);

    // 找出獲讚最多的用戶
    const topLikedAuthors = Object.values(groupedComments).sort((a, b) => b.totalLikes - a.totalLikes).slice(0, 10);

    return {
      uniqueAuthors,
      totalComments,
      totalLikes,
      averageCommentsPerAuthor: Math.round(totalComments / uniqueAuthors * 100) / 100,
      topCommenters,
      topLikedAuthors
    };
  }

  // 生成詳細報告
  generateReport(videoId, comments, groupedComments, statistics) {
    console.log('\n' + '='.repeat(50));
    console.log('YouTube 留言分析報告');
    console.log('='.repeat(50));
    console.log(`影片ID: ${videoId}`);
    console.log(`分析日期: ${new Date().toISOString()}`);
    console.log(`總留言數: ${statistics.totalComments}`);
    console.log(`作者數: ${statistics.uniqueAuthors}`);
    // console.log(`總獲讚數: ${statistics.totalLikes}`);
    console.log(`平均每人留言: ${statistics.averageCommentsPerAuthor} 條`);

    console.log('\n最活躍留言者 Top 3:');
    statistics.topCommenters.slice(0, 3).forEach((author, index) => {
      console.log(`${author.author}: ${author.totalComments} 條留言`);
    });

    console.log('\n獲讚最多留言者 Top 3:');
    statistics.topLikedAuthors.slice(0, 3).forEach((author, index) => {
      console.log(`${author.author}: ${author.totalLikes} 個讚`);
    });

    console.log('\n' + '='.repeat(50));
  }

  // 輔助函數：延遲執行
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 輔助函數：從URL提取Video ID
  extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  // 主要分析函數
  async analyzeVideo(videoUrl, maxComments = 1000) {
    const videoId = this.extractVideoId(videoUrl) || videoUrl;

    if (!videoId) {
      throw new Error('無法從URL中提取Video ID');
    }

    console.log(`🚀 開始分析影片: ${videoId}`);

    // 1. 獲取所有留言
    const allComments = await this.getAllComments(videoId, maxComments);

    if (allComments.length === 0) {
      console.log('❌ 未獲取到任何留言');
      return null;
    }

    // 2. 按作者分組
    const groupedComments = this.groupCommentsByAuthor(allComments);

    // 3. 計算統計資料
    const statistics = this.calculateStatistics(allComments, groupedComments);

    // 4. 生成報告
    this.generateReport(videoId, allComments, groupedComments, statistics);

    return {
      videoId,
      allComments,
      groupedComments,
      statistics
    };
  }

  // 導出數據為JSON
  exportData(analysisResult, filename = null) {
    // fs is already imported at the top
    // path is already imported at the top

    // Create rawdata directory if it doesn't exist
    const rawdataDir = path.join(__dirname, 'rawdata');
    if (!fs.existsSync(rawdataDir)) {
      fs.mkdirSync(rawdataDir, {
        recursive: true
      });
    }

    // Use videoId as filename if not provided
    const actualFilename = filename || `${analysisResult.videoId}.json`;
    const fullPath = path.join(rawdataDir, actualFilename);

    const exportData = {
      videoId: analysisResult.videoId,
      analysisDate: new Date().toISOString(),
      statistics: analysisResult.statistics,
      groupedComments: analysisResult.groupedComments,
      // 注意：完整留言數據可能很大，根據需要決定是否包含
      // allComments: analysisResult.allComments
    };

    fs.writeFileSync(fullPath, JSON.stringify(exportData, null, 2));
    // console.log(`📁 數據已導出到: ${fullPath}`);
  }
}

// 使用範例
async function main() {
  // Get videoId from command line arguments
  const videoId = process.argv[2];

  if (!videoId) {
    console.error('❌ 請提供 YouTube 影片 ID 作為參數');
    console.log('使用方法: node commentScraping.js <videoId>');
    console.log('範例: node commentScraping.js XTfBy-muNH8');
    return;
  }

  const analyzer = new YouTubeCommentAnalyzer(YOUTUBE_API_KEY);

  try {
    const result = await analyzer.analyzeVideo(videoId, 5000); // 最多獲取5000條留言

    if (result) {
      // 導出數據到 rawdata 資料夾，檔名為 videoId.json
      analyzer.exportData(result);

      // 可以進一步處理數據
      console.log('\n📋 處理完成！你可以使用以下數據進行進一步分析：');
      console.log('- result.allComments: 所有留言數據');
      console.log('- result.groupedComments: 按作者分組的留言');
      console.log('- result.statistics: 統計資料');
    }

  } catch (error) {
    console.error('❌ 分析失敗:', error.message);
  }
}

// 執行分析
if (require.main === module) {
  main();
}

module.exports = YouTubeCommentAnalyzer;