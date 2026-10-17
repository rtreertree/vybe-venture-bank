import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const directory=path.dirname(fileURLToPath(import.meta.url));

function component(states) {
  const module={exports:{}};
  let cursor=0;
  const react={useState:initial=>[cursor<states.length?states[cursor++]:typeof initial==='function'?initial():initial,()=>{}],useEffect(){},useCallback:fn=>fn,useRef:initial=>({current:initial})};
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const source=fs.readFileSync(path.join(directory,'../app/bank-api-preview.tsx'),'utf8')+'\nexports.Chart = PriceSeriesChart;';
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module,exports:module.exports,require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return jsx;throw new Error('Unexpected dependency: '+name);},Date,Intl,
  });
  return module.exports;
}
function find(node,predicate) {
  if(!node||typeof node!=='object')return null;
  if(predicate(node))return node;
  for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}
  return null;
}

test('bank preview renders unavailable product returns without throwing',()=>{
  const detail={symbol:'NEW',name:'New listing',type:'stock',area:'Other',description:'',risk:'medium',currency:'USD',currentPrice:100,dayChange:0,dayChangePercent:0,asOf:'2026-10-17T00:00:00Z',issuer:'Example',region:'Global',riskNote:'',returns:{'1M':null,'3M':null,'1Y':null,'3Y':null},volatilityPercent:null,maxDrawdownPercent:0,dividendYieldPercent:0,high52w:100,low52w:100,size:null,inceptionDate:null,topHoldings:[]};
  const states=['test','test',null,null,null,[],[],[],[],'NEW',detail];
  const tree=component(states).default();
  const returns=find(tree,n=>n.props?.className==='return-chips');
  assert.ok(returns);
  for(const chip of returns.props.children)assert.equal(chip.props.children[2].props.children,'—');
});

test('a sell-only filter on a buy-only position keeps filter controls visible',()=>{
  const series={points:[{t:'2026-10-01T00:00:00Z',v:100},{t:'2026-10-02T00:00:00Z',v:100}],summary:{high:100,low:100,start:100,end:100,change:0,changePercent:0},asOf:'2026-10-02T00:00:00Z'};
  const {Chart}=component([null,'sell',null]);
  const tree=Chart({series,currency:'USD',title:'Prices',orders:[{orderId:'buy1',side:'buy',status:'filled',symbol:'AAPL',quantity:1,filledPrice:100,createdAt:'2026-10-01T00:00:00Z'}]});
  assert.ok(find(tree,n=>n.props?.className==='trade-filter'));
});
