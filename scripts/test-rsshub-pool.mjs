/**
 * RsshubPool 单元测试
 * mock fetch，覆盖熔断/恢复/全部熔断/持久化场景
 */

import { strict as assert } from 'node:assert'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'

const HEALTH_FILE = 'data/rsshub-health.json'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

console.log('=== RsshubPool 测试 ===')

// 清理健康文件
try { unlinkSync(HEALTH_FILE) } catch {}

const { RsshubPool } = await import('./infrastructure/rsshub-pool.mjs')

// --- getInstance ---
test('正常返回第一个实例', () => {
  const pool = new RsshubPool(['https://a.com', 'https://b.com'])
  assert.equal(pool.getInstance(), 'https://a.com')
})

test('轮询返回不同实例', () => {
  const pool = new RsshubPool(['https://a.com', 'https://b.com'])
  const first = pool.getInstance()
  const second = pool.getInstance()
  assert.equal(first, 'https://a.com')
  assert.equal(second, 'https://b.com')
})

test('空列表返回 null', () => {
  const pool = new RsshubPool([])
  assert.equal(pool.getInstance(), null)
})

// --- 熔断 ---
test('连续失败 3 次触发熔断', () => {
  const pool = new RsshubPool(['https://a.com'])
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  // 2 次失败，应该还能用
  assert.equal(pool.getInstance(), 'https://a.com')
  pool.reportFailure('https://a.com')
  // 3 次失败，应该熔断
  assert.equal(pool.getInstance(), null)
})

test('熔断后其他实例仍可用', () => {
  const pool = new RsshubPool(['https://a.com', 'https://b.com'])
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  // a 熔断，b 应该可用
  assert.equal(pool.getInstance(), 'https://b.com')
})

test('全部熔断返回 null', () => {
  const pool = new RsshubPool(['https://a.com', 'https://b.com'])
  for (let i = 0; i < 3; i++) {
    pool.reportFailure('https://a.com')
    pool.reportFailure('https://b.com')
  }
  assert.equal(pool.getInstance(), null)
})

// --- 恢复 ---
test('成功重置失败计数', () => {
  const pool = new RsshubPool(['https://a.com'])
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  pool.reportSuccess('https://a.com')
  // 成功后应该重置
  assert.equal(pool.getInstance(), 'https://a.com')
  // 状态应该是 closed，consecutiveFailures = 0
  assert.equal(pool.state['https://a.com'].consecutiveFailures, 0)
  assert.equal(pool.state['https://a.com'].status, 'closed')
})

// --- 持久化 ---
test('健康文件写入成功', () => {
  const pool = new RsshubPool(['https://a.com'])
  pool.reportFailure('https://a.com')
  assert.ok(existsSync(HEALTH_FILE))
})

test('新实例从已有健康文件恢复状态', () => {
  // 第一个 pool 写入状态
  const pool1 = new RsshubPool(['https://a.com'])
  pool1.reportFailure('https://a.com')
  pool1.reportFailure('https://a.com')
  pool1.reportFailure('https://a.com')

  // 第二个 pool 应该读取到熔断状态
  const pool2 = new RsshubPool(['https://a.com'])
  assert.equal(pool2.getInstance(), null) // 应该被熔断
})

// --- reportFailure 只影响指定实例 ---
test('reportFailure 只影响指定实例', () => {
  try { unlinkSync(HEALTH_FILE) } catch {}
  const pool = new RsshubPool(['https://a.com', 'https://b.com'])
  // 触发 a.com 和 b.com 的状态初始化
  pool.getInstance() // a.com
  pool.getInstance() // b.com
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  pool.reportFailure('https://a.com')
  // a 熔断，b 应该正常
  const bState = pool.state['https://b.com']
  assert.equal(bState.consecutiveFailures, 0)
  assert.equal(bState.status, 'closed')
})

// 清理
try { unlinkSync(HEALTH_FILE) } catch {}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`)
if (failed > 0) process.exit(1)
