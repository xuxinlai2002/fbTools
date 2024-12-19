const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const FRACTAL_URL = process.env.FRACTAL_URL;
const FRACTAL_TOKEN = process.env.FRACTAL_TOKEN;

// 显示进度和预计时间
function showProgress(current, total, startTime) {
    const percent = (current / total * 100).toFixed(2);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = current / elapsed;
    const remaining = (total - current) / speed;
    
    process.stdout.write(`\r进度: ${percent}% (${current}/${total}) ` +
        `已用时: ${elapsed.toFixed(1)}秒 ` +
        `预计剩余: ${remaining.toFixed(1)}秒 ` +
        `速度: ${speed.toFixed(2)}条/秒`);
}

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
            
            if (i === retries - 1) {
                throw new Error(errorMsg);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// 获取inscription的地址
async function getInscriptionAddress(inscriptionId) {
    try {
        const response = await fetchWithRetry(inscriptionId);
        if (!response.data?.data?.address) {
            throw new Error('无效的响应数据');
        }
        return response.data.data.address;
    } catch (error) {
        console.error(`\n获取 ${inscriptionId} 的地址时出错:`, error.message);
        return null;
    }
}

// 生成地址统计和排序
function generateAddressStats(inscriptionAddressList) {
    const addressCount = {};
    
    // 统计每个地址的inscription数量
    inscriptionAddressList.forEach(({address}) => {
        if (address) {
            addressCount[address] = (addressCount[address] || 0) + 1;
        }
    });
    
    // 转换为数组并排序
    return Object.entries(addressCount)
        .sort(([, a], [, b]) => b - a)
        .map(([address, count]) => `${address},${count}`);
}

// 读取inscription列表文件
function readInscriptionList() {
    const listPath = path.join(__dirname, 'allInscripitonList3.txt');
    const content = fs.readFileSync(listPath, 'utf8');
    return content.trim().split('\n').map(line => line.trim()).filter(line => line);
}

async function main() {
    try {
        // 1. 读取allInscripitonList3.txt
        const inscriptionIds = readInscriptionList();
        console.log(`成功读取allInscripitonList3.txt, 包含${inscriptionIds.length}个inscription...`);
        
        // 2. 获取每个inscription的地址
        const startTime = Date.now();
        const inscriptionAddressList = [];
        let processedCount = 0;
        
        for (const inscriptionId of inscriptionIds) {
            const address = await getInscriptionAddress(inscriptionId);
            if (address) {
                inscriptionAddressList.push({
                    inscriptionId,
                    address
                });
            }
            
            processedCount++;
            showProgress(processedCount, inscriptionIds.length, startTime);
            
            // 添加延迟以避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n数据获取完成，开始生成文件...');
        
        // 3. 生成o1.iaList.txt
        const iaListPath = path.join(__dirname, 'o1.iaList.txt');
        const iaListContent = inscriptionAddressList
            .map(({inscriptionId, address}) => `${inscriptionId},${address}`)
            .join('\n');
        fs.writeFileSync(iaListPath, iaListContent);
        
        // 4. 生成o1.iaSum.txt
        const iaSumPath = path.join(__dirname, 'o1.iaSum.txt');
        const addressStats = generateAddressStats(inscriptionAddressList);
        fs.writeFileSync(iaSumPath, addressStats.join('\n'));
        
        console.log('\n处理完成!');
        console.log(`总处理时间: ${((Date.now() - startTime) / 1000).toFixed(1)}秒`);
        console.log(`成功处理: ${inscriptionAddressList.length}/${inscriptionIds.length}`);
        console.log(`已生成文件:`);
        console.log(`- o1.iaList.txt (inscription和地址对应列表)`);
        console.log(`- o1.iaSum.txt (地址持有数量统计，已排序)`);
        
    } catch (error) {
        console.error('程序执行出错:', error);
    }
}

main(); 