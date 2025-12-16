const fs = require('fs');
const path = require('path');

// public ディレクトリを作成
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// コピーするファイル/ディレクトリ
const itemsToCopy = [
  'index.html',
  'dashboard.html',
  'project.html',
  'js'
];

// ファイル/ディレクトリをコピー
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 各アイテムをコピー
for (const item of itemsToCopy) {
  const src = path.join(__dirname, item);
  const dest = path.join(publicDir, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`Copied ${item} to public/`);
  }
}

console.log('Build completed successfully!');

