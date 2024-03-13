import { OAuth2Client } from 'google-auth-library';
import EmailTransactionService from '../../Application/Service/EmailTransactionService';
import fs from 'fs';
import { promisify } from 'util';
import mongoose from 'mongoose';
import TransactionRepository from '../../Infrastructure/Persistence/TransactionRepository';
import GmailApiAdapter from '../../Infrastructure/api/GmailApiAdapter';
import dotenv from 'dotenv';
dotenv.config();

async function int() {
  const readFileAsync = promisify(fs.readFile);

  const TOKEN_PATH = __dirname + '/../../../../gmail-nodejs-quickstart.json'; //アクセストークンのファイルを指定
  //クレデンシャル情報の取得
  const content = await readFileAsync(
    __dirname + '/../../../../client_secret.json'
  );
  const credentials = JSON.parse(String(content)); //クレデンシャル
  console.log(credentials);

  //認証
  const clientSecret = credentials.installed.client_secret;
  const clientId = credentials.installed.client_id;
  const redirectUrl = credentials.installed.redirect_uris[0];
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
  const token = await readFileAsync(TOKEN_PATH);
  oauth2Client.credentials = JSON.parse(String(token));
  return oauth2Client;
}

async function main() {
  const repository = new TransactionRepository();
  const oauth2Client = await int();
  const query =
    'from:service@ac.rakuten-bank.co.jp -label:取得済み "◆デビットカードご利用通知メール◆"';
  const emailTransactionService = new EmailTransactionService(
    oauth2Client,
    repository
  );
  await emailTransactionService.fetchTransactions(query);
}

mongoose
  .connect('mongodb://127.0.01:27017/rakuten-card')
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.log('MongoDB connection error', err);
    process.exit();
  })
  .then(() => {
    main()
      .catch(async (err) => {
        console.error(err);
        const oauth2Client = await int();
        const query = 'query';
        const formattedStack = err.stack
          .replace(/(?:\r\n|\r|\n)/g, '<br>') // 改行を<br>に変換
          .replace(/\s/g, '&nbsp;'); // スペースを&nbsp;に変換

        const htmlMessage = `
<html>
<head>
<style>
  body {
    font-family: 'Courier New', Courier, monospace;
  }
  .error-message {
    color: red;
  }
  .stack-trace {
    white-space: pre-wrap; /* CSSが直接適用されているため、この設定は効果がありませんが、意図を示すために含めています。 */
  }
</style>
</head>
<body>
  <h2 class="error-message">自動明細アプリでエラーが発生しました[${err.name}:${err.message}]</h2>
  <div class="stack-trace">${formattedStack}</div>
</body>
</html>
`;
        const gmailApiAdapter = new GmailApiAdapter(oauth2Client, query);
        const raw = {
          to: process.env.EMAIL_RECIPIENT,
          from: 'me',
          subject: `エラーが発生しました[${err.name}:${err.message}]`,
          message: htmlMessage,
        };
        await gmailApiAdapter.sendMessage(raw);
        
      })
      .finally(() => {
        mongoose.disconnect();
        process.exit();
      });
  });
