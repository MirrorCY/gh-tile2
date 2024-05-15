import { Context, Schema } from 'koishi'
export const name = 'gh-tile2'
export const inject = ['database']
export interface Config { }
export const Config: Schema<Config> = Schema.object({})

declare module 'koishi' {
  interface User { ghUserName: string }
}

export function apply(ctx: Context) {
  // write your plugin here
  ctx.model.extend('user', { ghUserName: 'string' })
  const formatDate = (date: Date): string => {
    const day: string = date.getDate().toString().padStart(2, '0')
    const month: string = (date.getMonth() + 1).toString().padStart(2, '0')
    const year: number = date.getFullYear()
    return `${year}-${month}-${day}`
  }
  function extractContributions(htmlString: string, date: string): number {
    // GPT 正则的神！
    const regex = new RegExp(`data-date="${date}".*?</td>[\\s\\S]*?<tool-tip[^>]*>\\s*(\\d+) contributions`, "s")
    const match = htmlString.match(regex)
    if (match && match[1]) return parseInt(match[1], 10)
    return 0
  }

  ctx
    .command('gh-tile [ghUserName]', '查瓷砖')
    .alias('瓷砖')
    .userFields(['ghUserName'])
    .option('logout', '-l 退出登录')
    .action(async ({ session, options }, user) => {
      if (options.logout) {
        session.user.ghUserName = ''
        return '已登出'
      }
      if (!user) {
        if (!session.user.ghUserName) {
          session.send('未创建 GitHub 绑定关系，请输入用户名，输入 N 取消')
          const ghUserName = await session.prompt(60 * 1000)
          if (ghUserName === 'N' || ghUserName === 'n' || !ghUserName) return '已取消'
          session.user.ghUserName = ghUserName
        }
        user = session.user.ghUserName
      }
      const page = await ctx.http.get(`https://github.com/users/${user}/contributions`, {
        headers: {
          referer: `https://github.com/${user}`,
          'x-requested-with': 'XMLHttpRequest',
          // 伪造登录状态（？），否则 GitHub 不尊重时区
          cookie: 'logged_in=yes; tz=Asia%2FShanghai ',
        },
      })
      const today = formatDate(new Date())
      const contributions = extractContributions(page, today)
      return contributions === 0 ? `${user} 今天还没有瓷砖` : `${user} 在 ${today} 贴了 ${contributions} 块瓷砖`
    })
}
