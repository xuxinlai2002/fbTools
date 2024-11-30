const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const FRACTAL_URL = process.env.FRACTAL_URL || 'https://api-mainnet.fractal.id';
const FRACTAL_TOKEN = process.env.FRACTAL_TOKEN;

// 添加重试函数
async function fetchWithRetry(inscriptionId, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(
                `${FRACTAL_URL}/v1/indexer/inscription/info/${inscriptionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${FRACTAL_TOKEN}`,
                        'accept': 'application/json'
                    }
                }
            );
            return response;
        } catch (error) {
            const errorMsg = error.response ? 
                `状态码: ${error.response.status}, 信息: ${JSON.stringify(error.response.data)}` : 
                `错误: ${error.message}`;
            
            console.error(`请求失败 (第 ${i + 1} 次尝试): ${errorMsg}`);
            
            if (i === retries - 1) {
                throw new Error(errorMsg);
            }
            console.log(`2秒后进行第 ${i + 2} 次重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// 验证inscription是否存在
async function validateInscription(inscriptionId) {
    try {
        const response = await fetchWithRetry(inscriptionId);
        if (!response.data || !response.data.data || !response.data.data.address) {
            console.log(`警告: Inscription ${inscriptionId} 验证失败 - 数据不完整`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`验证 ${inscriptionId} 时发生错误:`, error.message);
        return false;
    }
}

// 读取inscriptions.json文件
function readInscriptionsJson() {
    const jsonPath = path.join(__dirname, 'inscriptions.json');
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(jsonContent);
}

// 从JSON中提取InscriptionId
function extractInscriptionIds(inscriptions) {
    return inscriptions.map(inscription => inscription.id);
}

// 检查重复性
function checkDuplicates(inscriptionIds) {
    const uniqueIds = new Set(inscriptionIds);
    if (uniqueIds.size !== inscriptionIds.length) {
        console.log('警告: 发现重复的InscriptionId!');
        console.log(`总数: ${inscriptionIds.length}`);
        console.log(`唯一数: ${uniqueIds.size}`);
        
        // 找出重复项
        const duplicates = inscriptionIds.filter((item, index) => 
            inscriptionIds.indexOf(item) !== index
        );
        console.log('重复的ID:', duplicates);
        return false;
    }
    return true;
}

// 与allInscripitonList.txt比较
function compareWithExistingList(newInscriptionIds) {
    const existingListPath = path.join(__dirname, 'allInscripitonList.txt');
    const existingContent = fs.readFileSync(existingListPath, 'utf8');
    const existingIds = existingContent.trim().split('\n');

    // 转换为Set以便比较
    const newIdsSet = new Set(newInscriptionIds);
    const existingIdsSet = new Set(existingIds);

    // 检查差异
    const onlyInNew = [...newIdsSet].filter(x => !existingIdsSet.has(x));
    const onlyInExisting = [...existingIdsSet].filter(x => !newIdsSet.has(x));

    if (onlyInNew.length > 0 || onlyInExisting.length > 0) {
        console.log('警告: 发现不一致!');
        console.log('只在新列表中存在:', onlyInNew);
        console.log('只在现有列表中存在:', onlyInExisting);
        return false;
    }
    return true;
}

// 格式化进度百分比
function formatProgress(current, total) {
    const percentage = (current / total * 100).toFixed(2);
    return `${current}/${total} (${percentage}%)`;
}

// 主函数
async function main() {
    try {
        // 1. 读取JSON文件
        const inscriptions = readInscriptionsJson();
        console.log(`成功读取inscriptions.json, 包含${inscriptions.length}条记录`);

        // 2. 提取InscriptionId
        const inscriptionIds = extractInscriptionIds(inscriptions);

        // 3. 验证每个inscription的存在性
        console.log('开始验证inscription存在性...');
        const invalidInscriptions = [];
        let processedCount = 0;
        const totalCount = inscriptionIds.length;

        for (const id of inscriptionIds) {
            processedCount++;
            process.stdout.write(`\r正在验证: ${formatProgress(processedCount, totalCount)} - 当前ID: ${id}`);
            
            const isValid = await validateInscription(id);
            if (!isValid) {
                invalidInscriptions.push(id);
                // 在同一行末尾添加验证失败标记
                process.stdout.write(' ❌');
            }
            // 添加延迟以避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 验证完成后换行
        console.log('\n验证完成!');

        if (invalidInscriptions.length > 0) {
            console.log(`\n发现 ${invalidInscriptions.length} 个无效的Inscription:`);
            console.log(invalidInscriptions);
            return;
        }

        // 4. 保存到resultInscription.txt
        const resultPath = path.join(__dirname, 'resultInscription.txt');
        fs.writeFileSync(resultPath, inscriptionIds.join('\n'));
        console.log(`已保存${inscriptionIds.length}个InscriptionId到resultInscription.txt`);

        // 5. 检查重复性
        const noDuplicates = checkDuplicates(inscriptionIds);
        if (!noDuplicates) {
            console.log('验证失败: 发现重复的InscriptionId');
        }

        // 6. 与现有列表比较
        const consistent = compareWithExistingList(inscriptionIds);
        if (!consistent) {
            console.log('验证失败: 与现有列表不一致');
        }

        if (noDuplicates && consistent && invalidInscriptions.length === 0) {
            console.log('所有验证通过!');
        }

    } catch (error) {
        console.error('发生错误:', error);
    }
}

main(); 