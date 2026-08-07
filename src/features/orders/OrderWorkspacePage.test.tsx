import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer, ProductCatalogItem, SalesOrder } from '../../types'
import { OrderWorkspacePage } from './OrderWorkspacePage'

const customer:Customer={id:'c1',name:'陈女士',phone:'13800000000',source:'到店',salesperson:'小林',stage:'需求确认',intent:'高',expectedAmount:80000,products:[],style:'现代',budget:'8万',renovationProgress:'硬装完成',concerns:[],lastContactAt:'2026-08-08',createdAt:'2026-08-08'}
const product:ProductCatalogItem={id:'p1',sku:'CZ-01',name:'黑胡桃餐桌',specifications:['1.8米','2米'],unitPrice:9800,supplyType:'现货',availableStock:3,reservedStock:0,woodMaterial:'北美黑胡桃木'}

describe('OrderWorkspacePage',()=>{
  it('creates a draft without activating inventory',()=>{const onAddOrder=vi.fn();render(<OrderWorkspacePage customers={[customer]} products={[product]} orders={[]} activeUser="小林" onAddOrder={onAddOrder} onUpdateOrder={vi.fn()} onActivate={vi.fn(()=>({ok:true}))}/>);fireEvent.click(screen.getByTitle('加入选品'));fireEvent.click(screen.getByRole('button',{name:'保存订单草稿'}));expect(onAddOrder).toHaveBeenCalledWith(expect.objectContaining({customerId:'c1',status:'草稿',contractAmount:9800,items:[expect.objectContaining({productId:'p1',supplyType:'现货'})]}));expect(screen.getByText('订单草稿已保存，尚未占用库存')).toBeTruthy()})
  it('moves a draft through confirmation and approval',()=>{const order:SalesOrder={id:'o1',orderNo:'SPJ1',customerId:'c1',customerName:'陈女士',salesperson:'小林',collaborators:[],products:['黑胡桃餐桌'],items:[],contractAmount:9800,signedAt:'2026-08-08',status:'待审核',payments:[],performanceRate:100,createdAt:'2026-08-08',updatedAt:'2026-08-08'};const onActivate=vi.fn(()=>({ok:true}));render(<OrderWorkspacePage customers={[customer]} products={[product]} orders={[order]} activeUser="店长" onAddOrder={vi.fn()} onUpdateOrder={vi.fn()} onActivate={onActivate}/>);fireEvent.click(screen.getByRole('button',{name:/审核并生效/}));expect(onActivate).toHaveBeenCalledWith('o1','店长')})
})
