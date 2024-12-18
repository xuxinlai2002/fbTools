const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 添加全局变量存储支付数据
let paymentData = [];

// 添加读取pay.txt的函数
async function loadPaymentData() {
    try {
        const filePath = path.join(__dirname, 'public', 'script', 'pay.txt');
        console.log('尝试读取文件:', filePath);
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
            console.log('文件存在');
        } catch (err) {
            console.error('文件不存在:', err);
            throw err;
        }
        
        const data = await fs.readFile(filePath, 'utf8');
        console.log('原始数据:', data); // 打印原始数据
        
        const lines = data.split('\n');
        console.log('行数:', lines.length);
        
        paymentData = lines
            .filter(line => {
                const valid = line.trim().length > 0;
                if (!valid) console.log('跳过空行');
                return valid;
            })
            .map((line, index) => {
                console.log(`处理第 ${index + 1} 行:`, line);
                const [address, amount] = line.split(',');
                if (!address || !amount) {
                    console.log('无效的行格式:', line);
                }
                return {
                    address: address.trim(),
                    amount: parseFloat(amount.trim())
                };
            });
            
        console.log('支付数据加载成功，共 ' + paymentData.length + ' 条记录');
        console.log('第一条数据:', paymentData[0]);
        console.log('所有数据:', paymentData);
    } catch (error) {
        console.error('加载支付数据失败:', error);
        console.error('当前工作目录:', process.cwd());
        console.error('__dirname:', __dirname);
        throw error;
    }
}

// 添加一个简单的交易队列管理
const pendingTransactions = new Set();
const transactionLock = {
    acquire: async function(txId) {
        while(pendingTransactions.has(txId)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        pendingTransactions.add(txId);
    },
    release: function(txId) {
        pendingTransactions.delete(txId);
    }
};

// 修改记录失败交易的函数，使用JSON格式存储
async function logFailedTransaction(address, amount, error, index) {
    const failureData = {
        index,
        address,
        amount,
        error,
        timestamp: new Date().toISOString()
    };
    try {
        // 读取现有失败记录
        let failures = [];
        try {
            const existingData = await fs.readFile('script/fail.json', 'utf8');
            failures = JSON.parse(existingData);
        } catch (err) {
            // 如果文件不存在或解析失败，使用空数组
        }
        
        failures.push(failureData);
        await fs.writeFile('script/fail.json', JSON.stringify(failures, null, 2), 'utf8');
    } catch (err) {
        console.error('记录失败信息时出错:', err);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加参数配置路由
app.post('/api/config', async (req, res) => {
    const { startIndex, number } = req.body;
    try {
        // 将配置写入配置文件
        const config = { startIndex, number };
        await fs.writeFile('script/config.json', JSON.stringify(config, null, 2), 'utf8');
        res.json({ success: true, message: '配置已更新' });
    } catch (error) {
        res.status(500).json({ error: '配置更新失败' });
    }
});

// 添加交易处理中间件
app.use('/api/transaction', async (req, res, next) => {
    const txId = req.body.txId || `tx-${Date.now()}`;
    try {
        await transactionLock.acquire(txId);
        req.txId = txId;
        next();
    } catch (error) {
        if (req.body.address && req.body.amount) {
            await logFailedTransaction(req.body.address, req.body.amount, error.message, req.body.index);
        }
        res.status(429).json({
            error: '交易正在处理中，请稍后重试'
        });
    }
});

// 交易完成后释放锁
app.use('/api/transaction', (req, res, next) => {
    res.on('finish', () => {
        if (req.txId) {
            transactionLock.release(req.txId);
        }
    });
    next();
});

// 添加删除支付数据的函数
async function removePaymentData(index) {
    try {
        const filePath = path.join(__dirname, 'public', 'script', 'pay.txt');
        // 读取当前文件内容
        const data = await fs.readFile(filePath, 'utf8');
        const lines = data.split('\n');
        
        // 删除指定行
        lines.splice(index, 1);
        
        // 写回文件
        await fs.writeFile(filePath, lines.join('\n'), 'utf8');
        
        // 更新内存中的数据
        paymentData.splice(index, 1);
        
        console.log(`成功删除第 ${index} 条支付数据`);
    } catch (error) {
        console.error('删除支付数据失败:', error);
        throw error;
    }
}

// 修改转账处理路由
app.post('/api/transfer', async (req, res) => {
    const { index } = req.body;
    
    try {
        // 读取配置
        const configData = await fs.readFile('script/config.json', 'utf8');
        const config = JSON.parse(configData);
        
        // 验证索引是否在有效范围内
        if (index < config.startIndex || index >= config.startIndex + config.number) {
            throw new Error('索引超出配置范围');
        }

        // 获取对应的支付数据
        if (index >= paymentData.length) {
            throw new Error('索引超出支付数据范围');
        }

        const { address, amount } = paymentData[index];

        // 这里是您的转账逻辑
        // ...

        // 转账成功后，删除该条数据
        await removePaymentData(index);

        res.json({ success: true });
    } catch (error) {
        if (error.message.includes('txn-mempool-conflict')) {
            await logFailedTransaction(address, amount, 'txn-mempool-conflict', index);
            res.status(400).json({
                error: '交易冲突，已记录到失败日志'
            });
        } else {
            await logFailedTransaction(address, amount, error.message, index);
            res.status(500).json({
                error: '转账失败，已记录到失败日志'
            });
        }
    }
});

// 添加获取失交易记录的路由
app.get('/api/failed-transactions', async (req, res) => {
    try {
        const failuresData = await fs.readFile('script/fail.json', 'utf8');
        const failures = JSON.parse(failuresData);
        res.json(failures);
    } catch (error) {
        res.json([]); // 如果文件不存在或出错，返回空数组
    }
});

// 添加重试失败交易的路由
app.post('/api/retry-transfer', async (req, res) => {
    const { transactions } = req.body; // 期望收到要重试的交易数组
    
    try {
        const results = [];
        for (const tx of transactions) {
            try {
                // 重用现有的转账逻辑
                const response = await fetch('http://localhost:3000/api/transfer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        address: tx.address,
                        amount: tx.amount,
                        index: tx.index
                    })
                });
                
                const result = await response.json();
                results.push({
                    ...tx,
                    success: response.ok,
                    message: response.ok ? '重试成功' : result.error
                });
            } catch (error) {
                results.push({
                    ...tx,
                    success: false,
                    message: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: '重试处理失败',
            message: error.message
        });
    }
});

// 在服务器启动时加载支付数据
const PORT = 3000;
app.listen(PORT, async () => {
    try {
        await loadPaymentData();
        console.log(`服务器运行在 http://localhost:${PORT}`);
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
});

// 添加获取支付数据的路由
app.get('/api/payment-data', (req, res) => {
    try {
        res.json({
            success: true,
            total: paymentData.length,
            data: paymentData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取支付数据失败',
            message: error.message
        });
    }
}); 