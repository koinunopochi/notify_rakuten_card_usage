import { OAuth2Client } from 'google-auth-library';
import GmailApiAdapter from '../../Infrastructure/api/GmailApiAdapter';
import TransactionDate from '../../Domain/ValueObject/TransactionDate';
import WithdrawalAmount from '../../Domain/ValueObject/WithdrawalAmount';
import Transaction from '../../Domain/Model/Transaction';
import ITransactionRepository from '../../Domain/Interfaces/ITransactionRepository';
import dotenv from 'dotenv';
dotenv.config();

import log4js from 'log4js';
const logger = log4js.getLogger();
logger.level = 'all';
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    app: { type: 'file', filename: './logs/application.log' },
  },
  categories: {
    default: { appenders: ['out', 'app'], level: 'debug' },
  },
});


class EmailTransactionService {
  private readonly _oauth2Client: OAuth2Client;
  private readonly _repository: ITransactionRepository;

  constructor(oauth2Client: OAuth2Client, repository: ITransactionRepository) {
    this._oauth2Client = oauth2Client;
    this._repository = repository;
  }

  private _buildTransactionDate(date: Date): TransactionDate {
    return new TransactionDate(date);
  }
  private _buildWithdrawalAmount(snippet: string): WithdrawalAmount {
    const amount = this._extractAmount(snippet);
    return new WithdrawalAmount(Number(amount));
  }
  private _buildTransaction(date: string, snippet: string): Transaction {
    const transactionDate = this._buildTransactionDate(new Date(Number(date)));
    const withdrawalAmount = this._buildWithdrawalAmount(snippet);
    return new Transaction(transactionDate, withdrawalAmount);
  }

  private async _buildTransactionFromMessage(
    gmailApiAdapter: GmailApiAdapter,
    messageId: string
  ): Promise<Transaction> {
    const res = await gmailApiAdapter.getMessage(messageId);
    const date = String(res.data.internalDate);
    const snippet = String(res.data.snippet);
    const transaction = this._buildTransaction(date, snippet);
    return transaction;
  }

  private async _handleTransactionFromGmailMessage(
    gmailApiAdapter: GmailApiAdapter,
    messageId: string
  ): Promise<void> {
    const transaction = await this._buildTransactionFromMessage(
      gmailApiAdapter,
      messageId
    );
    await this._repository.save(transaction);
    logger.info('取引を保存しました');
  }

  private async _yesterdayTransactions(): Promise<Transaction[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = new TransactionDate(yesterday);
    return await this._repository.findByDateRange(yesterdayDate, yesterdayDate);
  }

  private async _todayTransactions(): Promise<Transaction[]> {
    const today = new Date();
    // 今日の日付の0時0分0秒を設定
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    // 今日の日付の23時59分59秒に設定
    endOfDay.setHours(23, 59, 59, 999);
    return await this._repository.findByDateRange(
      new TransactionDate(today),
      new TransactionDate(endOfDay)
    );
  }

  private async _processTransactionAndLabelMessage(
    messageId: string
  ): Promise<void> {
    // メールにラベルを付与
    // TODO:messageresponseの型を作成
    const gmailApiAdapter = new GmailApiAdapter(this._oauth2Client, '');

    await this._handleTransactionFromGmailMessage(gmailApiAdapter, messageId);
    // id: 'Label_3553825594615419646',
    // name: '取得済み_ステージング',

    // id: 'Label_3417572379770606098',
    // name: '取得済み',
    await gmailApiAdapter.addLabelToMessage(
      messageId,
      'Label_3553825594615419646'
      // 'Label_3417572379770606098'
    );
  }
  private async _getThisMonthTransactions(): Promise<Transaction[]> {
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth();
    const startDate = new TransactionDate(new Date(nowYear, nowMonth, 1));
    const endDate = new TransactionDate(new Date(nowYear, nowMonth + 1, 0));

    return await this._repository.findByDateRange(startDate, endDate);
  }

  private _sumTransactionValues(transactions: Transaction[]): number {
    let totalAmount = 0;
    transactions.forEach((transaction) => {
      totalAmount += transaction.value().amount.value();
    });
    return totalAmount;
  }

  private async _sendEmail(gmailApiAdapter: GmailApiAdapter): Promise<void> {
    // 今月の総額を作成
    const transactions = await this._getThisMonthTransactions();
    const totalAmount = this._sumTransactionValues(transactions);

    // 昨日の総額を作成
    const yesterdayTransactions = await this._yesterdayTransactions();
    const yesterdayTotalAmount = this._sumTransactionValues(
      yesterdayTransactions
    );

    const todayTransactions = await this._todayTransactions();
    const todayTotalAmount = this._sumTransactionValues(todayTransactions);

    console.log('今月の取引', transactions);
    console.log('今月の総額', totalAmount);
    console.log('今日の取引', todayTransactions);
    console.log('今日の総額', todayTotalAmount);
    console.log('昨日の取引', yesterdayTransactions);
    console.log('昨日の総額', yesterdayTotalAmount);

    console.log(transactions);

    let totalAmountHtml = `<table style="width: 90%; border-collapse: collapse;">
                        <tr style="background-color: #4CAF50; color: white;">
                          <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                          <th style="padding: 8px; border: 1px solid #ddd;">Amount</th>
                        </tr>`;

    transactions.forEach((transaction) => {
      let amountValue = transaction.value().amount.value();
      let color = amountValue <= 0 ? '#4CAF50' : '#F44336'; // 緑色でプラス、赤色でマイナス
      totalAmountHtml += `<tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${transaction
                          .value()
                          .date.value()}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: ${color};">${amountValue}</td>
                      </tr>`;
    });

    totalAmountHtml += `</table>`;

    totalAmountHtml += '</table>';

    // メールを送信
    const messageBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transaction Summary</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
  <div style="background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #4CAF50;">取引概要</h2>
    <p style="margin-bottom: 10px;"><strong>前日の総額＋昨日の金額：</strong><span style="color: #555;">${
      totalAmount - yesterdayTotalAmount
    } + ${yesterdayTotalAmount} = ${totalAmount}</span></p>
    <p style="margin-bottom: 10px;"><strong>今月の取引：</strong><span style="color: #555;">${
      transactions.length
    }件</span></p>
    <p style="margin-bottom: 10px;"><strong>今月の総額：</strong><span style="color: #555;">${totalAmount}円</span></p>
    <p style="margin-bottom: 10px;"><strong>本日の取引：</strong><span style="color: #555;">${
      todayTransactions.length
    }件</span></p>
    <p style="margin-bottom: 10px;"><strong>本日の総額：</strong><span style="color: #555;">${todayTotalAmount}円</span></p>
    <p style="margin-bottom: 10px;"><strong>昨日の取引：</strong><span style="color: #555;">${
      yesterdayTransactions.length
    }件</span></p>
    <p><strong>昨日の総額：</strong><span style="color: #555;">${yesterdayTotalAmount}円</span></p>
    ${totalAmountHtml}
  </div>
  </body></html>`;

    const raw = {
      to: process.env.EMAIL_RECIPIENT,
      from: 'me',
      subject: '本日の取引概要',
      message: messageBody,
    };
    await gmailApiAdapter.sendMessage(raw);
  }

  public async fetchTransactions(query: string) {
    const gmailApiAdapter = new GmailApiAdapter(this._oauth2Client, query);
    const response = await gmailApiAdapter.getMessageIds();
    const messageIds = response.data.messages;
    // メールがない場合
    if (messageIds === undefined) {
      logger.info('メールがありません');
      await this._sendEmail(gmailApiAdapter);
      return;
    }
    for (const messageId of messageIds) {
      await this._processTransactionAndLabelMessage(String(messageId.id));
      logger.info('取引を処理しました');
    }
    await this._sendEmail(gmailApiAdapter);
    logger.info('メールを送信しました');
  }

  private _extractAmount(text: string): string | null {
    const pattern = /口座引落分：(\d+)円/;
    const matches = text.match(pattern);

    return matches ? matches[1] : null;
  }
}

export default EmailTransactionService;
