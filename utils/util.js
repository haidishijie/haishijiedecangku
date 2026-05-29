// 工具函数

/**
 * 生成唯一 ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

/**
 * 格式化日期
 */
const formatDate = (date) => {
  const d = new Date(date)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日`
}

/**
 * 格式化时间
 */
const formatTime = (date) => {
  const d = new Date(date)
  const hour = d.getHours().toString().padStart(2, '0')
  const minute = d.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute}`
}

/**
 * 格式化分数（带正负号）
 */
const formatScore = (score) => {
  if (score > 0) return `+${score}`
  if (score < 0) return `${score}`
  return '0'
}

/**
 * 获取分数对应的颜色类名
 */
const getScoreColorClass = (score) => {
  if (score > 0) return 'score-positive'
  if (score < 0) return 'score-negative'
  return 'score-zero'
}

/**
 * 计算数组总和
 */
const sum = (arr) => arr.reduce((a, b) => a + b, 0)

/**
 * 防抖函数
 */
const debounce = (fn, delay = 300) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

module.exports = {
  generateId,
  formatDate,
  formatTime,
  formatScore,
  getScoreColorClass,
  sum,
  debounce
}
