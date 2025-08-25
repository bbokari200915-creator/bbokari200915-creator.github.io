const {
  spawn
} = require('child_process');
const fs = require('fs');
const path = require('path');

async function runAnalysisAndCapture(videoId) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['index.js', videoId], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output); // Still show output to user
      stdout += output;
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(output);
      stderr += output;
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Analysis failed with code ${code}: ${stderr}`));
      }
    });
  });
}

function parseAnalysisOutput(output, videoId, name = '', videoName = '') {
  const lines = output.split('\n');

  // Initialize result object
  const result = {
    videoUrl: videoId,
    analysisDate: new Date().toISOString(),
    name: name,
    videoName: videoName,
    totalComments: 0,
    totalAuthors: 0,
    avgCommentsPerPerson: 0,
    suspiciousAccounts: 0,
    normalUsers: 0,
    suspiciousRate: 0,
    commentFrequency: [],
    suspiciousAccountsList: [],
    topCommenters: [],
    topLiked: []
  };

  let currentSection = '';
  let suspiciousAccountsData = [];
  let topCommentersData = [];
  let topLikedData = [];
  let commentFreqData = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Parse basic statistics
    if (line.includes('總留言數:')) {
      result.totalComments = parseInt(line.match(/\d+/)[0]);
    }
    if (line.includes('作者數:')) {
      result.totalAuthors = parseInt(line.match(/\d+/)[0]);
    }
    if (line.includes('平均每人留言:')) {
      result.avgCommentsPerPerson = parseFloat(line.match(/[\d.]+/)[0]);
    }

    // Parse user type analysis
    if (line.includes('可疑帳戶:')) {
      const match = line.match(/可疑帳戶: (\d+) 個 \(([\d.]+)%\)/);
      if (match) {
        result.suspiciousAccounts = parseInt(match[1]);
        result.suspiciousRate = parseFloat(match[2]);
      }
    }
    if (line.includes('正常用戶:')) {
      const match = line.match(/正常用戶: (\d+) 個/);
      if (match) {
        result.normalUsers = parseInt(match[1]);
      }
    }

    // Track sections
    if (line.includes('=== 最可疑的帳戶 ===')) {
      currentSection = 'suspicious';
      continue;
    }
    if (line.includes('最活躍留言者 Top 3:')) {
      currentSection = 'topCommenters';
      continue;
    }
    if (line.includes('獲讚最多留言者 Top 3:')) {
      currentSection = 'topLiked';
      continue;
    }
    if (line.includes('則留言:') && line.includes('位作者')) {
      // Parse comment frequency data
      const match = line.match(/(\d+) 則留言: (\d+) 位作者/);
      if (match) {
        commentFreqData.push({
          comments: parseInt(match[1]),
          authors: parseInt(match[2])
        });
      }
      continue;
    }

    // Parse suspicious accounts
    if (currentSection === 'suspicious' && line.match(/^\d+\./)) {
      const username = line.replace(/^\d+\.\s*/, '');
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const issuesLine = i + 2 < lines.length ? lines[i + 2].trim() : '';

      let comments = 0;
      if (nextLine.includes('留言:')) {
        const match = nextLine.match(/留言: (\d+)則/);
        if (match) comments = parseInt(match[1]);
      }

      let issues = '';
      if (issuesLine.includes('問題:')) {
        issues = issuesLine.replace('問題: ', '');
      }

      suspiciousAccountsData.push({
        username: username,
        comments: comments,
        issues: issues
      });
    }

    // Parse top commenters
    if (currentSection === 'topCommenters' && line.includes(': ') && line.includes('條留言')) {
      const match = line.match(/^(.+): (\d+) 條留言/);
      if (match) {
        topCommentersData.push({
          username: match[1],
          comments: parseInt(match[2])
        });
      }
    }

    // Parse top liked
    if (currentSection === 'topLiked' && line.includes(': ') && line.includes('個讚')) {
      const match = line.match(/^(.+): (\d+) 個讚/);
      if (match) {
        topLikedData.push({
          username: match[1],
          likes: parseInt(match[2])
        });
      }
    }
  }

  // Assign parsed data
  result.commentFrequency = commentFreqData;
  result.suspiciousAccountsList = suspiciousAccountsData;
  result.topCommenters = topCommentersData;
  result.topLiked = topLikedData;

  return result;
}

function parseArguments() {
  const args = process.argv.slice(2);
  const result = {
    videoId: '',
    name: '',
    videoName: ''
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-name' && i + 1 < args.length) {
      result.name = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (args[i] === '-videoName' && i + 1 < args.length) {
      result.videoName = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (!args[i].startsWith('-')) {
      // First non-flag argument is videoId
      if (!result.videoId) {
        result.videoId = args[i];
      }
    }
  }

  return result;
}

async function main() {
  const {
    videoId,
    name,
    videoName
  } = parseArguments();

  if (!videoId) {
    console.error('❌ 請提供 YouTube 影片 ID 作為參數');
    console.log('使用方法: node analyzeAndSave.js <videoId> [-name <名稱>] [-videoName <影片名稱>]');
    console.log('範例: node analyzeAndSave.js 3PQ29hvRuK4 -name "Felix" -videoName "音銀 1"');
    process.exit(1);
  }

  try {
    console.log(`🚀 開始執行分析並保存結果 (影片ID: ${videoId})...\n`);

    // Run analysis and capture output
    const output = await runAnalysisAndCapture(videoId);

    // Parse output into JSON format
    const result = parseAnalysisOutput(output, videoId, name, videoName);

    // Create resultData directory if it doesn't exist
    const resultDataDir = path.join(__dirname, 'resultData');
    if (!fs.existsSync(resultDataDir)) {
      fs.mkdirSync(resultDataDir, {
        recursive: true
      });
    }

    // Save to JSON file
    const outputPath = path.join(resultDataDir, `${videoId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\n✅ 分析完成！結果已保存到: ${outputPath}`);
    console.log(`📊 摘要: ${result.totalComments}則留言, ${result.totalAuthors}位作者, ${result.suspiciousAccounts}個可疑帳戶 (${result.suspiciousRate}%)`);

  } catch (error) {
    console.error('\n💥 執行過程中發生錯誤:', error.message);
    process.exit(1);
  }
}

main();