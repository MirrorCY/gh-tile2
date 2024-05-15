import { Context, Schema } from 'koishi'
import { load } from 'cheerio'
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
  const getContributions = async (username: string) => {
    const page = await ctx.http.get(`https://github.com/users/${username}/contributions`, {
      headers: { referer: `https://github.com/${username}`, 'x-requested-with': 'XMLHttpRequest' },
    })
    const $ = load(page)
    const $days = $('.js-calendar-graph-table .ContributionCalendar-day')
    const sortedDays = $days.get().sort((a, b) => (a.attribs['data-date'] ?? '').localeCompare(b.attribs['data-date'] ?? ''))
    const tooltipsByDayId = $('.js-calendar-graph tool-tip')
      .toArray()
      .reduce((map, elem) => {
        const dayId = $(elem).attr('for')
        if (dayId) map[dayId] = $(elem)
        return map
      }, {})
    return {
      contributions: sortedDays.map(day => {
        const id = day.attribs['id']
        const date = day.attribs['data-date'] as string
        const countText = tooltipsByDayId[id]?.text().trim().match(/^\d+/)
        const count = countText ? parseInt(countText[0]) : 0
        return { date, count }
      })
    }
  }

  ctx
    .command('gh-tile', '查瓷砖')
    .alias('瓷砖')
    .userFields(['ghUserName'])
    .option('logout', '-l 退出登录')
    .option('username', '-u <username> 查别人的')
    .action(async ({ session, options }) => {
      if (options.logout) {
        session.user.ghUserName = ''
        return '已登出'
      }
      let user: string
      if (options.username) {
        user = options.username
      } else {
        if (!session.user.ghUserName) {
          session.send('未创建 GitHub 绑定关系，请输入用户名，输入 N 取消')
          const ghUserName = await session.prompt(60 * 1000)
          if (ghUserName === 'N' || ghUserName === 'n' || !ghUserName) return '已取消'
          session.user.ghUserName = ghUserName
        }
        user = session.user.ghUserName
      }
      const timezoneOffset = ctx.root.config.timezoneOffset as number
      const today = formatDate(new Date(Date.now() + timezoneOffset * 60 * 1000))
      const res = await getContributions(user)
      // const res = await ctx.http.get(`https://ghtile.rryth.com/v4/${user}`)
      const contributions = res.contributions.find((c) => c.date === today)?.count ?? 0
      if (contributions === 0) return `${user} 今天还没有瓷砖`
      return `${user} 在 ${today} 贴了 ${contributions} 块瓷砖`
    })
}
