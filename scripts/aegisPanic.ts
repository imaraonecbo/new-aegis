import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const mode=(process.argv[2]||"status").toLowerCase();
const file=process.env.AEGIS_PANIC_FILE?.trim()||"runtime/aegis.panic";

if(mode==="on"){
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,new Date().toISOString()+"\n","utf8");
  console.log("AEGIS PANIC: ON");
  console.log("New gasless executions will be rejected.");
  process.exit(0);
}

if(mode==="off"){
  try{await unlink(file);}catch{}
  console.log("AEGIS PANIC: OFF");
  console.log("Gasless execution is still subject to all other production gates.");
  process.exit(0);
}

if(mode==="status"){
  try{await import("node:fs/promises").then(fs=>fs.access(file));console.log("AEGIS PANIC: ON");}
  catch{console.log("AEGIS PANIC: OFF");}
  process.exit(0);
}

throw new Error("Usage: npm run aa:panic -- on|off|status");
