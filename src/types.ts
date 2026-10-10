export interface Styles {
  background: string; color: string; fontSize: number; fontWeight: number; lineHeight: number;
  textAlign: 'left' | 'center' | 'right'; paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number;
  marginTop: number; marginBottom: number; borderColor: string; borderWidth: number; borderRadius: number; accent: string;
}
export interface ImageAsset { id: string; src: string; caption: string; local: boolean }
export interface ContentMap {
  articleHeader: { label: string; date: string };
  articleTitle: { title: string; subtitle: string };
  authorInfo: { author: string; reading: string };
  abstract: { heading: string; html: string };
  sectionHeading: { number: string; title: string };
  subsectionHeading: { title: string };
  categoryLabel: { text: string };
  keyQuote: { html: string };
  insightBox: { heading: string; html: string };
  caveatBox: { heading: string; html: string };
  metrics: { items: { value: string; unit: string; description: string }[] };
  figure: { number: string; title: string; src: string; caption: string; width: number; local: boolean };
  comparisonTable: { rows: string[][]; headerColor: string };
  takeaway: { heading: string; html: string };
  references: { heading: string; items: string[]; note: string };
  brandFooter: { title: string; subtitle: string };
  paragraph: { html: string };
  quoteParagraph: { html: string };
  image: { src: string; caption: string; width: number; local: boolean };
  scrollImage: { src: string; caption: string; width: number; local: boolean; height: number; showHint: boolean };
  imageGallery: { images: ImageAsset[]; caption: string; height: number; slideWidth: number; gap: number; showHint: boolean };
  divider: { label: string };
}
export type BlockType = keyof ContentMap;
export type BlockOf<K extends BlockType> = K extends BlockType ? { id: string; type: K; content: ContentMap[K]; styles: Styles; metadata: { createdAt: string } } : never;
export type Block = { [K in BlockType]: BlockOf<K> }[BlockType];
export interface Article { schemaVersion: 1; id: string; title: string; blocks: Block[]; createdAt: string; updatedAt: string }
