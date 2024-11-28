const fs = require('fs');

// 读取JSON文件
const jsonData = fs.readFileSync('./public/script/all.fractal.nftRecords.json', 'utf8');
const records = JSON.parse(jsonData);

// 使用Set来存储不重复的btcAddress
const uniqueAddresses = new Set();

// 遍历记录并收集btcAddress
records.forEach(record => {
  if (record.btcAddress) {
    uniqueAddresses.add(record.btcAddress);
  }
});

// 将地址转换为数组并写入文件
const addressList = Array.from(uniqueAddresses).join('\n');
fs.writeFileSync('./public/script/rawAddress.txt', addressList);

console.log(`已成功提取${uniqueAddresses.size}个不重复的BTC地址到rawAddress.txt`);
