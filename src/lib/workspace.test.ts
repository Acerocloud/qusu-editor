// @vitest-environment jsdom
import { describe,it,expect } from 'vitest';
import { newArticle } from './project';
import { mergeLibrary,parseWorkspace,type Workspace } from './storage';
const base=():Workspace=>({version:2,activeMode:'empty',activeId:null,articles:[],templates:[],draft:null,deletedArticleIds:[]});
describe('workspace compatibility and deletion',()=>{
  it('migrates old articles and templates without changing IDs or local images',()=>{const article=newArticle();const template=newArticle();const old={version:1,activeId:article.id,articles:[article],templates:[template]};const migrated=parseWorkspace(old);expect(migrated.version).toBe(2);expect(migrated.activeMode).toBe('article');expect(migrated.articles).toEqual([article]);expect(migrated.templates).toEqual([template]);});
  it('keeps deletions when stale tabs submit the old article again',()=>{const deleted=newArticle();const keep=newArticle();const template=newArticle();const current={...base(),articles:[keep],templates:[template],deletedArticleIds:[deleted.id]};const stale={...base(),activeMode:'article' as const,activeId:deleted.id,articles:[deleted,keep]};const merged=mergeLibrary(current,stale);expect(merged.articles).toEqual([keep]);expect(merged.templates).toEqual([template]);expect(merged.activeId).toBe(keep.id);});
  it('keeps the final deletion empty and accepts a template draft without articles',()=>{const article=newArticle();const deleted=mergeLibrary({...base(),articles:[article]},{...base(),deletedArticleIds:[article.id]});expect(deleted.articles).toEqual([]);expect(parseWorkspace(deleted).activeMode).toBe('empty');const draft=newArticle(true);expect(parseWorkspace({...base(),activeMode:'template',activeId:draft.id,draft}).articles).toEqual([]);});
});