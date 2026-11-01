/**
 * seed-vault.js — Wipe existing vault and insert real Dark Lords passwords
 * Run: node seed-vault.js
 */
const db = require('./database');

// Clear existing vault
db.prepare('DELETE FROM castle_accounts').run();
console.log('🗑️  Cleared existing vault entries');

// All player→password pairs extracted from the spreadsheet image
// Format: { castle_name: player_name, account_name: player_name, password: password }
const vaultEntries = [
  // Column A → B
  { castle_name: 'Alastor',         account_name: 'Alastor',         password: 'Leo15' },
  { castle_name: 'Abdou..',         account_name: 'Abdou..',         password: 'RamPage..#' },
  { castle_name: 'Alycor',          account_name: 'Alycor',          password: 'lov3ly' },
  { castle_name: 'Ana c',           account_name: 'Ana c',           password: 'anne1212' },
  { castle_name: 'Attila m',        account_name: 'Attila m',        password: '04Arthur67' },
  { castle_name: 'Atila-a-hun',     account_name: 'Atila-a-hun',     password: 'insignia1.75' },
  { castle_name: 'Bbq',             account_name: 'Bbq',             password: 'karavanas' },
  { castle_name: 'Bond kapitany',   account_name: 'Bond kapitany',   password: 'Barbara1988' },
  { castle_name: 'Cache',           account_name: 'Cache',           password: 'Satya@96372918' },
  { castle_name: 'Calvinasv13',     account_name: 'Calvinasv13',     password: 'famous80' },
  { castle_name: 'Castel name',     account_name: 'Castel name',     password: 'Limonad2' },
  { castle_name: 'Csingiling',      account_name: 'Csingiling',      password: 'Enyém76' },
  { castle_name: 'Chucky53',        account_name: 'Chucky53',        password: 'Cindy530' },
  { castle_name: 'Dabunor',         account_name: 'Dabunor',         password: 'Dabunor2016' },
  { castle_name: 'Darius imper',    account_name: 'Darius imper',    password: 'Darienas' },
  { castle_name: 'Devils castle',   account_name: 'Devils castle',   password: '.kepler22b1999.' },
  { castle_name: 'Defender',        account_name: 'Defender',        password: 'galamb' },
  { castle_name: 'Djвея',           account_name: 'Djвея',           password: 'wld3moulbghl' },
  { castle_name: 'Dubzero',         account_name: 'Dubzero',         password: 'NoelZella1997' },
  { castle_name: 'yemineni',        account_name: 'yemineni',        password: 'SRI@venkat37' },
  { castle_name: 'Galba',           account_name: 'Galba',           password: '0801Noah£' },
  { castle_name: 'General Israel',  account_name: 'General Israel',  password: 'onimisi' },
  { castle_name: 'GHOST SLAYER',    account_name: 'GHOST SLAYER',    password: 'ETAZO143' },
  { castle_name: 'G.g.',            account_name: 'G.g.',            password: 'DWMT79' },
  { castle_name: '--hades--',       account_name: '--hades--',       password: 'Torres02500' },
  { castle_name: 'Hola hijo',       account_name: 'Hola hijo',       password: 'HOLAHIJO123' },
  { castle_name: 'Inez',            account_name: 'Inez',            password: 'famous80' },
  { castle_name: 'Interdictum',     account_name: 'Interdictum',     password: 'brayan2805' },
  { castle_name: 'Kennu',           account_name: 'Kennu',           password: 'kennu1330' },
  { castle_name: 'King Ali',        account_name: 'King Ali',        password: 'AA085808AA' },
  { castle_name: 'King of hell',    account_name: 'King of hell',    password: 'mrnoob810' },

  // Column C → D
  { castle_name: 'Kistunder',       account_name: 'Kistunder',       password: 'Anna2026' },
  { castle_name: '- KING SCAR -',   account_name: '- KING SCAR -',   password: 'dp0990' },
  { castle_name: 'King1',           account_name: 'King1',           password: '221104' },
  { castle_name: 'Kraky',           account_name: 'Kraky',           password: 'Kraky468' },
  { castle_name: 'Kukubau',         account_name: 'Kukubau',         password: 'moca@1' },
  { castle_name: 'kvalitak',        account_name: 'kvalitak',        password: 'mojmir3705' },
  { castle_name: 'Leo jordanio',    account_name: 'Leo jordanio',    password: 'breakingbad' },
  { castle_name: 'Lord Jason O.',   account_name: 'Lord Jason O.',   password: 'N3tw0rk2026@JOSH' },
  { castle_name: 'Napoleon 7',      account_name: 'Napoleon 7',      password: 'tonyjrj' },
  { castle_name: 'Neja',            account_name: 'Neja',            password: 'Neja1711' },
  { castle_name: 'Niki3',           account_name: 'Niki3',           password: '23Lili91' },
  { castle_name: 'Okolutn',         account_name: 'Okolutn',         password: 'krda45' },
  { castle_name: 'Papajon',         account_name: 'Papajon',         password: 'papajon3535' },
  { castle_name: 'Petja',           account_name: 'Petja',           password: '' },
  { castle_name: 'Rikkoberto',      account_name: 'Rikkoberto',      password: 'rix987' },
  { castle_name: 'Rocky_Patrik',    account_name: 'Rocky_Patrik',    password: '13181424' },
  { castle_name: 'Sakiai',          account_name: 'Sakiai',          password: '19731977' },
  { castle_name: 'Saldaisn',        account_name: 'Saldaisn',        password: 'sal800' },
  { castle_name: 'Sarkanyfiu',      account_name: 'Sarkanyfiu',      password: 'Nusika02' },
  { castle_name: 'Scooby',          account_name: 'Scooby',          password: 'Yuvraj@26' },
  { castle_name: '-SLY-',           account_name: '-SLY-',           password: 'Vojta385' },
  { castle_name: 'Stefano',         account_name: 'Stefano',         password: 'rtx550' },
  { castle_name: 'Szotyi',          account_name: 'Szotyi',          password: 'galamb' },
  { castle_name: 'Štetec',          account_name: 'Štetec',          password: 'janmusil123' },
  { castle_name: 'Tigre',           account_name: 'Tigre',           password: 'mato7' },
  { castle_name: 'THEKombinátfogó', account_name: 'THEKombinátfogó', password: 'Magyarorszag01' },
  { castle_name: 'Toni48',          account_name: 'Toni48',          password: 'toni250' },
  { castle_name: 'Tomis',           account_name: 'Tomis',           password: 'Maryo777@#' },
  { castle_name: 'Trikaaldarshi',   account_name: 'Trikaaldarshi',   password: 'zeb@0809' },
  { castle_name: 'Turob',           account_name: 'Turob',           password: '7177' },
  { castle_name: 'V Jani',          account_name: 'V Jani',          password: 'Vaterboy40' },
  { castle_name: 'Vinkel',          account_name: 'Vinkel',          password: 'vi777' },
  { castle_name: 'xX-Samuel-Xx',    account_name: 'xX-Samuel-Xx',    password: '' },
  { castle_name: 'zsizinátor',      account_name: 'zsizinátor',      password: 'Galamb' },
  { castle_name: 'Rumen mironov',   account_name: 'Rumen mironov',   password: 'Tiger1234' },
];

const now = new Date().toISOString().split('T')[0];
const ins = db.prepare(`
  INSERT INTO castle_accounts (castle_name, account_name, password, realm, sitter, notes, created_at, updated_at)
  VALUES (@castle_name, @account_name, @password, @realm, @sitter, @notes, @created_at, @updated_at)
`);

const insertAll = db.transaction((entries) => {
  for (const entry of entries) {
    ins.run({
      castle_name:  entry.castle_name,
      account_name: entry.account_name,
      password:     entry.password,
      realm:        '',
      sitter:       '',
      notes:        '',
      created_at:   now,
      updated_at:   now,
    });
  }
});

insertAll(vaultEntries);
console.log(`✅ Inserted ${vaultEntries.length} vault entries from Dark Lords password list`);

db.close();
