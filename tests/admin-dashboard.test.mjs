import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {transform} from 'lightningcss';
const require=createRequire(import.meta.url);
const css=transform({filename:'AdminDashboard.module.css',code:readFileSync('src/components/AdminDashboard.module.css'),cssModules:true});
const styles=Object.fromEntries(Object.entries(css.exports).map(([key,value])=>[key,value.name]));
let state=[],cursor=0,requests=[],refreshes=0,resourceUrls=[];
const mockReact={...React,useState(initial){const at=cursor++;if(!(at in state))state[at]=initial;return [state[at],value=>state[at]=typeof value==='function'?value(state[at]):value];}};
const event={id:'10000000-0000-4000-8000-000000000001',title:'OG Community Cup',slug:'og-community-cup',game:'Counter-Strike 2',format:'5v5 Single Elimination',status:'upcoming',start_date:'2026-11-01T13:00:00Z',registration_deadline:'2026-10-30T13:00:00Z',max_teams:16,registrations_count:6,min_level:1,max_level:10,bracket_type:'single',entry_fee:0};
const report={since:'2026-10-01T00:00:00Z',until:'2026-10-07T00:00:00Z',days:7,registrations:12,approved:6,pending:4,rejected:2,checked_in:3,verified_fees:6000,unverified_fees:2000,series:[0,2,1,4,0,3,2].map((entries,i)=>({day:'2026-10-0'+(i+1),entries,verified_fees:entries*500}))};
const notices=[{id:'notice1',event_type:'registrations:insert',payload:{name:'Karachi Kings'},status:'pending',channel:'system',created_at:'2026-10-07T13:00:00Z'},{id:'notice2',event_type:'match_requests:insert',payload:{name:'Friday night 5v5'},status:'sent',channel:'system',created_at:'2026-10-06T13:00:00Z'},{id:'notice3',event_type:'registrations:update',payload:{name:'Team Phoenix'},status:'failed',channel:'email',created_at:'2026-10-06T12:00:00Z',error_message:'Provider returned status 429'}];
const cache={};
function load(name){if(cache[name])return cache[name];const source=readFileSync('src/components/'+name+'.tsx','utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const exports={};vm.runInNewContext(compiled,{exports,Date,fetch:async(url,options)=>{requests.push({url,...options});return {ok:true,json:async()=>({success:true})};},require:dep=>{
 if(dep==='react')return mockReact;
 if(dep==='react/jsx-runtime')return require(dep);
 if(dep.endsWith('.module.css'))return styles;
 if(dep==='next/link')return function PreviewLink({href,children,...props}){return React.createElement('a',{href,...props},children);};
 if(dep==='./useAppendPages')return {useAppendPages:(_scope,_page,items)=>items||[]};
 if(dep==='./useResource')return {useResource:url=>{resourceUrls.push(url);const section=url&&new URL(url,'http://local').searchParams.get('section');return {data:section==='analytics'?{analytics:report}:section==='tournament_options'?{items:[event],total:1}:section==='notifications'?{items:notices,total:3,deliveryConfigured:false}:section==='teams'?{items:[{id:'team',team_name:'Karachi Kings',status:'approved',roster_details:[{nickname:'Captain'}],tournament:{title:event.title},created_at:event.start_date}],total:1}:null,loading:false,error:'',reload:async()=>{}};},sendAction:async()=>{}};
 if(dep==='./ui/dialog')return {Dialog:({open,children})=>open?React.createElement('div',{'data-dialog':true},children):null,DialogContent:({children,className})=>React.createElement('div',{role:'dialog',className},children),DialogTitle:({children})=>React.createElement('h2',null,children),DialogDescription:({children})=>React.createElement('p',null,children)};
 if(dep==='./TournamentBracket')return {TournamentBracket:()=>null};
 if(dep.startsWith('./'))return load(dep.slice(2));
 throw new Error('Unexpected dependency: '+dep);
 }}, {filename:name});return cache[name]=exports;}
function render(Component,props={}){cursor=0;return Component(props);}
function walk(node,predicate){if(!node||typeof node!=='object'||node.props?.open===false)return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,predicate);if(found)return found;}return null;}
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const button=(tree,label)=>{const found=walk(tree,node=>node.type==='button'&&text(node)===label);assert.ok(found,'Button missing: '+label);return found;};
const {TournamentAdminPanel}=load('AdminPanel');const props={tournaments:[event],registrations:[],onDataRefresh:()=>{refreshes++;}};
let tree=render(TournamentAdminPanel,props);
assert.doesNotMatch(renderToStaticMarkup(tree),/URL slug/,'Creation form should be hidden');
const bracketLink=walk(tree,node=>node.props?.href==='/tournaments/'+event.slug+'/bracket');
assert.ok(bracketLink,'Manage bracket should link to the dedicated page');
assert.equal(bracketLink.props.target,'_blank');
button(tree,'+ Create tournament').props.onClick();tree=render(TournamentAdminPanel,props);
assert.match(renderToStaticMarkup(tree),/role="dialog"/);assert.match(renderToStaticMarkup(tree),/URL slug/);
button(tree,'Cancel').props.onClick();tree=render(TournamentAdminPanel,props);assert.doesNotMatch(renderToStaticMarkup(tree),/URL slug/);
button(tree,'Delete tournament').props.onClick();tree=render(TournamentAdminPanel,props);
assert.equal(button(tree,'Delete tournament').props.disabled,true);
const confirm=walk(tree,node=>node.type==='input'&&node.props.autoComplete==='off');confirm.props.onChange({target:{value:'Wrong'}});tree=render(TournamentAdminPanel,props);assert.equal(button(tree,'Delete tournament').props.disabled,true);
walk(tree,node=>node.type==='input'&&node.props.autoComplete==='off').props.onChange({target:{value:event.title}});tree=render(TournamentAdminPanel,props);
assert.equal(button(tree,'Delete tournament').props.disabled,false);
await walk(tree,node=>node.type==='form'&&text(node).includes('Type the tournament title')).props.onSubmit({preventDefault(){}});
assert.equal(requests.length,1);assert.equal(requests[0].method,'DELETE');assert.equal(JSON.parse(requests[0].body).tournament_id,event.id);assert.equal(refreshes,1);
state=[];const {OperationsPanel}=load('OperationsPanel');const {AdminAnalytics}=load('AdminAnalytics');
tree=render(OperationsPanel,{tournamentContent:null});button(tree,'Activity').props.onClick();tree=render(OperationsPanel,{tournamentContent:null});let html=renderToStaticMarkup(tree);
assert.match(html,/Tournament registration received/);assert.match(html,/Karachi Kings/);assert.match(html,/Delivery failed/);assert.match(html,/not configured/);assert.doesNotMatch(html,/REGISTRATIONS:|registrations:insert|MATCH_REQUESTS/);
walk(tree,node=>node.type==='select'&&React.Children.toArray(node.props.children).some(child=>child.props?.value==='failed')).props.onChange({target:{value:'failed'}});render(OperationsPanel,{tournamentContent:null});assert.ok(resourceUrls.at(-1).includes('status=failed'));
button(tree,'Teams').props.onClick();tree=render(OperationsPanel,{tournamentContent:null});html=renderToStaticMarkup(tree);assert.match(html,/Karachi Kings/);assert.match(html,/Tournament teams/);assert.match(html,/FACEIT squads/);assert.match(html,/Captain/);
const chartHtml=renderToStaticMarkup(React.createElement(AdminAnalytics,{report}));assert.match(chartHtml,/<svg/);assert.match(chartHtml,/View daily figures/);assert.match(chartHtml,/6,000/);assert.doesNotMatch(chartHtml,/undefined|NaN/);
if(process.argv.includes('--preview')){
 mkdirSync('.deployment/admin-preview',{recursive:true});
 let globalCss=readFileSync('src/app/globals.css','utf8');globalCss=globalCss.slice(globalCss.indexOf(':root {'));
 const wrap=body=>'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{--font-inter:Arial;--font-rajdhani:Arial;font-family:Arial,sans-serif}'+globalCss+'\n'+css.code.toString()+'\n.space-y-6>*+*{margin-top:24px}</style></head><body><main class="wrap admin-workspace">'+body+'</main></body></html>';
 for(const section of ['tournaments','notifications','analytics','teams']){state=[];tree=render(OperationsPanel,{tournamentContent:React.createElement(TournamentAdminPanel,props)});if(section!=='tournaments'){button(tree,section==='notifications'?'Activity':section==='analytics'?'Analytics':'Teams').props.onClick();tree=render(OperationsPanel,{tournamentContent:null});}writeFileSync('.deployment/admin-preview/'+section+'.html',wrap(renderToStaticMarkup(tree)));}
 console.log('Generated private visual fixtures in .deployment/admin-preview.');
}
console.log('Admin UI checks passed: closed-by-default editor, modal cancel, typed deletion, readable activity, filters, both team sources and accessible chart figures.');
