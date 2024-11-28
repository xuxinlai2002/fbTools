const fs = require('fs');
const path = require('path');

// 读取文件内容
function readFileContent(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// 主函数
function checkInscriptions() {
    try {
        // 读取文件
        const addressListContent = readFileContent(path.join(__dirname, 'allAddressList.txt'));
        const inscriptionDataContent = readFileContent(path.join(__dirname, 'inscriptionDataList.txt'));
        
        // 创建输出文件流
        const outputStream = fs.createWriteStream(path.join(__dirname, 'check.txt'));
        
        // 统计变量
        let totalAddresses = 0;
        let mismatchCount = 0;
        const mismatchAddresses = new Set();
        
        // 解析地址列表文件
        const addressLines = addressListContent.split('\n').filter(line => line.trim());
        totalAddresses = addressLines.length;
        
        // 解析inscription数据文件
        const inscriptionDataMap = new Map();
        inscriptionDataContent.split('\n')
            .filter(line => line.trim())
            .forEach(line => {
                const [address, ...inscriptions] = line.split(',');
                inscriptionDataMap.set(address, inscriptions);
            });
            
        // 检查每个地址
        addressLines.forEach(addressLine => {
            // 跳过空行
            if (!addressLine.trim()) return;
            
            // 获取地址和其inscription ID
            const [address, inscriptionId] = addressLine.split(',');
            if (!address || !inscriptionId) return;
            
            // 获取该地址的所有inscription数据
            const addressInscriptions = inscriptionDataMap.get(address) || [];
            
            // 检查inscriptionId是否存在于数据中
            if (!addressInscriptions.includes(inscriptionId)) {
                // 如果不存在，写入check.txt
                outputStream.write(`${address},${inscriptionId}\n`);
                mismatchCount++;
                mismatchAddresses.add(address);
            }
        });
        
        // 关闭输出流
        outputStream.end();
        
        // 输出统计信息
        console.log('检查完成，统计结果：');
        console.log('总地址数：', totalAddresses);
        console.log('不匹配记录数：', mismatchCount);
        console.log('不匹配地址数：', mismatchAddresses.size);
        console.log('匹配率：', ((totalAddresses - mismatchCount) / totalAddresses * 100).toFixed(2) + '%');
        
        // 将统计信息也写入文件
        const statsStream = fs.createWriteStream(path.join(__dirname, 'check_stats.txt'));
        statsStream.write('检查统计结果：\n');
        statsStream.write(`总地址数：${totalAddresses}\n`);
        statsStream.write(`不匹配记录数：${mismatchCount}\n`);
        statsStream.write(`不匹配地址数：${mismatchAddresses.size}\n`);
        statsStream.write(`匹配率：${((totalAddresses - mismatchCount) / totalAddresses * 100).toFixed(2)}%\n`);
        statsStream.end();
        
    } catch (error) {
        console.error('发生错误:', error);
    }
}

// 执行主函数
checkInscriptions();
