const fs = require('fs');
const path = require('path');

// 读取文件函数
function readFileToArray(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').map(line => line.trim()).filter(line => line);
    } catch (error) {
        console.error(`读取文件失败 ${filePath}:`, error);
        return [];
    }
}

// 主函数
async function getDiffAddressList() {
    // 读取所有地址列表
    const allAddressListPath = path.join(__dirname, 'allAddressList.txt');
    const allAddresses = new Set(readFileToArray(allAddressListPath));
    console.log('allAddressList.txt 中的地址数量:', allAddresses.size);

    // 读取铭文数据列表
    const inscriptionDataPath = path.join(__dirname, 'inscriptionDataList.txt');
    const inscriptionLines = readFileToArray(inscriptionDataPath);
    console.log('inscriptionDataList.txt 中的行数:', inscriptionLines.length);

    // 找出 inscriptionDataList.txt 中地址不在 allAddressList.txt 中的行
    const diffLines = inscriptionLines.filter(line => {
        const address = line.split(',')[0]; // 假设地址在每行的第一列
        return !allAddresses.has(address);
    });
    console.log('不在 allAddressList.txt 中的行数:', diffLines.length);

    // 将差异行写入新文件
    const diffAddressListPath = path.join(__dirname, 'diffAddressList.txt');
    fs.writeFileSync(diffAddressListPath, diffLines.join('\n'));
    console.log('差异数据已写入:', diffAddressListPath);
}

// 执行主函数
getDiffAddressList().catch(error => {
    console.error('执行过程中出错:', error);
});
