// 语音识别模块（使用云函数 + 腾讯云语音识别）

let recorderManager = null
let isRecording = false

/**
 * 初始化录音管理器
 */
const initRecorder = () => {
  if (recorderManager) return recorderManager

  recorderManager = wx.getRecorderManager()

  recorderManager.onStart(() => {
    console.log('录音开始')
    isRecording = true
  })

  recorderManager.onStop((res) => {
    console.log('录音结束', res)
    isRecording = false
  })

  recorderManager.onError((err) => {
    console.error('录音错误', err)
    isRecording = false
  })

  return recorderManager
}

/**
 * 开始录音
 */
const startRecording = () => {
  const manager = initRecorder()
  manager.start({
    duration: 10000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 96000,
    format: 'mp3'
  })
}

/**
 * 停止录音
 */
const stopRecording = () => {
  return new Promise((resolve, reject) => {
    if (!recorderManager) {
      reject(new Error('录音管理器未初始化'))
      return
    }

    const onStopHandler = (res) => {
      recorderManager.offStop(onStopHandler)
      resolve(res.tempFilePath)
    }

    const onErrorHandler = (err) => {
      recorderManager.offError(onErrorHandler)
      reject(err)
    }

    recorderManager.onStop(onStopHandler)
    recorderManager.onError(onErrorHandler)

    if (isRecording) {
      recorderManager.stop()
    } else {
      reject(new Error('未在录音'))
    }
  })
}

/**
 * 将文件转为 base64
 */
const fileToBase64 = (filePath) => {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath,
      success: (res) => {
        const base64 = wx.arrayBufferToBase64(res.data)
        resolve(base64)
      },
      fail: reject
    })
  })
}

/**
 * 调用云函数进行语音识别
 */
const recognizeSpeech = async (filePath) => {
  try {
    // 转为 base64
    const audioBase64 = await fileToBase64(filePath)

    // 调用云函数
    const res = await wx.cloud.callFunction({
      name: 'speech',
      data: {
        action: 'recognize',
        audioBase64
      }
    })

    if (res.result && res.result.code === 0) {
      return res.result.text
    } else {
      throw new Error(res.result?.msg || '识别失败')
    }
  } catch (err) {
    console.error('语音识别失败:', err)
    throw err
  }
}

/**
 * 解析语音文本，提取玩家和分数
 */
const parseVoiceText = (text, players) => {
  const results = []

  // 清理文本
  let cleanText = text.replace(/\s+/g, '').replace(/[，。！？、]/g, '')

  // 数字映射
  const numberMap = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '二十': 20, '三十': 30, '四十': 40, '五十': 50
  }

  const convertNumber = (str) => {
    if (!str) return null
    const num = parseInt(str)
    if (!isNaN(num)) return num
    return numberMap[str] !== undefined ? numberMap[str] : null
  }

  players.forEach(player => {
    const name = player.name

    // 匹配 "加" 模式
    const addMatch = cleanText.match(new RegExp(`${name}[加增\+](\\d+|${Object.keys(numberMap).join('|')})`))
    if (addMatch) {
      const score = convertNumber(addMatch[1])
      if (score !== null) {
        results.push({ playerId: player.id, playerName: name, score: Math.abs(score) })
        return
      }
    }

    // 匹配 "减" 模式
    const subMatch = cleanText.match(new RegExp(`${name}[减\-](\\d+|${Object.keys(numberMap).join('|')})`))
    if (subMatch) {
      const score = convertNumber(subMatch[1])
      if (score !== null) {
        results.push({ playerId: player.id, playerName: name, score: -Math.abs(score) })
        return
      }
    }

    // 匹配纯数字模式（默认加）
    const numMatch = cleanText.match(new RegExp(`${name}(\\d+|${Object.keys(numberMap).join('|')})`))
    if (numMatch) {
      const score = convertNumber(numMatch[1])
      if (score !== null) {
        results.push({ playerId: player.id, playerName: name, score: Math.abs(score) })
        return
      }
    }
  })

  return results
}

module.exports = {
  initRecorder,
  startRecording,
  stopRecording,
  recognizeSpeech,
  parseVoiceText,
  isRecording: () => isRecording
}
