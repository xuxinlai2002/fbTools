const fs = require('fs');
const path = require('path');

// 读取文件内容
function readFileContent(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error(`读取文件失败 ${filePath}:`, error);
        return [];
    }
}

// 检查重复项
function checkDuplicates(content) {
    const seen = new Set();
    const duplicates = new Set();

    for (const item of content) {
        if (seen.has(item)) {
            duplicates.add(item);
        }
        seen.add(item);
    }

    if (duplicates.size > 0) {
        console.log('发现重复项:');
        duplicates.forEach(item => console.log(item));
        return false;
    }

    console.log(`检查完成，共 ${content.length} 条记录，没有发现重复项`);
    return true;
}

// 生成 inscriptions.json
function generateInscriptionsJson(content) {
    const inscriptions = content.map(id => ({
        id,
        meta: {
            name: "Fractal Jasper NFT"
        }
    }));

    try {
        fs.writeFileSync(
            path.join(__dirname, 'inscriptions.json'),
            JSON.stringify(inscriptions, null, 2)
        );
        console.log('inscriptions.json 生成成功');
    } catch (error) {
        console.error('生成 inscriptions.json 失败:', error);
    }
}

// 主函数
function main() {
    const filePath = path.join(__dirname, 'allInscripitonList2.txt');
    const content = readFileContent(filePath);

    console.log('\n1. 检查重复项:');
    const noDuplicates = checkDuplicates(content);

    if (noDuplicates) {
        console.log('\n2. 生成 inscriptions.json:');
        generateInscriptionsJson(content);
    } else {
        console.log('\n发现重复项，取消生成 inscriptions.json');
    }
}

main();
