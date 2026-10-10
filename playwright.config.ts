import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5173',channel:'msedge',viewport:{width:1440,height:1000},headless:true,permissions:['clipboard-read','clipboard-write'],screenshot:'only-on-failure'}});
