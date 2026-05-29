// 主题管理工具
const THEMES = {
  ios23: {
    name: 'iOS 23',
    icon: '🍎',
    className: 'theme-ios23',
    isDefault: true
  },
  mint: {
    name: '薄荷清新',
    icon: '🌿',
    className: 'theme-mint',
    isDefault: false
  },
  purple: {
    name: '梦幻紫蓝',
    icon: '💜',
    className: 'theme-purple',
    isDefault: false
  },
  coral: {
    name: '珊瑚甜美',
    icon: '🪸',
    className: 'theme-coral',
    isDefault: false
  }
}

/**
 * 获取当前主题
 */
const getCurrentTheme = () => {
  try {
    const themeKey = wx.getStorageSync('currentTheme') || 'ios23'
    return THEMES[themeKey] || THEMES.ios23
  } catch (err) {
    return THEMES.ios23
  }
}

/**
 * 获取当前主题key
 */
const getCurrentThemeKey = () => {
  try {
    return wx.getStorageSync('currentTheme') || 'ios23'
  } catch (err) {
    return 'ios23'
  }
}

/**
 * 设置主题
 */
const setTheme = (themeKey) => {
  if (!THEMES[themeKey]) return false

  try {
    wx.setStorageSync('currentTheme', themeKey)
    return true
  } catch (err) {
    console.error('保存主题失败:', err)
    return false
  }
}

/**
 * 获取所有主题列表
 */
const getThemeList = () => {
  return Object.keys(THEMES).map(key => ({
    key,
    ...THEMES[key]
  }))
}

/**
 * 获取主题类名（用于 page 元素）
 */
const getThemeClass = () => {
  const theme = getCurrentTheme()
  return theme.className
}

module.exports = {
  THEMES,
  getCurrentTheme,
  getCurrentThemeKey,
  setTheme,
  getThemeList,
  getThemeClass
}
