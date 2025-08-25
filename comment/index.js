const { spawn } = require('child_process');
const path = require('path');

// Function to run a Node.js script and return a promise
function runScript(scriptName, videoId) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== 執行 ${scriptName} ===`);

    const args = [scriptName];
    if (videoId) {
      args.push(videoId);
    }

    const child = spawn('node', args, {
      cwd: __dirname,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n=== ✅ ${scriptName} 執行完成 ===`);
        resolve();
      } else {
        console.error(`❌ ${scriptName} 執行失敗，退出碼: ${code}`);
        reject(new Error(`Script ${scriptName} failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ 執行 ${scriptName} 時發生錯誤:`, error);
      reject(error);
    });
  });
}

// Main function to run all scripts in sequence
async function main() {
  // Get videoId from command line arguments
  const videoId = process.argv[2];

  if (!videoId) {
    console.error('❌ 請提供 YouTube 影片 ID 作為參數');
    console.log('使用方法: node index.js <videoId>');
    console.log('範例: node index.js 3PQ29hvRuK4');
    process.exit(1);
  }

  try {
    console.log(`🚀 開始執行 YouTube 留言分析流程 (影片ID: ${videoId})...\n`);

    // Step 1: Run comment scraping
    await runScript('comment.js', videoId);

    // Step 2: Run comment parsing
    await runScript('commentParse.js', videoId);

    // Step 3: Run comment analysis
    await runScript('commentAnalysis.js', videoId);

    console.log('\n🎉 所有分析腳本執行完成！');

  } catch (error) {
    console.error('\n💥 執行過程中發生錯誤:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();