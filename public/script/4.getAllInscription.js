const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const FRACTAL_URL = process.env.FRACTAL_URL;
const FRACTAL_TOKEN = process.env.FRACTAL_TOKEN;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getInscriptionData(address, retryCount = 0) {
    try {
        const response = await axios.get(
            `${FRACTAL_URL}/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`,
            {
                headers: {
                    'Authorization': `Bearer ${FRACTAL_TOKEN}`,
                    'accept': 'application/json'
                }
            }
        );

        if (response.data.code === 0) {
            const inscriptions = response.data.data.inscription;
            if (inscriptions && inscriptions.length > 0) {
                const inscriptionInfo = inscriptions.map(insc => ({
                    inscriptionNumber: insc.inscriptionNumber,
                    inscriptionId: insc.inscriptionId
                }));
                
                return {
                    address,
                    inscriptions: inscriptionInfo
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`获取地址 ${address} 的铭文数据时出错 (尝试 ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
        
        if (retryCount < MAX_RETRIES - 1) {
            console.log(`等待 ${RETRY_DELAY/1000} 秒后重试...`);
            await sleep(RETRY_DELAY);
            return getInscriptionData(address, retryCount + 1);
        }
        
        console.error(`地址 ${address} 在 ${MAX_RETRIES} 次尝试后仍然失败`);
        return null;
    }
}

async function main() {
    try {
        const addresses = fs.readFileSync('public/script/allrawAddress.txt', 'utf8')
            .split('\n')
            .filter(address => address.trim());

        const outputStream = fs.createWriteStream('public/script/inscriptionDataList.txt');
        
        let totalAddresses = addresses.length;
        let processedAddresses = 0;
        let successfulAddresses = 0;
        let totalInscriptions = 0;

        for (const address of addresses) {
            processedAddresses++;
            const result = await getInscriptionData(address.trim());
            if (result) {
                successfulAddresses++;
                totalInscriptions += result.inscriptions.length;
                
                const inscriptionStr = result.inscriptions
                    .map(insc => `${insc.inscriptionNumber},${insc.inscriptionId}`)
                    .join(',');
                
                outputStream.write(`${result.address},${inscriptionStr}\n`);
                console.log(`处理地址完成: ${result.address} (${processedAddresses}/${totalAddresses})`);
                console.log(`该地址铭文数量: ${result.inscriptions.length}`);
            }
            
            await sleep(1000);
        }

        outputStream.end();
        
        console.log('\n========== 处理完成统计 ==========');
        console.log(`总地址数量: ${totalAddresses}`);
        console.log(`成功处理地址数: ${successfulAddresses}`);
        console.log(`失败处理地址数: ${totalAddresses - successfulAddresses}`);
        console.log(`总铭文数量: ${totalInscriptions}`);
        console.log(`平均每个地址铭文数: ${(totalInscriptions / successfulAddresses).toFixed(2)}`);
        console.log('================================');
        console.log('\n数据已写入 inscriptionDataList.txt');

    } catch (error) {
        console.error('处理过程中出错:', error);
    }
}

main();
