const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// 辅助函数：发送请求
const request = async ({ headers, httpUrl, target, method, data }) => {
  try {
    const response = await axios({
      method,
      url: `${httpUrl}${target}`,
      headers,
      data
    });
    return response.data;
  } catch (error) {
    console.error('Request error:', error);
    throw error;
  }
};

// 创建铭文订单
const inscribeCreateOrder = async (data) => {
  console.log("inscribeCreateOrder", data);
  try {
    const resp = await request({
      headers: {
        Authorization: `Bearer ${process.env.FRACTAL_TOKEN}`,
      },
      httpUrl: process.env.FRACTAL_URL,
      target: "/v2/inscribe/order/create",
      method: "post",
      data,
    });
    return resp;
  } catch (error) {
    console.error('Create order error:', error);
    return undefined;
  }
};

// 将 satoshi 转换为 BTC
const satoshiToBTC = (satoshi) => {
  return (satoshi / 100000000).toFixed(8);
};

async function main() {
  try {
    // 获取命令行参数
    const args = process.argv.slice(2);
    const startIndex = parseInt(args[0]) || 2223; // 默认值2223
    const inputStart = parseInt(args[1]) || 0;    // 默认值0
    const inputNumber = parseInt(args[2]);        // 处理的数量

    // 1. 读取地址列表并过滤空行
    const addresses = fs.readFileSync('./script/input.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // 根据参数截取需要处理的地址
    const processAddresses = inputNumber 
      ? addresses.slice(inputStart, inputStart + inputNumber)
      : addresses.slice(inputStart);
    
    // 2. 读取 IPFS hashes
    const ipfsData = JSON.parse(fs.readFileSync('./script/fractal.ipfsHashes.json', 'utf8'));
    
    let outputData = [];
    let payData = [];
    
    console.log("processAddresses", processAddresses);
    // 处理每个地址
    for (let i = 0; i < processAddresses.length; i++) {
      const btcAddress = processAddresses[i];
      const currentIndex = startIndex + i;
      
      // 根据 idx 查找对应的 IPFS hash
      const ipfsItem = ipfsData.find(item => item.idx === currentIndex);
      if (!ipfsItem) {
        console.error(`No IPFS hash found for index ${currentIndex}`);
        continue;
      }
      
      // 3. 获取 IPFS 内容
      try {
        const ipfsResponse = await axios.get(`${process.env.WORKER_URL}/mintBtcNft/getIpfsContent`, {
          params: { hash: ipfsItem.hash }
        });
        
        const dataURL = ipfsResponse.data.dataURL;
        console.log(`Processing address ${btcAddress} with index ${currentIndex}`);
        console.log("IPFS hash:", ipfsItem.hash);
        
        // 4. 创建铭文订单参数
        const timestamp = Date.now();
        const inscribeCreateOrderPrams = {
          "receiveAddress": btcAddress,
          "feeRate": 1,
          "outputValue": 546,
          "files": [
            {
              "filename": `${currentIndex}_${timestamp}.webp`,
              "dataURL": dataURL
            }
          ],
          "devAddress": btcAddress,
          "devFee": 0
        };
        
        // 5. 调用接口创建铭文
        const respData = await inscribeCreateOrder(inscribeCreateOrderPrams);
        
        if (respData && respData.code === 0 && respData.data) {
          const { payAddress, amount, orderId } = respData.data;
          const btcAmount = satoshiToBTC(amount);
          
          console.log(`订单创建成功 - Address: ${btcAddress}`);
          console.log(`Payment Address: ${payAddress}`);
          console.log(`Amount: ${amount} satoshi (${btcAmount} BTC)`);
          console.log(`Order ID: ${orderId}`);
          
          // 修改这里：使用固定金额 0.0011
          outputData.push(`${payAddress},0.0011,${orderId}`);
          payData.push(`${payAddress},0.0011`);
        } else {
          console.error(`创建订单失败: ${JSON.stringify(respData)}`);
        }
        
        // 添加延迟以避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing address ${btcAddress}:`, error);
      }
    }
    
    // 7. 写入文件
    fs.writeFileSync('./script/output.txt', outputData.join('\n'));
    fs.writeFileSync('./script/pay.txt', payData.join('\n'));
    
    // 输出处理信息
    console.log('处理完成！');
    console.log(`处理参数：startIndex=${startIndex}, inputStart=${inputStart}, inputNumber=${inputNumber || '全部'}`);
    console.log(`成功处理 ${outputData.length} 个地址`);
    console.log('数据已写入 output.txt 和 pay.txt');
    
  } catch (error) {
    console.error('Main process error:', error);
  }
}

main().catch(console.error);
