import { nanoid } from 'nanoid';
import type { Block, BlockOf, BlockType, ContentMap, Styles } from '../types';
export const tokens = { navy: '#05183B', gold: '#E3BA35', gray: '#F4F6F9', muted: '#626B77' };
export const baseStyles: Styles = { background: '#FFFFFF', color: '#333333', fontSize: 14, fontWeight: 400, lineHeight: 1.8, textAlign: 'left', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, marginTop: 0, marginBottom: 20, borderColor: '#D8DEE7', borderWidth: 0, borderRadius: 0, accent: tokens.gold };
interface Definition<K extends BlockType> { name: string; group: string; content: ContentMap[K]; styles?: Partial<Styles>; hint: string }
type Registry = { [K in BlockType]: Definition<K> };
export const registry: Registry = {
  articleHeader: { name: '文章顶部标识', group: '文章信息', hint: '栏目与日期', content: { label: 'KICKSTARTER CASE STUDY', date: '2026.10' }, styles: { fontSize: 12, color: '#78828E' } },
  articleTitle: { name: '文章主标题', group: '文章信息', hint: '主标题与副标题', content: { title: 'SOXAI RING X：一份不那么像广告的 Kickstarter 页面', subtitle: '从视觉设计、技术细节与原始研发记录，看一个硬件众筹项目如何呈现可信度。' }, styles: { fontSize: 25, color: tokens.navy, fontWeight: 700, lineHeight: 1.45 } },
  authorInfo: { name: '作者信息', group: '文章信息', hint: '单行作者小字', content: { author: 'QUSU 曲速研究', reading: '' }, styles: { fontSize: 12, color: tokens.muted } },
  abstract: { name: '摘要', group: '正文内容', hint: 'ABSTRACT', content: { heading: '摘要 / ABSTRACT', html: '<p>一枚智能戒指，如何让复杂的技术变得可信？本篇从 SOXAI RING X 的页面视觉、技术细节与研发记录出发，观察一个硬件众筹项目如何建立清晰、克制的信息表达。</p>' }, styles: { background: tokens.gray, paddingTop: 15, paddingBottom: 15, paddingLeft: 15, paddingRight: 15, lineHeight: 1.75 } },
  sectionHeading: { name: '一级标题', group: '标题', hint: '编号章节标题', content: { number: '01', title: '页面视觉：克制的信息表达' }, styles: { fontSize: 21, fontWeight: 700, color: tokens.navy, paddingLeft: 15, marginTop: 34 } },
  subsectionHeading: { name: '二级标题', group: '标题', hint: '小节标题', content: { title: '技术限制与交付的不确定性' }, styles: { fontSize: 17, fontWeight: 700, color: tokens.navy, paddingBottom: 9 } },
  categoryLabel: { name: '分类标签', group: '标题', hint: '中英文栏目标签', content: { text: 'PRODUCT DEVELOPMENT / 产品研发' }, styles: { fontSize: 12, fontWeight: 700, color: tokens.navy } },
  keyQuote: { name: '关键观点引用', group: '研究分析', hint: '突出核心判断', content: { html: '<p>可信度不来自更响亮的承诺，而来自把事实、假设与尚未解决的问题分开表达。</p>' }, styles: { fontSize: 15, fontWeight: 600, paddingLeft: 15, accent: tokens.navy } },
  insightBox: { name: 'QUSU 观察', group: '研究分析', hint: '研究判断与分析', content: { heading: 'QUSU 观察', html: '<p>在这里填写研究判断或分析结论。</p>' }, styles: { background: tokens.gray, paddingTop: 15, paddingBottom: 15, paddingLeft: 15, paddingRight: 15 } },
  caveatBox: { name: '研究局限', group: '研究分析', hint: '假设、限制与风险', content: { heading: '研究局限 / CAVEAT', html: '<p>在这里填写数据限制、假设条件或尚未验证的事实。</p>' }, styles: { color: '#525252', paddingLeft: 15 } },
  metrics: { name: '数据指标卡', group: '数据展示', hint: '两列 / 三列指标', content: { items: [{ value: '5.19', unit: 'mm', description: '戒指宽度' }, { value: '10', unit: '天', description: '最长续航' }, { value: '2027', unit: '年', description: '预计交付' }] } },
  figure: { name: '图片与图注', group: '图片与表格', hint: '编号、标题与来源', content: { number: '01', title: '戒指宽度与最长续航对比', src: '', caption: '图 1｜图表说明。来源：Kickstarter 项目页面。', width: 100, local: false } },
  comparisonTable: { name: '对比表格', group: '图片与表格', hint: '可编辑行列', content: { rows: [['指标', 'SOXAI RING X'], ['戒指宽度', '5.19 mm'], ['最长续航', '10 天（特定尺寸）']], headerColor: tokens.navy } },
  takeaway: { name: '研究结论', group: '文章结尾', hint: 'KEY TAKEAWAY', content: { heading: '研究结论 / KEY TAKEAWAY', html: '<p>在这里写本篇文章最值得保留的研究结论。</p>' }, styles: { fontSize: 15, paddingTop: 15, accent: tokens.navy } },
  references: { name: '参考资料', group: '文章结尾', hint: '引用与研究说明', content: { heading: '参考资料 / REFERENCES', items: ['[1] SOXAI RING X — Kickstarter Campaign Page', '[2] SOXAI — Official Website'], note: '注：部分产品性能与交付计划为项目方披露，尚待验证。' }, styles: { fontSize: 12, color: '#78828E' } },
  brandFooter: { name: '品牌结尾', group: '文章结尾', hint: 'QUSU 品牌落款', content: { title: 'QUSU 曲速', subtitle: 'KICKSTARTER RESEARCH & INSIGHTS' }, styles: { background: tokens.navy, color: '#FFFFFF', paddingTop: 24, paddingBottom: 24, paddingLeft: 20, paddingRight: 20, fontSize: 21, fontWeight: 700 } },
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
    if (b.type === 'paragraph') b.content.html = '<p>在众筹页面里，信息的呈现顺序与产品本身一样重要。SOXAI RING X 将产品规格、使用场景与研发过程放在同一条叙事线上：先让读者理解，再让读者判断。</p><p>我们关注的不只是页面是否好看，更是它有没有为复杂的技术与交付计划提供足够的解释。</p>';
    return b;
  });
}
