/**
 * Host 接口 — Runtime 与外部世界的唯一接口
 * Runtime 永远不知道自己运行在什么环境上
 */

/**
 * @typedef {Object} Host
 * @property {(message: string) => void} log
 * @property {(prompt: string, opts: Object) => Promise<any>} invoke
 * @property {(key: string, value: any) => void} metric
 * @property {() => string} now
 * @property {(startMs: number) => number} elapsed
 */
