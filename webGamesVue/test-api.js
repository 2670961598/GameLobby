// 测试API连接的简单脚本
async function testAPI() {
  const baseURL = 'http://172.18.67.143:11452'
  
  console.log('正在测试API连接...')
  
  try {
    // 测试featured games接口
    console.log('\n1. 测试热门游戏接口:')
    const response1 = await fetch(`${baseURL}/api/games/featured`)
    console.log(`状态: ${response1.status} ${response1.statusText}`)
    if (response1.ok) {
      const data1 = await response1.json()
      console.log(`返回游戏数量: ${data1.games?.length || 0}`)
    }
    
    // 测试recent games接口
    console.log('\n2. 测试最新游戏接口:')
    const response2 = await fetch(`${baseURL}/api/games/recent`)
    console.log(`状态: ${response2.status} ${response2.statusText}`)
    if (response2.ok) {
      const data2 = await response2.json()
      console.log(`返回游戏数量: ${data2.games?.length || 0}`)
    }
    
    // 测试all games接口
    console.log('\n3. 测试所有游戏接口:')
    const response3 = await fetch(`${baseURL}/api/games`)
    console.log(`状态: ${response3.status} ${response3.statusText}`)
    if (response3.ok) {
      const data3 = await response3.json()
      console.log(`返回游戏数量: ${data3.games?.length || 0}`)
    }
    
    console.log('\n✅ API测试完成')
    
  } catch (error) {
    console.error('\n❌ API测试失败:', error.message)
  }
}

// 运行测试
testAPI() 