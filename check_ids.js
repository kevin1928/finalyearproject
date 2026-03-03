const fs = require('fs');
const js = fs.readFileSync('public/js/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');

// Find all getElementById references
const idRefs = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const uniqueIds = [...new Set(idRefs)];

// Find all querySelector references  
const qsRefs = [...js.matchAll(/querySelector\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);

// Check for missing IDs
const missing = [];
for (const id of uniqueIds) {
    if (!html.includes(`id="${id}"`)) {
        missing.push(id);
    }
}

console.log(`Total unique getElementById refs: ${uniqueIds.length}`);
console.log(`Missing IDs: ${missing.length ? missing.join(', ') : 'NONE ✅'}`);
console.log(`\nquerySelector refs:`);
qsRefs.forEach(qs => {
    console.log(`  ${qs}`);
});

// Check for syntax errors in JS
try {
    new Function(js);
    console.log('\nJS syntax check: PASS ✅');
} catch (e) {
    console.log(`\nJS syntax error: ${e.message} ❌`);
}
