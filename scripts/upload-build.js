import { put } from '@vercel/blob';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从环境变量获取 BLOB_READ_WRITE_TOKEN
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('错误: 请设置环境变量 BLOB_READ_WRITE_TOKEN');
  console.log('你可以在 Vercel Dashboard > Storage > Blob Store > Settings 中找到这个 token');
  process.exit(1);
}

// Build 文件夹路径
const buildDir = join(__dirname, '..', 'Build');
const uploadedUrls = {};

// 递归读取目录中的所有文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = join(dirPath, file);
    if (statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// 上传单个文件
async function uploadFile(filePath) {
  try {
    const fileContent = readFileSync(filePath);
    const relativePath = filePath.replace(buildDir + '\\', '').replace(buildDir + '/', '');
    const blobPath = `build/${relativePath}`;
    
    console.log(`正在上传: ${relativePath}...`);
    
    const { url } = await put(blobPath, fileContent, {
      access: 'public',
      token: token,
      addRandomSuffix: false, // 保持文件名不变
    });
    
    console.log(`✓ 上传成功: ${url}`);
    uploadedUrls[relativePath] = url;
    
    return url;
  } catch (error) {
    console.error(`✗ 上传失败 ${filePath}:`, error.message);
    throw error;
  }
}

// 主函数
async function main() {
  console.log('开始上传 Build 文件到 Vercel Blob Storage...\n');
  
  const files = getAllFiles(buildDir);
  console.log(`找到 ${files.length} 个文件需要上传\n`);
  
  // 上传所有文件
  for (const file of files) {
    await uploadFile(file);
  }
  
  // 生成配置文件
  const baseUrl = Object.values(uploadedUrls)[0]?.replace(/\/[^\/]+$/, '') || '';
  const configContent = `// 自动生成的 Blob Storage URL 配置
// 此文件由 upload-build.js 脚本自动生成
// 请勿手动编辑此文件

(function() {
  'use strict';
  
  // Blob Storage 基础 URL
  window.BLOB_BASE_URL = ${JSON.stringify(baseUrl)};
  
  // Blob Storage 文件 URLs
  window.BLOB_URLS = ${JSON.stringify(uploadedUrls, null, 2)};
  
  console.log('[Blob Config] Blob Storage URLs loaded:', Object.keys(window.BLOB_URLS).length, 'files');
})();
`;
  
  const configPath = join(__dirname, '..', 'blob-config.js');
  const fs = await import('fs');
  fs.writeFileSync(configPath, configContent, 'utf-8');
  
  console.log('\n✓ 所有文件上传完成！');
  console.log(`✓ 配置文件已生成: ${configPath}`);
  console.log('\n上传的文件 URL:');
  Object.entries(uploadedUrls).forEach(([path, url]) => {
    console.log(`  ${path}: ${url}`);
  });
  
  // 生成 .env.local 示例
  const baseUrl = Object.values(uploadedUrls)[0]?.replace(/\/[^\/]+$/, '') || '';
  console.log(`\n请在 Vercel 项目设置中添加环境变量:`);
  console.log(`BLOB_BASE_URL=${baseUrl}`);
}

main().catch((error) => {
  console.error('上传过程出错:', error);
  process.exit(1);
});

