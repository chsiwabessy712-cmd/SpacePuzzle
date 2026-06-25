const cp = require('child_process');
const fs = require('fs');

cp.execSync('git reset --hard HEAD');

const lines = fs.readFileSync('C:\\Users\\ij\\.gemini\\antigravity-ide\\brain\\64199771-d03e-400e-bf9e-ac6dedefc906\\.system_generated\\logs\\transcript_full.jsonl', 'utf-8').split('\n').filter(l=>l);

function tryParse(v) {
  try {
    return JSON.parse(v);
  } catch(e) {
    return v;
  }
}

for (const line of lines) {
  const step = JSON.parse(line);
  if (step.step_index >= 200) break;
  if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
    for (const call of step.tool_calls) {
      if (call.name === 'replace_file_content') {
        const file = tryParse(call.args.TargetFile);
        let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        const target = call.args.TargetContent.replace(/\r\n/g, '\n');
        const repl = call.args.ReplacementContent;
        content = content.replace(target, repl);
        fs.writeFileSync(file, content);
      } else if (call.name === 'multi_replace_file_content') {
        const file = tryParse(call.args.TargetFile);
        let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        let chunks = call.args.ReplacementChunks;
        if (typeof chunks === 'string') chunks = tryParse(chunks);
        for (const chunk of chunks) {
          content = content.replace(chunk.TargetContent.replace(/\r\n/g, '\n'), chunk.ReplacementContent);
        }
        fs.writeFileSync(file, content);
      }
    }
  }
}
console.log('Done!');
