import type { Plugin } from 'vite'
import MarkdownIt from 'markdown-it'
import { compileTemplate } from '@vue/compiler-sfc'
import matter from 'gray-matter'
import { Options, ResolvedOptions } from './types'

function toArray<T>(n: T | T[]): T[] {
  if (!Array.isArray(n))
    return [n]
  return n
}

function VitePluginMarkdown(options: Options = {}): Plugin {
  const resolved: ResolvedOptions = Object.assign({
    markdownItOptions: {},
    markdownItUses: [],
    markdownItSetup: () => {},
    wrapperClasses: 'markdown-body',
    wrapperComponent: null,
    transforms: {},
  }, options)

  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    ...resolved.markdownItOptions,
  })

  resolved.markdownItUses.forEach((e) => {
    const [plugin, options] = toArray(e)

    markdown.use(plugin, options)
  })

  resolved.markdownItSetup(markdown)

  const wrapperClasses = toArray(resolved.wrapperClasses).filter(i => i).join(' ')

  return {
    transforms: [
      {
        test({ path }) {
          return path.endsWith('.md')
        },
        transform(ctx) {
          const { isBuild, path } = ctx
          let raw = ctx.code

          if (resolved.transforms.before)
            raw = resolved.transforms.before({ ...ctx, code: raw })

          const { content: md, data: frontmatter } = matter(raw)
          let sfc = markdown.render(md, {})
          if (resolved.wrapperClasses)
            sfc = `<div class="${wrapperClasses}">${sfc}</div>`
          if (resolved.wrapperComponent)
            sfc = `<${resolved.wrapperComponent} :frontmatter="frontmatter">${sfc}</${resolved.wrapperComponent}>`

          if (resolved.transforms.after)
            sfc = resolved.transforms.after({ ...ctx, code: sfc })

          let { code: result } = compileTemplate({
            filename: path,
            id: path,
            source: sfc,
            transformAssetUrls: false,
          })

          result = result.replace('export function render', 'function render')
          result += `\nconst __matter = ${JSON.stringify(frontmatter)};`
          result += '\nconst data = () => ({ frontmatter: __matter });'
          result += '\nconst __script = { render, data };'

          if (!isBuild)
            result += `\n__script.__hmrId = ${JSON.stringify(path)};`

          result += '\nexport default __script;'

          return result
        },
      },
    ],
  }
}

export default VitePluginMarkdown
