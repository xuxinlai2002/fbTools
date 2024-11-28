const fs = require('fs');

function checkDuplicatesAndCount(filePath) {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 按行分割并过滤空行
    const lines = content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('...'));
    
    // 使用Set来检查重复
    const uniqueLines = new Set(lines);
    
    // 统计结果
    const stats = {
        totalLines: lines.length,
        uniqueLines: uniqueLines.size,
        hasDuplicates: lines.length !== uniqueLines.size,
        duplicates: []
    };

    // 如果有重复，找出重复的项
    if (stats.hasDuplicates) {
        const seen = new Set();
        lines.forEach(line => {
            if (seen.has(line)) {
                stats.duplicates.push(line);
            } else {
                seen.add(line);
            }
        });
    }

    return stats;
}

// 检查两个文件
const files = [
    'public/script/allAddressList.txt',
    'public/script/allInscripitonList.txt'
];

files.forEach(file => {
    console.log(`\n检查文件: ${file}`);
    const stats = checkDuplicatesAndCount(file);
    console.log(`总行数: ${stats.totalLines}`);
    console.log(`唯一数: ${stats.uniqueLines}`);
    console.log(`是否存在重复: ${stats.hasDuplicates ? '是' : '否'}`);
    
    if (stats.hasDuplicates) {
        console.log('重复的地址:');
        stats.duplicates.forEach(dup => console.log(dup));
    }
});
