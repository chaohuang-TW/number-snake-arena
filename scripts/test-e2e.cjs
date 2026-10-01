const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const configured=process.env.BASE_URL;
const baseURL=configured||'http://127.0.0.1:3020/';
let server;
async function ready(){const start=Date.now();while(Date.now()-start<20000){if(server&&server.exitCode!==null)throw new Error('Owned project server exited before readiness');try{const r=await fetch(baseURL);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('Project server did not become ready: '+baseURL)}
function startOwnedServer(){return new Promise((resolve,reject)=>{
 server=cp.spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','3020','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Owned project server did not bind its port')),20000);
 server.stdout.on('data',data=>{process.stdout.write(data);if(data.toString().includes('Local:')){clearTimeout(timer);resolve()}});
 server.stderr.on('data',data=>process.stderr.write(data));
 server.on('error',error=>{clearTimeout(timer);reject(error)});
 server.on('exit',code=>{clearTimeout(timer);reject(new Error('Owned project server exited: '+code))});
})}
(async()=>{try{if(!configured)await startOwnedServer();await ready();const cli=path.join(root,'node_modules/playwright/cli.js');const args=[cli,'test','--config',path.join(root,'playwright.config.cjs'),...process.argv.slice(2)];const child=cp.spawn(process.execPath,args,{cwd:root,env:{...process.env,BASE_URL:baseURL},stdio:'inherit'});child.on('error',error=>{console.error(error);server?.kill('SIGTERM');process.exitCode=1});child.on('exit',code=>{server?.kill('SIGTERM');process.exitCode=code??1})}catch(error){console.error(error);server?.kill('SIGTERM');process.exitCode=1}})();
process.on('SIGINT',()=>{server?.kill('SIGTERM');process.exit(130)});
process.on('SIGTERM',()=>{server?.kill('SIGTERM');process.exit(143)});
