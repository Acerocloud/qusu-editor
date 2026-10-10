import { nanoid } from 'nanoid';
import type { Block, BlockOf, BlockType, ContentMap, Styles } from '../types';
export const tokens = { navy: '#05183B', gold: '#E3BA35', gray: '#F4F6F9', muted: '#626B77' };
export const baseStyles: Styles = { background: '#FFFFFF', color: '#333333', fontSize: 14, fontWeight: 400, lineHeight: 1.8, textAlign: 'left', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, marginTop: 0, marginBottom: 20, borderColor: '#D8DEE7', borderWidth: 0, borderRadius: 0, accent: tokens.gold };
interface Definition<K extends BlockType> { name: string; group: string; content: ContentMap[K]; styles?: Partial<Styles>; hint: string }
type Registry = { [K in BlockType]: Definition<K> };
export const registry: Registry = {
  articleHeader: { name: '文章顶部标识', group: '文章信息', hint: '栏目与日期', content: { label: '阅读与思考', date: '日期 / 栏目' }, styles: { fontSize: 12, color: '#78828E' } },
  articleTitle: { name: '文章主标题', group: '文章信息', hint: '主标题与副标题', content: { title: '把想法写成一篇好文章', subtitle: '从一个观察开始，整理信息，表达清楚你的观点。' }, styles: { fontSize: 25, color: tokens.navy, fontWeight: 700, lineHeight: 1.45 } },
  authorInfo: { name: '作者信息', group: '文章信息', hint: '单行作者小字', content: { author: 'QUSU 曲速研究', reading: '' }, styles: { fontSize: 12, color: tokens.muted } },
  abstract: { name: '摘要', group: '正文内容', hint: 'ABSTRACT', content: { heading: '摘要 / ABSTRACT', html: '<p>这是一篇通用排版示例。你可以直接修改文字，插入图片，调整模块顺序，再保存成自己的文章或模板。</p>' }, styles: { background: tokens.gray, paddingTop: 15, paddingBottom: 15, paddingLeft: 15, paddingRight: 15, lineHeight: 1.75 } },
  sectionHeading: { name: '一级标题', group: '标题', hint: '编号章节标题', content: { number: '01', title: '从一个观察开始' }, styles: { fontSize: 21, fontWeight: 700, color: tokens.navy, paddingLeft: 15, marginTop: 34 } },
  subsectionHeading: { name: '二级标题', group: '标题', hint: '小节标题', content: { title: '把信息整理成清晰的结构' }, styles: { fontSize: 17, fontWeight: 700, color: tokens.navy, paddingBottom: 9 } },
  categoryLabel: { name: '分类标签', group: '标题', hint: '中英文栏目标签', content: { text: 'NOTES & IDEAS / 阅读笔记' }, styles: { fontSize: 12, fontWeight: 700, color: tokens.navy } },
  keyQuote: { name: '关键观点引用', group: '研究分析', hint: '突出核心判断', content: { html: '<p>可信度不来自更响亮的承诺，而来自把事实、假设与尚未解决的问题分开表达。</p>' }, styles: { fontSize: 15, fontWeight: 600, paddingLeft: 15, accent: tokens.navy } },
  insightBox: { name: 'QUSU 观察', group: '研究分析', hint: '研究判断与分析', content: { heading: 'QUSU 观察', html: '<p>在这里填写研究判断或分析结论。</p>' }, styles: { background: tokens.gray, paddingTop: 15, paddingBottom: 15, paddingLeft: 15, paddingRight: 15 } },
  caveatBox: { name: '研究局限', group: '研究分析', hint: '假设、限制与风险', content: { heading: '研究局限 / CAVEAT', html: '<p>在这里填写数据限制、假设条件或尚未验证的事实。</p>' }, styles: { color: '#525252', paddingLeft: 15 } },
  metrics: { name: '数据指标卡', group: '数据展示', hint: '两列 / 三列指标', content: { items: [{ value: '12', unit: '篇', description: '阅读记录' }, { value: '10', unit: '天', description: '主题整理' }, { value: '3', unit: '年', description: '计划目标' }] } },
  figure: { name: '图片与图注', group: '图片与表格', hint: '编号、标题与来源', content: { number: '01', title: '阅读记录与主题整理对比', src: '', caption: '图 1｜图表说明。来源：填写你的资料来源。', width: 100, local: false } },
  comparisonTable: { name: '对比表格', group: '图片与表格', hint: '可编辑行列', content: { rows: [['指标', '示例主题'], ['阅读记录', '12 篇'], ['主题整理', '10 天（示例数据）']], headerColor: tokens.navy } },
  takeaway: { name: '研究结论', group: '文章结尾', hint: 'KEY TAKEAWAY', content: { heading: '研究结论 / KEY TAKEAWAY', html: '<p>在这里写本篇文章最值得保留的研究结论。</p>' }, styles: { fontSize: 15, paddingTop: 15, accent: tokens.navy } },
  references: { name: '参考资料', group: '文章结尾', hint: '引用与研究说明', content: { heading: '参考资料 / REFERENCES', items: ['[1] 资料名称、作者或链接', '[2] 其他参考资料'], note: '注：请填写资料来源和需要说明的内容。' }, styles: { fontSize: 12, color: '#78828E' } },
  brandFooter: { name: '品牌结尾', group: '文章结尾', hint: 'QUSU 品牌落款', content: { title: 'QUSU 曲速', subtitle: '记录观察，分享思考' }, styles: { background: tokens.navy, color: '#FFFFFF', paddingTop: 24, paddingBottom: 24, paddingLeft: 20, paddingRight: 20, fontSize: 21, fontWeight: 700 } },
  paragraph: { name: '普通正文', group: '正文内容', hint: '富文本与列表', content: { html: '<p>在这里输入正文内容……</p>' } },
  quoteParagraph: { name: '引用正文', group: '正文内容', hint: '浅色底 · 引用原文', content: { html: '<p>在这里填写引用的原文……</p>' }, styles: { background: '#F3F5F8', color: '#657184', fontSize: 13, lineHeight: 1.85, paddingTop: 16, paddingBottom: 16, paddingLeft: 18, paddingRight: 18, borderRadius: 4, accent: '#BBC7D7' } },
  image: { name: '普通图片', group: '图片与表格', hint: '图片与可选说明', content: { src: '', caption: '', width: 100, local: false } },
  scrollImage: { name: '长图纵向滚动', group: '图片与表格', hint: '单张长图 · 小框内上下滑动', content: { src: '', caption: '', width: 100, local: false, height: 320, showHint: true } },
  imageGallery: { name: '多图横向滑动', group: '图片与表格', hint: '多张图片 · 左右滑动相册', content: { images: [{ id: 'slot-1', src: '', caption: '', local: false }, { id: 'slot-2', src: '', caption: '', local: false }], caption: '', height: 240, slideWidth: 92, gap: 12, showHint: true } },
  divider: { name: '分割线', group: '正文内容', hint: '轻量内容分隔', content: { label: '' }, styles: { borderWidth: 0, paddingTop: 10 } },
};
export const blockTypes = Object.keys(registry) as BlockType[];
export const groups = ['文章信息', '标题', '正文内容', '研究分析', '数据展示', '图片与表格', '文章结尾'];
export function createBlock<K extends BlockType>(type: K): BlockOf<K> {
  const content = structuredClone(registry[type].content);
  if ('images' in content) content.images = content.images.map(image => ({ ...image, id: nanoid() }));
  return { id: nanoid(), type, content, styles: { ...baseStyles, ...registry[type].styles }, metadata: { createdAt: new Date().toISOString() } } as BlockOf<K>;
}
export function defaultStyles(type: BlockType): Styles { return { ...baseStyles, ...registry[type].styles }; }
export function exampleBlocks(): Block[] {
  return ['articleHeader', 'articleTitle', 'authorInfo', 'abstract', 'sectionHeading', 'paragraph', 'quoteParagraph', 'subsectionHeading', 'categoryLabel', 'keyQuote', 'insightBox', 'caveatBox', 'metrics', 'figure', 'comparisonTable', 'takeaway', 'references', 'image', 'scrollImage', 'imageGallery', 'divider', 'brandFooter'].map(type => {
    const b = createBlock(type as BlockType) as Block;
    if (b.type === 'paragraph') b.content.html = '<p>一篇文章可以从一个小小的观察开始。记录你看到了什么，补充相关信息，再解释为什么它值得关注。</p><p>先写下核心想法，再用标题、引用和图片组织内容，让读者更容易跟上你的思路。</p>';
    return b;
  });
}
