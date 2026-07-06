/**
 * ContentRelevanceRule — 内容相关性判断
 *
 * 判断事件内容是否属于 AI / 科技编辑领域。
 * 产出 CONTENT_REJECTION Signal 用于 Hard Rejection。
 *
 * Architecture Editorial Intelligence v2 约束：
 * - 只产出 FILTER-phase Signal
 * - 不参与评分
 * - 作为 Qualification 的信号之一
 */

import { createFilterSignal } from '../signal.mjs'

// 官方技术来源白名单 — 来自这些源的内容自动通过 AI 相关性检测
//（即使标题因过短/含 emoji 等原因未命中 AI_TECH_KEYWORDS）
const SOURCE_WHITELIST = [
  'openai.com', 'anthropic.com', 'ai.meta.com', 'blogs.nvidia.com',
  'blog.google', 'deepmind.google', 'mistral.ai',
  'huggingface.co', 'huggingface', // HuggingFace Blog & Hub
  'openai', 'anthropic', 'meta', 'google deepmind', 'google ai',
  'techcrunch', 'theverge', 'wired',
  'arxiv.org', 'export.arxiv.org',
]

// 不可接受的类别关键词列表
const HARD_REJECTION_KEYWORDS = [
  // 纯商业/金融（无科技元素的）
  'ipo', 'ipo上市', '上市申请', '过会', '招股书',
  '股价', '市值', '股权投资', '股权质押',
  // 娱乐/文化
  '娱乐圈', '影视', '综艺', '票房', '网播',
  '漫画', '动画', '小说', '游戏攻略',
  // 生活/非科技
  '菜谱', '健身', '穿搭', '美妆',
  // 法律纠纷（非行业影响）
  '起诉', '侵权', '赔偿', '商标', '维权',
  '胜诉', '败诉',
  // 房地产
  '房价', '楼市', '土拍', '房贷',
  // 体育
  '中超', 'CBA', 'NBA', '奥运会',
  // LeetCode/刷题
  'leetcode每日一题',
]

// AI/科技相关关键词 — 匹配则通过
const AI_TECH_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'large language model', 'llm', 'gpt', 'claude', 'gemini',
  'openai', 'anthropic', 'deepseek', 'meta ai', 'google ai',
  'transformer', 'neural network', 'agi',
  'diffusion model', 'generative ai', 'foundation model',
  'fine-tuning', 'rag', 'agent', 'multimodal',
  'llama', 'mistral', 'gemma', 'copilot', 'chatgpt',
  '人工智能', '大模型', '深度学习', '机器学习',
  '大语言模型', '智能体', '向量数据库',
  '模型发布', '开源模型', '新模型',
  'gpu', 'hpc', '算力', '芯片', '自动驾驶',
  '机器人', '外骨骼', '仿生',
  '融资', 'funding', '收购',
  '量化', 'quantitative', '交易',
  '模型', '算法', '数据', '训练',
]

// 中性类别 — 需要额外核实，不硬拒绝
const NEUTRAL_TERMS = [
  '企业', '公司', '科技', '创新', '数字化',
  '转型', '战略', '合作', '投资',
]

export class ContentRelevanceRule {
  evaluate(events) {
    const signals = []

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const title = (event.title || '').toLowerCase()
      const summary = (event.summary || event.description || '').toLowerCase()
      const category = (event.category || event.metadata?.category || event.curation?.category || '').toLowerCase()
      const eventType = (event.eventType || event.event_type || event.metadata?.eventType || '').toLowerCase()

      // 注意：category 不参与 AI 相关性检测（它是 RSS 源类别如 media/official/academic，非 AI 主题标记）
      const combinedText = `${title} ${summary} ${eventType}`

      // 来源白名单检测：官方技术源（HuggingFace、OpenAI Blog 等）自动通过
      const sourceName = (event.source?.name || event.source_name || '').toLowerCase()
      const isWhitelisted = SOURCE_WHITELIST.some(wl => sourceName.includes(wl.toLowerCase()))
      if (isWhitelisted) {
        continue
      }

      // 检查 Hard Rejection 关键词
      let isHardReject = false
      let rejectReason = ''

      // 先看是否是 AI/科技相关内容 — 宽松通过
      // "ai" 等短英文词使用正则 \b 做词边界匹配，中文/日文始终使用 includes
      //（\b 在 CJK 字符上不生效）
      const hasAiTechSignal = AI_TECH_KEYWORDS.some(kw => {
        const hasCJK = /[一-鿿　-〿]/.test(kw)
        if (kw.length <= 2 && !hasCJK) {
          return new RegExp(`\\b${kw}\\b`, 'i').test(combinedText)
        }
        return combinedText.includes(kw)
      })
      if (hasAiTechSignal) {
        continue // 通过
      }

      // 检查 Hard Rejection 关键词
      for (const kw of HARD_REJECTION_KEYWORDS) {
        if (combinedText.includes(kw)) {
          isHardReject = true
          rejectReason = `hard_rejection: content contains non-AI keyword "${kw}"`
          break
        }
      }

      // 如果既没有 AI 关键词又没有 Hard Rejection 关键词，检查中性词
      if (!isHardReject) {
        const hasNeutralTerm = NEUTRAL_TERMS.some(t => combinedText.includes(t))
        if (!hasNeutralTerm) {
          // 完全不相关 — 硬拒绝
          signals.push(createFilterSignal(
            'CONTENT_REJECTION', 'ContentRelevanceRule',
            `hard_rejection: no AI/tech relevance detected in content`,
            { eventId }
          ))
          continue
        }
        // 有中性词但无 AI 信号 — 也给拒绝（边界情况）
        signals.push(createFilterSignal(
          'CONTENT_REJECTION', 'ContentRelevanceRule',
          `hard_rejection: content lacks AI/tech relevance (neutral terms only)`,
          { eventId }
        ))
        continue
      }

      signals.push(createFilterSignal(
        'CONTENT_REJECTION', 'ContentRelevanceRule',
        rejectReason,
        { eventId }
      ))
    }

    return { signals }
  }
}
