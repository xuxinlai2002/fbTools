const fs = require('fs');
const axios = require('axios');
require('dotenv').config();


// curl -X 'GET' \
//   'https://open-api-fractal.unisat.io/v2/inscribe/order/da35d07f9a7908edb03eeb2565a7d7fa3cebde60' \
//   -H 'accept: application/json' \
//   -H 'Authorization: Bearer f33696d36b4fe6c7d51b63187fc4a15014391a9b26c700473462b1de271ca141'

async function getOrderDetails(orderId) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(`${process.env.FRACTAL_URL}/v2/inscribe/order/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.FRACTAL_TOKEN}`
                }
            });
            return response.data;
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`获取订单 ${orderId} 详情失败 (最后一次尝试):`, error.message);
                return null;
            }
            console.log(`获取订单 ${orderId} 详情失败 (第 ${attempt} 次尝试)，${retryDelay/1000}秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

async function processOrder(line) {
    const [_, __, orderId] = line.split(',');
    if (!orderId) {
        console.error('无效的输入行格式');
        return null;
    }

    const orderDetails = await getOrderDetails(orderId);
    // console.log("xxl --- ",orderDetails);
    if (!orderDetails || orderDetails.code !== 0) {
        return null;
    }

    const { receiveAddress, files } = orderDetails.data;
    if (!files || files.length === 0) {
        return null;
    }

    const inscriptionIds = files.map(file => file.inscriptionId).join(',');
    return `${receiveAddress},${inscriptionIds}`;
}

async function main() {
    try {
        // 读取输入文件
        const inputContent = fs.readFileSync('public/script/output.txt', 'utf8');
        const lines = inputContent.trim().split('\n');

        // 处理每一行并收集结果
        const results = [];
        for (const line of lines) {
            const result = await processOrder(line);
            if (result) {
                results.push(result);
            }
        }

        // 写入结果文件
        fs.writeFileSync('public/script/result.txt', results.join('\n'));
        console.log('处理完成，结果已写入 result.txt');

    } catch (error) {
        console.error('程序执行错误:', error);
    }
}

main();
