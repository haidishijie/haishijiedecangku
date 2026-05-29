// 语音识别云函数
const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 腾讯云语音识别客户端
const AsrClient = tencentcloud.asr.v20190614.Client

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { action, audioBase64 } = event

  if (action === 'recognize') {
    return await recognize(audioBase64)
  }

  return { code: -1, msg: '未知操作' }
}

/**
 * 语音识别
 */
async function recognize(audioBase64) {
  try {
    // 使用腾讯云语音识别
    // 注意：需要在腾讯云控制台开通语音识别服务并获取密钥
    // 免费额度：每月5000次

    const clientConfig = {
      credential: {
        // 这里需要填写你的腾讯云 SecretId 和 SecretKey
        // 可以在腾讯云控制台 -> 访问管理 -> 访问密钥 -> API密钥管理 获取
        secretId: process.env.TENCENT_SECRET_ID || 'YOUR_SECRET_ID',
        secretKey: process.env.TENCENT_SECRET_KEY || 'YOUR_SECRET_KEY'
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'asr.tencentcloudapi.com'
        }
      }
    }

    const client = new AsrClient(clientConfig)

    const params = {
      Data: audioBase64,
      EngSerViceType: '16k_zh', // 中文普通话
      SourceType: 1,
      VoiceFormat: 'mp3',
      DataLen: Buffer.from(audioBase64, 'base64').length
    }

    const result = await client.SentenceRecognition(params)

    if (result.Result) {
      return {
        code: 0,
        text: result.Result
      }
    } else {
      return {
        code: -1,
        msg: '识别结果为空'
      }
    }
  } catch (err) {
    console.error('语音识别失败:', err)

    // 如果腾讯云配置失败，返回一个提示
    return {
      code: -1,
      msg: '语音识别服务未配置，请联系开发者',
      error: err.message
    }
  }
}
