const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// 读取环境变量
const FRACTAL_URL = process.env.FRACTAL_URL;
const FRACTAL_TOKEN = process.env.FRACTAL_TOKEN;

// 进度显示函数
function showProgress(current, total, startTime) {
    const percent = (current / total * 100).toFixed(2);
    const elapsed = (Date.now() - startTime) / 1000; // 已经过时间（秒）
    const speed = current / elapsed; // 每秒处理数量
    const remaining = (total - current) / speed; // 预计剩余时间（秒）
    
    console.log(`进度: ${percent}% (${current}/${total})`);
    console.log(`已用时间: ${elapsed.toFixed(1)}秒`);
    console.log(`预计剩余: ${remaining.toFixed(1)}秒`);
    console.log(`处理速度: ${speed.toFixed(2)}条/秒`);
    console.log('----------------------------------------');
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
            
            console.error(`请求失败 (第 ${i + 1} 次尝试): ${errorMsg}`);
            
            if (i === retries - 1) {
                throw new Error(errorMsg);
            }
            console.log(`2秒后进行第 ${i + 2} 次重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function checkInscriptionAddress() {
    try {
        // 1. 读取地址列表文件
        const fileContent = fs.readFileSync('public/script/allAddressList.txt', 'utf8');
        const lines = fileContent.split('\n');
        
        // 存储错误信息
        let errorResults = [];
        let processedCount = 0;
        let mismatchCount = 0;
        let errorCount = 0;
        const totalCount = lines.filter(line => line.trim()).length;
        const startTime = Date.now();

        console.log(`开始处理，总计 ${totalCount} 条数据`);

        // 2. 处理每一行数据
        for (const line of lines) {
            if (!line.trim()) continue;
            
            const [address, inscriptionId] = line.split(',').map(item => item.trim());
            processedCount++;
            
            // 每次处理都显示当前数量
            process.stdout.write(`\r正在处理第 ${processedCount}/${totalCount} 条`);
            
            try {
                // 每10条显示详细进度
                if (processedCount % 10 === 0 || processedCount === totalCount) {
                    console.log(''); // 换行
                    showProgress(processedCount, totalCount, startTime);
                }
                
                // 调用API获取inscription信息（使用重试机制）
                const response = await fetchWithRetry(inscriptionId);
                
                if (!response.data || !response.data.data || !response.data.data.address) {
                    const errorMsg = `返回数据格式错误: ${JSON.stringify(response.data)}`;
                    console.log(''); // 换行
                    console.error(errorMsg);
                    errorResults.push(`${address},${inscriptionId},ERROR:${errorMsg}`);
                    errorCount++;
                    continue;
                }

                // 检查返回的地址是否匹配
                const returnedAddress = response.data.data.address;
                
                if (address !== returnedAddress) {
                    const mismatchInfo = `${address},${inscriptionId},MISMATCH:${returnedAddress}`;
                    errorResults.push(mismatchInfo);
                    console.log(''); // 换行
                    console.log(`地址不匹配:\n原地址: ${address}\n返回地址: ${returnedAddress}\nInscriptionId: ${inscriptionId}`);
                    mismatchCount++;
                }

                // 添加延迟以避免请求过快
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                const errorInfo = `${address},${inscriptionId},ERROR:${error.message}`;
                console.log(''); // 换行
                console.error(`处理失败:\n地址: ${address}\nInscriptionId: ${inscriptionId}\n错误: ${error.message}`);
                errorResults.push(errorInfo);
                errorCount++;
            }
        }

        // 3. 将错误结果写入文件
        if (errorResults.length > 0) {
            fs.writeFileSync('public/script/err.txt', errorResults.join('\n'), 'utf8');
            console.log('\n处理完成:');
            console.log(`总数: ${totalCount}`);
            console.log(`地址不匹配: ${mismatchCount} 条`);
            console.log(`错误数: ${errorCount} 条`);
            console.log(`总耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}秒`);
            console.log('详细错误信息已写入 err.txt');
        } else {
            console.log('\n处理完成:');
            console.log(`总数: ${totalCount}`);
            console.log(`总耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}秒`);
            console.log('未发现任何不匹配或错误');
        }

    } catch (error) {
        console.error('程序执行出错:', error);
    }
}

// 执行主函数
checkInscriptionAddress();
