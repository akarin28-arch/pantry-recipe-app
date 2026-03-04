const fs = require('fs');

const path = './src/lib/recipes.ts';
let content = fs.readFileSync(path, 'utf8');

const genres = {
    "chicken_curry": "洋",
    "nikujaga": "和",
    "oyakodon": "和",
    "shogayaki": "和",
    "yasai_itame": "中",
    "chahan": "中",
    "teriyaki_chicken": "和",
    "potato_salad": "洋",
    "omurice": "洋",
    "yakisoba": "その他",
    "mapo_tofu": "中",
    "hamburg": "洋",
    "chikuzenni": "和",
    "soboro_don": "和",
    "napolitan": "洋",
    "misoshiru": "和",
    "tamagoyaki": "和",
    "kinpira_gobo": "和",
    "tonjiru": "和",
    "sake_shioyaki": "和",
};

for (const [id, genre] of Object.entries(genres)) {
    const regex = new RegExp(`(id:\\s*"${id}",\\s*name:\\s*".*?",\\s*description:\\s*".*?",)`);
    content = content.replace(regex, `$1\n    genre: "${genre}",`);
}

fs.writeFileSync(path, content);
console.log('Done!');
