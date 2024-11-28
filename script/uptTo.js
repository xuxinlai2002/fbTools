
const fs = require('fs');

// 读取原始文件
const content = fs.readFileSync('script/pay.txt', 'utf8');

// 将每行的金额修改为0.0011
const modifiedContent = content.split('\n')
  .map(line => {
    if (!line.trim()) return line;
    const [address, amount] = line.split(',');
    return `${address},0.0011`;
  })
  .join('\n');

// 写入新文件
fs.writeFileSync('script/pay2.txt', modifiedContent);

console.log('处理完成，新文件已保存为 pay2.txt');