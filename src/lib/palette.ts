export const standardPalette = [
  { name: '品牌与正文', colors: [
    { name: '曲速金', value: '#e3ba35' }, { name: '深海蓝', value: '#05183b' },
    { name: '正文黑', value: '#222222' }, { name: '辅助灰蓝', value: '#435268' },
    { name: '强调砖红', value: '#8f3028' }, { name: '纯白', value: '#ffffff' },
  ] },
  { name: '深色强调', colors: [
    { name: '深朱红', value: '#8b1e24' }, { name: '酒红', value: '#741b3a' },
    { name: '深赭红', value: '#74342b' }, { name: '深金黄', value: '#8a6500' },
    { name: '琥珀黄', value: '#795300' }, { name: '深土黄', value: '#69501a' },
  ] },
  { name: '正文背景', colors: [
    { name: '浅金背景', value: '#f4e7b8' }, { name: '浅蓝背景', value: '#d9e4f2' },
    { name: '灰蓝背景', value: '#dee3ea' }, { name: '浅绿背景', value: '#dcebdd' },
  ] },
  { name: '文字高亮', colors: [
    { name: '柔金高亮', value: '#f3d86a' }, { name: '柔蓝高亮', value: '#bdd4f4' },
    { name: '柔绿高亮', value: '#bce2c5' }, { name: '柔红高亮', value: '#f2c4ba' },
  ] },
];

export function colorHex(value: string, fallback = '#333333'): string {
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  const context = document.createElement('canvas').getContext('2d');
  if (!context || !value) return fallback;
  context.fillStyle = value;
  return /^#[\da-f]{6}$/i.test(context.fillStyle) ? context.fillStyle : fallback;
}
