// ==================== 配置区域 ====================
// 请替换为你的 YouTube Data API 密钥
const API_KEY = 'AIzaSyB7O20mxmxSGNgwfyWcPm-UJz2CdKeimTo';

// 工作表名称配置
const CONFIG = {
  INPUT_SHEET: 'A',      // 输入视频ID的工作表
  OUTPUT_SHEET: 'B',     // 默认输出数据的工作表
  INPUT_COLUMN: 1,       // 视频ID在工作表A的列号 (A列 = 1)
  MEMBER_COLUMN: 2,      // 成员列 (B列 = 2)
  GROUP_COLUMN: 3,       // 分组列 (C列 = 3)
  SHEET_NAME_COLUMN: 4,  // 工作表名称列 (D列 = 4)
  START_ROW: 2          // 开始读取的行号 (跳过表头)
};

// ==================== 主要功能函数 ====================

/**
 * 从YouTube URL提取视频ID
 */
function getVideoIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : url; // 如果不是URL，直接返回原值作为ID
}

/**
 * 获取YouTube视频统计数据（使用UrlFetch）
 */
function getYouTubeStats(videoId) {
  try {
    // 清理视频ID
    const cleanId = getVideoIdFromUrl(videoId);
    if (!cleanId) {
      throw new Error('Invalid video ID');
    }
    
    // 构建API URL
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${cleanId}&key=${API_KEY}`;
    
    // 发送HTTP请求
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      const stats = video.statistics;
      const snippet = video.snippet;
      
      return {
        success: true,
        title: snippet.title,
        channelTitle: snippet.channelTitle,
        publishedAt: new Date(snippet.publishedAt),
        viewCount: parseInt(stats.viewCount) || 0,
        likeCount: parseInt(stats.likeCount) || 0,
        commentCount: parseInt(stats.commentCount) || 0,
        videoId: cleanId
      };
    } else {
      throw new Error('Video not found or API quota exceeded');
    }
    
  } catch (error) {
    console.error(`Error fetching stats for ${videoId}:`, error);
    return {
      success: false,
      error: error.toString(),
      videoId: videoId
    };
  }
}

/**
 * 批量获取YouTube数据（使用UrlFetch）
 */
function getBatchYouTubeStats(videoIds) {
  const results = [];
  const batchSize = 50; // YouTube API限制
  
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const cleanIds = batch.map(id => getVideoIdFromUrl(id)).filter(id => id !== null);
    
    if (cleanIds.length === 0) continue;
    
    try {
      // 构建API URL
      const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${cleanIds.join(',')}&key=${API_KEY}`;
      
      // 发送HTTP请求
      const response = UrlFetchApp.fetch(url);
      const data = JSON.parse(response.getContentText());
      
      if (data.items) {
        // 创建结果映射
        const resultMap = {};
        data.items.forEach(video => {
          const stats = video.statistics;
          const snippet = video.snippet;
          
          resultMap[video.id] = {
            success: true,
            title: snippet.title,
            channelTitle: snippet.channelTitle,
            publishedAt: new Date(snippet.publishedAt),
            viewCount: parseInt(stats.viewCount) || 0,
            likeCount: parseInt(stats.likeCount) || 0,
            commentCount: parseInt(stats.commentCount) || 0,
            videoId: video.id
          };
        });
        
        // 按原始顺序添加结果
        batch.forEach(originalId => {
          const cleanId = getVideoIdFromUrl(originalId);
          if (resultMap[cleanId]) {
            results.push(resultMap[cleanId]);
          } else {
            results.push({
              success: false,
              error: 'Video not found or inaccessible',
              videoId: originalId
            });
          }
        });
      } else if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Batch API error:', error);
      // 为失败的批次添加错误记录
      batch.forEach(id => {
        results.push({
          success: false,
          error: error.toString(),
          videoId: id
        });
      });
    }
    
    // 添加延迟以避免API限流
    if (i + batchSize < videoIds.length) {
      Utilities.sleep(1000); // 1秒延迟
    }
  }
  
  return results;
}

/**
 * 主要数据更新函数
 */
function updateYouTubeData() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // 获取输入工作表
    let inputSheet;
    
    try {
      inputSheet = spreadsheet.getSheetByName(CONFIG.INPUT_SHEET);
    } catch (error) {
      throw new Error(`无法找到工作表。请确保存在名为 "${CONFIG.INPUT_SHEET}" 的工作表。`);
    }
    
    if (!inputSheet) {
      throw new Error(`工作表不存在。请检查工作表名称：${CONFIG.INPUT_SHEET}`);
    }
    
    // 从工作表A读取完整数据
    const lastRow = inputSheet.getLastRow();
    if (lastRow < CONFIG.START_ROW) {
      console.log('工作表A中没有视频ID数据');
      return;
    }
    
    // 读取所有相关列的数据
    const inputData = inputSheet.getRange(CONFIG.START_ROW, 1, lastRow - CONFIG.START_ROW + 1, 4).getValues();
    
    // 处理每一行数据
    const validRows = [];
    inputData.forEach((row, index) => {
      const videoId = row[0];
      const member = row[1] || '';
      const group = row[2] || '';
      const sheetName = row[3] || CONFIG.OUTPUT_SHEET; // 如果没有指定工作表名称，使用默认的
      
      if (videoId && videoId.toString().trim() !== '') {
        validRows.push({
          videoId: videoId.toString().trim(),
          member: member.toString().trim(),
          group: group.toString().trim(),
          sheetName: sheetName.toString().trim(),
          rowIndex: index + CONFIG.START_ROW
        });
      }
    });
    
    if (validRows.length === 0) {
      console.log('没有找到有效的视频ID');
      return;
    }
    
    console.log(`找到 ${validRows.length} 个视频ID，开始获取数据...`);
    
    // 批量获取YouTube数据
    const videoIds = validRows.map(row => row.videoId);
    const youtubeData = getBatchYouTubeStats(videoIds);
    
    // 按工作表分组处理数据
    const sheetGroups = {};
    validRows.forEach((row, index) => {
      const sheetName = row.sheetName;
      if (!sheetGroups[sheetName]) {
        sheetGroups[sheetName] = [];
      }
      
      sheetGroups[sheetName].push({
        ...row,
        youtubeData: youtubeData[index]
      });
    });
    
    // 为每个工作表更新数据
    Object.keys(sheetGroups).forEach(sheetName => {
      updateDataForSheet(spreadsheet, sheetName, sheetGroups[sheetName]);
    });
    
    console.log(`数据更新完成，处理了 ${youtubeData.length} 个视频，涉及 ${Object.keys(sheetGroups).length} 个工作表`);
    
  } catch (error) {
    console.error('更新数据时发生错误:', error);
    // 可以选择发送邮件通知错误
    // MailApp.sendEmail('your-email@example.com', 'YouTube数据更新错误', error.toString());
  }
}

/**
 * 为指定工作表更新数据
 */
function updateDataForSheet(spreadsheet, sheetName, dataRows) {
  try {
    // 获取INPUT_SHEET来更新viewCount和likeCount
    const inputSheet = spreadsheet.getSheetByName(CONFIG.INPUT_SHEET);
    if (!inputSheet) {
      throw new Error(`无法找到输入工作表: ${CONFIG.INPUT_SHEET}`);
    }
    
    // 读取INPUT_SHEET的所有数据来找到匹配的videoId
    const lastRow = inputSheet.getLastRow();
    if (lastRow < CONFIG.START_ROW) {
      console.log('INPUT_SHEET中没有数据');
      return;
    }
    
    // 读取INPUT_SHEET的数据（包括videoId列）
    const inputData = inputSheet.getRange(CONFIG.START_ROW, CONFIG.INPUT_COLUMN, lastRow - CONFIG.START_ROW + 1, 1).getValues();
    
    // 为每个dataRow更新对应的viewCount和likeCount
    dataRows.forEach(row => {
      const youtubeData = row.youtubeData;
      
      if (youtubeData.success) {
        // 在INPUT_SHEET中找到匹配的videoId行
        for (let i = 0; i < inputData.length; i++) {
          const inputVideoId = getVideoIdFromUrl(inputData[i][0]);
          
          if (inputVideoId === youtubeData.videoId) {
            const targetRow = i + CONFIG.START_ROW;
            
            // 更新第6列(F列)的viewCount和第7列(G列)的likeCount
            inputSheet.getRange(targetRow, 6).setNumberFormat('#,##0').setValue(youtubeData.viewCount);
            inputSheet.getRange(targetRow, 7).setNumberFormat('#,##0').setValue(youtubeData.likeCount);
            
            console.log(`已更新视频 ${youtubeData.videoId} 的数据: 观看次数=${youtubeData.viewCount}, 点赞数=${youtubeData.likeCount}`);
            break;
          }
        }
      } else {
        console.error(`获取视频 ${youtubeData.videoId} 数据失败: ${youtubeData.error}`);
      }
    });

    // 获取或创建目标工作表
    let targetSheet = spreadsheet.getSheetByName(sheetName);
    if (!targetSheet) {
      targetSheet = spreadsheet.insertSheet(sheetName);
      console.log(`创建新工作表: ${sheetName}`);
    }
    
    // 初始化目标工作表的表头
    initializeOutputSheet(targetSheet);
    
    // 读取现有的成员数据
    const existingData = getExistingMemberData(targetSheet);
    
    // 更新目标工作表
    updateOutputSheet(targetSheet, dataRows, existingData);
    
    console.log(`已更新工作表 "${sheetName}"，包含 ${dataRows.length} 个视频`);
    
  } catch (error) {
    console.error(`更新工作表 "${sheetName}" 时出错:`, error);
  }
}

/**
 * 初始化输出工作表的表头
 */
function initializeOutputSheet(sheet) {
  const headers = ['成员', '标题', '频道', '发布日期', '观看次数', '点赞数', '评论数', '视频ID', '分组', '更新时间'];
  
  // 检查是否已有表头
  if (sheet.getRange(1, 1).getValue() !== '成员') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 格式化表头
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
    headerRange.setHorizontalAlignment('center');
  }
}

/**
 * 获取现有的成员数据（从最新的记录中获取）
 */
function getExistingMemberData(sheet) {
  const memberData = {};
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    
    // 从下往上遍历，获取每个视频ID的最新成员信息
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const videoId = row[7]; // 视频ID在第8列
      const member = row[0];   // 成员在第1列
      const group = row[8];    // 分组在第9列
      
      if (videoId && !memberData[videoId]) {
        memberData[videoId] = {
          member: member || '',
          group: group || ''
        };
      }
    }
  }
  
  return memberData;
}

/**
 * 更新输出工作表（新增模式 - 每次更新都往下新增）
 */
function updateOutputSheet(sheet, dataRows, existingMemberData) {
  // 找到下一个可用的空行
  const lastRow = sheet.getLastRow();
  const startRow = lastRow + 1;
  
  // 准备新数据
  const newData = [];
  const now = new Date();
  
  dataRows.forEach(row => {
    const youtubeData = row.youtubeData;
    
    if (youtubeData.success) {
      // 使用输入数据中的成员和分组信息，如果为空则使用已有数据
      const member = row.member || 
                    (existingMemberData[youtubeData.videoId] ? existingMemberData[youtubeData.videoId].member : '');
      const group = row.group || 
                   (existingMemberData[youtubeData.videoId] ? existingMemberData[youtubeData.videoId].group : '');
      
      newData.push([
        member,                   // 成员
        youtubeData.title,        // 标题
        youtubeData.channelTitle, // 频道
        youtubeData.publishedAt,  // 发布日期
        youtubeData.viewCount,    // 观看次数
        youtubeData.likeCount,    // 点赞数
        youtubeData.commentCount, // 评论数
        youtubeData.videoId,      // 视频ID
        group,                    // 分组
        now                       // 更新时间
      ]);
    } else {
      // 错误数据也要记录
      const member = row.member || 
                    (existingMemberData[youtubeData.videoId] ? existingMemberData[youtubeData.videoId].member : '');
      const group = row.group || 
                   (existingMemberData[youtubeData.videoId] ? existingMemberData[youtubeData.videoId].group : '');
      
      newData.push([
        member,
        `错误: ${youtubeData.error}`,
        '',
        '',
        0,
        0,
        0,
        youtubeData.videoId,
        group,
        now
      ]);
    }
  });
  
  // 写入数据到新行
  if (newData.length > 0) {
    sheet.getRange(startRow, 1, newData.length, 10).setValues(newData);
    
    // 格式化新添加的数据
    formatNewRows(sheet, startRow, newData.length);
    
    console.log(`已新增 ${newData.length} 行数据，从第 ${startRow} 行开始`);
  }
}

/**
 * 格式化新添加的行
 */
function formatNewRows(sheet, startRow, rowCount) {
  if (rowCount <= 0) return;
  
  const endRow = startRow + rowCount - 1;
  
  // 格式化数字列（观看次数、点赞数、评论数）
  sheet.getRange(startRow, 5, rowCount, 3).setNumberFormat('#,##0');
  
  // 格式化日期列
  sheet.getRange(startRow, 4, rowCount, 1).setNumberFormat('yyyy-mm-dd'); // 发布日期
  sheet.getRange(startRow, 10, rowCount, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss'); // 更新时间
  
  // 设置数据对齐
  sheet.getRange(startRow, 5, rowCount, 3).setHorizontalAlignment('right'); // 数字右对齐
  sheet.getRange(startRow, 4, rowCount, 1).setHorizontalAlignment('center'); // 日期居中
  sheet.getRange(startRow, 10, rowCount, 1).setHorizontalAlignment('center'); // 更新时间居中
  
  // 添加交替行颜色（可选）
  if (startRow % 2 === 0) {
    sheet.getRange(startRow, 1, rowCount, 10).setBackground('#f8f9fa');
  }
}

// ==================== 触发器管理 ====================

/**
 * 设置定时触发器（每5分钟执行一次）
 * 注意：频繁更新会消耗更多API配额
 */
function setupTimeTrigger() {
  // 先清除现有的触发器
  clearAllTriggers();
  
  // 创建新的5分钟触发器
  ScriptApp.newTrigger('updateYouTubeData')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  console.log('已设置每5分钟执行一次的触发器');
  console.log('⚠️  提醒：频繁更新会消耗更多API配额');
}

/**
 * 清除所有触发器
 */
function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  console.log(`已清除 ${triggers.length} 个触发器`);
}

/**
 * 删除每小时触发器函数
 */

// ==================== 菜单和界面 ====================

/**
 * 创建自定义菜单
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎬 YouTube 数据管理')
    .addItem('🔄 立即更新数据', 'updateYouTubeData')
    .addSeparator()
    .addSubMenu(ui.createMenu('⏰ 设置定时更新')
      .addItem('每5分钟', 'setupTimeTrigger'))
    .addItem('⏸️ 停止自动更新', 'clearAllTriggers')
    .addSeparator()
    .addItem('📈 查看更新状态', 'showUpdateStatus')
    .addItem('🛠️ 初始化工作表', 'initializeWorksheets')
    .addToUi();
}

/**
 * 初始化工作表结构
 */
function initializeWorksheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // 创建或获取工作表A
  let sheetA = spreadsheet.getSheetByName(CONFIG.INPUT_SHEET);
  if (!sheetA) {
    sheetA = spreadsheet.insertSheet(CONFIG.INPUT_SHEET);
  }
  
  // 设置工作表A的表头
  const inputHeaders = ['视频ID或URL', '成员', '分组', '工作表名称'];
  sheetA.getRange(1, 1, 1, inputHeaders.length).setValues([inputHeaders]);
  
  // 格式化表头
  const inputHeaderRange = sheetA.getRange(1, 1, 1, inputHeaders.length);
  inputHeaderRange.setFontWeight('bold').setBackground('#34a853').setFontColor('white');
  
  // 添加示例数据
  if (sheetA.getRange(2, 1).getValue() === '') {
    const exampleData = [
      ['A1qYI-lpCrw', '成员1', '组别A', 'B'],
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', '成员2', '组别B', '特殊组'],
      ['', '成员3', '组别A', 'B'] // 空视频ID作为占位符
    ];
    sheetA.getRange(2, 1, exampleData.length, 4).setValues(exampleData);
  }
  
  // 创建或获取工作表B
  let sheetB = spreadsheet.getSheetByName(CONFIG.OUTPUT_SHEET);
  if (!sheetB) {
    sheetB = spreadsheet.insertSheet(CONFIG.OUTPUT_SHEET);
  }
  
  // 初始化工作表B
  initializeOutputSheet(sheetB);
  
  // 自动调整列宽
  sheetA.autoResizeColumns(1, 4);
  sheetB.autoResizeColumns(1, 10);
  
  SpreadsheetApp.getUi().alert('初始化完成', 
    `工作表已初始化：\n` +
    `- 工作表 ${CONFIG.INPUT_SHEET}: 输入视频ID、成员、分组、工作表名称\n` +
    `- 工作表 ${CONFIG.OUTPUT_SHEET}: 显示YouTube数据（默认输出工作表）\n\n` +
    `新功能说明：\n` +
    `• 可以在工作表A中指定成员和分组信息\n` +
    `• 可以通过"工作表名称"列将数据分别存储到不同工作表\n` +
    `• 如果工作表名称为空，将存储到默认的B工作表\n\n` +
    `请在工作表A中添加视频ID和相关信息，然后运行"立即更新数据"`, 
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ==================== 测试函数 ====================

/**
 * 测试单个视频数据获取
 */
function testSingleVideo() {
  const testId = 'A1qYI-lpCrw';
  console.log('测试视频ID:', testId);
  
  const result = getYouTubeStats(testId);
  console.log('测试结果:', result);
  
  return result;
}

/**
 * 测试完整流程
 */
function testFullProcess() {
  console.log('开始测试完整流程...');
  updateYouTubeData();
  console.log('测试完成');
}

/**
 * 格式化统计工作表
 */
function formatStatsSheet(sheet, startRow, rowCount) {
  if (rowCount <= 0) return;
  
  // 格式化数字列
  sheet.getRange(startRow, 3, rowCount, 5).setNumberFormat('#,##0'); // 视频数量到平均观看次数
  sheet.getRange(startRow, 8, rowCount, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss'); // 更新时间
  
  // 设置数据对齐
  sheet.getRange(startRow, 3, rowCount, 5).setHorizontalAlignment('right'); // 数字右对齐
  sheet.getRange(startRow, 8, rowCount, 1).setHorizontalAlignment('center'); // 更新时间居中
  
  // 添加条件格式（观看次数）
  const viewRange = sheet.getRange(startRow, 4, rowCount, 1);
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMaxpoint('#34a853')
    .setGradientMinpoint('#ffffff')
    .setRanges([viewRange])
    .build();
  sheet.setConditionalFormatRules([rule]);
}