const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const [name,...args]=process.argv.slice(2);
if(!name||!args.length){console.error('Usage: node scripts/record-command.cjs <phase> <command> [args...]');process.exit(2)}
const root=path.resolve(__dirname,'..'),dir=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'test-results'));fs.mkdirSync(dir,{recursive:true});
if(fs.existsSync(path.join(dir,name+'.log'))){console.error('Evidence phase already exists; use a new phase name to preserve previous results');process.exit(2)}
const git=(...args)=>{try{return cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()}catch{return'UNAVAILABLE'}};
const row={phase:name,command:args,start:new Date().toISOString(),sourceCommit:git('rev-parse','HEAD'),ciCommit:process.env.GITHUB_SHA||null,workingTree:git('status','--porcelain'),applicationVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,lockfileSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'package-lock.json'))).digest('hex')};
const log=fs.createWriteStream(path.join(dir,name+'.log'));
const child=cp.spawn(args[0],args.slice(1),{cwd:root,env:process.env,stdio:['ignore','pipe','pipe'],shell:process.platform==='win32'});
child.stdout.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk)});child.stderr.on('data',chunk=>{log.write(chunk);process.stderr.write(chunk)});
child.on('error',error=>{row.error=error.message});
child.on('close',(code,signal)=>{Object.assign(row,{end:new Date().toISOString(),exitCode:code,signal});log.end(()=>{fs.appendFileSync(path.join(dir,'commands.jsonl'),JSON.stringify(row)+'\n');process.exitCode=code===null?1:code})});
